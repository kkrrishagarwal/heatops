// Recurring job: batch-fetch live current temperature + AQI + rain chance for every city in
// src/data/cityCoordinates.json from Open-Meteo, and write the result to
// public/live-weather-cache.json, which the frontend fetches at runtime as the single source
// of truth for the City List, Hottest Cities panel, Navbar ticker, and State Panel AQI.
//
// Open-Meteo free-tier limits (non-commercial, no API key): 600 calls/min, 5,000/hour,
// 10,000/day. We batch many cities per call using comma-separated lat/lon, so a full refresh
// of ~2,050 cities costs ~2 batched calls (weather + air-quality), not 2,050 calls.
//
// Usage: node scripts/refreshWeatherCache.mjs           (single run)
//        node scripts/weatherCacheDaemon.mjs             (repeats every REFRESH_INTERVAL_MS)

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const COORDS_PATH = path.join(__dirname, '../src/data/cityCoordinates.json')
const OUTPUT_PATH = path.join(__dirname, '../public/live-weather-cache.json')

const BATCH_SIZE = 100 // cities per single Open-Meteo request (comma-separated lat/lon)

function chunk(arr, size) {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

async function fetchWithRetry(url, label, attempts = 3) {
  for (let i = 0; i < attempts; i++) {
    const res = await fetch(url)
    if (res.ok) return res.json()
    if (res.status === 429 && i < attempts - 1) {
      // Open-Meteo weights multi-location batches by location count against the
      // 600/min budget and reports "try again in one minute" — so back off a full minute.
      await new Promise(r => setTimeout(r, 65000))
      continue
    }
    throw new Error(`${label} failed: ${res.status}`)
  }
}

async function fetchWeatherBatch(entries) {
  const lats = entries.map(e => e.lat).join(',')
  const lons = entries.map(e => e.lon).join(',')
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lons}` +
    `&current=temperature_2m&hourly=precipitation_probability&timezone=Asia/Kolkata&forecast_days=1`
  const data = await fetchWithRetry(url, 'weather batch')
  const arr = Array.isArray(data) ? data : [data]
  return arr.map(d => ({
    temp: d.current ? Math.round(d.current.temperature_2m) : null,
    rainChance: d.hourly?.precipitation_probability?.[0] ?? null
  }))
}

async function fetchAqiBatch(entries) {
  const lats = entries.map(e => e.lat).join(',')
  const lons = entries.map(e => e.lon).join(',')
  const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lats}&longitude=${lons}` +
    `&current=us_aqi&timezone=Asia/Kolkata`
  const data = await fetchWithRetry(url, 'aqi batch')
  const arr = Array.isArray(data) ? data : [data]
  // EPA US AQI scale officially caps at 500 — Open-Meteo's calculated value can exceed
  // that during extreme pollution events (e.g. dust storms), so clip for display
  return arr.map(d => ({ aqi: d.current ? Math.min(500, Math.round(d.current.us_aqi)) : null }))
}

export async function refreshWeatherCache() {
  if (!fs.existsSync(COORDS_PATH)) {
    throw new Error(`${COORDS_PATH} not found — run scripts/geocodeCities.mjs first`)
  }
  const coords = JSON.parse(fs.readFileSync(COORDS_PATH, 'utf8'))
  const entries = Object.values(coords).filter(e => typeof e.lat === 'number' && typeof e.lon === 'number')
  console.log(`Refreshing live weather for ${entries.length} cities...`)

  const batches = chunk(entries, BATCH_SIZE)
  // Start from whatever's already cached so a batch failure this run doesn't blank out
  // cities that loaded fine on a previous run.
  let result = {}
  if (fs.existsSync(OUTPUT_PATH)) {
    try { result = JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf8')).cities || {} } catch {}
  }
  let failedBatches = 0

  for (const batch of batches) {
    try {
      // weather and AQI hit different Open-Meteo subdomains, so they don't share the same
      // per-IP bucket — but stagger them slightly anyway to avoid bursting either one
      const weatherRes = await fetchWeatherBatch(batch)
      await new Promise(r => setTimeout(r, 3000))
      const aqiRes = await fetchAqiBatch(batch)
      batch.forEach((entry, i) => {
        result[`${entry.city}|${entry.state}`] = {
          city: entry.city,
          state: entry.state,
          temp: weatherRes[i]?.temp ?? null,
          rainChance: weatherRes[i]?.rainChance ?? null,
          aqi: aqiRes[i]?.aqi ?? null
        }
      })
    } catch (err) {
      failedBatches++
      console.warn(`  batch failed (${batch.length} cities): ${err.message}`)
    }
    // pacing gap between batch-rounds: each round is ~2*BATCH_SIZE "location units" against
    // Open-Meteo's 600/min budget (weighted per-location, not per-request), so for
    // BATCH_SIZE=100 a round is ~200 units — pace rounds ~25s apart to stay safely under 600/min
    await new Promise(r => setTimeout(r, 25000))
  }

  const payload = {
    lastUpdated: new Date().toISOString(),
    cityCount: Object.keys(result).length,
    cities: result
  }
  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true })
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(payload))
  console.log(`Wrote ${Object.keys(result).length} cities to ${OUTPUT_PATH} (${failedBatches} batches failed)`)
  return payload
}

// Allow running directly: `node scripts/refreshWeatherCache.mjs`
if (import.meta.url === `file://${process.argv[1]}`) {
  refreshWeatherCache().catch(err => {
    console.error(err)
    process.exit(1)
  })
}
