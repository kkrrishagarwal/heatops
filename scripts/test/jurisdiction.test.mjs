// Unit tests for sign-in jurisdiction routing (src/utils/jurisdiction.js).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'fs/promises'
const m = await import('../../src/utils/jurisdiction.js')

test('central prefixes and NDMA domain → all-India', () => {
  for (const e of ['central@gmail.com', 'india@gmail.com', 'admin@ndma.gov.in', 'central@bhaskarops.gov.in']) assert.deepEqual(m.parseJurisdiction(e), { type: 'central' }, e)
})
test('state codes, names and both domains', () => {
  const cases = { 'up@gmail.com': 'Uttar Pradesh', 'rj@bhaskarops.gov.in': 'Rajasthan', 'delhi@gmail.com': 'Delhi', 'dl@gmail.com': 'Delhi', 'assam@gmail.com': 'Assam', 'as@gmail.com': 'Assam', 'leh@gmail.com': 'Ladakh', 'ld@gmail.com': 'Ladakh', 'mh@gmail.com': 'Maharashtra', 'gj@gmail.com': 'Gujarat', 'tamilnadu@gmail.com': 'Tamil Nadu', 'UP.Admin@Gmail.com': 'Uttar Pradesh' }
  for (const [e, st] of Object.entries(cases)) assert.deepEqual(m.parseJurisdiction(e), { type: 'state', state: st }, e)
})
test('ordinary accounts are not jurisdiction accounts', () => {
  for (const e of ['krish@gmail.com', 'up@yahoo.com', 'notanemail', '', 'rj@example.com']) assert.equal(m.parseJurisdiction(e), null, e)
})
test('demo password rule: listed, master, or any 4+ characters', () => {
  for (const c of m.DEMO_CREDENTIALS) assert.equal(m.demoPasswordOk(c.password), true, c.email)
  assert.equal(m.demoPasswordOk(m.MASTER_PASSWORD), true); assert.equal(m.demoPasswordOk('abcd'), true)
  assert.equal(m.demoPasswordOk('abc'), false); assert.equal(m.demoPasswordOk('   '), false)
})
test('every demo credential routes, and every mapped state exists in the city list', async () => {
  const cache = JSON.parse(await readFile(new URL('../../public/live-weather-cache.json', import.meta.url), 'utf8')).cities
  const states = new Set(Object.values(cache).map(c => c.state))
  for (const c of m.DEMO_CREDENTIALS) assert.ok(m.parseJurisdiction(c.email), c.email)
  for (const st of new Set(Object.values(m.STATE_CODES))) assert.ok(states.has(st), st)
  for (const [st, hq] of Object.entries(m.STATE_HQ)) assert.ok(cache[`${hq}|${st}`], `${hq}|${st}`)
})
