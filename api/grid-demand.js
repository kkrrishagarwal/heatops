// Vercel serverless function: live state electricity demand from the Ministry of Power's
// Vidyut PRAVAH portal, read by a Browser Use cloud agent (Cloud API v4; no scraping code of
// our own). The agent is given a JSON schema, so the answer comes back parsed.
//   GET /api/grid-demand                 → { configured }
//   GET /api/grid-demand?state=Rajasthan → cached value, or { status: 'running', task } (a run was started)
//   GET /api/grid-demand?state=…&task=ID → poll; { status: 'finished', demandMW, peakMW, asOf, … } when done
// Server-side key only: BROWSER_USE_API_KEY (optional BROWSER_USE_API_BASE, default https://api.browser-use.com/api/v4).
// Each run is capped at MAX_COST_USD; results are cached for 15 minutes per state to spend credits sparingly.
const BASE = () => (process.env.BROWSER_USE_API_BASE || 'https://api.browser-use.com/api/v4').replace(/\/+$/, '')
const MAX_COST_USD = 1
const OUTPUT_SCHEMA = { type: 'object', properties: { state: { type: 'string' }, current_demand_mw: { type: ['number', 'null'] }, peak_demand_met_mw: { type: ['number', 'null'] }, as_of: { type: ['string', 'null'] }, page_url: { type: 'string' } }, required: ['state', 'current_demand_mw', 'peak_demand_met_mw', 'as_of', 'page_url'] }
const cache = new Map() // state → { at, data }
const TTL = 15 * 60e3
const slug = s => String(s).toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const headers = key => ({ 'Content-Type': 'application/json', 'X-Browser-Use-API-Key': key })

function taskText(state) {
  return `Open https://vidyutpravah.in/state-data/${slug(state)} (the Government of India "Vidyut PRAVAH" power portal). ` +
    `Read the electricity figures shown for ${state}: the current demand met in MW and yesterday's peak demand met in MW, and the time the page says the data is for. ` +
    `If the state page does not load, open https://vidyutpravah.in and read the same figures for ${state} from the map or list. ` +
    `Return the figures in MW as numbers (convert GW to MW; strip commas). Use null for anything not shown on the page. Do not guess numbers that are not on the page.`
}
function parseOutput(out) {
  if (!out) return null
  const txt = typeof out === 'string' ? out : JSON.stringify(out)
  const m = txt.match(/\{[\s\S]*\}/)
  try { return JSON.parse(m ? m[0] : txt) } catch { return null }
}

export default async function handler(req, res) {
  const key = (process.env.BROWSER_USE_API_KEY || '').trim()
  res.setHeader('Cache-Control', 'no-store')
  const state = typeof req.query?.state === 'string' ? req.query.state.trim().slice(0, 60) : ''
  if (!state) return res.status(200).json({ configured: !!key, provider: 'Browser Use', source: 'Vidyut PRAVAH (Ministry of Power)' })
  if (!key) return res.status(503).json({ error: 'Browser Use is not configured on this server (BROWSER_USE_API_KEY).' })
  const hit = cache.get(state)
  if (hit && Date.now() - hit.at < TTL) return res.status(200).json({ ...hit.data, cached: true })
  const task = typeof req.query?.task === 'string' ? req.query.task.replace(/[^\w-]/g, '').slice(0, 80) : ''
  try {
    if (!task) {
      const r = await fetch(`${BASE()}/runs`, { method: 'POST', headers: headers(key), body: JSON.stringify({ task: taskText(state), outputSchema: OUTPUT_SCHEMA, maxCostUsd: MAX_COST_USD }) })
      const d = await r.json().catch(() => ({}))
      if (!r.ok || !d.id) return res.status(502).json({ error: `Browser Use did not start the run (HTTP ${r.status})`, detail: JSON.stringify(d).slice(0, 200) })
      return res.status(202).json({ status: 'running', task: d.id, state })
    }
    const r = await fetch(`${BASE()}/runs/${task}`, { headers: headers(key) })
    const d = await r.json().catch(() => ({}))
    if (!r.ok) return res.status(502).json({ error: `Browser Use run lookup failed (HTTP ${r.status})` })
    const st = String(d.status || '').toLowerCase()
    if (['queued', 'dispatching', 'running'].includes(st)) return res.status(202).json({ status: 'running', task, state })
    if (st !== 'completed') return res.status(502).json({ status: st || 'failed', error: d.error ? `Browser Use: ${String(d.error).slice(0, 160)}` : 'The Browser Use agent could not read the page.', task })
    const o = (d.output && typeof d.output === 'object') ? d.output : parseOutput(d.result)
    const num = v => (typeof v === 'number' && isFinite(v) ? Math.round(v) : (typeof v === 'string' && /\d/.test(v) ? Math.round(parseFloat(v.replace(/,/g, ''))) : null))
    const data = { status: 'finished', state, demandMW: num(o?.current_demand_mw), peakMW: num(o?.peak_demand_met_mw), asOf: o?.as_of || null, pageUrl: o?.page_url || `https://vidyutpravah.in/state-data/${slug(state)}`, source: 'Vidyut PRAVAH (Ministry of Power) via Browser Use', fetchedAt: new Date().toISOString(), task }
    if (data.demandMW == null && data.peakMW == null) return res.status(502).json({ ...data, status: 'empty', error: 'The page was read but no MW figure was found for this state.' })
    cache.set(state, { at: Date.now(), data })
    return res.status(200).json(data)
  } catch (e) {
    return res.status(502).json({ error: `Could not reach Browser Use (${e.message}).` })
  }
}
