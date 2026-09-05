// Rewinds polygon rings so d3-geo (used by react-simple-maps) fills the inside of each
// shape. mapshaper writes GeoJSON rings the RFC 7946 way (exterior counter-clockwise);
// d3-geo follows the opposite spherical convention, so every state came out as
// "the whole sphere minus the state" — the map turned into one solid colour with white
// outlines. A feature whose spherical area exceeds a hemisphere is inverted; we reverse
// all of its rings (exterior and holes together, so holes stay holes).
//   node scripts/rewindGeo.mjs public/data/a.geojson [more files…]
import { geoArea } from 'd3-geo'
import fs from 'fs'

const HEMISPHERE = 2 * Math.PI
function rewindGeometry(g) {
  if (!g) return g
  if (g.type === 'Polygon') return { ...g, coordinates: g.coordinates.map(r => [...r].reverse()) }
  if (g.type === 'MultiPolygon') return { ...g, coordinates: g.coordinates.map(p => p.map(r => [...r].reverse())) }
  return g
}
for (const file of process.argv.slice(2)) {
  const d = JSON.parse(fs.readFileSync(file, 'utf8'))
  let fixed = 0
  d.features = d.features.map(f => {
    if (!f.geometry || geoArea(f) <= HEMISPHERE) return f
    fixed++
    return { ...f, geometry: rewindGeometry(f.geometry) }
  })
  const still = d.features.filter(f => f.geometry && geoArea(f) > HEMISPHERE).length
  fs.writeFileSync(file, JSON.stringify(d))
  console.log(`${file}: rewound ${fixed}/${d.features.length} features · still inverted: ${still}`)
}
