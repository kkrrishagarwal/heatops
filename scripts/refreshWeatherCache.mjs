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

import { buildSnapshot, updateIndex, historyFilePath, INDEX_PATH } from '../api/_lib/weatherHistory.js'
import { isDbConfigured, saveRunToDb } from '../api/_lib/weatherHistoryDb.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.join(__dirname, '..')
const COORDS_PATH = path.join(__dirname, '../src/data/cityCoordinates.json')
const OUTPUT_PATH = path.join(__dirname, '../public/live-weather-cache.json')

const BATCH_SIZE = 100 // cities per single Open-Meteo request (comma-separated lat/lon)

function chunk(arr, size) {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

// 6 attempts × 65 s: Open-Meteo weights a 100-city request as ~100 calls against its 600/min
// budget, so a throttled run may need several minutes before a batch gets through. This
// script runs unattended in GitHub Actions (.github/workflows/refresh-weather.yml), where
// waiting is free; it is not on a serverless time budget.
// Network-level failures (GitHub runners see intermittent UND_ERR_CONNECT_TIMEOUT to
// api.open-meteo.com — runs 2–4 on 5 Sept lost 27–33 batches each to exactly this) are
// retried with a short backoff before the batch is given up; 429s keep their one-minute wait.
const NETWORK_BACKOFF_MS = [10000, 20000, 40000]
async function fetchWithRetry(url, label, attempts = 6) {
  let netFailures = 0
  for (let i = 0; i < attempts; i++) {
    let res
    try {
      res = await fetch(url)
    } catch (err) {
      if (netFailures < NETWORK_BACKOFF_MS.length) {
        const wait = NETWORK_BACKOFF_MS[netFailures++]
        console.warn(`  ${label}: ${err.cause?.code || err.message} — retrying in ${wait / 1000}s`)
        await new Promise(r => setTimeout(r, wait))
        i-- // network retries do not consume a 429 attempt
        continue
      }
      throw err
    }
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
  // cloud_cover added alongside temperature_2m in the same `current` param — this is the
  // same batched request Open-Meteo already charges for, not an extra call — to power the
  // map's weather overlay (heavy-cloud tint) without a separate fetch.
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lons}` +
    `&current=temperature_2m,cloud_cover&hourly=precipitation_probability&daily=temperature_2m_max&timezone=Asia/Kolkata&forecast_days=1`
  const data = await fetchWithRetry(url, 'weather batch')
  const arr = Array.isArray(data) ? data : [data]
  return arr.map(d => ({
    temp: d.current ? Math.round(d.current.temperature_2m) : null,
    cloudCover: typeof d.current?.cloud_cover === 'number' ? Math.round(d.current.cloud_cover) : null,
    rainChance: d.hourly?.precipitation_probability?.[0] ?? null,
    // today's forecast high (same call, no extra request) — shown as "peak" next to "now"
    tempMax: typeof d.daily?.temperature_2m_max?.[0] === 'number' ? Math.round(d.daily.temperature_2m_max[0]) : null
  }))
}

async function fetchAqiBatch(entries) {
  const lats = entries.map(e => e.lat).join(',')
  const lons = entries.map(e => e.lon).join(',')
  // pm10 added alongside us_aqi in the same `current` param, same reasoning as cloud_cover
  // above — powers the map's dust-storm overlay off the same batched AQI call.
  const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lats}&longitude=${lons}` +
    `&current=us_aqi,pm10&timezone=Asia/Kolkata`
  const data = await fetchWithRetry(url, 'aqi batch')
  const arr = Array.isArray(data) ? data : [data]
  // EPA US AQI scale officially caps at 500 — Open-Meteo's calculated value can exceed
  // that during extreme pollution events (e.g. dust storms), so clip for display
  return arr.map(d => ({
    aqi: d.current ? Math.min(500, Math.round(d.current.us_aqi)) : null,
    pm10: typeof d.current?.pm10 === 'number' ? Math.round(d.current.pm10) : null
  }))
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
  let previousLastUpdated = null
  if (fs.existsSync(OUTPUT_PATH)) {
    try {
      const prev = JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf8'))
      // Only cities still in the coordinate list — a city dropped from cityCoordinates.json
      // (e.g. wrong-place coordinates) must not live on as a carried-forward reading.
      const knownKeys = new Set(entries.map(e => `${e.city}|${e.state}`))
      let dropped = 0
      for (const [key, city] of Object.entries(prev.cities || {})) {
        if (knownKeys.has(key)) result[key] = city
        else dropped++
      }
      if (dropped) console.warn(`  dropped ${dropped} cached cities no longer in cityCoordinates.json`)
      previousLastUpdated = prev.lastUpdated || null
    } catch {}
  }
  const nowIso = new Date().toISOString()
  const freshKeys = new Set()
  let failedBatches = 0

  // One batch = one weather call + one AQI call for its cities; on success every city in it
  // becomes a fresh reading. Returns false when Open-Meteo refused it (usually a 429 after
  // the retries inside fetchWithRetry) so the caller can try again more gently.
  const processBatch = async (batch) => {
    try {
      // weather and AQI hit different Open-Meteo subdomains, so they don't share the same
      // per-IP bucket — but stagger them slightly anyway to avoid bursting either one
      const weatherRes = await fetchWeatherBatch(batch)
      await new Promise(r => setTimeout(r, 3000))
      const aqiRes = await fetchAqiBatch(batch)
      batch.forEach((entry, i) => {
        const key = `${entry.city}|${entry.state}`
        freshKeys.add(key)
        result[key] = {
          city: entry.city,
          state: entry.state,
          temp: weatherRes[i]?.temp ?? null,
          rainChance: weatherRes[i]?.rainChance ?? null,
          aqi: aqiRes[i]?.aqi ?? null,
          cloudCover: weatherRes[i]?.cloudCover ?? null,
          tempMax: weatherRes[i]?.tempMax ?? null,
          pm10: aqiRes[i]?.pm10 ?? null,
          observedAt: nowIso,
          isCarriedForward: false
        }
      })
      return true
    } catch (err) {
      console.warn(`  batch failed (${batch.length} cities): ${err.message}${err.cause ? ` — ${err.cause.code || err.cause.message}` : ''}`)
      return false
    }
  }

  const failedBatchList = []
  for (const batch of batches) {
    if (!(await processBatch(batch))) failedBatchList.push(batch)
    // pacing gap between batch-rounds: each round is ~2*BATCH_SIZE "location units" against
    // Open-Meteo's 600/min budget (weighted per-location, not per-request), so for
    // BATCH_SIZE=100 a round is ~200 units — pace rounds ~25s apart to stay safely under 600/min
    await new Promise(r => setTimeout(r, 25000))
  }

  // Gentle second pass for whatever got throttled: cool down a full minute, then retry the
  // failed batches split in half (50 cities → ~100 units a round) with wider spacing. A run
  // that lost 8 of 40 batches to 429s used to carry 700+ cities forward; this usually
  // recovers most of them within the same run. Anything still failing stays carried forward.
  if (failedBatchList.length) {
    console.warn(`  ${failedBatchList.length} batches throttled — cooling down 70s, then retrying in halves`)
    await new Promise(r => setTimeout(r, 70000))
    for (const batch of failedBatchList) {
      const halves = [batch.slice(0, Math.ceil(batch.length / 2)), batch.slice(Math.ceil(batch.length / 2))].filter(b => b.length)
      for (const half of halves) {
        if (!(await processBatch(half))) failedBatches++
        await new Promise(r => setTimeout(r, 30000))
      }
    }
  }

  // Same honesty rule as the production cron (api/_lib/refreshWeatherData.js): cities a
  // failed batch left untouched are flagged as carried forward, with their real observedAt.
  let carriedForward = 0
  for (const [key, city] of Object.entries(result)) {
    if (freshKeys.has(key)) continue
    result[key] = { ...city, isCarriedForward: true, observedAt: city.observedAt || previousLastUpdated || null }
    carriedForward++
  }
  if (carriedForward) console.warn(`  ${carriedForward} cities carried forward from ${previousLastUpdated || 'an earlier run'} (flagged isCarriedForward)`)

  const payload = {
    lastUpdated: nowIso,
    cityCount: Object.keys(result).length,
    carriedForwardCount: carriedForward,
    cities: result
  }
  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true })
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(payload))
  console.log(`Wrote ${Object.keys(result).length} cities to ${OUTPUT_PATH} (${failedBatches} batches failed)`)

  // Historic data — same two tiers as the production cron (api/refresh-weather-cache.js):
  // a compact snapshot for today + index, and Postgres when DATABASE_URL is set.
  const snapshot = buildSnapshot(payload)
  const indexAbs = path.join(REPO_ROOT, INDEX_PATH)
  let index = null
  try { index = JSON.parse(fs.readFileSync(indexAbs, 'utf8')) } catch {}
  index = updateIndex(index, snapshot)
  fs.mkdirSync(path.dirname(indexAbs), { recursive: true })
  fs.writeFileSync(path.join(REPO_ROOT, historyFilePath(snapshot.date)), JSON.stringify(snapshot))
  fs.writeFileSync(indexAbs, JSON.stringify(index, null, 2))
  console.log(`History snapshot ${snapshot.date} written (${index.days.length} days indexed)`)
  if (isDbConfigured()) {
    try {
      const r = await saveRunToDb(payload, { source: 'local' })
      console.log(`History saved to Postgres: +${r.inserted} rows`)
    } catch (err) {
      console.warn(`History database write failed (snapshot file still written): ${err.message}`)
    }
  }
  return payload
}

// Allow running directly: `node scripts/refreshWeatherCache.mjs`
if (import.meta.url === `file://${process.argv[1]}`) {
  refreshWeatherCache().catch(err => {
    console.error(err)
    process.exit(1)
  })
}
