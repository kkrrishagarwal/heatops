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
