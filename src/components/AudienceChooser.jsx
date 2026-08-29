import React from 'react'

// Shown once, right after sign-in, when the user has never picked an audience mode. English only.
// Two big choices; "Skip" opens the full (authority) dashboard. Citizen is presented
// first as the simpler default. The choice is stored and can be changed later from the
// profile / settings menu ("View: Citizen ⚙️") — deliberately not from the header.
export default function AudienceChooser({ onChoose, userName }) {
  const card = (accent) => ({
    flex: '1 1 240px',
    maxWidth: 320,
    background: '#1e293b',
    border: `1px solid ${accent}`,
    borderRadius: 14,
    padding: '22px 20px',
    textAlign: 'left',
    color: '#e2e8f0',
    cursor: 'pointer',
    boxShadow: '0 8px 28px rgba(0,0,0,0.35)',
    transition: 'transform 0.15s ease, border-color 0.15s ease'
  })

  return (
    <div
      data-testid="audience-chooser"
      style={{
        minHeight: '100vh',
        background: '#0f172a',
        color: '#e2e8f0',
        fontFamily: 'Inter, system-ui, sans-serif',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24
      }}
    >
      <div style={{ maxWidth: 720, width: '100%' }}>
        <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.12em', color: '#d97706', marginBottom: 6 }}>BHASKAR OPS</div>
        <h1 style={{ fontSize: 26, margin: '0 0 6px', fontWeight: 800 }}>
          {typeof userName === 'string' && userName.trim().length >= 2 ? `Welcome, ${userName.trim()}. ` : 'Welcome. '}Who are you?
        </h1>
        <p style={{ color: '#94a3b8', fontSize: 14, margin: '0 0 22px', lineHeight: 1.5 }}>
          Choose how much detail you want. You can switch any time from your profile menu.
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
          <button
            type="button"
            onClick={() => onChoose('citizen')}
            style={card('rgba(217,119,6,0.7)')}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)' }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'none' }}
          >
            <div style={{ fontSize: 34, marginBottom: 8 }}>🧑‍🤝‍🧑</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#d97706' }}>Citizen</div>
            <div style={{ fontSize: 12, color: '#cbd5e1', marginTop: 6, lineHeight: 1.5 }}>
              Simple view: your city's temperature, a plain-language risk level, air quality,
              and what to do today. Ask AGNI anything about staying safe in the heat.
            </div>
            <div style={{ marginTop: 12, fontSize: 11, color: '#94a3b8' }}>Recommended for residents & families</div>
          </button>

          <button
            type="button"
            onClick={() => onChoose('authority')}
            style={card('rgba(148,163,184,0.35)')}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)' }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'none' }}
          >
            <div style={{ fontSize: 34, marginBottom: 8 }}>🏛️</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#e2e8f0' }}>Government / Planner</div>
            <div style={{ fontSize: 12, color: '#cbd5e1', marginTop: 6, lineHeight: 1.5 }}>
              Full technical dashboard: satellite indices, ML model, city comparison,
              intervention calculators, exports and the complete AGNI analyst.
            </div>
            <div style={{ marginTop: 12, fontSize: 11, color: '#94a3b8' }}>For officials, planners & researchers</div>
          </button>
        </div>

        <button
          type="button"
          onClick={() => onChoose('authority')}
          style={{
            marginTop: 20, background: 'transparent', border: 'none', color: '#94a3b8',
            fontSize: 13, cursor: 'pointer', textDecoration: 'underline', padding: 0
          }}
        >
          Skip, show me everything →
        </button>
      </div>
    </div>
  )
}
