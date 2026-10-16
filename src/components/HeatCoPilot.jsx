import React, { useEffect, useMemo, useRef, useState } from 'react'
import PanelIcon from './PanelIcon'
import { assessHeatStress } from '../utils/heatStress'
import { buildOutlook } from '../utils/heatwaveOutlook'
import { getLulcWithFallback } from '../utils/lulcFallback'
import { cityRiskProfile, riskLabel } from '../utils/mitigationPlanner'
import { activationLevel, buildFallbackPlan, sanitisePlan, LEVELS } from '../utils/heatActionProtocol'
import { openExecutiveBrief } from '../utils/executiveBrief'
import { buildCosting, BUDGET_PRESETS } from '../utils/heatCosting'
import ConsequenceChart from './ConsequenceChart'
import { fmtINR } from '../utils/mitigationPlanner'

// AI HEAT RESPONSE CO-PILOT (authority view). One button sends the selected city's live
// readings, heat stress, IMD-threshold outlook and land cover to POST /api/heat-agent, which
// has an AI write a structured municipal Heat Action Protocol — an Agent37-hosted agent when
// an instance is configured, otherwise Google Gemini (the key AGNI already uses). The panel:
//   • pings GET /api/heat-agent on mount — shows which engine is available (and wakes a
//     sleeping Agent37 instance so a real run starts warm);
//   • never hangs: "Use offline protocol now" is available while the agent works, and any
//     timeout / network failure / bad reply renders the rule-based protocol, labelled as such;
//   • offers three SIMULATED actions (ward advisory, SMS broadcast, SDMA incident) that only
//     write to a local, time-stamped action log — nothing is sent anywhere;
//   • exports a printable Executive Heat Action Brief.
const CLIENT_TIMEOUT_MS = 65000
const LOG_PREFIX = 'heatops_actionlog:'
const card = { background: 'rgba(15,23,42,0.55)', border: '1px solid #1e293b', borderRadius: 10, padding: '10px 12px' }
const label = { fontSize: 10, color: '#94a3b8', letterSpacing: 0.7, textTransform: 'uppercase', marginBottom: 4 }
const btn = (bg, fg = '#0f172a') => ({ background: bg, color: fg, border: 'none', borderRadius: 7, padding: '8px 12px', fontSize: 12, fontWeight: 800, cursor: 'pointer' })
const ghost = { background: 'transparent', color: '#e2e8f0', border: '1px solid #334155', borderRadius: 7, padding: '7px 11px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }

// ISO 3166-2:IN state / UT codes, for the simulated reference numbers.
const STATE_CODES = { 'Andhra Pradesh': 'AP', 'Arunachal Pradesh': 'AR', Assam: 'AS', Bihar: 'BR', Chhattisgarh: 'CT', Goa: 'GA', Gujarat: 'GJ', Haryana: 'HR', 'Himachal Pradesh': 'HP', Jharkhand: 'JH', Karnataka: 'KA', Kerala: 'KL', 'Madhya Pradesh': 'MP', Maharashtra: 'MH', Manipur: 'MN', Meghalaya: 'ML', Mizoram: 'MZ', Nagaland: 'NL', Odisha: 'OR', Punjab: 'PB', Rajasthan: 'RJ', Sikkim: 'SK', 'Tamil Nadu': 'TN', Telangana: 'TG', Tripura: 'TR', 'Uttar Pradesh': 'UP', Uttarakhand: 'UT', 'West Bengal': 'WB', 'Andaman and Nicobar Islands': 'AN', Chandigarh: 'CH', 'Dadra and Nagar Haveli and Daman and Diu': 'DH', Delhi: 'DL', 'Jammu and Kashmir': 'JK', Ladakh: 'LA', Lakshadweep: 'LD', Puducherry: 'PY' }

let pingPromise = null // one wake-up ping per page load, shared by every mount
function pingAgent() {
  if (!pingPromise) {
    pingPromise = fetch('/api/heat-agent', { method: 'GET' })
      .then(r => (r.ok ? r.json() : { configured: false, reachable: false, error: `HTTP ${r.status}` }))
      .catch(() => ({ configured: null, reachable: false, error: 'server unreachable' }))
  }
  return pingPromise
}

function readLog(key) {
  try { const v = JSON.parse(window.localStorage.getItem(key) || '[]'); return Array.isArray(v) ? v.slice(-50) : [] } catch { return [] }
}
function writeLog(key, log) {
  try { window.localStorage.setItem(key, JSON.stringify(log.slice(-50))) } catch { /* storage blocked: log stays in memory */ }
}

const OUTLOOK_HEADLINE = {
  severe: 'Severe heatwave conditions forecast',
  heatwave: 'Heatwave conditions forecast',
  watch: 'Above the IMD threshold on some days',
  warm: 'Warm week, below the heatwave threshold',
  normal: 'No heatwave conditions in the next 7 days'
}

export function buildCopilotInput({ city, state, liveWeather, lulcReal, cityCoordsData, isCoastal, budget = 10000000 }) {
  const { now, peak } = assessHeatStress(liveWeather)
  const outlook = buildOutlook(liveWeather?.forecast, { elevation: liveWeather?.elevation, isCoastal })
  const lulc = lulcReal ? getLulcWithFallback(city, state, lulcReal, cityCoordsData) : null
  const profile = cityRiskProfile({ city, state, temp: liveWeather?.current?.temp ?? null, tempMax: liveWeather?.today?.maxTemp ?? null, modisPeak: null, lulc, facilities: null })
  const hot = outlook?.days?.find(d => ['watch', 'heatwave', 'severe'].includes(d.level))
  const stressOut = now ? { heatIndex: now.heatIndex, heatIndexBandKey: now.heatIndexBand.key, heatIndexBandLabel: now.heatIndexBand.label, heatIndexEffect: now.heatIndexBand.effect, wetBulb: now.wetBulb, wbgt: now.wbgt, wbgtCat: now.wbgtCategory.cat, workRest: now.wbgtCategory.workRest, peakTime: peak?.time ?? null, peakWbgt: peak?.wbgt ?? null } : {}
  const level = activationLevel({ current: { temp: liveWeather?.current?.temp ?? null }, today: { maxTemp: liveWeather?.today?.maxTemp ?? null }, stress: stressOut, outlook: { worst: outlook?.worst } }).level
  const costing = buildCosting({ profile, level, stress: stressOut, outlook, budget, current: liveWeather?.current || null })
  return {
    city, state,
    elevation: liveWeather?.elevation ?? null,
    current: { temp: liveWeather?.current?.temp ?? null, humidity: liveWeather?.current?.humidity ?? null, feelsLike: liveWeather?.current?.feelsLike ?? null, windSpeed: liveWeather?.current?.windSpeed ?? null, uvIndex: liveWeather?.current?.uvIndex ?? null },
    today: { maxTemp: liveWeather?.today?.maxTemp ?? null, minTemp: liveWeather?.today?.minTemp ?? null },
    forecast: (liveWeather?.forecast || []).slice(0, 7).map(d => ({ date: d.date, maxTemp: d.maxTemp, minTemp: d.minTemp })),
    outlook: outlook ? { worst: outlook.worst, headline: OUTLOOK_HEADLINE[outlook.worst] || '', threshold: outlook.threshold.t, thresholdKind: outlook.threshold.kind, spell: outlook.spells[0] ? { from: outlook.spells[0].from, to: outlook.spells[0].to, days: outlook.spells[0].days, peak: outlook.spells[0].peak } : null, firstHotDay: hot?.date || null } : {},
    stress: stressOut,
    landCover: lulc ? { builtUp: lulc.builtUp ?? null, vegetation: lulc.vegetation ?? null, treeCover: lulc.treeCover ?? null, isFallback: !!lulc.isFallback, fallbackCity: lulc.fallbackCity || '' } : {},
    risk: { score: profile.risk ?? null, label: riskLabel(profile.risk).label },
    costing,
    demo: liveWeather?.demoOverride != null
  }
}

export default function HeatCoPilot({ city, state, liveWeather, lulcReal, cityCoordsData, isCoastal = false, compact = false }) {
  const [agent, setAgent] = useState(null) // ping result
  const [phase, setPhase] = useState('idle') // idle | running | done
  const [elapsed, setElapsed] = useState(0)
  const [result, setResult] = useState(null) // { source, plan, meta?, reason?, generatedAt }
  const [lang, setLang] = useState('en')
  const [budget, setBudget] = useState(BUDGET_PRESETS[2]) // seasonal budget the directive plans with
  const [notice, setNotice] = useState('')
  const logKey = `${LOG_PREFIX}${city || ''}|${state || ''}`
  const [log, setLog] = useState(() => readLog(logKey))
  const runRef = useRef(0)

  const input = useMemo(() => buildCopilotInput({ city, state, liveWeather, lulcReal, cityCoordsData, isCoastal, budget }), [city, state, liveWeather, lulcReal, cityCoordsData, isCoastal, budget])
  const pre = useMemo(() => activationLevel(input), [input])

  useEffect(() => { let live = true; pingAgent().then(r => { if (live) setAgent(r) }); return () => { live = false } }, [])
  useEffect(() => { setLog(readLog(logKey)); setResult(null); setPhase('idle'); setNotice(''); runRef.current++ }, [logKey])
  useEffect(() => {
    if (phase !== 'running') return undefined
    const started = Date.now()
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 500)
    return () => clearInterval(id)
  }, [phase])

  const finish = (runId, res) => { if (runRef.current === runId) { setResult(res); setPhase('done') } }
  const localFallback = reason => ({ source: 'fallback', reason, plan: buildFallbackPlan(input), generatedAt: new Date().toISOString(), local: true })

  const run = async () => {
    const runId = ++runRef.current
    setPhase('running'); setElapsed(0); setResult(null); setNotice('')
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), CLIENT_TIMEOUT_MS)
    try {
      const r = await fetch('/api/heat-agent', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input), signal: ctrl.signal })
      const data = await r.json().catch(() => null)
      if (!r.ok || !data) return finish(runId, localFallback(data?.error || `Co-Pilot server returned HTTP ${r.status}.`))
      const plan = sanitisePlan(data.plan)
      if (!plan) return finish(runId, localFallback('The server reply had no usable plan.'))
      finish(runId, { ...data, plan })
    } catch (err) {
      finish(runId, localFallback(err?.name === 'AbortError' ? `No answer within ${CLIENT_TIMEOUT_MS / 1000} s.` : 'Co-Pilot server unreachable (offline?).'))
    } finally { clearTimeout(timer) }
  }
  const useOfflineNow = () => { const runId = ++runRef.current; finish(runId, localFallback('Switched to the offline protocol before the agent answered.')) }

  const addLog = (title, ref, detail) => {
    const entry = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, at: new Date().toISOString(), title, ref, detail }
    setLog(prev => { const next = [...prev, entry]; writeLog(logKey, next); return next })
  }
  const stamp = () => new Date().toLocaleString('en-GB', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).replace(/\D/g, '').slice(0, 12)
  const stateCode = STATE_CODES[state] || (state || 'XX').replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase()
  const plan = result?.plan
  const smsText = plan ? (lang === 'hi' ? plan.publicAdvisory.hi : plan.publicAdvisory.en) || plan.publicAdvisory.en : ''

  const doAdvisory = () => addLog('Ward advisory dispatched to ward offices (simulated)', `ADV-${stateCode}-${stamp()}`, plan?.headline)
  const doSms = () => {
    const len = [...smsText].length
    const unicode = /[^\x00-\x7f]/.test(smsText)
    const segs = Math.max(1, Math.ceil(len / (unicode ? 67 : 153)))
    addLog(`SMS broadcast simulated (${lang === 'hi' ? 'Hindi' : 'English'}, ${len} chars, ${segs} segment${segs > 1 ? 's' : ''})`, `SMS-${stateCode}-${stamp()}`, smsText)
  }
  const doSdma = () => addLog(`Incident logged to SDMA (simulated): ${plan?.sdmaIncident?.type || 'Heat event'}`, `SDMA-${stateCode}-${stamp()}`, plan?.sdmaIncident?.summary)
  const doBrief = () => {
    const ok = openExecutiveBrief({ city, state, input, result, log })
    setNotice(ok ? '' : 'The browser blocked the brief window — allow pop-ups for this site and try again.')
  }

  const status = agent == null ? { text: 'Checking the AI engine…', color: '#94a3b8' }
    : agent.configured == null ? { text: 'Co-Pilot server unreachable — offline protocol available', color: '#f59e0b' }
    : agent.configured === false ? (agent.gemini ? { text: 'AI engine: Google Gemini (server-side key) · offline protocol as backup', color: '#22c55e' } : { text: 'No AI engine configured — runs will use the offline protocol', color: '#f59e0b' })
    : agent.reachable ? { text: `AI engine: Agent37 · instance ${agent.instance}${agent.gemini ? ' · Gemini as backup' : ''}`, color: '#22c55e' }
    : { text: `Agent37 instance ${agent.instance} is waking up${agent.gemini ? ' — Gemini answers meanwhile' : ' — first run may take longer'}`, color: '#f59e0b' }
  const lvl = LEVELS[plan?.level || pre.level]

  if (!city) return null
  return (
    <section className="panel" data-panel="COPILOT" style={{ borderLeft: `4px solid ${lvl.color}` }}>
      <h3><PanelIcon name="bot" /> AI HEAT RESPONSE CO-PILOT</h3>
      {!compact && <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 8 }}>
        An AI reads {city}'s live heat readings, heat stress, 7-day IMD-threshold outlook and land cover, and writes a municipal Heat Action Protocol: actions, owners, deadlines, labour timing and the public advisory.
      </div>}
      <div data-testid="copilot-status" style={{ fontSize: 11, color: status.color, marginBottom: 10 }}>● {status.text}</div>

      <div style={{ ...card, marginBottom: 10 }}>
        <div style={label}>Rule-based pre-assessment</div>
        <div style={{ fontSize: 14, fontWeight: 800, color: LEVELS[pre.level].color }}>{LEVELS[pre.level].label}</div>
        <div style={{ fontSize: 11, color: '#cbd5e1' }}>{pre.reasons.join(' · ')}</div>
      </div>

      <div style={{ ...card, marginBottom: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <div style={label}>Seasonal budget to plan with</div>
          <div style={{ display: 'flex', gap: 4 }}>
            {BUDGET_PRESETS.map(b => <button key={b} type="button" data-testid={`budget-${b}`} onClick={() => setBudget(b)} style={{ ...ghost, padding: '2px 8px', fontSize: 11, borderColor: budget === b ? '#f59e0b' : '#334155', color: budget === b ? '#fbbf24' : '#94a3b8' }}>{fmtINR(b)}</button>)}
          </div>
        </div>
        <div style={{ fontSize: 11, color: '#cbd5e1', marginTop: 4 }} data-testid="costing-preview">
          This week's emergency response at the pre-assessed level: <b>{input.costing?.fmt?.emergencyTotal || '₹0'}</b>
          {input.costing?.seasonal ? <> · the planner would spend <b>{input.costing.fmt.seasonalSpent}</b> of {fmtINR(budget)} for a projected risk {input.costing.seasonal.riskBefore} → {input.costing.seasonal.riskAfter}</> : ' · no seasonal plan (no live reading yet)'}
          {input.costing?.target && !input.costing.target.unreachable && <> · a {input.costing.target.reductionPct}% risk cut needs ≈ <b>{input.costing.fmt.targetInvestment}</b></>}
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <button type="button" data-testid="copilot-run" onClick={run} disabled={phase === 'running'} style={{ ...btn('#f59e0b'), opacity: phase === 'running' ? 0.6 : 1 }}>
          {phase === 'running' ? 'AI working…' : result ? 'Run the Co-Pilot again' : 'Run AI Co-Pilot'}
        </button>
        {phase === 'running' && <button type="button" data-testid="copilot-offline" onClick={useOfflineNow} style={ghost}>Use offline protocol now</button>}
      </div>
      {phase === 'running' && (
        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 8 }} aria-live="polite">
          {elapsed}s — the AI is writing the protocol{elapsed >= 10 ? '. Taking longer than usual; the offline protocol is one click away.' : '…'}
        </div>
      )}

      {plan && (
        <div data-testid="copilot-plan" style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div data-testid="copilot-source" style={{ fontSize: 11, padding: '6px 10px', borderRadius: 6, background: result.source === 'fallback' ? 'rgba(245,158,11,0.12)' : 'rgba(34,197,94,0.12)', color: result.source === 'fallback' ? '#fcd34d' : '#86efac', border: `1px solid ${result.source === 'fallback' ? 'rgba(245,158,11,0.4)' : 'rgba(34,197,94,0.4)'}` }}>
            {result.source === 'agent37'
              ? <>Generated by Agent37{result.meta?.agent ? ` · ${result.meta.agent}` : ''}{result.meta?.instance ? ` · instance ${result.meta.instance}` : ''}{result.meta?.elapsedMs ? ` · ${(result.meta.elapsedMs / 1000).toFixed(1)} s` : ''}{typeof result.meta?.costUsd === 'number' ? ` · $${result.meta.costUsd.toFixed(4)}` : ''}. AI output — review before issuing orders.</>
              : result.source === 'gemini'
                ? <>Generated by Google Gemini{result.meta?.model ? ` (${result.meta.model})` : ''}{result.meta?.elapsedMs ? ` · ${(result.meta.elapsedMs / 1000).toFixed(1)} s` : ''}{result.meta?.tokens ? ` · ${result.meta.tokens} tokens` : ''}. AI output — review before issuing orders.</>
                : <>Offline protocol (rule-based, NDMA / Ahmedabad HAP) — not generated by an AI. Reason: {result.reason}</>}
          </div>

          <div style={{ ...card, borderLeft: `4px solid ${lvl.color}` }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: lvl.color }}>{plan.headline || lvl.label}</div>
            <div style={{ fontSize: 12, color: '#cbd5e1', marginTop: 4 }}>{plan.situation}</div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, color: '#e2e8f0', minWidth: 520 }}>
              <thead><tr style={{ color: '#94a3b8', fontSize: 10, textAlign: 'left' }}><th style={{ padding: '4px 6px 6px 0' }}>Pri.</th><th style={{ padding: '4px 6px 6px 0' }}>Action</th><th style={{ padding: '4px 6px 6px 0' }}>Owner</th><th style={{ padding: '4px 0 6px' }}>By</th></tr></thead>
              <tbody>
                {plan.actions.map((a, i) => (
                  <tr key={i} data-copilot-action={a.category} style={{ borderTop: '1px solid #1e293b' }}>
                    <td style={{ padding: '6px 6px 6px 0', fontWeight: 800, color: a.priority === 'P1' ? '#f87171' : a.priority === 'P2' ? '#fb923c' : '#94a3b8' }}>{a.priority}</td>
                    <td style={{ padding: '6px 6px 6px 0', lineHeight: 1.45 }}><b>{a.title}</b><div style={{ color: '#94a3b8', fontSize: 11 }}>{a.detail}</div></td>
                    <td style={{ padding: '6px 6px 6px 0', fontSize: 11 }}>{a.owner}</td>
                    <td style={{ padding: '6px 0', fontSize: 11 }}>{a.deadline}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {plan.labour && (
            <div style={card}>
              <div style={label}>Labour order</div>
              <div style={{ fontSize: 12, color: '#e2e8f0' }}>Outdoor work <b>{plan.labour.shiftWindow}</b> · <b>{plan.labour.restrictHours}</b> · work/rest <b>{plan.labour.workRest}</b></div>
            </div>
          )}

          {plan.budget && (
            <div style={card} data-testid="copilot-budget">
              <div style={label}>Estimated cost — {city}</div>
              {plan.budget.emergencyThisWeek.length > 0 && (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, color: '#e2e8f0' }}>
                  <thead><tr style={{ color: '#94a3b8', fontSize: 10, textAlign: 'left' }}><th style={{ padding: '2px 0' }}>This week</th><th style={{ textAlign: 'right' }}>Qty</th><th style={{ textAlign: 'right' }}>Unit</th><th style={{ textAlign: 'right' }}>Cost</th></tr></thead>
                  <tbody>
                    {plan.budget.emergencyThisWeek.map((i, k) => <tr key={k} style={{ borderTop: '1px solid #1e293b' }}><td style={{ padding: '3px 0' }}>{i.item}</td><td style={{ textAlign: 'right' }}>{i.qty}</td><td style={{ textAlign: 'right' }}>{fmtINR(i.unitCost)}</td><td style={{ textAlign: 'right', fontWeight: 700 }}>{fmtINR(i.cost)}</td></tr>)}
                    <tr style={{ borderTop: '1px solid #334155' }}><td colSpan={3} style={{ padding: '3px 0', fontWeight: 800 }}>Emergency total</td><td style={{ textAlign: 'right', fontWeight: 800, color: '#fbbf24' }}>{fmtINR(plan.budget.emergencyTotal)}</td></tr>
                  </tbody>
                </table>
              )}
              {plan.budget.seasonal && (
                <div style={{ fontSize: 12, color: '#e2e8f0', marginTop: 6 }}>
                  <b>Seasonal investment {fmtINR(plan.budget.seasonal.investment)}</b>{plan.budget.seasonal.riskBefore != null ? ` · composite risk ${plan.budget.seasonal.riskBefore} → ${plan.budget.seasonal.riskAfter} (projected)` : ''}
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>{plan.budget.seasonal.whatItBuys}</div>
                </div>
              )}
              {plan.budget.notPriced.length > 0 && <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 4 }}>Not priced (no unit cost held): {plan.budget.notPriced.join(', ')}.</div>}
              {plan.budget.note && <div style={{ fontSize: 10, color: '#64748b', marginTop: 4 }}>{plan.budget.note}</div>}
            </div>
          )}

          {plan.ifNotControlled && (
            <div style={{ ...card, borderLeft: '4px solid #dc2626' }} data-testid="copilot-ifnot">
              <div style={{ ...label, color: '#fca5a5' }}>If this is not controlled</div>
              <div style={{ fontSize: 12, color: '#e2e8f0' }}>{plan.ifNotControlled.summary}</div>
              {plan.ifNotControlled.consequences.length > 0 && <ul style={{ margin: '6px 0 0 16px', padding: 0, fontSize: 11, color: '#cbd5e1' }}>{plan.ifNotControlled.consequences.map((c, k) => <li key={k}>{c}</li>)}</ul>}
              {plan.ifNotControlled.whoIsHitFirst.length > 0 && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 6 }}>Hit first: {plan.ifNotControlled.whoIsHitFirst.join(' · ')}</div>}
              {input.costing?.consequences?.exposure?.days?.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <ConsequenceChart exposure={input.costing.consequences.exposure} thresholdC={input.outlook?.threshold} labourWindow={(plan.labour?.shiftWindow || '').match(/\d{1,2}:\d{2}\s*[–-]\s*\d{1,2}:\d{2}/)?.[0].replace('-', '–') || '06:00–11:00'} />
                </div>
              )}
            </div>
          )}

          <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <div style={label}>Public advisory (SMS)</div>
              <div style={{ display: 'flex', gap: 4 }}>
                {['en', 'hi'].map(l => <button key={l} type="button" onClick={() => setLang(l)} style={{ ...ghost, padding: '2px 8px', fontSize: 11, borderColor: lang === l ? '#f59e0b' : '#334155', color: lang === l ? '#fbbf24' : '#94a3b8' }}>{l === 'en' ? 'English' : 'हिन्दी'}</button>)}
              </div>
            </div>
            <div data-testid="copilot-sms" lang={lang} style={{ fontSize: 13, color: '#e2e8f0', marginTop: 4 }}>{smsText || '—'}</div>
            <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>{[...smsText].length} characters</div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <button type="button" data-testid="sim-advisory" onClick={doAdvisory} style={ghost}>Dispatch ward advisory</button>
            <button type="button" data-testid="sim-sms" onClick={doSms} style={ghost}>Simulate SMS broadcast</button>
            <button type="button" data-testid="sim-sdma" onClick={doSdma} disabled={!plan.sdmaIncident} title={plan.sdmaIncident ? '' : 'No incident at this activation level'} style={{ ...ghost, opacity: plan.sdmaIncident ? 1 : 0.5 }}>Log incident to SDMA</button>
            <button type="button" data-testid="export-brief" onClick={doBrief} style={btn('#e2e8f0')}>Export Executive Heat Action Brief</button>
          </div>
          {notice && <div style={{ fontSize: 11, color: '#fca5a5' }}>{notice}</div>}

          {plan.assumptions?.length > 0 && (
            <details style={{ fontSize: 11, color: '#94a3b8' }}>
              <summary style={{ cursor: 'pointer' }}>Assumptions and limits ({plan.assumptions.length})</summary>
              <ul style={{ margin: '6px 0 0 16px' }}>{plan.assumptions.map((a, i) => <li key={i}>{a}</li>)}</ul>
            </details>
          )}
        </div>
      )}

      <div style={{ marginTop: 12 }}>
        <div style={{ ...label, display: 'flex', justifyContent: 'space-between' }}>
          <span>Action log · {city} — SIMULATED, nothing is sent</span>
          {log.length > 0 && <button type="button" onClick={() => { setLog([]); writeLog(logKey, []) }} style={{ ...ghost, padding: '1px 8px', fontSize: 10 }}>Clear</button>}
        </div>
        {log.length === 0
          ? <div style={{ fontSize: 11, color: '#64748b' }}>No actions yet. Run the Co-Pilot, then dispatch, broadcast or log.</div>
          : <ul data-testid="action-log" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {log.slice().reverse().map(e => (
                <li key={e.id} style={{ fontSize: 11, color: '#cbd5e1', borderLeft: '2px solid #f59e0b', paddingLeft: 8 }}>
                  <span style={{ color: '#94a3b8' }}>{new Date(e.at).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })} IST</span> · {e.title} <span style={{ color: '#64748b' }}>{e.ref}</span>
                </li>
              ))}
            </ul>}
      </div>
    </section>
  )
}
