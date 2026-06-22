// Shared server-side Gemini API logic. Used by both the Vercel serverless
// function (api/ask-ai.js), the Netlify function (netlify/functions/ask-ai.js),
// and the Vite dev-server middleware (vite.config.js) so local dev and
// production hit the exact same code path.
//
// The Gemini API key is read from process.env.GEMINI_API_KEY — a SERVER-side
// env var with no VITE_ prefix, so Vite never inlines it into the client bundle
// and it never reaches the browser.

const GEMINI_MODEL = 'gemini-2.5-flash'
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`
const MAX_TOKENS = 400
const GEMINI_TIMEOUT_MS = 12000 // fail before the frontend's 15s timeout fires

export class AskAIError extends Error {
  constructor(status, message, retryAfterSeconds = null) {
    super(message)
    this.status = status
    this.retryAfterSeconds = retryAfterSeconds
  }
}

// Gemini's 429 responses include a structured google.rpc.RetryInfo detail
// with a "13s"-style retryDelay string — pull the exact wait time out of it
// so the frontend can show a real countdown instead of a guessed one.
function parseRetryAfterSeconds(errorBody) {
  const details = errorBody?.error?.details
  if (!Array.isArray(details)) return null
  const retryInfo = details.find(d => typeof d?.['@type'] === 'string' && d['@type'].includes('RetryInfo'))
  const match = /^(\d+(?:\.\d+)?)s$/.exec(retryInfo?.retryDelay || '')
  return match ? Math.ceil(parseFloat(match[1])) : null
}

export async function callGemini({ question, context }) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new AskAIError(500, 'Server is missing GEMINI_API_KEY. Set it as a server-side environment variable (not VITE_-prefixed).')
  }
  if (!question || typeof question !== 'string') {
    throw new AskAIError(400, 'Missing "question" in request body.')
  }

  // City data is passed as background the model MAY draw on, not text forced
  // into the prompt ahead of every question — that's what was making every
  // answer ("hi", "what model are you", etc.) turn into a forced climate report.
  const systemPrompt = `You are an AI assistant embedded in a climate/heat monitoring dashboard. You have access to the currently selected city's live weather, AQI, and satellite data as background context: ${context || 'no live city data is currently available'}. Answer the user's actual question naturally and helpfully. If they ask about weather, heat, or climate for this city, use the provided data. If they ask something unrelated, casual, or a general question, respond normally and naturally — do not force climate data into unrelated answers. If they're testing you or asking something unexpected, respond sensibly and honestly rather than defaulting to a climate report. Keep answers concise (a few sentences) unless the question genuinely calls for more detail.`

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS)

  let response
  try {
    response = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ parts: [{ text: question }] }],
        // gemini-2.5-flash spends output tokens on internal "thinking" by default,
        // which was eating the whole maxOutputTokens budget and truncating every
        // answer (finishReason: MAX_TOKENS). Disabling it for these short Q&A calls.
        generationConfig: { maxOutputTokens: MAX_TOKENS, thinkingConfig: { thinkingBudget: 0 } }
      }),
      signal: controller.signal
    })
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new AskAIError(504, `Gemini API did not respond within ${GEMINI_TIMEOUT_MS / 1000}s (timed out).`)
    }
    throw new AskAIError(502, `Could not reach Gemini API: ${err.message}`)
  } finally {
    clearTimeout(timeout)
  }

  const data = await response.json()

  if (!response.ok) {
    const retryAfterSeconds = response.status === 429 ? parseRetryAfterSeconds(data) : null
    throw new AskAIError(response.status, data?.error?.message || 'Gemini API request failed.', retryAfterSeconds)
  }

  const answer = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'No response'
  return { answer }
}
