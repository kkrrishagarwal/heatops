import React, { useEffect, useMemo, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine, Legend } from 'recharts'
import { C, card, num, Prov, Kpi, Section, SubHead, Pills, WorkspaceHeader, DetailsDrawer, wsRoot, btn, downloadText, toCsv, niceScale, axisTick, yLabel, tipStyle, shortDate, ChartRead, ChartKey } from './workspaceKit'
import HeatCoPilot, { buildCopilotInput } from './HeatCoPilot'
import { loadInterventionStatuses, STATUSES } from './InterventionsWorkspace'
import { activationLevel, buildFallbackPlan, LEVELS } from '../utils/heatActionProtocol'
import { buildOutlook, terrainThreshold } from '../utils/heatwaveOutlook'
import { assessHeatStress } from '../utils/heatStress'
import { fetchJson } from '../utils/fetchJson'

// WORKSPACE 6 — AI + EXPORT: Decision Support Workspace.
// The real Heat Co-Pilot (Agent37 → Gemini → rule-based, every plan validated) beside a report
// builder. Reports use recorded daily readings from /api/weather-history (the archive the
// refresh job writes), today's live reading and the forecast — never invented values. Exports:
// CSV (the rows behind the report) and a print view the browser saves as PDF.
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
const addDays = (iso, n) => { const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }
const daysBetween = (a, b) => Math.round((new Date(`${b}T00:00:00Z`) - new Date(`${a}T00:00:00Z`)) / 86400000)
const mean = a => (a.length ? Math.round((a.reduce((s, v) => s + v, 0) / a.length) * 10) / 10 : null)

function PartnersPanel({ city, state }) {
  const [st, setSt] = useState(null)
  useEffect(() => { fetch('/api/integrations').then(r => r.json()).then(setSt).catch(() => setSt({})) }, [])
  const mobileUrl = `/api/mobile?city=${encodeURIComponent(city || 'Lucknow')}&state=${encodeURIComponent(state || 'Uttar Pradesh')}`
  const rows = [
    ['Agent37', 'Primary engine for the AI Heat Co-Pilot (agent writes the heat action protocol)', st?.agent37, 'AGENT37_API_KEY + AGENT37_INSTANCE_ID'],
    ['Hackyard LLM Gateway', 'Co-Pilot engine after Agent37; AGNI chat fallback (team credits)', st?.gateway, 'LLM_GATEWAY_URL + LLM_GATEWAY_KEY'],
    ['Google Gemini', 'Co-Pilot and AGNI backup engine', st?.gemini, 'GEMINI_API_KEY'],
    ['ElevenLabs', 'Hindi / English voice for the CAP alert (IVR, public address)', st?.elevenlabs, 'ELEVENLABS_API_KEY'],
    ['Browser Use', 'Agent reads live state power demand from Vidyut PRAVAH (Heat + Power)', st?.browserUse, 'BROWSER_USE_API_KEY'],
    ['FlutterFlow', 'Field-officer mobile app reads the open mobile API', true, mobileUrl],
    ['Render', 'Second deployment from render.yaml (static site, API proxied to Vercel)', null, 'render.yaml in the repo']
  ]
  return (
    <Section no="04" title="Technology partners" testId="ai-partners" right={<Prov k="rules" title="Status read from the server; keys are never sent to the browser" />}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
        <tbody>{rows.map(([n, what, on, how]) => (
          <tr key={n} style={{ borderTop: `1px solid ${C.border}` }}>
            <td style={{ padding: '5px 0', fontWeight: 800, whiteSpace: 'nowrap', verticalAlign: 'top' }}>{n}</td>
            <td style={{ padding: '5px 8px', color: C.muted }}>{what}<div style={{ fontSize: 9.5, color: '#64748b' }}>{n === 'FlutterFlow' ? <a href={how} target="_blank" rel="noopener noreferrer" style={{ color: C.cyan }}>{how}</a> : how}</div></td>
            <td style={{ padding: '5px 0', textAlign: 'right', whiteSpace: 'nowrap', verticalAlign: 'top' }}>
              <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 5, border: `1px solid ${on ? C.green : on === null ? C.cyan : C.border}`, color: on ? C.green : on === null ? C.cyan : C.muted }}>{st == null && on !== true && on !== null ? '…' : on ? 'ACTIVE' : on === null ? 'CONFIG' : 'KEY NEEDED'}</span>
            </td>
          </tr>))}</tbody>
      </table>
    </Section>
  )
}

export default function AIExportWorkspace({ city, state, liveWeather, lulcReal, cityCoordsData, isCoastal = false, cacheStatus = 'ready', userName = '', children }) {
  const [kind, setKind] = useState('weekly') // daily | weekly | custom
  const [from, setFrom] = useState(() => addDays(today(), -29))
  const [to, setTo] = useState(today)
  const [hist, setHist] = useState({ status: 'loading', points: [], source: null, error: null })

  const range = useMemo(() => {
    const t = today()
    if (kind === 'daily') return { from: t, to: t }
    if (kind === 'weekly') return { from: addDays(t, -6), to: t }
    const f = from <= to ? from : to, e = from <= to ? to : from
    return { from: f, to: e > t ? t : e }
  }, [kind, from, to])
  const daysNeeded = Math.min(366, Math.max(1, daysBetween(range.from, today()) + 1))

  useEffect(() => {
    let live = true
    setHist(h => ({ ...h, status: 'loading' }))
    fetchJson(`/api/weather-history?city=${encodeURIComponent(city)}&state=${encodeURIComponent(state)}&days=${daysNeeded}`, { timeoutMs: 15000 })
      .then(j => { if (live) setHist({ status: 'ready', points: Array.isArray(j?.points) ? j.points : [], source: j?.source || null, error: null }) })
      .catch(e => { if (live) setHist({ status: 'error', points: [], source: null, error: e.message }) })
    return () => { live = false }
  }, [city, state, daysNeeded])

  const elevation = typeof liveWeather?.elevation === 'number' ? liveWeather.elevation : null
  const threshold = terrainThreshold({ elevation, isCoastal })
  const rows = useMemo(() => hist.points.filter(p => p.date >= range.from && p.date <= range.to).sort((a, b) => a.date.localeCompare(b.date)), [hist.points, range])
  const recorded = rows.filter(p => !p.isCarriedForward)
  const stats = useMemo(() => {
    const t = recorded.map(p => p.temp).filter(v => typeof v === 'number'), m = recorded.map(p => p.tempMax).filter(v => typeof v === 'number'), q = recorded.map(p => p.aqi).filter(v => typeof v === 'number')
    return { days: rows.length, recorded: recorded.length, carried: rows.length - recorded.length, tMean: mean(t), maxHigh: m.length ? Math.max(...m) : null, hotDays: m.filter(v => v >= threshold.t).length, aqiMean: mean(q), aqiMax: q.length ? Math.max(...q) : null }
  }, [rows, recorded, threshold.t])
  const expectedDays = daysBetween(range.from, range.to) + 1

  const input = useMemo(() => buildCopilotInput({ city, state, liveWeather, lulcReal, cityCoordsData, isCoastal }), [city, state, liveWeather, lulcReal, cityCoordsData, isCoastal])
  const act = useMemo(() => activationLevel(input), [input])
  const plan = useMemo(() => buildFallbackPlan(input), [input])
  const outlook = useMemo(() => buildOutlook(liveWeather?.forecast, { elevation, isCoastal }), [liveWeather, elevation, isCoastal])
  const stress = useMemo(() => assessHeatStress(liveWeather), [liveWeather])
  const lvl = LEVELS[act.level]
  const demo = liveWeather?.demoOverride != null
  const statuses = loadInterventionStatuses(city, state)
  const actionRows = plan.actions.map(a => ({ ...a, status: statuses.statuses[`${a.priority}:${a.title}`]?.status || 'Recommended' })).concat(statuses.custom.map(a => ({ ...a, status: statuses.statuses[`${a.priority}:${a.title}`]?.status || 'Recommended' })))
  const reportTitle = `${kind === 'daily' ? 'Daily' : kind === 'weekly' ? 'Weekly' : 'Custom-period'} heat report · ${city}, ${state}`
  const generated = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
  const chart = rows.map(p => ({ date: shortDate(p.date), temp: p.isCarriedForward ? null : p.temp, high: p.isCarriedForward ? null : p.tempMax }))

  const exportCsv = () => {
    const meta = [['Report', reportTitle], ['Period', `${range.from} to ${range.to}`], ['Generated (IST)', generated], ['History source', hist.source || 'unavailable'], ['Note', 'temp = reading at the refresh time; tempMax = that day\'s forecast high; carried-forward rows repeat an earlier reading because the refresh failed']]
    const data = [['Date', 'Observed at (UTC)', 'Air temp (°C)', 'Day high (°C)', 'AQI (US)', 'PM10 (µg/m³)', 'Rain chance (%)', 'Cloud cover (%)', 'Carried forward'], ...rows.map(p => [p.date, p.observedAt, p.temp, p.tempMax, p.aqi, p.pm10, p.rainChance, p.cloudCover, p.isCarriedForward ? 'yes' : 'no'])]
    const fc = outlook ? [[], ['Forecast (Open-Meteo, deterministic)'], ['Date', 'Max (°C)', 'Min (°C)', 'Class'], ...outlook.days.map(d => [d.date, d.maxTemp, d.minTemp, d.label])] : []
    const acts = [[], ['Actions (rule-based; statuses self-reported on this browser)'], ['Priority', 'Action', 'Owner', 'Status'], ...actionRows.map(a => [a.priority, a.title, a.owner, a.status])]
    downloadText(`${city}-${kind}-report-${range.from}_${range.to}.csv`, toCsv([...meta, [], ...data, ...fc, ...acts]))
  }

  const exportPdf = () => {
    const tr = cells => `<tr>${cells.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(reportTitle)}</title><style>
      body{font:12px/1.45 system-ui,Segoe UI,Arial,sans-serif;color:#0f172a;margin:28px}h1{font-size:19px;margin:0}h2{font-size:13px;margin:18px 0 6px;border-bottom:2px solid #f59e0b;padding-bottom:3px}
      table{border-collapse:collapse;width:100%;font-size:11px}td,th{border:1px solid #cbd5e1;padding:3px 6px;text-align:left}th{background:#f1f5f9}.m{color:#475569;font-size:10.5px}.k{display:inline-block;margin:0 18px 6px 0}.k b{font-size:16px;display:block}
      .tag{font-size:9px;font-weight:700;border:1px solid #94a3b8;border-radius:3px;padding:0 4px;color:#475569}@media print{button{display:none}}</style></head><body>
      <button onclick="window.print()" style="float:right">Print / Save as PDF</button>
      <h1>${esc(reportTitle)}</h1><div class="m">Period ${esc(range.from)} to ${esc(range.to)} · generated ${esc(generated)} IST · BhaskarOps${userName ? ` · prepared by ${esc(userName)}` : ''}</div>
      <h2>Current situation <span class="tag">${demo ? 'DEMO' : cacheStatus === 'error' ? 'CACHED' : 'LIVE'}</span></h2>
      <div><span class="k">Air temperature<b>${esc(liveWeather?.current?.temp ?? '—')}°C</b></span><span class="k">Feels like<b>${esc(stress?.now?.heatIndex ?? '—')}°C</b></span><span class="k">AQI (US)<b>${esc(liveWeather?.aqi?.usAQI ?? '—')}</b></span><span class="k">Activation<b>${esc(lvl.label)}</b></span></div>
      <div class="m">${esc(act.reasons.join(' · '))}${demo ? ' · DEMO override active: the current reading is forced for demonstration.' : ''}</div>
      <h2>Recorded readings for the period <span class="tag">RECORDED</span></h2>
      <div><span class="k">Days with data<b>${stats.days} of ${expectedDays}</b></span><span class="k">Mean air temp<b>${stats.tMean ?? '—'}°C</b></span><span class="k">Highest day high<b>${stats.maxHigh ?? '—'}°C</b></span><span class="k">Days ≥ ${threshold.t}°C<b>${stats.hotDays}</b></span><span class="k">Mean / max AQI<b>${stats.aqiMean ?? '—'} / ${stats.aqiMax ?? '—'}</b></span></div>
      ${rows.length ? `<table><tr><th>Date</th><th>Air temp °C</th><th>Day high °C</th><th>AQI</th><th>PM10</th><th>Rain %</th><th>Note</th></tr>${rows.map(p => tr([p.date, p.temp, p.tempMax, p.aqi, p.pm10, p.rainChance, p.isCarriedForward ? 'carried forward' : ''])).join('')}</table>` : `<p class="m">No recorded readings for this period${hist.status === 'error' ? ` (history unavailable: ${esc(hist.error)})` : ''}.</p>`}
      <p class="m">Air temp is the reading at the refresh time, not the daily maximum. Day high is that day's forecast maximum. Source: ${esc(hist.source || 'unavailable')} archive of Open-Meteo readings.</p>
      ${outlook ? `<h2>Next 7 days <span class="tag">FORECAST</span></h2><table><tr><th>Day</th><th>Max °C</th><th>Min °C</th><th>Against IMD ${threshold.kind} threshold (${threshold.t}°C)</th></tr>${outlook.days.map(d => tr([d.date, d.maxTemp, d.minTemp, d.label])).join('')}</table>` : ''}
      <h2>Actions and status <span class="tag">RULE-BASED</span> <span class="tag">SELF-REPORTED</span></h2>
      <table><tr><th>Priority</th><th>Action</th><th>Owner</th><th>Deadline</th><th>Status</th></tr>${actionRows.map(a => tr([a.priority, a.title, a.owner, a.deadline, a.status])).join('')}</table>
      <p class="m">Statuses were set by the officer on one browser and are not independently verified. People at risk and economic impact: UNAVAILABLE (no approved dataset). Not an IMD bulletin.</p>
      </body></html>`
    const w = window.open('', '_blank')
    if (!w) { alert('Allow pop-ups for this site to open the printable report.'); return }
    w.document.open(); w.document.write(html); w.document.close(); w.focus()
    setTimeout(() => { try { w.print() } catch { /* button in the page */ } }, 400)
  }

  const tip = { background: C.card, border: `1px solid ${C.border}`, fontSize: 11, color: C.text }

  return (
    <div data-testid="aiexport-workspace" style={wsRoot}>
      <WorkspaceHeader no="06" title={`Decision support · ${city}`} sub="Generate an AI heat-action directive, then build a daily, weekly or custom report from recorded readings and export it." />

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.15fr) minmax(0, 1fr)', gap: 10, alignItems: 'start' }}>
        <Section no="01" title="AI Heat Co-Pilot" testId="ai-copilot" right={<span style={{ display: 'flex', gap: 4 }}><Prov k="ai" title="Gemini (or Agent37 when configured); validated against the plan schema" /><Prov k="rules" title="Falls back to the NDMA / Ahmedabad HAP rule-based plan when AI is unavailable" /></span>}>
          <div style={{ background: '#0f172a', borderRadius: 8 }}>
            <HeatCoPilot city={city} state={state} liveWeather={liveWeather} lulcReal={lulcReal} cityCoordsData={cityCoordsData} isCoastal={isCoastal} />
          </div>
        </Section>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Section no="02" title="Report builder" testId="ai-report" right={<Prov k="history" title="Daily readings archived by the refresh job (/api/weather-history)" />}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <Pills testId="ai-report-kind" value={kind} onChange={setKind} options={[['daily', 'Daily'], ['weekly', 'Weekly'], ['custom', 'Custom']]} />
              {kind === 'custom' && <>
                <input type="date" value={from} max={today()} onChange={e => setFrom(e.target.value)} aria-label="From" style={{ background: C.raised, color: C.text, border: `1px solid ${C.border}`, borderRadius: 6, padding: '3px 6px', fontSize: 11, colorScheme: 'dark' }} />
                <span style={{ fontSize: 11, color: C.muted }}>to</span>
                <input type="date" value={to} max={today()} onChange={e => setTo(e.target.value)} aria-label="To" style={{ background: C.raised, color: C.text, border: `1px solid ${C.border}`, borderRadius: 6, padding: '3px 6px', fontSize: 11, colorScheme: 'dark' }} />
              </>}
            </div>
            <div style={{ fontSize: 11, fontWeight: 800 }}>{reportTitle}</div>
            <div style={{ fontSize: 10, color: C.muted }}>Period {range.from} → {range.to}{kind === 'custom' && daysBetween(range.from, today()) > 365 ? ' · history is limited to the last 366 days' : ''}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
              <Kpi title="Days with data" value={hist.status === 'ready' ? `${stats.days}/${expectedDays}` : hist.status === 'loading' ? '…' : '—'} prov={hist.status === 'ready' ? 'history' : 'na'} sub={hist.status === 'error' ? 'history unavailable' : [expectedDays - stats.days > 0 ? `${expectedDays - stats.days} day(s) missing` : '', stats.carried ? `${stats.carried} carried forward` : ''].filter(Boolean).join(' · ') || 'all recorded'} />
              <Kpi title="Highest day high" value={stats.maxHigh != null ? `${stats.maxHigh}°C` : '—'} prov={stats.maxHigh != null ? 'history' : 'na'} sub={`${stats.hotDays} day(s) ≥ ${threshold.t}°C`} />
              <Kpi title="Mean AQI" value={stats.aqiMean ?? '—'} prov={stats.aqiMean != null ? 'history' : 'na'} sub={stats.aqiMax != null ? `max ${stats.aqiMax}` : ''} />
            </div>
            {(() => {
              const vals = chart.flatMap(d => [d.temp, d.high])
              const top = Math.max(...vals.filter(v => typeof v === 'number'), -99)
              const showTh = threshold.t - top <= 8
              const sc = niceScale(vals, { step: 2, include: showTh ? [threshold.t] : [] })
              const hottest = recorded.filter(p => typeof p.tempMax === 'number').sort((a, b) => b.tempMax - a.tempMax)[0]
              return (
                <>
                  <div style={{ height: 190 }}>
                    {chart.length > 1 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chart} margin={{ top: 10, right: 12, left: 4, bottom: 4 }}>
                          <CartesianGrid stroke={C.border} strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="date" tick={axisTick} tickLine={false} interval="preserveStartEnd" minTickGap={18} />
                          <YAxis tick={axisTick} domain={sc.domain} ticks={sc.ticks} tickFormatter={v => `${v}°`} width={58} label={yLabel('Temperature (°C)')} />
                          <Tooltip {...tipStyle} formatter={(v, n) => (v == null ? ['no reading (carried forward)', n] : [`${v}°C`, n])} />
                          {showTh && <ReferenceLine y={threshold.t} stroke={C.red} strokeWidth={1.5} strokeDasharray="6 4" label={{ value: `Heatwave threshold ${threshold.t}°C`, fill: C.red, fontSize: 10.5, fontWeight: 700, position: 'insideTopLeft' }} />}
                          <Line name="Day's high" dataKey="high" stroke={C.amber} strokeWidth={2.5} dot={chart.length <= 14 ? { r: 3, fill: C.amber } : false} connectNulls={false} isAnimationActive={false} />
                          <Line name="Reading at refresh time" dataKey="temp" stroke={C.cyan} strokeWidth={1.8} dot={false} connectNulls={false} isAnimationActive={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <div style={{ height: '100%', display: 'grid', placeItems: 'center', fontSize: 11, color: C.muted, textAlign: 'center' }}>
                        {hist.status === 'loading' ? 'Loading recorded readings…' : hist.status === 'error' ? `Recorded history UNAVAILABLE: ${hist.error}` : rows.length === 1 ? `One recorded reading: ${rows[0].temp}°C at refresh, day high ${rows[0].tempMax}°C.` : 'No recorded readings in this period.'}
                      </div>
                    )}
                  </div>
                  <ChartKey items={[['line', C.amber, "Day's high"], ['line', C.cyan, 'Reading at refresh time'], ...(showTh ? [['dash', C.red, `IMD ${threshold.t}°C`]] : [])]} />
                  {chart.length > 1 && <ChartRead>The orange line is each day's high; the blue line is the single reading taken when the archive refreshed, so it is usually lower. {hottest ? <>Hottest day: <b>{shortDate(hottest.date)} at {hottest.tempMax}°C</b>{hottest.tempMax < threshold.t ? `, below the ${threshold.t}°C heatwave line.` : `, at or above the ${threshold.t}°C heatwave line.`}</> : null} Gaps are days with no recorded reading.</ChartRead>}
                </>
              )
            })()}
            <SubHead>Report contents</SubHead>
            <ul style={{ margin: 0, paddingLeft: 16, fontSize: 10.5, color: C.muted, lineHeight: 1.5 }}>
              <li>Current reading and activation level <Prov k={demo ? 'demo' : 'live'} /></li>
              <li>Recorded daily readings for the period <Prov k="history" /></li>
              <li>7-day forecast against the IMD {threshold.kind} threshold <Prov k="forecast" /></li>
              <li>{actionRows.length} actions with their statuses <Prov k="rules" /> <Prov k="self" /></li>
              <li>People at risk and economic impact <Prov k="na" /></li>
            </ul>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" onClick={exportCsv} style={btn(C.cyan)} data-testid="ai-export-csv">Download CSV</button>
              <button type="button" onClick={exportPdf} style={btn()} data-testid="ai-export-pdf">Open printable report (PDF)</button>
            </div>
            <div style={{ fontSize: 9.5, color: C.muted }}>The PDF opens as a print view; choose "Save as PDF" in the print dialog. Air temp is the reading at refresh time, not the daily maximum.</div>
          </Section>

          <Section no="03" title="Action status snapshot" testId="ai-status" right={<Prov k="self" />}>
            {STATUSES.map(s => { const n = actionRows.filter(a => a.status === s).length; return <div key={s} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}><span style={{ color: C.muted }}>{s}</span><b style={num}>{n}</b></div> })}
            <div style={{ fontSize: 9.5, color: C.muted }}>Set statuses in the Interventions workspace. Stored on this browser only.</div>
          </Section>
        </div>
      </div>

      <PartnersPanel city={city} state={state} />

      <DetailsDrawer testId="ai-details-toggle" what="AGNI chat, quick export & share, glossary, progress, team">{children}</DetailsDrawer>
    </div>
  )
}
