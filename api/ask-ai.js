// Vercel serverless function: POST /api/ask-ai
// The frontend calls this endpoint instead of Gemini's API directly, so the
// Gemini API key (process.env.GEMINI_API_KEY, server-side only) never reaches
// the browser bundle or any request the client makes.
import { callGemini, AskAIError } from './_lib/askAI.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed. Use POST.' })
  }

  try {
    const { question, context } = req.body || {}
    console.log('[api/ask-ai] incoming request:', { question, context })
    const { answer } = await callGemini({ question, context })
    console.log('[api/ask-ai] Gemini answered:', answer.slice(0, 120))
    return res.status(200).json({ answer })
  } catch (err) {
    const status = err instanceof AskAIError ? err.status : 500
    const retryAfterSeconds = err instanceof AskAIError ? err.retryAfterSeconds : null
    console.error('[api/ask-ai] error:', status, err.message)
    return res.status(status).json({ error: err.message || 'Internal server error.', retryAfterSeconds })
  }
}
