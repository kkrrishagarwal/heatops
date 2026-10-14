// Human heat stress from air temperature + relative humidity. Pure functions, no network —
// shared by the Heat Stress panel, the action protocol and the Agent37 Co-Pilot payload, so
// every screen shows the same numbers. Each formula is a published, citable method:
//
//   Heat Index   — US NWS (Rothfusz 1990 regression + the NWS low/high-humidity adjustments,
//                  Steadman's simple form below ~80 °F). What "feels like" means in shade.
//   Wet-bulb     — Stull (2011), "Wet-Bulb Temperature from Relative Humidity and Air
//                  Temperature", J. Appl. Meteor. Climatol. 50, 2267–2269. Valid for
//                  RH 5–99 %, T −20…50 °C; error within about ±1 °C.
//   WBGT (est.)  — ISO 7243 shade/indoor definition, WBGT = 0.7·Tnw + 0.3·Tg, with the
//                  natural wet-bulb Tnw taken as the Stull wet-bulb and the globe temperature
//                  Tg taken as air temperature (true in shade). No weather API provides globe
//                  (radiant) temperature, so in full sun the real WBGT is higher — the value is
//                  labelled "shade estimate", a floor for outdoor exposure, not a ceiling.
//                  (The Australian BoM shortcut 0.567·T + 0.393·e + 3.94 was tried and
//                  rejected: it reads ~5 °C high in hot, dry air — 37.9 °C at 46 °C / 20 % RH.)
//   Work / rest  — US Army TB MED 507 heat categories (moderate work, acclimatised).
//
// Inputs are °C and % RH. Every function returns null on unusable input instead of NaN, so
// the UI can say "no reading" rather than print garbage.

const num = v => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const cToF = c => c * 9 / 5 + 32
const fToC = f => (f - 32) * 5 / 9
const round1 = v => Math.round(v * 10) / 10

// ── Heat Index (NWS) ──────────────────────────────────────────────────────────
// Returns every intermediate value so the panel can show the working, not just the answer.
export function heatIndexSteps(tempC, rh) {
  const T0 = num(tempC); const R = num(rh)
  if (T0 == null || R == null || R < 0 || R > 100) return null
  const T = cToF(T0)
  const simpleF = 0.5 * (T + 61 + (T - 68) * 1.2 + R * 0.094)
  if ((simpleF + T) / 2 < 80) return { tF: round1(T), rh: R, method: 'simple', simpleF: round1(simpleF), regressionF: null, adjustment: null, adjustmentF: 0, hiF: round1(simpleF), hiC: round1(fToC(simpleF)), offChart: false }
  const reg = -42.379 + 2.04901523 * T + 10.14333127 * R - 0.22475541 * T * R
    - 0.00683783 * T * T - 0.05481717 * R * R + 0.00122874 * T * T * R
    + 0.00085282 * T * R * R - 0.00000199 * T * T * R * R
  let adj = 0, adjustment = null
  if (R < 13 && T >= 80 && T <= 112) { adj = -((13 - R) / 4) * Math.sqrt((17 - Math.abs(T - 95)) / 17); adjustment = 'low-humidity' }
  else if (R > 85 && T >= 80 && T <= 87) { adj = ((R - 85) / 10) * ((87 - T) / 5); adjustment = 'high-humidity' }
  const hiF = reg + adj
  // The NWS table stops at 135 °F (57 °C): beyond it the regression is extrapolating, so the
  // UI shows "off the chart" rather than a falsely precise number.
  return { tF: round1(T), rh: R, method: 'rothfusz', simpleF: round1(simpleF), regressionF: round1(reg), adjustment, adjustmentF: round1(adj), hiF: round1(hiF), hiC: round1(fToC(hiF)), offChart: hiF > 135 }
}
export function heatIndexC(tempC, rh) {
  return heatIndexSteps(tempC, rh)?.hiC ?? null
}

// NWS Heat Index bands (80 / 90 / 103 / 125 °F).
export const HEAT_INDEX_BANDS = [
  { min: 51.7, key: 'extreme-danger', label: 'Extreme Danger', color: '#991b1b', effect: 'Heat stroke highly likely.' },
  { min: 39.4, key: 'danger', label: 'Danger', color: '#dc2626', effect: 'Heat cramps or exhaustion likely; heat stroke possible with prolonged exposure or activity.' },
  { min: 32.2, key: 'extreme-caution', label: 'Extreme Caution', color: '#ea580c', effect: 'Heat cramps or exhaustion possible with prolonged exposure or activity.' },
  { min: 26.7, key: 'caution', label: 'Caution', color: '#f59e0b', effect: 'Fatigue possible with prolonged exposure or activity.' },
  { min: -Infinity, key: 'none', label: 'Below Caution', color: '#15803d', effect: 'No heat-index warning level.' }
]
export function heatIndexBand(hiC) {
  return num(hiC) == null ? null : HEAT_INDEX_BANDS.find(b => hiC >= b.min)
}

// ── Wet-bulb temperature (Stull 2011) ────────────────────────────────────────
export function wetBulbC(tempC, rh) {
  const T = num(tempC); const R = num(rh)
  if (T == null || R == null || R < 0 || R > 100) return null
  const Rc = Math.min(99, Math.max(5, R)) // formula's validity range
  const tw = T * Math.atan(0.151977 * Math.sqrt(Rc + 8.313659))
    + Math.atan(T + Rc) - Math.atan(Rc - 1.676331)
    + 0.00391838 * Math.pow(Rc, 1.5) * Math.atan(0.023101 * Rc) - 4.686035
  return round1(tw)
}

// ── WBGT estimate (ISO 7243, shade) ─────────────────────────────────────────
export function wbgtShadeC(tempC, rh) {
  const tw = wetBulbC(tempC, rh)
  if (tw == null) return null
  return round1(0.7 * tw + 0.3 * tempC)
}

// TB MED 507 heat categories (78 / 82 / 85 / 88 / 90 °F WBGT) with the moderate-work
// work/rest cycle per hour and water per hour.
export const WBGT_CATEGORIES = [
  { min: 32.2, cat: 5, flag: 'Black', label: 'Extreme', color: '#111827', ring: '#f87171', workRest: '20 min work / 40 min rest', water: '1 L per hour' },
  { min: 31.1, cat: 4, flag: 'Red', label: 'Very high', color: '#dc2626', ring: '#dc2626', workRest: '30 min work / 30 min rest', water: '0.75 L per hour' },
  { min: 29.4, cat: 3, flag: 'Yellow', label: 'High', color: '#f59e0b', ring: '#f59e0b', workRest: '40 min work / 20 min rest', water: '0.75 L per hour' },
  { min: 27.8, cat: 2, flag: 'Green', label: 'Moderate', color: '#16a34a', ring: '#16a34a', workRest: '50 min work / 10 min rest', water: '0.75 L per hour' },
  { min: 25.6, cat: 1, flag: 'White', label: 'Low', color: '#e2e8f0', ring: '#94a3b8', workRest: 'No limit', water: '0.75 L per hour' },
  { min: -Infinity, cat: 0, flag: 'None', label: 'Below heat category', color: '#334155', ring: '#475569', workRest: 'No limit', water: 'Drink to thirst' }
]
export function wbgtCategory(wbgtC) {
  return num(wbgtC) == null ? null : WBGT_CATEGORIES.find(c => wbgtC >= c.min)
}

// Everything for one (temp, RH) reading.
export function computeHeatStress(tempC, rh) {
  const hi = heatIndexC(tempC, rh)
  if (hi == null) return null
  const wbgt = wbgtShadeC(tempC, rh)
  return {
    temp: tempC,
    rh,
    heatIndex: hi,
    heatIndexBand: heatIndexBand(hi),
    wetBulb: wetBulbC(tempC, rh),
    wbgt,
    wbgtCategory: wbgtCategory(wbgt)
  }
}

// Current reading + the worst hour of the next 24 h (by WBGT) from the useWeather shape.
// On a ?demo override the hourly series is still the real forecast, so the peak is skipped
// rather than mixing a forced temperature with real hourly values.
export function assessHeatStress(liveWeather) {
  const c = liveWeather?.current
  const now = c ? computeHeatStress(c.temp, c.humidity) : null
  let peak = null
  if (liveWeather?.demoOverride == null && Array.isArray(liveWeather?.hourly)) {
    for (const h of liveWeather.hourly) {
      const s = computeHeatStress(h.temp, h.humidity)
      if (s && (!peak || s.wbgt > peak.wbgt)) peak = { ...s, time: h.time }
    }
  }
  return { now, peak, demo: liveWeather?.demoOverride != null }
}
