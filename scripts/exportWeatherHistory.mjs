// Export the historic weather snapshots (public/data/history/) to CSV for Excel / Sheets /
// pandas. Reads the files directly — no server or database needed.
//
//   node scripts/exportWeatherHistory.mjs                       → history-all.csv (every city, every day)
//   node scripts/exportWeatherHistory.mjs "New Delhi" Delhi      → history-New_Delhi.csv (one city)
//   node scripts/exportWeatherHistory.mjs --state Rajasthan      → history-Rajasthan.csv (one state's cities)
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { HISTORY_DIR, expandSnapshot } from '../api/_lib/weatherHistory.js'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const dir = path.join(root, HISTORY_DIR)
const index = JSON.parse(fs.readFileSync(path.join(dir, 'index.json'), 'utf8'))

const args = process.argv.slice(2)
const stateOnly = args[0] === '--state' ? args[1] : null
const cityFilter = !stateOnly && args[0] ? args[0].toLowerCase() : null
const stateFilter = !stateOnly && args[1] ? args[1].toLowerCase() : null

const q = v => (v === null || v === undefined) ? '' : `"${String(v).replace(/"/g, '""')}"`
const lines = ['date,observed_at,city,state,temp_c,rain_chance_pct,aqi,cloud_cover_pct,pm10,carried_forward']
let rows = 0
for (const day of index.days) {
  const snap = JSON.parse(fs.readFileSync(path.join(dir, day.file), 'utf8'))
  const { cities } = expandSnapshot(snap)
  for (const c of Object.values(cities)) {
    if (stateOnly && c.state.toLowerCase() !== stateOnly.toLowerCase()) continue
    if (cityFilter && c.city.toLowerCase() !== cityFilter) continue
    if (stateFilter && c.state.toLowerCase() !== stateFilter) continue
    const carried = c.isCarriedForward ? (c.carriedForwardSource === 'inferred' ? 'yes (inferred)' : 'yes') : 'no'
    lines.push([day.date, snap.lastUpdated, c.city, c.state, c.temp, c.rainChance, c.aqi, c.cloudCover, c.pm10, carried].map(q).join(','))
    rows++
  }
}
const name = stateOnly ? `history-${stateOnly.replace(/\s+/g, '_')}.csv` : cityFilter ? `history-${args[0].replace(/\s+/g, '_')}.csv` : 'history-all.csv'
fs.writeFileSync(path.join(root, name), lines.join('\n') + '\n')
console.log(`Wrote ${rows} rows (${index.days.length} days) → ${name}`)
