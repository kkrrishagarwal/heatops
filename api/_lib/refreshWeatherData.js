// Fetches fresh current temperature + AQI + rain chance for every city in
// src/data/cityCoordinates.json from Open-Meteo, batched with bounded concurrency and
// retry-on-429 instead of scripts/refreshWeatherCache.mjs's long serial pacing — that script
// is built for a long-running daemon being extra polite to a free API across many ticks per
// day; this runs once per day inside a Vercel serverless function with a hard ~60s
// wall-clock budget on the Hobby plan, so it has to finish fast.
//
// Testing locally surfaced that Open-Meteo's real burst tolerance is much tighter than its
// documented 600/min average suggests — firing several concurrent 100-location requests in a
// row got most of them 429'd, even with retries, likely because this dev machine's IP had
// already hit Open-Meteo repeatedly earlier today. Vercel's production IP starts clean, so
// concurrency 2 + retry-with-backoff on 429 is a deliberately conservative starting point —
// see REFRESH_BEFORE_JUDGING.md or the first real cron run's logs to confirm actual behavior
// in production before assuming this is tuned correctly.
import fs from 'fs'
import path from 'path'

const BATCH_SIZE = 100
const CONCURRENCY = 2
const MAX_ATTEMPTS = 4
const BACKOFF_BASE_MS = 3000 // 3s, 6s, 9s between retries

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
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lons}` +
    `&current=temperature_2m&hourly=precipitation_probability&timezone=Asia/Kolkata&forecast_days=1`
  const data = await fetchJsonWithRetry(url, 'weather batch')
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
  const data = await fetchJsonWithRetry(url, 'aqi batch')
  const arr = Array.isArray(data) ? data : [data]
  return arr.map(d => ({ aqi: d.current ? Math.min(500, Math.round(d.current.us_aqi)) : null }))
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
export async function refreshWeatherData(existingCities = {}) {
  const entries = loadCoordinates()
  const batches = chunk(entries, BATCH_SIZE)
  const result = { ...existingCities }
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
      result[`${entry.city}|${entry.state}`] = {
        city: entry.city,
        state: entry.state,
        temp: weatherRes[i]?.temp ?? null,
        rainChance: weatherRes[i]?.rainChance ?? null,
        aqi: aqiRes[i]?.aqi ?? null
      }
    })
  })

  return {
    payload: {
      lastUpdated: new Date().toISOString(),
      cityCount: Object.keys(result).length,
      cities: result
    },
    batchCount: batches.length,
    failedBatches
  }
}
