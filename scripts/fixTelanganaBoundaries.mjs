// One-off (8 Sept 2026): the GADM boundary files predate the 2014 bifurcation — Telangana's
// ten districts sat under Andhra Pradesh and there was no Telangana state polygon, so the
// app (which has had Telangana in STATE_DATA all along) never had a shape to colour.
// 1. Re-tag the ten districts NAME_1 = 'Telangana' in the full-resolution districts file.
// 2. Rebuild the two state polygons by dissolving districts (mapshaper), replace the old
//    undivided 'Andhra Pradesh' feature in the states file with both.
// Then scripts/simplifyGeo.sh regenerates the simplified public copies.
// Note: Khammam is kept whole in Telangana (its seven Bhadrachalam-area mandals moved to
// Andhra Pradesh in 2014; GADM has no mandal geometry, so that detail cannot be drawn).
import fs from 'fs'
import { execSync } from 'child_process'
const TG = new Set(['Adilabad', 'Hyderabad', 'Karimnagar', 'Khammam', 'Mahbubnagar', 'Medak', 'Nalgonda', 'Nizamabad', 'Rangareddi', 'Warangal'])
const D = 'scripts/data/geo-full/india_districts_full.geojson', S = 'scripts/data/geo-full/india_states_full.geojson'
const d = JSON.parse(fs.readFileSync(D, 'utf8'))
let moved = 0
for (const f of d.features) if (f.properties.NAME_1 === 'Andhra Pradesh' && TG.has(f.properties.NAME_2)) { f.properties.NAME_1 = 'Telangana'; moved++ }
fs.writeFileSync(D, JSON.stringify(d))
console.log(`districts re-tagged to Telangana: ${moved}`)
fs.mkdirSync('.tmp-e2e', { recursive: true })
execSync(`npx --no-install mapshaper ${D} -filter 'NAME_1=="Andhra Pradesh" || NAME_1=="Telangana"' -dissolve NAME_1 copy-fields=ID_0,ISO,NAME_0 -o .tmp-e2e/ap-tg.geojson format=geojson`, { stdio: 'inherit' })
const two = JSON.parse(fs.readFileSync('.tmp-e2e/ap-tg.geojson', 'utf8'))
const s = JSON.parse(fs.readFileSync(S, 'utf8'))
const old = s.features.find(f => f.properties.NAME_1 === 'Andhra Pradesh')
s.features = s.features.filter(f => f.properties.NAME_1 !== 'Andhra Pradesh')
for (const f of two.features) {
  f.properties = { ...old.properties, ...f.properties, NAME_1: f.properties.NAME_1, ID_1: f.properties.NAME_1 === 'Telangana' ? 36 : old.properties.ID_1 }
  s.features.push(f)
}
fs.writeFileSync(S, JSON.stringify(s))
console.log(`states file now has ${s.features.length} features: ${s.features.map(f => f.properties.NAME_1).filter(n => /Andhra|Telangana/.test(n)).join(', ')}`)
