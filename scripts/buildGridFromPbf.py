#!/usr/bin/env python3
"""Build per-state power-grid files from an OpenStreetMap PBF extract (Geofabrik India).

    .venv/bin/python scripts/buildGridFromPbf.py <path/to/india-latest.osm.pbf>

Extracts power=substation (nodes and closed ways), power=line (ways) and landuse=industrial
(closed ways), assigns each feature to a state by the nearest BhaskarOps city (within 60 km),
and writes public/data/grid/<state-slug>.json plus public/data/grid/index.json.
Two passes keep memory small: pass 1 collects the tagged ways and the node ids they reference;
pass 2 reads only those nodes' coordinates. Relations (multipolygons) are skipped.
Geometry only: OpenStreetMap holds no loading or capacity data.
"""
import json, math, os, re, sys, time
from collections import defaultdict
import osmium
from osmium import filter as of

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, 'public', 'data', 'grid')
PBF = sys.argv[1]
ASSIGN_KM = 60.0
MIN_INDUSTRIAL_KM2 = 0.02
MAX_RING_POINTS = 200

def slug(s):
    s = s.lower().replace('&', 'and')
    s = re.sub(r'[^a-z0-9]+', '-', s)
    return s.strip('-')

def kv(v):
    m = re.search(r'(\d+)', (v or '').split(';')[0])
    return round(int(m.group(1)) / 1000) if m else None

# ── cities → spatial index for state assignment ──────────────────────────────
cities = json.load(open(os.path.join(ROOT, 'src', 'data', 'cityCoordinates.json')))
pts = [(c['lat'], c['lon'], c['state']) for c in cities.values() if isinstance(c.get('lat'), (int, float))]
CELL = 0.5
grid = defaultdict(list)
for lat, lon, st in pts:
    grid[(int(lat // CELL), int(lon // CELL))].append((lat, lon, st))

def dist_km(lat1, lon1, lat2, lon2):
    dx = (lon2 - lon1) * 111.32 * math.cos(math.radians((lat1 + lat2) / 2)); dy = (lat2 - lat1) * 110.57
    return math.hypot(dx, dy)

def state_for(lat, lon):
    best, bd = None, ASSIGN_KM
    ci, cj = int(lat // CELL), int(lon // CELL)
    for i in range(ci - 2, ci + 3):
        for j in range(cj - 2, cj + 3):
            for plat, plon, st in grid.get((i, j), ()):
                d = dist_km(lat, lon, plat, plon)
                if d < bd: best, bd = st, d
    return best

# ── pass 1: tagged ways + substation nodes ──────────────────────────────────
t0 = time.time()
sub_nodes, ways, need = [], [], set()
fp = osmium.FileProcessor(PBF, osmium.osm.NODE | osmium.osm.WAY).with_filter(of.KeyFilter('power', 'landuse'))
for o in fp:
    tags = o.tags
    power = tags.get('power'); landuse = tags.get('landuse')
    if o.is_node():
        if power == 'substation':
            sub_nodes.append({'id': f'node/{o.id}', 'name': tags.get('name'), 'voltageKV': kv(tags.get('voltage')), 'operator': tags.get('operator'), 'lat': o.location.lat, 'lon': o.location.lon})
    elif o.is_way():
        kind = 'substation' if power == 'substation' else 'line' if power == 'line' else 'industrial' if landuse == 'industrial' else None
        if not kind: continue
        refs = [n.ref for n in o.nodes]
        if len(refs) < 2: continue
        ways.append((kind, o.id, dict(tags), refs))
        need.update(refs)
print(f'pass 1: {len(sub_nodes)} substation nodes, {len(ways)} ways, {len(need)} node refs, {time.time()-t0:.0f}s', flush=True)

# ── pass 2: coordinates of the referenced nodes ─────────────────────────────
loc = {}
fp2 = osmium.FileProcessor(PBF, osmium.osm.NODE).with_filter(of.IdFilter(need))
for n in fp2:
    loc[n.id] = (round(n.location.lat, 5), round(n.location.lon, 5))
print(f'pass 2: {len(loc)} node locations, {time.time()-t0:.0f}s', flush=True)

# ── assemble per state ──────────────────────────────────────────────────────
def ring_area_km2(coords):
    if len(coords) < 3: return 0.0
    lat0 = sum(c[0] for c in coords) / len(coords); kx = 111.32 * math.cos(math.radians(lat0)); ky = 110.57
    a = 0.0
    for i in range(len(coords)):
        p, q = coords[i], coords[(i + 1) % len(coords)]
        a += (p[1] * kx) * (q[0] * ky) - (q[1] * kx) * (p[0] * ky)
    return abs(a) / 2

def thin(coords, max_pts):
    if len(coords) <= max_pts: return coords
    step = len(coords) / max_pts
    return [coords[int(i * step)] for i in range(max_pts)] + [coords[-1]]

states = defaultdict(lambda: {'substations': [], 'lines': [], 'industrial': []})
unassigned = 0
for s in sub_nodes:
    st = state_for(s['lat'], s['lon'])
    if st: states[st]['substations'].append({**s, 'lat': round(s['lat'], 5), 'lon': round(s['lon'], 5)})
    else: unassigned += 1
for kind, wid, tags, refs in ways:
    coords = [loc[r] for r in refs if r in loc]
    if len(coords) < 2: continue
    clat = sum(c[0] for c in coords) / len(coords); clon = sum(c[1] for c in coords) / len(coords)
    st = state_for(clat, clon)
    if not st: unassigned += 1; continue
    if kind == 'substation':
        states[st]['substations'].append({'id': f'way/{wid}', 'name': tags.get('name'), 'voltageKV': kv(tags.get('voltage')), 'operator': tags.get('operator'), 'lat': round(clat, 5), 'lon': round(clon, 5)})
    elif kind == 'line':
        states[st]['lines'].append({'id': f'way/{wid}', 'voltageKV': kv(tags.get('voltage')), 'name': tags.get('name'), 'path': thin(coords, 400)})
    else:
        area = ring_area_km2(coords)
        if area < MIN_INDUSTRIAL_KM2: continue
        states[st]['industrial'].append({'id': f'way/{wid}', 'name': tags.get('name'), 'areaKm2': round(area, 2), 'lat': round(clat, 5), 'lon': round(clon, 5), 'ring': thin(coords, MAX_RING_POINTS)})

os.makedirs(OUT_DIR, exist_ok=True)
index = {'source': 'OpenStreetMap (Geofabrik india-latest.osm.pbf): power=substation, power=line, landuse=industrial', 'generatedAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'pbf': os.path.basename(PBF), 'states': {}}
total = 0
for st, data in sorted(states.items()):
    data['industrial'].sort(key=lambda z: -z['areaKm2'])
    fn = f'{slug(st)}.json'
    payload = {'state': st, 'generatedAt': index['generatedAt'], 'source': index['source'], **data}
    with open(os.path.join(OUT_DIR, fn), 'w') as f: json.dump(payload, f, separators=(',', ':'))
    size = os.path.getsize(os.path.join(OUT_DIR, fn)); total += size
    index['states'][st] = {'file': fn, 'substations': len(data['substations']), 'lines': len(data['lines']), 'industrial': len(data['industrial']), 'bytes': size}
    print(f'  {st}: {len(data["substations"])} substations, {len(data["lines"])} lines, {len(data["industrial"])} industrial, {size/1e6:.1f} MB')
with open(os.path.join(OUT_DIR, 'index.json'), 'w') as f: json.dump(index, f, indent=1)
print(f'done: {len(states)} states, {total/1e6:.1f} MB total, {unassigned} features unassigned (>60 km from any city), {time.time()-t0:.0f}s')
