// Unit tests for the Heat + Power model and OpenStreetMap parsing (src/utils/heatPower.js).
import { test } from 'node:test'
import assert from 'node:assert/strict'
const m = await import('../../src/utils/heatPower.js')

test('no scenario change reproduces the reference peak', () => {
  const s = m.simulate({ referencePeakMW: 1000, capacityMW: 1200, solarMW: 150, refTempC: 40, dayMaxC: 40 })
  assert.equal(s.evening, 1000); assert.equal(s.changePct, 0); assert.equal(s.stress.key, 'high') // 1000/1200 = 83 %
})
test('temperature increase follows the stated sensitivity', () => {
  const s = m.simulate({ referencePeakMW: 1000, capacityMW: 2000, solarMW: 0, refTempC: 40, dayMaxC: 40, tempIncreaseC: 2, sensitivityPctPerC: 3 })
  assert.equal(s.evening, 1060) // +2 °C × 3 %
})
test('AC increase applies only to the cooling share of the peak', () => {
  const s = m.simulate({ referencePeakMW: 1000, capacityMW: 2000, solarMW: 0, refTempC: 40, dayMaxC: 40, acIncreasePct: 20 })
  assert.equal(s.evening, Math.round(1000 * (1 + m.ASSUMPTIONS.coolingShare * 0.2)))
})
test('a solar cut raises the afternoon net load, not the evening peak', () => {
  const a = m.simulate({ referencePeakMW: 1000, capacityMW: 2000, solarMW: 300, refTempC: 40, dayMaxC: 40 })
  const b = m.simulate({ referencePeakMW: 1000, capacityMW: 2000, solarMW: 300, refTempC: 40, dayMaxC: 40, solarDecreasePct: 100 })
  assert.equal(a.evening, b.evening); assert.ok(b.middayNet > a.middayNet)
})
test('stress classes', () => {
  assert.equal(m.stressClass(0.5).key, 'normal'); assert.equal(m.stressClass(0.85).key, 'high'); assert.equal(m.stressClass(0.97).key, 'critical'); assert.equal(m.stressClass(1.05).key, 'overload'); assert.equal(m.stressClass(null).key, 'na')
})
test('no reference peak → no simulation (nothing invented)', () => {
  assert.equal(m.simulate({ referencePeakMW: null, capacityMW: 1000, refTempC: 40 }), null)
})
test('diurnal: solar follows radiation, zero at night; cooling peaks in the evening window', () => {
  const hours = Array.from({ length: 24 }, (_, i) => ({ temp: 30 + 8 * Math.sin(((i - 9) / 24) * 2 * Math.PI), ghi: i >= 7 && i <= 18 ? 800 * Math.sin(((i - 6) / 13) * Math.PI) : 0 }))
  const c = m.diurnal({ hours, referencePeakMW: 1000, solarMW: 200, refTempC: 38 })
  assert.equal(c[2].solar, 0); assert.ok(c[12].solar > 100)
  const top = c.reduce((a, b) => (b.cooling > a.cooling ? b : a))
  assert.ok(top.hour >= 14 && top.hour <= 21, `cooling peak at ${top.hour}`)
})
test('Heat Impact Score: weights, bounds and missing components', () => {
  const hi = m.heatImpactScore({ tmax: 45, tmin: 32, lst: 55, built: 80, util: 1 }); assert.equal(hi.score, 100)
  const lo = m.heatImpactScore({ tmax: 30, tmin: 22, lst: 35, built: 0, util: 0.6 }); assert.equal(lo.score, 0)
  const part = m.heatImpactScore({ tmax: 45, tmin: null, lst: null, built: null, util: null }); assert.equal(part.score, 100); assert.equal(part.coverage, 0.35)
  assert.equal(Math.round(m.IMPACT_WEIGHTS.reduce((s, w) => s + w.w, 0) * 100), 100)
})
test('OSM parsing: substations, lines with kV, industrial areas with km²', () => {
  const sq = (lat, lon, d) => [{ lat, lon }, { lat, lon: lon + d }, { lat: lat + d, lon: lon + d }, { lat: lat + d, lon }]
  const json = { elements: [
    { type: 'node', id: 1, lat: 26.9, lon: 75.8, tags: { power: 'substation', name: 'GSS Test', voltage: '220000;132000' } },
    { type: 'way', id: 2, tags: { power: 'line', voltage: '400000' }, geometry: [{ lat: 26.8, lon: 75.7 }, { lat: 26.95, lon: 75.85 }] },
    { type: 'way', id: 3, tags: { landuse: 'industrial', name: 'Small' }, geometry: sq(26.9, 75.8, 0.01) },
    { type: 'way', id: 4, tags: { landuse: 'industrial', name: 'Big' }, geometry: sq(26.8, 75.7, 0.03) },
    { type: 'way', id: 5, tags: { highway: 'primary' }, geometry: [{ lat: 1, lon: 1 }] }
  ] }
  const g = m.parseOverpassGrid(json)
  assert.equal(g.substations.length, 1); assert.equal(g.substations[0].voltageKV, 220)
  assert.equal(g.lines[0].voltageKV, 400)
  assert.equal(g.industrial[0].name, 'Big'); assert.ok(g.industrial[0].areaKm2 > 9 && g.industrial[0].areaKm2 < 11, String(g.industrial[0].areaKm2))
  const o = m.gridOverlay(g, { substations: true, lines: false, industrial: true })
  assert.deepEqual(o.features.map(f => f.properties.kind).sort(), ['industrial', 'industrial', 'substation'])
  assert.match(o.features.find(f => f.properties.kind === 'substation').properties.label, /UNAVAILABLE/)
})
