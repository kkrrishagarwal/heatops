// 7-day heatwave outlook from the city's Open-Meteo daily forecast, classified with IMD's
// published heatwave criteria as far as they can be applied without a per-city climatological
// normal (which the project does not have):
//   IMD: heatwave is considered when the maximum reaches ≥ 40 °C in the plains, ≥ 37 °C on the
//   coast, ≥ 30 °C in the hills — AND either the departure from normal is ≥ 4.5 °C (heatwave)
//   / ≥ 6.5 °C (severe), OR the actual maximum is ≥ 45 °C (heatwave) / ≥ 47 °C (severe).
// We can apply the threshold rule and the absolute rule honestly; the departure rule needs a
// normal we don't have, so the outlook labels itself "threshold-based" and never claims to be
// an IMD warning. Two consecutive qualifying days = a heatwave spell (IMD declares on day 2).
export const IMD_RULE = { plains: 40, coast: 37, hills: 30, absolute: 45, severe: 47 }

export function terrainThreshold({ elevation, isCoastal }) {
  if (typeof elevation === 'number' && elevation >= 900) return { kind: 'hills', t: IMD_RULE.hills }
  if (isCoastal) return { kind: 'coast', t: IMD_RULE.coast }
  return { kind: 'plains', t: IMD_RULE.plains }
}

export function classifyDay(maxTemp, threshold) {
  if (typeof maxTemp !== 'number') return { level: 'none', label: 'no forecast' }
  if (maxTemp >= IMD_RULE.severe) return { level: 'severe', label: 'Severe heatwave conditions' }
  if (maxTemp >= IMD_RULE.absolute) return { level: 'heatwave', label: 'Heatwave conditions' }
  if (maxTemp >= threshold.t) return { level: 'watch', label: 'Above IMD threshold — watch' }
  if (maxTemp >= threshold.t - 3) return { level: 'warm', label: 'Warm' }
  return { level: 'normal', label: 'Normal' }
}

// forecast: [{ date, maxTemp, minTemp, ... }] (7 entries from weatherAPI)
export function buildOutlook(forecast, { elevation = null, isCoastal = false } = {}) {
  if (!Array.isArray(forecast) || !forecast.length) return null
  const threshold = terrainThreshold({ elevation, isCoastal })
  const days = forecast.map(d => ({ ...d, ...classifyDay(d.maxTemp, threshold) }))
  // spells: runs of ≥ 2 consecutive days at watch level or worse
  const spells = []
  let run = []
  const flush = () => { if (run.length >= 2) spells.push({ from: run[0].date, to: run[run.length - 1].date, days: run.length, peak: Math.max(...run.map(d => d.maxTemp)), worst: run.some(d => d.level === 'severe') ? 'severe' : run.some(d => d.level === 'heatwave') ? 'heatwave' : 'watch' }); run = [] }
  for (const d of days) { if (['watch', 'heatwave', 'severe'].includes(d.level)) run.push(d); else flush() }
  flush()
  const peak = days.reduce((m, d) => (typeof d.maxTemp === 'number' && (!m || d.maxTemp > m.maxTemp) ? d : m), null)
  const worst = days.some(d => d.level === 'severe') ? 'severe' : days.some(d => d.level === 'heatwave') ? 'heatwave' : days.some(d => d.level === 'watch') ? 'watch' : days.some(d => d.level === 'warm') ? 'warm' : 'normal'
  return { threshold, days, spells, peak, worst }
}

export const LEVEL_COLOR = { severe: '#b91c1c', heatwave: '#c2410c', watch: '#ca8a04', warm: '#4d7c0f', normal: '#15803d', none: '#475569' }
