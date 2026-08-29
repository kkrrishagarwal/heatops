import React from 'react'

// Segmented "🧑 Citizen | 🏛️ Authority" control — the audience switch for the Laptop
// navbars (the mobile ☰ drawer has its own row). Same look as ViewModeToggle so the two
// independent axes (audience vs. density) read as a pair.
export default function AudienceToggle({ audience, onChange, size = 'sm' }) {
  const options = [
    { value: 'citizen', label: '🧑 Citizen', title: 'Citizen view — the essentials in plain language' },
    { value: 'authority', label: '🏛️ Authority', title: 'Authority view — the full technical dashboard' }
  ]
  const fontSize = size === 'sm' ? 9 : 11
  const pad = size === 'sm' ? '4px 8px' : '6px 10px'
  return (
    <div
      role="group"
      aria-label="Audience"
      style={{
        display: 'inline-flex', alignItems: 'stretch', flexShrink: 0,
        border: '1px solid rgba(148,163,184,0.35)', borderRadius: 6, overflow: 'hidden',
        background: 'rgba(15,23,42,0.6)'
      }}
    >
      {options.map(opt => {
        const active = opt.value === audience
        return (
          <button
            key={opt.value}
            type="button"
            title={opt.title}
            aria-pressed={active}
            onClick={() => { if (!active) onChange?.(opt.value) }}
            style={{
              background: active ? 'rgba(148,163,184,0.25)' : 'transparent',
              color: active ? '#f8fafc' : '#94a3b8',
              border: 'none', padding: pad, fontSize, fontWeight: 700, letterSpacing: '0.06em',
              cursor: active ? 'default' : 'pointer', whiteSpace: 'nowrap', minHeight: 28,
              transition: 'background 0.15s ease, color 0.15s ease'
            }}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
