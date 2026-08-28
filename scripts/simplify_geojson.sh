#!/usr/bin/env bash
# Regenerates the simplified map layers in public/data from full-resolution
# GeoJSON sources. The originals (23 MB states / 34.5 MB districts, ~1.3M
# vertices) made the map draw for ~95s of main-thread time on a phone; at map
# scale anything finer than ~0.0001° is invisible. Output keeps every feature
# and property (keep-shapes: no islands dropped).
#
# Usage: scripts/simplify_geojson.sh <full_states.geojson> <full_districts.geojson>
# (the pre-simplification originals live in git history before commit "Perf: simplify map GeoJSON")
set -euo pipefail
STATES_SRC=${1:?full-resolution states geojson}
DISTRICTS_SRC=${2:?full-resolution districts geojson}
OUT=public/data
npx --yes mapshaper "$STATES_SRC"    -simplify 6% keep-shapes -o "$OUT/india_states_full.geojson"    precision=0.0001 format=geojson
npx --yes mapshaper "$DISTRICTS_SRC" -simplify 4% keep-shapes -o "$OUT/india_districts_full.geojson" precision=0.0001 format=geojson
# mapshaper writes counter-clockwise exterior rings; d3-geo (react-simple-maps)
# treats those as "everything except the shape" and floods the whole map.
# The app's originals use clockwise exteriors, so rewind to that convention.
python3 - "$OUT/india_states_full.geojson" "$OUT/india_districts_full.geojson" <<'PY'
import json, sys
def area(r): return sum(r[i][0]*r[(i+1)%len(r)][1]-r[(i+1)%len(r)][0]*r[i][1] for i in range(len(r)))/2
for path in sys.argv[1:]:
    d=json.load(open(path)); n=0
    for ft in d['features']:
        g=ft['geometry']; polys=g['coordinates'] if g['type']=='MultiPolygon' else [g['coordinates']]
        for p in polys:
            for i,ring in enumerate(p):
                want_cw = (i==0)               # exterior clockwise (negative planar area), holes the opposite
                if (area(ring)<0)!=want_cw: ring.reverse(); n+=1
    json.dump(d, open(path,'w'), separators=(',',':')); print(f'{path}: rewound {n} rings')
PY
for f in "$OUT/india_states_full.geojson" "$OUT/india_districts_full.geojson"; do rm -f "$f.gz"; gzip -9 -k "$f"; done
ls -la "$OUT"/india_*.geojson*
