// Netlify Function equivalent of api/ask-ai.js, for deployments using
// Netlify instead of Vercel. Reused via the same server-side-only callGemini()
// helper so both deploy targets share one code path and one place the
// GEMINI_API_KEY env var is read from.
import { handleAskAI, getClientKey, AskAIError } from '../../api/_lib/askAI.js'

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed. Use POST.' }) }
  }

  try {
    let body
    try {
      body = JSON.parse(event.body || '{}')
    } catch {
      return { statusCode: 400, body: JSON.stringify({ error: 'Request body must be valid JSON.', retryAfterSeconds: null }) }
    }
    const { question, context } = body
    const clientKey = getClientKey(event.headers, 'unknown')
    console.log('[netlify/ask-ai] incoming request:', { question, context, clientKey })
    const { answer } = await handleAskAI({ question, context, clientKey })
    console.log('[netlify/ask-ai] Gemini answered:', answer.slice(0, 120))
    return { statusCode: 200, body: JSON.stringify({ answer }) }
  } catch (err) {
    const status = err instanceof AskAIError ? err.status : 500
    const retryAfterSeconds = err instanceof AskAIError ? err.retryAfterSeconds : null
    console.error('[netlify/ask-ai] error:', status, err.message)
    const headers = retryAfterSeconds ? { 'Retry-After': String(retryAfterSeconds) } : undefined
    return { statusCode: status, headers, body: JSON.stringify({ error: err.message || 'Internal server error.', retryAfterSeconds }) }
  }
}
