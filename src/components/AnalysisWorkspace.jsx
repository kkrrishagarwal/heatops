import React, { useEffect, useMemo, useRef, useState } from 'react'
import { ScatterChart, Scatter, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, BarChart, Bar, Cell, ZAxis } from 'recharts'
import { C, card, label, num, Prov, Section, SubHead, Pills, WorkspaceHeader, DetailsDrawer, wsRoot, btn } from './workspaceKit'
import HudLeafletMap from './HudLeafletMap'
import LocationImage from './LocationImage'
import { airOverlay, modisLatestOverlay, lulcOverlay, spectralColor, spectralGradientCss, stateDataFromPoints, builtUpColor, BUILT_UP_LEGEND } from '../utils/hudOverlay'
import { buildDistrictHeat, districtKey, districtName } from '../utils/districtHeat'
import { getLulcWithFallback } from '../utils/lulcFallback'
import { loadModisIndex } from '../utils/modisLst'

// WORKSPACE 3 — ANALYSIS: Geospatial Heat Intelligence (GIS layout).
// Layer rail → large state map (districts coloured from the active layer) → district
// drill-down with its identity photo → diagnostics computed only from data the app holds.
const LAYERS = {
  air: { name: 'Air temperature (now)', unit: '°C', prov: 'live', src: 'Open-Meteo live cache, 2 m air temperature' },
  max: { name: "Today's forecast high", unit: '°C', prov: 'forecast', src: 'Open-Meteo daily maximum, live cache' },
  modis: { name: 'Land surface temp (MODIS)', unit: '°C', prov: 'satellite', src: 'NASA MODIS MOD11A1, latest clear-sky pass per city' },
  built: { name: 'Built-up share', unit: '%', prov: 'satellite', src: 'ESA WorldCover 2021, ~5 km around each classified city' }
}

function pearson(xs, ys) {
  const n = xs.length; if (n < 3) return null
  const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n
  let sxy = 0, sxx = 0, syy = 0
  for (let i = 0; i < n; i++) { const dx = xs[i] - mx, dy = ys[i] - my; sxy += dx * dy; sxx += dx * dx; syy += dy * dy }
  return sxx && syy ? Math.round((sxy / Math.sqrt(sxx * syy)) * 100) / 100 : null
}

export default function AnalysisWorkspace({ city, state, liveCityCache, liveIndiaData, cityCoordsData, lulcReal, buckets = [], resolveStateName, onSelectCity, liveWeather, children }) {
  const [layer, setLayer] = useState('air')
  const [basemap, setBasemap] = useState('dark')
  const [opacity, setOpacity] = useState(0.8)
  const [modisIndex, setModisIndex] = useState(null)
  const [modisErr, setModisErr] = useState(null)
  const [features, setFeatures] = useState(null)
  const [picked, setPicked] = useState(null) // { district, state, entry }
  const mapCtl = useRef(null)
  const coords = cityCoordsData?.[`${city}|${state}`]
  const L = LAYERS[layer]
  const colorOf = layer === 'built' ? builtUpColor : spectralColor

  useEffect(() => { if (layer === 'modis' && !modisIndex) loadModisIndex().then(setModisIndex).catch(e => setModisErr(e.message)) }, [layer, modisIndex])
  useEffect(() => { setPicked(null) }, [state])

  const points = useMemo(() => {
    if (layer === 'modis') return modisIndex ? modisLatestOverlay({ modisIndex, coords: cityCoordsData, colorFor: spectralColor }).points : []
    if (layer === 'built') return lulcOverlay({ lulcReal }).points
    return airOverlay({ liveCityCache, coords: cityCoordsData, colorFor: spectralColor, field: layer === 'max' ? 'tempMax' : 'temp' }).points
  }, [layer, modisIndex, lulcReal, liveCityCache, cityCoordsData])
  const stateData = useMemo(() => stateDataFromPoints({ base: liveIndiaData, points, buckets, scrubLabel: L.src, colorOfValue: colorOf }), [liveIndiaData, points, buckets, L.src, colorOf])
  const districtHeat = useMemo(() => {
    if (!features) return null
    const dh = buildDistrictHeat({ features, points, resolveState: resolveStateName, colorFor: colorOf, sparse: points.length < 500 })
    if (layer !== 'built') for (const d of Object.values(dh)) if (d.value != null) d.label = buckets.find(b => d.value >= b.min)?.label || ''
    dh.__unit = L.unit; return dh
  }, [features, points, resolveStateName, colorOf, buckets, layer, L.unit])
  const districts = useMemo(() => {
    if (!features || !districtHeat) return []
    return features.filter(f => resolveStateName(f) === state).map(f => ({ name: districtName(f), ...(districtHeat[districtKey(f)] || {}) }))
  }, [features, districtHeat, resolveStateName, state])
  const withValue = districts.filter(d => d.value != null).sort((a, b) => b.value - a.value)
  useEffect(() => { if (typeof coords?.lat !== 'number') return; const t = setTimeout(() => mapCtl.current?.flyTo(coords.lat, coords.lon, 7), 300); return () => clearTimeout(t) }, [coords, features])

  // Coverage diagnostic: how each district got its value.
  const coverage = useMemo(() => {
    const c = { direct: 0, nearest: 0, far: 0, none: 0 }
    for (const d of districts) c[d.value == null ? 'none' : (d.method || 'none')] = (c[d.value == null ? 'none' : (d.method || 'none')] || 0) + 1
    return c
  }, [districts])
  // Distribution of district values (histogram).
  const hist = useMemo(() => {
    if (!withValue.length) return []
    const step = layer === 'built' ? 10 : 2
    const lo = Math.floor(Math.min(...withValue.map(d => d.value)) / step) * step
    const hi = Math.ceil((Math.max(...withValue.map(d => d.value)) + 0.001) / step) * step
    const bins = []
    for (let b = lo; b < hi; b += step) bins.push({ bin: `${b}–${b + step}`, mid: b + step / 2, n: withValue.filter(d => d.value >= b && d.value < b + step).length })
    return bins
  }, [withValue, layer])
  // Urban-heat diagnostic across ALL classified cities nationally: built-up share vs live air temp.
  const scatter = useMemo(() => {
    const out = []
    for (const [name, c] of Object.entries(lulcReal?.cities || {})) {
      const live = liveCityCache?.[`${name}|${c.state}`]
      if (typeof c.builtUp === 'number' && typeof live?.tempMax === 'number') out.push({ city: name, state: c.state, x: c.builtUp, y: live.tempMax, inState: c.state === state })
    }
    return out
  }, [lulcReal, liveCityCache, state])
  const r = pearson(scatter.map(p => p.x), scatter.map(p => p.y))

  // Drill-down: picked district, else the selected city's own district if we can find it.
  const drill = picked || (withValue.find(d => d.city === city) ? { district: withValue.find(d => d.city === city).name, state, entry: withValue.find(d => d.city === city) } : null)
  const dCity = drill?.entry?.city
  const dLive = dCity ? liveCityCache?.[`${dCity}|${state}`] : null
  const dLulc = dCity && lulcReal ? getLulcWithFallback(dCity, state, lulcReal, cityCoordsData) : null
  const dRank = drill ? withValue.findIndex(d => d.name === drill.district) + 1 : 0
  const median = withValue.length ? withValue[Math.floor(withValue.length / 2)].value : null
  const tip = { background: C.card, border: `1px solid ${C.border}`, fontSize: 11, color: C.text }
  const legend = layer === 'built'
    ? <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{BUILT_UP_LEGEND.map(([c, t]) => <span key={t} style={{ fontSize: 9 }}><span style={{ display: 'inline-block', width: 9, height: 9, background: c, borderRadius: 2, marginRight: 3 }} />{t}%</span>)}</div>
    : <><div style={{ width: 160, height: 7, borderRadius: 3, background: spectralGradientCss() }} /><div style={{ display: 'flex', justifyContent: 'space-between', width: 160 }}><span>&lt;10°C</span><span>25</span><span>35</span><span>45+</span></div></>

  return (
    <div data-testid="analysis-workspace" style={wsRoot}>
      <WorkspaceHeader no="03" title={`Geospatial heat intelligence · ${state}`} sub="Choose a layer, click a district to drill down. District values come from the city in that district, or the nearest cities when it has none (marked est.)." />

      <div style={{ display: 'grid', gridTemplateColumns: '210px minmax(0, 1fr) 300px', gap: 10, alignItems: 'stretch' }}>
        {/* LAYER RAIL */}
        <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 8 }} data-testid="an-layers">
          <div style={label}>Data layer</div>
          {Object.entries(LAYERS).map(([k, v]) => (
            <button key={k} type="button" onClick={() => setLayer(k)} aria-pressed={layer === k} data-testid={`an-layer-${k}`}
              style={{ textAlign: 'left', padding: '7px 9px', borderRadius: 7, border: `1px solid ${layer === k ? C.cyan : C.border}`, background: layer === k ? 'rgba(56,189,248,0.10)' : 'transparent', color: layer === k ? C.text : C.muted, cursor: 'pointer' }}>
              <div style={{ fontSize: 11.5, fontWeight: 800 }}>{v.name}</div>
              <div style={{ fontSize: 9, marginTop: 2, display: 'flex', gap: 4, alignItems: 'center' }}><Prov k={v.prov} /> <span>{v.unit}</span></div>
            </button>
          ))}
          {layer === 'modis' && modisErr && <div style={{ fontSize: 10, color: C.amber }}>MODIS index failed to load: {modisErr}</div>}
          <div style={{ ...label, marginTop: 6 }}>Basemap</div>
          <Pills value={basemap} onChange={setBasemap} options={[['dark', 'Dark'], ['esri', 'Satellite']]} />
          <div style={{ ...label, marginTop: 6 }}>Fill opacity · {Math.round(opacity * 100)}%</div>
          <input type="range" min={0.2} max={1} step={0.05} value={opacity} onChange={e => setOpacity(+e.target.value)} aria-label="Fill opacity" />
          <div style={{ fontSize: 9.5, color: C.muted, marginTop: 'auto', lineHeight: 1.4 }}>{L.src}. {points.length} source points.</div>
        </div>

        {/* MAP */}
        <div style={{ ...card, padding: 0, position: 'relative', minHeight: 470, overflow: 'hidden' }} data-testid="an-map">
          <HudLeafletMap stateData={stateData} resolveStateName={resolveStateName} points={[]} showDots={false} showFills basemap={basemap} selectedState={state} onStateClick={() => {}}
            districtHeat={districtHeat} onDistrictClick={(c, st, info) => setPicked(info ? { district: info.district, state: info.state, entry: info.entry } : null)} onGeoLoaded={setFeatures} detailZoom={4} controlRef={mapCtl} fillStrength={opacity}
            focus={coords && typeof coords.lat === 'number' ? { lat: coords.lat, lon: coords.lon } : null} />
          <div style={{ position: 'absolute', left: 10, bottom: 10, zIndex: 500, background: 'rgba(6,11,20,0.85)', border: `1px solid ${C.border}`, borderRadius: 6, padding: '6px 8px', fontSize: 9, color: C.muted }}>
            <div style={{ fontWeight: 800, color: C.text, marginBottom: 3 }}>{L.name}</div>{legend}
          </div>
        </div>

        {/* DRILL-DOWN */}
        <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 8 }} data-testid="an-drill">
          <div style={label}>District drill-down</div>
          {drill ? (
            <>
              <div style={{ borderRadius: 8, overflow: 'hidden', border: `1px solid ${C.border}` }}><LocationImage city={dCity} district={drill.district} state={state} size="hero" /></div>
              <div style={{ fontSize: 16, fontWeight: 900 }}>{drill.district}<span style={{ color: C.muted, fontWeight: 500, fontSize: 12 }}> · {state}</span></div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontSize: 26, fontWeight: 900, color: drill.entry?.color || C.text, ...num }}>{drill.entry?.value ?? '—'}{L.unit}</span>
                <Prov k={drill.entry?.method === 'direct' ? L.prov : 'estimate'} title={drill.entry?.method === 'direct' ? `Reading from ${drill.entry.city}` : 'Estimated from the nearest cities'} />
              </div>
              <div style={{ fontSize: 10.5, color: C.muted }}>
                {drill.entry?.method === 'direct' ? `Reading from ${drill.entry.city}.` : drill.entry?.cities?.length ? `Estimated from ${drill.entry.cities.join(', ')}.` : 'No reading within reach.'}
                {dRank ? ` Ranked ${dRank} of ${withValue.length} districts on this layer; state median ${median}${L.unit}.` : ''}
              </div>
              {dLive && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 11 }}>
                  {[['Air now', typeof dLive.temp === 'number' ? `${dLive.temp}°C` : '—', 'live'], ["Today's high", typeof dLive.tempMax === 'number' ? `${dLive.tempMax}°C` : '—', 'forecast'], ['AQI (US)', dLive.aqi ?? '—', 'live'], ['Cloud cover', typeof dLive.cloudCover === 'number' ? `${dLive.cloudCover}%` : '—', 'live']].map(([k, v, p]) => (
                    <div key={k} style={{ background: C.raised, borderRadius: 6, padding: '5px 7px' }}><div style={{ fontSize: 9, color: C.muted, display: 'flex', justifyContent: 'space-between' }}>{k}<Prov k={p} /></div><div style={{ fontWeight: 800, ...num }}>{v}</div></div>
                  ))}
                </div>
              )}
              {dLive && <div style={{ fontSize: 9.5, color: C.muted }}>City readings from {dCity}{dLive.isCarriedForward ? ' (carried forward)' : ''}.</div>}
              {dLulc && <div style={{ fontSize: 11 }}>Land cover: <b>{dLulc.builtUp}%</b> built-up, <b>{dLulc.vegetation}%</b> vegetation <Prov k={dLulc.isFallback ? 'estimate' : 'satellite'} title={dLulc.isFallback ? `Estimated from ${dLulc.fallbackCity}` : 'ESA WorldCover'} /></div>}
              {dCity && <button type="button" onClick={() => onSelectCity(dCity, state)} style={btn()} data-testid="an-open-city">Open {dCity} in the workspaces</button>}
            </>
          ) : <div style={{ fontSize: 11, color: C.muted }}>Click a district on the map. Districts load with the map.</div>}

          <SubHead prov={L.prov}>Top districts · {L.name}</SubHead>
          {withValue.slice(0, 6).map((d, i) => (
            <button key={d.name} type="button" onClick={() => setPicked({ district: d.name, state, entry: d })} style={{ display: 'flex', justifyContent: 'space-between', background: 'none', border: 'none', borderTop: i ? `1px solid ${C.border}` : 'none', color: C.text, padding: '3px 0', fontSize: 11, cursor: 'pointer' }}>
              <span><span style={{ color: C.muted }}>{i + 1}.</span> {d.name}{d.method !== 'direct' ? <span style={{ color: C.muted, fontSize: 9 }}> · est.</span> : ''}</span><span style={{ color: d.color, fontWeight: 800, ...num }}>{d.value}{L.unit}</span>
            </button>
          ))}
        </div>
      </div>

      {/* DIAGNOSTICS */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 0.8fr', gap: 10, alignItems: 'stretch' }}>
        <Section no="01" title={`Distribution of district values · ${state}`} testId="an-hist" right={<Prov k={L.prov} />}>
          <div style={{ height: 170 }}>
            {hist.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hist} margin={{ top: 6, right: 6, left: -22, bottom: 0 }}>
                  <XAxis dataKey="bin" tick={{ fill: C.muted, fontSize: 9 }} />
                  <YAxis allowDecimals={false} tick={{ fill: C.muted, fontSize: 9 }} />
                  <Tooltip contentStyle={tip} formatter={v => [`${v} districts`, 'count']} />
                  <Bar dataKey="n" isAnimationActive={false}>{hist.map((h, i) => <Cell key={i} fill={colorOf(h.mid)} />)}</Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <div style={{ fontSize: 11, color: C.muted }}>No district values on this layer yet.</div>}
          </div>
          <div style={{ fontSize: 10, color: C.muted }}>{withValue.length} of {districts.length} districts have a value{withValue.length ? `; range ${withValue[withValue.length - 1].value}–${withValue[0].value}${L.unit}, median ${median}${L.unit}` : ''}.</div>
        </Section>

        <Section no="02" title="Built-up share vs today's high · classified cities" testId="an-scatter" right={<Prov k="estimate" title="Descriptive correlation across cities; not a causal estimate" />}>
          <div style={{ height: 170 }}>
            {scatter.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 6, right: 10, left: -18, bottom: 0 }}>
                  <CartesianGrid stroke={C.border} strokeDasharray="3 3" />
                  <XAxis type="number" dataKey="x" name="Built-up" unit="%" tick={{ fill: C.muted, fontSize: 9 }} />
                  <YAxis type="number" dataKey="y" name="High" unit="°" domain={['dataMin - 1', 'dataMax + 1']} tick={{ fill: C.muted, fontSize: 9 }} />
                  <ZAxis range={[22, 22]} />
                  <Tooltip contentStyle={tip} formatter={(v, n) => [n === 'Built-up' ? `${v}%` : `${v}°C`, n]} labelFormatter={() => ''} />
                  <Scatter data={scatter.filter(p => !p.inState)} fill="#475569" isAnimationActive={false} />
                  <Scatter data={scatter.filter(p => p.inState)} fill={C.amber} isAnimationActive={false} />
                </ScatterChart>
              </ResponsiveContainer>
            ) : <div style={{ fontSize: 11, color: C.muted }}>Needs land-cover and live data.</div>}
          </div>
          <div style={{ fontSize: 10, color: C.muted }}>n = {scatter.length} cities, Pearson r = {r ?? '—'}. Amber = {state}. Climate zone, elevation and the coast dominate city-to-city differences, so this is a descriptive check, not proof that built-up area raises temperature.</div>
        </Section>

        <Section no="03" title="Data coverage" testId="an-coverage" right={<Prov k="rules" />}>
          {[['direct', 'Own city reading', C.green], ['nearest', 'Nearest cities (≤150 km)', C.cyan], ['far', 'Sparse estimate (≤400 km)', C.amber], ['none', 'No reading', C.muted]].map(([k, v, c]) => (
            <div key={k} style={{ display: 'grid', gridTemplateColumns: '1fr 34px', fontSize: 11, alignItems: 'center', gap: 6 }}>
              <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: c, marginRight: 6 }} />{v}</span><b style={{ textAlign: 'right', ...num }}>{coverage[k] || 0}</b>
            </div>
          ))}
          <div style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>Of {districts.length} districts in {state} on the {L.name.toLowerCase()} layer. Estimated districts are rounded and labelled est. on the map tooltip.</div>
          {liveWeather?.isFallbackLocation && <div style={{ fontSize: 10, color: C.amber }}>{city} has no coordinate of its own; its live reading comes from the state's representative city.</div>}
        </Section>
      </div>

      <DetailsDrawer testId="an-details-toggle" what="satellite LST, ML model, land cover, urban morphology, heat grid, GEE pipeline">{children}</DetailsDrawer>
    </div>
  )
}
