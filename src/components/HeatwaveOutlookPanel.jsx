import React from 'react'
import { useTranslation } from 'react-i18next'
import PanelIcon from './PanelIcon'
import { buildOutlook, LEVEL_COLOR, IMD_RULE } from '../utils/heatwaveOutlook'

// 7-DAY HEATWAVE OUTLOOK — the "predict the heatwave" panel. Forecast maxima from
// Open-Meteo (the same call that feeds the weather card), classified with IMD's published
// thresholds. It is a forecast plus a published rule, not an IMD warning, and says so.
// Optional `plan` (from the Smart Mitigation Planner / sliders) draws the "do nothing vs
// with plan" contrast: relief measures apply this week; cooling is a multi-season effect.
export default function HeatwaveOutlookPanel({ forecast, elevation, isCoastal, city, plan = null }) {
  const { t } = useTranslation()
  const o = buildOutlook(forecast, { elevation, isCoastal })
  if (!o) return null
  const worst = o.worst
  const headline = worst === 'severe' ? t('outlook.severe', 'Severe heatwave conditions forecast')
    : worst === 'heatwave' ? t('outlook.heatwave', 'Heatwave conditions forecast')
    : worst === 'watch' ? t('outlook.watch', 'Above IMD threshold on some days — watch')
    : worst === 'warm' ? t('outlook.warm', 'Warm week, below the heatwave threshold')
    : t('outlook.normal', 'No heatwave conditions in the next 7 days')
  const spell = o.spells[0]
  const maxT = Math.max(...o.days.map(d => d.maxTemp ?? 0), o.threshold.t + 5)
  const minT = Math.min(...o.days.map(d => d.minTemp ?? 99), o.threshold.t - 10)
  const y = v => 100 - ((v - minT) / (maxT - minT)) * 100
  return (
    <section className="panel" data-panel="OUTLOOK" style={{ borderLeft: `4px solid ${LEVEL_COLOR[worst]}` }}>
      <h3><PanelIcon name="calendar" /> {t('outlook.title', '7-DAY HEATWAVE OUTLOOK')}</h3>
      <div data-testid="outlook-headline" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', margin: '4px 0 8px' }}>
        <span style={{ background: LEVEL_COLOR[worst], color: '#fff', fontWeight: 800, fontSize: 11, padding: '3px 10px', borderRadius: 999, letterSpacing: 0.4 }}>{headline}</span>
        {spell && <span style={{ fontSize: 12, color: '#e2e8f0' }} data-testid="outlook-spell">{t('outlook.spell', '{{days}}-day spell {{from}} → {{to}}, peak {{peak}}°C', { days: spell.days, from: spell.from, to: spell.to, peak: spell.peak })}</span>}
        {!spell && o.peak && <span style={{ fontSize: 12, color: '#cbd5e1' }}>{t('outlook.peakDay', 'Hottest day {{date}}, {{t}}°C', { date: o.peak.date, t: o.peak.maxTemp })}</span>}
      </div>
      {/* 7 columns: day, max bar with threshold line */}
      <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, height: 132, alignItems: 'end', padding: '18px 0 0' }}>
        <div style={{ position: 'absolute', left: 0, right: 0, top: `calc(18px + ${y(o.threshold.t)}% * 0.78)`, borderTop: '1px dashed rgba(234,179,8,0.7)', pointerEvents: 'none' }}>
          <span style={{ position: 'absolute', left: 0, top: -14, fontSize: 9, color: '#fbbf24', background: 'rgba(15,23,42,0.85)', padding: '0 4px', borderRadius: 3 }}>{t('outlook.thresholdLabel', 'IMD {{kind}} threshold {{t}}°C', { kind: o.threshold.kind, t: o.threshold.t })}</span>
        </div>
        {o.days.map((d, i) => (
          <div key={i} data-outlook-day={d.level} title={`${d.date}: ${d.maxTemp}°C / ${d.minTemp}°C — ${d.label}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#f8fafc', marginBottom: 2 }}>{d.maxTemp}°</div>
            <div style={{ width: '70%', height: `${Math.max(6, (100 - y(d.maxTemp)) * 0.78)}%`, background: LEVEL_COLOR[d.level], borderRadius: '4px 4px 0 0', opacity: 0.92 }} />
            <div style={{ fontSize: 9, color: '#94a3b8', marginTop: 4, whiteSpace: 'nowrap' }}>{String(d.date).split(',')[0]}</div>
          </div>
        ))}
      </div>
      {plan && (
        <div data-testid="outlook-plan" style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div style={{ background: 'rgba(15,23,42,0.55)', border: '1px solid #1e293b', borderRadius: 8, padding: '8px 10px' }}>
            <div style={{ fontSize: 10, color: '#94a3b8', letterSpacing: 0.6 }}>{t('outlook.doNothing', 'IF NOTHING IS DONE')}</div>
            <div style={{ fontSize: 12, color: '#e2e8f0', lineHeight: 1.5 }}>{t('outlook.doNothingText', '{{n}} of 7 days at or above the threshold; no cooling centres, no water points, checklist not activated.', { n: o.days.filter(d => ['watch', 'heatwave', 'severe'].includes(d.level)).length })}</div>
          </div>
          <div style={{ background: 'rgba(217,119,6,0.08)', border: '1px solid rgba(217,119,6,0.4)', borderRadius: 8, padding: '8px 10px' }}>
            <div style={{ fontSize: 10, color: '#fbbf24', letterSpacing: 0.6 }}>{t('outlook.withPlan', 'WITH THE PLAN')}</div>
            <div style={{ fontSize: 12, color: '#e2e8f0', lineHeight: 1.5 }}>
              {t('outlook.withPlanText', 'This week: {{cooling}} cooling units open, the Heat Action Plan checklist activates on threshold days. This season and beyond: {{roofs}} cool roofs and {{ha}} ha of plantation projected to lower local surface heat — a multi-season effect, not a change to this week\'s forecast.', { cooling: plan.coolingUnits ?? 0, roofs: plan.roofs ?? 0, ha: plan.hectaresGreen ?? 0 })}
            </div>
          </div>
        </div>
      )}
      <div style={{ fontSize: 10, color: '#64748b', marginTop: 8, lineHeight: 1.5 }}>
        {t('outlook.source', 'Forecast maxima: Open-Meteo, 7 days, Asia/Kolkata. Classified with IMD\'s published thresholds ({{plains}} °C plains / {{coast}} °C coast / {{hills}} °C hills; ≥ {{abs}} °C heatwave, ≥ {{sev}} °C severe). The departure-from-normal rule needs a per-city climatological normal we do not hold, so this is a threshold-based outlook — not an IMD warning. Official warnings: mausam.imd.gov.in.', { plains: IMD_RULE.plains, coast: IMD_RULE.coast, hills: IMD_RULE.hills, abs: IMD_RULE.absolute, sev: IMD_RULE.severe })}
      </div>
    </section>
  )
}
