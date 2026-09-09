// Converts NASA AppEEARS point-sample CSVs (MOD11A1.061 — Terra MODIS daily 1 km land-surface
// temperature) into the compact JSON the Analysis tab reads.
//
//   node scripts/processModisLst.mjs
//
// Input : scripts/data/nasa/raw/*.csv   (raw AppEEARS results, git-ignored: ~70 MB each)
// Output: public/data/modis-lst/index.json         one summary per city
//         public/data/modis-lst/<state-slug>.json  daily series for that state's cities
//
// Honesty rules baked in:
// - Only readings that pass MODIS's own QC are kept: MODLAND flag 00 (good) or 01 (other
//   quality) AND LST-error flag ≤ 2 K (00 or 01). Cloud-blocked days (value 0 / MODLAND 10)
//   are dropped, never interpolated — the chart shows gaps.
// - Kelvin → °C exactly (K − 273.15), one decimal. The CSV is already scaled by AppEEARS.
// - City matching is exact: the AppEEARS ID is City+State with punctuation removed, which is
//   how the point file was built from src/data/cityCoordinates.json. Unmatched IDs are reported,
//   never guessed.
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const RAW_DIR = path.join(__dirname, 'data/nasa/raw')
const OUT_DIR = path.join(__dirname, '../public/data/modis-lst')
const COORDS = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/data/cityCoordinates.json'), 'utf8'))

const norm = s => String(s || '').replace(/[^A-Za-z0-9]/g, '')
const keyById = {}
for (const key of Object.keys(COORDS)) {
  const [city, state] = key.split('|')
  keyById[norm(city) + norm(state)] = key
}
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
const toC = k => Math.round((k - 273.15) * 10) / 10
const qcOk = (modland, err) => (modland === '0b00' || modland === '0b01') && (err === '0b00' || err === '0b01')

// Minimal CSV parser (fields with commas are quoted — the QC description columns).
function parseCsvLine(line) {
  const out = []; let cur = ''; let q = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') { q = !q; continue }
    if (ch === ',' && !q) { out.push(cur); cur = ''; continue }
    cur += ch
  }
  out.push(cur); return out
}

const files = fs.existsSync(RAW_DIR) ? fs.readdirSync(RAW_DIR).filter(f => f.endsWith('.csv')) : []
if (!files.length) { console.error(`no CSVs in ${RAW_DIR}`); process.exit(1) }

const perCity = {}      // key -> { [date]: { d, n } }
const unmatched = new Set()
let rows = 0, kept = 0, minDate = '9999', maxDate = '0000'
for (const f of files) {
  const text = fs.readFileSync(path.join(RAW_DIR, f), 'utf8')
  const lines = text.split(/\r?\n/).filter(Boolean)
  const header = parseCsvLine(lines[0])
  const col = name => header.indexOf(name)
  const iId = col('ID'), iDate = col('Date')
  const iDay = col('MOD11A1_061_LST_Day_1km'), iNight = col('MOD11A1_061_LST_Night_1km')
  const iDM = col('MOD11A1_061_QC_Day_MODLAND'), iDE = col('MOD11A1_061_QC_Day_LST_Error_Flag')
  const iNM = col('MOD11A1_061_QC_Night_MODLAND'), iNE = col('MOD11A1_061_QC_Night_LST_Error_Flag')
  for (let li = 1; li < lines.length; li++) {
    const c = parseCsvLine(lines[li]); rows++
    const key = keyById[c[iId]]
    if (!key) { unmatched.add(c[iId]); continue }
    const date = c[iDate]
    const dayK = parseFloat(c[iDay]), nightK = parseFloat(c[iNight])
    const d = dayK > 0 && qcOk(c[iDM], c[iDE]) ? toC(dayK) : null
    const n = nightK > 0 && qcOk(c[iNM], c[iNE]) ? toC(nightK) : null
    if (d === null && n === null) continue
    kept++
    if (date < minDate) minDate = date
    if (date > maxDate) maxDate = date
    ;(perCity[key] ||= {})[date] = { d, n }
  }
  console.log(`${f}: ${lines.length - 1} rows`)
}

// Yearly summaries per city from everything loaded (the 2016–2026 request covers 171
// cities; the two 2026 requests cover the rest for this year only). Peak-season = April–June,
// the months a heat officer cares about; a year needs ≥ 10 clear peak-season days to count.
const SEASON_START = '2026-03-01' // the season series shown on the chart is 2026 only
const yearly = {}
for (const [key, days] of Object.entries(perCity)) {
  const byYear = {}
  for (const [date, v] of Object.entries(days)) {
    const y = date.slice(0, 4), m = +date.slice(5, 7)
    const b = (byYear[y] ||= { day: [], night: [], peakDay: [], peakNight: [], hottest: null })
    if (v.d !== null) { b.day.push(v.d); if (m >= 4 && m <= 6) b.peakDay.push(v.d); if (!b.hottest || v.d > b.hottest.c) b.hottest = { date, c: v.d } }
    if (v.n !== null) { b.night.push(v.n); if (m >= 4 && m <= 6) b.peakNight.push(v.n) }
  }
  const mean = a => (a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length * 10) / 10 : null)
  const rows = Object.entries(byYear).sort().map(([year, b]) => ({ year: +year, clearDays: b.day.length, peakDays: b.peakDay.length, peakDayMean: b.peakDay.length >= 10 ? mean(b.peakDay) : null, peakNightMean: b.peakNight.length >= 10 ? mean(b.peakNight) : null, hottest: b.hottest, annualDayMean: b.day.length >= 40 ? mean(b.day) : null }))
  if (rows.length > 1) yearly[key] = rows
}

fs.mkdirSync(OUT_DIR, { recursive: true })
for (const old of fs.readdirSync(OUT_DIR)) fs.unlinkSync(path.join(OUT_DIR, old))
const index = {}
const byState = {}
const byStateYearly = {}
for (const [key, days] of Object.entries(perCity)) {
  const [city, state] = key.split('|')
  const dates = Object.keys(days).filter(dt => dt >= SEASON_START).sort()
  const series = dates.map(dt => [dt, days[dt].d, days[dt].n])
  const dayVals = series.filter(s => s[1] !== null), nightVals = series.filter(s => s[2] !== null)
  const latestDay = dayVals[dayVals.length - 1], latestNight = nightVals[nightVals.length - 1]
  const hottest = dayVals.reduce((m, s) => (!m || s[1] > m[1] ? s : m), null)
  const mean = arr => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length * 10) / 10 : null
  index[key] = {
    city, state,
    clearDays: dayVals.length, clearNights: nightVals.length,
    latestDay: latestDay ? { date: latestDay[0], c: latestDay[1] } : null,
    latestNight: latestNight ? { date: latestNight[0], c: latestNight[2] } : null,
    hottestDay: hottest ? { date: hottest[0], c: hottest[1] } : null,
    meanDay: mean(dayVals.map(s => s[1])), meanNight: mean(nightVals.map(s => s[2])),
    file: `${slug(state)}.json`,
    years: yearly[key] ? yearly[key].length : 0
  }
  ;(byState[state] ||= {})[key] = series
  if (yearly[key]) (byStateYearly[state] ||= {})[key] = yearly[key]
}
const meta = {
  source: 'NASA LP DAAC — MOD11A1.061 (Terra MODIS daily 1 km land-surface temperature), point samples via AppEEARS',
  citation: 'Wan, Z., Hook, S., Hulley, G. (2021). MODIS/Terra Land Surface Temperature/Emissivity Daily L3 Global 1km SIN Grid V061. NASA EOSDIS LP DAAC. doi:10.5067/MODIS/MOD11A1.061',
  qcRule: 'MODLAND flag good/other-quality and LST error ≤ 2 K; cloud-blocked days dropped, nothing interpolated',
  units: '°C (Kelvin − 273.15)',
  dateRange: { from: minDate, to: maxDate },
  seasonFrom: SEASON_START,
  yearlyCities: Object.keys(yearly).length,
  cities: Object.keys(index).length,
  generatedAt: new Date().toISOString(),
  inputs: files
}
fs.writeFileSync(path.join(OUT_DIR, 'index.json'), JSON.stringify({ meta, cities: index }))
for (const [state, cities] of Object.entries(byState)) {
  fs.writeFileSync(path.join(OUT_DIR, `${slug(state)}.json`), JSON.stringify({ state, dateRange: { from: SEASON_START, to: meta.dateRange.to }, cities, yearly: byStateYearly[state] || {} }))
}
const size = f => (fs.statSync(path.join(OUT_DIR, f)).size / 1024).toFixed(0) + ' KB'
console.log(`rows ${rows.toLocaleString()} · kept (QC-passed day or night) ${kept.toLocaleString()} · cities ${meta.cities} · ${minDate} → ${maxDate}`)
console.log(`unmatched IDs: ${unmatched.size}${unmatched.size ? ' ' + [...unmatched].slice(0, 5).join(', ') : ''}`)
console.log(`index.json ${size('index.json')} · ${Object.keys(byState).length} state files · largest ${Object.keys(byState).map(s => slug(s) + '.json').map(f => [f, fs.statSync(path.join(OUT_DIR, f)).size]).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([f, b]) => `${f} ${(b / 1024).toFixed(0)} KB`).join(', ')}`)
