import React, { useState } from 'react'

// "If this is not controlled" — theory + chart. Grouped bars, one axis, two series:
//   No action      hours per outdoor worker inside the 12:00–16:00 danger window on days the
//                  forecast Heat Index reaches "Extreme Caution" or worse (4 h on such a day)
//   With protocol  the labour order moves outdoor work to 06:00–11:00 → 0 h
// Series are states, so they wear the status colours (serious / good) and are labelled, never
// colour-alone. Hover any bar for that day's forecast high, humidity, Heat Index and band.
// Data: utils/heatCosting.exposureSeries — forecast maxima + the day's real moisture.
const C = { no: '#f87171', with: '#4ade80', ink: '#e2e8f0', muted: '#94a3b8', grid: 'rgba(148,163,184,0.18)', surface: '#0f172a' }

export default function ConsequenceChart({ exposure, thresholdC, labourWindow = '06:00–11:00' }) {
  const [hover, setHover] = useState(null)
  const [theory, setTheory] = useState(false)
  const days = exposure?.days || []
  if (!days.length) return null
  const W = 360, H = 170, padL = 28, padR = 8, padT = 26, padB = 34
  const plotW = W - padL - padR, plotH = H - padT - padB
  const yMax = exposure.windowHours || 4
  const y = v => padT + plotH - (v / yMax) * plotH
  const groupW = plotW / days.length
  const barW = Math.min(14, (groupW - 10) / 2)
  const totalNo = exposure.totalNoAction
  const dangerousDays = days.filter(d => d.noAction > 0).length

  return (
    <div data-testid="consequence-chart">
      <div style={{ fontSize: 12, color: C.ink, marginBottom: 6 }}>
        <b style={{ color: C.no }}>{totalNo} h</b> of danger-window exposure per outdoor worker over the next 7 days without action
        {' '}· <b style={{ color: C.with }}>0 h</b> with the {labourWindow} labour order
        <span style={{ color: C.muted }}> · {dangerousDays} of {days.length} days at "Extreme Caution" or worse</span>
      </div>
      <div style={{ position: 'relative' }}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Danger-window exposure hours per outdoor worker, next seven days, no action versus with protocol" style={{ display: 'block', background: C.surface, borderRadius: 8 }}>
          {[0, 1, 2, 3, 4].filter(v => v <= yMax).map(v => (
            <g key={v}>
              <line x1={padL} x2={W - padR} y1={y(v)} y2={y(v)} stroke={C.grid} strokeWidth={1} />
              <text x={padL - 6} y={y(v) + 3} fontSize={9} fill={C.muted} textAnchor="end">{v}h</text>
            </g>
          ))}
          {days.map((d, i) => {
            const x0 = padL + i * groupW + (groupW - (barW * 2 + 2)) / 2
            const hNo = Math.max(0, y(0) - y(d.noAction))
            const hWith = Math.max(0, y(0) - y(d.withProtocol))
            const active = hover === i
            return (
              <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} style={{ cursor: 'default' }}>
                <rect x={padL + i * groupW} y={padT} width={groupW} height={plotH} fill={active ? 'rgba(148,163,184,0.08)' : 'transparent'} />
                <rect x={x0} y={y(d.noAction)} width={barW} height={hNo} fill={C.no} rx={hNo ? 3 : 0} opacity={active ? 1 : 0.9} />
                {hNo === 0 && <line x1={x0} x2={x0 + barW} y1={y(0)} y2={y(0)} stroke={C.no} strokeWidth={2} />}
                <rect x={x0 + barW + 2} y={y(d.withProtocol)} width={barW} height={hWith} fill={C.with} rx={hWith ? 3 : 0} />
                {hWith === 0 && <line x1={x0 + barW + 2} x2={x0 + barW * 2 + 2} y1={y(0)} y2={y(0)} stroke={C.with} strokeWidth={2} />}
                <text x={padL + i * groupW + groupW / 2} y={H - padB + 12} fontSize={9} fill={C.muted} textAnchor="middle">{(d.date || '').split(',')[0]}</text>
                <text x={padL + i * groupW + groupW / 2} y={H - padB + 23} fontSize={9} fill={d.noAction ? C.no : C.ink} textAnchor="middle" fontWeight={700}>{d.maxTemp != null ? `${d.maxTemp}°` : '—'}</text>
              </g>
            )
          })}
          <line x1={padL} x2={W - padR} y1={y(0)} y2={y(0)} stroke={C.muted} strokeWidth={1} />
          <text x={padL} y={14} fontSize={9} fill={C.muted}>hours inside 12:00–16:00 per worker</text>
        </svg>
        {totalNo === 0 && (
          <div data-testid="consequence-zero" style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none' }}>
            <div style={{ background: 'rgba(2,6,23,0.9)', border: '1px solid #334155', borderRadius: 8, padding: '8px 12px', fontSize: 11.5, color: C.ink, textAlign: 'center', maxWidth: '80%', lineHeight: 1.4 }}>
              ✅ <b>0 hours at risk this week.</b> No forecast day reaches "Extreme Caution", so outdoor workers face no danger-window exposure even without action.
            </div>
          </div>
        )}
        {hover != null && (
          <div style={{ position: 'absolute', left: `${Math.min(70, 8 + (hover / days.length) * 100)}%`, top: 24, background: '#020617', border: '1px solid #334155', borderRadius: 6, padding: '6px 8px', fontSize: 10, color: C.ink, pointerEvents: 'none', maxWidth: 190 }}>
            <b>{days[hover].date}</b><br />
            Forecast high {days[hover].maxTemp ?? '—'}°C{days[hover].rh != null ? ` · ${days[hover].rh}% RH` : ''}<br />
            {days[hover].heatIndex != null ? <>Heat Index {days[hover].heatIndex}°C · {days[hover].band}<br /></> : thresholdC ? <>vs IMD threshold {thresholdC}°C<br /></> : null}
            No action <b style={{ color: C.no }}>{days[hover].noAction} h</b> · with protocol <b style={{ color: C.with }}>{days[hover].withProtocol} h</b>
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 14, fontSize: 10, color: C.muted, marginTop: 6, flexWrap: 'wrap' }}>
        <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: C.no, verticalAlign: '-1px', marginRight: 4 }} />No action (work 09:00–17:00)</span>
        <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: C.with, verticalAlign: '-1px', marginRight: 4 }} />With protocol (work {labourWindow})</span>
        <span>· labels: forecast high</span>
      </div>
      <button type="button" data-testid="consequence-theory" onClick={() => setTheory(v => !v)} style={{ marginTop: 8, background: 'transparent', border: '1px solid #334155', color: '#fbbf24', borderRadius: 6, padding: '4px 9px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
        {theory ? 'Hide the theory' : 'Show the theory'}
      </button>
      {theory && (
        <div style={{ marginTop: 8, fontSize: 11, color: '#cbd5e1', lineHeight: 1.5 }}>
          <div><b>1 · Dose–response.</b> Heat illness is driven by <i>how hot</i> × <i>how long</i>. The US NWS Heat Index bands name the first factor: at "Extreme Caution" (≥ 32.2 °C) heat cramps and exhaustion become possible with prolonged exposure; at "Danger" (≥ 39.4 °C) they become likely and heat stroke possible; at "Extreme Danger" (≥ 51.7 °C) heat stroke is highly likely. The second factor is the time an outdoor worker spends in the hottest part of the day, 12:00–16:00.</div>
          <div style={{ marginTop: 6 }}><b>2 · What the chart measures.</b> For each forecast day the Heat Index is computed from the forecast maximum and the day's real moisture (dew point held constant, Magnus formula). If the band is "Extreme Caution" or worse, a worker on a normal 09:00–17:00 shift spends the full 4-hour danger window outdoors → <b style={{ color: C.no }}>4 h</b>. The protocol's labour order moves outdoor work to {labourWindow} → <b style={{ color: C.with }}>0 h</b> in the window. Totals are per worker; multiply by the outdoor workforce for the district's exposure-hours (no verified workforce count is held, so the chart stays per worker).</div>
          <div style={{ marginTop: 6 }}><b>3 · Why the hours matter.</b> At WBGT category 4–5 an acclimatised worker doing moderate work needs 30–40 minutes of rest per hour (US Army TB MED 507); without the order that rest is taken as heat casualties or lost output. Near a wet-bulb of 31 °C even healthy adults stop being able to shed heat (Vecellio et al. 2022). The chart does not estimate deaths or hospital admissions: no mortality model is held.</div>
          <div style={{ marginTop: 6, color: C.muted }}>Sources: NWS Heat Index bands · Rothfusz (1990) · Stull (2011) · ISO 7243 · TB MED 507 · Vecellio et al., J. Appl. Physiol. 132 (2022). Inputs: Open-Meteo 7-day maxima and current humidity.</div>
        </div>
      )}
    </div>
  )
}
