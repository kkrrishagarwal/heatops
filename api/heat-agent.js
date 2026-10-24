// Vercel serverless function: /api/heat-agent
//   POST — run the Agent37 Heat Response Co-Pilot for one city (falls back to the
//          rule-based protocol, labelled, if the agent cannot answer)
//   GET  — configuration / reachability ping; also wakes a sleeping Agent37 instance
// The Agent37 key (process.env.AGENT37_API_KEY, server-side only) never reaches the browser.
import { handleHeatAgent, pingHeatAgent, HeatAgentError } from './_lib/heatAgent.js'
import { getClientKey } from './_lib/askAI.js'

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS'); res.setHeader('Access-Control-Allow-Headers', 'Content-Type'); res.setHeader('Access-Control-Max-Age', '86400'); return res.status(204).end() }
  res.setHeader('Cache-Control', 'no-store')
  if (req.method === 'GET') return res.status(200).json(await pingHeatAgent())
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST')
    return res.status(405).json({ error: 'Method not allowed. Use GET or POST.' })
  }
  try {
    const clientKey = getClientKey(req.headers, req.socket?.remoteAddress)
    const result = await handleHeatAgent({ body: req.body, clientKey })
    console.log('[api/heat-agent]', result.source, result.reason || result.meta?.elapsedMs)
    return res.status(200).json(result)
  } catch (err) {
    const status = err instanceof HeatAgentError ? err.status : 500
    if (err?.retryAfterSeconds) res.setHeader('Retry-After', String(err.retryAfterSeconds))
    console.error('[api/heat-agent] error:', status, err.message)
    return res.status(status).json({ error: err.message || 'Internal server error.', retryAfterSeconds: err?.retryAfterSeconds ?? null })
  }
}
