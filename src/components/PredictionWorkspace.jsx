import React, { useEffect, useMemo, useState } from 'react'
import { ComposedChart, Area, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, CartesianGrid, BarChart, Bar, Cell, LabelList } from 'recharts'
import { C, card, num, Prov, Kpi, Section, SubHead, Pills, WorkspaceHeader, DetailsDrawer, wsRoot, niceScale, axisTick, yLabel, tipStyle, shortWeekday, ChartRead, ChartKey, ChartOverlay } from './workspaceKit'
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
  const chart7 = useMemo(() => (e?.days || []).map((d, i) => ({ day: shortWeekday(d.date), band: d.p10 != null ? [d.p10, d.p90] : null, p50: d.p50, det: typeof detDays[i]?.maxTemp === 'number' ? detDays[i].maxTemp : null, pAbove: d.pAbove == null ? null : Math.round(d.pAbove * 100), n: d.n })), [e, detDays])
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
          {(() => {
            const st = horizon === '7d' ? ens.status : hourly.status
            const data = horizon === '7d' ? chart7 : chart72
            const vals = data.flatMap(d => [d.band?.[0], d.band?.[1], d.p50, d.det])
            const top = Math.max(...vals.filter(v => typeof v === 'number'), -99)
            const showTh = horizon === '7d' && threshold.t - top <= 8
            const sc = niceScale(vals, { step: 2, include: showTh ? [threshold.t] : [] })
            return (
              <>
                <div style={{ height: 270, position: 'relative' }}>
                  {st === 'ready' ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={data} margin={{ top: 10, right: 14, left: 4, bottom: 4 }}>
                        <CartesianGrid stroke={C.border} strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey={horizon === '7d' ? 'day' : 'hour'} tick={axisTick} interval={horizon === '7d' ? 0 : 11} tickLine={false} />
                        <YAxis tick={axisTick} domain={sc.domain} ticks={sc.ticks} tickFormatter={v => `${v}°`} width={58} label={yLabel(horizon === '7d' ? 'Daily max (°C)' : 'Temperature (°C)')} />
                        <Tooltip {...tipStyle} formatter={(v, n) => (Array.isArray(v) ? [`${v[0]} – ${v[1]}°C`, 'Likely range (8 in 10 runs)'] : [`${v}°C`, n === 'p50' ? 'Middle forecast' : 'Standard forecast'])} />
                        <Area dataKey="band" stroke={C.cyan} strokeOpacity={0.35} fill={C.cyan} fillOpacity={0.2} isAnimationActive={false} />
                        <Line dataKey="p50" stroke={C.cyan} strokeWidth={2.5} dot={horizon === '7d' ? { r: 3.5, fill: C.cyan } : false} isAnimationActive={false}>
                          {horizon === '7d' && <LabelList dataKey="p50" position="top" offset={8} formatter={v => `${Math.round(v)}°`} style={{ fill: C.text, fontSize: 10.5, fontWeight: 700 }} />}
                        </Line>
                        <Line dataKey="det" stroke={C.amber} strokeWidth={1.8} strokeDasharray="5 4" dot={false} connectNulls isAnimationActive={false} />
                        {showTh && <ReferenceLine y={threshold.t} stroke={C.red} strokeWidth={1.5} strokeDasharray="6 4" label={{ value: `Heatwave threshold ${threshold.t}°C (IMD ${threshold.kind})`, fill: C.red, fontSize: 10.5, fontWeight: 700, position: 'insideTopLeft' }} />}
                      </ComposedChart>
                    </ResponsiveContainer>
                  ) : (
                    <div style={{ height: '100%', display: 'grid', placeItems: 'center', color: C.muted, fontSize: 12, textAlign: 'center' }}>
                      {st === 'error' ? `Ensemble forecast UNAVAILABLE: ${(horizon === '7d' ? ens.error : hourly.error) || 'request failed'}. The deterministic forecast is still shown on Overview.` : 'Fetching the ensemble…'}
                    </div>
                  )}
                </div>
                <ChartKey items={[['band', C.cyan, 'Likely range (8 in 10 runs)'], ['line', C.cyan, 'Middle forecast'], ['dash', C.amber, `Standard forecast${horizon === '72h' ? ' (today only)' : ''}`], ...(showTh ? [['dash', C.red, `IMD threshold ${threshold.t}°C`]] : [])]} />
                {st === 'ready' && (
                  <ChartRead>
                    {horizon === '7d'
                      ? <>The middle forecast peaks at <b>{peakEns?.p50}°C</b> on {peakEns ? shortWeekday(peakEns.date) : '—'}. {showTh ? (top < threshold.t ? <>The whole range stays <b>below the red {threshold.t}°C heatwave line</b>, so no heatwave is expected this week.</> : <>Where the shaded range crosses the red line, a heatwave day is possible.</>) : <>The {threshold.t}°C heatwave threshold is far above this week's range ({Math.round(top)}°C at most), so no heatwave is expected.</>} The dashed orange line is a separate single-run forecast and can sit outside the range.</>
                      : <>Each hour shows the likely range across 31 runs. A narrow band means the runs agree. The dashed line covers today only.</>}
                  </ChartRead>
                )}
              </>
            )
          })()}
        </Section>

        <Section no="02" title="Chance of a heatwave-level day" testId="pred-prob" right={<Prov k="ensemble" />}>
          {ens.status === 'ready' ? (
            <>
              <div style={{ height: 160, position: 'relative' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chart7} margin={{ top: 18, right: 6, left: 4, bottom: 0 }}>
                    <CartesianGrid stroke={C.border} strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="day" tick={axisTick} interval={0} tickLine={false} />
                    <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tick={axisTick} tickFormatter={v => `${v}%`} width={58} label={yLabel('Chance')} />
                    <Tooltip {...tipStyle} formatter={(v, n, p) => [`${v}% (${Math.round((v / 100) * p.payload.n)} of ${p.payload.n} runs)`, `Max ≥ ${threshold.t}°C`]} />
                    <Bar dataKey="pAbove" radius={[4, 4, 0, 0]} minPointSize={2} isAnimationActive={false}>
                      {chart7.map((d, i) => <Cell key={i} fill={d.pAbove >= 60 ? C.red : d.pAbove >= 30 ? C.amber : d.pAbove > 0 ? '#EAB308' : C.green} />)}
                      <LabelList dataKey="pAbove" position="top" formatter={v => `${v}%`} style={{ fill: C.text, fontSize: 10.5, fontWeight: 700 }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                {chart7.every(d => !d.pAbove) && <ChartOverlay>✅ <b>0% on every day.</b> None of the {e.validMembers} forecast runs reach {threshold.t}°C this week.</ChartOverlay>}
              </div>
              <ChartRead>Each bar is the share of the {e.validMembers} forecast runs that reach the {threshold.t}°C heatwave threshold that day. Green 0%, yellow under 30%, amber 30–60%, red over 60%.</ChartRead>
              <details style={{ fontSize: 10.5, color: C.muted }}>
                <summary style={{ cursor: 'pointer' }}>Exact criterion and limits</summary>
                <div style={{ marginTop: 4, lineHeight: 1.45 }}>{e.criterion}. Probability = members meeting it ÷ valid members ({e.validMembers} of {e.members}). This is agreement between runs, not a calibrated probability and not an IMD warning. The IMD departure-from-normal rule is not applied because the project holds no per-city normal.</div>
              </details>
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
