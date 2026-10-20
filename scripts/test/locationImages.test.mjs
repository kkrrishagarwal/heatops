// Unit tests for the image resolver (src/utils/locationImages.js): Openverse validation rules,
// source order, switches, broken-URL fallthrough and the anonymous rate-limit budget.
// Run: npm test   (node --test, no network: every request is answered by the mock below)
import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'

// Browser-like globals BEFORE the module loads (it reads `window` once at import).
const store = new Map()
globalThis.window = { localStorage: { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) } }
let routes = {}, calls = []
globalThis.fetch = async (url) => {
  calls.push(String(url))
  for (const [re, fn] of Object.entries(routes)) if (new RegExp(re).test(url)) return fn(url)
  return new Response('{}', { status: 404 })
}
const json = (obj, status = 200, headers = {}) => new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json', ...headers } })
const m = await import('../../src/utils/locationImages.js')

const good = (over = {}) => ({ id: 'ov1', title: 'Bastar landscape, Chhattisgarh', url: 'https://live.staticflickr.com/1/abc_b.jpg', thumbnail: 'https://api.openverse.org/v1/images/ov1/thumb/', foreign_landing_url: 'https://www.flickr.com/photos/x/1', creator: 'A. Photographer', license: 'by', license_version: '2.0', license_url: 'https://creativecommons.org/licenses/by/2.0/', attribution: '"Bastar landscape" by A. Photographer is licensed under CC BY 2.0.', provider: 'flickr', source: 'flickr', filetype: 'jpg', width: 1600, height: 1000, mature: false, tags: [{ name: 'india' }, { name: 'bastar' }], ...over })
const ctx = { district: 'Bastar', state: 'Chhattisgarh' }

beforeEach(() => { store.clear(); calls = []; routes = {} })

test('accepts a CC BY photo that names the place and is corroborated', () => {
  const v = m.validateOpenverseResult(good(), ctx)
  assert.equal(v.ok, true, v.reasons.join('; '))
})
test('a title match alone is not proof of location', () => {
  const v = m.validateOpenverseResult(good({ title: 'Bastar', tags: [] }), ctx)
  assert.equal(v.ok, false)
  assert.match(v.reasons.join(), /no second signal/)
})
test('rejects incompatible licences, missing metadata and unsuitable subjects', () => {
  const cases = {
    'non-commercial': good({ license: 'by-nc' }), 'no-derivatives': good({ license: 'by-nd' }), 'missing creator (BY)': good({ creator: '' }),
    'no licence url': good({ license_url: null }), 'http image': good({ url: 'http://x/y.jpg' }), 'no source page': good({ foreign_landing_url: '' }),
    'mature': good({ mature: true }), 'too small': good({ width: 300 }), 'a map': good({ title: 'Map of Bastar district, Chhattisgarh' }), 'not a photo file': good({ url: 'https://x/y.svg', filetype: 'svg' })
  }
  for (const [name, r] of Object.entries(cases)) assert.equal(m.validateOpenverseResult(r, ctx).ok, false, name)
})
test('public-domain images need no creator', () => {
  assert.equal(m.validateOpenverseResult(good({ license: 'pdm', creator: '', license_url: null }), ctx).ok, true)
  assert.equal(m.validateOpenverseResult(good({ license: 'cc0', creator: '' }), ctx).ok, true)
})
test('picks the best-evidenced result and keeps full attribution metadata', () => {
  const weak = good({ id: 'weak', title: 'Bastar trip', tags: [{ name: 'india' }] })
  const strong = good({ id: 'strong', title: 'Chitrakote falls, Bastar, Chhattisgarh', tags: [{ name: 'bastar' }, { name: 'chhattisgarh' }, { name: 'india' }] })
  const img = m.pickOpenverse([weak, strong], ctx)
  assert.equal(img.openverseId, 'strong')
  for (const k of ['src', 'sourcePage', 'author', 'licence', 'licenceUrl', 'attribution']) assert.ok(img[k], k)
  assert.equal(img.licence, 'CC BY 2.0')
})
test('Wikimedia auto rejects maps, flags and SVGs', () => {
  assert.equal(m.isPhotoFile('Chitrakot_Falls.jpg'), true)
  assert.equal(m.isPhotoFile('Bastar_district_locator_map.png'), false)
  assert.equal(m.isPhotoFile('Flag_of_Chhattisgarh.svg'), false)
})

const noWiki = () => { routes['wikipedia\\.org'] = () => json({ query: { pages: { '-1': {} } } }) }
test('order: Wikimedia first, then Openverse manifest, then placeholder', async () => {
  noWiki()
  routes['/data/openverse-images\\.json'] = () => json({ images: { 'Bastar|Chhattisgarh': { raw: good() } } })
  const img = await m.resolveLocationImage({ district: 'Bastar', state: 'Chhattisgarh' })
  assert.equal(img.status, 'auto'); assert.equal(img.provider, 'openverse'); assert.equal(img.autoLabel, m.AUTO_LABEL)
  assert.ok(calls.findIndex(u => /wikipedia/.test(u)) < calls.findIndex(u => /openverse-images/.test(u)), 'Wikimedia is asked before Openverse')
})
test('Openverse switch off → placeholder, no Openverse request', async () => {
  noWiki()
  const img = await m.resolveLocationImage({ district: 'Dantewada', state: 'Chhattisgarh', openverseOn: false })
  assert.equal(img.status, 'placeholder')
  assert.equal(calls.some(u => /openverse/.test(u)), false)
})
test('a broken image URL falls through to the next source', async () => {
  noWiki()
  const img = await m.resolveLocationImage({ district: 'Bastar', state: 'Chhattisgarh', skip: new Set([good().url]) })
  assert.equal(img.status, 'placeholder')
})
test('live lookup: validates results, caches the answer and respects the hourly budget', async () => {
  noWiki()
  let ovCalls = 0
  routes['api\\.openverse\\.org/v1/images'] = () => { ovCalls++; return json({ results: [good({ title: 'Sukma market, Sukma, Chhattisgarh', tags: [{ name: 'sukma' }] })] }) }
  const a = await m.openverseImage({ district: 'Sukma', state: 'Chhattisgarh' }, { live: true })
  assert.equal(a?.provider, 'openverse')
  for (const d of ['Kondagaon', 'Narayanpur', 'Bijapur', 'Kanker', 'Kawardha']) await m.openverseImage({ district: d, state: 'Chhattisgarh' }, { live: true })
  assert.equal(ovCalls, 4, 'at most 4 anonymous searches per hour')
  assert.equal(m.openverseBudget().ok, false)
})
test('live lookup: a 429 blocks further requests until Retry-After', async () => {
  noWiki()
  routes['api\\.openverse\\.org/v1/images'] = () => json({ detail: 'throttled' }, 429, { 'Retry-After': '1800' })
  assert.equal(await m.openverseImage({ district: 'Raigarh', state: 'Chhattisgarh' }, { live: true }), null)
  const b = m.openverseBudget()
  assert.equal(b.ok, false); assert.match(b.reason, /rate-limited/)
})
