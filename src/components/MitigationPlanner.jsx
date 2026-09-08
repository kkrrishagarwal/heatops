import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import PanelIcon from './PanelIcon'
import { fetchJson } from '../utils/fetchJson'
import { loadModisIndex } from '../utils/modisLst'
import { getLulcWithFallback } from '../utils/lulcFallback'
import { ASSUMPTIONS, INTERVENTIONS, cityRiskProfile, optimisePlan, estimateIntervention, budgetForTarget, fmtINR, riskLabel } from '../utils/mitigationPlanner'

// SMART MITIGATION PLANNER — "I have ₹X for heat mitigation in this state: where should it go?"
// Works at state level with cities as the units, because that is where the data is real.
// Every number is a model-based estimate and the panel says so; assumptions are one click away.
const PRESETS = [
  { label: '₹25 L', value: 2500000 }, { label: '₹50 L', value: 5000000 }, { label: '₹1 Cr', value: 10000000 }, { label: '₹5 Cr', value: 50000000 },
]
const ASSUMPTION_ROWS = [
  ['Priority core', `${ASSUMPTIONS.coreRadiusKm} km radius around the city centre (${Math.round(Math.PI * ASSUMPTIONS.coreRadiusKm ** 2 * 100)} ha) — same radius as the OpenStreetMap building-density panel`],
  ['Roofs in the core', `one building per ${ASSUMPTIONS.buildingFootprintM2} m² of built-up land (ESA WorldCover built-up share) — assumption`],
  ['Cool roof cost', `₹${ASSUMPTIONS.coolRoofPerSqft}/sq ft × ${ASSUMPTIONS.roofSqft} sq ft + ₹${ASSUMPTIONS.coolRoofLabourPerRoof} labour = ₹${ASSUMPTIONS.roofSqft * ASSUMPTIONS.coolRoofPerSqft + ASSUMPTIONS.coolRoofLabourPerRoof} per roof — lime-wash midpoint of the Cool Roof calculator's Ahmedabad 2017 pilot tier (₹0.5–2/sq ft)`],
  ['Tree plantation', `${ASSUMPTIONS.treesPerHa} trees/ha × ₹${ASSUMPTIONS.costPerTree} per tree incl. 3-year maintenance = ${fmtINR(ASSUMPTIONS.treesPerHa * ASSUMPTIONS.costPerTree)}/ha — assumption (state Nagar Van norms vary)`],
  ['Cooling centre', `${fmtINR(ASSUMPTIONS.coolingCentreCost)} per retrofit (shade, fans, water, signage); water station ${fmtINR(ASSUMPTIONS.waterStationCost)} — assumptions`],
  ['Reflective surfaces', `₹${ASSUMPTIONS.reflectivePerM2}/m² — assumption`],
  ['Priority facility', `${fmtINR(ASSUMPTIONS.facilityRetrofitCost)} per school/hospital (cool roof + shading); counts from OpenStreetMap within 3 km where fetched — assumption`],
  ['Cooling effect', `${ASSUMPTIONS.treeCoolingPerFraction} °C per 100 % new canopy, ${ASSUMPTIONS.roofCoolingPerFraction * ASSUMPTIONS.roofSliderMax} °C at 100 % roofs treated, ${ASSUMPTIONS.reflectiveCoolingPerFraction} °C per 100 % surfaces — the app's existing illustrative intervention model`],
  ['Risk points', `${ASSUMPTIONS.riskPointsPerDegC} points per °C of projected cooling; cooling centre ${ASSUMPTIONS.coolingCentrePoints}, water station ${ASSUMPTIONS.waterStationPoints}, facility ${ASSUMPTIONS.facilityPoints} points of exposure relief — assumptions`],
  ['Diminishing returns', `every further ${fmtINR(ASSUMPTIONS.diminishingTranche)} in the same city yields ${Math.round(ASSUMPTIONS.diminishing * 100)} % of the previous tranche — assumption, so the budget spreads`],
  ['Composite risk 0–100', 'forecast-high band (10–95) + NASA MODIS season-peak surface bonus (0–10) + built-up share × 0.2 − canopy relief (0–10) — model-based'],
  ['Population', 'NOT modelled — no verified per-city population table in the project; exposure is reported as roofs, hectares and facilities instead'],
]
const CONF_COLOR = { high: '#22c55e', medium: '#eab308', low: '#f97316', none: '#64748b' }
const btn = (active) => ({ padding: '8px 12px', borderRadius: 8, border: `1px solid ${active ? '#d97706' : '#334155'}`, background: active ? 'rgba(217,119,6,0.18)' : 'rgba(15,23,42,0.6)', color: active ? '#fbbf24' : '#cbd5e1', cursor: 'pointer', fontSize: 12, fontWeight: 700, letterSpacing: 0.4 })
const card = { background: 'rgba(15,23,42,0.55)', border: '1px solid #1e293b', borderRadius: 10, padding: '10px 12px' }
const label = { fontSize: 10, color: '#94a3b8', letterSpacing: 0.6, textTransform: 'uppercase' }
const big = { fontSize: 20, fontWeight: 800, color: '#f1f5f9', lineHeight: 1.2 }

export default function MitigationPlanner({ stateName, cities, liveCityCache, lulcReal, cityCoordsData, onClose, onHighlight, focusCity, onFocusCity }) {
  const { t } = useTranslation()
  const [mode, setMode] = useState('budget') // budget | cost | target
  const [budget, setBudget] = useState(10000000)
  const [budgetText, setBudgetText] = useState('1,00,00,000')
  const [optimised, setOptimised] = useState(false)
  const [plan, setPlan] = useState(null)
  const [planA, setPlanA] = useState(null)
  const [showAssumptions, setShowAssumptions] = useState(false)
  const [openCity, setOpenCity] = useState(null)
  const [onMap, setOnMap] = useState(false)
  const [modis, setModis] = useState(null)
  const [facilities, setFacilities] = useState(null)
  const [dataStatus, setDataStatus] = useState('loading')
  // mode 2
  const [costCity, setCostCity] = useState('')
  const [costType, setCostType] = useState('green')
  const [costQty, setCostQty] = useState(5)
  // mode 3
  const [target, setTarget] = useState(10)
  const [targetPlan, setTargetPlan] = useState(null)
  const debounce = useRef(null)

  useEffect(() => {
    let cancelled = false
    Promise.allSettled([loadModisIndex(), fetchJson('/data/osm-facilities.json', { timeoutMs: 15000 })]).then(([m, f]) => {
      if (cancelled) return
      setModis(m.status === 'fulfilled' ? m.value?.cities || {} : {})
      setFacilities(f.status === 'fulfilled' ? f.value?.cities || {} : {})
      setDataStatus(m.status === 'fulfilled' ? 'ready' : 'partial')
    })
    return () => { cancelled = true }
  }, [])

  // One risk profile per city in the state, from live cache + ESA + MODIS + OSM.
  const profiles = useMemo(() => {
    if (!modis || !facilities) return []
    return (cities || []).map(city => {
      const key = `${city}|${stateName}`
      const live = liveCityCache?.[key]
      const lulc = lulcReal ? getLulcWithFallback(city, stateName, lulcReal, cityCoordsData) : null
      return cityRiskProfile({
        city, state: stateName,
        temp: typeof live?.temp === 'number' ? live.temp : null,
        tempMax: typeof live?.tempMax === 'number' ? live.tempMax : null,
        modisPeak: modis[key]?.hottestDay?.c ?? null,
        lulc, facilities: facilities[key] && facilities[key].schools != null ? facilities[key] : null,
      })
    })
  }, [cities, stateName, liveCityCache, lulcReal, cityCoordsData, modis, facilities])
  const ranked = useMemo(() => profiles.filter(p => p.risk != null).sort((a, b) => b.risk - a.risk), [profiles])
  const unranked = profiles.length - ranked.length

  const setBudgetBoth = (v) => { const n = Math.max(0, Math.round(Number(v) || 0)); setBudget(n); setBudgetText(n.toLocaleString('en-IN')) }
  const runOptimise = (b = budget) => { setPlan(optimisePlan(profiles, b)); setOptimised(true) }
  // Re-optimise on budget change once a plan exists (debounced so the slider stays smooth).
  useEffect(() => {
    if (!optimised) return
    clearTimeout(debounce.current)
    debounce.current = setTimeout(() => setPlan(optimisePlan(profiles, budget)), 250)
    return () => clearTimeout(debounce.current)
  }, [budget, profiles, optimised])
  useEffect(() => { if (mode === 'target') setTargetPlan(budgetForTarget(profiles, target)) }, [mode, target, profiles])
  useEffect(() => { if (!costCity && ranked.length) setCostCity(ranked[0].city) }, [ranked, costCity])

  // Map highlight: the cities the current plan funds, with their tier.
  useEffect(() => {
    if (!onHighlight) return
    const p = mode === 'target' ? targetPlan : plan
    if (!onMap || !p || p.error) { onHighlight([]); return }
    onHighlight(p.cities.map(c => {
      const coord = cityCoordsData?.[`${c.city}|${stateName}`]
      return coord ? { city: c.city, state: stateName, lat: coord.lat, lon: coord.lon, before: c.before, after: c.after, cost: c.cost, color: riskLabel(c.before).color } : null
    }).filter(Boolean))
  }, [onMap, plan, targetPlan, mode, onHighlight, cityCoordsData, stateName])
  useEffect(() => () => onHighlight && onHighlight([]), [onHighlight])
  useEffect(() => { if (focusCity) setOpenCity(focusCity) }, [focusCity])

  const costProfile = ranked.find(p => p.city === costCity) || ranked[0]
  const costResult = costProfile ? estimateIntervention(costProfile, costType, costQty) : null
  const qtyRange = { green: [1, 20, 1, '% canopy added in the core'], roofs: [100, 5000, 100, 'roofs'], cooling: [1, 10, 1, 'cooling centres'], surfaces: [1, 30, 1, 'ha of pavement'], facilities: [1, Math.max(1, (costProfile?.facilities?.schools || 0) + (costProfile?.facilities?.hospitals || 0)) || 1, 1, 'facilities'] }[costType]

  const exportReport = (p) => {
    if (!p || p.error) return
    const lines = []
    lines.push(`BHASKAROPS — SMART MITIGATION PLAN`, `State: ${stateName}`, `Date: ${new Date().toLocaleString('en-IN')}`, `Available budget: ${fmtINR(p.budget)} · allocated ${fmtINR(p.spent)} · unallocated ${fmtINR(p.remaining)}`, '')
    lines.push('PROJECTED OUTCOME (model-based estimates, not guarantees)', `State composite risk: ${p.stateBefore} → ${p.stateAfter} (${p.reductionPct[0]}–${p.reductionPct[1]} % reduction, confidence ${p.confidence})`, `Cities ranked ${p.citiesRanked}, funded ${p.citiesCovered}`, `Roofs treated ${p.roofs} · plantation ${p.hectaresGreen} ha (${p.trees} trees) · cooling units ${p.coolingUnits} · facilities ${p.facilities} · reflective ${p.hectaresReflective} ha`, '')
    lines.push('ALLOCATION'); for (const tpe of Object.values(p.byType)) lines.push(`  ${INTERVENTIONS[tpe.type].label}: ${fmtINR(tpe.cost)} — ${Object.entries(tpe.units).map(([u, q]) => `${q} ${u}`).join(', ')}`)
    lines.push('', 'CITIES'); for (const c of p.cities) lines.push(`  ${c.city}: risk ${c.before} → ${c.after}, ${fmtINR(c.cost)} — ${Object.values(c.types).map(x => `${INTERVENTIONS[x.type].label} ${fmtINR(x.cost)}`).join('; ')}`)
    lines.push('', 'WHY THIS PLAN'); p.why.forEach(w => lines.push(`  - ${w}`))
    lines.push('', 'ASSUMPTIONS'); ASSUMPTION_ROWS.forEach(([k, v]) => lines.push(`  ${k}: ${v}`))
    lines.push('', 'DATA SOURCES', '  Live temperature and forecast high: Open-Meteo (BhaskarOps cache, refreshed hourly by day)', '  Season peak surface temperature: NASA MODIS MOD11A1.061 via AppEEARS, 1 Mar–2 Sep 2026', '  Built-up share and tree canopy: ESA WorldCover 10 m (2021), ~5 km sample around the centre', '  Schools/hospitals: OpenStreetMap (Overpass) within 3 km where available', '  Cost tiers: Ahmedabad 2017 / Telangana cool-roof pilots for lime-wash; all other unit costs are stated assumptions', '', 'METHOD', '  Greedy allocation by projected risk-points per rupee across procurable packages, effect scaled by each city\'s composite risk, with diminishing returns per ₹25 L in the same city. Deterministic: the same inputs always give the same plan.', '', 'LIMITATIONS', '  Population is not modelled. Cooling effects come from an illustrative model, not field measurement. Projections carry the ±20 % band shown. Verify unit costs against current state schedules of rates before procurement.')
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `BhaskarOps_MitigationPlan_${stateName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.txt`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000)
  }
  const exportCsv = (p) => {
    if (!p || p.error) return
    const rows = [['City', 'Risk before', 'Risk after', 'Investment (₹)', 'Cool roofs', 'Plantation (ha)', 'Cooling units', 'Facilities', 'Reflective (ha)', 'Confidence']]
    for (const c of p.cities) rows.push([c.city, c.before, c.after, Math.round(c.cost), c.types.roofs?.qty || 0, c.types.green?.qty || 0, c.types.cooling?.qty || 0, c.types.facilities?.qty || 0, c.types.surfaces?.qty || 0, c.profile.confidence])
    const blob = new Blob([rows.map(r => r.join(',')).join('\n')], { type: 'text/csv' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `BhaskarOps_MitigationPlan_${stateName.replace(/\s+/g, '_')}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000)
  }

  const renderPlan = (p, { showCompare = true } = {}) => {
    if (!p) return null
    if (p.error) return <div data-testid="planner-error" style={{ ...card, borderColor: '#b45309', color: '#fbbf24', fontSize: 12 }}>{p.message}</div>
    const before = riskLabel(p.stateBefore), after = riskLabel(p.stateAfter)
    const maxCost = Math.max(...Object.values(p.byType).map(x => x.cost))
    return (
      <div data-testid="planner-plan">
        {/* Before / after */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 10, alignItems: 'center', margin: '10px 0' }}>
          <div style={card}><div style={label}>{t('planner.current', 'Current state')}</div><div style={{ ...big, color: before.color }} data-testid="risk-before">{p.stateBefore} / 100</div><div style={{ fontSize: 11, color: before.color, fontWeight: 700 }}>{before.label}</div><div style={{ fontSize: 10, color: '#94a3b8' }}>{t('planner.avgOf', 'average of the {{n}} highest-risk cities', { n: p.prioritySize })}</div><div style={{ fontSize: 10, color: '#64748b' }}>{t('planner.allAvg', 'whole state ({{n}} cities): {{v}}', { n: p.citiesRanked, v: p.allBefore })}</div></div>
          <div style={{ color: '#d97706', fontSize: 22, fontWeight: 800 }}>→</div>
          <div style={{ ...card, borderColor: '#d97706' }}><div style={label}>{t('planner.proposed', 'With this plan (projected)')}</div><div style={{ ...big, color: after.color }} data-testid="risk-after">{p.stateAfter} / 100</div><div style={{ fontSize: 11, color: after.color, fontWeight: 700 }}>{after.label}</div><div style={{ fontSize: 10, color: '#94a3b8' }}>−{p.stateBefore - p.stateAfter} {t('planner.points', 'points')} · {p.reductionPct[0]}–{p.reductionPct[1]} %</div><div style={{ fontSize: 10, color: '#64748b' }}>{t('planner.allAvgAfter', 'whole state: {{v}}', { v: p.allAfter })}</div></div>
        </div>
        {/* Impact dashboard */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(118px, 1fr))', gap: 8 }}>
          <div style={card}><div style={label}>{t('planner.investment', 'Investment')}</div><div style={big} data-testid="plan-spent">{fmtINR(p.spent)}</div><div style={{ fontSize: 10, color: '#94a3b8' }}>{p.remaining > 0 ? `${fmtINR(p.remaining)} ${t('planner.unallocated', 'unallocated')}` : t('planner.fullyUsed', 'fully allocated')}</div></div>
          <div style={card}><div style={label}>{t('planner.citiesCovered', 'Cities funded')}</div><div style={big}>{p.citiesCovered} / {p.citiesRanked}</div></div>
          <div style={card}><div style={label}>{t('planner.roofs', 'Cool roofs')}</div><div style={big}>{p.roofs.toLocaleString('en-IN')}</div></div>
          <div style={card}><div style={label}>{t('planner.green', 'Plantation')}</div><div style={big}>{p.hectaresGreen} ha</div><div style={{ fontSize: 10, color: '#94a3b8' }}>{p.trees.toLocaleString('en-IN')} {t('planner.trees', 'trees')}</div></div>
          <div style={card}><div style={label}>{t('planner.cooling', 'Cooling units')}</div><div style={big}>{p.coolingUnits}</div></div>
          <div style={card}><div style={label}>{t('planner.facilities', 'Facilities')}</div><div style={big}>{p.facilities}</div><div style={{ fontSize: 10, color: '#94a3b8' }}>{t('planner.facNote', 'schools/hospitals (OSM)')}</div></div>
          <div style={card}><div style={label}>{t('planner.confidence', 'Confidence')}</div><div style={{ ...big, color: CONF_COLOR[p.confidence] }}>{p.confidence.toUpperCase()}</div><div style={{ fontSize: 10, color: '#94a3b8' }}>{t('planner.confNote', 'from how much real data the funded cities have')}</div></div>
        </div>
        {/* Allocation */}
        <div style={{ ...card, marginTop: 10 }}>
          <div style={label}>{t('planner.allocation', 'Recommended allocation')}</div>
          {Object.values(p.byType).sort((a, b) => b.cost - a.cost).map(tpe => (
            <div key={tpe.type} style={{ display: 'grid', gridTemplateColumns: '150px 1fr 90px', gap: 8, alignItems: 'center', margin: '6px 0' }} data-alloc={tpe.type}>
              <div style={{ fontSize: 12, color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: 6 }}><PanelIcon name={INTERVENTIONS[tpe.type].icon} size={12} color={INTERVENTIONS[tpe.type].color} /> {INTERVENTIONS[tpe.type].label}</div>
              <div style={{ background: '#0f172a', borderRadius: 4, height: 10, overflow: 'hidden' }}><div style={{ width: `${(tpe.cost / maxCost) * 100}%`, height: '100%', background: INTERVENTIONS[tpe.type].color }} /></div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#f8fafc', textAlign: 'right' }}>{fmtINR(tpe.cost)}</div>
              <div style={{ gridColumn: '1 / -1', fontSize: 10, color: '#94a3b8', marginTop: -4 }}>{Object.entries(tpe.units).map(([u, q]) => `${q.toLocaleString('en-IN')} ${u}`).join(' · ')}</div>
            </div>
          ))}
        </div>
        {/* Why */}
        <div style={{ ...card, marginTop: 10, borderLeft: '3px solid #d97706' }}>
          <div style={label}>{t('planner.why', 'Why this plan?')}</div>
          <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 12, color: '#cbd5e1', lineHeight: 1.5 }}>{p.why.map((w, i) => <li key={i}>{w}</li>)}</ul>
        </div>
        {/* Cities */}
        <div style={{ ...card, marginTop: 10 }}>
          <div style={label}>{t('planner.byCity', 'City by city — click for details')}</div>
          {p.cities.map(c => {
            const open = openCity === c.city
            const b = riskLabel(c.before), a = riskLabel(c.after)
            return (
              <div key={c.city} data-plan-city={c.city} style={{ borderTop: '1px solid #1e293b', padding: '6px 0' }}>
                <div onClick={() => setOpenCity(open ? null : c.city)} style={{ display: 'grid', gridTemplateColumns: '1fr 90px 80px', gap: 8, cursor: 'pointer', alignItems: 'center' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9' }}>{c.city} <span style={{ fontSize: 10, color: CONF_COLOR[c.profile.confidence], fontWeight: 600 }}>· {c.profile.confidence}</span></div>
                  <div style={{ fontSize: 12 }}><span style={{ color: b.color, fontWeight: 700 }}>{c.before}</span> → <span style={{ color: a.color, fontWeight: 700 }}>{c.after}</span></div>
                  <div style={{ fontSize: 12, fontWeight: 700, textAlign: 'right' }}>{fmtINR(c.cost)}</div>
                </div>
                {open && (
                  <div style={{ fontSize: 11, color: '#cbd5e1', marginTop: 6, lineHeight: 1.55 }}>
                    <div>{t('planner.inputs', 'Inputs')}: {c.profile.tempMax != null ? `forecast high ${c.profile.tempMax} °C` : c.profile.temp != null ? `live ${c.profile.temp} °C` : 'no live reading'}{c.profile.modisPeak != null ? ` · MODIS season peak surface ${c.profile.modisPeak} °C` : ' · no MODIS reading'}{c.profile.builtUp != null ? ` · ${c.profile.builtUp}% built-up` : ''}{c.profile.canopy != null ? ` · canopy ${c.profile.canopy}% (target 30%)` : c.profile.lulcFallbackCity ? ` · no own land-cover classification (nearest classified city is ${c.profile.lulcFallbackCity}; not used for ranking)` : ' · no land-cover data'}{c.profile.facilities ? ` · ${c.profile.facilities.schools} schools, ${c.profile.facilities.hospitals} hospitals within 3 km (OSM)` : ' · facilities not counted'}{c.profile.roofs ? ` · ~${c.profile.roofs.toLocaleString('en-IN')} roofs in the 1 km core (est.)` : ''}</div>
                    {Object.values(c.types).map(x => <div key={x.type}>• {INTERVENTIONS[x.type].label}: {Object.entries(x.units).map(([u, q]) => `${q.toLocaleString('en-IN')} ${u}`).join(', ')} — {fmtINR(x.cost)}</div>)}
                    <div style={{ color: '#94a3b8' }}>{t('planner.cityProjection', 'Projected composite risk {{b}} → {{a}} (model-based estimate).', { b: c.before, a: c.after })}</div>
                  </div>
                )}
              </div>
            )
          })}
          {unranked > 0 && <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 6 }}>{t('planner.unranked', '{{n}} cities in this state have no live reading yet and were not ranked — nothing is estimated for them.', { n: unranked })}</div>}
        </div>
        {/* Actions */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
          <button data-testid="planner-map" style={btn(onMap)} onClick={() => setOnMap(v => !v)}>{onMap ? t('planner.hideMap', 'HIDE ON MAP') : t('planner.viewMap', 'VIEW ON MAP')}</button>
          {showCompare && <button style={btn(false)} onClick={() => setPlanA({ ...p, savedBudget: p.budget })} data-testid="planner-save-a">{t('planner.saveA', 'SAVE AS PLAN A')}</button>}
          <button style={btn(false)} onClick={() => exportReport(p)} data-testid="planner-export">{t('planner.export', 'EXPORT REPORT')}</button>
          <button style={btn(false)} onClick={() => exportCsv(p)}>{t('planner.csv', 'CSV')}</button>
        </div>
        {showCompare && planA && planA.budget !== p.budget && (
          <div style={{ ...card, marginTop: 10 }} data-testid="planner-compare">
            <div style={label}>{t('planner.compare', 'Plan A vs current')}</div>
            <table style={{ width: '100%', fontSize: 12, color: '#e2e8f0', borderCollapse: 'collapse', marginTop: 4 }}>
              <thead><tr style={{ color: '#94a3b8', fontSize: 10 }}><th align="left"></th><th align="right">PLAN A</th><th align="right">{t('planner.currentPlan', 'CURRENT')}</th></tr></thead>
              <tbody>
                <tr><td>{t('planner.budget', 'Budget')}</td><td align="right">{fmtINR(planA.budget)}</td><td align="right">{fmtINR(p.budget)}</td></tr>
                <tr><td>{t('planner.riskAfter', 'Projected risk')}</td><td align="right">{planA.stateBefore} → {planA.stateAfter}</td><td align="right">{p.stateBefore} → {p.stateAfter}</td></tr>
                <tr><td>{t('planner.reduction', 'Reduction')}</td><td align="right">{planA.reductionPct[0]}–{planA.reductionPct[1]} %</td><td align="right">{p.reductionPct[0]}–{p.reductionPct[1]} %</td></tr>
                <tr><td>{t('planner.citiesCovered', 'Cities funded')}</td><td align="right">{planA.citiesCovered}</td><td align="right">{p.citiesCovered}</td></tr>
                <tr><td>{t('planner.roofs', 'Cool roofs')}</td><td align="right">{planA.roofs}</td><td align="right">{p.roofs}</td></tr>
                <tr><td>{t('planner.green', 'Plantation')}</td><td align="right">{planA.hectaresGreen} ha</td><td align="right">{p.hectaresGreen} ha</td></tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    )
  }

  return (
    <section className="panel" data-panel="PLANNER" style={{ borderLeft: '4px solid #d97706' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <h3 style={{ margin: 0 }}><PanelIcon name="target" /> {t('planner.title', 'SMART MITIGATION PLANNER — {{state}}', { state: stateName.toUpperCase() })}</h3>
        {onClose && <button style={btn(false)} onClick={onClose} data-testid="planner-close">← {t('planner.back', 'STATE')}</button>}
      </div>
      <div style={{ fontSize: 11, color: '#94a3b8', margin: '4px 0 10px' }}>{t('planner.subtitle', 'Where should limited heat-mitigation money go? Ranks this state\'s cities on live, satellite and land-cover data and spends the budget where each rupee removes the most projected risk. Model-based estimates — every assumption is one click away.')}</div>

      {dataStatus === 'loading' && <div style={{ fontSize: 12, color: '#94a3b8' }}>{t('planner.loading', 'Loading satellite and facility data…')}</div>}
      {dataStatus !== 'loading' && (
        <>
          {dataStatus === 'partial' && <div style={{ fontSize: 11, color: '#fbbf24', marginBottom: 8 }}>{t('planner.partial', 'Unable to load NASA MODIS data right now — ranking on live temperature and land cover only.')}</div>}
          {/* Step 1: mode */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
            <button style={btn(mode === 'budget')} onClick={() => setMode('budget')} data-testid="mode-budget">{t('planner.modeBudget', 'I HAVE A BUDGET')}</button>
            <button style={btn(mode === 'cost')} onClick={() => setMode('cost')} data-testid="mode-cost">{t('planner.modeCost', 'I WANT TO ESTIMATE A COST')}</button>
            <button style={btn(mode === 'target')} onClick={() => setMode('target')} data-testid="mode-target">{t('planner.modeTarget', 'I HAVE A TARGET')}</button>
          </div>

          {mode === 'budget' && (
            <>
              <div style={card}>
                <div style={label}>{t('planner.available', 'Available budget')}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '6px 0' }}>
                  {PRESETS.map(pr => <button key={pr.value} style={btn(budget === pr.value)} onClick={() => setBudgetBoth(pr.value)} data-preset={pr.value}>{pr.label}</button>)}
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#cbd5e1' }}>₹ <input data-testid="budget-input" value={budgetText} onChange={e => { const raw = e.target.value.replace(/[^\d]/g, ''); setBudgetText(e.target.value); if (raw) { setBudget(Number(raw)) } }} onBlur={() => setBudgetBoth(budget)} style={{ width: 130, background: '#0f172a', border: '1px solid #334155', color: '#f8fafc', borderRadius: 6, padding: '6px 8px', fontSize: 13, fontFamily: 'inherit' }} /></span>
                </div>
                <input type="range" min={0} max={100000000} step={500000} value={Math.min(budget, 100000000)} onChange={e => setBudgetBoth(e.target.value)} style={{ width: '100%', accentColor: '#d97706' }} data-testid="budget-slider" />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#64748b' }}><span>₹0</span><span style={{ color: '#fbbf24', fontWeight: 700, fontSize: 13 }}>{fmtINR(budget)}</span><span>₹10 Cr</span></div>
                {!optimised && <button style={{ ...btn(true), width: '100%', marginTop: 8, padding: 12, fontSize: 13 }} onClick={() => runOptimise()} data-testid="optimise">{t('planner.optimise', 'OPTIMIZE MY PLAN')}</button>}
                {optimised && <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 6 }}>{t('planner.liveRecalc', 'Plan recalculates as the budget changes.')}</div>}
              </div>
              {optimised && renderPlan(plan)}
            </>
          )}

          {mode === 'cost' && (
            <div style={card}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <label style={{ fontSize: 11, color: '#94a3b8' }}>{t('planner.city', 'City')}<br /><select value={costCity} onChange={e => setCostCity(e.target.value)} data-testid="cost-city" style={{ width: '100%', background: '#0f172a', color: '#f8fafc', border: '1px solid #334155', borderRadius: 6, padding: 6, fontSize: 12 }}>{ranked.map(p => <option key={p.city} value={p.city}>{p.city} · {p.risk}</option>)}</select></label>
                <label style={{ fontSize: 11, color: '#94a3b8' }}>{t('planner.intervention', 'Intervention')}<br /><select value={costType} onChange={e => { setCostType(e.target.value); setCostQty({ green: 5, roofs: 500, cooling: 2, surfaces: 5, facilities: 5 }[e.target.value]) }} data-testid="cost-type" style={{ width: '100%', background: '#0f172a', color: '#f8fafc', border: '1px solid #334155', borderRadius: 6, padding: 6, fontSize: 12 }}>{Object.values(INTERVENTIONS).map(i => <option key={i.key} value={i.key}>{i.label}</option>)}</select></label>
              </div>
              <div style={{ marginTop: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#94a3b8' }}><span>{qtyRange[3]}</span><span style={{ color: '#fbbf24', fontWeight: 700, fontSize: 13 }}>{costQty.toLocaleString('en-IN')}{costType === 'green' ? ' %' : ''}</span></div>
                <input type="range" min={qtyRange[0]} max={qtyRange[1]} step={qtyRange[2]} value={Math.min(costQty, qtyRange[1])} onChange={e => setCostQty(Number(e.target.value))} style={{ width: '100%', accentColor: '#d97706' }} data-testid="cost-qty" />
              </div>
              {costResult && !costResult.error && (
                <div style={{ marginTop: 10 }} data-testid="cost-result">
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(118px, 1fr))', gap: 8 }}>
                    <div style={card}><div style={label}>{t('planner.estCost', 'Estimated cost')}</div><div style={big} data-testid="cost-total">{fmtINR(costResult.cost)}</div></div>
                    {costResult.ha != null && <div style={card}><div style={label}>{t('planner.area', 'Area')}</div><div style={big}>{costResult.ha} ha</div><div style={{ fontSize: 10, color: '#94a3b8' }}>{costResult.trees.toLocaleString('en-IN')} {t('planner.trees', 'trees')}</div></div>}
                    {costResult.coverage != null && <div style={card}><div style={label}>{t('planner.coverage', 'Core roofs covered')}</div><div style={big}>{Math.round(costResult.coverage * 100)} %</div></div>}
                    <div style={card}><div style={label}>{t('planner.projCooling', 'Projected local cooling')}</div><div style={big}>{costResult.cooling ? `−${costResult.cooling.toFixed(1)} °C` : '—'}</div><div style={{ fontSize: 10, color: '#94a3b8' }}>{t('planner.modelEst', 'model-based estimate')}</div></div>
                    <div style={card}><div style={label}>{t('planner.projRisk', 'Projected risk')}</div><div style={big}>{costProfile.risk} → {Math.max(0, costProfile.risk - costResult.points)}</div><div style={{ fontSize: 10, color: CONF_COLOR[costProfile.confidence] }}>{t('planner.confidence', 'Confidence')} {costProfile.confidence}</div></div>
                  </div>
                  <div style={{ fontSize: 11, color: '#cbd5e1', marginTop: 8, lineHeight: 1.5 }}><div style={label}>{t('planner.calc', 'Calculation')}</div>{costResult.lines.map((l, i) => <div key={i}>• {l}</div>)}</div>
                  {costType === 'facilities' && !costProfile.facilities && <div style={{ fontSize: 11, color: '#fbbf24', marginTop: 6 }}>{t('planner.noFac', 'No school/hospital count from OpenStreetMap for this city yet — the quantity is what you enter, not a measured need.')}</div>}
                </div>
              )}
              {costResult?.error && <div style={{ fontSize: 12, color: '#fbbf24', marginTop: 8 }}>{costResult.message}</div>}
            </div>
          )}

          {mode === 'target' && (
            <>
              <div style={card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#94a3b8' }}><span>{t('planner.targetLabel', 'Desired reduction in the composite risk of the state\'s 10 highest-risk cities')}</span><span style={{ color: '#fbbf24', fontWeight: 700, fontSize: 13 }}>{target} %</span></div>
                <input type="range" min={2} max={30} step={1} value={target} onChange={e => setTarget(Number(e.target.value))} style={{ width: '100%', accentColor: '#d97706' }} data-testid="target-slider" />
                {targetPlan && !targetPlan.error && <div style={{ marginTop: 8 }}><div style={label}>{t('planner.required', 'Estimated investment required')}</div><div style={{ ...big, color: '#fbbf24' }} data-testid="target-budget">{fmtINR(targetPlan.spent)}</div></div>}
              </div>
              {targetPlan && renderPlan(targetPlan, { showCompare: false })}
            </>
          )}

          {/* Assumptions */}
          <div style={{ marginTop: 10 }}>
            <button style={btn(showAssumptions)} onClick={() => setShowAssumptions(v => !v)} data-testid="assumptions-toggle">{showAssumptions ? t('planner.hideAssumptions', 'HIDE COST ASSUMPTIONS') : t('planner.showAssumptions', 'COST ASSUMPTIONS & METHOD')}</button>
            {showAssumptions && (
              <div style={{ ...card, marginTop: 8 }} data-testid="assumptions">
                <table style={{ width: '100%', fontSize: 11, color: '#cbd5e1', borderCollapse: 'collapse' }}><tbody>
                  {ASSUMPTION_ROWS.map(([k, v]) => <tr key={k} style={{ borderTop: '1px solid #1e293b' }}><td style={{ padding: '4px 6px 4px 0', color: '#e2e8f0', fontWeight: 700, whiteSpace: 'nowrap', verticalAlign: 'top' }}>{k}</td><td style={{ padding: '4px 0' }}>{v}</td></tr>)}
                </tbody></table>
                <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 6 }}>{t('planner.method', 'Method: greedy allocation by projected risk-points per rupee across procurable packages, effect scaled by each city\'s composite risk, diminishing returns per ₹25 L in the same city. Deterministic. Sources: Open-Meteo (live, forecast high), NASA MODIS MOD11A1.061 (season peak surface), ESA WorldCover 10 m (built-up, canopy), OpenStreetMap (schools, hospitals), Ahmedabad 2017 / Telangana cool-roof pilots (lime-wash cost tier).')}</div>
              </div>
            )}
          </div>
          <div style={{ fontSize: 10, color: '#64748b', marginTop: 8 }}>{t('planner.disclaimer', 'Projected outcomes are model-based estimates, not guarantees. Population is not modelled (no verified per-city table). Verify unit costs against the current state schedule of rates before procurement.')}</div>
        </>
      )}
    </section>
  )
}
