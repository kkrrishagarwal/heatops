// Live refresh of ONE state's cities when that state is opened on the map.
//
// Why: the bulk cache (public/live-weather-cache.json) is a once-a-day snapshot, so the
// city list, the state's average and the map colour can be many hours old, while the
// selected city's own WeatherCard is fetched live. That produced "Udaipur 23 °C in the
// list, 28 °C once selected". Fetching the whole state's current temperatures in ONE
// batched Open-Meteo call (≤ 100 cities → one request; Delhi's 98 localities fit) makes
// every row, the state average and the selected city agree, and costs almost nothing:
// one call per state per 10 minutes, no API key.
//
// Only the fields the cache already has are refreshed (temperature, cloud cover, rain
// chance). AQI is left at its cached value — it changes slowly and would need a second
// call to a different endpoint.

import { fetchJson } from './fetchJson'
import { loadCityCoordinates, getExactCoordinates } from './cityCoordinateResolver'

export const STATE_REFRESH_TTL_MS = 10 * 60 * 1000
const MAX_PER_CALL = 100

const refreshedAt = new Map()   // state → epoch ms of the last successful refresh
const inFlight = new Map()      // state → Promise, so a double-click doesn't double-fetch

export function getStateRefreshedAt(state) {
  return refreshedAt.get(state) || null
}

// ---- Whole-map sample refresh ----
// One batched call for ~8 prominent cities per state (~270 points) so every state's colour
// can come from the SAME current vintage on map load, instead of the daily snapshot for 35
// states and a fresh reading for the one you clicked. Real readings only, and the state
// tooltip says "sampled". TTL keeps it to one call per 10 minutes per browser.
let sampleRefreshedAt = 0
let sampleInFlight = null
export const SAMPLE_PER_STATE = 8

export function getSampleRefreshedAt() { return sampleRefreshedAt || null }

export async function refreshAllStatesSample(stateCities, { force = false } = {}) {
  if (!stateCities || typeof stateCities !== 'object') return null
  if (!force && sampleRefreshedAt && Date.now() - sampleRefreshedAt < STATE_REFRESH_TTL_MS) return null
  if (sampleInFlight) return sampleInFlight
  sampleInFlight = (async () => {
    try {
      const coords = await loadCityCoordinates()
      const located = []
      for (const [state, cityNames] of Object.entries(stateCities)) {
        let taken = 0
        for (const city of cityNames || []) {
          if (taken >= SAMPLE_PER_STATE) break
          const c = getExactCoordinates(coords, city, state)
          if (c && typeof c.lat === 'number' && typeof c.lon === 'number') { located.push({ city, state, c }); taken++ }
        }
      }
      if (located.length === 0) return null
      const entries = {}
      const nowIso = new Date().toISOString()
      for (const batch of chunk(located, MAX_PER_CALL)) {
        const lats = batch.map(x => x.c.lat).join(',')
        const lons = batch.map(x => x.c.lon).join(',')
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lons}` +
          `&current=temperature_2m,cloud_cover&hourly=precipitation_probability&daily=temperature_2m_max&timezone=Asia/Kolkata&forecast_days=1`
        const data = await fetchJson(url, { timeoutMs: 15000 })
        const arr = Array.isArray(data) ? data : [data]
        batch.forEach((x, i) => {
          const d = arr[i]
          if (!d?.current || typeof d.current.temperature_2m !== 'number') return
          entries[`${x.city}|${x.state}`] = {
            city: x.city, state: x.state,
            temp: Math.round(d.current.temperature_2m),
            cloudCover: typeof d.current.cloud_cover === 'number' ? Math.round(d.current.cloud_cover) : null,
            rainChance: d.hourly?.precipitation_probability?.[0] ?? null,
            tempMax: typeof d.daily?.temperature_2m_max?.[0] === 'number' ? Math.round(d.daily.temperature_2m_max[0]) : null,
            observedAt: nowIso, isCarriedForward: false, liveRefreshed: true
          }
        })
      }
      if (Object.keys(entries).length === 0) return null
      sampleRefreshedAt = Date.now()
      return { entries, fetchedAt: nowIso }
    } catch (err) {
      console.warn(`[stateLiveRefresh] sample: ${err?.message || err}`)
      return null
    } finally {
      sampleInFlight = null
    }
  })()
  return sampleInFlight
}

function chunk(arr, size) {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

// Resolves to { entries: { "City|State": {temp, cloudCover, rainChance, observedAt, isCarriedForward:false} },
// fetchedAt } or null when nothing could be refreshed. Never throws — the caller keeps
// showing the cached values (labelled with their own age) if this fails.
export async function refreshStateLive(state, cityNames, { force = false } = {}) {
  if (!state || !Array.isArray(cityNames) || cityNames.length === 0) return null
  const last = refreshedAt.get(state)
  if (!force && last && Date.now() - last < STATE_REFRESH_TTL_MS) return null
  if (inFlight.has(state)) return inFlight.get(state)

  const job = (async () => {
    try {
      const coords = await loadCityCoordinates()
      const located = cityNames
        .map(city => ({ city, c: getExactCoordinates(coords, city, state) }))
        .filter(x => x.c && typeof x.c.lat === 'number' && typeof x.c.lon === 'number')
      if (located.length === 0) return null

      const entries = {}
      const nowIso = new Date().toISOString()
      for (const batch of chunk(located, MAX_PER_CALL)) {
        const lats = batch.map(x => x.c.lat).join(',')
        const lons = batch.map(x => x.c.lon).join(',')
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lons}` +
          `&current=temperature_2m,cloud_cover&hourly=precipitation_probability&daily=temperature_2m_max&timezone=Asia/Kolkata&forecast_days=1`
        const data = await fetchJson(url, { timeoutMs: 12000 })
        const arr = Array.isArray(data) ? data : [data]
        batch.forEach((x, i) => {
          const d = arr[i]
          if (!d?.current || typeof d.current.temperature_2m !== 'number') return
          entries[`${x.city}|${state}`] = {
            city: x.city,
            state,
            temp: Math.round(d.current.temperature_2m),
            cloudCover: typeof d.current.cloud_cover === 'number' ? Math.round(d.current.cloud_cover) : null,
            rainChance: d.hourly?.precipitation_probability?.[0] ?? null,
            tempMax: typeof d.daily?.temperature_2m_max?.[0] === 'number' ? Math.round(d.daily.temperature_2m_max[0]) : null,
            observedAt: nowIso,
            isCarriedForward: false,
            liveRefreshed: true
          }
        })
      }
      if (Object.keys(entries).length === 0) return null
      refreshedAt.set(state, Date.now())
      return { entries, fetchedAt: nowIso }
    } catch (err) {
      console.warn(`[stateLiveRefresh] ${state}: ${err?.message || err}`)
      return null
    } finally {
      inFlight.delete(state)
    }
  })()
  inFlight.set(state, job)
  return job
}
