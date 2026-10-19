import React, { useEffect, useMemo, useState } from 'react'
import { ComposedChart, Area, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, CartesianGrid, BarChart, Bar, Cell } from 'recharts'
import { C, card, num, Prov, Kpi, Section, SubHead, Pills, WorkspaceHeader, DetailsDrawer, wsRoot } from './workspaceKit'
import { fetchEnsemble, fetchEnsembleHourly, fetchMultiCityDaily, ENSEMBLE_MODEL } from '../utils/ensembleForecast'
import { buildOutlook, classifyDay, terrainThreshold, LEVEL_COLOR, IMD_RULE } from '../utils/heatwaveOutlook'
import { spectralColor } from '../utils/hudOverlay'

// WORKSPACE 2 — PREDICTION: Forecast Intelligence.
// Deterministic Open-Meteo forecast (what the rest of the app shows) + the Open-Meteo ENSEMBLE
// (31 GFS members) for probability and uncertainty. Nothing here is an IMD warning; the
// probability is "share of ensemble members meeting the configured IMD-threshold criterion".
const shortDay = iso => { try { return new Date(`${iso}T00:00:00+05:30`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' }) } catch { return iso } }
const shortHour = iso => { const d = new Date(`${iso}:00+05:30`); return `${d.toLocaleDateString('en-IN', { weekday: 'short', timeZone: 'Asia/Kolkata' })} ${String(d.getHours()).padStart(2, '0')}h` }
const pctTxt = p => (p == null ? '—' : `${Math.round(p * 100)}%`)

export default function PredictionWorkspace({ city, state, liveWeather, liveCityCache, cityCoordsData, isCoastal = false, children }) {
  const [horizon, setHorizon] = useState('7d') // 72h | 7d
  const [ens, setEns] = useState({ status: 'loading', data: null, error: null })
  const [hourly, setHourly] = useState({ status: 'idle', data: null, error: null })
  const [timeline, setTimeline] = useState({ status: 'loading', rows: [], error: null })
  const coords = cityCoordsData?.[`${city}|${state}`]
  const elevation = typeof liveWeather?.elevation === 'number' ? liveWeather.elevation : null
  const demo = liveWeather?.demoOverride != null
  const threshold = terrainThreshold({ elevation, isCoastal })
  const outlook = useMemo(() => buildOutlook(liveWeather?.forecast, { elevation, isCoastal }), [liveWeather, elevation, isCoastal])

  // Ensemble daily (always) and hourly (when the 72 h horizon is opened).
  useEffect(() => {
    if (typeof coords?.lat !== 'number') { setEns({ status: 'error', data: null, error: 'No coordinates for this city.' }); return }
    let live = true
    setEns(s => ({ ...s, status: 'loading' }))
    fetchEnsemble({ lat: coords.lat, lon: coords.lon, elevation, isCoastal }).then(d => { if (live) setEns({ status: 'ready', data: d, error: null }) }).catch(e => { if (live) setEns({ status: 'error', data: null, error: e.message }) })
    return () => { live = false }
  }, [coords?.lat, coords?.lon, elevation, isCoastal])
  useEffect(() => {
    if (horizon !== '72h' || typeof coords?.lat !== 'number') return
    let live = true
    setHourly(s => ({ ...s, status: 'loading' }))
    fetchEnsembleHourly({ lat: coords.lat, lon: coords.lon }).then(d => { if (live) setHourly({ status: 'ready', data: d, error: null }) }).catch(e => { if (live) setHourly({ status: 'error', data: null, error: e.message }) })
    return () => { live = false }
  }, [horizon, coords?.lat, coords?.lon])

  // District risk timeline: the state's hottest live cities (each stands in for its district).
  const stateCities = useMemo(() => Object.values(liveCityCache || {}).filter(c => c.state === state && typeof c.temp === 'number').sort((a, b) => (b.tempMax ?? b.temp) - (a.tempMax ?? a.temp)), [liveCityCache, state])
  const timelineLocs = useMemo(() => {
    const pick = [city, ...stateCities.map(c => c.city)].filter((v, i, a) => a.indexOf(v) === i).slice(0, 8)
    return pick.map(n => ({ city: n, ...(cityCoordsData?.[`${n}|${state}`] || {}) })).filter(l => typeof l.lat === 'number')
  }, [city, state, stateCities, cityCoordsData])
  const locKey = timelineLocs.map(l => l.city).join('|')
  useEffect(() => {
    if (!timelineLocs.length) { setTimeline({ status: 'error', rows: [], error: 'No cities with coordinates in this state.' }); return }
    let live = true
    setTimeline(s => ({ ...s, status: 'loading' }))
    fetchMultiCityDaily(timelineLocs).then(rows => { if (live) setTimeline({ status: 'ready', rows, error: null }) }).catch(e => { if (live) setTimeline({ status: 'error', rows: [], error: e.message }) })
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locKey])

  const e = ens.data
  const detDays = outlook?.days || []
  const chart7 = useMemo(() => (e?.days || []).map((d, i) => ({ day: shortDay(d.date), band: d.p10 != null ? [d.p10, d.p90] : null, p50: d.p50, det: typeof detDays[i]?.maxTemp === 'number' ? detDays[i].maxTemp : null, pAbove: d.pAbove == null ? null : Math.round(d.pAbove * 100), n: d.n })), [e, detDays])
  const chart72 = useMemo(() => {
    const hrs = hourly.data?.hours || []
    // The deterministic hourly list holds today's 24 hours from 00:00 IST, the same start as
    // the ensemble's hourly series, so the two align by index.
    const det = liveWeather?.hourly || []
    return hrs.map((h, i) => ({ hour: shortHour(h.time), band: h.p10 != null ? [h.p10, h.p90] : null, p50: h.p50, det: typeof det[i]?.temp === 'number' ? det[i].temp : null }))
  }, [hourly.data, liveWeather])
  const peakEns = e ? e.days.reduce((m, d) => (d.p50 != null && (!m || d.p50 > m.p50) ? d : m), null) : null
  const spread = e ? Math.round((e.days.filter(d => d.p90 != null).reduce((s, d) => s + (d.p90 - d.p10), 0) / Math.max(1, e.days.filter(d => d.p90 != null).length)) * 10) / 10 : null
  const hotDaysEns = e ? e.days.filter(d => d.pAbove != null && d.pAbove >= 0.5).length : null
  const prob = e?.probability
  const probColor = prob == null ? C.muted : prob >= 0.6 ? C.red : prob >= 0.3 ? C.amber : prob > 0 ? '#EAB308' : C.green
  const tip = { background: C.card, border: `1px solid ${C.border}`, fontSize: 11, color: C.text }

  return (
    <div data-testid="prediction-workspace" style={wsRoot}>
      <WorkspaceHeader no="02" title={`Forecast intelligence · ${city}`} sub={`Probability and uncertainty from the Open-Meteo ensemble (${ENSEMBLE_MODEL}, ${e ? `${e.members} members` : 'loading'}), alongside the deterministic forecast the rest of the dashboard uses.`}
        right={<><Pills testId="pred-horizon" value={horizon} onChange={setHorizon} options={[['72h', 'Next 72 hours'], ['7d', 'Next 7 days']]} />{demo && <Prov k="demo" title="The demo override changes the current reading only; the ensemble below is real model output" />}</>} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10 }}>
        <Kpi title="Heatwave probability" value={ens.status === 'ready' ? pctTxt(prob) : ens.status === 'loading' ? '…' : 'UNAVAILABLE'} color={probColor} prov={ens.status === 'ready' ? 'ensemble' : 'na'} provTitle="Share of valid ensemble members meeting the criterion below"
          sub={e ? `${e.qualifying} of ${e.validMembers} members meet the criterion` : ens.error || 'fetching ensemble…'} />
        <Kpi title="Forecast peak (median)" value={peakEns ? `${peakEns.p50}°C` : '—'} color={peakEns ? spectralColor(peakEns.p50) : C.text} prov={peakEns ? 'ensemble' : 'na'}
          sub={peakEns ? `${shortDay(peakEns.date)} · 80% range ${peakEns.p10}–${peakEns.p90}°C` : 'no ensemble'} />
        <Kpi title={`Days ≥ ${threshold.t}°C`} value={hotDaysEns != null ? `${hotDaysEns} / ${e.days.length}` : '—'} prov={hotDaysEns != null ? 'ensemble' : 'na'} provTitle="Days on which at least half of the members reach the IMD terrain threshold"
          sub={`IMD ${threshold.kind} threshold · deterministic: ${detDays.filter(d => typeof d.maxTemp === 'number' && d.maxTemp >= threshold.t).length} days`} />
        <Kpi title="Forecast uncertainty" value={spread != null ? `±${(spread / 2).toFixed(1)}°C` : '—'} prov={spread != null ? 'ensemble' : 'na'} provTitle="Half of the average 10th–90th percentile spread of the daily maximum across members"
          sub={spread != null ? `mean 10–90th pct spread ${spread}°C (daily max)` : 'no ensemble'} color={spread == null ? C.text : spread > 4 ? C.amber : C.green} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 10, alignItems: 'start' }}>
        <Section no="01" title={horizon === '72h' ? 'Hourly temperature · next 72 hours' : 'Daily maximum · next 7 days'} testId="pred-band"
          right={<Prov k="ensemble" title="Shaded band = 10th–90th percentile of the members; line = median; dashed = deterministic forecast" />}>
          <div style={{ height: 270 }}>
            {(horizon === '7d' ? ens.status : hourly.status) === 'ready' ? (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={horizon === '7d' ? chart7 : chart72} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                  <CartesianGrid stroke={C.border} strokeDasharray="3 3" />
                  <XAxis dataKey={horizon === '7d' ? 'day' : 'hour'} tick={{ fill: C.muted, fontSize: 10 }} interval={horizon === '7d' ? 0 : 11} />
                  <YAxis tick={{ fill: C.muted, fontSize: 10 }} domain={['dataMin - 2', 'dataMax + 2']} unit="°" />
                  <Tooltip contentStyle={tip} formatter={(v, n) => (Array.isArray(v) ? [`${v[0]}–${v[1]}°C`, '10–90th percentile'] : [`${v}°C`, n === 'p50' ? 'ensemble median' : 'deterministic'])} />
                  <Area dataKey="band" stroke="none" fill={C.cyan} fillOpacity={0.18} isAnimationActive={false} />
                  <Line dataKey="p50" stroke={C.cyan} strokeWidth={2} dot={horizon === '7d'} isAnimationActive={false} />
                  <Line dataKey="det" stroke={C.amber} strokeWidth={1.5} strokeDasharray="5 4" dot={false} connectNulls isAnimationActive={false} />
                  {horizon === '7d' && <ReferenceLine y={threshold.t} stroke={C.red} strokeDasharray="4 3" label={{ value: `IMD ${threshold.t}°C`, fill: C.red, fontSize: 10, position: 'insideTopRight' }} />}
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: '100%', display: 'grid', placeItems: 'center', color: C.muted, fontSize: 12, textAlign: 'center' }}>
                {(horizon === '7d' ? ens.status : hourly.status) === 'error' ? `Ensemble forecast UNAVAILABLE: ${(horizon === '7d' ? ens.error : hourly.error) || 'request failed'}. The deterministic forecast is still shown on Overview.` : 'Fetching the ensemble…'}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 14, fontSize: 10, color: C.muted, flexWrap: 'wrap' }}>
            <span><span style={{ display: 'inline-block', width: 14, height: 8, background: `${C.cyan}44`, marginRight: 4 }} />10–90th percentile of members</span>
            <span><span style={{ display: 'inline-block', width: 14, height: 2, background: C.cyan, marginRight: 4, verticalAlign: 'middle' }} />ensemble median</span>
            <span><span style={{ display: 'inline-block', width: 14, borderTop: `2px dashed ${C.amber}`, marginRight: 4, verticalAlign: 'middle' }} />deterministic forecast{horizon === '72h' ? ' (first 24 h only)' : ''}</span>
          </div>
        </Section>

        <Section no="02" title="Chance of reaching the IMD threshold, per day" testId="pred-prob" right={<Prov k="ensemble" />}>
          {ens.status === 'ready' ? (
            <>
              <div style={{ height: 150 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chart7} margin={{ top: 6, right: 6, left: -22, bottom: 0 }}>
                    <XAxis dataKey="day" tick={{ fill: C.muted, fontSize: 9 }} interval={0} tickFormatter={v => v.split(',')[0]} />
                    <YAxis domain={[0, 100]} tick={{ fill: C.muted, fontSize: 9 }} unit="%" />
                    <Tooltip contentStyle={tip} formatter={(v, n, p) => [`${v}% of ${p.payload.n} members`, `max ≥ ${threshold.t}°C`]} />
                    <Bar dataKey="pAbove" isAnimationActive={false}>{chart7.map((d, i) => <Cell key={i} fill={d.pAbove >= 60 ? C.red : d.pAbove >= 30 ? C.amber : d.pAbove > 0 ? '#EAB308' : C.green} />)}</Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div style={{ fontSize: 10.5, color: C.muted, lineHeight: 1.45 }}>
                <b style={{ color: C.text }}>Criterion:</b> {e.criterion}. Probability = members meeting it ÷ valid members ({e.validMembers} of {e.members}). This is ensemble agreement, not a calibrated probability and not an IMD warning; the IMD "departure from normal" rule is not applied because the project holds no per-city climatological normal.
              </div>
            </>
          ) : <div style={{ fontSize: 11, color: C.muted }}>{ens.status === 'error' ? `UNAVAILABLE: ${ens.error}` : 'Fetching…'}</div>}
          <SubHead prov="forecast" provTitle="Open-Meteo deterministic daily maxima, classified with the IMD threshold and absolute rules">Deterministic outlook</SubHead>
          {outlook ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
              {outlook.days.map(d => <div key={d.date} title={`${d.date}: ${d.maxTemp}°C · ${d.label}`} style={{ textAlign: 'center', fontSize: 9, color: C.muted, borderTop: `3px solid ${LEVEL_COLOR[d.level]}`, paddingTop: 3 }}><div style={{ fontSize: 12, fontWeight: 800, color: C.text, ...num }}>{d.maxTemp}°</div>{(d.date || '').split(',')[0]}</div>)}
            </div>
          ) : <div style={{ fontSize: 11, color: C.muted }}>No deterministic forecast loaded.</div>}
          {outlook?.spells?.length ? <div style={{ fontSize: 11, color: C.amber }}>Heat spell forecast: {outlook.spells.map(s => `${s.from} → ${s.to} (${s.days} days, peak ${s.peak}°C)`).join('; ')}</div> : outlook ? <div style={{ fontSize: 11, color: C.green }}>No 2-day spell above the threshold in the deterministic forecast.</div> : null}
        </Section>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 10, alignItems: 'start' }}>
        <Section no="03" title={`District risk timeline · ${state}`} testId="pred-timeline" right={<Prov k="forecast" title="Open-Meteo deterministic daily maximum for each city; the city stands in for its district" />}>
          {timeline.status === 'ready' && timeline.rows.length ? (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 3, fontSize: 11 }}>
                <thead><tr><th style={{ textAlign: 'left', color: C.muted, fontWeight: 600 }}>City (district proxy)</th>{timeline.rows[0].time.map(t => <th key={t} style={{ color: C.muted, fontWeight: 600, fontSize: 10 }}>{shortDay(t).split(',')[0]}</th>)}</tr></thead>
                <tbody>
                  {timeline.rows.map(r => {
                    const th = terrainThreshold({ elevation: r.elevation, isCoastal })
                    return (
                      <tr key={r.city}>
                        <td style={{ color: r.city === city ? C.cyan : C.text, fontWeight: r.city === city ? 800 : 500, whiteSpace: 'nowrap' }}>{r.city}<span style={{ color: C.muted, fontSize: 9 }}> · {th.t}°C rule</span></td>
                        {r.max.map((v, i) => { const cl = classifyDay(v, th); return <td key={i} title={`${r.city} ${r.time[i]}: ${v ?? '—'}°C · ${cl.label}`} style={{ textAlign: 'center', borderRadius: 4, padding: '4px 0', background: `${LEVEL_COLOR[cl.level]}cc`, color: '#fff', fontWeight: 700, ...num }}>{v == null ? '—' : Math.round(v)}</td> })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : <div style={{ fontSize: 11, color: C.muted }}>{timeline.status === 'error' ? `Timeline UNAVAILABLE: ${timeline.error}` : 'Fetching forecasts for the state\'s cities…'}</div>}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: 9.5, color: C.muted }}>
            {[['normal', 'Normal'], ['warm', 'Within 3°C of threshold'], ['watch', 'At/above threshold'], ['heatwave', `≥ ${IMD_RULE.absolute}°C`], ['severe', `≥ ${IMD_RULE.severe}°C`]].map(([k, v]) => <span key={k}><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: LEVEL_COLOR[k], marginRight: 4, verticalAlign: 'middle' }} />{v}</span>)}
          </div>
          <div style={{ fontSize: 9.5, color: C.muted }}>Up to 8 cities: {city} plus the state's hottest cities in the live cache. Per-district forecasts are not held; each row is the forecast at that city's coordinates.</div>
        </Section>

        <Section no="04" title="How to read this forecast" testId="pred-explain" right={<Prov k="rules" />}>
          <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11, lineHeight: 1.5 }}>
            <li><b>Ensemble:</b> the same weather model (NOAA GFS via Open-Meteo) run {e?.members ?? 31} times with slightly different starting conditions. Where the runs agree, confidence is higher.</li>
            <li><b>Band:</b> 8 in 10 runs fall inside the shaded range. A wide band means the forecast is uncertain; plan for the upper edge.</li>
            <li><b>Probability:</b> the share of runs meeting the IMD threshold rule for this terrain ({threshold.kind}, {threshold.t}°C) on 2 consecutive days, or any day ≥ {IMD_RULE.absolute}°C.</li>
            <li><b>Deterministic line:</b> the single forecast used on Overview, the Co-Pilot and the planner. It can sit outside the band; the ensemble is a separate model run.</li>
            <li><b>Not included:</b> the IMD departure-from-normal rule, humidity-driven heat stress in the probability, and any official IMD bulletin.</li>
          </ul>
          {e && <div style={{ fontSize: 9.5, color: C.muted }}>Ensemble fetched {new Date(e.generatedAt).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })} IST · cached 30 min · source ensemble-api.open-meteo.com (non-commercial licence).</div>}
        </Section>
      </div>

      <DetailsDrawer testId="pred-details-toggle" what="district magistrate's weekly brief, budget plan, outlook panel, intervention grid">{children}</DetailsDrawer>
    </div>
  )
}
