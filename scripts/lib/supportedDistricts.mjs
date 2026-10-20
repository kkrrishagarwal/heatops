// The districts the dashboard actually draws (same rule as components/HudLeafletMap.jsx):
// every district in india_districts_full.geojson except Jammu & Kashmir / Ladakh, which come
// from the official jk_ladakh_official.geojson instead. State names are normalised the way the
// app does (utils/dashboardUtils.normalizeStateName, plus the J&K spelling).
import { readFile } from 'fs/promises'
import path from 'path'
import { normalizeStateName } from '../../src/utils/dashboardUtils.js'

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..')
const STATE_FIX = { 'Jammu & Kashmir': 'Jammu and Kashmir', 'Andaman and Nicobar': 'Andaman and Nicobar Islands' }
const fixState = s => STATE_FIX[s] || normalizeStateName(s) || s

export async function supportedDistricts() {
  const main = JSON.parse(await readFile(path.join(root, 'public/data/india_districts_full.geojson'), 'utf8'))
  const jk = JSON.parse(await readFile(path.join(root, 'public/data/jk_ladakh_official.geojson'), 'utf8'))
  const isJK = s => /jammu|kashmir|ladakh/i.test(s || '')
  const out = []
  for (const f of main.features) { const p = f.properties; if (!isJK(p.NAME_1) && p.NAME_2) out.push({ district: p.NAME_2, state: fixState(p.NAME_1) }) }
  for (const f of jk.features) { const p = f.properties; if (p.district) out.push({ district: p.district, state: fixState(p.st_nm) }) }
  const seen = new Set()
  return out.filter(d => { const k = `${d.district}|${d.state}`; if (seen.has(k)) return false; seen.add(k); return true })
}
