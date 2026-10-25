import React, { useEffect, useMemo, useRef, useState } from 'react'
import { ComposedChart, Area, Line, Bar, BarChart, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceArea, ReferenceLine, CartesianGrid, LabelList } from 'recharts'
import { C, card, label, num, Prov, Kpi, Ring, Section, SubHead, Pills, WorkspaceHeader, wsRoot, btn, niceScale, axisTick, xLabel, yLabel, tipStyle, shortWeekday, ChartRead, ChartKey, ChartOverlay } from './workspaceKit'
import HudLeafletMap from './HudLeafletMap'
import LocationImage from './LocationImage'
import { airOverlay, modisLatestOverlay, spectralColor, spectralGradientCss, stateDataFromPoints } from '../utils/hudOverlay'
import { buildDistrictHeat } from '../utils/districtHeat'
import { getLulcWithFallback } from '../utils/lulcFallback'
import { loadModisIndex, getModisSummary } from '../utils/modisLst'
import { ASSUMPTIONS, DEMO_INPUTS, COOLING_PROFILE, simulate, diurnal, heatImpactScore, IMPACT_WEIGHTS, fetchPowerWeather, fetchGrid, gridOverlay, GRID_RADIUS_M } from '../utils/heatPower'

// WORKSPACE 7 — HEAT + POWER INTELLIGENCE: electricity-grid stress under heat.
// Real inputs: Open-Meteo hourly temperature and solar radiation (FORECAST), the live city
// reading (LIVE/CACHED), NASA MODIS surface temperature (SATELLITE), ESA WorldCover (SATELLITE),
// and OpenStreetMap grid geometry (substations, lines, industrial land). No electricity-demand,
// substation-loading or capacity feed is connected, so those read UNAVAILABLE; every MW figure
// comes from the illustrative model in utils/heatPower.js with stated assumptions, and is
// labelled DEMO until the officer enters their network's own reference peak and capacity.
const TABS = [['overview', 'Overview'], ['sim', 'Grid Simulator'], ['solar', 'Solar vs Cooling'], ['zones', 'Industrial Zones'], ['alerts', 'Alerts & Actions']]
const STORE = 'bhaskarops_power_inputs_v1'
const readInputs = () => { try { const v = JSON.parse(localStorage.getItem(STORE) || 'null'); return v && typeof v === 'object' ? v : {} } catch { return {} } }
const fmtMW = v => (v == null ? '—' : `${Math.round(v).toLocaleString('en-IN')} MW`)
const sevColor = s => (s === 'High' ? C.red : s === 'Medium' ? C.amber : C.cyan)

function Slider({ label: l, value, min, max, step = 1, unit, onChange, testId }) {
  return (
    <label style={{ display: 'grid', gridTemplateColumns: '1fr 54px', gap: 6, alignItems: 'center', fontSize: 11 }}>
      <span style={{ color: C.muted }}>{l}</span>
      <b style={{ textAlign: 'right', ...num }}>{value > 0 && unit !== '%/°C' ? '+' : ''}{value}{unit}</b>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(+e.target.value)} data-testid={testId} aria-label={l} style={{ gridColumn: '1 / -1', accentColor: C.amber }} />
    </label>
  )
}
function NumInput({ label: l, value, placeholder, onChange, testId }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 10, color: C.muted }}>
      {l}
      <input type="number" min="0" inputMode="numeric" value={value ?? ''} placeholder={placeholder} onChange={e => onChange(e.target.value === '' ? null : Math.max(0, +e.target.value))} data-testid={testId}
        style={{ background: C.raised, border: `1px solid ${C.border}`, color: C.text, borderRadius: 6, padding: '5px 7px', fontSize: 12, width: '100%', boxSizing: 'border-box' }} />
    </label>
  )
}

export default function HeatPowerWorkspace({ city, state, liveWeather, liveCityCache, liveIndiaData, cityCoordsData, lulcReal, buckets = [], resolveStateName, onSelectCity, cacheStatus = 'ready' }) {
  const [tab, setTab] = useState('overview')
  // Live state demand: Vidyut PRAVAH read by a Browser Use agent (/api/grid-demand). State level only.
  const [demand, setDemand] = useState({ status: 'idle', configured: null })
  useEffect(() => { fetch('/api/grid-demand').then(r => r.json()).then(d => setDemand(x => ({ ...x, configured: !!d.configured }))).catch(() => setDemand(x => ({ ...x, configured: false }))) }, [])
  useEffect(() => { setDemand(x => ({ status: 'idle', configured: x.configured })) }, [state])
  const pollRef = useRef(0)
  const fetchDemand = async () => {
    const run = ++pollRef.current
    setDemand(x => ({ ...x, status: 'running', error: null }))
    try {
      let r = await fetch(`/api/grid-demand?state=${encodeURIComponent(state)}`); let d = await r.json()
      const t0 = Date.now()
      while (d.status === 'running' && Date.now() - t0 < 240000) {
        await new Promise(res => setTimeout(res, 5000)); if (run !== pollRef.current) return
        r = await fetch(`/api/grid-demand?state=${encodeURIComponent(state)}&task=${encodeURIComponent(d.task)}`); d = await r.json()
      }
      if (run !== pollRef.current) return
      if (d.status === 'finished') setDemand(x => ({ ...x, status: 'ready', data: d }))
      else setDemand(x => ({ ...x, status: 'error', error: d.error || (d.status === 'running' ? 'The agent is still working; try again in a minute.' : 'No figure returned') }))
    } catch (e) { if (run === pollRef.current) setDemand(x => ({ ...x, status: 'error', error: e.message })) }
  }
  // Stack the columns below 1200 px (laptops at high zoom, tablets, phones).
  const [vw, setVw] = useState(() => window.innerWidth)
  useEffect(() => { let raf = 0; const on = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => setVw(window.innerWidth)) }; window.addEventListener('resize', on); return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', on) } }, [])
  const narrow = vw < 1200
  const cols = desktop => (narrow ? 'minmax(0, 1fr)' : desktop)
  const [inputs, setInputs] = useState(() => ({ tempIncreaseC: 0, acIncreasePct: 0, solarDecreasePct: 0, sensitivityPctPerC: ASSUMPTIONS.sensitivityPctPerC, custom: {}, ...readInputs() }))
  useEffect(() => { try { localStorage.setItem(STORE, JSON.stringify(inputs)) } catch { /* private mode */ } }, [inputs])
  const set = (k, v) => setInputs(s => ({ ...s, [k]: v }))
  const setCustom = (k, v) => setInputs(s => ({ ...s, custom: { ...s.custom, [k]: v } }))
  const val = k => inputs.custom?.[k] ?? DEMO_INPUTS[k]
  const isDemo = ['referencePeakMW', 'capacityMW', 'solarMW'].some(k => inputs.custom?.[k] == null)
  const mwProv = isDemo ? 'demo' : 'estimate'

  const coords = cityCoordsData?.[`${city}|${state}`]
  const demo = liveWeather?.demoOverride != null
  const lulc = useMemo(() => (lulcReal ? getLulcWithFallback(city, state, lulcReal, cityCoordsData) : null), [city, state, lulcReal, cityCoordsData])

  // Data for THIS city. Every effect clears its state first, so a failed request never leaves
  // the previous city's numbers on screen under the new city's name.
  const [wx, setWx] = useState({ status: 'loading', key: null, data: null, error: null })
  const [modis, setModis] = useState({ key: null, data: null, loaded: false })
  const [grid, setGrid] = useState({ status: 'loading', key: null, data: null, error: null })
  const key = `${city}|${state}`
  useEffect(() => {
    if (typeof coords?.lat !== 'number') { setWx({ status: 'error', key, data: null, error: 'no coordinates for this city' }); return }
    let live = true
    setWx({ status: 'loading', key, data: null, error: null })
    fetchPowerWeather(coords.lat, coords.lon).then(d => { if (live) setWx({ status: 'ready', key, data: d, error: null }) }).catch(e => { if (live) setWx({ status: 'error', key, data: null, error: e.message }) })
    return () => { live = false }
  }, [key, coords?.lat, coords?.lon]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { let live = true; setModis({ key, data: null, loaded: false }); getModisSummary(city, state).then(m => { if (live) setModis({ key, data: m, loaded: true }) }).catch(() => { if (live) setModis({ key, data: null, loaded: true }) }); return () => { live = false } }, [key]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (typeof coords?.lat !== 'number') { setGrid({ status: 'error', key, data: null, error: 'no coordinates' }); return }
    let live = true
    setGrid({ status: 'loading', key, data: null, error: null })
    fetchGrid({ city, state, lat: coords.lat, lon: coords.lon }).then(g => { if (live) setGrid({ status: 'ready', key, data: g, error: null }) }).catch(e => { if (live) setGrid({ status: 'error', key, data: null, error: e.message }) })
    return () => { live = false }
  }, [key, coords?.lat, coords?.lon]) // eslint-disable-line react-hooks/exhaustive-deps
  const days = wx.key === key ? wx.data?.days || [] : []
  const modisData = modis.key === key ? modis.data : null
  const gridData = grid.key === key ? grid.data : null

  // Model runs
  const refTempC = days[0]?.max ?? liveWeather?.today?.maxTemp ?? null
  const base = { referencePeakMW: val('referencePeakMW'), capacityMW: val('capacityMW'), solarMW: val('solarMW'), refTempC, sensitivityPctPerC: inputs.sensitivityPctPerC }
  const scen = { tempIncreaseC: inputs.tempIncreaseC, acIncreasePct: inputs.acIncreasePct, solarDecreasePct: inputs.solarDecreasePct }
  const todaySim = useMemo(() => simulate({ ...base, ...scen, dayMaxC: refTempC }), [JSON.stringify(base), JSON.stringify(scen)]) // eslint-disable-line react-hooks/exhaustive-deps
  const todayBase = useMemo(() => simulate({ ...base, dayMaxC: refTempC }), [JSON.stringify(base)]) // eslint-disable-line react-hooks/exhaustive-deps
  const week = useMemo(() => days.map(d => ({ ...d, sim: simulate({ ...base, ...scen, dayMaxC: d.max }) })), [days, JSON.stringify(base), JSON.stringify(scen)]) // eslint-disable-line react-hooks/exhaustive-deps
  const peakDay = week.reduce((m, d) => (d.sim && (!m || d.sim.peak > m.sim.peak) ? d : m), null)
  const [dayIdx, setDayIdx] = useState(0)
  useEffect(() => { setDayIdx(0) }, [key])
  const curve = useMemo(() => diurnal({ hours: days[dayIdx]?.hours, ...base, ...scen }), [days, dayIdx, JSON.stringify(base), JSON.stringify(scen)]) // eslint-disable-line react-hooks/exhaustive-deps

  const temp = typeof liveWeather?.current?.temp === 'number' ? liveWeather.current.temp : null
  const lstLatest = modisData?.latestDay || null
  const warmestNight = days.length ? Math.max(...days.map(d => d.min ?? -99)) : null
  const impact = heatImpactScore({ tmax: peakDay?.max ?? refTempC, tmin: warmestNight > -99 ? warmestNight : null, lst: lstLatest?.c ?? null, built: lulc?.builtUp ?? null, util: peakDay?.sim?.utilisation ?? null })
  const impactColor = impact.score == null ? C.muted : impact.score >= 70 ? C.red : impact.score >= 45 ? C.amber : C.green

  // Alerts — derived only from forecast weather, the model and OSM geometry; never loading %.
  const alerts = useMemo(() => {
    const out = []
    if (peakDay?.sim) {
      const s = peakDay.sim
      const sev = s.utilisation >= 0.95 ? 'High' : s.utilisation >= 0.8 ? 'Medium' : 'Low'
      out.push({ sev, title: `Evening peak ${s.changePct >= 0 ? '+' : ''}${s.changePct}% on ${shortWeekday(peakDay.date)}`, detail: `Forecast maximum ${peakDay.max}°C${inputs.tempIncreaseC ? ` (+${inputs.tempIncreaseC}°C scenario)` : ''}; projected peak ${fmtMW(s.peak)}, ${Math.round(s.utilisation * 100)}% of the entered capacity (${s.stress.label}).`, prov: mwProv, action: s.utilisation >= 0.8 ? 'Recommend: ask the DISCOM for a demand-response window 18:00–22:00 and confirm reserve availability with the SLDC.' : 'Recommend: routine monitoring of the evening peak.' })
    }
    if (warmestNight != null && warmestNight >= 27) out.push({ sev: warmestNight >= 30 ? 'High' : 'Medium', title: `Warm nights: minimum up to ${warmestNight}°C`, detail: 'Air conditioners keep running after midnight, so the load does not fall back overnight and distribution transformers get little time to cool.', prov: 'forecast', action: 'Recommend: night inspection of overloaded distribution transformers; public advice to set AC at 24–26°C (BEE default 24°C).' })
    const hot = days.filter(d => d.max >= 40)
    if (hot.length) out.push({ sev: hot.some(d => d.max >= 45) ? 'High' : 'Medium', title: `Line thermal derating: ${hot.length} day(s) ≥ 40°C`, detail: 'Overhead conductors carry less current as ambient temperature rises; ratings set for lower ambient temperatures overstate capacity on these days.', prov: 'rules', action: 'Recommend: check the ambient-temperature basis of line ratings with the transmission utility before the hottest days.' })
    if (days.length >= 3) {
      const sums = days.map(d => d.solarSum).filter(v => v != null), maxSum = Math.max(...sums)
      const dim = days.filter(d => d.solarSum != null && d.solarSum < 0.7 * maxSum)
      if (dim.length) out.push({ sev: 'Low', title: `Low-solar day(s): ${dim.map(d => shortWeekday(d.date)).join(', ')}`, detail: `Forecast solar radiation under 70% of the week's best day; the afternoon net load rises where rooftop and utility solar are significant.`, prov: 'forecast', action: 'Recommend: schedule conventional reserves for the afternoon on these days.' })
    }
    out.push({ sev: 'Info', title: 'Substation loading: UNAVAILABLE', detail: 'No SLDC / SCADA feed is connected, so per-substation loading, capacity use and overload alarms cannot be shown. Substation locations below come from OpenStreetMap.', prov: 'na', action: null })
    return out
  }, [peakDay, warmestNight, days, mwProv, inputs.tempIncreaseC])

  // ── Map ─────────────────────────────────────────────────────────────────────────────────
  const [heatLayer, setHeatLayer] = useState('air')
  const [show, setShow] = useState({ substations: true, lines: true, industrial: true, fills: true })
  const [modisIndex, setModisIndex] = useState(null)
  const [features, setFeatures] = useState(null)
  const [picked, setPicked] = useState(null)
  const mapCtl = useRef(null)
  useEffect(() => { if (heatLayer === 'lst' && !modisIndex) loadModisIndex().then(setModisIndex).catch(() => {}) }, [heatLayer, modisIndex])
  useEffect(() => { setPicked(null) }, [key])
  const points = useMemo(() => (heatLayer === 'lst' ? (modisIndex ? modisLatestOverlay({ modisIndex, coords: cityCoordsData, colorFor: spectralColor }).points : []) : airOverlay({ liveCityCache, coords: cityCoordsData, colorFor: spectralColor, field: 'temp' }).points), [heatLayer, modisIndex, liveCityCache, cityCoordsData])
  const stateData = useMemo(() => stateDataFromPoints({ base: liveIndiaData, points, buckets, scrubLabel: heatLayer === 'lst' ? 'NASA MODIS latest clear-sky pass' : 'Live air temperature', colorOfValue: spectralColor }), [liveIndiaData, points, buckets, heatLayer])
  const districtHeat = useMemo(() => { if (!features) return null; const dh = buildDistrictHeat({ features, points, resolveState: resolveStateName, colorFor: spectralColor, sparse: points.length < 500 }); dh.__unit = '°C'; return dh }, [features, points, resolveStateName])
  const overlay = useMemo(() => gridOverlay(gridData, show), [gridData, show])
  useEffect(() => { if (typeof coords?.lat !== 'number') return; const t = setTimeout(() => mapCtl.current?.flyTo(coords.lat, coords.lon, 10), 300); return () => clearTimeout(t) }, [coords, features, tab])

  const gridStatus = grid.status === 'ready' && gridData ? ({ extract: 'India extract', prebuilt: 'pre-built', live: 'live' }[gridData.source] || gridData.source) : grid.status
  const mapCard = (height) => (
    <Section no="01" title="Thermal & power-grid map" testId="hp-map" right={<span style={{ display: 'flex', gap: 4 }}><Prov k={heatLayer === 'lst' ? 'satellite' : demo ? 'demo' : 'live'} /><Prov k={gridData ? 'satellite' : 'na'} title="Grid geometry: OpenStreetMap (community-mapped), not live loading" /></span>}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <Pills testId="hp-heat-layer" value={heatLayer} onChange={setHeatLayer} options={[['air', 'Air temperature'], ['lst', 'Surface temp (MODIS)']]} />
        <span style={{ width: 1, height: 18, background: C.border }} />
        {[['substations', 'Substations', C.amber], ['lines', 'Transmission lines', C.cyan], ['industrial', 'Industrial land', '#A855F7'], ['fills', 'District heat', C.red]].map(([k, l, col]) => (
          <label key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10.5, color: show[k] ? C.text : C.muted, cursor: 'pointer' }}>
            <input type="checkbox" checked={show[k]} onChange={e => setShow(s => ({ ...s, [k]: e.target.checked }))} data-testid={`hp-toggle-${k}`} style={{ accentColor: col }} />{l}
          </label>
        ))}
        <label title="No approved population dataset is held" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10.5, color: C.muted, opacity: 0.6 }}><input type="checkbox" disabled /> Population exposure <Prov k="na" /></label>
      </div>
      <div style={{ position: 'relative', height, borderRadius: 8, overflow: 'hidden', border: `1px solid ${C.border}` }}>
        <HudLeafletMap stateData={stateData} resolveStateName={resolveStateName} points={[]} showDots={false} showFills={show.fills} basemap="dark" selectedState={state} onStateClick={() => {}}
          districtHeat={districtHeat} onDistrictClick={(c, st, info) => setPicked({ kind: 'district', title: info?.district || c, sub: state, lines: [`${info?.entry?.value ?? '—'}°C · ${info?.entry?.method === 'direct' ? `reading from ${c}` : 'estimated from nearest cities'}`], city: c })}
          onGeoLoaded={setFeatures} detailZoom={4} controlRef={mapCtl} fillStrength={show.substations || show.lines || show.industrial ? 0.32 : 0.6} overlay={overlay}
          onOverlayClick={f => setPicked({ kind: f.properties.kind, title: f.properties.label.replace(/<[^>]+>/g, ' ').split('  ')[0], sub: f.properties.kind === 'substation' ? 'Substation · OpenStreetMap' : f.properties.kind === 'line' ? 'Transmission line · OpenStreetMap' : 'Industrial land · OpenStreetMap', lines: [f.properties.label.replace(/<br>/g, ' · ').replace(/<[^>]+>/g, '')] })}
          focus={coords && typeof coords.lat === 'number' ? { lat: coords.lat, lon: coords.lon } : null} />
        <div style={{ position: 'absolute', left: 8, bottom: 8, zIndex: 500, background: 'rgba(6,11,20,0.86)', border: `1px solid ${C.border}`, borderRadius: 6, padding: '5px 8px', fontSize: 9, color: C.muted, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <b style={{ color: C.text }}>{heatLayer === 'lst' ? 'Surface temperature' : 'Air temperature'} (°C)</b>
          <div style={{ width: 150, height: 7, borderRadius: 3, background: spectralGradientCss() }} /><div style={{ display: 'flex', justifyContent: 'space-between', width: 150 }}><span>&lt;10</span><span>25</span><span>35</span><span>45+</span></div>
          <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: C.amber, marginRight: 4 }} />substation <span style={{ display: 'inline-block', width: 14, height: 2, background: C.cyan, margin: '0 4px 2px 8px' }} />≥220 kV line <span style={{ display: 'inline-block', width: 14, height: 2, background: C.blue, margin: '0 4px 2px 8px' }} />lower kV</span>
        </div>
        <div style={{ position: 'absolute', right: 8, top: 8, zIndex: 500, width: 150, borderRadius: 8, overflow: 'hidden', border: `1px solid ${C.border}` }}>
          <LocationImage city={city} state={state} size="hero" showCaption={false} />
        </div>
        {grid.status !== 'ready' && (
          <div data-testid="hp-grid-status" style={{ position: 'absolute', right: 8, bottom: 8, zIndex: 500, maxWidth: 280, background: 'rgba(6,11,20,0.9)', border: `1px solid ${grid.status === 'error' ? 'rgba(239,68,68,0.5)' : C.border}`, borderRadius: 6, padding: '6px 9px', fontSize: 10.5, color: C.text }}>
            {grid.status === 'loading' ? 'Loading grid infrastructure from OpenStreetMap…' : <>Grid infrastructure <b>UNAVAILABLE</b>: OpenStreetMap's Overpass service did not answer ({grid.error}). No substation or line is drawn rather than inventing locations.</>}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 10, fontSize: 10, color: C.muted, flexWrap: 'wrap' }}>
        {gridData ? <span>OpenStreetMap within {GRID_RADIUS_M / 1000} km ({gridStatus}): <b style={{ color: C.text }}>{gridData.substations.length}</b> substations · <b style={{ color: C.text }}>{gridData.lines.length}</b> line segments · <b style={{ color: C.text }}>{gridData.industrial.length}</b> industrial areas. Community-mapped; may be incomplete.</span> : <span>Grid layers need OpenStreetMap data for {city}.</span>}
      </div>
      {picked && <div style={{ fontSize: 11, background: C.raised, borderRadius: 6, padding: '6px 9px' }} data-testid="hp-picked"><b>{picked.title}</b> <span style={{ color: C.muted }}>· {picked.sub}</span><div style={{ color: C.muted }}>{picked.lines.join(' · ')}</div>{picked.city && picked.city !== city && <button type="button" onClick={() => onSelectCity(picked.city, state)} style={{ ...btn('transparent', C.cyan), fontSize: 10, padding: '3px 8px', marginTop: 4 }}>Open {picked.city}</button>}</div>}
    </Section>
  )

  // ── Simulator ───────────────────────────────────────────────────────────────────────────
  const simulator = (full) => (
    <Section no={full ? '01' : '03'} title="Grid simulator" testId="hp-sim" right={<Prov k={mwProv} title={isDemo ? 'Uses DEMO reference peak / capacity / solar — enter your network figures' : 'Officer-entered figures + stated assumptions'} />}>
      <Slider label="Temperature increase" value={inputs.tempIncreaseC} min={0} max={6} step={0.5} unit="°C" onChange={v => set('tempIncreaseC', v)} testId="hp-s-temp" />
      <Slider label="AC / cooling demand increase" value={inputs.acIncreasePct} min={0} max={40} unit="%" onChange={v => set('acIncreasePct', v)} testId="hp-s-ac" />
      <Slider label="Solar generation decrease" value={inputs.solarDecreasePct} min={0} max={100} step={5} unit="%" onChange={v => set('solarDecreasePct', v)} testId="hp-s-solar" />
      {full && <Slider label="Demand sensitivity (assumption)" value={inputs.sensitivityPctPerC} min={1} max={6} step={0.5} unit="%/°C" onChange={v => set('sensitivityPctPerC', v)} testId="hp-s-sens" />}
      {todaySim ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }} data-testid="hp-sim-out">
          {[['Projected peak', fmtMW(todaySim.peak), todaySim.peakWhen], ['Change vs reference', `${todaySim.changePct >= 0 ? '+' : ''}${todaySim.changePct}%`, `${todaySim.deltaMW >= 0 ? '+' : ''}${todaySim.deltaMW} MW`], ['Grid stress', todaySim.stress.label, todaySim.utilisation != null ? `${Math.round(todaySim.utilisation * 100)}% of capacity` : 'no capacity']].map(([k, v, s], i) => (
            <div key={k} style={{ background: C.raised, borderRadius: 7, padding: '6px 8px' }}>
              <div style={{ fontSize: 9, color: C.muted }}>{k}</div>
              <div style={{ fontSize: 15, fontWeight: 900, color: i === 2 ? todaySim.stress.color : C.text, ...num }}>{v}</div>
              <div style={{ fontSize: 9, color: C.muted }}>{s}</div>
            </div>
          ))}
        </div>
      ) : <div style={{ fontSize: 11, color: C.muted }}>Enter a reference peak to run the simulator.</div>}
      {full && todaySim && <div style={{ fontSize: 10.5, color: C.muted }}>Afternoon: gross {fmtMW(todaySim.middayGross)} − solar {fmtMW(todaySim.solarNoon)} = net {fmtMW(todaySim.middayNet)}. Evening: {fmtMW(todaySim.evening)}. {inputs.solarDecreasePct > 0 && todaySim.evening >= todaySim.middayNet ? 'The solar cut raises the afternoon net load but not the evening peak, because solar output is close to zero after 18:30.' : ''}</div>}
      <details open={full} style={{ fontSize: 10.5, color: C.muted }}>
        <summary style={{ cursor: 'pointer', color: isDemo ? C.amber : C.text }}>{isDemo ? 'DEMO network figures — enter your own' : 'Your network figures'}</summary>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginTop: 6 }}>
          <NumInput label={`Reference peak (MW) on a ${refTempC ?? '—'}°C day`} value={inputs.custom?.referencePeakMW} placeholder={`${DEMO_INPUTS.referencePeakMW} (demo)`} onChange={v => setCustom('referencePeakMW', v)} testId="hp-in-ref" />
          <NumInput label="Network capacity (MW)" value={inputs.custom?.capacityMW} placeholder={`${DEMO_INPUTS.capacityMW} (demo)`} onChange={v => setCustom('capacityMW', v)} testId="hp-in-cap" />
          <NumInput label="Installed solar (MW)" value={inputs.custom?.solarMW} placeholder={`${DEMO_INPUTS.solarMW} (demo)`} onChange={v => setCustom('solarMW', v)} testId="hp-in-solar" />
        </div>
        <div style={{ marginTop: 4 }}>Figures stay in this browser. The reference day is today's forecast maximum for {city}.</div>
      </details>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {[['+2°C heat', { tempIncreaseC: 2, acIncreasePct: 10, solarDecreasePct: 0 }], ['Heatwave', { tempIncreaseC: 4, acIncreasePct: 25, solarDecreasePct: 0 }], ['Dusty, low solar', { tempIncreaseC: 1, acIncreasePct: 5, solarDecreasePct: 40 }], ['Reset', { tempIncreaseC: 0, acIncreasePct: 0, solarDecreasePct: 0 }]].map(([l, v]) => (
          <button key={l} type="button" onClick={() => setInputs(s => ({ ...s, ...v }))} style={{ ...btn('transparent', C.muted), fontSize: 10, padding: '3px 8px' }}>{l}</button>
        ))}
      </div>
    </Section>
  )

  // ── Solar vs cooling ────────────────────────────────────────────────────────────────────
  const solarChart = (height, full) => {
    const sc = niceScale(curve.flatMap(d => [d.solar, d.cooling]), { step: 50, pad: 0, min: 0 })
    const eve = curve.filter(d => d.hour >= 18 && d.hour <= 21)
    const eveSolar = eve.length ? Math.round(eve.reduce((s, d) => s + d.solar, 0) / eve.length) : null
    const eveCool = eve.length ? Math.round(eve.reduce((s, d) => s + d.cooling, 0) / eve.length) : null
    return (
      <Section no={full ? '01' : '04'} title="Solar generation vs cooling demand" testId="hp-solar" right={<span style={{ display: 'flex', gap: 4 }}><Prov k="forecast" title="Hourly temperature and solar radiation: Open-Meteo" /><Prov k={mwProv} title="MW scale from the reference peak, installed solar and assumptions" /></span>}>
        <Pills value={String(dayIdx)} onChange={v => setDayIdx(+v)} options={days.slice(0, 7).map((d, i) => [String(i), i === 0 ? 'Today' : shortWeekday(d.date)])} />
        <div style={{ height, position: 'relative' }}>
          {curve.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={curve} margin={{ top: 10, right: 10, left: 4, bottom: 10 }}>
                <CartesianGrid stroke={C.border} strokeDasharray="3 3" vertical={false} />
                <ReferenceArea x1="18:00" x2="21:00" fill={C.red} fillOpacity={0.08} stroke="none" label={{ value: '6–9 PM evening peak', position: 'insideTop', fill: C.red, fontSize: 10, fontWeight: 700 }} />
                <XAxis dataKey="label" tick={axisTick} interval={full ? 1 : 3} tickLine={false} label={full ? xLabel('Hour (IST)') : undefined} />
                <YAxis domain={sc.domain} ticks={sc.ticks} tick={axisTick} width={58} label={yLabel('MW')} />
                <Tooltip {...tipStyle} formatter={(v, nme) => [`${v} MW`, nme]} labelFormatter={(l, p) => `${l} · ${p?.[0]?.payload?.temp ?? '—'}°C · solar radiation ${p?.[0]?.payload?.ghi ?? '—'} W/m²`} />
                <Area name="Solar generation" dataKey="solar" stroke={C.amber} fill={C.amber} fillOpacity={0.25} strokeWidth={2} isAnimationActive={false} />
                <Line name="Cooling demand" dataKey="cooling" stroke={C.cyan} strokeWidth={2.5} dot={false} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          ) : <ChartOverlay>{wx.status === 'loading' ? 'Loading the hourly forecast…' : `Hourly forecast UNAVAILABLE: ${wx.error || 'no data'}`}</ChartOverlay>}
        </div>
        <ChartKey items={[['band', C.amber, 'Solar generation (MW)'], ['line', C.cyan, 'Cooling-related demand (MW)'], ['band', C.red, '18:00–21:00']]} />
        {curve.length > 0 && <ChartRead>Between 6 and 9 PM solar averages <b>{eveSolar} MW</b> while cooling demand averages <b>{eveCool} MW</b>: the evening peak has to be met by other sources. Curve shapes come from {city}'s forecast temperature and sunshine; the MW scale comes from {isDemo ? 'DEMO network figures' : 'your network figures'} and the assumptions listed under Alerts & Actions.</ChartRead>}
      </Section>
    )
  }

  // ── Zones ───────────────────────────────────────────────────────────────────────────────
  const zones = useMemo(() => {
    const out = []
    for (const [name, c] of Object.entries(lulcReal?.cities || {})) {
      if (c.state !== state) continue
      const live = liveCityCache?.[`${name}|${c.state}`]
      out.push({ city: name, builtUp: c.builtUp, veg: c.vegetation, tree: c.treeCover ?? null, temp: live?.temp ?? null, high: live?.tempMax ?? null, cdd: typeof live?.tempMax === 'number' ? Math.max(0, Math.round((live.tempMax - ASSUMPTIONS.coolingBaseC) * 10) / 10) : null })
    }
    return out.sort((a, b) => b.builtUp - a.builtUp)
  }, [lulcReal, liveCityCache, state])
  const zonePair = zones.length >= 2 ? [zones[0], [...zones].sort((a, b) => b.veg - a.veg)[0]] : zones
  const zoneCards = (compact) => (
    <Section no={compact ? '05' : '02'} title={`Urban zones · most built-up vs greenest in ${state}`} testId="hp-zones" right={<Prov k="satellite" title="ESA WorldCover land cover; live air temperature" />}>
      {zonePair.length >= 2 && zonePair[0].city !== zonePair[1].city ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {zonePair.map((z, i) => (
              <div key={z.city} style={{ background: C.raised, borderRadius: 8, padding: '7px 9px', borderTop: `3px solid ${i === 0 ? C.red : C.green}` }}>
                <div style={{ fontSize: 9, color: C.muted, letterSpacing: '0.08em' }}>{i === 0 ? 'MOST BUILT-UP' : 'GREENEST'}</div>
                <div style={{ fontSize: 13, fontWeight: 900 }}>{z.city}</div>
                {[['Built-up', `${z.builtUp}%`], ['Vegetation', `${z.veg}%`], ['Air now', z.temp != null ? `${z.temp}°C` : '—'], ["Today's high", z.high != null ? `${z.high}°C` : '—'], ['Cooling degrees', z.cdd != null ? `${z.cdd} °C·day` : '—'], ['Electricity demand', 'UNAVAILABLE'], ['Population exposed', 'UNAVAILABLE']].map(([k, v]) => <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5 }}><span style={{ color: C.muted }}>{k}</span><b style={{ color: v === 'UNAVAILABLE' ? C.muted : C.text, ...num }}>{v}</b></div>)}
              </div>
            ))}
          </div>
          <ChartRead>Cooling degrees = today's high minus {ASSUMPTIONS.coolingBaseC}°C, a standard proxy for cooling need. Greener zones often run cooler, but these cities also differ in climate and size, so no demand saving is claimed without a validated model.</ChartRead>
        </>
      ) : <div style={{ fontSize: 11, color: C.muted }}>Needs at least two cities in {state} with land-cover classification.</div>}
    </Section>
  )

  // ── Insights + summary table ────────────────────────────────────────────────────────────
  const summaryRows = [
    ['Air temperature now', temp != null ? `${temp}°C` : '—', demo ? 'demo' : cacheStatus === 'error' ? 'cached' : 'live'],
    ["Week's forecast maximum", peakDay ? `${peakDay.max}°C (${shortWeekday(peakDay.date)})` : '—', 'forecast'],
    ['Warmest night', warmestNight != null && warmestNight > -99 ? `${warmestNight}°C` : '—', 'forecast'],
    ['Surface temperature (latest pass)', lstLatest ? `${lstLatest.c}°C · ${lstLatest.date}` : 'UNAVAILABLE', lstLatest ? 'satellite' : 'na'],
    ['Electricity demand now', 'UNAVAILABLE', 'na'],
    ['Projected week peak', peakDay?.sim ? fmtMW(peakDay.sim.peak) : '—', mwProv],
    ['Grid stress (scenario)', peakDay?.sim ? `${peakDay.sim.stress.label} · ${Math.round(peakDay.sim.utilisation * 100)}%` : '—', mwProv],
    ['Heat Impact Score', impact.score != null ? `${impact.score}/100` : '—', 'rules']
  ]
  const summary = (
    <Section no="06" title="Metric summary" testId="hp-summary" right={<Prov k="rules" />}>
      <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
        <tbody>{summaryRows.map(([k, v, p]) => <tr key={k} style={{ borderTop: `1px solid ${C.border}` }}><td style={{ color: C.muted, padding: '3px 0' }}>{k}</td><td style={{ textAlign: 'right', fontWeight: 800, ...num }}>{v}</td><td style={{ textAlign: 'right', width: 86 }}><Prov k={p} /></td></tr>)}</tbody>
      </table>
    </Section>
  )
  const alertList = (max) => (
    <Section no="02" title="Grid-stress alerts" testId="hp-alerts" right={<span style={{ fontSize: 9.5, color: C.muted }}>{days.length ? `forecast from ${new Date(wx.data.fetchedAt).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })} IST` : ''}</span>}>
      {alerts.slice(0, max).map((a, i) => (
        <div key={i} data-testid="hp-alert" style={{ borderLeft: `3px solid ${a.sev === 'Info' ? C.border : sevColor(a.sev)}`, background: C.raised, borderRadius: 6, padding: '6px 8px' }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ fontSize: 8.5, fontWeight: 800, padding: '1px 5px', borderRadius: 4, color: a.sev === 'Info' ? C.muted : sevColor(a.sev), border: `1px solid ${a.sev === 'Info' ? C.border : sevColor(a.sev)}66` }}>{a.sev.toUpperCase()}</span>
            <b style={{ fontSize: 11.5, flex: 1 }}>{a.title}</b><Prov k={a.prov} />
          </div>
          <div style={{ fontSize: 10.5, color: C.muted, marginTop: 3 }}>{a.detail}</div>
          {a.action && <div style={{ fontSize: 10.5, marginTop: 3 }}><span style={{ color: C.amber, fontWeight: 800 }}>Recommendation · </span>{a.action.replace(/^Recommend: /, '')}</div>}
        </div>
      ))}
      {!days.length && <div style={{ fontSize: 11, color: C.muted }}>{wx.status === 'loading' ? 'Loading the forecast…' : `Forecast UNAVAILABLE: ${wx.error}`}</div>}
      <div style={{ fontSize: 9.5, color: C.muted }}>Recommendations only. BhaskarOps does not operate or switch any part of the grid.</div>
    </Section>
  )

  // ── KPI strip ───────────────────────────────────────────────────────────────────────────
  const kpis = (
    <div style={{ display: 'grid', gridTemplateColumns: narrow ? 'repeat(auto-fit, minmax(190px, 1fr))' : 'repeat(5, minmax(0, 1fr))', gap: 10 }}>
      <Kpi title="Air temperature" value={temp != null ? `${temp}°C` : '—'} color={temp != null ? spectralColor(temp) : C.text} prov={demo ? 'demo' : cacheStatus === 'error' || liveWeather?.isPartial ? 'cached' : 'live'} sub={refTempC != null ? `Today's high ${refTempC}°C · night ${days[0]?.min ?? '—'}°C` : 'waiting for reading'} />
      {demand.status === 'ready' && demand.data
        ? (demand.data.demandMW != null || demand.data.peakMW != null
          ? <Kpi title={`${state} demand`} value={fmtMW(demand.data.demandMW ?? demand.data.peakMW)} color={C.cyan} prov="live" provTitle={demand.data.source} sub={`${demand.data.demandMW != null ? 'current' : 'peak met'} · state total${demand.data.asOf ? ` · ${demand.data.asOf}` : ''}`} />
          : <Kpi title="All-India demand" value={fmtMW(demand.data.nationalMW)} color={C.cyan} prov="live" provTitle={demand.data.source} sub={`national, not ${state} (state page unavailable)${demand.data.nationalAsOf ? ` · ${demand.data.nationalAsOf}` : ''}`} />)
        : <Kpi title="Electricity demand" value={demand.status === 'running' ? 'Fetching…' : 'UNAVAILABLE'} color={C.muted} prov="na" provTitle="No SLDC / DISCOM real-time feed connected" sub={demand.configured ? (demand.status === 'error' ? `Browser Use: ${demand.error}` : `Read ${state}'s live demand from Vidyut PRAVAH below`) : 'Connect an SLDC or DISCOM feed to show live MW'} />}
      <Kpi title="Surface temperature" value={lstLatest ? `${lstLatest.c}°C` : '—'} color={lstLatest ? spectralColor(lstLatest.c) : C.text} prov={lstLatest ? 'satellite' : 'na'} provTitle="NASA MODIS MOD11A1, ~10:30 IST clear-sky pass, 1 km" sub={lstLatest ? `MODIS day pass · ${lstLatest.date}` : modis.loaded ? 'no MODIS record for this city' : 'loading…'} />
      <Kpi title="Predicted peak demand" value={peakDay?.sim ? fmtMW(peakDay.sim.peak) : '—'} color={peakDay?.sim?.stress.color || C.text} prov={mwProv} provTitle="Model estimate from forecast maxima and stated assumptions" sub={peakDay?.sim ? `${shortWeekday(peakDay.date)} evening · ${peakDay.sim.changePct >= 0 ? '+' : ''}${peakDay.sim.changePct}% vs reference` : 'needs forecast'} />
      <Kpi title="Heat Impact Score" value={impact.score != null ? `${impact.score}/100` : '—'} color={impactColor} prov="rules" provTitle={IMPACT_WEIGHTS.map(w => `${w.label} ${Math.round(w.w * 100)}%`).join(' · ')} sub={`${impact.parts.filter(p => p.value != null).length} of ${impact.parts.length} components`}><Ring value={impact.score} color={impactColor} size={46} /></Kpi>
    </div>
  )

  // ── Tabs ────────────────────────────────────────────────────────────────────────────────
  const weekChart = (
    <Section no="02" title="Projected evening peak · next 7 days" testId="hp-week" right={<Prov k={mwProv} />}>
      <div style={{ height: 230 }}>
        {week.length ? (() => { const data = week.map(d => ({ day: shortWeekday(d.date), peak: d.sim?.peak, max: d.max, color: d.sim?.stress.color })); const sc = niceScale([0, ...data.map(d => d.peak), val('capacityMW') * 1.08], { step: 100, pad: 0, min: 0 }); return (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 22, right: 10, left: 4, bottom: 4 }} barCategoryGap="24%">
              <CartesianGrid stroke={C.border} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="day" tick={axisTick} tickLine={false} />
              <YAxis domain={sc.domain} ticks={sc.ticks} tick={axisTick} width={58} label={yLabel('MW')} />
              <Tooltip {...tipStyle} formatter={(v, nme, p) => [`${v} MW (max ${p.payload.max}°C)`, 'Projected peak']} />
              <ReferenceLine y={val('capacityMW')} stroke={C.red} strokeDasharray="6 4" label={{ value: `Capacity ${val('capacityMW')} MW${isDemo ? ' (demo)' : ''}`, fill: C.red, fontSize: 10.5, position: 'insideTopLeft', fontWeight: 700 }} />
              <Bar dataKey="peak" radius={[4, 4, 0, 0]} isAnimationActive={false}>{data.map((d, i) => <Cell key={i} fill={d.color} />)}<LabelList dataKey="peak" position="top" formatter={v => Math.round(v)} style={{ fill: C.text, fontSize: 10.5, fontWeight: 700 }} /></Bar>
            </BarChart>
          </ResponsiveContainer>) })() : <ChartOverlay>{wx.status === 'loading' ? 'Loading…' : 'Forecast UNAVAILABLE'}</ChartOverlay>}
      </div>
      <ChartRead>Each bar is the projected evening peak for that day's forecast maximum{inputs.tempIncreaseC ? ` plus the +${inputs.tempIncreaseC}°C scenario` : ''}. Green below 80% of capacity, amber 80–95%, red above 95%.</ChartRead>
    </Section>
  )
  const method = (
    <Section no="04" title="Method, assumptions and missing feeds" testId="hp-method" right={<Prov k="rules" />}>
      <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11, lineHeight: 1.5 }}>
        <li><b>Evening peak</b> = reference peak × (1 + {inputs.sensitivityPctPerC}% × °C above the reference day) × (1 + {Math.round(ASSUMPTIONS.coolingShare * 100)}% × AC increase).</li>
        <li><b>Afternoon net load</b> = {Math.round(ASSUMPTIONS.middayFactor * 100)}% of the evening peak − installed solar × {ASSUMPTIONS.performanceRatio} × 0.9 kW/m² × (1 − solar decrease).</li>
        <li><b>Solar curve</b> = installed MW × hourly radiation ÷ 1000 W/m² × {ASSUMPTIONS.performanceRatio}. <b>Cooling curve</b> = cooling share of the peak, shaped by (hourly temperature − {ASSUMPTIONS.coolingBaseC}°C) × an occupancy profile (offices afternoon, homes evening).</li>
        <li><b>Stress</b> = projected peak ÷ capacity: under 80% normal, 80–95% high, 95–100% critical, above 100% overload risk.</li>
        <li><b>Heat Impact Score</b> = weighted mix of {IMPACT_WEIGHTS.map(w => `${w.label.toLowerCase()} (${Math.round(w.w * 100)}%, ${w.range})`).join(', ')}; missing parts are dropped and weights re-normalised.</li>
      </ul>
      <SubHead prov="na">Not connected (needed for real grid figures)</SubHead>
      <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11, lineHeight: 1.5, color: C.muted }}>
        <li>Real-time demand: the State Load Despatch Centre (SLDC) or DISCOM SCADA feed.</li>
        <li>Substation and feeder loading, transformer capacities and outages: utility SCADA / ADMS.</li>
        <li>Published daily peak demand met: Grid-India daily power supply reports (state level).</li>
        <li>Population exposure: an approved census or WorldPop grid.</li>
      </ul>
    </Section>
  )

  return (
    <div data-testid="heatpower-workspace" style={wsRoot}>
      <WorkspaceHeader no="07" title={`HEAT + POWER INTELLIGENCE · ${city}`} sub="Electricity-grid stress under heat: forecast weather, satellite heat, grid geometry and a scenario model with stated assumptions."
        right={<>
          <Pills testId="hp-tabs" value={tab} onChange={setTab} options={TABS} />
          {isDemo && <span title="Reference peak, capacity and installed solar are demo figures until you enter your own" style={{ fontSize: 10, fontWeight: 800, color: C.amber, border: `1px solid ${C.amber}66`, borderRadius: 5, padding: '2px 7px' }}>DEMO NETWORK FIGURES</span>}
        </>} />

      {tab === 'overview' && (
        <>
          {kpis}
          {demand.configured && (
            <div data-testid="hp-demand-bar" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '7px 12px', fontSize: 11.5 }}>
              <b style={{ color: C.cyan }}>⚡ Live state demand</b>
              <span style={{ color: C.muted }}>Vidyut PRAVAH (Ministry of Power), read by a Browser Use agent · state total, not city</span>
              {demand.status === 'ready' && demand.data && <span>{demand.data.demandMW != null || demand.data.peakMW != null ? <><b>{fmtMW(demand.data.demandMW)}</b> {state} now · peak met {fmtMW(demand.data.peakMW)}{demand.data.asOf ? ` · ${demand.data.asOf}` : ''}</> : <>{state} page unavailable on the portal · </>}{demand.data.nationalMW != null && <> · All-India <b>{fmtMW(demand.data.nationalMW)}</b>{demand.data.nationalAsOf ? ` (${demand.data.nationalAsOf})` : ''}</>} <a href={demand.data.pageUrl} target="_blank" rel="noopener noreferrer" style={{ color: C.cyan }}>source</a>{demand.data.costUsd != null && <span style={{ color: C.muted }}> · agent run ${demand.data.costUsd.toFixed(2)}</span>}</span>}
              <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                <button type="button" data-testid="hp-demand-fetch" onClick={fetchDemand} disabled={demand.status === 'running'} style={{ ...btn(C.cyan), fontSize: 10.5, padding: '4px 10px' }}>{demand.status === 'running' ? 'Agent reading the portal…' : demand.status === 'ready' ? 'Refresh' : `Fetch ${state} demand`}</button>
                {demand.status === 'ready' && (demand.data?.peakMW || demand.data?.demandMW) ? <button type="button" data-testid="hp-demand-use" onClick={() => setCustom('referencePeakMW', demand.data.peakMW || demand.data.demandMW)} style={{ ...btn('transparent', C.text), fontSize: 10.5, padding: '4px 10px' }}>Use as reference peak</button> : null}
              </span>
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: cols('minmax(0, 1.55fr) minmax(0, 1fr)'), gap: 10, alignItems: 'start' }}>
            {mapCard(narrow ? 340 : 430)}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{alertList(3)}{simulator(false)}</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: cols('minmax(0, 1.3fr) minmax(0, 1fr) minmax(0, 0.9fr)'), gap: 10, alignItems: 'start' }}>
            {solarChart(190, false)}{zoneCards(true)}{summary}
          </div>
        </>
      )}
      {tab === 'sim' && (
        <div style={{ display: 'grid', gridTemplateColumns: cols('minmax(0, 1fr) minmax(0, 1.4fr)'), gap: 10, alignItems: 'start' }}>
          {simulator(true)}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{weekChart}{method}</div>
        </div>
      )}
      {tab === 'solar' && (
        <div style={{ display: 'grid', gridTemplateColumns: cols('minmax(0, 1.7fr) minmax(0, 1fr)'), gap: 10, alignItems: 'start' }}>
          {solarChart(340, true)}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{simulator(false)}
            <Section no="03" title="Cooling behaviour profile (assumption)" testId="hp-profile" right={<Prov k="rules" />}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(24, 1fr)', gap: 1, alignItems: 'end', height: 60 }}>{COOLING_PROFILE.map((v, i) => <div key={i} title={`${i}:00 · ${Math.round(v * 100)}%`} style={{ height: `${v * 100}%`, background: i >= 18 && i <= 21 ? C.red : C.cyan, opacity: 0.75, borderRadius: '2px 2px 0 0' }} />)}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: C.muted }}><span>00</span><span>06</span><span>12</span><span>18</span><span>23</span></div>
              <div style={{ fontSize: 10.5, color: C.muted }}>Share of cooling equipment assumed on each hour: offices in the afternoon, homes in the evening. Replace with metered data when available.</div>
            </Section>
          </div>
        </div>
      )}
      {tab === 'zones' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: cols('minmax(0, 1.5fr) minmax(0, 1fr)'), gap: 10, alignItems: 'start' }}>
            {mapCard(narrow ? 340 : 420)}
            <Section no="02" title={`Industrial land around ${city}`} testId="hp-industrial" right={<Prov k={gridData ? 'satellite' : 'na'} title="OpenStreetMap landuse=industrial" />}>
              {gridData ? (gridData.industrial.length ? <>
                <div style={{ fontSize: 11 }}><b>{gridData.industrial.length}</b> mapped industrial areas, <b>{Math.round(gridData.industrial.reduce((s, z) => s + z.areaKm2, 0) * 10) / 10} km²</b> in total within {GRID_RADIUS_M / 1000} km.</div>
                {gridData.industrial.slice(0, 8).map((z, i) => <button key={z.id} type="button" onClick={() => mapCtl.current?.flyTo(z.lat, z.lon, 13)} style={{ display: 'flex', justifyContent: 'space-between', background: 'none', border: 'none', borderTop: i ? `1px solid ${C.border}` : 'none', color: C.text, fontSize: 11, padding: '3px 0', cursor: 'pointer', textAlign: 'left' }}><span>{z.name || 'Unnamed industrial area'}</span><b style={num}>{z.areaKm2} km²</b></button>)}
                <div style={{ fontSize: 10, color: C.muted }}>Click a zone to fly to it. Per-zone temperature and load are not shown: the weather model's grid (2–11 km) cannot separate neighbouring zones, and no load feed is connected.</div>
              </> : <div style={{ fontSize: 11, color: C.muted }}>No industrial land is mapped in OpenStreetMap within {GRID_RADIUS_M / 1000} km.</div>) : <div style={{ fontSize: 11, color: C.muted }}>{grid.status === 'loading' ? 'Loading from OpenStreetMap…' : `UNAVAILABLE: ${grid.error}`}</div>}
            </Section>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: cols('minmax(0, 1fr) minmax(0, 1fr)'), gap: 10, alignItems: 'start' }}>
            {zoneCards(false)}
            <Section no="03" title={`All classified cities in ${state}`} testId="hp-zone-table" right={<Prov k="satellite" />}>
              <div style={{ maxHeight: 260, overflowY: 'auto' }}>
                <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
                  <thead><tr style={{ color: C.muted, textAlign: 'right' }}><th style={{ textAlign: 'left', fontWeight: 600 }}>City</th><th style={{ fontWeight: 600 }}>Built-up</th><th style={{ fontWeight: 600 }}>Vegetation</th><th style={{ fontWeight: 600 }}>High</th><th style={{ fontWeight: 600 }}>Cooling °C·d</th></tr></thead>
                  <tbody>{zones.map(z => <tr key={z.city} style={{ borderTop: `1px solid ${C.border}`, textAlign: 'right' }}><td style={{ textAlign: 'left', color: z.city === city ? C.cyan : C.text }}>{z.city}</td><td style={num}>{z.builtUp}%</td><td style={num}>{z.veg}%</td><td style={num}>{z.high ?? '—'}{z.high != null ? '°' : ''}</td><td style={num}>{z.cdd ?? '—'}</td></tr>)}</tbody>
                </table>
              </div>
            </Section>
          </div>
        </>
      )}
      {tab === 'alerts' && (
        <div style={{ display: 'grid', gridTemplateColumns: cols('minmax(0, 1.3fr) minmax(0, 1fr)'), gap: 10, alignItems: 'start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{alertList(20)}
            <Section no="03" title="Key insights" testId="hp-insights" right={<Prov k="rules" />}>
              <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11, lineHeight: 1.55 }}>
                {peakDay?.sim && <li>The week's highest projected load is on <b>{shortWeekday(peakDay.date)}</b> ({peakDay.max}°C): {fmtMW(peakDay.sim.peak)}, {peakDay.sim.stress.label.toLowerCase()} stress against {isDemo ? 'demo' : 'your'} capacity.</li>}
                {todayBase && <li>Each +1°C on the reference day adds about <b>{fmtMW(val('referencePeakMW') * inputs.sensitivityPctPerC / 100)}</b> to the evening peak under the current sensitivity assumption.</li>}
                {curve.length > 0 && <li>Solar output falls to near zero by 18:30, so the evening peak is met almost entirely by conventional generation and imports.</li>}
                {impact.score != null && <li>Heat Impact Score <b>{impact.score}/100</b>; largest contributor: {[...impact.parts].filter(p => p.contribution != null).sort((a, b) => b.contribution - a.contribution)[0]?.label.toLowerCase()}.</li>}
              </ul>
            </Section>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{summary}{method}</div>
        </div>
      )}
    </div>
  )
}
