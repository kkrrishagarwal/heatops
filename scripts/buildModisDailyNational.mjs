// Collapses the 36 per-state MODIS files' daily rows into one compact national file for the
// Command Center's Live Pass scrubber, so any date recolours every state at once:
//   { generatedAt, source, dates: ["2026-03-01", …], cities: { "City|State": [dayC|null, …] } }
// One slot per date per city; null = no quality-passed (clear-sky) pass that day. Nothing is
// interpolated. Re-run after processModisLst.mjs.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const dir = 'public/data/modis-lst'
const dateSet = new Set()
const perCity = {}
for (const f of readdirSync(dir)) {
  if (!f.endsWith('.json') || ['index.json', 'yearly-peaks.json', 'daily-national.json'].includes(f)) continue
  const j = JSON.parse(readFileSync(join(dir, f), 'utf8'))
  for (const [key, rows] of Object.entries(j.cities || {})) {
    const m = {}
    for (const r of rows) if (r?.[0] && typeof r[1] === 'number') { m[r[0]] = r[1]; dateSet.add(r[0]) }
    perCity[key] = m
  }
}
const dates = [...dateSet].sort()
const cities = {}
let readings = 0
for (const [key, m] of Object.entries(perCity)) {
  cities[key] = dates.map(d => (typeof m[d] === 'number' ? Math.round(m[d] * 10) / 10 : null))
  readings += Object.keys(m).length
}
const out = { generatedAt: new Date().toISOString(), source: 'NASA LP DAAC MOD11A1.061 via AppEEARS; daytime clear-sky LST per city per day (scripts/processModisLst.mjs)', dates, cities }
writeFileSync(join(dir, 'daily-national.json'), JSON.stringify(out))
console.log(`daily-national.json: ${dates.length} dates × ${Object.keys(cities).length} cities, ${readings} clear-sky readings`)
