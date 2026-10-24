// Vercel serverless function: which sponsor integrations are switched on (booleans only —
// never the keys). Used by the "Technology partners" panel in AI + Export.
export default function handler(req, res) {
  const on = k => !!(process.env[k] || '').trim()
  res.setHeader('Cache-Control', 'no-store')
  res.status(200).json({
    agent37: on('AGENT37_API_KEY') && on('AGENT37_INSTANCE_ID'),
    gateway: on('LLM_GATEWAY_URL') && on('LLM_GATEWAY_KEY'),
    gemini: on('GEMINI_API_KEY'),
    elevenlabs: on('ELEVENLABS_API_KEY'),
    browserUse: on('BROWSER_USE_API_KEY'),
    mobileApi: true
  })
}
