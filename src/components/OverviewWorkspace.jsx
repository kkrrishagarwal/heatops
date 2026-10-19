import React, { useEffect, useMemo, useRef, useState } from 'react'
import LocationImage from './LocationImage'
import HudLeafletMap from './HudLeafletMap'
import { buildCopilotInput } from './HeatCoPilot'
import { assessHeatStress } from '../utils/heatStress'
import { activationLevel, buildFallbackPlan, LEVELS } from '../utils/heatActionProtocol'
import { buildOutlook } from '../utils/heatwaveOutlook'
import { airOverlay, modisLatestOverlay, spectralColor, spectralGradientCss, stateDataFromPoints } from '../utils/hudOverlay'
import { buildDistrictHeat, districtKey, districtName } from '../utils/districtHeat'
import { getLulcWithFallback } from '../utils/lulcFallback'
import { cityRiskProfile, riskLabel } from '../utils/mitigationPlanner'
import { loadModisIndex } from '../utils/modisLst'

// WORKSPACE 1 — OVERVIEW: City Intelligence Command Center (reference image, panel 1).
// Compact photographic hero → KPI strip → three analytical columns around the city heat map →
// the existing detail panels in a drawer. Every tile carries a provenance label; anything the
// project does not hold (population exposed, economic impact) reads UNAVAILABLE.
const C = { bg: '#060B14', card: '#0B1325', raised: '#111827', surf: '#101D2C', border: '#1F2937', cyan: '#38BDF8', blue: '#2563EB', amber: '#F59E0B', red: '#EF4444', green: '#10B981', purple: '#A855F7', text: '#E6EDF7', muted: '#93A4B8' }
const card = { background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 12px', minWidth: 0 }
const label = { fontSize: 9.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: C.muted, marginBottom: 6, fontWeight: 700 }
const num = { fontVariantNumeric: 'tabular-nums' }
export const PROV = {
  live: { t: 'LIVE', c: C.green }, demo: { t: 'DEMO', c: C.amber }, forecast: { t: 'FORECAST', c: C.cyan }, estimate: { t: 'ESTIMATE', c: C.purple }, ai: { t: 'AI-GENERATED', c: C.blue }, na: { t: 'UNAVAILABLE', c: C.muted }, cached: { t: 'CACHED', c: C.amber }, rules: { t: 'RULE-BASED', c: C.purple }, satellite: { t: 'SATELLITE', c: C.cyan }
}
export function Prov({ k, title }) { const p = PROV[k] || PROV.na; return <span title={title} style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: '0.08em', padding: '1px 6px', borderRadius: 4, border: `1px solid ${p.c}55`, color: p.c, background: `${p.c}14`, whiteSpace: 'nowrap' }}>{p.t}</span> }

function Kpi({ title, value, sub, prov, provTitle, color = C.text, children }) {
  return (
    <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 2 }} data-testid={`kpi-${title.replace(/\W+/g, '-').toLowerCase()}`}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span style={label}>{title}</span><Prov k={prov} title={provTitle} /></div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {children}
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 24, fontWeight: 800, color, lineHeight: 1.05, ...num }}>{value}</div>
          {sub && <div style={{ fontSize: 10.5, color: C.muted, marginTop: 2 }}>{sub}</div>}
        </div>
      </div>
    </div>
  )
}

function Ring({ value, max = 100, color, size = 52 }) {
  const r = (size - 8) / 2, c = 2 * Math.PI * r, f = value == null ? 0 : Math.max(0, Math.min(1, value / max))
  return (
    <svg width={size} height={size} aria-hidden="true" style={{ flex: '0 0 auto' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={C.border} strokeWidth={6} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={6} strokeDasharray={`${c * f} ${c}`} strokeLinecap="round" transform={`rotate(-90 ${size / 2} ${size / 2})`} />
    </svg>
  )
}

function Section({ no, title, children, style, testId }) {
  return (
    <section style={{ ...card, display: 'flex', flexDirection: 'column', gap: 8, ...style }} data-testid={testId}>
      <div style={{ ...label, marginBottom: 0 }}><span style={{ color: C.cyan }}>{no} //</span> {title}</div>
      {children}
    </section>
  )
}

export default function OverviewWorkspace({ city, state, liveWeather, liveCityCache, liveIndiaData, cityCoordsData, lulcReal, isCoastal = false, buckets = [], resolveStateName, onSelectCity, alerts = [], children, cacheStatus = 'ready', cacheAgeLabel = '', lite = false }) {
  const [mapLayer, setMapLayer] = useState('air') // air | modis | sat
  const [modisIndex, setModisIndex] = useState(null)
  const [districtFeatures, setDistrictFeatures] = useState(null)
  const [showDetails, setShowDetails] = useState(false)
  const mapCtl = useRef(null)
  const detailsRef = useRef(null)

  useEffect(() => { if (mapLayer === 'modis' && !modisIndex) loadModisIndex().then(setModisIndex).catch(() => {}) }, [mapLayer, modisIndex])

  const coords = cityCoordsData?.[`${city}|${state}`]
  const demo = liveWeather?.demoOverride != null
  const temp = typeof liveWeather?.current?.temp === 'number' ? liveWeather.current.temp : null
  const stress = useMemo(() => assessHeatStress(liveWeather), [liveWeather])
  const outlook = useMemo(() => buildOutlook(liveWeather?.forecast, { elevation: liveWeather?.elevation, isCoastal }), [liveWeather, isCoastal])
  const lulc = useMemo(() => (lulcReal ? getLulcWithFallback(city, state, lulcReal, cityCoordsData) : null), [city, state, lulcReal, cityCoordsData])
  const profile = useMemo(() => cityRiskProfile({ city, state, temp, tempMax: liveWeather?.today?.maxTemp ?? null, modisPeak: null, lulc, facilities: null }), [city, state, temp, liveWeather, lulc])
  const rl = riskLabel(profile.risk)
  const input = useMemo(() => buildCopilotInput({ city, state, liveWeather, lulcReal, cityCoordsData, isCoastal }), [city, state, liveWeather, lulcReal, cityCoordsData, isCoastal])
  const act = useMemo(() => activationLevel(input), [input])
  const plan = useMemo(() => buildFallbackPlan(input), [input])
  const lvl = LEVELS[act.level]

  // Map data for the state: live air (or MODIS latest) points → per-district values.
  const points = useMemo(() => {
    if (mapLayer === 'modis' && modisIndex) return modisLatestOverlay({ modisIndex, coords: cityCoordsData, colorFor: spectralColor }).points
    return airOverlay({ liveCityCache, coords: cityCoordsData, colorFor: spectralColor, field: 'temp' }).points
  }, [mapLayer, modisIndex, liveCityCache, cityCoordsData])
  const stateData = useMemo(() => stateDataFromPoints({ base: liveIndiaData, points, buckets, scrubLabel: mapLayer === 'modis' ? 'NASA MODIS latest clear-sky pass' : 'Live air temperature (Open-Meteo)', colorOfValue: spectralColor }), [liveIndiaData, points, buckets, mapLayer])
  const districtHeat = useMemo(() => {
    if (!districtFeatures) return null
    const dh = buildDistrictHeat({ features: districtFeatures, points, resolveState: resolveStateName, colorFor: spectralColor, sparse: points.length < 500 })
    for (const d of Object.values(dh)) if (d.value != null) d.label = buckets.find(b => d.value >= b.min)?.label || ''
    dh.__unit = '°C'; return dh
  }, [districtFeatures, points, resolveStateName, buckets])
  const stateDistricts = useMemo(() => {
    if (!districtFeatures || !districtHeat) return []
    return districtFeatures.filter(f => resolveStateName(f) === state).map(f => ({ name: districtName(f), ...(districtHeat[districtKey(f)] || {}) })).filter(d => d.value != null).sort((a, b) => b.value - a.value)
  }, [districtFeatures, districtHeat, resolveStateName, state])
  const districtCount = useMemo(() => (districtFeatures ? districtFeatures.filter(f => resolveStateName(f) === state).length : null), [districtFeatures, resolveStateName, state])
  useEffect(() => { if (typeof coords?.lat !== 'number') return; const t = setTimeout(() => mapCtl.current?.flyTo(coords.lat, coords.lon, 7), 300); return () => clearTimeout(t) }, [coords, districtFeatures])

  // State context: hottest cities, the city's rank, state median.
  const stateCities = useMemo(() => Object.values(liveCityCache || {}).filter(c => c.state === state && typeof c.temp === 'number').sort((a, b) => b.temp - a.temp), [liveCityCache, state])
  const rank = stateCities.findIndex(c => c.city === city) + 1
  const stateMedian = liveIndiaData?.[state]?.heatIndexLive ? liveIndiaData[state].heatIndex : null
  const hotDays = outlook ? outlook.days.filter(d => ['watch', 'heatwave', 'severe'].includes(d.level)).length : 0

  // Priority alerts, all data-driven.
  const priority = []
  if (act.level === 'critical' || act.level === 'alert') priority.push({ sev: act.level === 'critical' ? 'High' : 'Medium', text: `${lvl.label}: ${act.reasons[0]}`, prov: demo ? 'demo' : 'rules' })
  if (outlook?.spells?.[0]) priority.push({ sev: 'High', text: `${outlook.spells[0].days}-day heat spell forecast ${outlook.spells[0].from} → ${outlook.spells[0].to}, peak ${outlook.spells[0].peak}°C`, prov: 'forecast' })
  else if (hotDays) priority.push({ sev: 'Medium', text: `${hotDays} day(s) at or above the IMD ${outlook.threshold.t}°C threshold this week`, prov: 'forecast' })
  if (liveWeather?.aqi?.usAQI > 200) priority.push({ sev: liveWeather.aqi.usAQI > 300 ? 'High' : 'Medium', text: `Air quality ${liveWeather.aqi.category?.label || ''} (AQI ${liveWeather.aqi.usAQI})`, prov: 'live' })
  if (stress?.now?.wbgtCategory?.cat >= 4) priority.push({ sev: 'Medium', text: `Outdoor work: WBGT category ${stress.now.wbgtCategory.cat} — ${stress.now.wbgtCategory.workRest}`, prov: 'estimate' })
  if (cacheStatus === 'error' || liveWeather?.isPartial) priority.push({ sev: 'Low', text: `Live reading unavailable — showing cached data (${cacheAgeLabel})`, prov: 'cached' })
  const sevCount = { High: priority.filter(a => a.sev === 'High').length, Medium: priority.filter(a => a.sev === 'Medium').length, Low: priority.filter(a => a.sev === 'Low').length }

  const insights = []
  if (temp != null && stateMedian != null) insights.push(`${city} is ${Math.abs(temp - stateMedian).toFixed(1)}°C ${temp >= stateMedian ? 'above' : 'below'} the ${state} live median (${stateMedian}°C).`)
  if (rank) insights.push(`Ranked ${rank} of ${stateCities.length} ${state} cities with a live reading right now.`)
  if (stress?.now) insights.push(`Feels like ${stress.now.heatIndex}°C (${stress.now.heatIndexBand.label}); wet-bulb ${stress.now.wetBulb}°C.`)
  if (lulc && lulc.builtUp != null) insights.push(`${lulc.builtUp}% built-up and ${lulc.treeCover ?? lulc.vegetation ?? '—'}% ${lulc.treeCover != null ? 'tree canopy' : 'vegetation'} within ~5 km${lulc.isFallback ? ` (estimated from ${lulc.fallbackCity})` : ''}.`)
  if (outlook?.peak) insights.push(`Week's forecast peak ${outlook.peak.maxTemp}°C on ${outlook.peak.date}; terrain rule: ${outlook.threshold.kind} (${outlook.threshold.t}°C).`)

  const sevColor = s => (s === 'High' ? C.red : s === 'Medium' ? C.amber : C.cyan)
  const openDetails = () => { setShowDetails(true); setTimeout(() => detailsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50) }

  return (
    <div data-testid="overview-workspace" style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 1500, margin: '0 auto', color: C.text }}>
      {/* HERO */}
      <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', border: `1px solid ${C.border}` }} data-testid="overview-hero">
        <LocationImage city={city} state={state} size="hero" />
        <div style={{ position: 'absolute', left: 16, top: 14, right: 16, display: 'flex', alignItems: 'flex-start', gap: 12, pointerEvents: 'none' }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: '0.01em', textShadow: '0 2px 8px rgba(0,0,0,0.7)' }}>📍 {city}, {state}</div>
            <div style={{ fontSize: 11, color: '#cbd5e1', marginTop: 4, textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>
              {districtCount != null ? `${districtCount} districts in ${state}` : 'districts: loading'}{coords && typeof coords.lat === 'number' ? ` · ${coords.lat.toFixed(3)}°N ${coords.lon.toFixed(3)}°E` : ''}{typeof liveWeather?.elevation === 'number' ? ` · ${Math.round(liveWeather.elevation)} m` : ''}{stateCities.length ? ` · ${stateCities.length} cities live` : ''}
            </div>
          </div>
          <span style={{ marginLeft: 'auto' }}><Prov k={demo ? 'demo' : cacheStatus === 'error' ? 'cached' : 'live'} title="Status of the readings on this screen" /></span>
        </div>
      </div>

      {/* KPI STRIP */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10 }}>
        <Kpi title="Current temperature" value={temp != null ? `${temp}°C` : '—'} sub={stress?.now ? `Feels like ${stress.now.heatIndex}°C · ${stress.now.heatIndexBand.label}` : liveWeather?.isPartial ? 'cached reading; no humidity' : 'waiting for live reading'} prov={demo ? 'demo' : liveWeather?.isPartial ? 'cached' : 'live'} provTitle="Open-Meteo 2 m air temperature" color={temp != null && stress?.now ? stress.now.heatIndexBand.color : C.text} />
        <Kpi title="Heat Risk Index" value={profile.risk != null ? `${profile.risk}/100` : '—'} sub={profile.risk != null ? `${rl.label} · confidence ${profile.confidence}` : 'no live reading'} prov="estimate" provTitle="Composite of forecast high, satellite peak, built-up share and canopy (model-based)" color={rl.color}><Ring value={profile.risk} color={rl.color} /></Kpi>
        <Kpi title="People at risk" value="UNAVAILABLE" sub="No approved per-city population dataset; nothing is estimated" prov="na" provTitle="Population exposed to heat risk — no source held" color={C.muted} />
        <Kpi title="Active alerts" value={String(priority.length)} sub={`${sevCount.High} high · ${sevCount.Medium} medium · ${sevCount.Low} low`} prov={demo ? 'demo' : 'live'} provTitle="Derived from live readings, the IMD-threshold outlook and the activation rules" color={sevCount.High ? C.red : sevCount.Medium ? C.amber : C.green} />
      </div>

      {/* THREE COLUMNS */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.35fr 1fr 1fr', gap: 10, alignItems: 'start' }}>
        <Section no="01" title="City climate & heat-risk map" testId="ov-map">
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {[['air', 'Air temp'], ['modis', 'Surface (MODIS)'], ['sat', 'Satellite']].map(([k, v]) => <button key={k} type="button" onClick={() => setMapLayer(k)} style={{ fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 6, border: `1px solid ${mapLayer === k ? C.cyan : C.border}`, background: mapLayer === k ? 'rgba(56,189,248,0.12)' : 'transparent', color: mapLayer === k ? C.cyan : C.muted, cursor: 'pointer' }}>{v}</button>)}
            <span style={{ marginLeft: 'auto' }}><Prov k={mapLayer === 'modis' ? 'satellite' : demo ? 'live' : 'live'} title={mapLayer === 'modis' ? 'NASA MODIS latest clear-sky pass per city' : 'Open-Meteo live cache, 1,932 cities'} /></span>
          </div>
          <div style={{ position: 'relative', height: 330, borderRadius: 8, overflow: 'hidden', border: `1px solid ${C.border}` }}>
            <HudLeafletMap stateData={stateData} resolveStateName={resolveStateName} points={[]} showDots={false} showFills basemap={mapLayer === 'sat' ? 'esri' : 'dark'} selectedState={state} onStateClick={() => {}} districtHeat={districtHeat} onDistrictClick={(c, st) => onSelectCity(c, st)} onGeoLoaded={setDistrictFeatures} detailZoom={4} controlRef={mapCtl} fillStrength={0.8} focus={coords && typeof coords.lat === 'number' ? { lat: coords.lat, lon: coords.lon } : null} />
            <div style={{ position: 'absolute', left: 8, bottom: 8, zIndex: 500, background: 'rgba(6,11,20,0.8)', border: `1px solid ${C.border}`, borderRadius: 6, padding: '4px 8px', fontSize: 9, color: C.muted }}>
              <div style={{ width: 150, height: 7, borderRadius: 3, background: spectralGradientCss() }} /><div style={{ display: 'flex', justifyContent: 'space-between' }}><span>&lt;10°C</span><span>25</span><span>35</span><span>45+</span></div>
            </div>
          </div>
          <div style={{ fontSize: 10, color: C.muted }}>Districts coloured by their own city reading or the nearest cities (hover for the source); click a district to open its city. Cyan outline = {state}.</div>
        </Section>

        <Section no="02" title="Urban morphology & cooling diagnostics" testId="ov-morph">
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={label}>Land cover · ~5 km around the centre</span><Prov k={lulc ? (lulc.isFallback ? 'estimate' : 'satellite') : 'na'} title="ESA WorldCover 10 m (2021)" /></div>
          {lulc ? [['Built-up', lulc.builtUp, C.amber], ['Vegetation', lulc.vegetation, C.green], ['Tree canopy', lulc.treeCover, '#22c55e'], ['Water', lulc.water, C.cyan]].filter(([, v]) => typeof v === 'number').map(([n, v, c]) => (
            <div key={n} style={{ display: 'grid', gridTemplateColumns: '78px 1fr 40px', alignItems: 'center', gap: 6, fontSize: 11 }}><span style={{ color: C.muted }}>{n}</span><div style={{ height: 7, borderRadius: 4, background: C.raised }}><div style={{ width: `${Math.min(100, v)}%`, height: '100%', borderRadius: 4, background: c }} /></div><span style={{ textAlign: 'right', ...num }}>{v}%</span></div>
          )) : <div style={{ fontSize: 11, color: C.muted }}>No land-cover classification for this city.</div>}
          {lulc?.isFallback && <div style={{ fontSize: 9.5, color: C.muted }}>Estimated from {lulc.fallbackCity}{lulc.distanceKm ? ` (~${lulc.distanceKm} km)` : ''}; this city is not among the 171 classified.</div>}

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}><span style={label}>7-day forecast highs</span><Prov k="forecast" title="Open-Meteo daily maxima vs the IMD threshold" /></div>
          {outlook ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
              {outlook.days.map(d => <div key={d.date} title={`${d.date}: ${d.maxTemp}°C · ${d.label}`} style={{ textAlign: 'center', fontSize: 9.5, color: C.muted }}><div style={{ fontSize: 12, fontWeight: 800, color: spectralColor(d.maxTemp), ...num }}>{d.maxTemp}°</div>{(d.date || '').split(',')[0]}</div>)}
            </div>
          ) : <div style={{ fontSize: 11, color: C.muted }}>No forecast yet.</div>}
          {outlook && <div style={{ fontSize: 9.5, color: C.muted }}>{hotDays} of 7 days at or above the IMD {outlook.threshold.kind} threshold ({outlook.threshold.t}°C).</div>}

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}><span style={label}>Highest-reading districts · {state}</span><Prov k={mapLayer === 'modis' ? 'satellite' : 'live'} title="Per-district values from the map layer" /></div>
          {stateDistricts.length ? stateDistricts.slice(0, 5).map((d, i) => (
            <div key={d.name} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, borderTop: i ? `1px solid ${C.border}` : 'none', padding: '3px 0' }}><span><span style={{ color: C.muted }}>{i + 1}.</span> {d.name}{d.method !== 'direct' ? <span style={{ color: C.muted, fontSize: 9 }}> · est.</span> : ''}</span><span style={{ color: d.color, fontWeight: 800, ...num }}>{d.value}°C</span></div>
          )) : <div style={{ fontSize: 11, color: C.muted }}>District values load with the map.</div>}

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}><span style={label}>Hottest cities · {state}</span><Prov k="live" title="Open-Meteo live cache" /></div>
          {stateCities.slice(0, 4).map(c => <div key={c.city} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}><button type="button" onClick={() => onSelectCity(c.city, c.state)} style={{ background: 'none', border: 'none', color: c.city === city ? C.cyan : C.text, cursor: 'pointer', padding: 0, fontSize: 11 }}>{c.city}</button><span style={{ color: spectralColor(c.temp), fontWeight: 800, ...num }}>{c.temp}°C</span></div>)}
        </Section>

        <Section no="03" title="Composite risk & operational triage" testId="ov-triage">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Ring value={profile.risk} color={rl.color} size={64} />
            <div><div style={{ fontSize: 20, fontWeight: 900, color: rl.color, ...num }}>{profile.risk ?? '—'}<span style={{ fontSize: 11, color: C.muted }}> / 100</span></div><div style={{ fontSize: 11, color: C.muted }}>{rl.label} · <Prov k="estimate" /></div></div>
            <div style={{ marginLeft: 'auto', textAlign: 'right' }}><div style={{ fontSize: 10, color: C.muted }}>Activation</div><div style={{ fontSize: 12, fontWeight: 800, color: lvl.color }}>{lvl.label.split(' — ')[0]}</div></div>
          </div>
          <div style={{ fontSize: 9.5, color: C.muted }}>{act.reasons.join(' · ')}</div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}><span style={label}>Priority alerts</span></div>
          {priority.length ? priority.map((a, i) => <div key={i} style={{ display: 'flex', gap: 8, fontSize: 11, alignItems: 'flex-start' }}><span style={{ fontSize: 8.5, fontWeight: 800, padding: '1px 6px', borderRadius: 4, background: `${sevColor(a.sev)}22`, color: sevColor(a.sev), border: `1px solid ${sevColor(a.sev)}55`, flex: '0 0 auto' }}>{a.sev.toUpperCase()}</span><span style={{ flex: 1 }}>{a.text}</span><Prov k={a.prov} /></div>) : <div style={{ fontSize: 11, color: C.green }}>No active heat alerts for {city}.</div>}

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}><span style={label}>Key insights</span></div>
          <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11, color: C.text }}>{insights.map((t, i) => <li key={i} style={{ marginBottom: 2 }}>{t}</li>)}</ul>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}><span style={label}>Recommended actions</span><Prov k="rules" title="NDMA / Ahmedabad Heat Action Plan rules; the AI Co-Pilot writes the full protocol" /></div>
          {plan.actions.slice(0, 3).map((a, i) => <div key={i} style={{ fontSize: 11, display: 'flex', gap: 6 }}><span style={{ color: a.priority === 'P1' ? C.red : C.amber, fontWeight: 800 }}>{a.priority}</span><span><b>{a.title}</b> <span style={{ color: C.muted }}>· {a.owner} · {a.deadline}</span></span></div>)}
          <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
            <button type="button" onClick={openDetails} data-testid="ov-open-copilot" style={{ fontSize: 11, fontWeight: 800, padding: '6px 10px', borderRadius: 7, border: 'none', background: C.amber, color: '#0f172a', cursor: 'pointer' }}>Open AI Co-Pilot ↓</button>
            <div style={{ fontSize: 9.5, color: C.muted, alignSelf: 'center' }}>Economic / productivity impact: <b style={{ color: C.muted }}>UNAVAILABLE</b> (no validated source)</div>
          </div>
        </Section>
      </div>

      {/* DETAIL PANELS (existing) */}
      <div ref={detailsRef}>
        <button type="button" onClick={() => setShowDetails(v => !v)} data-testid="ov-details-toggle" style={{ width: '100%', textAlign: 'left', fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', padding: '8px 12px', borderRadius: 8, border: `1px solid ${C.border}`, background: C.card, color: C.cyan, cursor: 'pointer' }}>
          {showDetails ? '▾ HIDE DETAIL PANELS' : '▸ SHOW DETAIL PANELS — weather, heat stress, AI Co-Pilot, checklist, satellite indices, precautions, 30-day trend'}
        </button>
        <div style={{ display: showDetails ? 'block' : 'none', marginTop: 10 }}>{children}</div>
      </div>
    </div>
  )
}
