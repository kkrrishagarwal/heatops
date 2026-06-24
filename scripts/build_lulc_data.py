"""
Builds public/data/lulc_real.json — real classified land cover percentages
for one representative (state capital / largest) city per Indian state/UT,
sourced from ESA WorldCover 10m v200 (2021), read directly via HTTP range
requests against the public, no-auth-required S3 bucket (no local download
of the full ~90MB-per-tile rasters).

Lat/lon per city comes from Open-Meteo's geocoding API — the same one already
used elsewhere in the app for weather lookups, so no new data source is
introduced for that part.

Run once, offline, ahead of deploy: `python3 scripts/build_lulc_data.py`
"""
import json
import time
import urllib.request
import numpy as np
import rasterio
from rasterio.windows import from_bounds

STATE_CITIES = [
    ("Andhra Pradesh", "Visakhapatnam"),
    ("Arunachal Pradesh", "Itanagar"),
    ("Assam", "Guwahati"),
    ("Bihar", "Patna"),
    ("Chhattisgarh", "Raipur"),
    ("Goa", "Panaji"),
    ("Gujarat", "Ahmedabad"),
    ("Haryana", "Faridabad"),
    ("Himachal Pradesh", "Shimla"),
    ("Jharkhand", "Ranchi"),
    ("Karnataka", "Bengaluru"),
    ("Kerala", "Thiruvananthapuram"),
    ("Madhya Pradesh", "Bhopal"),
    ("Maharashtra", "Mumbai"),
    ("Manipur", "Imphal"),
    ("Meghalaya", "Shillong"),
    ("Mizoram", "Aizawl"),
    ("Nagaland", "Kohima"),
    ("Odisha", "Bhubaneswar"),
    ("Punjab", "Ludhiana"),
    ("Rajasthan", "Jaipur"),
    ("Sikkim", "Gangtok"),
    ("Tamil Nadu", "Chennai"),
    ("Telangana", "Hyderabad"),
    ("Tripura", "Agartala"),
    ("Uttar Pradesh", "Lucknow"),
    ("Uttarakhand", "Dehradun"),
    ("West Bengal", "Kolkata"),
    ("Jammu and Kashmir", "Jammu"),
    ("Ladakh", "Leh"),
    ("Delhi", "New Delhi"),
    ("Chandigarh", "Chandigarh"),
    ("Puducherry", "Puducherry"),
    ("Andaman and Nicobar Islands", "Port Blair"),
    ("Lakshadweep", "Kavaratti"),
    ("Dadra and Nagar Haveli and Daman and Diu", "Silvassa"),
]

# ESA WorldCover class codes -> grouped buckets for the panel
BUILT_UP = {50}
VEGETATION = {10, 20, 30, 40, 90, 95, 100}  # tree, shrub, grass, cropland, wetland, mangrove, moss/lichen
WATER = {80}
# everything else (60 bare/sparse, 70 snow/ice, or anything unexpected) -> bare/other

WORLDCOVER_BASE = "https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/map/ESA_WorldCover_10m_2021_v200_{tile}_Map.tif"
BUFFER_DEG = 0.045  # ~5km box around the city point


def geocode(city):
    # count=10 + filter to India specifically — a plain count=1 query previously
    # matched "Leh" to France's "Le Havre" (alphabetically/phonetically similar,
    # wrong country) since Open-Meteo's geocoding ranks by relevance, not by any
    # implied country. Every result here MUST be the Indian city, not just the
    # top-ranked global match.
    url = f"https://geocoding-api.open-meteo.com/v1/search?name={urllib.parse.quote(city)}&count=10"
    with urllib.request.urlopen(url, timeout=20) as resp:
        data = json.load(resp)
    candidates = data.get("results", [])
    india_matches = [r for r in candidates if r.get("country_code") == "IN"]
    if not india_matches:
        raise ValueError(f"No India result for '{city}' — candidates: {[(r['name'], r['country_code']) for r in candidates]}")
    r = india_matches[0]
    return r["latitude"], r["longitude"]


def tile_name(lat, lon):
    lat_floor = int(np.floor(lat / 3) * 3)
    lon_floor = int(np.floor(lon / 3) * 3)
    lat_str = f"N{abs(lat_floor):02d}" if lat_floor >= 0 else f"S{abs(lat_floor):02d}"
    lon_str = f"E{abs(lon_floor):03d}" if lon_floor >= 0 else f"W{abs(lon_floor):03d}"
    return f"{lat_str}{lon_str}"


def classify(lat, lon):
    tile = tile_name(lat, lon)
    url = "/vsicurl/" + WORLDCOVER_BASE.format(tile=tile)
    with rasterio.open(url) as src:
        window = from_bounds(lon - BUFFER_DEG, lat - BUFFER_DEG, lon + BUFFER_DEG, lat + BUFFER_DEG, src.transform)
        data = src.read(1, window=window)
    vals, counts = np.unique(data, return_counts=True)
    total = int(counts.sum())
    built = veg = water = other = 0
    for v, c in zip(vals, counts):
        v = int(v)
        if v in BUILT_UP:
            built += c
        elif v in VEGETATION:
            veg += c
        elif v in WATER:
            water += c
        else:
            other += c
    return {
        "builtUp": round(100 * built / total, 1),
        "vegetation": round(100 * veg / total, 1),
        "water": round(100 * water / total, 1),
        "bareOther": round(100 * other / total, 1),
    }


import urllib.parse  # noqa: E402  (used in geocode())

results = {}
for state, city in STATE_CITIES:
    try:
        lat, lon = geocode(city)
        breakdown = classify(lat, lon)
        results[city] = {**breakdown, "state": state, "lat": round(lat, 4), "lon": round(lon, 4)}
        print(f"OK  {state:45s} {city:18s} {breakdown}")
    except Exception as e:
        print(f"FAIL {state:45s} {city:18s} {e}")
    time.sleep(0.3)  # be polite to the free geocoding API

output = {
    "source": {
        "title": "ESA WorldCover 10m v200 (2021)",
        "publisher": "ESA / VITO, distributed via AWS Open Data",
        "url": "https://esa-worldcover.org",
        "resolution": "10m",
        "sampleAreaRadiusKm": 5,
    },
    "note": "Computed for one representative city per state/UT only (state capital or largest city). Cities not listed below do not have a real classification yet — do not estimate a value for them.",
    "cities": results,
}

with open("public/data/lulc_real.json", "w") as f:
    json.dump(output, f, indent=2)

print(f"\nWrote public/data/lulc_real.json with {len(results)}/{len(STATE_CITIES)} cities")
