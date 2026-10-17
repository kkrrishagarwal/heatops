// Per-district heat for the Command Center's semantic zoom. Each of the 594 districts (plus
// the J&K / Ladakh file) gets its own value from the ACTIVE layer's city points:
//   1. direct   — a city in the same state whose name matches the district (or one of the
//                 district's alias names): the district shows that city's reading
//   2. nearest  — otherwise the distance-weighted mean of the 2 nearest cities in the same
//                 state to the district centroid, within 150 km; the nearer city dominates
//   3. far      — sparse layers only: the 2 nearest cities in ANY state within 400 km, the
//                 value rounded to a whole number and labelled "estimated from X (n km)"
//   4. none     — nothing within reach: grey, labelled "no reading"
// Values are whatever the layer carries (live air °C, forecast high, MODIS surface °C, or
// built-up %), coloured with the layer's own scale. Pure functions, memoised by the caller.
const NO_DATA_FILL = '#334155'
const MAX_KM = 150 // same-state neighbours (dense layers: live air, forecast)
const FAR_KM = 400 // sparse layers (MODIS yearly / built-up, ~170 cities): any state, rounded, labelled estimated
const norm = s => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ')

function centroid(geometry) {
  // area-weighted enough for our purpose: mean of the largest ring's vertices
  const polys = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.type === 'MultiPolygon' ? geometry.coordinates : []
  let best = null
  for (const poly of polys) { const ring = poly[0]; if (ring && (!best || ring.length > best.length)) best = ring }
  if (!best) return null
  let x = 0, y = 0
  for (const [lon, lat] of best) { x += lon; y += lat }
  return { lon: x / best.length, lat: y / best.length }
}

function haversineKm(a, b) {
  const R = 6371, toR = v => (v * Math.PI) / 180
  const dLat = toR(b.lat - a.lat), dLon = toR(b.lon - a.lon)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toR(a.lat)) * Math.cos(toR(b.lat)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

export function districtKey(feature) {
  const p = feature?.properties || {}
  return p.NAME_2 ? `${p.NAME_1}|${p.NAME_2}` : p.district ? `${p.st_nm}|${p.district}` : String(feature?.id ?? '')
}
export function districtName(feature) {
  const p = feature?.properties || {}
  return p.NAME_2 || p.district || '—'
}
function aliases(feature) {
  const p = feature?.properties || {}
  const out = [p.NAME_2, p.district, ...(String(p.VARNAME_2 || '').split(','))].map(norm).filter(Boolean)
  return [...new Set(out)]
}

// points: [{ key: "City|State", lat, lon, value, color }] from the active layer
// features: district GeoJSON features; resolveState(feature) → canonical state name
export function buildDistrictHeat({ features, points, resolveState, colorFor, sparse = false }) {
  const byState = new Map()
  for (const p of points || []) {
    const [city, state] = String(p.key || '').split('|')
    if (!state || typeof p.lat !== 'number') continue
    if (!byState.has(state)) byState.set(state, { byName: new Map(), list: [] })
    const s = byState.get(state)
    s.byName.set(norm(city), { ...p, city })
    s.list.push({ ...p, city })
  }
  const out = {}
  for (const f of features || []) {
    const state = resolveState(f)
    const s = byState.get(state)
    const key = districtKey(f)
    let hit = null
    if (s) for (const a of aliases(f)) { if (s.byName.has(a)) { hit = s.byName.get(a); break } }
    if (hit) { out[key] = { value: hit.value, color: colorFor(hit.value), method: 'direct', city: hit.city, state }; continue }
    const c = centroid(f.geometry)
    if (!c) { out[key] = { value: null, color: NO_DATA_FILL, method: 'none', state }; continue }
    let near = s ? s.list.map(p => ({ p, km: haversineKm(c, p) })).sort((a, b) => a.km - b.km).slice(0, 2).filter(n => n.km <= MAX_KM) : []
    let far = false
    if (!near.length && sparse) {
      // sparse layer: reach across state lines, up to FAR_KM
      near = (points || []).filter(p => typeof p.lat === 'number').map(p => ({ p: { ...p, city: String(p.key || '').split('|')[0] }, km: haversineKm(c, p) })).sort((a, b) => a.km - b.km).slice(0, 2).filter(n => n.km <= FAR_KM)
      far = near.length > 0
    }
    if (!near.length) { out[key] = { value: null, color: NO_DATA_FILL, method: 'none', state }; continue }
    if (far) {
      let wsum = 0, v = 0
      for (const { p, km } of near) { const w = 1 / (km + 5); wsum += w; v += p.value * w }
      const value = Math.round(v / wsum)
      out[key] = { value, color: colorFor(value), method: 'far', city: near[0].p.city, km: Math.round(near[0].km), cities: near.map(n => `${n.p.city} (${Math.round(n.km)} km)`), state }
      continue
    }
    let wsum = 0, v = 0
    for (const { p, km } of near) { const w = 1 / (km + 5); wsum += w; v += p.value * w }
    const value = Math.round((v / wsum) * 10) / 10
    out[key] = { value, color: colorFor(value), method: 'nearest', city: near[0].p.city, km: Math.round(near[0].km), cities: near.map(n => `${n.p.city} (${Math.round(n.km)} km)`), state }
  }
  return out
}
