import React, { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

// Shared AI Analyst UI + logic — used by both the AI+Export tab panel and the
// floating quick-access assistant, so behavior (free-text question, suggestion
// chips, chat history, loading state) stays identical no matter where it's
// opened from.
//
// Calls the secure backend proxy (POST /api/ask-ai) instead of Gemini's API
// directly — the Gemini API key lives only in the server-side GEMINI_API_KEY
// env var and is never sent to or held by the browser.

// Module-level (not React state) so the cooldown is shared across EVERY
// mounted AIAnalystPanel instance — the AI+Export tab panel and the floating
// assistant can both be mounted at once, and one of them firing a request (or
// getting rate-limited) should block the other from immediately firing too.
let cooldownUntil = 0
const MIN_GAP_MS = 4000 // minimum gap enforced between any two Ask AI calls

export function AIAnalystPanel({
  cityName, ensoPhase, lst, ndvi, ndbi, aqi,
  chatHistory, setChatHistory, aiLoading, setAiLoading,
  selectedQuestion, setSelectedQuestion
}) {
  const { t } = useTranslation()
  const city = cityName || 'this city'
  const [questionText, setQuestionText] = useState('')
  const [cooldownSeconds, setCooldownSeconds] = useState(0)
  const autoRetryRef = useRef(null)
  const autoRetryAttemptsRef = useRef(0)
  const MAX_AUTO_RETRIES = 1 // only auto-retry once — if still rate-limited after that, stop and let the user retry manually instead of silently looping forever

  const suggestions = [
    `Why is ${city} so hot right now?`,
    `How does ${ensoPhase} impact ${city} weather?`,
    `What are best 3 cooling interventions for ${city}?`,
    `Write HeatOps 2026 report conclusion for ${city}`
  ]

  const ASK_AI_TIMEOUT_MS = 15000

  // Polls the shared cooldown timestamp so this instance's button reflects a
  // cooldown started by ANY AIAnalystPanel instance, and drives the visible
  // countdown + auto-retry once it reaches 0.
  useEffect(() => {
    const id = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000))
      setCooldownSeconds(prev => (prev === remaining ? prev : remaining))
      if (remaining === 0 && autoRetryRef.current) {
        const pending = autoRetryRef.current
        autoRetryRef.current = null
        askQuestion(pending)
      }
    }, 250)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const askQuestion = async (overrideQuestion) => {
    const question = (overrideQuestion ?? questionText).trim()
    if (!question || aiLoading) return
    if (Date.now() < cooldownUntil) return // still cooling down — button should already be disabled

    setAiLoading(true)

    const context = `City: ${city}, Surface Temp: ${typeof lst === 'number' ? lst.toFixed(1) + '°C (live)' : 'not available'}, Vegetation Fraction: ${typeof ndvi === 'number' ? ndvi + '% (ESA WorldCover)' : 'not available for this city'}, Built-up Fraction: ${typeof ndbi === 'number' ? ndbi + '% (ESA WorldCover)' : 'not available for this city'}, AQI: ${aqi ?? 'N/A'} (live).`
    const requestBody = { question, context }
    console.log('[AIAnalystPanel] sending request to /api/ask-ai:', requestBody)

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), ASK_AI_TIMEOUT_MS)

    try {
      const response = await fetch('/api/ask-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      })
      const data = await response.json().catch(() => null)
      console.log('[AIAnalystPanel] response status:', response.status, 'body:', data)

      if (response.status === 429) {
        // Never show Gemini's raw rate-limit error text/JSON in the UI — log
        // it for debugging, show a clean message, and auto-retry once the
        // exact retry delay Gemini reported (or a 15s fallback) has passed.
        console.error('[AIAnalystPanel] rate limited by Gemini:', data)
        const retrySec = Number.isFinite(data?.retryAfterSeconds) && data.retryAfterSeconds > 0
          ? Math.ceil(data.retryAfterSeconds)
          : 15
        cooldownUntil = Date.now() + retrySec * 1000

        if (autoRetryAttemptsRef.current < MAX_AUTO_RETRIES) {
          autoRetryAttemptsRef.current += 1
          autoRetryRef.current = question
          setChatHistory([...chatHistory, { user: question }, {
            ai: `⏱ AI is handling a lot of requests right now — retrying automatically in ${retrySec}s...`
          }])
        } else {
          // Already auto-retried and hit the limit again — this may be a
          // longer-lived quota, not a brief burst. Stop auto-retrying so we
          // don't hammer the API in a loop; let the user retry manually.
          setChatHistory([...chatHistory, { user: question }, {
            ai: `⏱ AI is still handling a lot of requests. Please wait a bit and press "Ask AI" again.`
          }])
        }
        return
      }

      if (!response.ok || !data) {
        throw new Error(data?.error || `Request failed with status ${response.status}`)
      }
      autoRetryAttemptsRef.current = 0
      setChatHistory([...chatHistory, { user: question }, { ai: data.answer }])
    } catch (e) {
      const isTimeout = e.name === 'AbortError'
      const message = isTimeout
        ? `Timed out after ${ASK_AI_TIMEOUT_MS / 1000}s — the AI backend took too long to respond.`
        : e.message
      console.error('[AIAnalystPanel] request failed:', message, e)
      setChatHistory([...chatHistory, { user: question }, { ai: `⚠️ ${message}` }])
    } finally {
      clearTimeout(timeout)
      setAiLoading(false)
      // Debounce: keep the button disabled briefly after every request so
      // rapid repeated clicks can't immediately fire another call. Uses
      // Math.max so it never shortens a longer rate-limit cooldown set above.
      cooldownUntil = Math.max(cooldownUntil, Date.now() + MIN_GAP_MS)
    }
  }

  const askDisabled = aiLoading || !questionText.trim() || cooldownSeconds > 0

  return (
    <div className="ai-terminal">
      <div className="terminal-header">🔴🟡🟢 AI Analyst v2.0</div>

      <input
        type="text"
        value={questionText}
        onChange={e => setQuestionText(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') askQuestion() }}
        placeholder={t('aiAnalyst.inputPlaceholder', 'Ask about heat, weather, or this city...')}
        style={{
          width: '100%',
          marginTop: 8,
          background: '#0a0e1a',
          border: '1px solid #1a2a4a',
          borderRadius: 8,
          padding: '10px 14px',
          color: '#fff',
          fontSize: 13,
          outline: 'none',
          boxSizing: 'border-box',
          transition: 'border-color 0.2s'
        }}
        onFocus={e => { e.currentTarget.style.borderColor = '#00ff88' }}
        onBlur={e => { e.currentTarget.style.borderColor = '#1a2a4a' }}
      />

      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 6,
        marginTop: 8
      }}>
        {suggestions.map((option, index) => (
          <button
            key={index}
            type="button"
            onClick={() => {
              setQuestionText(option)
              setSelectedQuestion(index)
            }}
            style={{
              background: index === selectedQuestion ? 'rgba(0,255,136,0.12)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${index === selectedQuestion ? '#00ff88' : '#1a2a4a'}`,
              borderRadius: 14,
              padding: '5px 10px',
              color: index === selectedQuestion ? '#00ff88' : 'rgba(255,255,255,0.7)',
              fontSize: 11,
              cursor: 'pointer',
              transition: 'background 0.15s, border-color 0.15s'
            }}
          >
            {option}
          </button>
        ))}
      </div>

      <button
        onClick={() => askQuestion()}
        className="ai-button"
        disabled={askDisabled}
      >
        {aiLoading
          ? '⏳ Analyzing...'
          : cooldownSeconds > 0
            ? `⏱ Wait ${cooldownSeconds}s`
            : `${t('buttons.askAI', 'Ask AI')} 🛰️`}
      </button>
      <div className="chat-display">
        {chatHistory.slice(-2).map((msg, i) => (
          <div key={i} className={`chat-bubble ${msg.user ? 'user' : 'ai'}`}>
            {msg.user || msg.ai}
          </div>
        ))}
      </div>
    </div>
  )
}
