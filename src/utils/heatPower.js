// Heat + Power Intelligence — data access and the illustrative demand model.
//
// WHAT IS REAL
//   • Weather: Open-Meteo hourly temperature and shortwave (solar) radiation, 7-day daily
//     max/min and radiation sums — FORECAST.
//   • Grid infrastructure geometry: OpenStreetMap (power=substation, power=line, landuse=
//     industrial) via Overpass — community-mapped, not live loading. Pre-built per city in
//     public/data/osm-grid.json (scripts/fetchOsmGrid.mjs) or fetched live; UNAVAILABLE if both fail.
// WHAT IS NOT AVAILABLE (no authorised feed in this project)
//   • Real-time electricity demand / load (SLDC, DISCOM), substation loading and capacity
//     (SCADA), feeder outages. These are shown as UNAVAILABLE, never estimated as "live".
// THE MODEL (ESTIMATE — illustrative, not a validated load forecast)
//   Every number it produces is driven by stated, editable assumptions (ASSUMPTIONS below) and
//   by an officer-entered reference peak and capacity. With the defaults those two are DEMO
//   values, and the UI labels results DEMO until the officer enters their own.
import { fetchJson } from './fetchJson.js'

export const ASSUMPTIONS = {
  sensitivityPctPerC: 3,   // % change in evening peak per °C of daily maximum (editable, 1–6)
  coolingShare: 0.35,      // share of the evening peak that is space cooling (assumption)
  middayFactor: 0.9,       // midday gross demand as a share of the evening peak (assumption)
  performanceRatio: 0.78,  // solar PV output ÷ (installed MW × GHI/1000) (typical PR, assumption)
  coolingBaseC: 24,        // cooling-degree base temperature (BEE default AC set-point is 24 °C)
  eveningWindow: [18, 21], // hours treated as the evening peak window
}
// DEMO defaults: shown labelled DEMO until the officer enters real figures for their network.
export const DEMO_INPUTS = { referencePeakMW: 1000, capacityMW: 1200, solarMW: 150 }

const n = v => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
const round = (v, d = 0) => (v == null ? null : Math.round(v * 10 ** d) / 10 ** d)

// Hourly cooling-behaviour weights (share of cooling equipment switched on, 0–1): offices
// in the afternoon, homes in the evening and night. Assumption, shown in the UI.
export const COOLING_PROFILE = [0.55, 0.5, 0.45, 0.42, 0.4, 0.38, 0.35, 0.35, 0.4, 0.5, 0.6, 0.7, 0.78, 0.82, 0.85, 0.85, 0.82, 0.8, 0.88, 0.95, 1.0, 0.98, 0.85, 0.7]

export function stressClass(utilisation) {
  if (utilisation == null) return { key: 'na', label: 'Unknown', color: '#93A4B8' }
  if (utilisation >= 1) return { key: 'overload', label: 'Overload risk', color: '#EF4444' }
  if (utilisation >= 0.95) return { key: 'critical', label: 'Critical', color: '#EF4444' }
  if (utilisation >= 0.8) return { key: 'high', label: 'High', color: '#F59E0B' }
  return { key: 'normal', label: 'Normal', color: '#10B981' }
}

// Scenario: reference peak MW was observed on a day with maximum `refTempC`.
export function simulate({ referencePeakMW, capacityMW, solarMW, refTempC, tempIncreaseC = 0, acIncreasePct = 0, solarDecreasePct = 0, sensitivityPctPerC = ASSUMPTIONS.sensitivityPctPerC, dayMaxC = null }) {
  const A = ASSUMPTIONS
  const ref = n(referencePeakMW), cap = n(capacityMW), sol = n(solarMW) ?? 0
  if (ref == null || ref <= 0) return null
  const tMax = (n(dayMaxC) ?? n(refTempC) ?? 0) + tempIncreaseC
  const dT = n(refTempC) == null ? tempIncreaseC : tMax - refTempC
  const tempFactor = Math.max(0.5, 1 + (sensitivityPctPerC / 100) * dT)
  const coolingBoost = 1 + A.coolingShare * (acIncreasePct / 100)
  const evening = ref * tempFactor * coolingBoost
  const middayGross = evening * A.middayFactor
  const solarNoon = sol * A.performanceRatio * 0.9 * (1 - solarDecreasePct / 100) // ~900 W/m² clear-sky noon
  const middayNet = middayGross - solarNoon
  const peak = Math.max(evening, middayNet)
  const util = cap ? peak / cap : null
  return {
    tMax: round(tMax, 1), evening: round(evening), middayGross: round(middayGross), solarNoon: round(solarNoon), middayNet: round(middayNet), peak: round(peak),
    peakWhen: evening >= middayNet ? 'evening (18:00–21:00)' : 'afternoon (net of solar)',
    changePct: round(((peak - ref) / ref) * 100, 1), deltaMW: round(peak - ref), utilisation: util, stress: stressClass(util),
    headroomMW: cap ? round(cap - peak) : null
  }
}

// Diurnal curves for one day from hourly forecast weather: solar generation and the cooling
// part of demand (MW). Solar = installed MW × GHI/1000 × PR. Cooling = cooling share of the
// projected evening peak, shaped by cooling-degree hours × the behaviour profile.
export function diurnal({ hours, referencePeakMW, solarMW, refTempC, tempIncreaseC = 0, acIncreasePct = 0, solarDecreasePct = 0, sensitivityPctPerC }) {
  const A = ASSUMPTIONS
  if (!hours?.length) return []
  const sim = simulate({ referencePeakMW, capacityMW: null, solarMW, refTempC, tempIncreaseC, acIncreasePct, solarDecreasePct, sensitivityPctPerC, dayMaxC: Math.max(...hours.map(h => h.temp ?? -99)) })
  const coolingPeakMW = sim ? sim.evening * A.coolingShare : 0
  const raw = hours.map((h, i) => Math.max(0, (h.temp ?? 0) + tempIncreaseC - A.coolingBaseC) * COOLING_PROFILE[i % 24])
  const max = Math.max(...raw, 0.0001)
  return hours.map((h, i) => ({
    hour: i, label: `${String(i % 24).padStart(2, '0')}:00`,
    temp: round((h.temp ?? 0) + tempIncreaseC, 1), ghi: h.ghi,
    solar: round((solarMW || 0) * ((h.ghi || 0) / 1000) * A.performanceRatio * (1 - solarDecreasePct / 100)),
    cooling: round((raw[i] / max) * coolingPeakMW)
  }))
}

// Heat Impact Score (0–100, RULE-BASED). Components, each scaled 0–1, with weights:
export const IMPACT_WEIGHTS = [
  { key: 'tmax', label: 'Forecast maximum', w: 0.35, scale: v => clamp((v - 30) / 15, 0, 1), unit: '°C', range: '30 → 45 °C' },
  { key: 'tmin', label: 'Night minimum', w: 0.2, scale: v => clamp((v - 22) / 10, 0, 1), unit: '°C', range: '22 → 32 °C' },
  { key: 'lst', label: 'Satellite surface temp', w: 0.15, scale: v => clamp((v - 35) / 20, 0, 1), unit: '°C', range: '35 → 55 °C' },
  { key: 'built', label: 'Built-up share', w: 0.15, scale: v => clamp(v / 80, 0, 1), unit: '%', range: '0 → 80 %' },
  { key: 'util', label: 'Scenario grid utilisation', w: 0.15, scale: v => clamp((v - 0.6) / 0.4, 0, 1), unit: '×', range: '60 → 100 %' }
]
export function heatImpactScore(values) {
  let sum = 0, wsum = 0
  const parts = IMPACT_WEIGHTS.map(c => {
    const v = n(values[c.key])
    if (v == null) return { ...c, value: null, contribution: null }
    const s = c.scale(v); sum += s * c.w; wsum += c.w
    return { ...c, value: v, contribution: round(s * c.w * 100, 1) }
  })
  // Missing components are left out and the remaining weights re-normalised; the UI lists which.
  return { score: wsum ? Math.round((sum / wsum) * 100) : null, parts, coverage: round(wsum, 2) }
}

// ── Weather (Open-Meteo, one request per city, cached 30 min) ───────────────────────────────
const wxCache = new Map()
export function fetchPowerWeather(lat, lon) {
  const key = `${lat.toFixed(3)},${lon.toFixed(3)}`
  const hit = wxCache.get(key)
  if (hit && Date.now() - hit.at < 30 * 60e3) return hit.p
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,shortwave_radiation&daily=temperature_2m_max,temperature_2m_min,shortwave_radiation_sum&forecast_days=7&timezone=Asia/Kolkata`
  const p = fetchJson(url, { timeoutMs: 15000 }).then(j => {
    const h = j?.hourly, d = j?.daily
    if (!h?.time?.length || !d?.time?.length) throw new Error('no forecast in response')
    const hours = h.time.map((t, i) => ({ time: t, temp: n(h.temperature_2m?.[i]), ghi: n(h.shortwave_radiation?.[i]) }))
    const days = d.time.map((t, i) => ({ date: t, max: n(d.temperature_2m_max?.[i]), min: n(d.temperature_2m_min?.[i]), solarSum: n(d.shortwave_radiation_sum?.[i]), hours: hours.slice(i * 24, i * 24 + 24) }))
    return { days, fetchedAt: Date.now() }
  }).catch(e => { wxCache.delete(key); throw e })
  wxCache.set(key, { at: Date.now(), p })
  return p
}

// ── Grid infrastructure (OpenStreetMap) ───────────────────────────────────────────────────
const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter']
export const GRID_RADIUS_M = 15000
export function overpassQuery(lat, lon, r = GRID_RADIUS_M) {
  return `[out:json][timeout:25];(nwr["power"="substation"](around:${r},${lat},${lon});way["power"="line"](around:${r},${lat},${lon});way["landuse"="industrial"](around:${r},${lat},${lon}););out tags geom qt 1500;`
}
const ringArea = pts => { // km², equirectangular approximation (fine at city scale)
  if (!pts || pts.length < 3) return 0
  const lat0 = pts.reduce((s, p) => s + p.lat, 0) / pts.length, kx = 111.32 * Math.cos(lat0 * Math.PI / 180), ky = 110.57
  let a = 0
  for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += (p.lon * kx) * (q.lat * ky) - (q.lon * kx) * (p.lat * ky) }
  return Math.abs(a) / 2
}
const centroid = pts => ({ lat: pts.reduce((s, p) => s + p.lat, 0) / pts.length, lon: pts.reduce((s, p) => s + p.lon, 0) / pts.length })
const kv = v => { const m = /(\d+)/.exec(String(v || '').split(';')[0]); return m ? Math.round(parseInt(m[1], 10) / 1000) : null }

// Overpass JSON → { substations, lines, industrial } (plain objects, geometry as lat/lon).
export function parseOverpassGrid(json) {
  const substations = [], lines = [], industrial = []
  for (const e of json?.elements || []) {
    const t = e.tags || {}
    const geom = e.geometry?.map(g => ({ lat: g.lat, lon: g.lon })) || (e.type === 'node' ? [{ lat: e.lat, lon: e.lon }] : null)
    if (!geom?.length) continue
    if (t.power === 'substation') substations.push({ id: `${e.type}/${e.id}`, name: t.name || null, voltageKV: kv(t.voltage), operator: t.operator || null, ...centroid(geom) })
    else if (t.power === 'line') lines.push({ id: `way/${e.id}`, voltageKV: kv(t.voltage), name: t.name || null, path: geom })
    else if (t.landuse === 'industrial') industrial.push({ id: `way/${e.id}`, name: t.name || null, areaKm2: round(ringArea(geom), 2), ...centroid(geom), ring: geom })
  }
  industrial.sort((a, b) => b.areaKm2 - a.areaKm2)
  return { substations, lines, industrial }
}

let gridManifest = null
function loadGridManifest() {
  if (!gridManifest) gridManifest = fetch('/data/osm-grid.json').then(r => (r.ok ? r.json() : null)).catch(() => null)
  return gridManifest
}
const gridCache = new Map()
export function fetchGrid({ city, state, lat, lon }) {
  const key = `${city}|${state}`
  if (gridCache.has(key)) return gridCache.get(key)
  const p = (async () => {
    const m = await loadGridManifest()
    const pre = m?.cities?.[key]
    if (pre?.grid) return { ...pre.grid, source: 'prebuilt', fetchedAt: pre.fetchedAt }
    const q = overpassQuery(lat, lon)
    let lastErr = null
    for (const url of OVERPASS) {
      const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 30000)
      try {
        const r = await fetch(url, { method: 'POST', body: new URLSearchParams({ data: q }), signal: ctl.signal })
        if (!r.ok) throw new Error(`Overpass HTTP ${r.status}`)
        return { ...parseOverpassGrid(await r.json()), source: 'live', fetchedAt: new Date().toISOString() }
      } catch (e) { lastErr = e.name === 'AbortError' ? new Error('Overpass timed out') : e } finally { clearTimeout(t) }
    }
    throw lastErr || new Error('Overpass unavailable')
  })().catch(e => { gridCache.delete(key); throw e })
  gridCache.set(key, p)
  return p
}

// GeoJSON overlay features for the map, following the layer toggles.
export function gridOverlay(grid, { substations = true, lines = true, industrial = true } = {}) {
  if (!grid) return { features: [] }
  const f = []
  if (industrial) for (const z of grid.industrial.slice(0, 120)) f.push({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [z.ring.map(p => [p.lon, p.lat])] }, properties: { kind: 'industrial', color: '#A855F7', weight: 0.8, fillOpacity: 0.22, label: `<b>${z.name || 'Industrial land'}</b><br>${z.areaKm2} km² · OpenStreetMap landuse=industrial` } })
  if (lines) for (const l of grid.lines) f.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: l.path.map(p => [p.lon, p.lat]) }, properties: { kind: 'line', color: l.voltageKV >= 220 ? '#38BDF8' : '#3B82F6', weight: l.voltageKV >= 220 ? 2 : 1.2, opacity: 0.85, label: `<b>Transmission line</b>${l.voltageKV ? ` · ${l.voltageKV} kV` : ''}${l.name ? `<br>${l.name}` : ''}<br><span class="t-muted">OpenStreetMap geometry · loading not available</span>` } })
  if (substations) for (const s of grid.substations) f.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [s.lon, s.lat] }, properties: { kind: 'substation', color: '#F59E0B', radius: s.voltageKV >= 220 ? 6 : 4, label: `<b>${s.name || 'Substation'}</b>${s.voltageKV ? ` · ${s.voltageKV} kV` : ''}${s.operator ? `<br>${s.operator}` : ''}<br><span class="t-muted">OpenStreetMap · loading UNAVAILABLE (no SCADA feed)</span>` } })
  return { features: f }
}
