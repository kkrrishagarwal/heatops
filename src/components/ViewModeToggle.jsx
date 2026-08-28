import React from 'react'

// Segmented "📱 Mobile | 💻 Laptop" control. One shared component for every navbar so
// the two modes are always switchable from the same place. The names describe the
// LAYOUT, not the device: anyone can pick either one on any screen — internally
// they are still the 'compact' / 'full' view modes (see hooks/useViewMode.js).
export default function ViewModeToggle({ mode, onChange, size = 'sm' }) {
  const options = [
    { value: 'compact', label: '📱 Mobile', title: 'Mobile layout — stacked panels, simple cards, full-width map (works on any device)' },
    { value: 'full', label: '💻 Laptop', title: 'Laptop layout — map and detailed panels side by side (works on any device)' }
  ]
  const fontSize = size === 'sm' ? 9 : 11
  const pad = size === 'sm' ? '4px 8px' : '6px 10px'

  return (
    <div
      role="group"
      aria-label="Layout"
      style={{
        display: 'inline-flex',
        alignItems: 'stretch',
        flexShrink: 0,
        border: '1px solid rgba(217,119,6,0.45)',
        borderRadius: 6,
        overflow: 'hidden',
        background: 'rgba(15,23,42,0.6)'
      }}
    >
      {options.map(opt => {
        const active = opt.value === mode
        return (
          <button
            key={opt.value}
            type="button"
            title={opt.title}
            aria-pressed={active}
            onClick={() => { if (!active) onChange?.(opt.value) }}
            style={{
              background: active ? '#d97706' : 'transparent',
              color: active ? '#0f172a' : '#94a3b8',
              border: 'none',
              padding: pad,
              fontSize,
              fontWeight: 700,
              letterSpacing: '0.08em',
              cursor: active ? 'default' : 'pointer',
              whiteSpace: 'nowrap',
              minHeight: 28,
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
