import React, { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

// Authority-only operational checklist, modelled on Indian Heat Action Plan (HAP)
// playbooks (Ahmedabad / NDMA guidelines): what a district team does once a city crosses
// the High/Extreme heat-risk threshold. Ticks are local (browser localStorage, per city)
// so the panel works as a live tool during a demo; nothing goes to a server.
const STORAGE_PREFIX = 'heatops_checklist:'

const STEPS = [
  { id: 'cooling', icon: '🏢', text: 'Activate public cooling centres / shaded rest points (public halls, temples, bus depots) and publish their locations.' },
  { id: 'health', icon: '🏥', text: 'Alert the district health department and hospitals to prepare heat-stroke wards, ORS stocks and ambulance readiness.' },
  { id: 'advisory', icon: '📣', text: 'Issue a public advisory via local media, SMS/WhatsApp and RWA channels — avoid 12–4 pm exposure, hydration, symptoms to watch.' },
  { id: 'water', icon: '🚰', text: 'Coordinate water tankers / supply to vulnerable localities (slums, construction sites, outdoor-worker clusters).' },
  { id: 'interventions', icon: '🌳', text: 'Review and prioritise Cool Roof / green-cover interventions for the highest-risk zones.', link: true }
]

function readTicks(key) {
  try { const v = JSON.parse(window.localStorage.getItem(key) || '{}'); return v && typeof v === 'object' ? v : {} } catch { return {} }
}

export default function HeatActionChecklist({ city, state, risk, temp, onOpenInterventions }) {
  const { t } = useTranslation()
  const key = `${STORAGE_PREFIX}${city || ''}|${state || ''}`
  const [ticks, setTicks] = useState(() => readTicks(key))
  useEffect(() => { setTicks(readTicks(key)) }, [key])

  const active = risk === 'High' || risk === 'Extreme'
  const done = STEPS.filter(s => ticks[s.id]).length

  const toggle = (id) => {
    setTicks(prev => {
      const next = { ...prev }
      if (next[id]) delete next[id]
      else next[id] = new Date().toISOString()
      try { window.localStorage.setItem(key, JSON.stringify(next)) } catch { /* session-only */ }
      return next
    })
  }
  const reset = () => { setTicks({}); try { window.localStorage.removeItem(key) } catch { /* ignore */ } }
  const fmt = (iso) => new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })

  const statusPill = useMemo(() => active
    ? { text: t('checklist.active', 'ACTIVE — {{risk}} heat risk, threshold crossed', { risk }), color: '#dc2626', border: 'rgba(185,28,28,0.6)', bg: 'rgba(185,28,28,0.12)' }
    : { text: t('checklist.standby', 'STANDBY — activates at High risk (now: {{risk}})', { risk: risk || '—' }), color: '#94a3b8', border: 'rgba(148,163,184,0.35)', bg: 'rgba(148,163,184,0.08)' },
  [active, risk, t])

  return (
    <section className="panel" data-panel="CHECKLIST" style={active ? { borderLeft: '4px solid #dc2626' } : undefined}>
      <h3>📋 {t('checklist.title', 'HEATWAVE ACTION CHECKLIST')}</h3>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
        <span data-testid="checklist-status" style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', color: statusPill.color, border: `1px solid ${statusPill.border}`, background: statusPill.bg, borderRadius: 999, padding: '3px 10px' }}>
          {statusPill.text}{typeof temp === 'number' ? ` · ${temp}°C` : ''}
        </span>
        <span style={{ fontSize: 11, color: '#cbd5e1' }}>
          <strong data-testid="checklist-progress">{done}/{STEPS.length}</strong> {t('checklist.done', 'done')}
          {done > 0 && (
            <button type="button" onClick={reset} style={{ marginLeft: 10, background: 'transparent', border: '1px solid rgba(148,163,184,0.35)', color: '#94a3b8', borderRadius: 4, padding: '2px 8px', fontSize: 10, cursor: 'pointer' }}>
              {t('checklist.reset', 'Reset')}
            </button>
          )}
        </span>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: 'rgba(148,163,184,0.15)', marginBottom: 12, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${(done / STEPS.length) * 100}%`, background: done === STEPS.length ? '#15803d' : '#d97706', transition: 'width 0.25s ease' }} />
      </div>
      <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {STEPS.map((s, i) => {
          const ticked = !!ticks[s.id]
          return (
            <li key={s.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 10px', borderRadius: 8, background: ticked ? 'rgba(21,128,61,0.10)' : 'rgba(148,163,184,0.06)', border: `1px solid ${ticked ? 'rgba(21,128,61,0.45)' : 'rgba(148,163,184,0.15)'}` }}>
              <button
                type="button"
                role="checkbox"
                aria-checked={ticked}
                aria-label={`Step ${i + 1}`}
                onClick={() => toggle(s.id)}
                style={{ width: 22, height: 22, flexShrink: 0, borderRadius: 5, border: `2px solid ${ticked ? '#22c55e' : 'rgba(148,163,184,0.6)'}`, background: ticked ? '#15803d' : 'transparent', color: '#f8fafc', fontSize: 13, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
              >
                {ticked ? '✓' : ''}
              </button>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, lineHeight: 1.5, color: ticked ? '#94a3b8' : '#e2e8f0', textDecoration: ticked ? 'line-through' : 'none' }}>
                  <span style={{ marginRight: 6 }}>{s.icon}</span>{i + 1}. {s.text}
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 4, flexWrap: 'wrap' }}>
                  {ticked && <span style={{ fontSize: 10, color: '#22c55e' }}>✓ {t('checklist.doneAt', 'done {{time}} IST', { time: fmt(ticks[s.id]) })}</span>}
                  {s.link && (
                    <button type="button" onClick={onOpenInterventions} style={{ background: 'transparent', border: '1px solid rgba(217,119,6,0.5)', color: '#d97706', borderRadius: 6, padding: '2px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                      {t('checklist.openInterventions', 'Open Interventions tab →')}
                    </button>
                  )}
                </div>
              </div>
            </li>
          )
        })}
      </ol>
      <div style={{ fontSize: 10, color: '#64748b', marginTop: 10, lineHeight: 1.5 }}>
        {t('checklist.note', 'Based on standard Heat Action Plan steps (NDMA guidelines / Ahmedabad HAP). Ticks are saved in this browser per city — an operational aid, not an official record.')}
      </div>
    </section>
  )
}
