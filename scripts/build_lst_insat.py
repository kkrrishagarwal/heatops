"""
Builds public/data/lst_insat_real.json — real per-city land/surface skin temperature
readings sourced from ISRO's INSAT-3D/3DR geostationary satellite (MOSDAC), replacing
reliance on the global (non-Indian) MODIS-derived training set used by
scripts/train_lst_model.py for anything that can show a genuine live Indian reading.

STATUS: waiting on MOSDAC account approval (mosdac.gov.in/signup/) — this script is
ready to run but two things below are still unconfirmed and marked TODO:

  1. MOSDAC_DATASET_ID — the exact catalog dataset id to request via mdapi.py.
     ISRO's own 2014 INSAT-3D Data Products Format Document does not list a plain
     "LST" product; the real, documented equivalent is the SOUNDER L2B "Surface Skin
     Temperature" product (dataset names TSurfPhy = physical retrieval, TSurfReg =
     regression retrieval), 10km resolution, refreshed every ~30 min. There may also be
     a newer Imager-based LST product added to the catalog since 2014 (referenced in
     Singh et al. 2016, JGR) at finer 4km resolution — check the live catalog browser
     (mosdac.gov.in/catalog-app/satellite.php, requires login) for both names before
     picking one.
  2. TEMP_DATASET_CANDIDATES below — the in-file HDF5 dataset name(s) to read. Defaults
     to the documented names, but run this script with --inspect on a real downloaded
     .h5 file first to confirm they match (ISRO's live files may differ from the 2014
     spec doc, and INSAT-3DR's format could differ from INSAT-3D's).

This script does NOT perform the MOSDAC download itself — download granules for your
city bounding box using MOSDAC's own mdapi.py + config.json client (that's their
official tool; reimplementing their undocumented HTTP API here would risk building
against guessed endpoints). Point HDF5_DIR below at wherever mdapi.py saved its files,
then run this script to parse them.

Usage:
  python3 scripts/build_lst_insat.py --inspect path/to/sample_granule.h5
      Prints every dataset's name, shape, dtype, and attributes in the file — use this
      once you have a real granule to confirm MOSDAC_DATASET_ID / dataset name choices
      above actually match, before trusting the constants below.

  python3 scripts/build_lst_insat.py
      Parses every .h5 file in HDF5_DIR, matches each Indian city (reusing lat/lon
      already resolved in public/data/lulc_real.json — no new geocoding needed) to its
      nearest valid satellite pixel via a KD-tree over the granule's per-pixel 2D
      lat/lon arrays (L2B products are stored as an irregular geostationary swath, not
      a simple regular grid — see format doc section 2.7), and writes
      public/data/lst_insat_real.json.
"""
import argparse
import glob
import json
import os
import sys

import h5py
import numpy as np
from scipy.spatial import cKDTree

LULC_PATH = "public/data/lulc_real.json"
HDF5_DIR = "scripts/data/insat_lst_granules"  # TODO: point at mdapi.py's download_path
OUTPUT_PATH = "public/data/lst_insat_real.json"

# TODO: confirm against the live MOSDAC catalog (see module docstring point 1).
MOSDAC_DATASET_ID = "TODO_CONFIRM_FROM_LIVE_CATALOG"

# Tried in order against each opened file; first one present wins.
TEMP_DATASET_CANDIDATES = ["TSurfPhy", "TSurfReg", "LST"]
LAT_DATASET_CANDIDATES = ["Latitude"]
LON_DATASET_CANDIDATES = ["Longitude"]

# A city pixel match farther than this is considered no-coverage rather than guessed —
# 10km-resolution Sounder pixels are roughly ~0.1-0.15 deg apart at these latitudes.
MAX_MATCH_DEG = 0.25

# Plausible physical temperature range used to reject fill-value/garbage pixels when a
# file has no explicit _FillValue attribute. Deliberately wide (not a "normal weather"
# range) since this is surface skin temp, not air temp, and can run hot.
PLAUSIBLE_CELSIUS = (-60, 90)
PLAUSIBLE_KELVIN = (213, 363)  # same range, offset by 273.15


def inspect(path):
    with h5py.File(path, "r") as f:
        def visit(name, obj):
            if isinstance(obj, h5py.Dataset):
                print(f"{name:40s} shape={obj.shape} dtype={obj.dtype}")
                for k, v in obj.attrs.items():
                    print(f"    attr {k} = {v}")
        f.visititems(visit)
        print("\nRoot-level attrs:")
        for k, v in f.attrs.items():
            print(f"  {k} = {v}")


def first_present(h5file, candidates):
    for name in candidates:
        if name in h5file:
            return name
    return None


def to_celsius(values, units_attr):
    units = (units_attr or "").strip().lower()
    if units in ("k", "kelvin"):
        return values - 273.15
    return values  # assume already Celsius, or unitless-but-physical as documented


def load_city_coords():
    with open(LULC_PATH) as f:
        lulc = json.load(f)["cities"]
    return {name: (info["lat"], info["lon"], info["state"]) for name, info in lulc.items()}


def parse_granule(path):
    """Returns (lats, lons, temps_celsius, acquisition_attrs) flattened + fill-filtered,
    or None if the expected datasets aren't present (surfaced to the caller as a skip,
    not a crash — a mixed batch of granule types in HDF5_DIR shouldn't kill the whole run)."""
    with h5py.File(path, "r") as f:
        temp_name = first_present(f, TEMP_DATASET_CANDIDATES)
        lat_name = first_present(f, LAT_DATASET_CANDIDATES)
        lon_name = first_present(f, LON_DATASET_CANDIDATES)
        if not (temp_name and lat_name and lon_name):
            return None

        temp_ds = f[temp_name]
        raw = temp_ds[()].astype(np.float64)
        fill = temp_ds.attrs.get("_FillValue")
        units = temp_ds.attrs.get("units")
        if isinstance(units, bytes):
            units = units.decode()

        lats = f[lat_name][()].astype(np.float64)
        lons = f[lon_name][()].astype(np.float64)

        if raw.shape != lats.shape:
            # L2B geolocation can be stored at a different pixel indexing than the
            # parameter itself for some product variants — bail rather than silently
            # misaligning coordinates to values.
            print(f"  SKIP {path}: {temp_name} shape {raw.shape} != lat/lon shape {lats.shape}")
            return None

        valid = np.isfinite(raw) & np.isfinite(lats) & np.isfinite(lons)
        valid &= (lats >= -90) & (lats <= 90) & (lons >= -180) & (lons <= 180)
        if fill is not None:
            valid &= ~np.isclose(raw, float(fill))

        celsius = to_celsius(raw, units)
        valid &= (celsius >= PLAUSIBLE_CELSIUS[0]) & (celsius <= PLAUSIBLE_CELSIUS[1])

        if not valid.any():
            print(f"  SKIP {path}: no valid pixels after filtering (check fill-value/units assumptions)")
            return None

        acquisition = {
            "file": os.path.basename(path),
            "dataset": temp_name,
        }
        for key in ("Observation_Start_Time", "Observation_End_Time", "Date"):
            if key in f.attrs:
                v = f.attrs[key]
                acquisition[key] = v.decode() if isinstance(v, bytes) else str(v)

        return lats[valid], lons[valid], celsius[valid], acquisition


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--inspect", metavar="FILE", help="Print HDF5 structure of a single granule and exit")
    args = ap.parse_args()

    if args.inspect:
        inspect(args.inspect)
        return

    cities = load_city_coords()
    print(f"Loaded {len(cities)} cities with known lat/lon from {LULC_PATH}")

    granule_paths = sorted(glob.glob(os.path.join(HDF5_DIR, "*.h5")))
    if not granule_paths:
        print(f"No .h5 files found in {HDF5_DIR} — download some via MOSDAC's mdapi.py first.")
        sys.exit(1)

    results = {}
    for path in granule_paths:
        parsed = parse_granule(path)
        if parsed is None:
            continue
        lats, lons, temps, acquisition = parsed
        tree = cKDTree(np.column_stack([lons, lats]))  # (lon, lat) order for degree-distance math

        for city, (clat, clon, state) in cities.items():
            dist, idx = tree.query([clon, clat])
            if dist > MAX_MATCH_DEG:
                continue
            entry = {
                "tempCelsius": round(float(temps[idx]), 1),
                "state": state,
                "lat": clat,
                "lon": clon,
                "pixelDistanceDeg": round(float(dist), 3),
                "acquisition": acquisition,
            }
            # Later granules overwrite earlier ones for the same city — most recent wins.
            results[city] = entry

    output = {
        "source": {
            "title": "INSAT-3D/3DR Surface Skin Temperature (Sounder L2B)",
            "publisher": "ISRO Space Applications Centre, via MOSDAC",
            "url": "https://mosdac.gov.in",
            "datasetId": MOSDAC_DATASET_ID,
            "resolution": "10km",
            "refreshInterval": "~30 min (geostationary)",
        },
        "note": (
            "Real per-city surface skin temperature readings from ISRO's INSAT-3D/3DR "
            "geostationary satellite, nearest-pixel-matched to each city's coordinates "
            "(see pixelDistanceDeg per city; entries beyond "
            f"{MAX_MATCH_DEG} deg are dropped rather than guessed). Not all cities in "
            "lulc_real.json will have coverage in every granule batch — missing cities "
            "had no valid pixel within range, not a fabricated value."
        ),
        "cities": results,
    }

    with open(OUTPUT_PATH, "w") as f:
        json.dump(output, f, indent=2)

    print(f"Matched {len(results)} / {len(cities)} cities across {len(granule_paths)} granule(s).")
    print(f"Wrote {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
