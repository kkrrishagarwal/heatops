#!/usr/bin/env node
// Pre-builds public/data/osm-grid.json: OpenStreetMap power infrastructure (power=substation,
// power=line) and industrial land (landuse=industrial) within 15 km of each city, so the
// Heat + Power map does not depend on Overpass answering at demo time.
//
//   node scripts/fetchOsmGrid.mjs                       # the 34 registry cities
//   node scripts/fetchOsmGrid.mjs --cities "Jaipur|Rajasthan,Kota|Rajasthan"
//
// Resumable: cities already in the file are skipped (use --refresh to re-fetch). Requests are
// sent one at a time with a pause, per the Overpass usage policy. A failure is recorded as an
// error, never as "no infrastructure". Geometry only — OSM holds no loading or capacity data.
import { readFile, writeFile } from 'fs/promises'
import path from 'path'
import { overpassQuery, parseOverpassGrid, GRID_RADIUS_M } from '../src/utils/heatPower.js'
import { VERIFIED } from '../src/utils/locationImages.js'

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const OUT = path.join(root, 'public/data/osm-grid.json')
const ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter']
const args = process.argv.slice(2)
const opt = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null }
const sleep = ms => new Promise(r => setTimeout(r, ms))

async function main() {
  const coords = JSON.parse(await readFile(path.join(root, 'public/data/cityCoordinates.json'), 'utf8'))
  const lookup = k => coords[k] || coords.cities?.[k] || null
  const keys = opt('--cities') ? opt('--cities').split(',').map(s => s.trim()) : Object.keys(VERIFIED)
  let out = { source: `OpenStreetMap via Overpass (power=substation, power=line, landuse=industrial within ${GRID_RADIUS_M / 1000} km)`, generatedAt: null, cities: {}, errors: {} }
  try { out = { ...out, ...JSON.parse(await readFile(OUT, 'utf8')) } } catch { /* first run */ }
  for (const key of keys) {
    if (out.cities[key] && !args.includes('--refresh')) continue
    const c = lookup(key)
    if (typeof c?.lat !== 'number') { out.errors[key] = 'no coordinates'; continue }
    let done = false
    for (const url of ENDPOINTS) {
      try {
        const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 60000)
        const r = await fetch(url, { method: 'POST', body: new URLSearchParams({ data: overpassQuery(c.lat, c.lon) }), headers: { 'User-Agent': 'BhaskarOps-grid-builder/1.0 (https://heatops.vercel.app)' }, signal: ctl.signal })
        clearTimeout(t)
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        const grid = parseOverpassGrid(await r.json())
        out.cities[key] = { fetchedAt: new Date().toISOString(), grid }
        delete out.errors[key]
        console.log(`✓ ${key}: ${grid.substations.length} substations, ${grid.lines.length} lines, ${grid.industrial.length} industrial areas`)
        done = true; break
      } catch (e) { out.errors[key] = `${url.split('/')[2]}: ${e.name === 'AbortError' ? 'timeout' : e.message}` }
    }
    if (!done) console.log(`✗ ${key}: ${out.errors[key]}`)
    out.generatedAt = new Date().toISOString()
    await writeFile(OUT, JSON.stringify(out)) // save after every city, so an interrupted run keeps its progress
    await sleep(5000)
  }
  out.generatedAt = new Date().toISOString()
  await writeFile(OUT, JSON.stringify(out))
  console.log(`${Object.keys(out.cities).length} cities stored, ${Object.keys(out.errors).length} errors → ${path.relative(root, OUT)}`)
}
main().catch(e => { console.error(e); process.exit(1) })
