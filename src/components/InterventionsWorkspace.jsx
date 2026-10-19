import React, { useEffect, useMemo, useState } from 'react'
import { C, card, num, Prov, Kpi, Section, SubHead, Pills, WorkspaceHeader, DetailsDrawer, wsRoot, btn, downloadText, toCsv } from './workspaceKit'
import { buildCopilotInput } from './HeatCoPilot'
import { activationLevel, buildFallbackPlan, LEVELS } from '../utils/heatActionProtocol'
import { getLulcWithFallback } from '../utils/lulcFallback'
import { cityRiskProfile, optimisePlan, fmtINR, INTERVENTIONS } from '../utils/mitigationPlanner'
import { BUDGET_PRESETS } from '../utils/heatCosting'

// WORKSPACE 5 — INTERVENTIONS: Heat Action & Resource Planning.
// Rule-based actions (NDMA / Ahmedabad Heat Action Plan) for the city's activation level, an
// officer-managed status for each, priorities, and the existing budget optimiser.
// PERSISTENCE: statuses live in this browser's localStorage only. There is no backend for
// them; nothing is shared with other officers and the app does not check field work, so the
// last status is literally "Marked verified (self-reported)".
export const STATUSES = ['Recommended', 'Planned', 'In progress', 'Completed', 'Marked verified (self-reported)']
const STATUS_COLOR = { Recommended: C.muted, Planned: C.cyan, 'In progress': C.amber, Completed: C.green, 'Marked verified (self-reported)': C.purple }
const PRI_COLOR = { P1: C.red, P2: C.amber, P3: C.cyan }
const KEY = (city, state) => `bhaskarops_interventions:${city}|${state}`

function readStore(k) { try { const v = JSON.parse(window.localStorage.getItem(k) || 'null'); return v && typeof v === 'object' ? { statuses: v.statuses || {}, custom: Array.isArray(v.custom) ? v.custom : [], log: Array.isArray(v.log) ? v.log : [] } : null } catch { return null } }
const empty = () => ({ statuses: {}, custom: [], log: [] })
const idOf = a => `${a.priority}:${a.title}`

export default function InterventionsWorkspace({ city, state, liveWeather, liveCityCache, lulcReal, cityCoordsData, isCoastal = false, cityPlan, userName = '', children }) {
  const [store, setStore] = useState(() => readStore(KEY(city, state)) || empty())
  const [storageOk, setStorageOk] = useState(true)
  const [filter, setFilter] = useState('all')
  const [budget, setBudget] = useState(10000000)
  const [draft, setDraft] = useState({ title: '', owner: '', priority: 'P2' })
  useEffect(() => { setStore(readStore(KEY(city, state)) || empty()) }, [city, state])
  const save = next => {
    setStore(next)
    try { window.localStorage.setItem(KEY(city, state), JSON.stringify(next)); setStorageOk(true) } catch { setStorageOk(false) }
  }

  const input = useMemo(() => buildCopilotInput({ city, state, liveWeather, lulcReal, cityCoordsData, isCoastal, budget }), [city, state, liveWeather, lulcReal, cityCoordsData, isCoastal, budget])
  const act = useMemo(() => activationLevel(input), [input])
  const plan = useMemo(() => buildFallbackPlan(input), [input])
  const lvl = LEVELS[act.level]
  const actions = useMemo(() => [
    ...plan.actions.map(a => ({ ...a, source: 'rules' })),
    ...store.custom.map(a => ({ ...a, source: 'officer' }))
  ].map(a => ({ ...a, id: idOf(a), status: store.statuses[idOf(a)]?.status || 'Recommended', updatedAt: store.statuses[idOf(a)]?.at || null, updatedBy: store.statuses[idOf(a)]?.by || null, note: store.statuses[idOf(a)]?.note || '' })), [plan, store])

  const setStatus = (a, status) => {
    const prev = store.statuses[a.id]?.status || 'Recommended'
    if (prev === status) return
    const at = new Date().toISOString()
    save({ ...store, statuses: { ...store.statuses, [a.id]: { ...(store.statuses[a.id] || {}), status, at, by: userName || 'officer' } }, log: [{ at, by: userName || 'officer', title: a.title, from: prev, to: status }, ...store.log].slice(0, 60) })
  }
  const setNote = (a, note) => save({ ...store, statuses: { ...store.statuses, [a.id]: { ...(store.statuses[a.id] || { status: a.status }), note: note.slice(0, 280) } } })
  const addCustom = () => {
    const title = draft.title.trim(); if (!title) return
    const at = new Date().toISOString()
    save({ ...store, custom: [...store.custom, { priority: draft.priority, category: 'officer', title: title.slice(0, 120), detail: 'Added by the officer.', owner: draft.owner.trim().slice(0, 60) || 'Unassigned', deadline: '—' }], log: [{ at, by: userName || 'officer', title, from: '—', to: 'Added' }, ...store.log].slice(0, 60) })
    setDraft({ title: '', owner: '', priority: 'P2' })
  }
  const removeCustom = a => save({ ...store, custom: store.custom.filter(c => idOf(c) !== a.id) })
  const reset = () => { if (window.confirm(`Clear every status, note and added action for ${city} on this browser?`)) save(empty()) }

  const counts = Object.fromEntries(STATUSES.map(s => [s, actions.filter(a => a.status === s).length]))
  const done = counts.Completed + counts['Marked verified (self-reported)']
  const shown = actions.filter(a => filter === 'all' || (filter === 'open' ? !['Completed', 'Marked verified (self-reported)'].includes(a.status) : a.priority === filter))

  // Budget: the existing city planner's plan when it has run, else the same optimiser here.
  const profile = useMemo(() => {
    const live = liveCityCache?.[`${city}|${state}`]
    const lulc = lulcReal ? getLulcWithFallback(city, state, lulcReal, cityCoordsData) : null
    return cityRiskProfile({ city, state, temp: liveWeather?.current?.temp ?? live?.temp ?? null, tempMax: liveWeather?.today?.maxTemp ?? live?.tempMax ?? null, modisPeak: null, lulc, facilities: null })
  }, [city, state, liveCityCache, lulcReal, cityCoordsData, liveWeather])
  const budgetPlan = useMemo(() => optimisePlan([profile], budget), [profile, budget])
  const usePlan = budgetPlan
  const types = usePlan && !usePlan.error ? Object.values(usePlan.byType).sort((a, b) => b.cost - a.cost) : []

  const exportCsv = () => {
    const rows = [['City', 'State', 'Priority', 'Action', 'Owner', 'Deadline', 'Status', 'Status updated (IST)', 'Updated by', 'Note', 'Source'],
      ...actions.map(a => [city, state, a.priority, a.title, a.owner, a.deadline, a.status, a.updatedAt ? new Date(a.updatedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : '', a.updatedBy || '', a.note, a.source === 'rules' ? 'Rule-based (NDMA/AHAP)' : 'Added by officer'])]
    downloadText(`${city}-heat-actions-${new Date().toISOString().slice(0, 10)}.csv`, `${toCsv(rows)}\n\n"Statuses are self-reported by the officer on this browser and are not independently verified."`)
  }

  return (
    <div data-testid="interventions-workspace" style={wsRoot}>
      <WorkspaceHeader no="05" title={`Heat action & resource planning · ${city}`} sub="Actions follow the city's activation level. Set each one's status as work progresses."
        right={<><button type="button" onClick={exportCsv} style={btn(C.cyan)} data-testid="int-export">Export tracker (CSV)</button><button type="button" onClick={reset} style={btn('transparent', C.muted)}>Reset</button></>} />

      <div role="note" data-testid="int-persistence" style={{ ...card, borderColor: 'rgba(245,158,11,0.45)', background: 'rgba(245,158,11,0.06)', fontSize: 11, lineHeight: 1.5 }}>
        <b style={{ color: C.amber }}>Where these statuses are kept:</b> only in this browser (local storage). They are not sent to a server, not visible to other officers or devices, and are lost if the browser's site data is cleared. "Marked verified" is the officer's own declaration; BhaskarOps does not check field work. Export the CSV to share or file the record.
        {!storageOk && <div style={{ color: C.red, marginTop: 4 }}>This browser is blocking local storage, so changes will not survive a reload.</div>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10 }}>
        <Kpi title="Activation level" value={lvl.label.split(' — ')[0]} color={lvl.color} prov="rules" sub={act.reasons[0]} />
        <Kpi title="Actions" value={String(actions.length)} prov="rules" sub={`${actions.filter(a => a.priority === 'P1').length} P1 · ${actions.filter(a => a.priority === 'P2').length} P2 · ${actions.filter(a => a.priority === 'P3').length} P3 · ${store.custom.length} added`} />
        <Kpi title="Progress" value={`${done} / ${actions.length}`} prov="self" provTitle="From the statuses set on this browser" color={done === actions.length && actions.length ? C.green : C.text} sub={`${counts['In progress']} in progress · ${counts.Planned} planned`} />
        <Kpi title="Budget allocated" value={usePlan && !usePlan.error ? fmtINR(usePlan.spent) : '—'} prov="estimate" provTitle="Unit costs and effects are documented assumptions in the planner" sub={usePlan && !usePlan.error ? `of ${fmtINR(budget)} · risk ${usePlan.stateBefore} → ${usePlan.stateAfter}` : usePlan?.message || ''} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.7fr) minmax(0, 1fr)', gap: 10, alignItems: 'start' }}>
        <Section no="01" title="Action tracker" testId="int-tracker" right={<Pills value={filter} onChange={setFilter} options={[['all', 'All'], ['open', 'Open'], ['P1', 'P1'], ['P2', 'P2'], ['P3', 'P3']]} />}>
          {shown.length ? shown.map(a => (
            <div key={a.id} data-testid="int-action" style={{ display: 'grid', gridTemplateColumns: '34px minmax(0, 1fr) 200px', gap: 10, padding: '8px 0', borderTop: `1px solid ${C.border}`, alignItems: 'start' }}>
              <span style={{ fontSize: 10, fontWeight: 900, color: PRI_COLOR[a.priority] || C.muted, border: `1px solid ${(PRI_COLOR[a.priority] || C.muted)}66`, borderRadius: 4, textAlign: 'center', padding: '2px 0' }}>{a.priority}</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 800 }}>{a.title} <Prov k={a.source === 'rules' ? 'rules' : 'self'} title={a.source === 'rules' ? 'From the NDMA / Ahmedabad Heat Action Plan rules for this activation level' : 'Added by the officer'} /></div>
                <div style={{ fontSize: 10.5, color: C.muted, marginTop: 2 }}>{a.detail}</div>
                <div style={{ fontSize: 10, color: C.muted, marginTop: 3 }}>Owner: <b style={{ color: C.text }}>{a.owner}</b> · Deadline: {a.deadline}</div>
                <input value={a.note} onChange={e => setNote(a, e.target.value)} placeholder="Note (optional)" aria-label={`Note for ${a.title}`} style={{ marginTop: 5, width: '100%', background: C.raised, border: `1px solid ${C.border}`, color: C.text, borderRadius: 6, padding: '4px 7px', fontSize: 10.5 }} />
              </div>
              <div>
                <select value={a.status} onChange={e => setStatus(a, e.target.value)} aria-label={`Status of ${a.title}`} data-testid="int-status"
                  style={{ width: '100%', background: C.raised, color: STATUS_COLOR[a.status], border: `1px solid ${STATUS_COLOR[a.status]}88`, borderRadius: 6, padding: '5px 6px', fontSize: 11, fontWeight: 700 }}>
                  {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <div style={{ fontSize: 9.5, color: C.muted, marginTop: 4 }}>{a.updatedAt ? `Set ${new Date(a.updatedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })} by ${a.updatedBy}` : 'Not yet updated'}</div>
                {a.source === 'officer' && <button type="button" onClick={() => removeCustom(a)} style={{ marginTop: 4, background: 'none', border: 'none', color: C.muted, fontSize: 10, cursor: 'pointer', padding: 0 }}>Remove</button>}
              </div>
            </div>
          )) : <div style={{ fontSize: 11, color: C.muted }}>No actions match this filter.</div>}
          <SubHead>Add a local action</SubHead>
          <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr 170px auto', gap: 6 }}>
            <select value={draft.priority} onChange={e => setDraft(d => ({ ...d, priority: e.target.value }))} aria-label="Priority" style={{ background: C.raised, color: C.text, border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 11 }}>{['P1', 'P2', 'P3'].map(p => <option key={p}>{p}</option>)}</select>
            <input value={draft.title} onChange={e => setDraft(d => ({ ...d, title: e.target.value }))} placeholder="Action, e.g. Shade nets at Sindhi Camp bus stand" aria-label="Action title" style={{ background: C.raised, border: `1px solid ${C.border}`, color: C.text, borderRadius: 6, padding: '5px 8px', fontSize: 11 }} />
            <input value={draft.owner} onChange={e => setDraft(d => ({ ...d, owner: e.target.value }))} placeholder="Owner / department" aria-label="Owner" style={{ background: C.raised, border: `1px solid ${C.border}`, color: C.text, borderRadius: 6, padding: '5px 8px', fontSize: 11 }} />
            <button type="button" onClick={addCustom} style={btn()} data-testid="int-add">Add</button>
          </div>
        </Section>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Section no="02" title="Status board" testId="int-board" right={<Prov k="self" />}>
            {STATUSES.map(s => (
              <div key={s} style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 26px', alignItems: 'center', gap: 8, fontSize: 11 }}>
                <span style={{ color: STATUS_COLOR[s] }}>{s}</span>
                <div style={{ height: 8, background: C.raised, borderRadius: 4 }}><div style={{ width: `${actions.length ? (counts[s] / actions.length) * 100 : 0}%`, height: '100%', background: STATUS_COLOR[s], borderRadius: 4 }} /></div>
                <b style={{ textAlign: 'right', ...num }}>{counts[s]}</b>
              </div>
            ))}
            <SubHead>Priority × status</SubHead>
            <table style={{ width: '100%', fontSize: 10.5, borderCollapse: 'collapse' }}>
              <thead><tr><th />{['Open', 'Done'].map(h => <th key={h} style={{ color: C.muted, fontWeight: 600 }}>{h}</th>)}</tr></thead>
              <tbody>{['P1', 'P2', 'P3'].map(p => { const ps = actions.filter(a => a.priority === p); const d = ps.filter(a => ['Completed', 'Marked verified (self-reported)'].includes(a.status)).length; return <tr key={p}><td style={{ color: PRI_COLOR[p], fontWeight: 800 }}>{p}</td><td style={{ textAlign: 'center', ...num }}>{ps.length - d}</td><td style={{ textAlign: 'center', ...num }}>{d}</td></tr> })}</tbody>
            </table>
          </Section>

          <Section no="03" title="Budget allocation" testId="int-budget" right={<Prov k="estimate" title="Optimiser output from documented unit costs and effect assumptions" />}>
            <Pills value={String(budget)} onChange={v => setBudget(+v)} options={BUDGET_PRESETS.map(b => [String(b), fmtINR(b)])} />
            {usePlan?.error ? <div style={{ fontSize: 11, color: C.amber }}>{usePlan.message}</div> : types.map(t => (
              <div key={t.type} style={{ display: 'grid', gridTemplateColumns: '1fr 70px', fontSize: 11, gap: 6 }}>
                <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: INTERVENTIONS[t.type]?.color, marginRight: 6 }} />{INTERVENTIONS[t.type]?.label || t.type} <span style={{ color: C.muted }}>· {Object.entries(t.units).map(([u, q]) => `${Math.round(q * 10) / 10} × ${u}`).join(', ')}</span></span>
                <b style={{ textAlign: 'right', ...num }}>{fmtINR(t.cost)}</b>
              </div>
            ))}
            {usePlan && !usePlan.error && <div style={{ fontSize: 10, color: C.muted }}>Risk index {usePlan.stateBefore} → {usePlan.stateAfter} (reduction {usePlan.reductionPct[0]}–{usePlan.reductionPct[1]}%, confidence {usePlan.confidence}). Unit costs are planning assumptions, not quotes. {cityPlan && !cityPlan.error ? 'The detailed planner in the panels below holds your last custom plan.' : ''}</div>}
            <div style={{ fontSize: 10, color: C.muted }}>Economic loss avoided: <b>UNAVAILABLE</b> (no validated source).</div>
          </Section>

          <Section no="04" title="Activity log" testId="int-log" right={<Prov k="self" />}>
            {store.log.length ? store.log.slice(0, 8).map((l, i) => <div key={i} style={{ fontSize: 10.5, color: C.muted }}><span style={{ color: C.text }}>{new Date(l.at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span> · {l.by}: {l.title} — {l.from === '—' ? <b style={{ color: C.text }}>added</b> : <>{l.from} → <b style={{ color: STATUS_COLOR[l.to] || C.text }}>{l.to}</b></>}</div>) : <div style={{ fontSize: 11, color: C.muted }}>No changes recorded on this browser yet.</div>}
          </Section>
        </div>
      </div>

      <DetailsDrawer testId="int-details-toggle" what="recommended green-cover plan, intervention sliders, cool-roof calculator, city planner, heatwave outlook, wind">{children}</DetailsDrawer>
    </div>
  )
}

// Read-only access for reports (AI + Export): the action statuses saved on this browser.
export function loadInterventionStatuses(city, state) { return readStore(KEY(city, state)) || empty() }
