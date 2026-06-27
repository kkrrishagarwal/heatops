"""
Builds public/data/lulc_real.json — real classified land cover percentages for the top N
cities per Indian state/UT (by the order they're listed in STATE_DATA, which is already
population/prominence-ordered — e.g. Maharashtra: Mumbai, Pune, Nagpur, Nashik...), sourced
from ESA WorldCover 10m v200 (2021), read directly via HTTP range requests against the public,
no-auth-required S3 bucket (no local download of the full ~90MB-per-tile rasters).

Cities not covered here still get a real-data answer via the nearest-neighbor/state-fallback
system in src/utils/lulcFallback.js — this script only controls how many cities get their OWN
direct classification instead of borrowing a neighbor's.

The city list is extracted directly from STATE_DATA in src/App.jsx (not hand-copied) so it
can't drift out of sync as cities are added/removed there. Already-classified cities (from a
previous run's output) are reused as-is rather than re-fetched, so re-running this to add more
cities later is cheap.

Lat/lon per city comes from Open-Meteo's geocoding API — the same one already used elsewhere
in the app for weather lookups, so no new data source is introduced for that part.

Usage: python3 scripts/build_lulc_data.py [cities_per_state]   (default: 5)
"""
import json
import re
import sys
import time
import urllib.request
import urllib.parse
import numpy as np
import rasterio
from rasterio.windows import from_bounds

CITIES_PER_STATE = int(sys.argv[1]) if len(sys.argv) > 1 else 5

APP_JSX_PATH = "src/App.jsx"
OUTPUT_PATH = "public/data/lulc_real.json"


def extract_top_cities_per_state(n):
    with open(APP_JSX_PATH) as f:
        content = f.read()
    start = content.index("const STATE_DATA = {")
    end = content.index("} // end STATE_DATA")
    block = content[start:end]
    pattern = re.compile(r'"([^"]+)":\s*\{[^{}]*?cities:\[(.*?)\]\s*\}', re.S)
    pairs = []
    seen_cities = {}  # city name -> state that already claimed it
    skipped_collisions = []
    for m in pattern.finditer(block):
        state = m.group(1)
        cities = re.findall(r'"([^"]+)"', m.group(2))
        for city in cities[:n]:
            # lulc_real.json is keyed by city NAME ONLY (every consumer in the app reads
            # lulcReal.cities[cityName]) — so the same name can't hold two different states'
            # real measurements at once. A few names are duplicated across STATE_DATA's lists
            # on purpose (e.g. "Gurugram" listed under both Haryana, its real administrative
            # state, and Delhi, an NCR-grouping convenience) and a couple are genuinely
            # different towns that happen to share a name (e.g. "Udaipur" — Rajasthan's city
            # of lakes vs. a small town in Tripura). Either way, only the FIRST state to claim
            # a name gets a real entry here; any other state's request for that same name
            # falls through to the existing nearest-neighbor/state-fallback system at runtime
            # (which resolves it via that state's own correct coordinate, not the other
            # state's borrowed one — see src/utils/lulcFallback.js).
            if city in seen_cities:
                if seen_cities[city] != state:
                    skipped_collisions.append((state, city, seen_cities[city]))
                continue
            seen_cities[city] = state
            pairs.append((state, city))
    if skipped_collisions:
        print(f"Skipping {len(skipped_collisions)} cross-state name collisions (kept under the first-listed state, others fall back to nearest-neighbor at runtime):")
        for state, city, kept_under in skipped_collisions:
            print(f"  '{city}' requested under {state} — already kept under {kept_under}")
    return pairs


# ESA WorldCover class codes -> grouped buckets for the panel
BUILT_UP = {50}
VEGETATION = {10, 20, 30, 40, 90, 95, 100}  # tree, shrub, grass, cropland, wetland, mangrove, moss/lichen
WATER = {80}
# everything else (60 bare/sparse, 70 snow/ice, or anything unexpected) -> bare/other

WORLDCOVER_BASE = "https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/map/ESA_WorldCover_10m_2021_v200_{tile}_Map.tif"
BUFFER_DEG = 0.045  # ~5km box around the city point


def geocode(city, state):
    # count=10 + filter to India specifically — a plain count=1 query previously
    # matched "Leh" to France's "Le Havre" (alphabetically/phonetically similar,
    # wrong country) since Open-Meteo's geocoding ranks by relevance, not by any
    # implied country. Every result here MUST be the Indian city, not just the
    # top-ranked global match.
    #
    # Among the India results, prefer whichever one's admin1 (state) actually matches the
    # state we're looking it up for — same fix as weatherAPI.js/geocodeCities.mjs. Without
    # this, a same-named town in a different state (e.g. Rajasthan's Udaipur vs. a much
    # smaller Udaipur in Tripura) can silently win by population/relevance ranking regardless
    # of which state actually asked for it.
    url = f"https://geocoding-api.open-meteo.com/v1/search?name={urllib.parse.quote(city)}&count=10"
    with urllib.request.urlopen(url, timeout=20) as resp:
        data = json.load(resp)
    candidates = data.get("results", [])
    india_matches = [r for r in candidates if r.get("country_code") == "IN"]
    if not india_matches:
        raise ValueError(f"No India result for '{city}' — candidates: {[(r['name'], r['country_code']) for r in candidates]}")
    state_match = next((r for r in india_matches if (r.get("admin1") or "").lower() in state.lower() or state.lower() in (r.get("admin1") or "").lower()), None)
    r = state_match or india_matches[0]
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


state_city_pairs = extract_top_cities_per_state(CITIES_PER_STATE)
print(f"Targeting top {CITIES_PER_STATE} cities/state -> {len(state_city_pairs)} (state, city) pairs across {len(set(s for s, c in state_city_pairs))} states/UTs.")

# Reuse anything already classified from a previous run instead of re-fetching it.
existing = {}
try:
    with open(OUTPUT_PATH) as f:
        existing = json.load(f).get("cities", {})
    print(f"Loaded {len(existing)} already-classified cities — will reuse, not re-fetch.")
except FileNotFoundError:
    pass

results = dict(existing)
ok_count = 0
fail_count = 0
skip_count = 0

for state, city in state_city_pairs:
    if city in results and results[city].get("state") == state:
        skip_count += 1
        continue
    try:
        lat, lon = geocode(city, state)
        breakdown = classify(lat, lon)
        results[city] = {**breakdown, "state": state, "lat": round(lat, 4), "lon": round(lon, 4)}
        ok_count += 1
        print(f"OK   {state:45s} {city:20s} {breakdown}")
    except Exception as e:
        fail_count += 1
        print(f"FAIL {state:45s} {city:20s} {e}")
    time.sleep(0.3)  # be polite to the free geocoding API

output = {
    "source": {
        "title": "ESA WorldCover 10m v200 (2021)",
        "publisher": "ESA / VITO, distributed via AWS Open Data",
        "url": "https://esa-worldcover.org",
        "resolution": "10m",
        "sampleAreaRadiusKm": 5,
    },
    "note": f"Real classification computed directly for the top {CITIES_PER_STATE} cities per state/UT (by population/prominence, see STATE_DATA ordering in src/App.jsx). Cities beyond that use the nearest-neighbor fallback in src/utils/lulcFallback.js — do not estimate a value for them here.",
    "cities": results,
}

with open(OUTPUT_PATH, "w") as f:
    json.dump(output, f, indent=2)

print(f"\nNewly classified: {ok_count} | Reused from previous run: {skip_count} | Failed: {fail_count}")
print(f"Wrote {OUTPUT_PATH} with {len(results)} total cities.")
