// Open-Meteo ENSEMBLE forecast for one city: many model runs ("members") instead of the one
// deterministic run the rest of the app uses. From the members we derive two things the
// deterministic run cannot give honestly:
//   • heatwave probability — the share of valid members whose daily maxima satisfy the
//     project's existing IMD-threshold rule (utils/heatwaveOutlook: ≥ 40 °C plains / 37 °C
//     coast / 30 °C hills, or ≥ 45 °C absolute) on ≥ 2 consecutive days within the window;
//     also, per day, the share of members at or above the threshold
//   • an uncertainty band — the 10th / 50th / 90th percentile of the members' daily maxima
// Both are labelled "ensemble-derived under the configured criterion"; this is not an IMD
// forecast and no calibrated "confidence %" is invented. Missing members or days are dropped
// and the counts are reported, so the UI can say "27 of 31 members".
//
// Endpoint (verified 19 Oct 2026): https://ensemble-api.open-meteo.com/v1/ensemble
//   daily=temperature_2m_max,temperature_2m_min  models=gfs_seamless (31 members: control +
//   member01…member30; 35-day horizon). Non-commercial use, no key.
import { fetchJson } from './fetchJson'
import { terrainThreshold, IMD_RULE } from './heatwaveOutlook'

export const ENSEMBLE_MODEL = 'gfs_seamless'
const TTL_MS = 30 * 60 * 1000
const cache = new Map() // "lat,lon" → { at, promise }

export function ensembleUrl(lat, lon, days = 7) {
  return `https://ensemble-api.open-meteo.com/v1/ensemble?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min&models=${ENSEMBLE_MODEL}&forecast_days=${days}&timezone=Asia/Kolkata`
}

// Pull member arrays out of the daily block: [{ id, max: [...], min: [...] }]
export function parseMembers(daily) {
  if (!daily?.time) return []
  const ids = new Set()
  for (const k of Object.keys(daily)) { const m = /^temperature_2m_max(?:_member(\d+))?$/.exec(k); if (m) ids.add(m[1] ?? 'control') }
  const out = []
  for (const id of ids) {
    const sfx = id === 'control' ? '' : `_member${id}`
    const max = daily[`temperature_2m_max${sfx}`]; const min = daily[`temperature_2m_min${sfx}`]
    if (!Array.isArray(max)) continue
    // a member is valid for a day only when its max is a finite number
    out.push({ id, max: max.map(v => (typeof v === 'number' && Number.isFinite(v) ? v : null)), min: Array.isArray(min) ? min.map(v => (typeof v === 'number' && Number.isFinite(v) ? v : null)) : [] })
  }
  return out
}

const pct = (sorted, p) => { if (!sorted.length) return null; const i = (sorted.length - 1) * p; const lo = Math.floor(i), hi = Math.ceil(i); return Math.round((sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo)) * 10) / 10 }

export function summariseEnsemble(json, { elevation = null, isCoastal = false } = {}) {
  const daily = json?.daily
  const members = parseMembers(daily)
  if (!members.length || !daily?.time?.length) return null
  const threshold = terrainThreshold({ elevation, isCoastal })
  const days = daily.time.map((date, i) => {
    const maxes = members.map(m => m.max[i]).filter(v => v != null).sort((a, b) => a - b)
    const mins = members.map(m => m.min[i]).filter(v => v != null).sort((a, b) => a - b)
    const above = maxes.filter(v => v >= threshold.t).length
    return { date, n: maxes.length, p10: pct(maxes, 0.1), p50: pct(maxes, 0.5), p90: pct(maxes, 0.9), min50: pct(mins, 0.5), pAbove: maxes.length ? above / maxes.length : null, above }
  })
  // Heatwave criterion: ≥ 2 consecutive days with max ≥ threshold, or ≥ 45 °C absolute, within the window.
  let qualifying = 0, valid = 0
  for (const m of members) {
    const v = m.max.filter(x => x != null)
    if (v.length < 2) continue
    valid++
    let run = 0, hit = false
    for (const x of m.max) { if (x == null) { run = 0; continue } if (x >= threshold.t) { run++; if (run >= 2) hit = true } else run = 0; if (x >= IMD_RULE.absolute) hit = true }
    if (hit) qualifying++
  }
  return {
    model: ENSEMBLE_MODEL, members: members.length, validMembers: valid, qualifying,
    probability: valid ? qualifying / valid : null,
    threshold, days,
    criterion: `≥ 2 consecutive days with the daily maximum at or above ${threshold.t} °C (IMD ${threshold.kind} threshold), or any day ≥ ${IMD_RULE.absolute} °C, within the next ${daily.time.length} days`,
    generatedAt: Date.now()
  }
}

export function fetchEnsemble({ lat, lon, elevation, isCoastal, days = 7, signal } = {}) {
  if (typeof lat !== 'number' || typeof lon !== 'number') return Promise.reject(new Error('no coordinates'))
  const key = `${lat.toFixed(3)},${lon.toFixed(3)},${days}`
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < TTL_MS) return hit.promise
  const promise = fetchJson(ensembleUrl(lat, lon, days), { timeoutMs: 20000, signal }).then(j => {
    if (j?.error) throw new Error(j.reason || 'ensemble API error')
    const s = summariseEnsemble(j, { elevation, isCoastal })
    if (!s) throw new Error('no ensemble members in the response')
    return s
  }).catch(err => { cache.delete(key); throw err })
  cache.set(key, { at: Date.now(), promise })
  return promise
}

// ── 72-hour hourly ensemble band (same model, hourly 2 m temperature) ──────────────────────
export function summariseHourly(json) {
  const h = json?.hourly
  if (!h?.time?.length) return null
  const keys = Object.keys(h).filter(k => /^temperature_2m(_member\d+)?$/.test(k))
  if (!keys.length) return null
  const hours = h.time.map((time, i) => {
    const v = keys.map(k => h[k]?.[i]).filter(x => typeof x === 'number' && Number.isFinite(x)).sort((a, b) => a - b)
    return { time, n: v.length, p10: pct(v, 0.1), p50: pct(v, 0.5), p90: pct(v, 0.9) }
  })
  return { model: ENSEMBLE_MODEL, members: keys.length, hours }
}

export function fetchEnsembleHourly({ lat, lon, signal } = {}) {
  if (typeof lat !== 'number' || typeof lon !== 'number') return Promise.reject(new Error('no coordinates'))
  const key = `h:${lat.toFixed(3)},${lon.toFixed(3)}`
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < TTL_MS) return hit.promise
  const url = `https://ensemble-api.open-meteo.com/v1/ensemble?latitude=${lat}&longitude=${lon}&hourly=temperature_2m&models=${ENSEMBLE_MODEL}&forecast_days=3&timezone=Asia/Kolkata`
  const promise = fetchJson(url, { timeoutMs: 20000, signal }).then(j => {
    if (j?.error) throw new Error(j.reason || 'ensemble API error')
    const s = summariseHourly(j); if (!s) throw new Error('no hourly ensemble members'); return s
  }).catch(err => { cache.delete(key); throw err })
  cache.set(key, { at: Date.now(), promise })
  return promise
}

// ── Several cities' deterministic 7-day maxima in ONE Open-Meteo request ─────────────────
// Used for the district risk timeline: each district is represented by the city the app
// already uses for it (the city's forecast stands in for the district — labelled so).
export function fetchMultiCityDaily(locs, { signal } = {}) {
  const ok = (locs || []).filter(l => typeof l.lat === 'number' && typeof l.lon === 'number').slice(0, 12)
  if (!ok.length) return Promise.resolve([])
  const key = `m:${ok.map(l => `${l.lat.toFixed(2)},${l.lon.toFixed(2)}`).join(';')}`
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < TTL_MS) return hit.promise
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${ok.map(l => l.lat).join(',')}&longitude=${ok.map(l => l.lon).join(',')}&daily=temperature_2m_max&forecast_days=7&timezone=Asia/Kolkata`
  const promise = fetchJson(url, { timeoutMs: 15000, signal }).then(j => {
    const arr = Array.isArray(j) ? j : [j]
    return ok.map((l, i) => ({ ...l, time: arr[i]?.daily?.time || [], max: (arr[i]?.daily?.temperature_2m_max || []).map(v => (typeof v === 'number' ? Math.round(v * 10) / 10 : null)), elevation: arr[i]?.elevation ?? null }))
  }).catch(err => { cache.delete(key); throw err })
  cache.set(key, { at: Date.now(), promise })
  return promise
}
