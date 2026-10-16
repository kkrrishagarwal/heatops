// Collapses the per-state MODIS files' `yearly` summaries into one small file for the Command
// Center's Historical scrubber: { generatedAt, source, cities: { "City|State": [{ year,
// peakDayMean, peakDays, hottestC, hottestDate }] } }. Only years with a peakDayMean (≥ 10
// clear April–June days) are kept — nothing is interpolated. Re-run after processModisLst.mjs.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const dir = 'public/data/modis-lst'
const out = { generatedAt: new Date().toISOString(), source: 'NASA LP DAAC MOD11A1.061 via AppEEARS; April–June mean of clear-sky day LST per year (scripts/processModisLst.mjs)', cities: {} }
let years = 0
for (const f of readdirSync(dir)) {
  if (!f.endsWith('.json') || f === 'index.json' || f === 'yearly-peaks.json') continue
  const j = JSON.parse(readFileSync(join(dir, f), 'utf8'))
  for (const [key, rows] of Object.entries(j.yearly || {})) {
    const kept = rows.filter(r => typeof r.peakDayMean === 'number').map(r => ({ year: r.year, peakDayMean: r.peakDayMean, peakDays: r.peakDays, hottestC: r.hottest?.c ?? null, hottestDate: r.hottest?.date ?? null }))
    if (kept.length) { out.cities[key] = kept; years += kept.length }
  }
}
writeFileSync(join(dir, 'yearly-peaks.json'), JSON.stringify(out))
console.log(`yearly-peaks.json: ${Object.keys(out.cities).length} cities, ${years} city-years`)
