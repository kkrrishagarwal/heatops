import { useState, useEffect } from 'react'
import { fetchCompleteWeather } from '../utils/weatherAPI'

// Single shared source of live weather data for the whole app. The in-memory cache below is a
// MODULE-LEVEL singleton (not component state), so every component that calls useWeather()
// for the same city — WeatherCard, the dashboard's precautions/AI/export panels, etc. —
// reads/writes the same entry. Only the first caller for a given city triggers a network
// request; everyone else within the TTL window reuses that result or in-flight promise.
//
// On top of that sits a PERSISTENT (localStorage) cache of the last successful fetch per city.
// If a live fetch fails for any reason (most commonly the Open-Meteo free-tier daily quota
// being exhausted), we fall back to that last-known-good value instead of showing an error —
// the dashboard should always show real, if possibly stale, numbers rather than a broken panel.
const CACHE_TTL_MS = 8 * 60 * 1000 // 8 minutes — how long the in-memory entry is reused as-is
const REQUEST_TIMEOUT_MS = 10000
const MAX_RETRIES = 3
const RETRY_BASE_MS = 2000 // 2s, 4s, 8s
const PERSIST_PREFIX = 'heatops_weather_persist:'

const cache = new Map() // city -> { promise, data, error, timestamp }

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function isRateLimited(err) {
  return /429/.test(err?.message || '')
}

function readPersisted(cacheKey) {
  try {
    const raw = window.localStorage.getItem(PERSIST_PREFIX + cacheKey)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed?.data || !parsed?.timestamp) return null
    return parsed
  } catch {
    return null
  }
}

function writePersisted(cacheKey, data) {
  try {
    window.localStorage.setItem(PERSIST_PREFIX + cacheKey, JSON.stringify({ data, timestamp: Date.now() }))
  } catch {
    // localStorage unavailable/full — non-fatal, just means no offline fallback this time
  }
}

async function fetchWithRetry(city, state, cacheKey, callerTag) {
  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
    try {
      console.log(`[useWeather] fetching live weather for "${city}, ${state}" (requested by ${callerTag}), attempt ${attempt}`)
      const data = await fetchCompleteWeather(city, state)
      writePersisted(cacheKey, data)
      return data
    } catch (err) {
      const canRetry = isRateLimited(err) && attempt <= MAX_RETRIES
      if (!canRetry) throw err
      const waitMs = RETRY_BASE_MS * Math.pow(2, attempt - 1)
      console.log(`[useWeather] 429 rate-limited for "${city}, ${state}" — retrying in ${waitMs}ms (attempt ${attempt}/${MAX_RETRIES})`)
      await sleep(waitMs)
    }
  }
}

// Cache key includes state, not just city name — two different states can have a city with the
// SAME name (e.g. 3 separate Indian towns are all named "Bilaspur"), and keying by name alone
// meant whichever one was fetched first got silently reused as the "weather" for the other
// state's same-named city on every subsequent visit, with no error or indication anything was
// wrong. State-qualifying the key (and the geocoding query itself, see weatherAPI.js) fixes
// this at the source instead of just reducing how often it's hit.
function getEntry(city, state, callerTag) {
  const cacheKey = `${city}|${state || ''}`
  const existing = cache.get(cacheKey)
  const fresh = existing && (Date.now() - existing.timestamp) < CACHE_TTL_MS
  if (fresh) {
    console.log(`[useWeather] reusing cached/in-flight weather for "${city}, ${state}" (requested by ${callerTag})`)
    return existing
  }
  const promise = fetchWithRetry(city, state, cacheKey, callerTag)
  const entry = { promise, data: null, error: null, timestamp: Date.now() }
  cache.set(cacheKey, entry)
  promise
    .then(data => { entry.data = data; entry.timestamp = Date.now() })
    .catch(err => { entry.error = err; entry.timestamp = Date.now() })
  return entry
}

function buildState({ data, loading, error, isStale, cachedAt, timedOut }) {
  return { data, loading, error, isStale, cachedAt, timedOut }
}

/**
 * Single shared hook for live weather + AQI for a city. Dedupes concurrent/recent requests
 * for the same city across every component using it, retries 429s with backoff, and falls back
 * to the last successfully cached value (localStorage, persists across reloads) if the live
 * fetch fails — only surfacing an error when there is truly no data of any kind for that city.
 */
export function useWeather(city, cityState, callerTag = 'unknown') {
  const [state, setState] = useState(() =>
    buildState({ data: null, loading: !!city, error: null, isStale: false, cachedAt: null, timedOut: false })
  )
  const cacheKey = `${city}|${cityState || ''}`

  useEffect(() => {
    if (!city) {
      setState(buildState({ data: null, loading: false, error: null, isStale: false, cachedAt: null, timedOut: false }))
      return
    }

    let cancelled = false
    // Show the last-known-good cached value immediately (if any) while the live fetch runs in
    // the background — the panel never has to sit blank/spinning if we already have *something*.
    const persisted = readPersisted(cacheKey)
    setState(buildState({
      data: persisted?.data ?? null,
      loading: true,
      error: null,
      isStale: !!persisted,
      cachedAt: persisted?.timestamp ?? null,
      timedOut: false
    }))

    const entry = getEntry(city, cityState, callerTag)

    const timeoutId = setTimeout(() => {
      if (!cancelled) setState(s => (s.loading ? { ...s, timedOut: true } : s))
    }, REQUEST_TIMEOUT_MS)

    entry.promise
      .then(data => {
        if (cancelled) return
        setState(buildState({ data, loading: false, error: null, isStale: false, cachedAt: null, timedOut: false }))
      })
      .catch(err => {
        if (cancelled) return
        const fallback = readPersisted(cacheKey)
        if (fallback) {
          console.log(`[useWeather] live fetch failed for "${city}, ${cityState}" — falling back to cache from ${new Date(fallback.timestamp).toLocaleTimeString()}`)
          setState(buildState({ data: fallback.data, loading: false, error: null, isStale: true, cachedAt: fallback.timestamp, timedOut: false }))
        } else {
          setState(buildState({ data: null, loading: false, error: err, isStale: false, cachedAt: null, timedOut: false }))
        }
      })
      .finally(() => clearTimeout(timeoutId))

    return () => {
      cancelled = true
      clearTimeout(timeoutId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city, cityState])

  // Manual-only: bypasses the in-memory TTL to make one fresh attempt right now. Does NOT
  // loop or auto-retry in the background beyond the normal 429 backoff for this one attempt —
  // for checking "is the API back up yet" during a demo without risking a constant retry storm.
  const forceRefresh = () => {
    if (!city) return
    cache.delete(cacheKey)
    setState(s => ({ ...s, loading: true, timedOut: false }))

    const entry = getEntry(city, cityState, `${callerTag} (force refresh)`)
    const timeoutId = setTimeout(() => {
      setState(s => (s.loading ? { ...s, timedOut: true } : s))
    }, REQUEST_TIMEOUT_MS)

    entry.promise
      .then(data => {
        setState(buildState({ data, loading: false, error: null, isStale: false, cachedAt: null, timedOut: false }))
      })
      .catch(err => {
        const fallback = readPersisted(cacheKey)
        if (fallback) {
          setState(buildState({ data: fallback.data, loading: false, error: null, isStale: true, cachedAt: fallback.timestamp, timedOut: false }))
        } else {
          setState(buildState({ data: null, loading: false, error: err, isStale: false, cachedAt: null, timedOut: false }))
        }
      })
      .finally(() => clearTimeout(timeoutId))
  }

  return { ...state, forceRefresh }
}
