import React, { useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine, Legend } from 'recharts'
import { C, card, label, num, Prov, Section, Pills, WorkspaceHeader, DetailsDrawer, wsRoot, btn, niceScale, axisTick, yLabel, tipStyle, ChartRead, ChartKey } from './workspaceKit'
import LocationImage from './LocationImage'
import { fetchMultiCityDaily } from '../utils/ensembleForecast'
import { getLulcWithFallback } from '../utils/lulcFallback'
import { cityRiskProfile, riskLabel } from '../utils/mitigationPlanner'
import { getModisSummary } from '../utils/modisLst'
import { spectralColor } from '../utils/hudOverlay'

// WORKSPACE 4 — COMPARE: Multi-City Intelligence. Any 2–4 cities from the 1,932 in the live
// cache, side by side: identity photo, live metrics, land cover, risk index, satellite
// surface temperature, 7-day forecast highs, synchronised satellite maps and an optional
// AI-written summary built only from the numbers on screen.
const MAX = 4
const SERIES = [C.amber, C.cyan, '#F472B6', '#A3E635']
const STORE = 'bhaskarops_compare_cities'
const DEFAULTS = [['New Delhi', 'Delhi'], ['Mumbai', 'Maharashtra'], ['Chennai', 'Tamil Nadu'], ['Jaipur', 'Rajasthan']]

function readStored() { try { const v = JSON.parse(window.localStorage.getItem(STORE) || 'null'); return Array.isArray(v) ? v.filter(x => Array.isArray(x) && x.length === 2).slice(0, MAX) : null } catch { return null } }

// Satellite mini-map; all instances share one zoom level so the cities are seen at the same scale.
function MiniSatMap({ lat, lon, zoom, onZoom, color }) {
  const el = useRef(null), map = useRef(null)
  useEffect(() => {
    if (!el.current || typeof lat !== 'number') return
    const m = L.map(el.current, { zoomControl: false, attributionControl: false, center: [lat, lon], zoom, minZoom: 8, maxZoom: 17, scrollWheelZoom: false })
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxNativeZoom: 19, crossOrigin: true, errorTileUrl: '' }).addTo(m)
    L.circle([lat, lon], { radius: 5000, color, weight: 1.5, fill: false, dashArray: '4 4' }).addTo(m)
    m.on('zoomend', () => onZoom(m.getZoom()))
    map.current = m
    return () => { m.remove(); map.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lon])
  useEffect(() => { const m = map.current; if (m && m.getZoom() !== zoom) m.setZoom(zoom, { animate: false }) }, [zoom])
  return <div ref={el} style={{ height: 150, borderRadius: 8, overflow: 'hidden', background: C.raised }} />
}

export default function CompareWorkspace({ city, state, liveCityCache, cityCoordsData, lulcReal, allCities = [], onSelectCity, children, jurisdiction = null }) {
  // State administrators: primary slots are locked to their own state (intra-state transparency)
  // plus exactly ONE read-only benchmark slot for a city outside the state. Central: unrestricted.
  const scoped = jurisdiction?.type === 'state' ? jurisdiction.state : null
  const normalise = arr => {
    const seen = new Set(); const uniq = arr.filter(([c, s]) => { const k = `${c}|${s}`; if (!c || seen.has(k)) return false; seen.add(k); return true })
    if (!scoped) return uniq.slice(0, MAX)
    return [...uniq.filter(([, s]) => s === scoped).slice(0, MAX - 1), ...uniq.filter(([, s]) => s !== scoped).slice(0, 1)]
  }
  const ownDefaults = () => Object.values(liveCityCache || {}).filter(c => c.state === scoped && c.city !== city && typeof c.tempMax === 'number').sort((a, b) => b.tempMax - a.tempMax).slice(0, 2).map(c => [c.city, c.state])
  const [list, setListRaw] = useState(() => {
    const stored = readStored()
    const base = scoped ? ownDefaults() : (stored && stored.length ? stored : DEFAULTS.slice(0, 3))
    return normalise([[city, state], ...base])
  })
  const setList = f => setListRaw(prev => normalise(typeof f === 'function' ? f(prev) : f))
  const [qx, setQx] = useState('')
  const [q, setQ] = useState('')
  const [metric, setMetric] = useState('tempMax')
  const [zoom, setZoom] = useState(11)
  const [modis, setModis] = useState({})
  const [fc, setFc] = useState({ status: 'loading', rows: [], error: null })
  const [ai, setAi] = useState({ status: 'idle', text: '', error: null, at: null })

  // Keep the dashboard's selected city as the first column.
  useEffect(() => { setList(prev => [[city, state], ...prev.filter(([c, s]) => !(c === city && s === state))].slice(0, MAX)) }, [city, state])
  useEffect(() => { if (scoped) return; try { window.localStorage.setItem(STORE, JSON.stringify(list.slice(1))) } catch { /* private mode */ } }, [list, scoped])
  const ownCount = list.filter(([, s]) => !scoped || s === scoped).length
  const external = scoped ? list.find(([, s]) => s !== scoped) || null : null
  const key = list.map(x => x.join('|')).join(';')
  useEffect(() => { setAi({ status: 'idle', text: '', error: null, at: null }) }, [key])

  useEffect(() => {
    let live = true
    for (const [c, s] of list) if (!(`${c}|${s}` in modis)) getModisSummary(c, s).then(m => { if (live) setModis(p => ({ ...p, [`${c}|${s}`]: m })) }).catch(() => { if (live) setModis(p => ({ ...p, [`${c}|${s}`]: null })) })
    const locs = list.map(([c, s]) => ({ city: c, state: s, ...(cityCoordsData?.[`${c}|${s}`] || {}) }))
    setFc(f => ({ ...f, status: 'loading' }))
    fetchMultiCityDaily(locs).then(rows => { if (live) setFc({ status: 'ready', rows, error: null }) }).catch(e => { if (live) setFc({ status: 'error', rows: [], error: e.message }) })
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, cityCoordsData])

  const rows = useMemo(() => list.map(([c, s], i) => {
    const live = liveCityCache?.[`${c}|${s}`] || null
    const lulc = lulcReal ? getLulcWithFallback(c, s, lulcReal, cityCoordsData) : null
    const m = modis[`${c}|${s}`]
    const profile = cityRiskProfile({ city: c, state: s, temp: live?.temp ?? null, tempMax: live?.tempMax ?? null, modisPeak: m?.hottestDay?.c ?? null, lulc, facilities: null })
    return { city: c, state: s, color: SERIES[i], live, lulc, modis: m, profile, coords: cityCoordsData?.[`${c}|${s}`] }
  }), [list, liveCityCache, lulcReal, cityCoordsData, modis])

  const results = useMemo(() => {
    const s = q.trim().toLowerCase(); if (s.length < 2) return []
    const rank = c => { const n = c.city.toLowerCase(); return n.startsWith(s) ? 0 : n.includes(s) ? 1 : 9 }
    return allCities.filter(c => !scoped || c.state === scoped).map(c => ({ c, r: rank(c) })).filter(x => x.r < 9 && !list.some(([a, b]) => a === x.c.city && b === x.c.state)).sort((a, b) => a.r - b.r || a.c.city.localeCompare(b.c.city)).slice(0, 7).map(x => x.c)
  }, [q, allCities, list, scoped])
  const resultsX = useMemo(() => {
    const s = qx.trim().toLowerCase(); if (!scoped || s.length < 2) return []
    const rank = c => { const n = c.city.toLowerCase(); return n.startsWith(s) ? 0 : n.includes(s) ? 1 : 9 }
    return allCities.filter(c => c.state !== scoped).map(c => ({ c, r: rank(c) })).filter(x => x.r < 9).sort((a, b) => a.r - b.r || a.c.city.localeCompare(b.c.city)).slice(0, 7).map(x => x.c)
  }, [qx, allCities, scoped])
  const primaryMax = scoped ? MAX - 1 : MAX
  const add = (c, s) => { setList(p => [...p, [c, s]]); setQ('') }
  const addExternal = (c, s) => { setList(p => [...p.filter(([, st]) => st === scoped), [c, s]]); setQx('') }
  const remove = i => setList(p => p.filter((_, j) => j !== i))

  const METRICS = {
    tempMax: { name: "Today's high", get: r => r.live?.tempMax, unit: '°C', prov: 'forecast' },
    temp: { name: 'Air temp now', get: r => r.live?.temp, unit: '°C', prov: 'live' },
    aqi: { name: 'AQI (US)', get: r => r.live?.aqi, unit: '', prov: 'live' },
    risk: { name: 'Heat Risk Index', get: r => r.profile.risk, unit: '/100', prov: 'estimate' },
    built: { name: 'Built-up', get: r => r.lulc?.builtUp, unit: '%', prov: 'satellite' },
    lst: { name: 'MODIS season peak', get: r => r.modis?.hottestDay?.c, unit: '°C', prov: 'satellite' }
  }
  const M = METRICS[metric]
  const maxVal = Math.max(1, ...rows.map(r => M.get(r)).filter(v => typeof v === 'number'))
  const fcChart = useMemo(() => {
    if (fc.status !== 'ready' || !fc.rows.length) return []
    const t = fc.rows.find(r => r.time.length)?.time || []
    return t.map((d, i) => { const o = { day: new Date(`${d}T00:00:00+05:30`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', timeZone: 'Asia/Kolkata' }) }; fc.rows.forEach(r => { o[r.city] = r.max[i] ?? null }); return o })
  }, [fc])

  async function summarise() {
    const lines = rows.map(r => `${r.city} (${r.state}): air now ${r.live?.temp ?? 'n/a'}°C, today's high ${r.live?.tempMax ?? 'n/a'}°C, AQI ${r.live?.aqi ?? 'n/a'}, built-up ${r.lulc?.builtUp ?? 'n/a'}%${r.lulc?.isFallback ? ' (estimated from a nearby city)' : ''}, vegetation ${r.lulc?.vegetation ?? 'n/a'}%, heat risk index ${r.profile.risk ?? 'n/a'}/100 (model estimate), MODIS season-peak surface ${r.modis?.hottestDay?.c ?? 'n/a'}°C, 7-day forecast highs ${(fc.rows.find(x => x.city === r.city)?.max || []).join('/') || 'n/a'}°C`)
    const context = `Comparison data (only use these numbers; say "not available" for anything missing; do not invent population or casualty figures): ${lines.join(' | ')}`.slice(0, 3900)
    setAi({ status: 'loading', text: '', error: null, at: null })
    try {
      const r = await fetch('/api/ask-ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: `Compare the heat risk of ${rows.map(r => r.city).join(', ')} for a district official in 5 short bullet points: which city needs attention first and why, and one action per city. English.`, context, history: [] }) })
      const j = await r.json().catch(() => null)
      if (!r.ok || !j?.answer) throw new Error(j?.error || `HTTP ${r.status}`)
      setAi({ status: 'ready', text: j.answer, error: null, at: new Date() })
    } catch (e) { setAi({ status: 'error', text: '', error: e.message, at: null }) }
  }

  const tip = { background: C.card, border: `1px solid ${C.border}`, fontSize: 11, color: C.text }
  const cols = `repeat(${rows.length}, minmax(0, 1fr))`

  return (
    <div data-testid="compare-workspace" style={wsRoot}>
      <WorkspaceHeader no="04" title="Multi-city intelligence" sub={`Compare up to ${MAX} cities. The first column follows the city selected in the header; your other choices are remembered on this browser.`}
        right={<>
          {scoped && <span data-testid="cmp-scope" style={{ fontSize: 10, fontWeight: 800, color: C.amber, border: `1px solid ${C.amber}66`, borderRadius: 6, padding: '3px 8px' }}>INTRA-STATE: {scoped.toUpperCase()}</span>}
          <div style={{ position: 'relative', width: 260 }}>
            <input value={q} onChange={e => setQ(e.target.value)} disabled={ownCount >= primaryMax} placeholder={ownCount >= primaryMax ? `Maximum ${primaryMax} ${scoped ? `${scoped} cities` : 'cities'}` : scoped ? `Add a ${scoped} city…` : 'Add a city to compare…'} data-testid="cmp-search" aria-label="Add a city to compare"
              onKeyDown={e => { if (e.key === 'Enter' && results[0]) add(results[0].city, results[0].state) }}
              style={{ width: '100%', background: C.raised, border: `1px solid ${C.border}`, color: C.text, borderRadius: 8, padding: '7px 10px', fontSize: 12 }} />
            {results.length > 0 && (
              <ul style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 60, margin: '4px 0 0', padding: 0, listStyle: 'none', background: C.card, border: `1px solid ${C.border}`, borderRadius: 8 }}>
                {results.map(r => <li key={`${r.city}|${r.state}`}><button type="button" onClick={() => add(r.city, r.state)} style={{ width: '100%', textAlign: 'left', background: 'transparent', border: 'none', color: C.text, padding: '6px 10px', fontSize: 12, cursor: 'pointer' }}>{r.city} <span style={{ color: C.muted }}>· {r.state}</span></button></li>)}
              </ul>
            )}
          </div>
          {scoped && (
            <div style={{ position: 'relative', width: 270 }}>
              <input value={qx} onChange={e => setQx(e.target.value)} disabled={!!external} placeholder={external ? '1 external benchmark added' : '+ Add 1 External State District (Benchmark)'} data-testid="cmp-search-external" aria-label="Add one city outside your state as a benchmark"
                onKeyDown={e => { if (e.key === 'Enter' && resultsX[0]) addExternal(resultsX[0].city, resultsX[0].state) }}
                style={{ width: '100%', background: C.raised, border: `1px dashed ${C.amber}88`, color: C.text, borderRadius: 8, padding: '7px 10px', fontSize: 12 }} />
              {resultsX.length > 0 && (
                <ul style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 60, margin: '4px 0 0', padding: 0, listStyle: 'none', background: C.card, border: `1px solid ${C.border}`, borderRadius: 8 }}>
                  {resultsX.map(r => <li key={`${r.city}|${r.state}`}><button type="button" onClick={() => addExternal(r.city, r.state)} style={{ width: '100%', textAlign: 'left', background: 'transparent', border: 'none', color: C.text, padding: '6px 10px', fontSize: 12, cursor: 'pointer' }}>{r.city} <span style={{ color: C.muted }}>· {r.state}</span></button></li>)}
                </ul>
              )}
            </div>
          )}
        </>} />

      {/* CITY CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: cols, gap: 10 }} data-testid="cmp-cards">
        {rows.map((r, i) => {
          const rl = riskLabel(r.profile.risk)
          return (
            <div key={`${r.city}|${r.state}`} style={{ ...card, padding: 0, overflow: 'hidden', borderTop: `3px solid ${r.color}` }}>
              <div style={{ position: 'relative' }}>
                <LocationImage city={r.city} state={r.state} size="hero" />
                <div style={{ position: 'absolute', left: 10, top: 8, right: 10, display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                  <div style={{ textShadow: '0 1px 6px rgba(0,0,0,0.9)' }}><div style={{ fontSize: 15, fontWeight: 900 }}>{r.city}</div><div style={{ fontSize: 10, color: '#cbd5e1' }}>{r.state}</div></div>
                  {i > 0 && <button type="button" onClick={() => remove(i)} aria-label={`Remove ${r.city}`} style={{ marginLeft: 'auto', background: 'rgba(6,11,20,0.75)', border: `1px solid ${C.border}`, color: C.text, borderRadius: 6, cursor: 'pointer', fontSize: 11 }}>✕</button>}
                  {i === 0 && <span style={{ marginLeft: 'auto', fontSize: 9, fontWeight: 800, background: 'rgba(6,11,20,0.75)', padding: '2px 6px', borderRadius: 4, color: C.cyan }}>SELECTED</span>}
                </div>
              </div>
              <div style={{ padding: '8px 10px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 11 }}>
                {[
                  ['Air now', r.live?.temp != null ? `${r.live.temp}°C` : '—', 'live', r.live?.temp],
                  ["Today's high", r.live?.tempMax != null ? `${r.live.tempMax}°C` : '—', 'forecast', r.live?.tempMax],
                  ['Risk index', r.profile.risk != null ? `${r.profile.risk}` : '—', 'estimate', null, rl.color],
                  ['AQI (US)', r.live?.aqi ?? '—', 'live'],
                  ['Built-up', r.lulc?.builtUp != null ? `${r.lulc.builtUp}%` : '—', r.lulc ? (r.lulc.isFallback ? 'estimate' : 'satellite') : 'na'],
                  ['MODIS peak', r.modis?.hottestDay ? `${r.modis.hottestDay.c}°C` : r.modis === null ? 'n/a' : '…', r.modis?.hottestDay ? 'satellite' : 'na', r.modis?.hottestDay?.c]
                ].map(([k, v, p, t, col]) => (
                  <div key={k} style={{ background: C.raised, borderRadius: 6, padding: '5px 7px' }}>
                    <div style={{ fontSize: 9, color: C.muted, display: 'flex', justifyContent: 'space-between', gap: 4 }}>{k}<Prov k={p} /></div>
                    <div style={{ fontWeight: 800, fontSize: 14, color: col || (typeof t === 'number' ? spectralColor(t) : C.text), ...num }}>{v}</div>
                  </div>
                ))}
              </div>
              {scoped && r.state !== scoped && <div data-testid="cmp-readonly" style={{ margin: '0 10px 6px', fontSize: 9.5, fontWeight: 800, border: `1px solid ${C.amber}88`, background: 'rgba(245,158,11,0.08)', padding: '4px 6px', borderRadius: 5, color: C.amber, textAlign: 'center' }}>🔒 Read-Only Benchmark — Outside State Jurisdiction</div>}
              {r.lulc?.isFallback && <div style={{ fontSize: 9, color: C.muted, padding: '0 10px 6px' }}>Land cover estimated from {r.lulc.fallbackCity}.</div>}
              <div style={{ display: 'flex', gap: 6, padding: '0 10px 10px' }}>
                {i > 0 && !(scoped && r.state !== scoped) && <button type="button" onClick={() => onSelectCity(r.city, r.state)} style={{ ...btn('transparent', C.muted), fontSize: 10, padding: '4px 8px' }}>Make primary</button>}
              </div>
            </div>
          )
        })}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: 10, alignItems: 'stretch' }}>
        <Section no="01" title="Side-by-side metric" testId="cmp-metric" right={<Prov k={M.prov} />}>
          <select value={metric} onChange={e => setMetric(e.target.value)} aria-label="Metric" data-testid="cmp-metric-select" style={{ background: C.raised, color: C.text, border: `1px solid ${C.border}`, borderRadius: 6, padding: '4px 8px', fontSize: 11, alignSelf: 'flex-start' }}>
            {Object.entries(METRICS).map(([k, v]) => <option key={k} value={k}>{v.name}</option>)}
          </select>
          {rows.map(r => { const v = M.get(r); return (
            <div key={r.city} style={{ display: 'grid', gridTemplateColumns: '110px 1fr 64px', alignItems: 'center', gap: 8, fontSize: 11 }}>
              <span style={{ color: r.color, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.city}</span>
              <div style={{ height: 10, background: C.raised, borderRadius: 5 }}><div style={{ width: `${typeof v === 'number' ? Math.max(2, (v / maxVal) * 100) : 0}%`, height: '100%', borderRadius: 5, background: r.color }} /></div>
              <span style={{ textAlign: 'right', fontWeight: 800, ...num }}>{typeof v === 'number' ? `${v}${M.unit}` : 'n/a'}</span>
            </div>) })}
          <div style={{ fontSize: 9.5, color: C.muted }}>Heat Risk Index is a model estimate from the forecast high, the MODIS peak, built-up share and canopy. n/a = the source holds no value for that city.</div>
        </Section>

        <Section no="02" title="7-day forecast highs" testId="cmp-forecast" right={<Prov k="forecast" title="Open-Meteo deterministic daily maximum" />}>
          {(() => {
            const vals = fcChart.flatMap(d => rows.map(r => d[r.city]))
            const top = Math.max(...vals.filter(v => typeof v === 'number'), -99)
            const showTh = 40 - top <= 8
            const sc = niceScale(vals, { step: 2, include: showTh ? [40] : [] })
            const hottest = fc.rows.map(r => ({ city: r.city, peak: Math.max(...r.max.filter(v => v != null)) })).filter(r => Number.isFinite(r.peak)).sort((a, b) => b.peak - a.peak)
            return (
              <>
                <div style={{ height: 210 }}>
                  {fcChart.length ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={fcChart} margin={{ top: 10, right: 14, left: 4, bottom: 4 }}>
                        <CartesianGrid stroke={C.border} strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="day" tick={axisTick} tickLine={false} />
                        <YAxis domain={sc.domain} ticks={sc.ticks} tickFormatter={v => `${v}°`} tick={axisTick} width={58} label={yLabel('Daily max (°C)')} />
                        <Tooltip {...tipStyle} formatter={v => (v == null ? 'n/a' : `${v}°C`)} itemSorter={it => -(it.value ?? -99)} />
                        {showTh && <ReferenceLine y={40} stroke={C.red} strokeWidth={1.5} strokeDasharray="6 4" label={{ value: 'Heatwave threshold 40°C (IMD plains)', fill: C.red, fontSize: 10.5, fontWeight: 700, position: 'insideTopLeft' }} />}
                        {rows.map(r => <Line key={r.city} dataKey={r.city} stroke={r.color} strokeWidth={2.5} dot={{ r: 2.5, fill: r.color }} connectNulls isAnimationActive={false} />)}
                      </LineChart>
                    </ResponsiveContainer>
                  ) : <div style={{ height: '100%', display: 'grid', placeItems: 'center', fontSize: 11, color: C.muted }}>{fc.status === 'error' ? `Forecast UNAVAILABLE: ${fc.error}` : 'Fetching forecasts…'}</div>}
                </div>
                <ChartKey items={[...rows.map(r => ['line', r.color, r.city]), ...(showTh ? [['dash', C.red, 'IMD 40°C threshold']] : [])]} />
                {hottest.length > 1 && <ChartRead><b>{hottest[0].city}</b> runs hottest this week (peak {hottest[0].peak}°C){hottest[0].peak < 40 ? ', still below the 40°C plains heatwave line' : ', at or above the 40°C plains heatwave line'}. Coastal and hill cities use lower thresholds (37°C and 30°C).</ChartRead>}
              </>
            )
          })()}
        </Section>
      </div>

      <Section no="03" title="Synchronised satellite view · same zoom for every city" testId="cmp-maps" right={<span style={{ display: 'flex', gap: 6, alignItems: 'center' }}><Pills value={String(zoom)} onChange={v => setZoom(+v)} options={[['9', 'Region'], ['11', 'City'], ['13', 'Core'], ['15', 'Blocks']]} /><Prov k="satellite" title="Esri World Imagery (Maxar); dashed ring = the ~5 km land-cover sample" /></span>}>
        <div style={{ display: 'grid', gridTemplateColumns: cols, gap: 10 }}>
          {rows.map(r => (
            <div key={r.city}>
              {typeof r.coords?.lat === 'number' ? <MiniSatMap lat={r.coords.lat} lon={r.coords.lon} zoom={zoom} onZoom={setZoom} color={r.color} /> : <div style={{ height: 150, display: 'grid', placeItems: 'center', fontSize: 11, color: C.muted, background: C.raised, borderRadius: 8 }}>No coordinates</div>}
              <div style={{ fontSize: 10, color: r.color, fontWeight: 700, marginTop: 3 }}>{r.city}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 9.5, color: C.muted }}>Imagery © Esri, Maxar, Earthstar Geographics. Imagery dates differ by city; it shows urban form, not current conditions. Zooming one map zooms all of them.</div>
      </Section>

      <Section no="04" title="AI comparison summary" testId="cmp-ai" right={<Prov k="ai" title="Written by Gemini via /api/ask-ai from the numbers above only" />}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button type="button" onClick={summarise} disabled={ai.status === 'loading' || rows.length < 2} style={btn(rows.length < 2 ? C.border : C.amber)} data-testid="cmp-ai-run">{ai.status === 'loading' ? 'Writing…' : ai.status === 'ready' ? 'Regenerate summary' : 'Generate AI summary'}</button>
          <span style={{ fontSize: 10, color: C.muted }}>Sends only the metrics shown above to the existing AGNI endpoint. Check every figure against the cards.</span>
        </div>
        {ai.status === 'ready' && <div style={{ fontSize: 12, lineHeight: 1.55, whiteSpace: 'pre-wrap', background: C.raised, borderRadius: 8, padding: '8px 10px' }} data-testid="cmp-ai-text">{ai.text}<div style={{ fontSize: 9.5, color: C.muted, marginTop: 6 }}>AI-generated {ai.at?.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })} IST. Not an official assessment.</div></div>}
        {ai.status === 'error' && <div style={{ fontSize: 11, color: C.amber }}>AI summary unavailable: {ai.error}. The comparison above is unaffected.</div>}
      </Section>

      <DetailsDrawer testId="cmp-details-toggle" what="radar comparison panel (existing)">{children}</DetailsDrawer>
    </div>
  )
}
