// One-off: counts schools and hospitals within 3 km of each ESA-classified city centre from
// OpenStreetMap (Overpass). Written to public/data/osm-facilities.json for the Smart
// Mitigation Planner's "priority public facilities" category. Overpass is a shared free
// service: paced at one query every ~1.5 s, failures recorded as null (never guessed).
import fs from 'fs'
const lulc = JSON.parse(fs.readFileSync('public/data/lulc_real.json', 'utf8')).cities
const OUT = 'public/data/osm-facilities.json'
const prev = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')).cities || {} : {}
const out = { ...prev }
const RADIUS_M = 3000
const sleep = ms => new Promise(r => setTimeout(r, ms))
async function count(lat, lon, amenity) {
  const q = `[out:json][timeout:25];(node["amenity"="${amenity}"](around:${RADIUS_M},${lat},${lon});way["amenity"="${amenity}"](around:${RADIUS_M},${lat},${lon}););out count;`
  const res = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', body: 'data=' + encodeURIComponent(q) })
  if (!res.ok) throw new Error('HTTP ' + res.status)
  const d = await res.json(); const c = d.elements?.find(e => e.type === 'count')
  return c ? parseInt(c.tags?.total ?? '0', 10) : null
}
let done = 0, failed = 0
for (const [city, v] of Object.entries(lulc)) {
  const key = `${city}|${v.state}`
  if (out[key] && out[key].schools != null && out[key].hospitals != null) { done++; continue }
  try {
    const schools = await count(v.lat, v.lon, 'school'); await sleep(1500)
    const hospitals = await count(v.lat, v.lon, 'hospital'); await sleep(1500)
    out[key] = { city, state: v.state, schools, hospitals, radiusM: RADIUS_M, fetchedAt: new Date().toISOString() }
    done++
  } catch (e) {
    failed++; console.warn(`${key}: ${e.message}`); await sleep(5000)
  }
  if ((done + failed) % 10 === 0) fs.writeFileSync(OUT, JSON.stringify({ source: 'OpenStreetMap via Overpass API (amenity=school / amenity=hospital, nodes + ways, within 3 km of the city centre)', generatedAt: new Date().toISOString(), cities: out }))
}
fs.writeFileSync(OUT, JSON.stringify({ source: 'OpenStreetMap via Overpass API (amenity=school / amenity=hospital, nodes + ways, within 3 km of the city centre)', generatedAt: new Date().toISOString(), cities: out }))
console.log(`done ${done} · failed ${failed} · written ${OUT}`)
