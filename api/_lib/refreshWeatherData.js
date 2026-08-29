// Fetches fresh current temperature + AQI + rain chance for every city in
// src/data/cityCoordinates.json from Open-Meteo, batched with bounded concurrency and
// retry-on-429 instead of scripts/refreshWeatherCache.mjs's long serial pacing — that script
// is built for a long-running daemon being extra polite to a free API across many ticks per
// day; this runs once per day inside a Vercel serverless function with a hard ~60s
// wall-clock budget on the Hobby plan, so it has to finish fast.
//
// BATCH_SIZE=300 is the largest that doesn't trip Open-Meteo's own URL-length limit (a 414
// at ~500 cities/~9000 chars; 300 cities/~5500 chars is confirmed working) — keeping batches
// this large means only 6 round trips instead of 17, which matters far more for finishing
// inside the time budget than concurrency does. A first production run still timed out at
// BATCH_SIZE=100/concurrency=2 (17 batches), so this is the fix, not a tuning guess.
import fs from 'fs'
import path from 'path'

const BATCH_SIZE = 300
const CONCURRENCY = 3
const MAX_ATTEMPTS = 3
const BACKOFF_BASE_MS = 3000 // 3s, 6s between retries

function chunk(arr, size) {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

async function fetchJsonWithRetry(url, label) {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const res = await fetch(url)
    if (res.ok) return res.json()
    if (res.status === 429 && attempt < MAX_ATTEMPTS - 1) {
      await new Promise(r => setTimeout(r, BACKOFF_BASE_MS * (attempt + 1)))
      continue
    }
    throw new Error(`${label} failed: ${res.status}`)
  }
}

async function runWithConcurrency(items, worker, concurrency) {
  const results = new Array(items.length)
  let cursor = 0
  async function lane() {
    while (cursor < items.length) {
      const i = cursor++
      try {
        results[i] = await worker(items[i], i)
      } catch (err) {
        results[i] = { error: err.message }
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, lane))
  return results
}

async function fetchWeatherBatch(entries) {
  const lats = entries.map(e => e.lat).join(',')
  const lons = entries.map(e => e.lon).join(',')
  // cloud_cover added alongside temperature_2m in the same `current` param — same batched
  // request, no extra round trip. Mirrors scripts/refreshWeatherCache.mjs (kept in sync so
  // the production cron doesn't regress the map's weather-overlay fields on its next run).
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lons}` +
    `&current=temperature_2m,cloud_cover&hourly=precipitation_probability&timezone=Asia/Kolkata&forecast_days=1`
  const data = await fetchJsonWithRetry(url, 'weather batch')
  const arr = Array.isArray(data) ? data : [data]
  return arr.map(d => ({
    temp: d.current ? Math.round(d.current.temperature_2m) : null,
    cloudCover: typeof d.current?.cloud_cover === 'number' ? Math.round(d.current.cloud_cover) : null,
    rainChance: d.hourly?.precipitation_probability?.[0] ?? null
  }))
}

async function fetchAqiBatch(entries) {
  const lats = entries.map(e => e.lat).join(',')
  const lons = entries.map(e => e.lon).join(',')
  // pm10 added alongside us_aqi, same reasoning as cloud_cover above.
  const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lats}&longitude=${lons}` +
    `&current=us_aqi,pm10&timezone=Asia/Kolkata`
  const data = await fetchJsonWithRetry(url, 'aqi batch')
  const arr = Array.isArray(data) ? data : [data]
  return arr.map(d => ({
    aqi: d.current ? Math.min(500, Math.round(d.current.us_aqi)) : null,
    pm10: typeof d.current?.pm10 === 'number' ? Math.round(d.current.pm10) : null
  }))
}

function loadCoordinates() {
  // includeFiles in vercel.json ensures this is present in the deployed function bundle.
  const coordsPath = path.join(process.cwd(), 'src/data/cityCoordinates.json')
  const coords = JSON.parse(fs.readFileSync(coordsPath, 'utf8'))
  return Object.values(coords).filter(e => typeof e.lat === 'number' && typeof e.lon === 'number')
}

// existingCities: whatever was already in live-weather-cache.json before this run, so a
// batch failure here just leaves those cities at their last-known value instead of blanking
// them — same safety behavior as the local daemon script.
// previousLastUpdated: the timestamp of the cache this run started from — becomes the
// observedAt of any city we could NOT refresh this run.
export async function refreshWeatherData(existingCities = {}, previousLastUpdated = null) {
  const entries = loadCoordinates()
  const batches = chunk(entries, BATCH_SIZE)
  // Seed from the previous cache, but only for cities that are STILL in the coordinate
  // list. A city dropped from cityCoordinates.json (e.g. one whose coordinates turned out
  // to point at the wrong place) must not live on as a carried-forward reading.
  const knownKeys = new Set(entries.map(e => `${e.city}|${e.state}`))
  const result = {}
  let dropped = 0
  for (const [key, city] of Object.entries(existingCities || {})) {
    if (knownKeys.has(key)) result[key] = city
    else dropped++
  }
  if (dropped) console.warn(`  dropped ${dropped} cached cities no longer in cityCoordinates.json`)
  const nowIso = new Date().toISOString()
  const freshKeys = new Set()
  let failedBatches = 0

  const weatherResults = await runWithConcurrency(batches, b => fetchWeatherBatch(b), CONCURRENCY)
  const aqiResults = await runWithConcurrency(batches, b => fetchAqiBatch(b), CONCURRENCY)

  batches.forEach((batch, bi) => {
    const weatherRes = weatherResults[bi]
    const aqiRes = aqiResults[bi]
    if (weatherRes?.error || aqiRes?.error) {
      failedBatches++
      return
    }
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
        pm10: aqiRes[i]?.pm10 ?? null,
        observedAt: nowIso,
        isCarriedForward: false
      }
    })
  })

  // Radical-honesty rule: a city whose batch failed keeps its previous values so the map
  // never blanks out, but that reading is explicitly flagged as carried forward, with the
  // timestamp it was actually observed at, so nothing downstream can mistake it for fresh.
  let carriedForward = 0
  for (const [key, city] of Object.entries(result)) {
    if (freshKeys.has(key)) continue
    result[key] = {
      ...city,
      isCarriedForward: true,
      observedAt: city.observedAt || (city.isCarriedForward ? null : previousLastUpdated) || previousLastUpdated || null
    }
    carriedForward++
  }

  return {
    payload: {
      lastUpdated: nowIso,
      cityCount: Object.keys(result).length,
      carriedForwardCount: carriedForward,
      cities: result
    },
    carriedForward,
    batchCount: batches.length,
    failedBatches
  }
}
