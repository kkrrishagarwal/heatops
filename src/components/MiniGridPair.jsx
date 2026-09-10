import React from 'react'
import { getCellTemp, getGridBucket } from '../utils/dashboardUtils'

// Before/after pair of the Analysis heat grid (same cells, same thresholds) — shared by the
// Interventions preview and the Prediction brief.
export function MiniGrid({ base, tree = 0, roof = 0, water = 0, size = 15, label, testId, numbers = false }) {
  return (
    <div data-testid={testId} style={{ display: 'inline-block' }}>
      {label && <div style={{ fontSize: 9, color: '#94a3b8', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 4, textAlign: 'center' }}>{label}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(10, ${size}px)`, gap: 2 }}>
        {Array.from({ length: 100 }).map((_, i) => {
          const temp = getCellTemp(base, Math.floor(i / 10), i % 10, tree, roof, water)
          return <div key={i} data-bucket={getGridBucket(temp).label} title={`${temp.toFixed(1)}°C`} style={{ width: size, height: size, borderRadius: 3, background: getGridBucket(temp).color, opacity: 0.92, transition: 'background 0.4s', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: numbers ? Math.max(8, size * 0.38) : 0, fontWeight: 700, color: '#f8fafc', textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}>{numbers ? temp.toFixed(0) : ''}</div>
        })}
      </div>
    </div>
  )
}

export default function MiniGridPair({ base, tree, roof, water }) {
  return (
    <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'flex-start' }} data-testid="predict-grid-pair">
      <MiniGrid base={base} size={22} numbers label="Today" testId="predict-grid-before" />
      <div style={{ color: '#d97706', fontSize: 22, fontWeight: 800, alignSelf: 'center' }}>→</div>
      <MiniGrid base={base} tree={tree} roof={roof} water={water} size={22} numbers label="With the plan (projected)" testId="predict-grid-after" />
    </div>
  )
}
