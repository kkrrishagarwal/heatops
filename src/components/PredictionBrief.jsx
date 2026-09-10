import React, { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import PanelIcon from './PanelIcon'
import HeatwaveOutlookPanel from './HeatwaveOutlookPanel'
import MiniGridPair from './MiniGridPair'
import { buildOutlook, LEVEL_COLOR } from '../utils/heatwaveOutlook'
import { STEP_SETS } from './HeatActionChecklist'
import { getModisSummary } from '../utils/modisLst'
import { getLulcWithFallback } from '../utils/lulcFallback'
import { cityRiskProfile, optimisePlan, fmtINR, riskLabel, INTERVENTIONS } from '../utils/mitigationPlanner'

// PREDICTION tab — the District Magistrate's one-page brief for the coming week, in the order
// a DM thinks: when is it coming → how bad → what to do this week → where the money goes →
// who does what → what changes if you act. Every number is drawn from panels that already
// exist (outlook, planner, heat grid, checklist); nothing new is invented here.
const card = { background: 'rgba(15,23,42,0.55)', border: '1px solid #1e293b', borderRadius: 10, padding: '12px 14px' }
const label = { fontSize: 10, color: '#94a3b8', letterSpacing: 0.7, textTransform: 'uppercase', marginBottom: 4 }
const stepNo = (n, color) => ({ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, borderRadius: '50%', background: color, color: '#fff', fontSize: 11, fontWeight: 800, marginRight: 8, flex: '0 0 auto' })

// Which department owns each checklist step — for the "get your team on it" table.
const OWNER = {
  cooling: 'Municipal Commissioner / ULB', health: 'CMHO / District Health', advisory: 'District Information Officer', water: 'PHED / Jal Board', interventions: 'Urban Planning / Town Planner',
  monitor: 'DDMA control room', centres: 'Municipal Commissioner / ULB', tankers: 'PHED / Jal Board',
  shelters: 'Municipal Commissioner / ULB', coldadvisory: 'District Information Officer', coldhealth: 'CMHO / District Health', animals: 'Veterinary / Animal Husbandry'
}

export default function PredictionBrief({ city, state, liveWeather, liveCityCache, lulcReal, cityCoordsData, gridBase, treeSlider, roofSlider, waterSlider, onGoTo, cityPlan, isCoastal = false }) {
  const { t } = useTranslation()
  const [modis, setModis] = useState(null)
  const [budget, setBudget] = useState(10000000)
  useEffect(() => { let c = false; getModisSummary(city, state).then(m => { if (!c) setModis(m) }); return () => { c = true } }, [city, state])

  const outlook = useMemo(() => buildOutlook(liveWeather?.forecast, { elevation: liveWeather?.elevation, isCoastal }), [liveWeather, isCoastal])
  const profile = useMemo(() => {
    const live = liveCityCache?.[`${city}|${state}`]
    const lulc = lulcReal ? getLulcWithFallback(city, state, lulcReal, cityCoordsData) : null
    return cityRiskProfile({ city, state, temp: liveWeather?.current?.temp ?? live?.temp ?? null, tempMax: liveWeather?.today?.maxTemp ?? live?.tempMax ?? null, modisPeak: modis?.hottestDay?.c ?? null, lulc, facilities: null })
  }, [city, state, liveCityCache, lulcReal, cityCoordsData, liveWeather, modis])
  const plan = useMemo(() => (cityPlan && !cityPlan.error ? cityPlan : optimisePlan([profile], budget)), [profile, budget, cityPlan])

  if (!outlook) return <section className="panel" data-panel="PREDICTION"><h3><PanelIcon name="calendar" /> {t('predict.title', 'PREDICTION — DISTRICT BRIEF')}</h3><div style={{ fontSize: 12, color: '#94a3b8' }}>{t('predict.noForecast', 'No forecast for this city yet.')}</div></section>

  const hotDays = outlook.days.filter(d => ['watch', 'heatwave', 'severe'].includes(d.level))
  const spell = outlook.spells[0]
  const tier = outlook.worst === 'severe' || outlook.worst === 'heatwave' ? 'heat' : outlook.worst === 'watch' ? 'watch' : (liveWeather?.current?.temp ?? 99) < 10 ? 'cold' : 'routine'
  const steps = STEP_SETS[tier] || []
  const when = spell ? t('predict.whenSpell', 'Heatwave conditions from {{from}} — a {{n}}-day spell peaking at {{peak}}°C', { from: spell.from, n: spell.days, peak: spell.peak })
    : hotDays.length ? t('predict.whenDays', '{{n}} day(s) at or above the IMD threshold this week — first on {{d}}', { n: hotDays.length, d: hotDays[0].date })
    : t('predict.whenNone', 'No heatwave conditions in the next 7 days')
  const worstColor = LEVEL_COLOR[outlook.worst]
  const rl = riskLabel(profile.risk)

  return (
    <div data-panel="PREDICTION" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Header */}
      <section className="panel" style={{ borderLeft: `4px solid ${worstColor}` }}>
        <h3><PanelIcon name="calendar" /> {t('predict.title', 'PREDICTION — DISTRICT BRIEF FOR {{city}}', { city: (city || '').toUpperCase() })}</h3>
        <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 10 }}>{t('predict.subtitle', 'For the District Magistrate: when the heat is coming, how bad, what to do this week, where the budget goes, who does what, and what changes if you act. Forecast + model-based estimates, every source named.')}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 10 }}>
          <div style={card}><div style={label}>{t('predict.when', '1 · When')}</div><div data-testid="predict-when" style={{ fontSize: 14, fontWeight: 800, color: worstColor, lineHeight: 1.3 }}>{when}</div></div>
          <div style={card}><div style={label}>{t('predict.howBad', '2 · How bad today')}</div><div style={{ fontSize: 14, fontWeight: 800, color: rl.color }}>{profile.risk != null ? `${profile.risk} / 100 · ${rl.label}` : t('predict.noRisk', 'no live reading')}</div><div style={{ fontSize: 10, color: '#94a3b8' }}>{profile.tempMax != null ? `forecast high ${profile.tempMax}°C` : ''}{profile.modisPeak != null ? ` · satellite season peak ${profile.modisPeak}°C` : ''}{profile.canopy != null ? ` · canopy ${profile.canopy}%` : ''}</div></div>
          <div style={card}><div style={label}>{t('predict.ifAct', '3 · If you act on the plan below')}</div><div style={{ fontSize: 14, fontWeight: 800, color: '#fbbf24' }}>{plan && !plan.error ? `${plan.stateBefore} → ${plan.stateAfter}` : '—'} <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 500 }}>{t('predict.projected', 'projected composite risk')}</span></div><div style={{ fontSize: 10, color: '#94a3b8' }}>{plan && !plan.error ? t('predict.planLine', '{{spent}} · {{cooling}} cooling units this week · {{roofs}} roofs · {{ha}} ha trees', { spent: fmtINR(plan.spent), cooling: plan.coolingUnits, roofs: plan.roofs, ha: plan.hectaresGreen }) : ''}</div></div>
        </div>
      </section>

      {/* 1. The forecast */}
      <HeatwaveOutlookPanel forecast={liveWeather.forecast} elevation={liveWeather.elevation} isCoastal={isCoastal} city={city} plan={plan && !plan.error ? plan : null} />

      {/* 2. This week: the checklist with owners */}
      <section className="panel" style={{ borderLeft: `4px solid ${worstColor}` }}>
        <h3><PanelIcon name="clipboard-list" /> {t('predict.teamTitle', 'THIS WEEK — GET THE TEAM ON IT')}</h3>
        <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 8 }}>{tier === 'heat' ? t('predict.tierHeat', 'Full Heat Action Plan activation (NDMA / Ahmedabad HAP). Tick progress on the Overview tab; owners below are the usual district roles — adjust to your district.') : tier === 'watch' ? t('predict.tierWatch', 'Preparedness tier: nothing to activate yet, everything ready to activate within hours.') : tier === 'cold' ? t('predict.tierCold', 'Cold-weather protocol.') : t('predict.tierRoutine', 'Routine monitoring — no activation needed this week. The list below appears automatically when the outlook crosses the threshold.')}</div>
        {steps.length > 0 && (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, color: '#e2e8f0' }}>
            <thead><tr style={{ color: '#94a3b8', fontSize: 10, textAlign: 'left' }}><th style={{ padding: '4px 6px 6px 0' }}>#</th><th style={{ padding: '4px 6px 6px 0' }}>{t('predict.action', 'Action')}</th><th style={{ padding: '4px 0 6px', whiteSpace: 'nowrap' }}>{t('predict.owner', 'Owner')}</th><th style={{ padding: '4px 0 6px', whiteSpace: 'nowrap' }}>{t('predict.by', 'By')}</th></tr></thead>
            <tbody>
              {steps.map((s, i) => (
                <tr key={s.id} data-team-step={s.id} style={{ borderTop: '1px solid #1e293b' }}>
                  <td style={{ padding: '6px 6px 6px 0', verticalAlign: 'top' }}><span style={stepNo(i + 1, worstColor)}>{i + 1}</span></td>
                  <td style={{ padding: '6px 6px 6px 0', lineHeight: 1.45 }}>{s.text}</td>
                  <td style={{ padding: '6px 0', color: '#cbd5e1', whiteSpace: 'nowrap', verticalAlign: 'top' }}>{OWNER[s.id] || 'DDMA'}</td>
                  <td style={{ padding: '6px 0', color: '#fbbf24', whiteSpace: 'nowrap', verticalAlign: 'top' }}>{tier === 'heat' ? (hotDays[0] ? t('predict.before', 'before {{d}}', { d: String(hotDays[0].date).split(',')[0] }) : t('predict.today', 'today')) : t('predict.thisWeek', 'this week')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          <button onClick={() => onGoTo?.('Overview')} style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid #334155', background: 'rgba(15,23,42,0.6)', color: '#cbd5e1', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>{t('predict.tick', 'TICK PROGRESS ON THE OVERVIEW CHECKLIST →')}</button>
        </div>
      </section>

      {/* 3. Where the money goes */}
      <section className="panel" style={{ borderLeft: '4px solid #d97706' }}>
        <h3><PanelIcon name="coins" /> {t('predict.moneyTitle', 'WHERE THE BUDGET GOES')}</h3>
        {!cityPlan && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 11, color: '#94a3b8' }}>{t('predict.budget', 'Budget')}</span>
            {[2500000, 5000000, 10000000, 50000000].map(b => <button key={b} data-predict-budget={b} onClick={() => setBudget(b)} style={{ padding: '6px 10px', borderRadius: 8, border: `1px solid ${budget === b ? '#d97706' : '#334155'}`, background: budget === b ? 'rgba(217,119,6,0.18)' : 'rgba(15,23,42,0.6)', color: budget === b ? '#fbbf24' : '#cbd5e1', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>{fmtINR(b)}</button>)}
            <span style={{ fontSize: 10, color: '#64748b' }}>{t('predict.budgetNote', 'quick view · the full planner with cost mode, target mode and export is on the Interventions tab')}</span>
          </div>
        )}
        {cityPlan && <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 8 }}>{t('predict.usingPlan', 'Using the plan you optimised on the Interventions tab ({{b}}).', { b: fmtINR(cityPlan.budget) })}</div>}
        {plan && plan.error && <div style={{ fontSize: 12, color: '#fbbf24' }}>{plan.message}</div>}
        {plan && !plan.error && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10 }}>
            {Object.values(plan.byType).sort((a, b) => b.cost - a.cost).map(tp => (
              <div key={tp.type} data-predict-alloc={tp.type} style={{ ...card, borderLeft: `3px solid ${INTERVENTIONS[tp.type].color}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#e2e8f0', fontWeight: 700 }}><PanelIcon name={INTERVENTIONS[tp.type].icon} size={12} color={INTERVENTIONS[tp.type].color} /> {INTERVENTIONS[tp.type].label}</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#f8fafc' }}>{fmtINR(tp.cost)}</div>
                <div style={{ fontSize: 10, color: '#94a3b8' }}>{Object.entries(tp.units).map(([u, q]) => `${q.toLocaleString('en-IN')} ${u}`).join(' · ')}</div>
              </div>
            ))}
            <div style={card}><div style={label}>{t('predict.total', 'Total')}</div><div style={{ fontSize: 18, fontWeight: 800, color: '#fbbf24' }}>{fmtINR(plan.spent)}</div><div style={{ fontSize: 10, color: '#94a3b8' }}>{t('predict.conf', 'confidence {{c}} · every unit cost is a printed assumption', { c: plan.confidence })}</div></div>
          </div>
        )}
        {plan && !plan.error && <ul style={{ margin: '10px 0 0', paddingLeft: 18, fontSize: 11, color: '#cbd5e1', lineHeight: 1.5 }}>{plan.why.slice(0, 3).map((w, i) => <li key={i}>{w}</li>)}</ul>}
        <div style={{ marginTop: 10 }}><button onClick={() => onGoTo?.('Interventions')} style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid #d97706', background: 'rgba(217,119,6,0.14)', color: '#fbbf24', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>{t('predict.openPlanner', 'OPEN THE FULL PLANNER →')}</button></div>
      </section>

      {/* 4. What the heat map looks like if you act */}
      <section className="panel">
        <h3><PanelIcon name="flame" /> {t('predict.gridTitle', 'THE HEAT MAP IF YOU ACT')}</h3>
        <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 8 }}>{t('predict.gridNote', "Left: the city's heat grid today. Right: the same grid with the plan's roofs and plantation applied — a multi-season effect from the illustrative cooling model, not this week's forecast. Base {{b}}°C{{ref}}.", { b: (outlook.peak?.maxTemp ?? gridBase ?? 0).toFixed(0), ref: '' })}</div>
        {(() => {
          const ok = plan && !plan.error
          const tree = ok ? Math.min(0.3, (plan.hectaresGreen || 0) / profile.coreAreaHa) : treeSlider
          const roof = ok && profile.roofs ? Math.min(0.2, ((plan.roofs || 0) / profile.roofs) * 0.2) : roofSlider
          // reflective pavement uses the grid's surface coefficient (the same 12 °C/100 % the
          // water-bodies slider carries), scaled by the share of the 1 km core treated
          const surf = ok ? Math.min(0.3, (plan.hectaresReflective || 0) / profile.coreAreaHa) : waterSlider
          return (
            <>
              <MiniGridPair base={outlook.peak?.maxTemp ?? gridBase} tree={tree} roof={roof} water={surf} />
              <div style={{ fontSize: 10, color: '#64748b', marginTop: 6 }}>{t('predict.gridApplied', 'Applied: greening {{t}}% of the core, cool roofs {{r}}% of roofs, reflective surfaces {{s}}% of the core — the same illustrative coefficients as the Interventions sliders.', { t: Math.round(tree * 100), r: Math.round(roof / 0.2 * 100), s: Math.round(surf * 100) })}{profile.lulcFallbackCity ? ' ' + t('predict.noLulc', 'This city has no land-cover classification of its own, so the plan cannot price roofs or plantation here — only relief and surfaces.') : ''}</div>
            </>
          )
        })()}
      </section>
    </div>
  )
}
