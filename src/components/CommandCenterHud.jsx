import React, { useEffect, useMemo, useRef, useState } from 'react'
import { MiniGrid } from './MiniGridPair'
import HeatCoPilot, { buildCopilotInput } from './HeatCoPilot'
import HeatActionChecklist from './HeatActionChecklist'
import AppErrorBoundary from './AppErrorBoundary'
import AudienceToggle from './AudienceToggle'
import { activationLevel, LEVELS } from '../utils/heatActionProtocol'
import { assessHeatStress } from '../utils/heatStress'
import { loadModisIndex } from '../utils/modisLst'
import { fetchJson } from '../utils/fetchJson'
import { BASEMAPS, gibsSafeDate } from './SatelliteBasemap'
import HudLeafletMap from './HudLeafletMap'
import { HUD_LAYERS, MODIS_YEAR_MIN, MODIS_YEAR_MAX, airOverlay, modisLatestOverlay, modisYearOverlay, modisNationalDayOverlay, lulcOverlay, stateDataFromPoints } from '../utils/hudOverlay'

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
const DEFAULT_CITY = { city: 'Sri Ganganagar', state: 'Rajasthan' }

function istNow() {
  return new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false })
}

export default function CommandCenterHud({
  liveIndiaData, resolveStateName, onStateClick, liveCityCache, cityCoordsData, lulcReal, liveWeather,
  selectedState, selectedCity, onSelectCity, allCities = [], colorFor, buckets = [], isCoastal = false,
  cacheStatus, cacheStale = false, cacheAgeLabel, audience, onAudienceChange, onOpenClassic, onOpenDashboard, onLogout, userName,
  teamId = 'B26-0322', lite = false
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
  const [showFills, setShowFills] = useState(true) // heat colours on the map; off = borders only // Live Pass: fill cloudy days from each city's last pass within 14 days
  const LOOKBACK_DAYS = 14 // state fills carry the data; dots are optional detail
  const pickedDefault = useRef(false)

  useEffect(() => { const id = setInterval(() => setClock(istNow()), 30000); return () => clearInterval(id) }, [])

  // Default city so the docks are never empty on first open.
  useEffect(() => {
    if (!selectedCity && !pickedDefault.current) { pickedDefault.current = true; onSelectCity(DEFAULT_CITY.city, DEFAULT_CITY.state) }
  }, [selectedCity, onSelectCity])

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
      if (mode === 'historical') return yearly ? modisYearOverlay({ yearly, coords: cityCoordsData, colorFor, year }) : { points: [], count: 0, caption: 'Loading MODIS yearly peaks…' }
      if (mode === 'live' && daily && dateIdx >= 0 && stateDates[dateIdx]) return modisNationalDayOverlay({ daily, coords: cityCoordsData, colorFor, dateIdx, lookbackDays: composite ? LOOKBACK_DAYS : 0 })
      return modisLatestOverlay({ modisIndex, coords: cityCoordsData, colorFor })
    }
    return airOverlay({ liveCityCache, coords: cityCoordsData, colorFor, field: mode === 'forecast' ? 'tempMax' : 'temp' })
  }, [lite, layer, mode, year, dateIdx, stateDates, daily, composite, modisIndex, modisErr, yearly, lulcReal, liveCityCache, cityCoordsData, colorFor])

  // State fills follow the scrubber: everything except "live air temperature" (which is the
  // map's own live colouring already) re-colours the states from the points on screen.
  const scrubbed = !(layer === 'air' && mode === 'live')
  const stateData = useMemo(() => {
    if (!scrubbed || !overlay) return null
    const scrubLabel = layer === 'lulc' ? 'ESA WorldCover 2021 built-up share'
      : mode === 'historical' ? `NASA MODIS ${year} Apr–Jun mean surface temperature`
      : mode === 'forecast' ? "Today's forecast high (Open-Meteo)"
      : dateIdx >= 0 && stateDates[dateIdx] ? (composite ? `NASA MODIS ${LOOKBACK_DAYS}-day composite ending ${stateDates[dateIdx]}` : `NASA MODIS day pass, ${stateDates[dateIdx]} (all India)`) : 'NASA MODIS latest clear-sky day pass'
    return stateDataFromPoints({ base: liveIndiaData, points: overlay.points, buckets, kind: layer === 'lulc' ? 'builtUp' : 'heat', scrubLabel })
  }, [scrubbed, overlay, layer, mode, year, dateIdx, stateDates, composite, liveIndiaData, buckets])

  const focus = useMemo(() => {
    const c = cityCoordsData?.[`${selectedCity}|${selectedState}`]
    return c && typeof c.lat === 'number' ? { lon: c.lon, lat: c.lat } : null
  }, [cityCoordsData, selectedCity, selectedState])

  // Alert triage from the same inputs the Co-Pilot uses.
  const copilotInput = useMemo(() => buildCopilotInput({ city: selectedCity, state: selectedState, liveWeather, lulcReal, cityCoordsData, isCoastal }), [selectedCity, selectedState, liveWeather, lulcReal, cityCoordsData, isCoastal])
  const act = useMemo(() => activationLevel(copilotInput), [copilotInput])
  const lvl = LEVELS[act.level]

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

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q.length < 2) return []
    return allCities.filter(c => c.city.toLowerCase().includes(q) || c.state.toLowerCase().includes(q)).slice(0, 8)
  }, [query, allCities])

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
        />
      </div>

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
          <span className="font-bold text-slate-100">{selectedCity || '—'}</span>{selectedState ? `, ${selectedState}` : ''}
          {risk && <span className="ml-2 rounded px-1.5 py-0.5 text-[10px] font-bold" style={{ background: liveIndiaData[selectedState].riskBucket.color, color: '#0f172a' }}>{risk}</span>}
        </div>
        <div className="ml-auto flex items-center gap-2 text-[11px]">
          <span data-testid="hud-status" title="Age of the bulk weather cache the map is drawn from" className={`rounded px-2 py-0.5 font-bold ${cacheStatus === 'error' ? 'bg-red-900/60 text-red-200' : cacheStatus === 'loading' ? 'bg-slate-800 text-slate-300' : cacheStale ? 'bg-amber-900/50 text-amber-300' : 'bg-emerald-900/50 text-emerald-300'}`}>
            {cacheStatus === 'error' ? 'OFFLINE · cached' : cacheStatus === 'loading' ? 'LOADING' : cacheStale ? `CACHED · ${cacheAgeLabel || ''}` : `LIVE · ${cacheAgeLabel || ''}`}
          </span>
          <span className="font-mono text-slate-300">{clock} IST</span>
          <AudienceToggle audience={audience} onChange={onAudienceChange} />
          <button type="button" className={BTN} onClick={onOpenClassic}>Classic map</button>
          <button type="button" className={BTN} onClick={onOpenDashboard} disabled={!selectedCity}>Full dashboard →</button>
          <button type="button" className={`${BTN} border-red-800 text-red-300`} onClick={onLogout}>Logout</button>
        </div>
      </header>

      {/* LEFT DOCK */}
      <aside data-testid="hud-left" className={`${DOCK} left-6 top-20 w-80 max-h-[calc(100vh-10.5rem)] overflow-y-auto border-sky-500/30`}>
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
        {basemap === 'gibs' && <div className="mb-2 text-[10px] text-slate-400">Showing NASA's true-colour image of {gibsSafeDate(mode === 'live' && layer === 'modis' && dateIdx >= 0 ? stateDates[dateIdx] : null)} — in Live Pass, the picture follows the date you scrub.</div>}
        <label className="mb-1 flex cursor-pointer items-center gap-2 text-[11px] text-slate-300">
          <input type="checkbox" data-testid="toggle-fills" checked={showFills} onChange={e => setShowFills(e.target.checked)} className="accent-amber-400" />
          Heat colours on the map {showFills ? '' : '(off — borders only)'}
        </label>
        <label className="mb-2 flex cursor-pointer items-center gap-2 text-[11px] text-slate-300">
          <input type="checkbox" data-testid="toggle-dots" checked={showDots} onChange={e => setShowDots(e.target.checked)} className="accent-amber-400" />
          Show city dots ({overlay?.count ?? 0})
        </label>
        <div className="mb-3 text-[10px] leading-snug text-slate-400" data-testid="hud-caption">{lite ? 'Point overlays are off in Lite mode.' : overlay?.caption}{HUD_LAYERS[layer] ? ` · ${HUD_LAYERS[layer].source}` : ''}{scrubbed && !lite ? ' · state colours follow this layer (grey = no reading)' : ' · state colours = live map'}</div>

        <div className={H3}>City</div>
        <div className="relative mb-3">
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={selectedCity ? `${selectedCity}, ${selectedState}` : 'Search a city…'}
            data-testid="hud-city-search"
            className="w-full rounded-md border border-slate-600 bg-slate-900/80 px-2.5 py-1.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-amber-400 focus:outline-none"
          />
          {results.length > 0 && (
            <ul className="absolute left-0 right-0 top-full z-30 mt-1 max-h-56 overflow-y-auto rounded-md border border-slate-700 bg-slate-950 shadow-xl">
              {results.map(r => (
                <li key={`${r.city}|${r.state}`}>
                  <button type="button" className="flex w-full justify-between px-2.5 py-1.5 text-left text-xs hover:bg-slate-800" onClick={() => { onSelectCity(r.city, r.state); setQuery(''); const c = cityCoordsData?.[`${r.city}|${r.state}`]; if (c && typeof c.lat === 'number') setTimeout(() => mapCtl.current?.flyTo(c.lat, c.lon, 9), 50) }}>
                    <span className="font-semibold">{r.city}</span><span className="text-slate-500">{r.state}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className={H3}>Alert triage</div>
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

        <div className={H3}>10 × 10 thermal stress grid</div>
        {gridBase != null ? (
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
        ) : <div className="text-xs text-slate-400">Pick a city to brief the agent.</div>}
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
            {layer !== 'lulc' && buckets.length > 0 && (
              <span className="flex items-center gap-1" title="State fill and point colours: air / surface temperature buckets (°C)" data-testid="hud-legend">
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
                : (temp != null ? `${selectedCity}: ${temp}°C now${liveWeather?.current?.humidity != null ? ` · ${liveWeather.current.humidity}% humidity` : ''}${liveWeather?.aqi?.usAQI != null ? ` · AQI ${liveWeather.aqi.usAQI}` : ''}` : 'Waiting for the live reading…')}
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
