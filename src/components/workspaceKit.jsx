import React, { useRef, useState } from 'react'

// Shared building blocks for the six dashboard workspaces (Overview … AI + Export), so every
// workspace uses one palette, one provenance vocabulary and one card style.
export const C = { bg: '#060B14', card: '#0B1325', raised: '#111827', surf: '#101D2C', border: '#1F2937', cyan: '#38BDF8', blue: '#2563EB', amber: '#F59E0B', red: '#EF4444', green: '#10B981', purple: '#A855F7', text: '#E6EDF7', muted: '#93A4B8' }
export const card = { background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 12px', minWidth: 0 }
export const label = { fontSize: 9.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: C.muted, marginBottom: 6, fontWeight: 700 }
export const num = { fontVariantNumeric: 'tabular-nums' }

// Provenance labels. Every number on a workspace carries one of these.
export const PROV = {
  live: { t: 'LIVE', c: C.green }, demo: { t: 'DEMO', c: C.amber }, forecast: { t: 'FORECAST', c: C.cyan }, ensemble: { t: 'ENSEMBLE', c: C.cyan },
  estimate: { t: 'ESTIMATE', c: C.purple }, ai: { t: 'AI-GENERATED', c: C.blue }, na: { t: 'UNAVAILABLE', c: C.muted }, cached: { t: 'CACHED', c: C.amber },
  rules: { t: 'RULE-BASED', c: C.purple }, satellite: { t: 'SATELLITE', c: C.cyan }, history: { t: 'RECORDED', c: C.green }, self: { t: 'SELF-REPORTED', c: C.amber }
}
export function Prov({ k, title }) {
  const p = PROV[k] || PROV.na
  return <span title={title} style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: '0.08em', padding: '1px 6px', borderRadius: 4, border: `1px solid ${p.c}55`, color: p.c, background: `${p.c}14`, whiteSpace: 'nowrap' }}>{p.t}</span>
}

export function Kpi({ title, value, sub, prov, provTitle, color = C.text, children }) {
  return (
    <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 2 }} data-testid={`kpi-${title.replace(/\W+/g, '-').toLowerCase()}`}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}><span style={label}>{title}</span>{prov && <Prov k={prov} title={provTitle} />}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {children}
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 22, fontWeight: 800, color, lineHeight: 1.05, ...num }}>{value}</div>
          {sub && <div style={{ fontSize: 10.5, color: C.muted, marginTop: 2 }}>{sub}</div>}
        </div>
      </div>
    </div>
  )
}

export function Ring({ value, max = 100, color, size = 52 }) {
  const r = (size - 8) / 2, c = 2 * Math.PI * r, f = value == null ? 0 : Math.max(0, Math.min(1, value / max))
  return (
    <svg width={size} height={size} aria-hidden="true" style={{ flex: '0 0 auto' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={C.border} strokeWidth={6} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={6} strokeDasharray={`${c * f} ${c}`} strokeLinecap="round" transform={`rotate(-90 ${size / 2} ${size / 2})`} />
    </svg>
  )
}

export function Section({ no, title, right, children, style, testId }) {
  return (
    <section style={{ ...card, display: 'flex', flexDirection: 'column', gap: 8, ...style }} data-testid={testId}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ ...label, marginBottom: 0 }}><span style={{ color: C.cyan }}>{no} //</span> {title}</div>
        {right && <span style={{ marginLeft: 'auto' }}>{right}</span>}
      </div>
      {children}
    </section>
  )
}

export function SubHead({ children, prov, provTitle }) {
  return <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}><span style={label}>{children}</span>{prov && <Prov k={prov} title={provTitle} />}</div>
}

export function Pills({ value, onChange, options, testId }) {
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }} data-testid={testId}>
      {options.map(([k, v]) => (
        <button key={k} type="button" onClick={() => onChange(k)} aria-pressed={value === k}
          style={{ fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 6, border: `1px solid ${value === k ? C.cyan : C.border}`, background: value === k ? 'rgba(56,189,248,0.12)' : 'transparent', color: value === k ? C.cyan : C.muted, cursor: 'pointer' }}>{v}</button>
      ))}
    </div>
  )
}

export const btn = (bg = C.amber, fg = '#0f172a') => ({ fontSize: 11, fontWeight: 800, padding: '6px 10px', borderRadius: 7, border: bg === 'transparent' ? `1px solid ${C.border}` : 'none', background: bg, color: fg, cursor: 'pointer' })

export function WorkspaceHeader({ no, title, sub, right }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
      <div>
        <div style={{ fontSize: 9.5, letterSpacing: '0.2em', color: C.cyan, fontWeight: 800 }}>WORKSPACE {no}</div>
        <div style={{ fontSize: 20, fontWeight: 900, lineHeight: 1.15 }}>{title}</div>
        {sub && <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{sub}</div>}
      </div>
      {right && <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>{right}</div>}
    </div>
  )
}

// The existing panels for a workspace, kept intact behind a toggle.
export function DetailsDrawer({ children, testId, what }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  if (!children) return null
  return (
    <div ref={ref}>
      <button type="button" onClick={() => setOpen(v => !v)} data-testid={testId} aria-expanded={open}
        style={{ width: '100%', textAlign: 'left', fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', padding: '8px 12px', borderRadius: 8, border: `1px solid ${C.border}`, background: C.card, color: C.cyan, cursor: 'pointer' }}>
        {open ? '▾ HIDE DETAIL PANELS' : `▸ SHOW DETAIL PANELS — ${what}`}
      </button>
      <div style={{ display: open ? 'block' : 'none', marginTop: 10 }}>{children}</div>
    </div>
  )
}

export const wsRoot = { display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 1500, margin: '0 auto', color: C.text }

// Small download helper shared by the export buttons.
export function downloadText(filename, text, type = 'text/csv') {
  const blob = new Blob([text], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
export const csvCell = v => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }
export const toCsv = (rows) => rows.map(r => r.map(csvCell).join(',')).join('\n')

// ── Chart helpers: every workspace chart uses round ticks, labelled axes and one tooltip style ──
// niceScale: a [lo, hi] domain on whole steps that always contains the data (and any
// reference values passed in `include`, e.g. the IMD threshold), plus the tick list.
export function niceScale(values, { step = 2, include = [], pad = 1, min = -Infinity, max = Infinity } = {}) {
  const v = [...values, ...include].filter(x => typeof x === 'number' && Number.isFinite(x))
  if (!v.length) return { domain: [0, 10], ticks: [0, 5, 10] }
  let lo = Math.floor((Math.min(...v) - pad) / step) * step
  let hi = Math.ceil((Math.max(...v) + pad) / step) * step
  lo = Math.max(lo, min); hi = Math.min(hi, max); if (hi <= lo) hi = lo + step
  // keep the axis to at most ~7 ticks
  let s = step; while ((hi - lo) / s > 7) s *= 2
  lo = Math.floor(lo / s) * s; hi = Math.ceil(hi / s) * s
  const ticks = []; for (let t = lo; t <= hi + 1e-9; t += s) ticks.push(Math.round(t * 10) / 10)
  return { domain: [lo, hi], ticks }
}
export const axisTick = { fill: C.muted, fontSize: 10 }
export const yLabel = text => ({ value: text, angle: -90, position: 'insideLeft', offset: 2, style: { fill: C.muted, fontSize: 10, textAnchor: 'middle' } })
export const xLabel = text => ({ value: text, position: 'insideBottom', offset: -2, style: { fill: C.muted, fontSize: 10 } })
export const tipStyle = { contentStyle: { background: '#0B1325', border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 11, color: C.text, boxShadow: '0 8px 24px rgba(0,0,0,0.45)' }, labelStyle: { color: C.text, fontWeight: 800, marginBottom: 4 }, itemStyle: { padding: 0 } }
export const shortDate = iso => { try { return new Date(`${String(iso).slice(0, 10)}T00:00:00+05:30`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' }) } catch { return iso } }
export const shortWeekday = iso => { try { return new Date(`${String(iso).slice(0, 10)}T00:00:00+05:30`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', timeZone: 'Asia/Kolkata' }) } catch { return iso } }

// One plain-language line under a chart: what it shows and what to take from it.
export function ChartRead({ children }) {
  return <div style={{ fontSize: 11, color: C.text, background: 'rgba(56,189,248,0.06)', border: `1px solid rgba(56,189,248,0.2)`, borderRadius: 7, padding: '6px 9px', lineHeight: 1.45 }}><b style={{ color: C.cyan }}>How to read: </b>{children}</div>
}
// Legend chips drawn by us (Recharts' default legend is easy to miss and mislabels areas).
export function ChartKey({ items }) {
  return (
    <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 10.5, color: C.muted }}>
      {items.map(([kind, color, text]) => (
        <span key={text} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          {kind === 'band' && <span style={{ width: 16, height: 9, background: `${color}44`, border: `1px solid ${color}66`, borderRadius: 2 }} />}
          {kind === 'line' && <span style={{ width: 16, height: 3, background: color, borderRadius: 2 }} />}
          {kind === 'dash' && <span style={{ width: 16, borderTop: `2px dashed ${color}` }} />}
          {kind === 'dot' && <span style={{ width: 9, height: 9, background: color, borderRadius: '50%' }} />}
          {kind === 'bar' && <span style={{ width: 10, height: 10, background: color, borderRadius: 2 }} />}
          {text}
        </span>
      ))}
    </div>
  )
}
// Centered message over an empty or all-zero chart, so it never looks broken.
export function ChartOverlay({ children }) {
  return <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none' }}><div style={{ background: 'rgba(6,11,20,0.88)', border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 12px', fontSize: 11.5, color: C.text, maxWidth: '80%', textAlign: 'center', lineHeight: 1.4 }}>{children}</div></div>
}
