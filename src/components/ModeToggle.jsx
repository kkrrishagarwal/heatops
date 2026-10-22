import React from 'react'
import { useOpsMode } from '../hooks/useOpsMode'

// [🏛️ Disaster Command (SDMA/NDMA)] [⚡ Power Grid & Electricity Load]
export default function ModeToggle({ size = 'sm', onChange }) {
  const [mode, setMode] = useOpsMode()
  const pad = size === 'md' ? '6px 12px' : '4px 9px'
  const fs = size === 'md' ? 12 : 10.5
  const opts = [['disaster', '🏛️ Disaster Command', 'SDMA / NDMA heat-risk command'], ['power', '⚡ Power Grid & Load', 'Electricity grid stress under heat']]
  return (
    <div role="group" aria-label="Operating mode" data-testid="mode-toggle" style={{ display: 'inline-flex', border: '1px solid rgba(148,163,184,0.35)', borderRadius: 8, overflow: 'hidden', background: 'rgba(15,23,42,0.6)', flex: '0 0 auto' }}>
      {opts.map(([k, l, t]) => {
        const on = mode === k
        return (
          <button key={k} type="button" title={t} aria-pressed={on} data-testid={`mode-${k}`} onClick={() => { setMode(k); onChange?.(k) }}
            style={{ border: 'none', padding: pad, fontSize: fs, fontWeight: 800, letterSpacing: '0.03em', cursor: 'pointer', whiteSpace: 'nowrap', background: on ? (k === 'power' ? 'rgba(56,189,248,0.22)' : 'rgba(245,158,11,0.22)') : 'transparent', color: on ? '#f8fafc' : '#94a3b8' }}>{l}</button>
        )
      })}
    </div>
  )
}
