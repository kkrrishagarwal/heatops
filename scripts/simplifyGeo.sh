#!/usr/bin/env bash
# Regenerates the map geometry the browser downloads (public/data/*.geojson) from the
# full-resolution sources kept in scripts/data/geo-full/.
#
# Why: the map is drawn at most ~800 px wide, but the full files carry 74k (districts) and
# 47k (states) vertices — react-simple-maps projects every vertex on the main thread when
# the map mounts, and a CPU profile showed that projection was the whole of the load-time
# lag (15 long tasks of up to 420 ms in the first 10 s). Visvalingam simplification at 15 %
# with keep-shapes keeps every feature and every shared border (mapshaper builds topology
# first, so neighbours still meet exactly) while cutting vertices ~5x.
#
# Requires mapshaper (npx mapshaper). Run from the repo root.
set -euo pipefail
cd "$(dirname "$0")/.."
for f in india_states_full india_districts_full jk_ladakh_official; do
  npx --no-install mapshaper "scripts/data/geo-full/$f.geojson" \
    -simplify visvalingam weighted 15% keep-shapes -clean \
    -o "public/data/$f.geojson" precision=0.0001 format=geojson
done
# mapshaper writes RFC 7946 winding (exterior rings counter-clockwise); d3-geo needs the
# opposite, otherwise every polygon fills the whole map. Rewind whatever came out inverted.
node scripts/rewindGeo.mjs public/data/india_states_full.geojson public/data/india_districts_full.geojson public/data/jk_ladakh_official.geojson
ls -la public/data/*.geojson
