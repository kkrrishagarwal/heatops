import React, { useEffect, useMemo, useState } from 'react'
import { C, Prov, num, btn } from './workspaceKit'
import { simulate, diurnal, DEMO_INPUTS, ASSUMPTIONS, fetchPowerWeather } from '../utils/heatPower'

// Compact heat + electricity strip for Overview / Prediction / Analysis. Same model and the
// same officer-entered figures (stored by the Heat + Power workspace) — DEMO until entered.
const STORE = 'bhaskarops_power_inputs_v1'
const readInputs = () => { try { return JSON.parse(localStorage.getItem(STORE) || '{}') || {} } catch { return {} } }
const fmt = v => (v == null ? '—' : `${Math.round(v).toLocaleString('en-IN')} MW`)
const shortDay = iso => { try { return new Date(`${iso}T00:00:00+05:30`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', timeZone: 'Asia/Kolkata' }) } catch { return iso } }

export default function PowerSummaryStrip({ city, state, cityCoordsData, onOpen }) {
  const coords = cityCoordsData?.[`${city}|${state}`]
  const [wx, setWx] = useState({ key: null, days: [] })
  const key = `${city}|${state}`
  useEffect(() => {
    if (typeof coords?.lat !== 'number') return
    let live = true
    setWx({ key, days: [] })
    fetchPowerWeather(coords.lat, coords.lon).then(d => { if (live) setWx({ key, days: d.days }) }).catch(() => {})
    return () => { live = false }
  }, [key, coords?.lat, coords?.lon]) // eslint-disable-line react-hooks/exhaustive-deps
  const days = wx.key === key ? wx.days : []
  const inp = readInputs()
  const custom = inp.custom || {}
  const v = k => custom[k] ?? DEMO_INPUTS[k]
  const isDemo = ['referencePeakMW', 'capacityMW', 'solarMW'].some(k => custom[k] == null)
  const prov = isDemo ? 'demo' : 'estimate'
  const base = { referencePeakMW: v('referencePeakMW'), capacityMW: v('capacityMW'), solarMW: v('solarMW'), refTempC: days[0]?.max ?? null, sensitivityPctPerC: inp.sensitivityPctPerC ?? ASSUMPTIONS.sensitivityPctPerC }
  const week = useMemo(() => days.map(d => ({ d, s: simulate({ ...base, dayMaxC: d.max }) })), [days, JSON.stringify(base)]) // eslint-disable-line react-hooks/exhaustive-deps
  const peak = week.reduce((m, x) => (x.s && (!m || x.s.peak > m.s.peak) ? x : m), null)
  const whatIf = days.length ? simulate({ ...base, dayMaxC: days[0].max, tempIncreaseC: 3, acIncreasePct: 20 }) : null
  const curve = useMemo(() => diurnal({ hours: days[0]?.hours, ...base }), [days, JSON.stringify(base)]) // eslint-disable-line react-hooks/exhaustive-deps
  const eve = curve.filter(h => h.hour >= 18 && h.hour <= 21)
  const avg = k => (eve.length ? eve.reduce((s, h) => s + h[k], 0) / eve.length : null)
  const tile = (title, value, sub, p, color) => (
    <div style={{ background: C.raised, borderRadius: 8, padding: '6px 9px', minWidth: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6, fontSize: 9, color: C.muted, letterSpacing: '0.1em', fontWeight: 700, textTransform: 'uppercase' }}><span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</span><Prov k={p} /></div>
      <div style={{ fontSize: 16, fontWeight: 900, color: color || C.text, ...num }}>{value}</div>
      <div style={{ fontSize: 9.5, color: C.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</div>
    </div>
  )
  return (
    <div data-testid="power-strip" style={{ maxWidth: 1500, margin: '0 auto 10px', background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '8px 10px', display: 'grid', gridTemplateColumns: 'auto repeat(5, minmax(0, 1fr)) auto', gap: 8, alignItems: 'stretch', color: C.text }}>
      <div style={{ alignSelf: 'center', fontSize: 10, fontWeight: 900, letterSpacing: '0.14em', color: C.cyan, lineHeight: 1.3 }}>⚡ HEAT +<br />POWER</div>
      {tile('Electricity demand', 'UNAVAILABLE', 'no SLDC / DISCOM feed', 'na', C.muted)}
      {tile('Predicted peak', fmt(peak?.s?.peak), peak ? `${shortDay(peak.d.date)} evening · ${peak.d.max}°C` : 'loading forecast…', prov)}
      {tile('Grid stress', peak?.s ? peak.s.stress.label : '—', peak?.s ? `${Math.round(peak.s.utilisation * 100)}% of ${isDemo ? 'demo' : 'entered'} capacity` : '', prov, peak?.s?.stress.color)}
      {tile('What-if +3°C, +20% AC', fmt(whatIf?.peak), whatIf ? `${whatIf.changePct >= 0 ? '+' : ''}${whatIf.changePct}% · ${whatIf.stress.label}` : '', prov, whatIf?.stress.color)}
      {tile('6–9 PM solar vs cooling', eve.length ? `${Math.round(avg('solar'))} / ${Math.round(avg('cooling'))} MW` : '—', 'solar ≈ 0 at the evening peak', 'forecast')}
      <button type="button" onClick={onOpen} data-testid="power-strip-open" style={{ ...btn(C.cyan), alignSelf: 'center', whiteSpace: 'nowrap' }}>Open Heat + Power →</button>
    </div>
  )
}
