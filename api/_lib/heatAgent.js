// Agent37 Heat Response Co-Pilot — shared server logic for POST /api/heat-agent (Vercel
// function, Vite dev middleware). The browser sends the selected city's readings; this
// module asks an Agent37-hosted agent (Hermes by default) for a structured municipal Heat
// Action Protocol and returns it.
//
// Secrets: AGENT37_API_KEY and AGENT37_INSTANCE_ID are server-side env vars (no VITE_
// prefix), so they never reach the browser bundle.
//
// Never-fail contract: every outcome except bad input (400) and rate limiting (429) returns
// 200 with a usable plan. If Agent37 is not configured, asleep past the time budget, down,
// or answers with something that is not valid plan JSON, the deterministic rule-based
// protocol (src/utils/heatActionProtocol.js) is returned instead, with `source: 'fallback'`
// and the reason — the UI labels it, and never presents it as agent output.
import { buildFallbackPlan, sanitisePlan, PLAN_SCHEMA_TEXT, activationLevel } from '../../src/utils/heatActionProtocol.js'

export class HeatAgentError extends Error {
  constructor(status, message, retryAfterSeconds = null) {
    super(message)
    this.status = status
    this.retryAfterSeconds = retryAfterSeconds
  }
}

// Vercel's function limit is 60 s (vercel.json); leave headroom to send the fallback.
const AGENT_TIMEOUT_MS = Number(process.env.AGENT37_TIMEOUT_MS) || 50000
const PING_TIMEOUT_MS = 8000

function agentConfig() {
  const key = process.env.AGENT37_API_KEY
  const instance = (process.env.AGENT37_INSTANCE_ID || '').trim()
  // The instance id becomes a hostname — accept only a plain id, never a URL or a dot.
  if (!key || !/^[a-z0-9-]{4,64}$/i.test(instance)) return null
  // AGENT37_BASE_URL (server env only) points at a mock for local testing; unset in production.
  const base = /^https?:\/\/[^\s]+$/.test(process.env.AGENT37_BASE_URL || '') ? process.env.AGENT37_BASE_URL.replace(/\/$/, '') : `https://${instance}.agent37.app`
  return { key, instance, base }
}

// ── Rate limit: 6 runs / minute per client (in memory, per warm instance) ────
const RATE_MAX = 6
const RATE_WINDOW_MS = 60_000
const buckets = new Map()
function checkRate(clientKey, now = Date.now()) {
  const key = clientKey || 'unknown'
  const hits = (buckets.get(key) || []).filter(t => t > now - RATE_WINDOW_MS)
  if (hits.length >= RATE_MAX) return { allowed: false, retryAfterSeconds: Math.ceil((hits[0] + RATE_WINDOW_MS - now) / 1000) }
  hits.push(now)
  buckets.set(key, hits)
  if (buckets.size > 5000) buckets.delete(buckets.keys().next().value)
  return { allowed: true }
}

// ── Input sanitising: the body is untrusted ──────────────────────────────────
const num = (v, lo, hi) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : null)
const str = (v, max) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f<>`]/g, ' ').trim().slice(0, max) : '')

export function sanitiseInput(body) {
  if (!body || typeof body !== 'object') throw new HeatAgentError(400, 'Request body must be a JSON object.')
  const city = str(body.city, 60)
  if (!city) throw new HeatAgentError(400, 'Missing "city".')
  const c = body.current || {}
  const s = body.stress || {}
  const o = body.outlook || {}
  const lc = body.landCover || {}
  const forecast = Array.isArray(body.forecast) ? body.forecast.slice(0, 7).map(d => ({ date: str(d?.date, 24), maxTemp: num(d?.maxTemp, -40, 60), minTemp: num(d?.minTemp, -50, 50) })) : []
  return {
    city,
    state: str(body.state, 60),
    elevation: num(body.elevation, -100, 9000),
    current: { temp: num(c.temp, -40, 60), humidity: num(c.humidity, 0, 100), feelsLike: num(c.feelsLike, -50, 80), windSpeed: num(c.windSpeed, 0, 300), uvIndex: num(c.uvIndex, 0, 20) },
    today: { maxTemp: num(body.today?.maxTemp, -40, 60), minTemp: num(body.today?.minTemp, -50, 50) },
    forecast,
    outlook: { worst: str(o.worst, 12), headline: str(o.headline, 160), threshold: num(o.threshold, 20, 50), thresholdKind: str(o.thresholdKind, 10), spell: o.spell ? { from: str(o.spell.from, 24), to: str(o.spell.to, 24), days: num(o.spell.days, 0, 7), peak: num(o.spell.peak, -40, 60) } : null, firstHotDay: str(o.firstHotDay, 24) || null },
    stress: { heatIndex: num(s.heatIndex, -60, 90), heatIndexBandKey: str(s.heatIndexBandKey, 20), heatIndexBandLabel: str(s.heatIndexBandLabel, 30), wetBulb: num(s.wetBulb, -60, 50), wbgt: num(s.wbgt, -60, 50), wbgtCat: num(s.wbgtCat, 0, 5), workRest: str(s.workRest, 40), peakTime: str(s.peakTime, 16), peakWbgt: num(s.peakWbgt, -60, 50) },
    landCover: { builtUp: num(lc.builtUp, 0, 100), vegetation: num(lc.vegetation, 0, 100), treeCover: num(lc.treeCover, 0, 100), isFallback: lc.isFallback === true, fallbackCity: str(lc.fallbackCity, 60) },
    risk: { score: num(body.risk?.score, 0, 100), label: str(body.risk?.label, 20) },
    demo: body.demo === true
  }
}

function buildPrompt(input) {
  const act = activationLevel(input)
  return `You are the Heat Response Co-Pilot for an Indian district administration, running inside BhaskarOps (an urban heat monitoring platform). Produce a municipal Heat Action Protocol for the city below, following India's NDMA heat-wave guidelines and the Ahmedabad Heat Action Plan model.

STRICT RULES
- Use ONLY the numbers in DATA. Do not invent ward names, population counts, facility counts, hospital names or routes — the platform holds no ward, population or facility-location data. Describe zones by type (e.g. "dense built-up core", "labour chowks", "construction sites").
- Owners must be district roles, not named people.
- If a value is missing, say what is missing in "assumptions" rather than guessing.
- The rule-based pre-assessment below is a guide; you may change the level only with a reason stated in "situation".
- Do not browse or run tools; answer directly from DATA.
- Reply with ONE JSON object only — no markdown fences, no text before or after — matching this schema:
${PLAN_SCHEMA_TEXT}

RULE-BASED PRE-ASSESSMENT
level: ${act.level} (${act.reasons.join('; ')})

DATA
${JSON.stringify(input)}`
}

// Pull the first balanced {...} block out of the agent's text (it may add stray prose
// or a ```json fence despite instructions).
export function extractJson(text) {
  if (typeof text !== 'string') return null
  const start = text.indexOf('{')
  if (start < 0) return null
  let depth = 0, inStr = false, esc = false
  for (let i = start; i < text.length; i++) {
    const ch = text[i]
    if (inStr) { if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === '"') inStr = false; continue }
    if (ch === '"') inStr = true
    else if (ch === '{') depth++
    else if (ch === '}' && --depth === 0) {
      try { return JSON.parse(text.slice(start, i + 1)) } catch { return null }
    }
  }
  return null
}

async function fetchWithTimeout(url, opts, ms) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), ms)
  try { return await fetch(url, { ...opts, signal: ctrl.signal }) } finally { clearTimeout(timer) }
}

async function callAgent37(cfg, input) {
  const started = Date.now()
  let res
  try {
    res = await fetchWithTimeout(`${cfg.base}/v1/responses`, {
      method: 'POST',
      headers: { 'X-Agent37-Key': cfg.key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: buildPrompt(input), stream: false, reasoning_effort: 'low', metadata: { app: 'bhaskarops', feature: 'heat-copilot', city: input.city.slice(0, 40) } })
    }, AGENT_TIMEOUT_MS)
  } catch (err) {
    return { ok: false, reason: err?.name === 'AbortError' ? `Agent37 did not answer within ${Math.round(AGENT_TIMEOUT_MS / 1000)} s (the instance may still be waking from sleep — try again in a minute).` : `Could not reach the Agent37 instance (${err?.message || 'network error'}).` }
  }
  const text = await res.text().catch(() => '')
  let data = null
  try { data = JSON.parse(text) } catch { /* handled below */ }
  if (!res.ok) {
    const code = data?.error?.code || data?.error?.type || ''
    return { ok: false, reason: `Agent37 returned HTTP ${res.status}${code ? ` (${code})` : ''}.` }
  }
  if (!data || data.status !== 'completed') {
    return { ok: false, reason: `Agent37 turn ${data?.status || 'unreadable'}${data?.error?.message ? `: ${String(data.error.message).slice(0, 160)}` : ''}.` }
  }
  const plan = sanitisePlan(extractJson(data.output_text))
  if (!plan) return { ok: false, reason: 'Agent37 answered, but not with a valid plan (JSON missing or no actions).' }
  return {
    ok: true,
    plan,
    meta: {
      responseId: typeof data.id === 'string' ? data.id.slice(0, 80) : null,
      sessionId: typeof data.session_id === 'string' ? data.session_id.slice(0, 80) : null,
      agent: typeof data.agent === 'string' ? data.agent.slice(0, 30) : null,
      model: typeof data.model === 'string' ? data.model.slice(0, 60) : null,
      costUsd: typeof data.usage?.cost_usd === 'number' ? data.usage.cost_usd : null,
      tokens: typeof data.usage?.input_tokens === 'number' ? data.usage.input_tokens + (data.usage.output_tokens || 0) : null,
      elapsedMs: Date.now() - started,
      instance: cfg.instance
    }
  }
}

export async function handleHeatAgent({ body, clientKey }) {
  const input = sanitiseInput(body)
  const limit = checkRate(clientKey)
  if (!limit.allowed) throw new HeatAgentError(429, `Too many Co-Pilot runs — please wait ${limit.retryAfterSeconds}s.`, limit.retryAfterSeconds)
  const generatedAt = new Date().toISOString()
  const cfg = agentConfig()
  if (!cfg) {
    return { source: 'fallback', reason: 'Agent37 is not configured on this server (AGENT37_API_KEY / AGENT37_INSTANCE_ID not set).', plan: buildFallbackPlan(input), generatedAt }
  }
  const out = await callAgent37(cfg, input)
  if (out.ok) return { source: 'agent37', plan: out.plan, meta: out.meta, generatedAt }
  console.warn('[heat-agent] falling back:', out.reason)
  return { source: 'fallback', reason: out.reason, plan: buildFallbackPlan(input), generatedAt }
}

// GET /api/heat-agent — status + wake-up ping. Hitting the instance URL wakes a sleeping
// instance, so the panel calls this on mount and the real run starts warm.
export async function pingHeatAgent() {
  const cfg = agentConfig()
  if (!cfg) return { configured: false, reachable: false }
  try {
    const res = await fetchWithTimeout(`${cfg.base}/v1/health`, { headers: { 'X-Agent37-Key': cfg.key } }, PING_TIMEOUT_MS)
    return { configured: true, reachable: res.ok, status: res.status, instance: cfg.instance }
  } catch (err) {
    return { configured: true, reachable: false, waking: err?.name === 'AbortError', instance: cfg.instance }
  }
}
