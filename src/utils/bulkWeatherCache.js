// Registry for the bulk live-weather cache (public/live-weather-cache.json, refreshed
// by the daily cron). App loads that file once and registers it here so that
// useWeather — a hook used by many components, with no access to App state — can
// fall back to a city's cached reading when the live Open-Meteo call fails.
//
// Entries are partial: { city, state, temp, rainChance, aqi, cloudCover, pm10 }.
// buildWeatherFromBulkEntry() shapes one into the same object layout the live
// fetch returns, with every field we don't have set to null and isPartial: true,
// so consumers can render what exists and skip the rest.

import { getAQICategory } from './weatherAPI'
import { loadCityCoordinates, getExactCoordinates } from './cityCoordinateResolver'
import { fetchJson } from './fetchJson'

let registry = { cities: {}, lastUpdated: null }
let loadingPromise = null

// Every entry must carry its own city/state (AGNI's context builder, the leaderboard and
// the ticker read them); derive from the "City|State" key if a writer left them out.
export function normaliseBulkCities(cities) {
  return Object.fromEntries(Object.entries(cities || {}).map(([key, v]) => {
    if (v?.city && v?.state) return [key, v]
    const [city, state] = key.split('|')
    return [key, { city, state, ...v }]
  }))
}

// Lazy loader for consumers that need the cache but may run before — or after a failed —
// App-level load (AGNI on the dashboard, most importantly: without the cache it thought
// the selected city was the whole dataset). Resolves to true when the registry has data.
export async function ensureBulkWeatherCache({ timeoutMs = 15000 } = {}) {
  if (Object.keys(registry.cities).length) return true
  if (!loadingPromise) {
    loadingPromise = (async () => {
      let lastErr = null
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const data = await fetchJson('/live-weather-cache.json', { timeoutMs })
          const cities = normaliseBulkCities(data?.cities)
          if (Object.keys(cities).length) {
            if (!Object.keys(registry.cities).length) registry = { cities, lastUpdated: data?.lastUpdated || null }
            return true
          }
        } catch (err) { lastErr = err }
        await new Promise(r => setTimeout(r, 800 * (attempt + 1)))
      }
      console.warn('[bulkWeatherCache] could not load the city cache:', lastErr?.message || 'empty file')
      return false
    })().finally(() => { loadingPromise = null })
  }
  return loadingPromise
}

export function setBulkWeatherCache(cities, lastUpdated) {
  registry = { cities: cities || {}, lastUpdated: lastUpdated || null }
}

export function getBulkWeatherLastUpdated() {
  return registry.lastUpdated
}

export function getBulkWeatherCities() {
  return registry.cities
}

// Exact "City|State" key first; otherwise the first entry whose city name matches
// case-insensitively (state spellings differ between data sources occasionally).
export function getBulkWeatherEntry(city, state) {
  if (!city) return null
  const exact = registry.cities[`${city}|${state || ''}`]
  if (exact) return { entry: exact, lastUpdated: registry.lastUpdated }
  const wanted = String(city).trim().toLowerCase()
  const wantedState = String(state || '').trim().toLowerCase()
  const entries = Object.entries(registry.cities)
  // 1. same city name, any state spelling
  for (const [key, entry] of entries) {
    if (key.split('|')[0].trim().toLowerCase() === wanted) return { entry, lastUpdated: registry.lastUpdated }
  }
  // 2. same state, name containment either way ("Delhi" ↔ "New Delhi")
  if (wantedState) {
    for (const [key, entry] of entries) {
      const [k, st] = key.split('|').map(x => x.trim().toLowerCase())
      if (st === wantedState && (k.includes(wanted) || wanted.includes(k))) return { entry, lastUpdated: registry.lastUpdated }
    }
  }
  return null
}

export async function buildWeatherFromBulkEntry(entry, lastUpdated, city, state) {
  let coords = null
  try {
    coords = getExactCoordinates(await loadCityCoordinates(), entry.city || city, entry.state || state)
  } catch {
    coords = null
  }
  const aqi = typeof entry.aqi === 'number' ? entry.aqi : null
  return {
    city: entry.city || city,
    state: entry.state || state,
    lat: typeof coords?.lat === 'number' ? coords.lat : null,
    lon: typeof coords?.lon === 'number' ? coords.lon : null,
    timezone: 'Asia/Kolkata',
    isFallbackLocation: false,
    fallbackCityUsed: null,
    elevation: null,
    isPartial: true,
    source: 'bulk-cache',
    cachedAt: lastUpdated,
    current: {
      temp: typeof entry.temp === 'number' ? Math.round(entry.temp) : null,
      feelsLike: null,
      humidity: null,
      windSpeed: null,
      windGust: null,
      windDirection: null,
      pressure: null,
      visibility: null,
      uvIndex: null,
      cloudCover: typeof entry.cloudCover === 'number' ? entry.cloudCover : null,
      precipitation: null,
      rainChance: typeof entry.rainChance === 'number' ? entry.rainChance : null,
      condition: { icon: '🗂️', label: 'Cached reading' },
      isDay: null,
      surfaceTemp: null
    },
    aqi: aqi == null ? null : {
      usAQI: Math.min(500, aqi),
      usAQIClamped: aqi > 500,
      pm25: null,
      pm10: typeof entry.pm10 === 'number' ? entry.pm10 : null,
      no2: null,
      o3: null,
      category: getAQICategory(Math.min(500, aqi))
    },
    today: null,
    forecast: [],
    hourly: []
  }
}
