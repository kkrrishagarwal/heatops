// One-time (re-runnable) job: resolve every city name in STATE_DATA to lat/lon via
// Open-Meteo's geocoding API, and cache the result permanently in src/data/cityCoordinates.json.
// Coordinates don't change, so unlike the weather refresh job, this does not need to run on
// a schedule — only when new cities are added to STATE_DATA in App.jsx.
//
// Usage: node scripts/geocodeCities.mjs

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const APP_JSX_PATH = path.join(__dirname, '../src/App.jsx')
const OUTPUT_PATH = path.join(__dirname, '../src/data/cityCoordinates.json')

function extractStateData() {
  const src = fs.readFileSync(APP_JSX_PATH, 'utf8')
  const startMarker = 'const STATE_DATA = {'
  const startIdx = src.indexOf(startMarker)
  if (startIdx === -1) throw new Error('STATE_DATA not found in App.jsx')
  const endMarker = '\n} // end STATE_DATA'
  const endIdx = src.indexOf(endMarker, startIdx)
  if (endIdx === -1) throw new Error('STATE_DATA end marker not found')
  const objText = src.slice(startIdx + startMarker.length - 1, endIdx + 2) // include both braces
  // eslint-disable-next-line no-new-func
  return new Function(`return (${objText})`)()
}

function buildCityList(stateData) {
  const list = []
  for (const [state, data] of Object.entries(stateData)) {
    for (const city of data.cities || []) {
      list.push({ city, state })
    }
  }
  return list
}

async function geocodeOne(city, state) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=10&language=en&format=json`
  const res = await fetch(url)
  if (!res.ok) return null
  const data = await res.json()
  if (!data.results || data.results.length === 0) return null

  // Prefer a result in India whose admin1 (state) matches, to disambiguate
  // same-named cities across different states (e.g. "Hamirpur" exists in both UP and HP)
  const indiaResults = data.results.filter(r => r.country_code === 'IN')
  const stateMatch = indiaResults.find(r =>
    (r.admin1 || '').toLowerCase().includes(state.toLowerCase()) ||
    state.toLowerCase().includes((r.admin1 || '').toLowerCase())
  )
  const best = stateMatch || indiaResults[0] || data.results[0]

  return { lat: best.latitude, lon: best.longitude, resolvedName: best.name, resolvedState: best.admin1 || '' }
}

async function main() {
  const stateData = extractStateData()
  const cityList = buildCityList(stateData)
  console.log(`Found ${cityList.length} city entries across ${Object.keys(stateData).length} states.`)

  let existing = {}
  if (fs.existsSync(OUTPUT_PATH)) {
    existing = JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf8'))
    console.log(`Loaded ${Object.keys(existing).length} already-geocoded entries — will skip those.`)
  }

  const todo = cityList.filter(({ city, state }) => !existing[`${city}|${state}`])
  console.log(`${todo.length} entries need geocoding.`)

  const CONCURRENCY = 8
  const DELAY_MS = 120 // ~8*?/min stays well under 600/min cap
  let done = 0
  let failed = 0

  for (let i = 0; i < todo.length; i += CONCURRENCY) {
    const batch = todo.slice(i, i + CONCURRENCY)
    await Promise.all(batch.map(async ({ city, state }) => {
      try {
        const coords = await geocodeOne(city, state)
        if (coords) {
          existing[`${city}|${state}`] = { city, state, ...coords }
        } else {
          failed++
          console.warn(`  no result for "${city}, ${state}"`)
        }
      } catch (err) {
        failed++
        console.warn(`  error for "${city}, ${state}": ${err.message}`)
      }
      done++
    }))
    if (done % 80 === 0 || i + CONCURRENCY >= todo.length) {
      console.log(`  ${done}/${todo.length} processed (${failed} failed)`)
      fs.writeFileSync(OUTPUT_PATH, JSON.stringify(existing, null, 0))
    }
    await new Promise(r => setTimeout(r, DELAY_MS))
  }

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(existing, null, 0))
  console.log(`Done. ${Object.keys(existing).length} total coordinates saved to ${OUTPUT_PATH}`)
  console.log(`Failed to geocode: ${failed}`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
