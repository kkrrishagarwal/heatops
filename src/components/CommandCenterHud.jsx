import React, { useEffect, useMemo, useRef, useState } from 'react'
import { MiniGrid } from './MiniGridPair'
import HeatCoPilot, { buildCopilotInput } from './HeatCoPilot'
import HeatActionChecklist from './HeatActionChecklist'
import AppErrorBoundary from './AppErrorBoundary'
import ModeToggle from './ModeToggle'
import CapAlertButton from './CapAlertButton'
import { jurisdictionLabel } from '../utils/jurisdiction'
import { fetchGrid, gridOverlay } from '../utils/heatPower'
import { activationLevel, LEVELS } from '../utils/heatActionProtocol'
import { assessHeatStress } from '../utils/heatStress'
import { loadModisIndex } from '../utils/modisLst'
import { fetchJson } from '../utils/fetchJson'
import { BASEMAPS, gibsSafeDate } from './SatelliteBasemap'
import HudLeafletMap from './HudLeafletMap'
import WindParticleCanvas, { windStations, describeProbe, compassOf, thermalColor } from './WindParticleCanvas'
import { HUD_LAYERS, MODIS_YEAR_MIN, MODIS_YEAR_MAX, airOverlay, modisLatestOverlay, modisYearOverlay, modisNationalDayOverlay, lulcOverlay, stateDataFromPoints, builtUpColor, BUILT_UP_LEGEND, spectralColor, spectralRgb, spectralGradientCss, SPECTRAL_LEGEND } from '../utils/hudOverlay'
import { buildDistrictHeat } from '../utils/districtHeat'

// COMMAND CENTER — the map-centric "satellite HUD" layout for the Authority view: the India
// map fills the viewport (rendered by App through renderMap so zoom/pan state stays in one
// place), with three floating docks over it and no page scroll:
//   left   — layer toggles, city selector, alert triage badge, 10×10 thermal grid
//   right  — AI Heat Response Co-Pilot (directive, actions, SMS/SDMA/brief) + checklist
//   bottom — timeline scrubber: Historical (MODIS 2016–2026) · Live Pass · Forecast (7 days)
// Every overlay point is a real reading (see utils/hudOverlay.js). Docks scroll internally.
const DOCK = 'absolute z-10 bg-slate-950/85 backdrop-blur-md rounded-xl p-4 text-slate-100 shadow-2xl border'
const H3 = 'text-[10px] font-bold tracking-[0.14em] uppercase text-slate-400 mb-2'
const BTN = 'rounded-md border border-slate-600 px-2 py-1 text-[11px] font-semibold text-slate-200 hover:border-amber-400 hover:text-amber-300 transition-colors'
const BTN_ON = 'rounded-md border border-amber-400 bg-amber-400/15 px-2 py-1 text-[11px] font-semibold text-amber-300'

function istNow() {
  return new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false })
}

export default function CommandCenterHud({
  liveIndiaData, resolveStateName, onStateClick, liveCityCache, cityCoordsData, lulcReal, liveWeather,
  selectedState, selectedCity, onSelectCity, allCities = [], colorFor, buckets = [], isCoastal = false,
  cacheStatus, cacheStale = false, cacheAgeLabel, audience, onAudienceChange, onOpenClassic, onOpenDashboard, onLogout, userName,
  teamId = 'B26-0322', lite = false, jurisdiction = null, opsMode = 'disaster'
}) {
  const mapCtl = useRef(null)
  const [zoom, setZoom] = useState(5)
  const [layer, setLayer] = useState('air')
  const [mode, setMode] = useState('live')
  const [year, setYear] = useState(MODIS_YEAR_MAX)
  const [day, setDay] = useState(0)
  const [dateIdx, setDateIdx] = useState(-1) // -1 = latest national pass
  const [modisIndex, setModisIndex] = useState(null)
  const [modisErr, setModisErr] = useState(false)
  const [daily, setDaily] = useState(null) // national day-by-day passes, loaded for Live Pass
  const [yearly, setYearly] = useState(null)
  const [query, setQuery] = useState('')
  const [clock, setClock] = useState(istNow)
  const [showGridNote, setShowGridNote] = useState(false)
  const [showDots, setShowDots] = useState(false)
  const [basemap, setBasemap] = useState('dark') // dark | esri (Google-style imagery) | gibs (NASA daily true colour)
  const [composite, setComposite] = useState(true)
  const [showFills, setShowFills] = useState(true) // heat colours on the map; off = borders only
  const [palette, setPalette] = useState('spectral') // spectral (continuous) | ndma (6 risk tiers)
  const [surface, setSurface] = useState('choropleth') // choropleth (polygons) | raster (continuous IDW field)
  const hex2rgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]
  const colorFn = useMemo(() => (palette === 'spectral' ? spectralColor : colorFor), [palette, colorFor])
  const rgbOf = useMemo(() => (layer === 'lulc' ? (v => hex2rgb(builtUpColor(v))) : palette === 'spectral' ? spectralRgb : (v => hex2rgb(colorFor(v)))), [layer, palette, colorFor])
  const [wind, setWind] = useState(false) // Windy-style particle layer
  const [windMode, setWindMode] = useState('thermal') // thermal | stagnation
  const [windSpeedX, setWindSpeedX] = useState(1) // 1 | 2
  const [probe, setProbe] = useState(null)
  const [districtFeatures, setDistrictFeatures] = useState(null)
  const stations = useMemo(() => windStations(liveCityCache, cityCoordsData), [liveCityCache, cityCoordsData]) // Live Pass: fill cloudy days from each city's last pass within 14 days
  const LOOKBACK_DAYS = 14 // state fills carry the data; dots are optional detail
  const pickedDefault = useRef(false)

  useEffect(() => { const id = setInterval(() => setClock(istNow()), 30000); return () => clearInterval(id) }, [])

  // No default city: the HUD opens on an All-India overview. A city is pre-selected only when
  // the URL asks for one — ?city=Jaipur, or the first city of a ?demo=City:46,… link.
  useEffect(() => {
    if (selectedCity || pickedDefault.current || !allCities.length) return
    pickedDefault.current = true
    let want = null
    try {
      const q = new URLSearchParams(window.location.search)
      want = q.get('city') || (q.get('demo') || '').split(',')[0].split(':')[0] || null
      if (want) want = decodeURIComponent(want).trim().toLowerCase()
    } catch { want = null }
    if (!want) return
    const hit = allCities.find(c => c.city.toLowerCase() === want)
    if (hit) onSelectCity(hit.city, hit.state)
  }, [selectedCity, onSelectCity, allCities])

  // MODIS index loads once the surface layer or the timeline needs it.
  const needModis = layer === 'modis' || mode === 'historical'
  useEffect(() => {
    if (!needModis || modisIndex || modisErr) return
    let live = true
    loadModisIndex().then(i => { if (live) setModisIndex(i) }).catch(() => { if (live) setModisErr(true) })
    return () => { live = false }
  }, [needModis, modisIndex, modisErr])

  useEffect(() => {
    if (mode !== 'historical' || yearly) return
    let live = true
    fetchJson('/data/modis-lst/yearly-peaks.json', { timeoutMs: 20000 }).then(y => { if (live) setYearly(y) }).catch(() => { if (live) setYearly({ cities: {} }) })
    return () => { live = false }
  }, [mode, yearly])

  // National day-by-day passes for the Live Pass scrubber (one ~270 KB gzipped file).
  useEffect(() => {
    if (mode !== 'live' || layer !== 'modis' || daily) return
    let live = true
    fetchJson('/data/modis-lst/daily-national.json', { timeoutMs: 30000 }).then(d => { if (live) setDaily(d) }).catch(() => { if (live) setDaily({ dates: [], cities: {} }) })
    return () => { live = false }
  }, [mode, layer, daily])
  useEffect(() => { setDateIdx(-1) }, [mode, layer])
  const stateDates = daily?.dates || []

  const overlay = useMemo(() => {
    if (lite) return null
    if (layer === 'lulc') return lulcOverlay({ lulcReal })
    if (layer === 'modis') {
      if (!modisIndex) return { points: [], count: 0, caption: modisErr ? 'MODIS index unavailable' : 'Loading NASA MODIS index…' }
      if (mode === 'historical') return yearly ? modisYearOverlay({ yearly, coords: cityCoordsData, colorFor: colorFn, year }) : { points: [], count: 0, caption: 'Loading MODIS yearly peaks…' }
      if (mode === 'live' && daily && dateIdx >= 0 && stateDates[dateIdx]) return modisNationalDayOverlay({ daily, coords: cityCoordsData, colorFor: colorFn, dateIdx, lookbackDays: composite ? LOOKBACK_DAYS : 0 })
      return modisLatestOverlay({ modisIndex, coords: cityCoordsData, colorFor: colorFn })
    }
    return airOverlay({ liveCityCache, coords: cityCoordsData, colorFor: colorFn, field: mode === 'forecast' ? 'tempMax' : 'temp' })
  }, [lite, layer, mode, year, dateIdx, stateDates, daily, composite, modisIndex, modisErr, yearly, lulcReal, liveCityCache, cityCoordsData, colorFn])

  // State fills follow the scrubber: everything except "live air temperature" (which is the
  // map's own live colouring already) re-colours the states from the points on screen.
  const scrubbed = !(layer === 'air' && mode === 'live')
  const stateData = useMemo(() => {
    if (!overlay) return null
    if (!scrubbed && palette !== 'spectral') return null // live air + NDMA tiers = the map's own colouring
    const scrubLabel = layer === 'lulc' ? 'ESA WorldCover 2021 built-up share'
      : mode === 'historical' ? `NASA MODIS ${year} Apr–Jun mean surface temperature`
      : mode === 'forecast' ? "Today's forecast high (Open-Meteo)"
      : dateIdx >= 0 && stateDates[dateIdx] ? (composite ? `NASA MODIS ${LOOKBACK_DAYS}-day composite ending ${stateDates[dateIdx]}` : `NASA MODIS day pass, ${stateDates[dateIdx]} (all India)`) : 'NASA MODIS latest clear-sky day pass'
    return stateDataFromPoints({ base: liveIndiaData, points: overlay.points, buckets, kind: layer === 'lulc' ? 'builtUp' : 'heat', scrubLabel: scrubbed ? scrubLabel : 'Live air temperature (Open-Meteo)', colorOfValue: palette === 'spectral' && layer !== 'lulc' ? spectralColor : null })
  }, [scrubbed, overlay, layer, mode, year, dateIdx, stateDates, composite, liveIndiaData, buckets, palette])

  // Per-district values from the active layer's points (semantic zoom). Buckets label each
  // district with the same words the state badge uses.
  const districtHeat = useMemo(() => {
    if (!districtFeatures || !overlay?.points) return null
    const isPct = layer === 'lulc'
    const colorOf = v => (isPct ? builtUpColor(v) : colorFn(v))
    const labelOf = v => (isPct ? `BUILT-UP ${Math.round(v)}%` : (buckets.find(b => v >= b.min)?.label || ''))
    const dh = buildDistrictHeat({ features: districtFeatures, points: overlay.points, resolveState: resolveStateName, colorFor: colorOf, sparse: overlay.points.length < 500 })
    for (const d of Object.values(dh)) if (d.value != null) d.label = labelOf(d.value)
    dh.__unit = isPct ? '%' : '°C'
    return dh
  }, [districtFeatures, overlay, layer, resolveStateName, colorFn, buckets])

  const focus = useMemo(() => {
    const c = cityCoordsData?.[`${selectedCity}|${selectedState}`]
    return c && typeof c.lat === 'number' ? { lon: c.lon, lat: c.lat } : null
  }, [cityCoordsData, selectedCity, selectedState])

  // Alert triage from the same inputs the Co-Pilot uses.
  const copilotInput = useMemo(() => buildCopilotInput({ city: selectedCity, state: selectedState, liveWeather, lulcReal, cityCoordsData, isCoastal }), [selectedCity, selectedState, liveWeather, lulcReal, cityCoordsData, isCoastal])
  const act = useMemo(() => activationLevel(copilotInput), [copilotInput])

  // Jurisdiction landing: a state administrator's map flies to their state once on arrival.
  const landed = useRef(false)
  useEffect(() => {
    if (landed.current || jurisdiction?.type !== 'state' || !districtFeatures) return
    const pts = Object.entries(cityCoordsData || {}).filter(([k, c]) => k.endsWith(`|${jurisdiction.state}`) && typeof c?.lat === 'number').map(([, c]) => c)
    if (!pts.length) return
    landed.current = true
    const lat = pts.reduce((a, c) => a + c.lat, 0) / pts.length, lon = pts.reduce((a, c) => a + c.lon, 0) / pts.length
    const span = Math.max(Math.max(...pts.map(c => c.lat)) - Math.min(...pts.map(c => c.lat)), Math.max(...pts.map(c => c.lon)) - Math.min(...pts.map(c => c.lon)))
    setTimeout(() => mapCtl.current?.flyTo(lat, lon, span > 8 ? 5.5 : span > 4 ? 6.25 : span > 1.5 ? 7.25 : 8.5), 300)
  }, [jurisdiction, districtFeatures, cityCoordsData])
  // State executive summary (state admins): readings from the live cache only.
  const stateSummary = useMemo(() => {
    if (jurisdiction?.type !== 'state') return null
    const cs = Object.values(liveCityCache || {}).filter(c => c.state === jurisdiction.state)
    const t = cs.map(c => c.temp).filter(v => typeof v === 'number'), mx = cs.map(c => c.tempMax).filter(v => typeof v === 'number')
    return { n: cs.length, avg: t.length ? Math.round((t.reduce((a, b) => a + b, 0) / t.length) * 10) / 10 : null, hot40: mx.filter(v => v >= 40).length, hot37: mx.filter(v => v >= 37).length, cold10: t.filter(v => v < 10).length, peak: mx.length ? Math.max(...mx) : null }
  }, [jurisdiction, liveCityCache])
  // Power Grid mode: OpenStreetMap grid around the selected city on the command map.
  const [grid, setGrid] = useState(null)
  useEffect(() => {
    setGrid(null)
    if (opsMode !== 'power' || !selectedCity) return
    const c = cityCoordsData?.[`${selectedCity}|${selectedState}`]
    if (typeof c?.lat !== 'number') return
    let live = true
    fetchGrid({ city: selectedCity, state: selectedState, lat: c.lat, lon: c.lon }).then(g => { if (live) setGrid(g) }).catch(() => { if (live) setGrid({ error: true }) })
    return () => { live = false }
  }, [opsMode, selectedCity, selectedState, cityCoordsData])
  const gridLayer = useMemo(() => (opsMode === 'power' && grid && !grid.error ? gridOverlay(grid) : null), [opsMode, grid])
  const lvl = selectedCity ? LEVELS[act.level] : { label: 'NATIONAL OVERVIEW', color: '#38bdf8' }

  // Tooltip for a state polygon on the Leaflet map — same facts as the classic tooltip.
  const tooltipFor = (name) => {
    const d = (stateData || liveIndiaData)?.[name]
    if (!name) return ''
    if (!d) return `<b>${name}</b><br><span class="t-muted">no data</span>`
    const rb = d.riskBucket
    const head = d.scrub
      ? `${d.scrub.unit === '%' ? 'Built-up' : 'Surface / air'}: <b>${d.heatIndex == null ? '—' : `${d.heatIndex}${d.scrub.unit || '°C'}`}</b><br><span class="t-muted">${d.scrub.label} — ${d.scrub.detail}</span>`
      : `Heat index: <b>${d.heatIndex ?? '—'}°C</b><br><span class="t-muted">${d.heatIndexLive ? `live median of ${d.liveCityCount} cities` : 'estimated — no live city data yet'}</span>`
    const why = rb ? (d.scrub ? (rb.count ? `${rb.count} of ${d.liveCityCount} cities are ${rb.label}` : 'grey = no reading in this layer') : rb.relative ? `rank today: hotter than ${rb.percentile}% of states` : `${rb.count} of ${d.liveCityCount} cities are ${rb.label}`) : ''
    return `<b>${name}</b><br>${head}<br><span class="t-badge" style="background:${rb?.color || '#334155'}">${rb?.label || '—'}</span> <span class="t-muted">${why}</span><br><span class="t-muted">click to select · ◎ flies to the city</span>`
  }
  const stress = useMemo(() => assessHeatStress(liveWeather), [liveWeather])
  const temp = typeof liveWeather?.current?.temp === 'number' ? liveWeather.current.temp : null
  const stateMedian = liveIndiaData?.[selectedState]?.heatIndexLive ? liveIndiaData[selectedState].heatIndex : null
  const gridBase = temp ?? stateMedian ?? null
  const risk = liveIndiaData?.[selectedState]?.riskBucket?.label || null
  // National standby figures for the docks when no city is selected.
  const national = useMemo(() => {
    const all = Object.values(liveCityCache || {}).filter(c => typeof c?.temp === 'number')
    if (!all.length) return null
    const hottest = [...all].sort((a, b) => b.temp - a.temp)[0]
    const over40 = all.filter(c => typeof c.tempMax === 'number' && c.tempMax >= 40).length
    const mean = all.reduce((s, c) => s + c.temp, 0) / all.length
    return { hottest, over40, mean: Math.round(mean * 10) / 10, count: all.length }
  }, [liveCityCache])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q.length < 2) return []
    // prefix matches first (Jaipur before Hojai for "jai"), then word-start, then anywhere
    const rank = c => { const n = c.city.toLowerCase(); return n.startsWith(q) ? 0 : n.split(/[\s-]/).some(w => w.startsWith(q)) ? 1 : n.includes(q) ? 2 : c.state.toLowerCase().includes(q) ? 3 : 9 }
    return allCities.map(c => ({ c, r: rank(c) })).filter(x => x.r < 9).sort((a, b) => a.r - b.r || a.c.city.localeCompare(b.c.city)).slice(0, 8).map(x => x.c)
  }, [query, allCities])

  const pickCity = (r) => {
    onSelectCity(r.city, r.state); setQuery('')
    const c = cityCoordsData?.[`${r.city}|${r.state}`]
    if (c && typeof c.lat === 'number') setTimeout(() => mapCtl.current?.flyTo(c.lat, c.lon, 9), 50)
  }

  const forecastDay = liveWeather?.forecast?.[day] || null
  const histEntry = yearly?.cities?.[`${selectedCity}|${selectedState}`]?.find(e => e.year === year) || null
  const latestEntry = modisIndex?.cities?.[`${selectedCity}|${selectedState}`]?.latestDay || null

  return (
    <div data-screen="hud" className="fixed inset-0 h-screen w-screen overflow-hidden bg-[#050b18] text-slate-100">
      {/* MAP — full viewport, owned by App (zoom / pan / click state lives there) */}
      <div className="absolute inset-0 z-0 hud-map">
        <HudLeafletMap
          stateData={stateData || liveIndiaData}
          resolveStateName={resolveStateName}
          points={overlay?.points || []}
          showDots={showDots && !lite}
          showFills={showFills}
          focus={focus}
          basemap={basemap}
          basemapDate={basemap === 'gibs' ? gibsSafeDate(mode === 'live' && layer === 'modis' && dateIdx >= 0 ? stateDates[dateIdx] : null) : null}
          selectedState={selectedState}
          onStateClick={onStateClick}
          onZoomChange={setZoom}
          tooltipText={tooltipFor}
          controlRef={mapCtl}
          districtHeat={districtHeat}
          onDistrictClick={(c, st) => onSelectCity(c, st)}
          onGeoLoaded={setDistrictFeatures}
          raster={surface === 'raster' && showFills && !lite}
          rasterPoints={overlay?.points || null}
          rgbOf={rgbOf}
          fillStrength={gridLayer ? 0.45 : 0.88}
          overlay={gridLayer}
        />
        <WindParticleCanvas mapCtl={mapCtl} stations={stations} enabled={wind && stations.length > 0} mode={windMode} speed={windSpeedX} lite={lite} onProbe={setProbe} />
      </div>
      {wind && probe && (() => { const d = describeProbe(probe); return (
        <div data-testid="wind-probe" className="pointer-events-none fixed z-20 rounded-lg border border-sky-500/40 bg-slate-950/90 px-3 py-2 text-[11px] text-slate-100 shadow-xl backdrop-blur-md" style={{ left: Math.min(probe.clientX + 16, window.innerWidth - 270), top: Math.min(probe.clientY + 16, window.innerHeight - 90) }}>
          <div><span className="text-slate-400">Wind vector:</span> <b>{Math.round(probe.speed)} km/h {compassOf(probe.dir)} ({Math.round(probe.dir)}°)</b>{probe.temp != null && <> · <span style={{ color: thermalColor(probe.temp) }}>{probe.temp.toFixed(1)}°C</span></>}</div>
          <div><span className="text-slate-400">Advective heat load:</span> {d.heatLoad}</div>
          <div><span className="text-slate-400">Ventilation index:</span> {d.ventilation}</div>
          <div className="text-[9px] text-slate-500">interpolated from the nearest city readings · heuristic labels</div>
        </div>) })()}

      {/* ZOOM CONTROLS — top of the map, just left of the right dock (the left dock runs full height) */}
      <div className="absolute top-20 right-[26rem] z-10 flex flex-col gap-1" data-testid="hud-zoom">
        <button type="button" aria-label="Zoom in" title="Zoom in (or scroll)" onClick={() => mapCtl.current?.zoomIn()} disabled={zoom >= 19} className="h-9 w-9 rounded-md border border-slate-600 bg-slate-950/85 text-lg font-bold text-slate-100 backdrop-blur-md hover:border-amber-400 hover:text-amber-300 disabled:opacity-40">+</button>
        <button type="button" aria-label="Zoom out" title="Zoom out" onClick={() => mapCtl.current?.zoomOut()} disabled={zoom <= 4} className="h-9 w-9 rounded-md border border-slate-600 bg-slate-950/85 text-lg font-bold text-slate-100 backdrop-blur-md hover:border-amber-400 hover:text-amber-300 disabled:opacity-40">−</button>
        <button type="button" aria-label="Reset zoom" title="Fit India to the screen" onClick={() => mapCtl.current?.reset()} className="h-9 w-9 rounded-md border border-slate-600 bg-slate-950/85 text-sm font-bold text-slate-100 backdrop-blur-md hover:border-amber-400 hover:text-amber-300">↺</button>
        <button type="button" aria-label="Fly to city" title="Fly to the selected city (street level)" onClick={() => focus && mapCtl.current?.flyTo(focus.lat, focus.lon, 13)} disabled={!focus} className="h-9 w-9 rounded-md border border-slate-600 bg-slate-950/85 text-sm font-bold text-slate-100 backdrop-blur-md hover:border-amber-400 hover:text-amber-300 disabled:opacity-40">◎</button>
        <div className="text-center text-[9px] text-slate-400">z{zoom.toFixed(1)}</div>
      </div>

      {/* TOP BAR */}
      <header className="absolute inset-x-0 top-0 z-20 flex h-14 items-center gap-3 border-b border-sky-500/20 bg-slate-950/80 px-4 backdrop-blur-md">
        <div className="leading-tight">
          <div className="text-sm font-extrabold tracking-wider text-amber-400">BHASKAR OPS</div>
          <div className="text-[9px] uppercase tracking-[0.2em] text-slate-400">Geospatial Command Center · Team {teamId}</div>
        </div>
        <div className="mx-2 h-6 w-px bg-slate-700" />
        <div className="text-xs text-slate-300">
          <span className="font-bold text-slate-100">{selectedCity || 'All-India National Overview'}</span>{selectedState ? `, ${selectedState}` : ''}
          {risk && <span className="ml-2 rounded px-1.5 py-0.5 text-[10px] font-bold" style={{ background: liveIndiaData[selectedState].riskBucket.color, color: '#0f172a' }}>{risk}</span>}
        </div>
        <div className="ml-auto flex items-center gap-2 whitespace-nowrap text-[11px]">
          <span data-testid="hud-status" title="Age of the bulk weather cache the map is drawn from" className={`rounded px-2 py-0.5 font-bold ${cacheStatus === 'error' ? 'bg-red-900/60 text-red-200' : cacheStatus === 'loading' ? 'bg-slate-800 text-slate-300' : cacheStale ? 'bg-amber-900/50 text-amber-300' : 'bg-emerald-900/50 text-emerald-300'}`}>
            {cacheStatus === 'error' ? 'OFFLINE · cached' : cacheStatus === 'loading' ? 'LOADING' : cacheStale ? `CACHED · ${cacheAgeLabel || ''}` : `LIVE · ${cacheAgeLabel || ''}`}
          </span>
          <span className="font-mono text-slate-300">{clock} IST</span>
          <ModeToggle />
          <CapAlertButton city={selectedCity} state={selectedState} level={act.level} tempNow={temp} tempMax={liveWeather?.today?.maxTemp ?? null} reasons={act.reasons} className={`${BTN} border-red-700 text-red-200`} />
          <button type="button" className={BTN} onClick={onOpenClassic}>Classic map</button>
          <button type="button" className={BTN} onClick={onOpenDashboard} disabled={!selectedCity}>Full dashboard →</button>
          <button type="button" className={`${BTN} border-red-800 text-red-300`} onClick={onLogout}>Logout</button>
        </div>
      </header>

      {jurisdiction && <div data-testid="hud-jurisdiction" className={`absolute left-6 top-[3.75rem] z-20 whitespace-nowrap rounded border bg-slate-950/85 px-2 py-0.5 text-[9.5px] font-extrabold tracking-wide ${jurisdiction.type === 'central' ? 'border-sky-500/50 text-sky-300' : 'border-amber-500/50 text-amber-300'}`}>{jurisdictionLabel(jurisdiction)}</div>}
      {/* FLOATING CITY SEARCH — translucent, centred under the top bar so the map stays visible */}
      <div data-testid="hud-search" className="absolute left-1/2 top-[4.25rem] z-20 w-[26rem] max-w-[calc(100vw-3rem)] -translate-x-1/2">
        <div className={`flex items-center gap-2 rounded-full border px-4 py-2 shadow-xl backdrop-blur-md transition-colors ${query ? 'border-amber-400/60 bg-slate-950/80' : 'border-sky-500/30 bg-slate-950/45 hover:bg-slate-950/65'}`}>
          <span className="text-slate-400">🔍</span>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && results[0]) pickCity(results[0]); if (e.key === 'Escape') setQuery('') }}
            placeholder={selectedCity ? `${selectedCity}, ${selectedState} — search another city…` : 'Search any of 1,932 cities, or click a state…'}
            data-testid="hud-city-search"
            className="w-full bg-transparent text-sm text-slate-100 placeholder:text-slate-400 focus:outline-none"
          />
          {query && <button type="button" aria-label="Clear search" onClick={() => setQuery('')} className="text-slate-400 hover:text-slate-100">✕</button>}
        </div>
        {results.length > 0 && (
          <ul className="mt-1 max-h-72 overflow-y-auto rounded-xl border border-slate-700 bg-slate-950/90 shadow-2xl backdrop-blur-md">
            {results.map((r, i) => {
              const live = liveCityCache?.[`${r.city}|${r.state}`]
              return (
                <li key={`${r.city}|${r.state}`}>
                  <button type="button" className={`flex w-full items-center justify-between px-4 py-2 text-left text-sm hover:bg-slate-800 ${i === 0 ? 'bg-slate-900/60' : ''}`} onClick={() => pickCity(r)}>
                    <span><span className="font-semibold text-slate-100">{r.city}</span> <span className="text-slate-500">· {r.state}</span></span>
                    <span className="font-mono text-xs" style={{ color: typeof live?.temp === 'number' ? colorFn(live.temp) : '#64748b' }}>{typeof live?.temp === 'number' ? `${live.temp}°C` : 'no live data'}</span>
                  </button>
                </li>
              )
            })}
            <li className="px-4 py-1 text-[10px] text-slate-500">Enter picks the first result · Esc clears</li>
          </ul>
        )}
      </div>

      {/* LEFT DOCK */}
      <aside data-testid="hud-left" className={`${DOCK} left-6 ${jurisdiction ? 'top-[5.4rem]' : 'top-20'} w-80 max-h-[calc(100vh-10.5rem)] overflow-y-auto border-sky-500/30`}>
        {stateSummary && (
          <div data-testid="hud-state-summary" className="mb-3 rounded-lg border border-amber-500/40 bg-slate-900/70 p-3 text-[11px] text-slate-200">
            <div className="mb-1 text-[10px] font-extrabold uppercase tracking-[0.16em] text-amber-300">State executive summary · {jurisdiction.state}</div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1">
              <span className="text-slate-400">Average air temp</span><b className="text-right">{stateSummary.avg ?? '—'}°C <span className="text-[9px] text-emerald-400">LIVE</span></b>
              <span className="text-slate-400">Cities ≥ 40 °C today</span><b className="text-right">{stateSummary.hot40} of {stateSummary.n} <span className="text-[9px] text-sky-400">FCST</span></b>
              <span className="text-slate-400">Cities ≥ 37 °C today</span><b className="text-right">{stateSummary.hot37}</b>
              <span className="text-slate-400">Hottest forecast</span><b className="text-right">{stateSummary.peak ?? '—'}°C</b>
              {stateSummary.cold10 > 0 && <><span className="text-slate-400">Cities below 10 °C</span><b className="text-right text-sky-300">{stateSummary.cold10}</b></>}
              <span className="text-slate-400">Grid demand (MW)</span><b className="text-right text-slate-500">UNAVAILABLE</b>
              <span className="text-slate-400">SDRF budget</span><b className="text-right text-slate-500">UNAVAILABLE</b>
            </div>
            <div className="mt-1 text-[9.5px] leading-snug text-slate-500">Live state demand: vidyutpravah.in (Ministry of Power). SDRF allocation: MHA / state finance department — not connected.</div>
          </div>
        )}
        {opsMode === 'power' && (
          <div data-testid="hud-power-note" className="mb-3 rounded-lg border border-sky-500/40 bg-slate-900/70 p-2 text-[10.5px] text-slate-300">
            ⚡ <b>Power Grid mode.</b> {!selectedCity ? 'Pick a city to draw its substations and lines.' : grid == null ? 'Loading OpenStreetMap grid…' : grid.error ? 'Grid geometry UNAVAILABLE (OpenStreetMap service not answering).' : `${grid.substations.length} substations · ${grid.lines.length} line segments around ${selectedCity} (OpenStreetMap; loading not available).`} Open the dashboard for the Heat + Power workspace.
          </div>
        )}
        <div className={H3}>Satellite layers</div>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {Object.entries(HUD_LAYERS).map(([k, v]) => (
            <button key={k} type="button" data-testid={`layer-${k}`} className={layer === k ? BTN_ON : BTN} onClick={() => setLayer(k)} title={v.source}>{v.label}</button>
          ))}
        </div>
        <div className="mb-2 flex flex-wrap items-center gap-1.5 text-[10px] text-slate-400">
          <span className="mr-1 uppercase tracking-wider">Base map</span>
          {Object.entries(BASEMAPS).map(([k, v]) => (
            <button key={k} type="button" data-testid={`basemap-${k}`} className={basemap === k ? BTN_ON : BTN} onClick={() => setBasemap(k)} title={v.attribution || 'Plain dark surface'}>{v.label}</button>
          ))}
        </div>
        <div className="mb-2 flex flex-wrap items-center gap-1.5 text-[10px] text-slate-400">
          <span className="mr-1 uppercase tracking-wider">Colours</span>
          <button type="button" data-testid="palette-spectral" className={palette === 'spectral' ? BTN_ON : BTN} onClick={() => setPalette('spectral')} title="Continuous violet → red thermal spectrum">🌈 Spectral thermal</button>
          <button type="button" data-testid="palette-ndma" className={palette === 'ndma' ? BTN_ON : BTN} onClick={() => setPalette('ndma')} title="Six NDMA / IMD risk tiers">🏛️ NDMA risk tiers</button>
        </div>
        <div className="mb-2 flex flex-wrap items-center gap-1.5 text-[10px] text-slate-400">
          <span className="mr-1 uppercase tracking-wider">Surface</span>
          <button type="button" data-testid="surface-raster" className={surface === 'raster' ? BTN_ON : BTN} onClick={() => setSurface('raster')} title="Smooth interpolated field from the city readings, clipped to India" disabled={lite}>🌈 Continuous spectrum</button>
          <button type="button" data-testid="surface-choropleth" className={surface === 'choropleth' ? BTN_ON : BTN} onClick={() => setSurface('choropleth')} title="State / district polygons">🏛️ District choropleth</button>
        </div>
        <div className="mb-2 rounded-md border border-sky-500/20 bg-slate-900/50 p-2">
          <label className="flex cursor-pointer items-center gap-2 text-[11px] text-slate-200">
            <input type="checkbox" data-testid="toggle-wind" checked={wind} onChange={e => setWind(e.target.checked)} className="accent-amber-400" />
            🌬️ Live wind &amp; heat advection flow
          </label>
          {wind && (
            <>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                {[['thermal', 'Thermal wind'], ['stagnation', 'Stagnation zones']].map(([k, v]) => <button key={k} type="button" data-testid={`wind-${k}`} className={windMode === k ? BTN_ON : BTN} onClick={() => setWindMode(k)}>{v}</button>)}
                <span className="ml-auto flex gap-1">{[1, 2].map(x => <button key={x} type="button" data-testid={`wind-speed-${x}`} className={windSpeedX === x ? BTN_ON : BTN} onClick={() => setWindSpeedX(x)}>{x}×</button>)}</span>
              </div>
              <div className="mt-1.5 text-[10px] leading-snug text-slate-400">
                {stations.length === 0
                  ? 'No wind readings in the cache yet — they arrive with the next weather refresh.'
                  : windMode === 'thermal'
                    ? <>Particles follow Open-Meteo 10 m wind from {stations.length} cities, coloured by the air they carry: <span style={{ color: '#38bdf8' }}>■</span> &lt;30 <span style={{ color: '#fbbf24' }}>■</span> 30–38 <span style={{ color: '#f97316' }}>■</span> 38–44 <span style={{ color: '#ef4444' }}>■</span> ≥44 °C. Hover the map for a wind probe.</>
                    : <>Magenta = wind under 6 km/h where air is above 40 °C or PM10 above 150 µg/m³ — heat and dust the wind is not clearing. {stations.length} cities.</>}
              </div>
            </>
          )}
        </div>
        {basemap === 'gibs' && <div className="mb-2 text-[10px] text-slate-400">Showing NASA's true-colour image of {gibsSafeDate(mode === 'live' && layer === 'modis' && dateIdx >= 0 ? stateDates[dateIdx] : null)} — in Live Pass, the picture follows the date you scrub.</div>}
        <label className="mb-1 flex cursor-pointer items-center gap-2 text-[11px] text-slate-300">
          <input type="checkbox" data-testid="toggle-fills" checked={showFills} onChange={e => setShowFills(e.target.checked)} className="accent-amber-400" />
          Heat colours on the map {showFills ? '' : '(OFF — borders only; tick to see the data)'}
        </label>
        <label className="mb-2 flex cursor-pointer items-center gap-2 text-[11px] text-slate-300">
          <input type="checkbox" data-testid="toggle-dots" checked={showDots} onChange={e => setShowDots(e.target.checked)} className="accent-amber-400" />
          Show city dots ({overlay?.count ?? 0})
        </label>
        <div className="mb-3 text-[10px] leading-snug text-slate-400" data-testid="hud-caption">{lite ? 'Point overlays are off in Lite mode.' : overlay?.caption}{HUD_LAYERS[layer] ? ` · ${HUD_LAYERS[layer].source}` : ''}{scrubbed && !lite ? ' · state colours follow this layer (grey = no reading)' : ' · state colours = live map'}</div>

        <div className={H3}>{selectedCity ? 'Alert triage' : 'National summary'}</div>
        {!selectedCity && (
          <div data-testid="hud-national" className="mb-3 rounded-lg border border-slate-600 bg-slate-900/60 p-3 text-[11px] text-slate-200">
            {national ? (
              <>
                <div className="text-sm font-extrabold text-amber-300">Hottest now: {national.hottest.city}, {national.hottest.state} · {national.hottest.temp}°C</div>
                <div className="mt-1">{national.over40} of {national.count} cities forecast ≥ 40 °C today · national mean {national.mean}°C</div>
                <div className="mt-1 text-[10px] text-slate-400">Live Open-Meteo cache. Click a state or search a city for its triage and Heat Action Protocol.</div>
              </>
            ) : <div className="text-slate-400">Loading the national weather cache…</div>}
          </div>
        )}
        {selectedCity && (
        <div data-testid="hud-alert" className="mb-3 rounded-lg border p-3" style={{ borderColor: lvl.color, background: `${lvl.color}22` }}>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-2xl font-extrabold" style={{ color: lvl.color }}>{temp != null ? `${temp.toFixed(1)}°C` : stateMedian != null ? `${stateMedian}°C` : '—'}</span>
            <span className="rounded px-1.5 py-0.5 text-[10px] font-extrabold text-slate-950" style={{ background: lvl.color }}>{lvl.label.split(' — ')[0]}</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-200">
            {temp != null ? (liveWeather?.demoOverride != null ? 'Demo override · ' : 'Live · ') : stateMedian != null ? 'No live reading — state median · ' : 'No reading yet · '}
            {stress?.now ? `feels like ${stress.now.heatIndex}°C · ${stress.now.heatIndexBand.label}` : 'heat stress needs humidity'}
          </div>
          <div className="mt-1 text-[10px] text-slate-400">{act.reasons.join(' · ')}</div>
        </div>
        )}

        <div className={H3}>10 × 10 thermal stress grid</div>
        {!selectedCity ? <div className="text-[11px] text-slate-400">Pick a city to see its grid.</div> : gridBase != null ? (
          <>
            <MiniGrid base={gridBase} size={22} numbers testId="hud-grid" />
            <button type="button" className="mt-1 text-[10px] text-slate-400 underline decoration-dotted" onClick={() => setShowGridNote(v => !v)}>{showGridNote ? 'hide note' : 'what is this?'}</button>
            {showGridNote && <div className="mt-1 text-[10px] leading-snug text-slate-400">Cells start from the city's {temp != null ? 'live' : 'state-median'} temperature {gridBase.toFixed(1)}°C. The ±2 °C cell-to-cell pattern is an illustrative intra-city pattern, not measured — the project holds no ward-level sensors. Use the Interventions tab to see cooling measures applied to it.</div>}
          </>
        ) : <div className="text-[11px] text-slate-400">No reading for this city yet.</div>}
      </aside>

      {/* RIGHT DOCK — AI command */}
      <aside data-testid="hud-right" className={`${DOCK} right-6 top-20 w-96 max-h-[calc(100vh-10.5rem)] overflow-y-auto border-emerald-500/30 hud-dock`}>
        <div className="mb-2 flex items-center justify-between">
          <div className={H3 + ' mb-0'}>AI directive</div>
          <span className="font-mono text-[10px] text-emerald-300">#HAP-{teamId}</span>
        </div>
        {selectedCity ? (
          <AppErrorBoundary compact title="Co-Pilot could not be displayed">
            <HeatCoPilot city={selectedCity} state={selectedState} liveWeather={liveWeather} lulcReal={lulcReal} cityCoordsData={cityCoordsData} isCoastal={isCoastal} compact />
          </AppErrorBoundary>
        ) : (
          <div data-testid="hud-standby" className="rounded-lg border border-dashed border-slate-600 p-4 text-center text-xs text-slate-300">
            <div className="text-2xl">🛰️</div>
            <div className="mt-1 font-semibold">National standby</div>
            <div className="mt-1 text-slate-400">Select a state or city on the map to generate a localised Heat Action Protocol.</div>
            {national && <div className="mt-2 text-[10px] text-slate-500">Hottest city right now: {national.hottest.city} ({national.hottest.temp}°C)</div>}
          </div>
        )}
        {selectedCity && (
          <div className="mt-3">
            <HeatActionChecklist city={selectedCity} state={selectedState} risk={act.level === 'critical' || act.level === 'alert' ? 'Extreme' : act.level === 'watch' ? 'Medium' : 'Low'} temp={temp} onOpenInterventions={onOpenDashboard} />
          </div>
        )}
      </aside>

      {/* BOTTOM — timeline scrubber */}
      <div data-testid="hud-timeline" className={`${DOCK} bottom-6 left-1/2 w-[700px] max-w-[calc(100vw-3rem)] -translate-x-1/2 border-sky-500/30 p-3`}>
        <div className="mb-2 flex items-center gap-2">
          {[['historical', 'Historical'], ['live', 'Live Pass'], ['forecast', 'Forecast']].map(([k, v]) => (
            <button key={k} type="button" data-testid={`mode-${k}`} className={mode === k ? BTN_ON : BTN} onClick={() => { setMode(k); if (k === 'historical') setLayer('modis'); if (k === 'forecast') setLayer('air') }}>{v}</button>
          ))}
          <span className="ml-auto flex items-center gap-2 text-[10px] text-slate-400">
            <span>{mode === 'historical' ? 'NASA MODIS Apr–Jun peak season, 2016–2026' : mode === 'live' ? (layer === 'modis' ? 'NASA MODIS daily clear-sky passes' : 'Open-Meteo current readings') : 'Open-Meteo 7-day forecast'}</span>
            {layer === 'lulc' && (
              <span className="flex items-center gap-1" title="Built-up share within ~5 km of the city centre (ESA WorldCover 2021)" data-testid="hud-legend-lulc">
                {BUILT_UP_LEGEND.map(([c, l]) => <span key={l} className="flex items-center gap-0.5"><span className="h-2.5 w-4 rounded-sm" style={{ background: c }} /><span className="text-[8px]">{l}</span></span>)}
                <span className="ml-1">% built-up</span>
              </span>
            )}
            {layer !== 'lulc' && palette === 'spectral' && (
              <span className="flex flex-col items-stretch" title="Continuous spectral thermal scale (°C)" data-testid="hud-legend-spectral">
                <span className="h-2.5 w-44 rounded-sm" style={{ background: spectralGradientCss() }} />
                <span className="flex justify-between text-[8px] leading-none text-slate-500">{SPECTRAL_LEGEND.map(([t, l]) => <span key={t}>{l}</span>)}</span>
              </span>
            )}
            {layer !== 'lulc' && palette === 'ndma' && buckets.length > 0 && (
              <span className="flex items-center gap-1" title="NDMA / IMD risk tiers (°C)" data-testid="hud-legend">
                {[...buckets].reverse().map(b => <span key={b.label} className="h-2.5 w-4 rounded-sm" style={{ background: b.color }} title={b.legend} />)}
                <span className="ml-1">&lt;25 → 45+ °C</span>
              </span>
            )}
          </span>
        </div>

        {mode === 'historical' && (
          <>
            <input type="range" min={MODIS_YEAR_MIN} max={MODIS_YEAR_MAX} value={year} onChange={e => setYear(Number(e.target.value))} className="w-full accent-amber-400" data-testid="scrub-year" />
            <div className="mt-1 flex justify-between text-[10px] text-slate-400"><span>{MODIS_YEAR_MIN}</span><span className="text-sm font-extrabold text-amber-300">{year}</span><span>{MODIS_YEAR_MAX}</span></div>
            <div className="mt-1 text-[11px] text-slate-200" data-testid="scrub-readout">
              {histEntry ? `${selectedCity}: ${year} peak-season mean surface ${histEntry.peakDayMean}°C · hottest day ${histEntry.hottestC}°C (${histEntry.hottestDate}) · ${histEntry.peakDays} clear days` : yearly ? `${selectedCity || 'This city'} has no MODIS record for ${year} (${Object.keys(yearly.cities).length} cities have a multi-year record) — the map shows those.` : 'Loading NASA MODIS yearly peaks…'}
            </div>
          </>
        )}

        {mode === 'live' && (
          <>
            {layer === 'modis' && stateDates.length > 0 ? (
              <>
                <input type="range" min={-1} max={stateDates.length - 1} value={dateIdx} onChange={e => setDateIdx(Number(e.target.value))} className="w-full accent-amber-400" data-testid="scrub-date" />
                <div className="mt-1 flex justify-between text-[10px] text-slate-400"><span>{stateDates[0]}</span><span className="text-sm font-extrabold text-amber-300">{dateIdx < 0 ? 'Latest pass per city (all India)' : `All India · ${stateDates[dateIdx]}`}</span><span>{stateDates[stateDates.length - 1]}</span></div>
                <label className="mt-1 flex cursor-pointer items-center gap-2 text-[10px] text-slate-300">
                  <input type="checkbox" data-testid="toggle-composite" checked={composite} onChange={e => setComposite(e.target.checked)} className="accent-amber-400" />
                  Fill cloudy days from each city's last clear-sky pass (≤ {LOOKBACK_DAYS} days) — off shows the exact day only
                </label>
              </>
            ) : (
              <div className="h-5 text-[10px] text-slate-500">{layer === 'modis' ? (daily ? 'No daily passes available.' : 'Loading daily satellite passes for all of India…') : 'Switch the layer to Surface temperature to scrub daily satellite passes.'}</div>
            )}
            <div className="mt-1 text-[11px] text-slate-200" data-testid="scrub-readout">
              {layer === 'modis'
                ? (dateIdx >= 0 && daily
                    ? (() => { const v = daily.cities?.[`${selectedCity}|${selectedState}`]?.[dateIdx]; return v != null ? `${selectedCity}: surface ${v}°C on ${stateDates[dateIdx]}` : `${selectedCity}: no clear-sky pass on ${stateDates[dateIdx]} (cloud) — nothing estimated` })()
                    : latestEntry ? `${selectedCity}: latest clear-sky surface ${latestEntry.c}°C on ${latestEntry.date}` : 'No quality-passed MODIS reading for this city in the current period.')
                : (!selectedCity ? (national ? `All India: ${national.count} cities live · mean ${national.mean}°C · hottest ${national.hottest.city} ${national.hottest.temp}°C` : 'All India — loading the live cache…') : temp != null ? `${selectedCity}: ${temp}°C now${liveWeather?.current?.humidity != null ? ` · ${liveWeather.current.humidity}% humidity` : ''}${liveWeather?.aqi?.usAQI != null ? ` · AQI ${liveWeather.aqi.usAQI}` : ''}` : 'Waiting for the live reading…')}
            </div>
          </>
        )}

        {mode === 'forecast' && (
          <>
            <input type="range" min={0} max={6} value={day} onChange={e => setDay(Number(e.target.value))} className="w-full accent-amber-400" data-testid="scrub-day" />
            <div className="mt-1 flex justify-between text-[10px] text-slate-400"><span>Today</span><span className="text-sm font-extrabold text-amber-300">{forecastDay ? forecastDay.date : `Day +${day}`}</span><span>+6 days</span></div>
            <div className="mt-1 text-[11px] text-slate-200" data-testid="scrub-readout">
              {forecastDay ? `${selectedCity}: high ${forecastDay.maxTemp}°C · low ${forecastDay.minTemp}°C · ${forecastDay.condition?.label || forecastDay.condition || ''} · rain ${forecastDay.rainChance ?? '—'}%` : 'No forecast for this city yet.'}
              <span className="text-slate-500"> · map shows today's forecast highs nationally</span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
