// Vercel serverless function: ElevenLabs text-to-speech for public heat / cold alerts.
//   GET  /api/voice-alert            → { configured }
//   POST /api/voice-alert {text,lang} → audio/mpeg (the alert read aloud; Hindi or English)
// Server-side key only: ELEVENLABS_API_KEY (+ optional ELEVENLABS_VOICE_ID, ELEVENLABS_MODEL).
// The multilingual model reads Devanagari Hindi natively. Text is capped and rate-limited so
// the credits are spent only on real alert previews.
const MAX_CHARS = 700
const hits = new Map()

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS'); res.setHeader('Access-Control-Allow-Headers', 'Content-Type'); res.setHeader('Access-Control-Max-Age', '86400'); return res.status(204).end() }
  const key = (process.env.ELEVENLABS_API_KEY || '').trim()
  if (req.method === 'GET') { res.setHeader('Cache-Control', 'no-store'); return res.status(200).json({ configured: !!key, provider: 'ElevenLabs' }) }
  if (req.method !== 'POST') { res.setHeader('Allow', 'GET, POST'); return res.status(405).json({ error: 'Use GET or POST.' }) }
  if (!key) return res.status(503).json({ error: 'ElevenLabs is not configured on this server (ELEVENLABS_API_KEY).' })
  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'anon').split(',')[0].trim()
  const now = Date.now(); const recent = (hits.get(ip) || []).filter(t => now - t < 60000)
  if (recent.length >= 6) return res.status(429).json({ error: 'Too many voice requests — wait a minute.' })
  hits.set(ip, [...recent, now])
  let body = req.body
  if (typeof body === 'string') { try { body = JSON.parse(body) } catch { body = {} } }
  const text = String(body?.text || '').replace(/\s+/g, ' ').trim().slice(0, MAX_CHARS)
  if (!text) return res.status(400).json({ error: 'Missing "text".' })
  const voice = (process.env.ELEVENLABS_VOICE_ID || 'JBFqnCBsd6RMkjVDRZzb').trim()
  const model = (process.env.ELEVENLABS_MODEL || 'eleven_multilingual_v2').trim()
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 30000)
  try {
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}?output_format=mp3_44100_128`, {
      method: 'POST', signal: ctl.signal,
      headers: { 'xi-api-key': key, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
      body: JSON.stringify({ text, model_id: model, voice_settings: { stability: 0.55, similarity_boost: 0.75 } })
    })
    if (!r.ok) { const d = await r.text().catch(() => ''); return res.status(502).json({ error: `ElevenLabs returned HTTP ${r.status}`, detail: d.slice(0, 200) }) }
    const buf = Buffer.from(await r.arrayBuffer())
    res.setHeader('Content-Type', 'audio/mpeg'); res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Voice-Provider', 'ElevenLabs')
    return res.status(200).send(buf)
  } catch (e) {
    return res.status(502).json({ error: e.name === 'AbortError' ? 'ElevenLabs did not answer within 30 s.' : `Could not reach ElevenLabs (${e.message}).` })
  } finally { clearTimeout(t) }
}
