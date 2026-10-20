#!/usr/bin/env node
// Builds public/data/openverse-images.json — the Openverse fallback images the app uses when
// Wikimedia Commons has nothing for a district (utils/locationImages.js, source 2).
//
//   node scripts/buildOpenverseImages.mjs            # anonymous: at most 4 searches per run
//   node scripts/buildOpenverseImages.mjs --max 50   # with credentials (see below)
//   node scripts/buildOpenverseImages.mjs --all      # every supported district, not only the
//                                                    # ones Wikimedia left as placeholders
//
// Rate limits (openverse api/conf/settings/rest_framework.py): anonymous 5 requests / hour and
// 100 / day per IP; registered clients 100 / minute and 10,000 / day. Set OPENVERSE_CLIENT_ID and
// OPENVERSE_CLIENT_SECRET in the shell or .env (never VITE_-prefixed, never committed) to use a
// registered client. The script is resumable: districts already decided are skipped, a 429 stops
// the run and records when to resume, and server errors are logged as "not measured" — they are
// never recorded as "no image".
//
// Only the Openverse API is used (no scraping). Every candidate is checked with the same
// validateOpenverseResult() the browser uses, and the chosen image URL must answer a HEAD/GET.
import { readFile, writeFile } from 'fs/promises'
import path from 'path'
import { supportedDistricts } from './lib/supportedDistricts.mjs'
import { OPENVERSE_LICENCES, openverseQuery, validateOpenverseResult, VERIFIED } from '../src/utils/locationImages.js'

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const OUT = path.join(root, 'public/data/openverse-images.json')
const COVERAGE = path.join(root, 'public/data/image-coverage.json')
const API = 'https://api.openverse.org/v1'
const UA = { 'User-Agent': 'BhaskarOps-image-builder/1.0 (https://heatops.vercel.app)' }
const args = process.argv.slice(2)
const flag = n => args.includes(n)
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d }

async function loadEnv() {
  try { for (const line of (await readFile(path.join(root, '.env'), 'utf8')).split('\n')) { const m = /^\s*(OPENVERSE_CLIENT_ID|OPENVERSE_CLIENT_SECRET)\s*=\s*(\S+)/.exec(line); if (m && !process.env[m[1]]) process.env[m[1]] = m[2] } } catch { /* no .env */ }
}
async function token() {
  const id = process.env.OPENVERSE_CLIENT_ID, secret = process.env.OPENVERSE_CLIENT_SECRET
  if (!id || !secret) return null
  const r = await fetch(`${API}/auth_tokens/token/`, { method: 'POST', headers: { ...UA, 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'client_credentials', client_id: id, client_secret: secret }) })
  if (!r.ok) throw new Error(`Openverse token request failed: HTTP ${r.status}`)
  return (await r.json()).access_token
}
const sleep = ms => new Promise(r => setTimeout(r, ms))
async function withTimeout(url, init = {}, ms = 25000) {
  const c = new AbortController(); const t = setTimeout(() => c.abort(), ms)
  try { return await fetch(url, { ...init, signal: c.signal }) } finally { clearTimeout(t) }
}
async function urlAlive(url) {
  try { let r = await withTimeout(url, { method: 'HEAD', headers: UA }, 15000); if (r.status === 405 || r.status === 403) r = await withTimeout(url, { headers: { ...UA, Range: 'bytes=0-1023' } }, 15000); return r.ok || r.status === 206 } catch { return false }
}
// Keep only what attribution and re-validation need.
const trim = r => ({ id: r.id, title: r.title, url: r.url, thumbnail: r.thumbnail, foreign_landing_url: r.foreign_landing_url, creator: r.creator, creator_url: r.creator_url, license: r.license, license_version: r.license_version, license_url: r.license_url, attribution: r.attribution, provider: r.provider, source: r.source, filetype: r.filetype, width: r.width, height: r.height, mature: r.mature, tags: (r.tags || []).slice(0, 25).map(t => ({ name: t.name })) })

async function main() {
  await loadEnv()
  let manifest = { generatedAt: null, licences: OPENVERSE_LICENCES, images: {}, errors: {}, resumeAfter: null }
  try { manifest = { ...manifest, ...JSON.parse(await readFile(OUT, 'utf8')) } } catch { /* first run */ }
  if (manifest.resumeAfter && Date.now() < Date.parse(manifest.resumeAfter) && !flag('--force')) { console.log(`Openverse asked us to wait until ${manifest.resumeAfter}; not querying (use --force to override).`); return }

  const bearer = await token().catch(e => { console.error(e.message); return null })
  const max = parseInt(opt('--max', bearer ? '500' : '4'), 10)
  const gapMs = bearer ? 700 : 2000

  let targets = await supportedDistricts()
  if (!flag('--all')) {
    try {
      const cov = JSON.parse(await readFile(COVERAGE, 'utf8'))
      const placeholders = new Set((cov.districts || []).filter(d => d.status === 'placeholder' || d.provider === 'openverse').map(d => `${d.district}|${d.state}`))
      targets = targets.filter(d => placeholders.has(`${d.district}|${d.state}`))
    } catch { console.log('No coverage report yet — run scripts/imageCoverageReport.mjs first to target only districts Wikimedia cannot cover. Using every district.') }
  }
  const todo = targets.filter(d => !(`${d.district}|${d.state}` in manifest.images))
  console.log(`${bearer ? 'Registered client' : 'Anonymous'} · ${todo.length} districts to search · this run: up to ${max}`)

  let done = 0
  for (const d of todo) {
    if (done >= max) break
    const key = `${d.district}|${d.state}`
    const ctx = { district: d.district, state: d.state, landmark: VERIFIED[key]?.landmark || null }
    const q = openverseQuery(ctx)
    const url = `${API}/images/?q=${encodeURIComponent(q)}&license=${OPENVERSE_LICENCES.join(',')}&page_size=20&mature=false&filter_dead=true`
    done++
    let r
    try { r = await withTimeout(url, { headers: { ...UA, ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}) } }) } catch (e) { manifest.errors[key] = { at: new Date().toISOString(), error: e.name === 'AbortError' ? 'timeout' : e.message }; console.log(`  ✗ ${key}: ${manifest.errors[key].error}`); await sleep(gapMs); continue }
    if (r.status === 429) { const ra = parseInt(r.headers.get('retry-after') || '3600', 10); manifest.resumeAfter = new Date(Date.now() + ra * 1000).toISOString(); console.log(`  Rate limited — resume after ${manifest.resumeAfter}`); break }
    if (!r.ok) { manifest.errors[key] = { at: new Date().toISOString(), error: `HTTP ${r.status}` }; console.log(`  ✗ ${key}: HTTP ${r.status}`); await sleep(gapMs); continue }
    const j = await r.json()
    const results = j?.results || []
    const checked = results.map(x => ({ x, v: validateOpenverseResult(x, ctx) }))
    const ok = checked.filter(c => c.v.ok).sort((a, b) => b.v.score - a.v.score)
    let chosen = null
    for (const c of ok.slice(0, 3)) { if (await urlAlive(c.x.url)) { chosen = c.x; break } }
    manifest.images[key] = { raw: chosen ? trim(chosen) : null, query: q, checkedAt: new Date().toISOString(), candidates: results.length, accepted: ok.length, rejected: checked.filter(c => !c.v.ok).slice(0, 5).map(c => ({ title: c.x.title, reasons: c.v.reasons })) }
    delete manifest.errors[key]
    console.log(`  ${chosen ? '✓' : '·'} ${key}: ${results.length} results, ${ok.length} acceptable${chosen ? ` → "${chosen.title}" (${chosen.license})` : ''}`)
    await sleep(gapMs)
  }
  manifest.generatedAt = new Date().toISOString()
  await writeFile(OUT, JSON.stringify(manifest, null, 1))
  const n = Object.values(manifest.images)
  console.log(`Manifest: ${n.filter(e => e.raw).length} with an image, ${n.filter(e => !e.raw).length} searched with no acceptable image, ${Object.keys(manifest.errors).length} errors (not measured). Wrote ${path.relative(root, OUT)}`)
}
main().catch(e => { console.error(e); process.exit(1) })
