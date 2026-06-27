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

// Judging-day insurance: if the live Gemini call fails for ANY reason (rate limit, Google's
// "model overloaded" 503, network error, timeout), the AI tab must never look fully dead.
// This builds ONE templated answer for the single most likely demo question ("why is this
// city hot") from the SAME real live data the rest of the app already shows — not a fake
// number, just a canned sentence structure around real values — and is always rendered with
// an explicit "offline fallback" label so it's never mistaken for a live Gemini answer.
function isLikelyHeatQuestion(question) {
  return /\bhot\b|\bheat\b/i.test(question)
}

function buildFallbackAnswer({ city, lst, ndvi, ndbi, aqi }) {
  const tempPart = typeof lst === 'number' ? `${lst.toFixed(1)}°C surface temperature` : 'elevated surface temperatures'
  const vegPart = typeof ndvi === 'number' ? `only ${ndvi}% vegetation cover` : 'limited vegetation cover'
  const builtPart = typeof ndbi === 'number' ? `${ndbi}% built-up density` : 'a high built-up density'
  const aqiPart = typeof aqi === 'number' ? ` Air quality is also a factor here, with an AQI of ${aqi}.` : ''
  return `🔌 [Offline fallback answer — live AI is temporarily unavailable] ${city} is currently showing ${tempPart}, with ${vegPart} and ${builtPart} — dense built-up areas absorb and retain more heat than vegetated or water-covered land, especially with limited tree cover to provide shade and cooling through evapotranspiration.${aqiPart} This is a templated answer built from the same live data shown elsewhere on this dashboard, not a generated AI response.`
}

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
  const threadRef = useRef(null)
  const MAX_AUTO_RETRIES = 1 // only auto-retry once — if still rate-limited after that, stop and let the user retry manually instead of silently looping forever

  // Auto-scroll to the latest message whenever the thread grows or the typing
  // indicator appears/disappears, so the user never has to scroll down manually.
  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight
    }
  }, [chatHistory, aiLoading])

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

  // Shared by every "give up and tell the user" path (exhausted 429 retries, 503/busy
  // errors, network errors) — always attaches a retry affordance (rendered as a button in
  // the chat thread below) and, for the single most likely demo question, an immediate
  // offline fallback answer so the AI tab never reads as fully broken mid-demo. The user's
  // own message is already in chatHistory by the time this runs (added immediately on
  // submit, chat-app style), so this only appends the AI side of the turn.
  const appendBusyResponse = (question, displayMessage) => {
    const newMessages = [{ ai: displayMessage, isError: true, retryQuestion: question }]
    if (isLikelyHeatQuestion(question)) {
      newMessages.push({ ai: buildFallbackAnswer({ city, lst, ndvi, ndbi, aqi }), isFallback: true })
    }
    setChatHistory(prev => [...prev, ...newMessages])
  }

  const askQuestion = async (overrideQuestion) => {
    const question = (overrideQuestion ?? questionText).trim()
    if (!question || aiLoading) return
    if (Date.now() < cooldownUntil) return // still cooling down — button should already be disabled

    // Show the user's message immediately, like any real chat app, instead of waiting for
    // the AI's reply to arrive before either bubble appears.
    setChatHistory(prev => [...prev, { user: question }])
    setQuestionText('')
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
          setChatHistory(prev => [...prev, {
            ai: `⏱ AI is handling a lot of requests right now — retrying automatically in ${retrySec}s...`
          }])
        } else {
          // Already auto-retried and hit the limit again — this may be a
          // longer-lived quota, not a brief burst. Stop auto-retrying so we
          // don't hammer the API in a loop — show a clear busy message with a
          // manual retry button, and never leave the tab looking dead.
          appendBusyResponse(question, '⏱ AI is still handling a lot of requests right now. Please wait a moment and try again.')
        }
        return
      }

      if (!response.ok || !data) {
        throw new Error(data?.error || `Request failed with status ${response.status}`)
      }
      autoRetryAttemptsRef.current = 0
      setChatHistory(prev => [...prev, { ai: data.answer }])
    } catch (e) {
      const isTimeout = e.name === 'AbortError'
      const message = isTimeout
        ? `Timed out after ${ASK_AI_TIMEOUT_MS / 1000}s — the AI backend took too long to respond.`
        : e.message
      console.error('[AIAnalystPanel] request failed:', message, e)
      // Google's "model overloaded" 503 and similar busy/unavailable errors get the same
      // friendly busy-message + retry-button + offline-fallback treatment as exhausted 429
      // retries — judges/users should never see a raw API error string or a dead-looking tab.
      const isBusyError = /overloaded|unavailable|high demand|503/i.test(message)
      appendBusyResponse(question, isBusyError
        ? '⏱ AI is temporarily busy, please try again in a moment.'
        : `⚠️ ${message}`)
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

      {/* Scrollable conversation thread — full history, not just the last couple of turns,
          so users can scroll back through everything discussed this session. */}
      <div className="chat-thread" ref={threadRef}>
        {chatHistory.length === 0 && !aiLoading && (
          <div className="chat-empty-hint">
            {t('aiAnalyst.emptyHint', `Ask me anything about ${city}'s heat data, or tap a suggestion below to start.`)}
          </div>
        )}
        {chatHistory.map((msg, i) => (
          <div key={i} className={`chat-row ${msg.user ? 'user' : 'ai'}`}>
            <div className={`chat-bubble ${msg.user ? 'user' : 'ai'} ${msg.isError ? 'error' : ''} ${msg.isFallback ? 'fallback' : ''}`}>
              {msg.user || msg.ai}
            </div>
            {msg.isError && msg.retryQuestion && (
              <button
                type="button"
                className="chat-retry-btn"
                onClick={() => askQuestion(msg.retryQuestion)}
                disabled={aiLoading || cooldownSeconds > 0}
              >
                🔄 Retry
              </button>
            )}
          </div>
        ))}
        {aiLoading && (
          <div className="chat-row ai">
            <div className="chat-bubble ai typing">
              <span className="typing-dots"><span></span><span></span><span></span></span>
              {t('aiAnalyst.thinking', 'AI is thinking...')}
            </div>
          </div>
        )}
      </div>

      {/* Pinned bottom bar — last item in this fixed-height flex column, so the input is
          always visible without scrolling the thread to find it. */}
      <div className="chat-input-bar">
        <div className="chat-suggestions">
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

        <div className="chat-input-row">
          <input
            type="text"
            value={questionText}
            onChange={e => setQuestionText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') askQuestion() }}
            placeholder={t('aiAnalyst.inputPlaceholder', 'Ask about heat, weather, or this city...')}
            style={{
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
          <button
            onClick={() => askQuestion()}
            className="ai-button chat-send-btn"
            disabled={askDisabled}
          >
            {aiLoading
              ? '⏳'
              : cooldownSeconds > 0
                ? `⏱ ${cooldownSeconds}s`
                : `${t('buttons.askAI', 'Ask AI')} 🛰️`}
          </button>
        </div>
      </div>
    </div>
  )
}
