// Hackyard LLM Gateway (team credits) — an OpenAI-compatible chat-completions endpoint.
// Configure on the server only (never VITE_-prefixed):
//   LLM_GATEWAY_URL    base URL from the Hackyard portal, e.g. https://<gateway>/v1
//   LLM_GATEWAY_KEY    the team API key
//   LLM_GATEWAY_MODEL  model id offered by the gateway (default gpt-4o-mini)
// Used by the Heat Co-Pilot (after Agent37, before Gemini) and by AGNI (before Gemini).
export function gatewayConfig() {
  const url = (process.env.LLM_GATEWAY_URL || '').trim().replace(/\/+$/, '')
  const key = (process.env.LLM_GATEWAY_KEY || '').trim()
  if (!url || !key) return null
  return { url, key, model: (process.env.LLM_GATEWAY_MODEL || 'gpt-4o-mini').trim() }
}

export async function gatewayChat({ system, messages, json = false, maxTokens = 2048, temperature = 0.3, timeoutMs = 45000 }) {
  const cfg = gatewayConfig()
  if (!cfg) return { ok: false, reason: 'Hackyard LLM Gateway is not configured on this server.' }
  const started = Date.now()
  const endpoint = /\/chat\/completions$/.test(cfg.url) ? cfg.url : `${cfg.url}/chat/completions`
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), timeoutMs)
  try {
    const r = await fetch(endpoint, {
      method: 'POST', signal: ctl.signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.key}` },
      body: JSON.stringify({ model: cfg.model, temperature, max_tokens: maxTokens, messages: [...(system ? [{ role: 'system', content: system }] : []), ...messages], ...(json ? { response_format: { type: 'json_object' } } : {}) })
    })
    const data = await r.json().catch(() => null)
    if (!r.ok) return { ok: false, reason: `Hackyard LLM Gateway returned HTTP ${r.status}${data?.error?.message ? `: ${String(data.error.message).slice(0, 120)}` : ''}.` }
    const text = data?.choices?.[0]?.message?.content || ''
    if (!text) return { ok: false, reason: 'Hackyard LLM Gateway returned an empty answer.' }
    return { ok: true, text, meta: { model: data?.model || cfg.model, tokens: data?.usage?.total_tokens ?? null, elapsedMs: Date.now() - started, provider: 'Hackyard LLM Gateway' } }
  } catch (e) {
    return { ok: false, reason: e.name === 'AbortError' ? `Hackyard LLM Gateway did not answer within ${Math.round(timeoutMs / 1000)} s.` : `Could not reach the Hackyard LLM Gateway (${e.message}).` }
  } finally { clearTimeout(t) }
}
