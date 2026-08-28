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

let registry = { cities: {}, lastUpdated: null }

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
