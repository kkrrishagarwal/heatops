// City & District Visual Identity System — registry + resolver.
//
// Resolution order (the brief's fallback hierarchy):
//   1. verified   — a hand-checked entry in VERIFIED below (city or district), with its
//                   landmark, Wikimedia Commons file, licence and author
//   2. auto · Wikimedia Commons — the lead image of the place's Wikipedia article, fetched
//                   at runtime with its licence and author from the Commons API
//   3. auto · Openverse — an openly licensed photo found by Openverse search, taken from the
//                   pre-built manifest (public/data/openverse-images.json, built offline by
//                   scripts/buildOpenverseImages.mjs) or, as a last resort, one rationed live
//                   lookup. Every result is checked against the licence, metadata and
//                   location-evidence rules in validateOpenverseResult().
//   4. placeholder — a branded, text-only location card that says no verified photo exists
// Every resolved image carries { src, alt, landmark, source, licence, licenceUrl, author,
// sourcePage, attribution, status, provider }. Auto-resolved images are labelled
// "Auto-resolved · Not hand-verified" in the UI until a person adds them to VERIFIED.
// Photographs are contextual identity only; nothing here is a measurement.
//
// Switches (independent):
//   PROVIDER_ENABLED  — Wikimedia Commons / Wikipedia (approved 19 Oct 2026)
//   OPENVERSE_ENABLED — Openverse as the second source; VITE_OPENVERSE_ENABLED=false turns it off
//   OPENVERSE_LIVE    — the rationed in-browser Openverse lookup (the manifest still applies
//                       when this is off); VITE_OPENVERSE_LIVE=false turns it off
const ENV = (typeof import.meta !== 'undefined' && import.meta.env) || {}
const envFlag = (name, dflt) => { const v = ENV[name] ?? (typeof process !== 'undefined' ? process.env?.[name] : undefined); return v == null || v === '' ? dflt : !/^(0|false|off|no)$/i.test(String(v)) }
export const PROVIDER_ENABLED = true // approved 19 Oct 2026: Wikimedia Commons / Wikipedia, with per-asset licence check
export const OPENVERSE_ENABLED = envFlag('VITE_OPENVERSE_ENABLED', true)
export const OPENVERSE_LIVE = envFlag('VITE_OPENVERSE_LIVE', true)
export const AUTO_LABEL = 'Auto-resolved · Not hand-verified'

// Hand-verified entries. `page` is the English Wikipedia article whose lead image is used
// (fetched live, licence read from Commons); `landmark` is what the picture shows.
export const VERIFIED = {
  'New Delhi|Delhi': { landmark: 'India Gate', page: 'India Gate' },
  'Delhi|Delhi': { landmark: 'India Gate', page: 'India Gate' },
  'Jaipur|Rajasthan': { landmark: 'Hawa Mahal', page: 'Hawa Mahal' },
  'Lucknow|Uttar Pradesh': { landmark: 'Rumi Darwaza', page: 'Rumi Darwaza' },
  'Mumbai|Maharashtra': { landmark: 'Gateway of India', page: 'Gateway of India' },
  'Kolkata|West Bengal': { landmark: 'Victoria Memorial', page: 'Victoria Memorial, Kolkata' },
  'Hyderabad|Telangana': { landmark: 'Charminar', page: 'Charminar' },
  'Chennai|Tamil Nadu': { landmark: 'Marina Beach', page: 'Marina Beach' },
  'Bengaluru|Karnataka': { landmark: 'Vidhana Soudha', page: 'Vidhana Soudha' },
  'Chandigarh|Chandigarh': { landmark: 'Capitol Complex', page: 'Chandigarh Capitol Complex' },
  'Shimla|Himachal Pradesh': { landmark: 'Viceregal Lodge', page: 'Rashtrapati Niwas' },
  'Ahmedabad|Gujarat': { landmark: 'Sabarmati Ashram', page: 'Sabarmati Ashram' },
  'Agra|Uttar Pradesh': { landmark: 'Taj Mahal', page: 'Taj Mahal' },
  'Varanasi|Uttar Pradesh': { landmark: 'Dashashwamedh Ghat', page: 'Dashashwamedh Ghat' },
  'Amritsar|Punjab': { landmark: 'Golden Temple', page: 'Golden Temple' },
  'Bhopal|Madhya Pradesh': { landmark: 'Taj-ul-Masajid', page: 'Taj-ul-Masajid' },
  'Pune|Maharashtra': { landmark: 'Shaniwar Wada', page: 'Shaniwar Wada' },
  'Thiruvananthapuram|Kerala': { landmark: 'Padmanabhaswamy Temple', page: 'Padmanabhaswamy Temple' },
  'Guwahati|Assam': { landmark: 'Kamakhya Temple', page: 'Kamakhya Temple' },
  'Leh|Ladakh': { landmark: 'Leh Palace', page: 'Leh Palace' },
  'Srinagar|Jammu and Kashmir': { landmark: 'Dal Lake', page: 'Dal Lake' },
  'Jodhpur|Rajasthan': { landmark: 'Mehrangarh Fort', page: 'Mehrangarh' },
  'Udaipur|Rajasthan': { landmark: 'City Palace', page: 'City Palace, Udaipur' },
  'Bhubaneswar|Odisha': { landmark: 'Lingaraja Temple', page: 'Lingaraja Temple' },
  'Patna|Bihar': { landmark: 'Golghar', page: 'Golghar' },
  'Raipur|Chhattisgarh': { landmark: 'Vivekananda Sarovar', page: 'Vivekananda Sarovar' },
  'Dehradun|Uttarakhand': { landmark: 'Forest Research Institute', page: 'Forest Research Institute' },
  'Gandhinagar|Gujarat': { landmark: 'Akshardham', page: 'Akshardham (Gandhinagar)' },
  'Nagpur|Maharashtra': { landmark: 'Deekshabhoomi', page: 'Deekshabhoomi' },
  'Visakhapatnam|Andhra Pradesh': { landmark: 'RK Beach', page: 'Ramakrishna Beach' },
  'Kochi|Kerala': { landmark: 'Chinese fishing nets', page: 'Chinese fishing nets' },
  'Madurai|Tamil Nadu': { landmark: 'Meenakshi Temple', page: 'Meenakshi Temple' },
  'Mysuru|Karnataka': { landmark: 'Mysore Palace', page: 'Mysore Palace' },
  'Sri Ganganagar|Rajasthan': { landmark: 'Sri Ganganagar', page: 'Sri Ganganagar' }
}

const IS_BROWSER = typeof window !== 'undefined'
// Wikimedia asks automated (non-browser) clients to identify themselves; browsers cannot set it.
const UA_HEADERS = IS_BROWSER ? {} : { 'User-Agent': 'BhaskarOps-image-coverage/1.0 (https://heatops.vercel.app)' }

const cache = new Map() // key → promise of result
const memo = (k, fn) => { if (!cache.has(k)) cache.set(k, fn().catch(() => null)); return cache.get(k) }

// ── Source 1: Wikimedia Commons (via the Wikipedia lead image) ──────────────────────────────
// Wikipedia lead image + Commons licence metadata, no API key. Two requests, cached.
export async function wikiImage(page) {
  const api = `https://en.wikipedia.org/w/api.php?origin=*&format=json&action=query&redirects=1&prop=pageimages&piprop=original|name&pithumbsize=1200&titles=${encodeURIComponent(page)}`
  const r = await fetch(api, { headers: UA_HEADERS }); if (!r.ok) return null
  const j = await r.json()
  const p = Object.values(j?.query?.pages || {})[0]
  const file = p?.pageimage; const src = p?.original?.source
  if (!file || !src) return null
  // Only Commons-hosted files: Wikipedia's local uploads are often "fair use" (non-free) and
  // must not be reused. Commons files carry a machine-readable licence we read below.
  if (!/upload\.wikimedia\.org\/wikipedia\/commons\//.test(src)) return null
  let licence = null, author = null, licenceUrl = null
  try {
    const c = await fetch(`https://commons.wikimedia.org/w/api.php?origin=*&format=json&action=query&prop=imageinfo&iiprop=extmetadata&titles=${encodeURIComponent('File:' + file)}`, { headers: UA_HEADERS })
    const cj = await c.json()
    const info = Object.values(cj?.query?.pages || {})[0]?.imageinfo?.[0]?.extmetadata
    licence = info?.LicenseShortName?.value || null
    licenceUrl = info?.LicenseUrl?.value || null
    author = (info?.Artist?.value || '').replace(/<[^>]+>/g, '').trim() || null
    const usage = (info?.UsageTerms?.value || '').toLowerCase()
    // Reject anything whose licence is unknown or not a free licence (CC / public domain / GFDL).
    if (!licence || !/cc|public domain|pd|gfdl|free/i.test(`${licence} ${usage}`)) return null
  } catch { return null } // no licence metadata → do not use the file
  const filePage = `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(file)}`
  return { src, file, licence, licenceUrl, author, source: 'Wikimedia Commons', provider: 'wikimedia', filePage, sourcePage: filePage, attribution: `${file.replace(/_/g, ' ')}${author ? ` by ${author}` : ''}, ${licence}, via Wikimedia Commons` }
}

// ── Source 2: Openverse ─────────────────────────────────────────────────────────────────────
// Licences accepted: CC BY, CC BY-SA, CC0 and the Public Domain Mark. Non-commercial (NC)
// licences are excluded because the platform is meant for government use; no-derivatives (ND)
// licences are excluded because the hero crops the photograph.
export const OPENVERSE_LICENCES = ['by', 'by-sa', 'cc0', 'pdm']
const OV_API = 'https://api.openverse.org/v1/images/'
const IMAGE_EXT = /\.(jpe?g|png|webp)(\?|$)/i
const UNSUITABLE = /\b(map|maps|logo|flag|emblem|seal|poster|screenshot|diagram|chart|graph|infographic|stamp|coin|banknote|cartoon|illustration|drawing|painting|sketch|clipart|icon|meme|selfie|portrait|wedding|food|recipe|dish)\b/i
const norm = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim()
const hasWord = (text, phrase) => { const p = norm(phrase); return !!p && ` ${text} `.includes(` ${p} `) }

export function isPhotoFile(file) {
  const f = String(file || '')
  return /\.(jpe?g|png|webp|tiff?)$/i.test(f) && !UNSUITABLE.test(norm(f.replace(/\.[a-z]+$/i, '')).replace(/\blocator\b/, 'map'))
}

export function openverseQuery({ city, district, state, landmark }) {
  const place = city || district
  // A known landmark is the most specific query; otherwise the place, its state and India.
  return landmark ? `${landmark} ${place || ''}`.trim() : `${place} ${state || ''} India`.replace(/\s+/g, ' ').trim()
}

// Decide whether one Openverse result may be shown for this place. Returns
// { ok, score, reasons } — the reasons are kept for the coverage report and debugging.
// A title match alone is never enough: the place must be named AND a second, independent
// signal must agree (the state or "India" in the title/tags, or the name in BOTH title and tags,
// or an exact landmark match).
export function validateOpenverseResult(r, { city, district, state, landmark }) {
  const reasons = []
  if (!r || typeof r !== 'object') return { ok: false, score: 0, reasons: ['no result'] }
  const lic = String(r.license || '').toLowerCase()
  if (!OPENVERSE_LICENCES.includes(lic)) reasons.push(`licence ${lic || 'missing'} not accepted`)
  if (lic !== 'pdm' && !r.license_url) reasons.push('licence URL missing')
  if ((lic === 'by' || lic === 'by-sa') && !String(r.creator || '').trim()) reasons.push('creator missing for an attribution licence')
  if (!/^https:\/\//.test(r.url || '')) reasons.push('image URL missing or not HTTPS')
  if (!/^https?:\/\//.test(r.foreign_landing_url || '')) reasons.push('source page missing')
  if (!IMAGE_EXT.test(r.url || '') && !/^(jpe?g|png|webp)$/i.test(r.filetype || '')) reasons.push('not a JPEG/PNG/WebP photograph')
  if (r.mature) reasons.push('marked mature')
  if (typeof r.width === 'number' && r.width && r.width < 640) reasons.push(`too small (${r.width}px wide)`)
  const title = norm(r.title)
  const tags = norm((r.tags || []).map(t => t?.name || '').join(' '))
  const all = `${title} ${tags}`
  if (!title) reasons.push('no title')
  if (UNSUITABLE.test(all)) reasons.push('looks like a map, logo, artwork or unrelated subject')
  const names = [city, district].filter(Boolean)
  const inTitle = names.some(n => hasWord(title, n)), inTags = names.some(n => hasWord(tags, n))
  const lmTitle = landmark && hasWord(title, landmark)
  const stateHit = state && hasWord(all, state), indiaHit = hasWord(all, 'india')
  let evidence = 0
  if (lmTitle) evidence += 2
  if (inTitle) evidence += 1
  if (inTags) evidence += 1
  if (stateHit) evidence += 1
  if (indiaHit) evidence += 1
  const placeNamed = inTitle || inTags || lmTitle
  const corroborated = lmTitle || (inTitle && inTags) || ((inTitle || inTags) && (stateHit || indiaHit))
  if (!placeNamed) reasons.push('place not named in title or tags')
  else if (!corroborated) reasons.push('place named once with no second signal (state, India or tags)')
  return { ok: reasons.length === 0, score: evidence + (typeof r.width === 'number' && r.width >= 1200 ? 0.5 : 0), reasons }
}

export function fromOpenverse(r, { place, landmark }) {
  const lic = String(r.license || '').toLowerCase()
  const licence = lic === 'pdm' ? 'Public Domain Mark' : lic === 'cc0' ? 'CC0 1.0' : `CC ${lic.toUpperCase()}${r.license_version ? ` ${r.license_version}` : ''}`
  return {
    src: r.url, thumb: r.thumbnail || null, file: r.title || null, licence, licenceUrl: r.license_url || null,
    author: String(r.creator || '').trim() || null, creatorUrl: r.creator_url || null,
    source: `Openverse · ${r.source || r.provider || 'unknown source'}`, provider: 'openverse', openverseId: r.id,
    sourcePage: r.foreign_landing_url, filePage: r.foreign_landing_url,
    attribution: r.attribution || `"${r.title || 'Untitled'}"${r.creator ? ` by ${r.creator}` : ''} is licensed under ${licence}.`,
    alt: `${r.title || place} (auto-resolved image of ${place}, not hand-verified)`, landmark: landmark && hasWord(norm(r.title), landmark) ? landmark : null
  }
}

export function pickOpenverse(results, ctx) {
  const scored = (results || []).map(r => ({ r, v: validateOpenverseResult(r, ctx) })).filter(x => x.v.ok).sort((a, b) => b.v.score - a.v.score)
  return scored[0] ? fromOpenverse(scored[0].r, { place: ctx.city || ctx.district, landmark: ctx.landmark }) : null
}

// Pre-built manifest (offline, within the API's limits). Keys are "Place|State".
let manifestPromise = null
export function loadOpenverseManifest() {
  if (!manifestPromise) {
    manifestPromise = (IS_BROWSER ? fetch('/data/openverse-images.json').then(r => (r.ok ? r.json() : null)) : Promise.resolve(null)).catch(() => null)
  }
  return manifestPromise
}

// Rationed live lookup. Anonymous Openverse use is limited to 5 requests / hour and 100 / day
// per IP (openverse api/conf/settings/rest_framework.py), so the browser spends at most 4 / hour
// and 60 / day, honours 429 Retry-After, and caches every answer (hit or miss) for 14 days.
const OV_BUDGET = { perHour: 4, perDay: 60 }
const OV_STORE = 'bhaskarops_openverse_v1'
const readStore = () => { try { const v = JSON.parse(window.localStorage.getItem(OV_STORE) || 'null'); return v && typeof v === 'object' ? { calls: v.calls || [], until: v.until || 0, hits: v.hits || {} } : { calls: [], until: 0, hits: {} } } catch { return { calls: [], until: 0, hits: {} } } }
const writeStore = s => { try { window.localStorage.setItem(OV_STORE, JSON.stringify(s)) } catch { /* private mode: in-memory only */ } }
export function openverseBudget() {
  if (!IS_BROWSER) return { ok: false, reason: 'not in a browser' }
  const s = readStore(), now = Date.now()
  if (now < s.until) return { ok: false, reason: `rate-limited until ${new Date(s.until).toLocaleTimeString('en-IN')}` }
  const hour = s.calls.filter(t => now - t < 3600e3).length, day = s.calls.filter(t => now - t < 86400e3).length
  if (hour >= OV_BUDGET.perHour) return { ok: false, reason: 'hourly lookup budget used' }
  if (day >= OV_BUDGET.perDay) return { ok: false, reason: 'daily lookup budget used' }
  return { ok: true }
}

async function liveOpenverse(key, ctx) {
  const s = readStore()
  const hit = s.hits[key]
  if (hit && Date.now() - hit.at < 14 * 86400e3) return hit.img || null
  if (!openverseBudget().ok) return null
  s.calls = [...s.calls.filter(t => Date.now() - t < 86400e3), Date.now()]; writeStore(s)
  const q = openverseQuery(ctx)
  const url = `${OV_API}?q=${encodeURIComponent(q)}&license=${OPENVERSE_LICENCES.join(',')}&page_size=20&mature=false&filter_dead=true`
  const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null
  const timer = ctl ? setTimeout(() => ctl.abort(), 8000) : null
  try {
    const r = await fetch(url, { signal: ctl?.signal })
    if (r.status === 429) { const ra = parseInt(r.headers.get('Retry-After') || '3600', 10); const s2 = readStore(); s2.until = Date.now() + (Number.isFinite(ra) ? ra : 3600) * 1000; writeStore(s2); return null }
    if (!r.ok) return null // server error: try again on a later visit, nothing cached
    const j = await r.json()
    const img = pickOpenverse(j?.results, ctx)
    const s3 = readStore(); s3.hits[key] = { at: Date.now(), img }; writeStore(s3)
    return img
  } catch { return null } finally { if (timer) clearTimeout(timer) }
}

export async function openverseImage({ city, district, state }, { live = OPENVERSE_LIVE } = {}) {
  const place = city || district
  if (!place) return null
  const key = `${place}|${state || ''}`
  const landmark = VERIFIED[key]?.landmark && VERIFIED[key].landmark !== place ? VERIFIED[key].landmark : null
  const ctx = { city, district, state, landmark }
  const manifest = await loadOpenverseManifest()
  const entry = manifest?.images?.[key]
  // Manifest entries are re-validated here, so a tightened rule also applies to stored results.
  if (entry?.raw) { const img = pickOpenverse([entry.raw], ctx); if (img) return img }
  if (entry && entry.raw === null) return null // measured: no acceptable result
  return live ? memo(`ov:${key}`, () => liveOpenverse(key, ctx)) : null
}

// ── Placeholder and the resolver ────────────────────────────────────────────────────────────
export function placeholderFor({ city, district, state }) {
  const name = city || district || state || 'Location'
  return { status: 'placeholder', src: null, alt: `${name}: no verified photograph`, landmark: null, source: null, licence: null, author: null, label: `${name}${state && name !== state ? `, ${state}` : ''}` }
}

// Resolve the identity image for a city (and/or district) in a state.
// `skip` is a set of image URLs that failed to load in the browser, so the next source is tried
// instead of jumping straight to the placeholder.
export async function resolveLocationImage({ city, district, state, allowAuto = PROVIDER_ENABLED, providerOn = PROVIDER_ENABLED, openverseOn = OPENVERSE_ENABLED, openverseLive = OPENVERSE_LIVE, skip = null }) {
  const usable = img => img && img.src && !(skip && skip.has(img.src))
  if (providerOn) {
    const tryKey = async key => {
      const v = VERIFIED[key]
      if (!v) return null
      const img = await memo(`v:${key}`, () => wikiImage(v.page))
      return usable(img) ? { ...img, status: 'verified', landmark: v.landmark, alt: `${v.landmark}, ${key.split('|')[0]}` } : null
    }
    if (city && state) { const r = await tryKey(`${city}|${state}`); if (r) return r }
    if (district && state) { const r = await tryKey(`${district}|${state}`); if (r) return r }
    if (allowAuto) {
      for (const [title, label] of [city && [`${city}, ${state}`, city], city && [city, city], district && [`${district} district`, `${district} district`]].filter(Boolean)) {
        const img = await memo(`a:${title}`, () => wikiImage(title))
        // Auto (unverified) Commons files must look like a photograph of the place: district
        // articles often lead with a locator map, flag or seal, which is not an identity photo.
        if (usable(img) && isPhotoFile(img.file)) return { ...img, status: 'auto', autoLabel: AUTO_LABEL, landmark: null, alt: `${label} (auto-resolved image, not hand-verified)` }
      }
    }
  }
  if (openverseOn) {
    for (const ctx of [city && { city, state }, district && district !== city && { district, state }].filter(Boolean)) {
      const img = await openverseImage(ctx, { live: openverseLive })
      if (usable(img)) return { ...img, status: 'auto', autoLabel: AUTO_LABEL }
    }
  }
  return placeholderFor({ city, district, state })
}

export const VERIFIED_COUNT = Object.keys(VERIFIED).length
