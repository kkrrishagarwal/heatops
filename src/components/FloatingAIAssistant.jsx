import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AIAnalystPanel } from './AIAnalystPanel'

// Floating quick-access entry point to the AI Analyst — visible on the map
// screen and every dashboard tab, so the user never has to switch to the
// AI+Export tab just to ask a question. Reuses AIAnalystPanel (same component
// the AI+Export tab uses) so behavior is identical; this is purely an
// additional entry point, not a second AI integration.
export function FloatingAIAssistant({
  cityName,
  ensoPhase,
  lst,
  ndvi,
  ndbi,
  aqi,
  chatHistory,
  setChatHistory,
  aiLoading,
  setAiLoading,
  selectedQuestion,
  setSelectedQuestion,
  questionDropOpen,
  setQuestionDropOpen
}) {
  const { t } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        aria-label="Open AGNI"
        style={{
          // Bottom-right corner rather than vertically-centered-left: centering
          // guaranteed overlap with whatever card/panel/tab content occupies the
          // viewport's middle on every screen (map legend, sliders, chat text,
          // weather card — confirmed at 375/428/768px), since real content also
          // starts from the left edge. Bottom-right stayed clear at every
          // breakpoint audited. env(safe-area-inset-*) keeps it clear of notches/
          // home-indicators on phones that have them.
          position: 'fixed',
          right: 'calc(16px + env(safe-area-inset-right, 0px))',
          bottom: 'calc(16px + env(safe-area-inset-bottom, 0px))',
          zIndex: 2000,
          width: 52,
          height: 52,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #0a0e1a, #0d1528)',
          border: '2px solid #00d4ff',
          boxShadow: isOpen ? 'none' : '0 0 18px rgba(0,212,255,0.45)',
          color: '#00d4ff',
          fontSize: 22,
          cursor: 'pointer',
          display: isOpen ? 'none' : 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'box-shadow 0.2s'
        }}
      >
        🤖
      </button>

      <div
        style={{
          // Slides in from the right to stay anchored to its trigger button's
          // new bottom-right position (was a left drawer matching the old
          // left-edge button).
          position: 'fixed',
          top: 0,
          right: 0,
          height: '100vh',
          width: 'min(380px, 92vw)',
          background: 'rgba(10,14,26,0.98)',
          borderLeft: '1px solid #1a2a4a',
          boxShadow: isOpen ? '0 0 40px rgba(0,212,255,0.2)' : 'none',
          transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.25s ease',
          zIndex: 2001,
          display: 'flex',
          flexDirection: 'column',
          padding: 20,
          boxSizing: 'border-box',
          overflowY: 'auto'
        }}
      >
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 14
        }}>
          <div>
            <h3 style={{ margin: 0, color: '#fff', fontSize: 15 }}>
              🤖 {t('panels.aiAnalyst', 'AGNI')}
            </h3>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>
              {t('panels.aiAnalystFullName', 'Analytical Ground-level heat iNtelligence Interface')}
            </div>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            aria-label="Close AGNI"
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: 6,
              color: '#cbd5e1',
              width: 28,
              height: 28,
              cursor: 'pointer',
              fontSize: 14
            }}
          >✕</button>
        </div>

        {cityName ? (
          <AIAnalystPanel
            cityName={cityName}
            ensoPhase={ensoPhase}
            lst={lst}
            ndvi={ndvi}
            ndbi={ndbi}
            aqi={aqi}
            chatHistory={chatHistory}
            setChatHistory={setChatHistory}
            aiLoading={aiLoading}
            setAiLoading={setAiLoading}
            selectedQuestion={selectedQuestion}
            setSelectedQuestion={setSelectedQuestion}
            questionDropOpen={questionDropOpen}
            setQuestionDropOpen={setQuestionDropOpen}
          />
        ) : (
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
            {t('tooltips.clickCityToAnalyze', '👆 Click any city above to analyze')}
          </div>
        )}
      </div>
    </>
  )
}
