// Point overlays for the Command Center map (src/components/CommandCenterHud.jsx). Every
// point is a real reading joined to a real coordinate — nothing is interpolated or invented:
//   air    — Open-Meteo current temperature / today's forecast high from the bulk cache
//   modis  — NASA MODIS MOD11A1 land-surface temperature: latest clear-sky pass, a scrubbed
//            daily pass for one state, or the April–June peak-season mean for a year
//   lulc   — ESA WorldCover 2021 built-up share (171 classified cities)
// Shape: { points: [{ key, lon, lat, value, color, label, r }], caption, count, missing }

const num = v => (typeof v === 'number' && Number.isFinite(v) ? v : null)

export const HUD_LAYERS = {
  air: { label: 'Air temperature', source: 'Open-Meteo, live cache', unit: '°C' },
  modis: { label: 'Surface temperature', source: 'NASA MODIS MOD11A1 (Terra, 1 km)', unit: '°C' },
  lulc: { label: 'Built-up share', source: 'ESA WorldCover 10 m (2021)', unit: '%' }
}

export const MODIS_YEAR_MIN = 2016
export const MODIS_YEAR_MAX = 2026

// Built-up % → grey → amber → red ramp (not a heat scale; labelled separately).
export function builtUpColor(pct) {
  if (pct == null) return '#475569'
  if (pct >= 70) return '#b91c1c'
  if (pct >= 50) return '#ea580c'
  if (pct >= 30) return '#f59e0b'
  if (pct >= 15) return '#a3a3a3'
  return '#64748b'
}

function coordFor(coords, key) {
  const c = coords?.[key]
  const lat = num(c?.lat); const lon = num(c?.lon)
  return lat != null && lon != null ? { lat, lon } : null
}

// ── air (bulk cache) ─────────────────────────────────────────────────────────
export function airOverlay({ liveCityCache, coords, colorFor, field = 'temp' }) {
  const points = []
  let missing = 0
  for (const [key, c] of Object.entries(liveCityCache || {})) {
    const v = num(c?.[field])
    const xy = coordFor(coords, key)
    if (v == null || !xy) { missing++; continue }
    points.push({ key, ...xy, value: v, color: colorFor(v), r: 2.2, label: `${c.city}: ${v}°C${field === 'tempMax' ? ' (today\'s forecast high)' : ''}${c.isCarriedForward ? ' · carried forward' : ''}` })
  }
  return { points, count: points.length, missing, caption: field === 'tempMax' ? `Today's forecast highs for ${points.length} cities (Open-Meteo)` : `Live air temperature for ${points.length} cities (Open-Meteo)` }
}

// ── MODIS latest pass (index.json) ───────────────────────────────────────────
export function modisLatestOverlay({ modisIndex, coords, colorFor }) {
  const points = []
  let missing = 0
  let latest = ''
  for (const [key, c] of Object.entries(modisIndex?.cities || {})) {
    const v = num(c?.latestDay?.c)
    const xy = coordFor(coords, key)
    if (v == null || !xy) { missing++; continue }
    if (c.latestDay.date > latest) latest = c.latestDay.date
    points.push({ key, ...xy, value: v, color: colorFor(v), r: 2.4, label: `${c.city}: surface ${v}°C on ${c.latestDay.date} (clear-sky day pass)` })
  }
  return { points, count: points.length, missing, latest, caption: `Latest clear-sky MODIS day pass per city · ${points.length} cities · most recent ${latest}` }
}

// ── MODIS peak-season mean for one year (yearly-peaks.json, built by
//    scripts/buildModisYearlyPeaks.mjs from the per-state files) ─────────────
export function modisYearOverlay({ yearly, coords, colorFor, year }) {
  const points = []
  let missing = 0
  for (const [key, rows] of Object.entries(yearly?.cities || {})) {
    const y = rows.find(e => e.year === year)
    const v = num(y?.peakDayMean)
    const xy = coordFor(coords, key)
    if (v == null || !xy) { missing++; continue }
    const [city] = key.split('|')
    points.push({ key, ...xy, value: v, color: colorFor(v), r: 3, label: `${city}: ${year} Apr–Jun mean surface ${v}°C (${y.peakDays} clear days; hottest ${y.hottestC}°C on ${y.hottestDate})` })
  }
  return { points, count: points.length, missing, caption: `${year} April–June mean clear-sky surface temperature · ${points.length} cities with a multi-year MODIS record` }
}

// ── MODIS daily pass for one state (state file rows [date, dayC, nightC]) ───
export function modisStateDates(stateFile) {
  const set = new Set()
  for (const rows of Object.values(stateFile?.cities || {})) for (const r of rows) if (r?.[0]) set.add(r[0])
  return [...set].sort()
}

export function modisStateDayOverlay({ stateFile, coords, colorFor, date }) {
  const points = []
  let total = 0
  for (const [key, rows] of Object.entries(stateFile?.cities || {})) {
    total++
    const row = rows.find(r => r[0] === date)
    const v = num(row?.[1])
    const xy = coordFor(coords, key)
    if (v == null || !xy) continue
    const [city] = key.split('|')
    points.push({ key, ...xy, value: v, color: colorFor(v), r: 3.2, label: `${city}: surface ${v}°C day / ${row[2] ?? '—'}°C night on ${date}` })
  }
  return { points, count: points.length, missing: total - points.length, caption: `${stateFile?.state || ''} · ${date} · ${points.length} of ${total} cities had a clear-sky pass` }
}

// ── ESA built-up ─────────────────────────────────────────────────────────────
export function lulcOverlay({ lulcReal }) {
  const points = []
  for (const [name, c] of Object.entries(lulcReal?.cities || {})) {
    const v = num(c?.builtUp); const lat = num(c?.lat); const lon = num(c?.lon)
    if (v == null || lat == null || lon == null) continue
    points.push({ key: `${name}|${c.state}`, lat, lon, value: v, color: builtUpColor(v), r: 3.2, label: `${name}: ${v}% built-up, ${c.vegetation ?? '—'}% vegetation (ESA WorldCover, ~5 km sample)` })
  }
  return { points, count: points.length, missing: 0, caption: `Built-up share within ~5 km of the centre · ${points.length} classified cities (ESA WorldCover 2021)` }
}

// ── State fills that follow the scrubber ────────────────────────────────────
// Re-colours every state from the points currently on the map, with the same rule the live
// map uses: the bucket that the MOST cities fall into wins, ties go to the hotter bucket
// (`buckets` is HEAT_INDEX_BUCKETS, most severe first). States with no point in this layer
// are painted neutral and say so in the tooltip — never carried over from live data.
export const NO_DATA_FILL = '#334155'

function median(values) {
  const a = [...values].sort((x, y) => x - y)
  return a.length ? Math.round(a[Math.floor(a.length / 2)] * 10) / 10 : null
}

export function stateDataFromPoints({ base, points, buckets, kind = 'heat', scrubLabel = '', colorOfValue = null }) {
  const byState = new Map()
  for (const p of points || []) {
    const state = p.key?.split('|')[1]
    if (!state) continue
    if (!byState.has(state)) byState.set(state, [])
    byState.get(state).push(p.value)
  }
  const out = {}
  for (const [name, data] of Object.entries(base || {})) {
    const vals = byState.get(name) || []
    if (!vals.length) {
      out[name] = { ...data, heatIndex: null, heatIndexLive: false, liveCityCount: 0, riskBucket: { label: 'NO DATA', color: NO_DATA_FILL, count: 0, share: 0 }, bucketCounts: [], weatherCondition: null, scrub: { label: scrubLabel, detail: 'no reading in this layer for this state' } }
      continue
    }
    if (kind === 'builtUp') {
      const mean = Math.round(vals.reduce((s, v) => s + v, 0) / vals.length)
      out[name] = { ...data, heatIndex: mean, heatIndexLive: true, liveCityCount: vals.length, riskBucket: { label: `BUILT-UP ${mean}%`, color: builtUpColor(mean), count: vals.length, share: 100 }, bucketCounts: [], weatherCondition: null, scrub: { label: scrubLabel, detail: `mean built-up share of ${vals.length} classified ${vals.length === 1 ? 'city' : 'cities'}`, unit: '%' } }
      continue
    }
    const counts = buckets.map(b => ({ label: b.label, color: b.color, min: b.min, count: 0 }))
    for (const v of vals) { const i = buckets.findIndex(b => v >= b.min); if (i >= 0) counts[i].count++ }
    let best = null
    for (const c of counts) if (!best || c.count > best.count) best = c
    const total = vals.length
    out[name] = {
      ...data,
      heatIndex: median(vals), heatIndexLive: true, liveCityCount: total,
      // colour: the plurality bucket's colour (NDMA tiers) or a continuous colour of the median
      riskBucket: { label: best.label, color: colorOfValue ? colorOfValue(median(vals)) : best.color, min: best.min, count: best.count, share: Math.round((best.count / total) * 100) },
      bucketCounts: counts.map(c => ({ ...c, share: Math.round((c.count / total) * 100) })),
      weatherCondition: null,
      scrub: { label: scrubLabel, detail: `median of ${total} ${total === 1 ? 'city' : 'cities'} with a reading in this layer`, unit: '°C' }
    }
  }
  return out
}

// ── MODIS daily pass, whole country (daily-national.json, built by
//    scripts/buildModisDailyNational.mjs) ────────────────────────────────────
export function modisNationalDayOverlay({ daily, coords, colorFor, dateIdx, lookbackDays = 0 }) {
  const date = daily?.dates?.[dateIdx]
  const points = []
  let total = 0, sameDay = 0, filled = 0
  for (const [key, vals] of Object.entries(daily?.cities || {})) {
    total++
    let v = num(vals?.[dateIdx]); let back = 0
    // Composite: fall back to the most recent clear-sky pass within the look-back window.
    if (v == null && lookbackDays > 0) {
      for (let k = 1; k <= lookbackDays && dateIdx - k >= 0; k++) { const u = num(vals?.[dateIdx - k]); if (u != null) { v = u; back = k; break } }
    }
    const xy = coordFor(coords, key)
    if (v == null || !xy) continue
    if (back) filled++; else sameDay++
    const [city] = key.split('|')
    points.push({ key, ...xy, value: v, color: colorFor(v), r: 2.6, back, label: `${city}: surface ${v}°C on ${back ? daily.dates[dateIdx - back] + ` (last clear-sky pass, ${back} day${back > 1 ? 's' : ''} before)` : date}` })
  }
  const caption = lookbackDays > 0
    ? `${date} · ${sameDay} cities with a clear-sky pass that day, ${filled} shown from their last pass within ${lookbackDays} days, ${total - sameDay - filled} none (cloud)`
    : `${date} · ${sameDay} of ${total} cities had a clear-sky MODIS pass (cloud = no reading)`
  return { points, count: points.length, missing: total - points.length, date, sameDay, filled, caption }
}

// ── Spectral thermal palette (NOAA / Windy style), continuous ───────────────
// Piecewise-linear between the stops below; NDMA bucket LABELS are unchanged — this only
// changes how a temperature is painted. Built-up % keeps its own grey→red ramp.
const SPECTRAL_STOPS = [
  [-10, '#7C3AED'], [10, '#2563EB'], [10.001, '#0284C7'], [20, '#06B6D4'], [20.001, '#14B8A6'], [26, '#10B981'],
  [26.001, '#84CC16'], [32, '#EAB308'], [32.001, '#FACC15'], [37, '#F59E0B'], [37.001, '#F97316'], [41, '#EA580C'],
  [41.001, '#EF4444'], [45, '#DC2626'], [45.001, '#B91C1C'], [50, '#FF003C']
]
const hex2rgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]
const SPECTRAL_RGB = SPECTRAL_STOPS.map(([t, h]) => [t, hex2rgb(h)])
export function spectralRgb(t) {
  if (typeof t !== 'number' || !Number.isFinite(t)) return [51, 65, 85]
  if (t <= SPECTRAL_RGB[0][0]) return SPECTRAL_RGB[0][1]
  if (t >= SPECTRAL_RGB[SPECTRAL_RGB.length - 1][0]) return SPECTRAL_RGB[SPECTRAL_RGB.length - 1][1]
  for (let i = 1; i < SPECTRAL_RGB.length; i++) {
    const [t1, c1] = SPECTRAL_RGB[i]
    if (t <= t1) {
      const [t0, c0] = SPECTRAL_RGB[i - 1]
      const f = t1 === t0 ? 0 : (t - t0) / (t1 - t0)
      return [0, 1, 2].map(k => Math.round(c0[k] + (c1[k] - c0[k]) * f))
    }
  }
  return [51, 65, 85]
}
export function spectralColor(t) {
  const [r, g, b] = spectralRgb(t)
  return `#${[r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')}`
}
export const SPECTRAL_LEGEND = [[-10, '<10'], [10, '10'], [20, '20'], [26, '26'], [32, '32'], [37, '37'], [41, '41'], [45, '45+']]
export function spectralGradientCss() {
  const lo = -10, hi = 50
  return `linear-gradient(90deg, ${SPECTRAL_STOPS.map(([t, h]) => `${h} ${(((t - lo) / (hi - lo)) * 100).toFixed(1)}%`).join(', ')})`
}
