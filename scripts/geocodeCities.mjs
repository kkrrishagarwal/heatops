// Resolve every city name in STATE_DATA (src/App.jsx) to lat/lon and cache the result
// permanently in src/data/cityCoordinates.json. Coordinates don't change, so this runs only
// when cities are added to STATE_DATA — the nightly weather refresh reads this file.
//
// Why the validation: the first version took Open-Meteo's top hit for a bare city name and
// trusted it. Result: 202 of 1,689 cities landed in the wrong place — Tawang in East Java,
// Hunder in Denmark, Drass in Austria, Kutch in Colorado — and their "live" temperatures were
// shown as real. Another 267 names (Sundernagar, Keylong, Akhnoor, Nandprayag…) got no hit
// at all. Now every result must be IN INDIA and either carry the requested state as its
// admin1 / address.state, or sit inside the bounding box of that state's already-trusted
// cities (padded ~35 km — this is what keeps Delhi-NCR entries like Gurugram/Noida, which
// are legitimately in Haryana/UP). Anything else is rejected; unresolved cities are simply
// absent from the file and the UI shows "NO LIVE DATA" for them — never a guess.
//
// Sources, in order: Open-Meteo geocoding (fast, concurrent) → Nominatim/OSM with
// "City, State, India" (1 request/second per usage policy).
//
// Usage: node scripts/geocodeCities.mjs            resolve missing + invalid entries
//        node scripts/geocodeCities.mjs --all      re-resolve every city from scratch
//        node scripts/geocodeCities.mjs --dry-run  report, don't write

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const APP_JSX_PATH = path.join(__dirname, '../src/App.jsx')
const OUTPUT_PATH = path.join(__dirname, '../src/data/cityCoordinates.json')

const ARGS = new Set(process.argv.slice(2))
const REDO_ALL = ARGS.has('--all')
const DRY_RUN = ARGS.has('--dry-run')

const NOMINATIM_UA = 'BhaskarOps-geocoder/2.0 (https://heatops.vercel.app; ISRO BAH 2026 student project)'
const BBOX_PAD_DEG = 0.35 // ≈ 35–40 km: accepts NCR-style neighbours, rejects same-name cities elsewhere

// Names OSM / Open-Meteo use for a state that differ from our STATE_DATA keys.
const STATE_ALIASES = {
  'Delhi': ['delhi', 'nct of delhi', 'national capital territory of delhi', 'new delhi'],
  'Odisha': ['odisha', 'orissa'],
  'Uttarakhand': ['uttarakhand', 'uttaranchal'],
  'Puducherry': ['puducherry', 'pondicherry'],
  'Dadra and Nagar Haveli and Daman and Diu': ['dadra and nagar haveli and daman and diu', 'dadra and nagar haveli', 'daman and diu'],
  'Andaman and Nicobar Islands': ['andaman and nicobar islands', 'andaman and nicobar', 'andaman & nicobar islands'],
  'Jammu and Kashmir': ['jammu and kashmir', 'jammu & kashmir'],
  'Ladakh': ['ladakh']
}

function extractStateData() {
  const src = fs.readFileSync(APP_JSX_PATH, 'utf8')
  const startMarker = 'const STATE_DATA = {'
  const startIdx = src.indexOf(startMarker)
  if (startIdx === -1) throw new Error('STATE_DATA not found in App.jsx')
  const endMarker = '\n} // end STATE_DATA'
  const endIdx = src.indexOf(endMarker, startIdx)
  if (endIdx === -1) throw new Error('STATE_DATA end marker not found')
  const objText = src.slice(startIdx + startMarker.length - 1, endIdx + 2)
  // eslint-disable-next-line no-new-func
  return new Function(`return (${objText})`)()
}

function buildCityList(stateData) {
  const list = []
  for (const [state, data] of Object.entries(stateData)) {
    for (const city of data.cities || []) list.push({ city, state })
  }
  return list
}

const norm = s => (s || '').toLowerCase().replace(/\s+/g, ' ').trim()

function stateMatches(wanted, got) {
  const g = norm(got)
  if (!g) return false
  const w = norm(wanted)
  if (g === w || g.includes(w) || w.includes(g)) return true
  return (STATE_ALIASES[wanted] || []).some(a => g === a || g.includes(a))
}

// Bounding boxes of each state's trusted (state-matched) cities, padded. Built from the
// existing file first, then extended as new trusted results arrive.
function makeBboxIndex() {
  const boxes = {}
  return {
    add(state, lat, lon) {
      const b = boxes[state] || (boxes[state] = { minLat: lat, maxLat: lat, minLon: lon, maxLon: lon, n: 0 })
      b.minLat = Math.min(b.minLat, lat); b.maxLat = Math.max(b.maxLat, lat)
      b.minLon = Math.min(b.minLon, lon); b.maxLon = Math.max(b.maxLon, lon)
      b.n++
    },
    contains(state, lat, lon) {
      const b = boxes[state]
      if (!b || b.n < 3) return false
      return lat >= b.minLat - BBOX_PAD_DEG && lat <= b.maxLat + BBOX_PAD_DEG &&
        lon >= b.minLon - BBOX_PAD_DEG && lon <= b.maxLon + BBOX_PAD_DEG
    },
    get(state) { return boxes[state] }
  }
}

// A candidate is acceptable if it is in India and (its state matches OR it lies inside the
// padded bbox of the requested state's trusted cities). Returns the reason it was accepted.
function acceptable(state, cand, bbox) {
  if (cand.countryCode !== 'IN') return null
  if (stateMatches(state, cand.resolvedState)) return 'state'
  if (bbox.contains(state, cand.lat, cand.lon)) return 'bbox'
  return null
}

// ---------- Open-Meteo ----------
async function openMeteoCandidates(city) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=10&language=en&format=json`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`open-meteo geocoding ${res.status}`)
  const data = await res.json()
  return (data.results || []).map(r => ({
    lat: r.latitude, lon: r.longitude, resolvedName: r.name, resolvedState: r.admin1 || '',
    countryCode: r.country_code, source: 'open-meteo', kind: r.feature_code || ''
  }))
}

// ---------- Nominatim (OSM) ----------
const SETTLEMENT_TYPES = new Set(['city', 'town', 'village', 'hamlet', 'suburb', 'municipality', 'administrative', 'locality', 'neighbourhood', 'quarter', 'island', 'archipelago', 'county', 'district', 'state_district'])
let lastNominatimAt = 0
async function nominatimCandidates(city, state) {
  const wait = 1100 - (Date.now() - lastNominatimAt)
  if (wait > 0) await new Promise(r => setTimeout(r, wait))
  lastNominatimAt = Date.now()
  const q = `${city}, ${state}, India`
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&countrycodes=in&addressdetails=1&q=${encodeURIComponent(q)}`
  const res = await fetch(url, { headers: { 'User-Agent': NOMINATIM_UA, 'Accept-Language': 'en' } })
  if (!res.ok) throw new Error(`nominatim ${res.status}`)
  const data = await res.json()
  const cands = (Array.isArray(data) ? data : []).map(r => {
    const a = r.address || {}
    return {
      lat: parseFloat(r.lat), lon: parseFloat(r.lon),
      resolvedName: r.name || (r.display_name || '').split(',')[0],
      resolvedState: a.state || a.territory || a.union_territory || a.region || '',
      countryCode: (a.country_code || 'in').toUpperCase(), source: 'nominatim', kind: r.type || '',
      importance: r.importance || 0
    }
  })
  // settlements (or the district itself) before POIs; then by importance
  cands.sort((x, y) => (SETTLEMENT_TYPES.has(y.kind) - SETTLEMENT_TYPES.has(x.kind)) || (y.importance - x.importance))
  return cands
}

function pick(state, cands, bbox) {
  // a state-matched hit beats a bbox-only hit, in source order
  let viaBbox = null
  for (const c of cands) {
    const why = acceptable(state, c, bbox)
    if (why === 'state') return { ...c, accepted: 'state' }
    if (why === 'bbox' && !viaBbox) viaBbox = { ...c, accepted: 'bbox' }
  }
  return viaBbox
}

async function main() {
  const stateData = extractStateData()
  const cityList = buildCityList(stateData)
  console.log(`STATE_DATA: ${cityList.length} cities across ${Object.keys(stateData).length} states.`)

  const existing = (!REDO_ALL && fs.existsSync(OUTPUT_PATH)) ? JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf8')) : {}
  const bbox = makeBboxIndex()
  const out = {}
  const invalid = []
  for (const { city, state } of cityList) {
    const e = existing[`${city}|${state}`]
    if (!e || typeof e.lat !== 'number') continue
    if (stateMatches(state, e.resolvedState)) { out[`${city}|${state}`] = e; bbox.add(state, e.lat, e.lon) }
    else invalid.push({ city, state, e })
  }
  // second pass: previously mis-tagged entries that are nevertheless inside the state bbox stay
  const stillInvalid = []
  for (const it of invalid) {
    if (bbox.contains(it.state, it.e.lat, it.e.lon)) out[`${it.city}|${it.state}`] = { ...it.e, accepted: 'bbox' }
    else stillInvalid.push(it)
  }
  const todo = cityList.filter(({ city, state }) => !out[`${city}|${state}`])
  console.log(`Kept ${Object.keys(out).length} trusted entries. Rejected ${stillInvalid.length} wrong-place entries. ${todo.length} to resolve.`)
  if (stillInvalid.length) console.log('  rejected e.g.: ' + stillInvalid.slice(0, 8).map(i => `${i.city} (${i.state} → ${i.e.resolvedState || '?'})`).join('; '))

  // Pass 1: Open-Meteo, concurrent
  const CONCURRENCY = 6
  const remaining = []
  let resolved = 0
  for (let i = 0; i < todo.length; i += CONCURRENCY) {
    const batch = todo.slice(i, i + CONCURRENCY)
    await Promise.all(batch.map(async (item) => {
      try {
        const hit = pick(item.state, await openMeteoCandidates(item.city), bbox)
        if (hit) {
          out[`${item.city}|${item.state}`] = { city: item.city, state: item.state, lat: hit.lat, lon: hit.lon, resolvedName: hit.resolvedName, resolvedState: hit.resolvedState, source: hit.source, accepted: hit.accepted }
          if (hit.accepted === 'state') bbox.add(item.state, hit.lat, hit.lon)
          resolved++
        } else remaining.push(item)
      } catch (err) { console.warn(`  open-meteo error "${item.city}, ${item.state}": ${err.message}`); remaining.push(item) }
    }))
    await new Promise(r => setTimeout(r, 150))
  }
  console.log(`Open-Meteo (validated) resolved ${resolved}; ${remaining.length} go to Nominatim (~${Math.ceil(remaining.length * 1.1 / 60)} min).`)

  // Pass 2: Nominatim, sequential
  const failed = []
  let n = 0
  for (const item of remaining) {
    n++
    try {
      const hit = pick(item.state, await nominatimCandidates(item.city, item.state), bbox)
      if (hit) {
        out[`${item.city}|${item.state}`] = { city: item.city, state: item.state, lat: hit.lat, lon: hit.lon, resolvedName: hit.resolvedName, resolvedState: hit.resolvedState, source: hit.source, accepted: hit.accepted, kind: hit.kind }
        if (hit.accepted === 'state') bbox.add(item.state, hit.lat, hit.lon)
      } else failed.push(item)
    } catch (err) { console.warn(`  nominatim error "${item.city}, ${item.state}": ${err.message}`); failed.push(item) }
    if (n % 25 === 0 || n === remaining.length) {
      console.log(`  nominatim ${n}/${remaining.length} (${failed.length} unresolved)`)
      if (!DRY_RUN) fs.writeFileSync(OUTPUT_PATH, JSON.stringify(out, null, 0))
    }
  }

  if (!DRY_RUN) fs.writeFileSync(OUTPUT_PATH, JSON.stringify(out, null, 0))
  console.log(`\nDone. ${Object.keys(out).length}/${cityList.length} cities have validated coordinates${DRY_RUN ? ' (dry run — not written)' : ` → ${path.relative(process.cwd(), OUTPUT_PATH)}`}.`)
  const bySrc = {}; for (const v of Object.values(out)) bySrc[`${v.source || 'open-meteo'}/${v.accepted || 'state'}`] = (bySrc[`${v.source || 'open-meteo'}/${v.accepted || 'state'}`] || 0) + 1
  console.log('By source/acceptance:', JSON.stringify(bySrc))
  if (failed.length) {
    console.log(`Unresolved (${failed.length}) — these show "NO LIVE DATA" in the app:`)
    const byState = {}; for (const f of failed) (byState[f.state] ||= []).push(f.city)
    for (const [s, l] of Object.entries(byState)) console.log(`  ${s}: ${l.join(', ')}`)
  }
}

main().catch(err => { console.error(err); process.exit(1) })
