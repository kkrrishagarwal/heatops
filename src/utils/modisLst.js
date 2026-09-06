// Client-side access to the processed NASA MODIS land-surface-temperature files
// (public/data/modis-lst/, built by scripts/processModisLst.mjs). Shared by the Analysis
// tab's satellite panel and by AGNI's grounding context, so the AI sees exactly the numbers
// the panel shows — never a paraphrase.
import { fetchJson } from './fetchJson'

let indexPromise = null
export function loadModisIndex() {
  if (!indexPromise) {
    indexPromise = fetchJson('/data/modis-lst/index.json', { timeoutMs: 20000 }).catch(err => { indexPromise = null; throw err })
  }
  return indexPromise
}

const stateFiles = new Map()
export function loadModisStateFile(file) {
  if (!stateFiles.has(file)) {
    stateFiles.set(file, fetchJson(`/data/modis-lst/${file}`, { timeoutMs: 20000 }).catch(err => { stateFiles.delete(file); throw err }))
  }
  return stateFiles.get(file)
}

// Summary for one city, or null when the city has no quality-passed reading / file missing.
export async function getModisSummary(city, state) {
  if (!city || !state) return null
  try {
    const idx = await loadModisIndex()
    const s = idx?.cities?.[`${city}|${state}`]
    return s ? { ...s, meta: idx.meta } : null
  } catch {
    return null
  }
}

// One compact sentence for AGNI's context. Surface ≠ air is stated inline so the model
// never presents a rooftop temperature as the weather.
export function modisContextLine(summary) {
  if (!summary) return ''
  const r = summary.meta?.dateRange
  const parts = []
  if (summary.latestDay) parts.push(`latest clear-sky DAY surface ${summary.latestDay.c}°C on ${summary.latestDay.date} (~10:30 IST)`)
  if (summary.latestNight) parts.push(`latest NIGHT surface ${summary.latestNight.c}°C on ${summary.latestNight.date}`)
  if (summary.hottestDay) parts.push(`season's hottest surface ${summary.hottestDay.c}°C on ${summary.hottestDay.date}`)
  if (summary.meanDay != null) parts.push(`season mean day/night surface ${summary.meanDay}/${summary.meanNight}°C over ${summary.clearDays} clear days`)
  return ` NASA MODIS satellite land-SURFACE temperature for ${summary.city} (MOD11A1, 1 km, ${r ? `${r.from} to ${r.to}` : 'this season'}; surface ≠ air temperature, cloud days excluded): ${parts.join('; ')}.`
}
