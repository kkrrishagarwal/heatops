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

export function stateDataFromPoints({ base, points, buckets, kind = 'heat', scrubLabel = '' }) {
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
      riskBucket: { label: best.label, color: best.color, min: best.min, count: best.count, share: Math.round((best.count / total) * 100) },
      bucketCounts: counts.map(c => ({ ...c, share: Math.round((c.count / total) * 100) })),
      weatherCondition: null,
      scrub: { label: scrubLabel, detail: `median of ${total} ${total === 1 ? 'city' : 'cities'} with a reading in this layer`, unit: '°C' }
    }
  }
  return out
}

// ── MODIS daily pass, whole country (daily-national.json, built by
//    scripts/buildModisDailyNational.mjs) ────────────────────────────────────
export function modisNationalDayOverlay({ daily, coords, colorFor, dateIdx }) {
  const date = daily?.dates?.[dateIdx]
  const points = []
  let total = 0
  for (const [key, vals] of Object.entries(daily?.cities || {})) {
    total++
    const v = num(vals?.[dateIdx])
    const xy = coordFor(coords, key)
    if (v == null || !xy) continue
    const [city] = key.split('|')
    points.push({ key, ...xy, value: v, color: colorFor(v), r: 2.6, label: `${city}: surface ${v}°C on ${date} (clear-sky day pass)` })
  }
  return { points, count: points.length, missing: total - points.length, date, caption: `${date} · ${points.length} of ${total} cities had a clear-sky MODIS pass (cloud = no reading)` }
}
