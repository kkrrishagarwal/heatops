#!/usr/bin/env node
// Measures photograph coverage for every district the dashboard draws, using the app's own
// resolver (src/utils/locationImages.js) at district level ({ district, state }):
//   verified     — a hand-checked VERIFIED entry whose Commons file resolved
//   auto · Wikimedia / auto · Openverse — passed the licence and evidence checks, labelled
//                  "Auto-resolved · Not hand-verified" in the app
//   placeholder  — no acceptable image
// Openverse is read from the pre-built manifest (scripts/buildOpenverseImages.mjs); districts
// it has not searched yet are counted as "Openverse not measured", and any request that failed
// (network, timeout, HTTP error) is counted as "not measured" — never as "no image".
//
//   node scripts/imageCoverageReport.mjs [--limit 50] [--concurrency 1] [--delay 400]
// Writes public/data/image-coverage.json and docs/IMAGE_COVERAGE.md.
import { readFile, writeFile, mkdir } from 'fs/promises'
import { AsyncLocalStorage } from 'async_hooks'
import path from 'path'
import { supportedDistricts } from './lib/supportedDistricts.mjs'
import { resolveLocationImage, pickOpenverse, VERIFIED, OPENVERSE_ENABLED } from '../src/utils/locationImages.js'

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const args = process.argv.slice(2)
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d }
const limit = parseInt(opt('--limit', '0'), 10)
const conc = parseInt(opt('--concurrency', '1'), 10)

// Count failed requests per district (so a network error is not mistaken for "no image").
const als = new AsyncLocalStorage()
const realFetch = globalThis.fetch
// Wikimedia answers 429 when a client is too fast: back off (Retry-After, else 5 s doubling)
// and retry up to 5 times before recording the request as failed.
const delayMs = parseInt(opt('--delay', '400'), 10)
globalThis.fetch = async (url, init) => {
  const ctx = als.getStore()
  for (let attempt = 0; ; attempt++) {
    try {
      const r = await realFetch(url, init)
      if (r.status === 429 && attempt < 5) { const ra = parseInt(r.headers.get('retry-after') || '', 10); await new Promise(res => setTimeout(res, (Number.isFinite(ra) ? ra * 1000 : 5000 * 2 ** attempt))); continue }
      if (!r.ok && ctx) ctx.failures.push(`HTTP ${r.status} ${String(url).split('?')[0]}`)
      return r
    } catch (e) { if (ctx) ctx.failures.push(`${e.cause?.code || e.message} ${String(url).split('?')[0]}`); throw e }
  }
}

async function main() {
  let districts = await supportedDistricts()
  if (limit) districts = districts.slice(0, limit)
  let manifest = null
  try { manifest = JSON.parse(await readFile(path.join(root, 'public/data/openverse-images.json'), 'utf8')) } catch { /* not built yet */ }

  const rows = new Array(districts.length)
  let next = 0
  const started = Date.now()
  async function worker() {
    while (next < districts.length) {
      const i = next++
      const d = districts[i]
      const ctx = { failures: [] }
      await als.run(ctx, async () => {
        const img = await resolveLocationImage({ district: d.district, state: d.state, openverseOn: false })
        let row = { district: d.district, state: d.state, status: img.status, provider: img.provider || null, licence: img.licence || null, author: img.author || null, sourcePage: img.sourcePage || null }
        let openverse = 'not needed'
        if (img.status === 'placeholder') {
          const e = manifest?.images?.[`${d.district}|${d.state}`]
          if (!OPENVERSE_ENABLED) openverse = 'disabled'
          else if (e?.raw) { const ov = pickOpenverse([e.raw], { district: d.district, state: d.state }); if (ov) { row = { ...row, status: 'auto', provider: 'openverse', licence: ov.licence, author: ov.author, sourcePage: ov.sourcePage }; openverse = 'image' } else openverse = 'rejected on re-check' }
          else if (e && e.raw === null) openverse = 'searched, none acceptable'
          else openverse = 'not measured'
        }
        // A placeholder reached after a failed request is unmeasured, not "no image".
        const wikiUnmeasured = img.status === 'placeholder' && ctx.failures.length > 0
        rows[i] = { ...row, openverse, measured: !wikiUnmeasured, failures: ctx.failures.slice(0, 3), verifiedKey: !!VERIFIED[`${d.district}|${d.state}`] }
      })
      if ((i + 1) % 50 === 0) console.log(`  ${i + 1}/${districts.length} districts…`)
      await new Promise(r => setTimeout(r, delayMs)) // polite pacing for Wikipedia / Commons
    }
  }
  await Promise.all(Array.from({ length: conc }, worker))

  const count = f => rows.filter(f).length
  const summary = {
    supportedDistricts: rows.length,
    verified: count(r => r.status === 'verified'),
    autoWikimedia: count(r => r.status === 'auto' && r.provider === 'wikimedia'),
    autoOpenverse: count(r => r.status === 'auto' && r.provider === 'openverse'),
    placeholder: count(r => r.status === 'placeholder'),
    placeholderWikimediaUnmeasured: count(r => r.status === 'placeholder' && !r.measured),
    placeholderOpenverseNotMeasured: count(r => r.status === 'placeholder' && r.openverse === 'not measured'),
    placeholderOpenverseSearchedNone: count(r => r.status === 'placeholder' && r.openverse === 'searched, none acceptable'),
    verifiedRegistryKeysMatchingDistricts: count(r => r.verifiedKey)
  }
  summary.fullyMeasured = summary.placeholderWikimediaUnmeasured === 0 && summary.placeholderOpenverseNotMeasured === 0
  const report = { generatedAt: new Date().toISOString(), durationS: Math.round((Date.now() - started) / 1000), scope: 'district level: resolveLocationImage({ district, state }); city-level lookups in the app can add a city photo for a district drill-down', openverseManifest: manifest ? { generatedAt: manifest.generatedAt, searched: Object.keys(manifest.images || {}).length, errors: Object.keys(manifest.errors || {}).length } : null, summary, districts: rows }
  await writeFile(path.join(root, 'public/data/image-coverage.json'), JSON.stringify(report, null, 1))

  const pct = n => `${((n / rows.length) * 100).toFixed(1)}%`
  const byState = {}
  for (const r of rows) { const s = (byState[r.state] ||= { v: 0, a: 0, p: 0 }); if (r.status === 'verified') s.v++; else if (r.status === 'auto') s.a++; else s.p++ }
  const md = `# District photograph coverage

Generated ${report.generatedAt} by \`node scripts/imageCoverageReport.mjs\` (${report.durationS} s). Scope: ${report.scope}.

| Status | Districts | Share |
|---|---:|---:|
| Verified (hand-checked registry) | ${summary.verified} | ${pct(summary.verified)} |
| Auto-resolved · Wikimedia Commons | ${summary.autoWikimedia} | ${pct(summary.autoWikimedia)} |
| Auto-resolved · Openverse | ${summary.autoOpenverse} | ${pct(summary.autoOpenverse)} |
| Placeholder | ${summary.placeholder} | ${pct(summary.placeholder)} |
| **Supported districts** | **${summary.supportedDistricts}** | 100% |

Measurement gaps:

- Placeholders where a Wikimedia request failed (not measured): **${summary.placeholderWikimediaUnmeasured}**
- Placeholders Openverse has not searched yet (not measured): **${summary.placeholderOpenverseNotMeasured}**
- Placeholders Openverse searched with no acceptable image: ${summary.placeholderOpenverseSearchedNone}
- Openverse manifest: ${report.openverseManifest ? `${report.openverseManifest.searched} searched, ${report.openverseManifest.errors} errors, built ${report.openverseManifest.generatedAt}` : 'not built yet'}

${summary.fullyMeasured ? 'Every district was measured.' : '**Coverage is not fully measured**: the counts above are a lower bound for photographs, and placeholders may fall once the gaps are measured.'}

Auto-resolved images are shown as "Auto-resolved · Not hand-verified" until a person adds them to \`VERIFIED\` in \`src/utils/locationImages.js\`.

## By state

| State | Verified | Auto | Placeholder |
|---|---:|---:|---:|
${Object.entries(byState).sort((a, b) => a[0].localeCompare(b[0])).map(([s, c]) => `| ${s} | ${c.v} | ${c.a} | ${c.p} |`).join('\n')}
`
  await mkdir(path.join(root, 'docs'), { recursive: true })
  await writeFile(path.join(root, 'docs/IMAGE_COVERAGE.md'), md)
  console.log(JSON.stringify(summary, null, 1))
}
main().catch(e => { console.error(e); process.exit(1) })
