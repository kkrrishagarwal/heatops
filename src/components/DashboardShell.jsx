import React, { useEffect, useMemo, useState } from 'react'
import LocationImage from './LocationImage'

// Executive Intelligence Dashboard shell: persistent left sidebar (the six workspaces, in the
// brief's order) + shared header (identity, metadata, status, search, return to the Command
// Center). It wraps the existing tab content unchanged; the selected city is App's single
// state, so switching workspaces never resets it. `enabled` false (phone layout) renders the
// children untouched so the existing dropdown navigation keeps working there.
const C = { bg: '#060B14', card: '#0B1325', raised: '#111827', border: '#1F2937', cyan: '#38BDF8', amber: '#F59E0B', red: '#EF4444', text: '#E6EDF7', muted: '#93A4B8' }
export const WORKSPACES = [
  { id: 'Overview', label: 'Overview', sub: 'City Intelligence Command Center', icon: '◧' },
  { id: 'Prediction', label: 'Prediction', sub: 'Forecast Intelligence', icon: '◷' },
  { id: 'Analysis', label: 'Analysis', sub: 'Geospatial Heat Intelligence', icon: '◈' },
  { id: 'Compare', label: 'Compare', sub: 'Multi-City Intelligence', icon: '⫼' },
  { id: 'Interventions', label: 'Interventions', sub: 'Heat Action & Resource Planning', icon: '⚒' },
  { id: 'AI + Export', label: 'AI + Export', sub: 'Decision Support Workspace', icon: '✦' }
]
const CITIZEN_WORKSPACES = [
  { id: 'Overview', label: 'Overview', sub: 'Today in your city', icon: '◧' },
  { id: 'What to do', label: 'What to do', sub: 'Stay safe today', icon: '☂' },
  { id: 'Compare', label: 'Compare', sub: 'Other cities', icon: '⫼' }
]

function istClock() { return new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false }) }

export default function DashboardShell({
  enabled = true, children, activeTab, onTab, citizen = false, city, state, coords, elevation,
  status = 'live', statusAge = '', demoTemp = null, allCities = [], liveCityCache = {}, onSelectCity, onBack, onSignOut, userName = '', controls = null
}) {
  const [clock, setClock] = useState(istClock)
  const [q, setQ] = useState('')
  useEffect(() => { const id = setInterval(() => setClock(istClock()), 30000); return () => clearInterval(id) }, [])
  const results = useMemo(() => {
    const s = q.trim().toLowerCase(); if (s.length < 2) return []
    const rank = c => { const n = c.city.toLowerCase(); return n.startsWith(s) ? 0 : n.split(/[\s-]/).some(w => w.startsWith(s)) ? 1 : n.includes(s) ? 2 : c.state.toLowerCase().includes(s) ? 3 : 9 }
    return allCities.map(c => ({ c, r: rank(c) })).filter(x => x.r < 9).sort((a, b) => a.r - b.r || a.c.city.localeCompare(b.c.city)).slice(0, 8).map(x => x.c)
  }, [q, allCities])
  if (!enabled) return <>{children}</>

  const ws = citizen ? CITIZEN_WORKSPACES : WORKSPACES
  const pill = status === 'demo'
    ? { text: `DEMO · ${demoTemp}°C forced`, bg: 'rgba(245,158,11,0.15)', fg: C.amber, border: 'rgba(245,158,11,0.5)' }
    : status === 'cached'
      ? { text: `CACHED · ${statusAge}`, bg: 'rgba(245,158,11,0.12)', fg: C.amber, border: 'rgba(245,158,11,0.4)' }
      : status === 'offline'
        ? { text: 'OFFLINE · cached', bg: 'rgba(239,68,68,0.15)', fg: C.red, border: 'rgba(239,68,68,0.5)' }
        : { text: `LIVE · ${statusAge}`, bg: 'rgba(16,185,129,0.12)', fg: '#10B981', border: 'rgba(16,185,129,0.4)' }

  return (
    <div data-testid="dashboard-shell" style={{ display: 'grid', gridTemplateColumns: '212px minmax(0, 1fr)', flex: 1, minHeight: 0, background: C.bg, color: C.text }}>
      {/* SIDEBAR */}
      <aside aria-label="Workspaces" style={{ background: C.card, borderRight: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', padding: '14px 10px', gap: 4, overflowY: 'auto' }}>
        <button type="button" onClick={onBack} title="Return to the National Command Map" data-testid="shell-back" style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'transparent', border: `1px solid ${C.border}`, color: C.muted, borderRadius: 8, padding: '7px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer', marginBottom: 10, textAlign: 'left' }}>
          <span aria-hidden="true">←</span> Command Center
        </button>
        <div style={{ fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', color: C.muted, padding: '2px 10px 6px' }}>Workspaces</div>
        {ws.map((w, i) => {
          const on = activeTab === w.id
          return (
            <button key={w.id} type="button" onClick={() => onTab(w.id)} aria-current={on ? 'page' : undefined} data-testid={`ws-${w.id.replace(/\W+/g, '-').toLowerCase()}`}
              style={{ display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', background: on ? 'rgba(56,189,248,0.10)' : 'transparent', border: `1px solid ${on ? 'rgba(56,189,248,0.45)' : 'transparent'}`, borderLeft: `3px solid ${on ? C.cyan : 'transparent'}`, color: on ? C.text : C.muted, borderRadius: 8, padding: '9px 10px', cursor: 'pointer' }}>
              <span aria-hidden="true" style={{ width: 18, textAlign: 'center', color: on ? C.cyan : C.muted, fontSize: 14 }}>{w.icon}</span>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 12, fontWeight: 800, letterSpacing: '0.02em' }}>{String(i + 1).padStart(2, '0')} · {w.label}</span>
                <span style={{ display: 'block', fontSize: 9.5, color: C.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{w.sub}</span>
              </span>
            </button>
          )
        })}
        <div style={{ marginTop: 'auto', padding: '10px 10px 0', fontSize: 9.5, color: C.muted, lineHeight: 1.4 }}>
          <div style={{ fontWeight: 800, color: C.amber, letterSpacing: '0.08em' }}>BHASKAR OPS</div>
          <div>Heat-risk intelligence · Team B26-0322</div>
          <div style={{ marginTop: 6 }}>{userName ? `Signed in as ${userName}` : ''}</div>
          <button type="button" onClick={onSignOut} style={{ marginTop: 6, background: 'transparent', border: `1px solid ${C.border}`, color: C.muted, borderRadius: 6, padding: '4px 8px', fontSize: 10, cursor: 'pointer' }}>Sign out</button>
        </div>
      </aside>

      {/* MAIN */}
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 }}>
        <header style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '8px 18px', background: C.card, borderBottom: `1px solid ${C.border}`, minHeight: 56 }}>
          <LocationImage city={city} state={state} size="chip" />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 800, lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{city}<span style={{ color: C.muted, fontWeight: 500 }}>, {state}</span></div>
            <div style={{ fontSize: 10, color: C.muted, fontVariantNumeric: 'tabular-nums' }}>
              {coords && typeof coords.lat === 'number' ? `${coords.lat.toFixed(3)}°N ${coords.lon.toFixed(3)}°E` : 'coordinates unavailable'}{typeof elevation === 'number' ? ` · ${Math.round(elevation)} m elevation (SRTM)` : ''}
            </div>
          </div>
          <span data-testid="shell-status" style={{ fontSize: 10, fontWeight: 800, padding: '3px 9px', borderRadius: 999, background: pill.bg, color: pill.fg, border: `1px solid ${pill.border}`, whiteSpace: 'nowrap' }}>{pill.text}</span>
          <span style={{ fontSize: 11, color: C.muted, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{clock} IST</span>
          <div style={{ position: 'relative', marginLeft: 'auto', width: 300, maxWidth: '30vw' }}>
            <input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && results[0]) { onSelectCity(results[0].city, results[0].state); setQ('') } if (e.key === 'Escape') setQ('') }}
              placeholder="Search another city…" data-testid="shell-search" aria-label="Search cities"
              style={{ width: '100%', background: C.raised, border: `1px solid ${C.border}`, color: C.text, borderRadius: 8, padding: '7px 10px', fontSize: 12 }} />
            {results.length > 0 && (
              <ul style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, margin: '4px 0 0', padding: 0, listStyle: 'none', background: '#0B1325', border: `1px solid ${C.border}`, borderRadius: 8, boxShadow: '0 12px 30px rgba(0,0,0,0.5)', maxHeight: 280, overflowY: 'auto' }}>
                {results.map(r => { const live = liveCityCache?.[`${r.city}|${r.state}`]; return (
                  <li key={`${r.city}|${r.state}`}><button type="button" onClick={() => { onSelectCity(r.city, r.state); setQ('') }} style={{ display: 'flex', justifyContent: 'space-between', width: '100%', background: 'transparent', border: 'none', color: C.text, padding: '7px 10px', fontSize: 12, cursor: 'pointer', textAlign: 'left' }}>
                    <span>{r.city} <span style={{ color: C.muted }}>· {r.state}</span></span><span style={{ color: C.muted, fontVariantNumeric: 'tabular-nums' }}>{typeof live?.temp === 'number' ? `${live.temp}°C` : '—'}</span>
                  </button></li>) })}
              </ul>
            )}
          </div>
          {controls}
        </header>
        {children}
      </div>
    </div>
  )
}
