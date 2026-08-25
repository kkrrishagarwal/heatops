import React from 'react'

// ─── SHIMMER / SKELETON LOADER ──────────────────────────────────────────────
// Provides smooth loading placeholders for panels and data cards instead of
// blank screens or raw "Loading..." text strings.

export function SkeletonLine({ width = '100%', height = '14px', style = {} }) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius: '4px',
        background: 'linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.04) 75%)',
        backgroundSize: '200% 100%',
        animation: 'skeleton-shimmer 1.6s infinite linear',
        ...style,
      }}
    />
  )
}

export function SkeletonCard({ height = '80px', style = {} }) {
  return (
    <div
      style={{
        width: '100%',
        height,
        borderRadius: '10px',
        background: 'linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.03) 75%)',
        backgroundSize: '200% 100%',
        animation: 'skeleton-shimmer 1.6s infinite linear',
        border: '1px solid rgba(255,255,255,0.06)',
        ...style,
      }}
    />
  )
}

export function SkeletonPanel({ title = 'Loading data...', rows = 3 }) {
  return (
    <div
      style={{
        background: 'rgba(10, 14, 26, 0.95)',
        border: '1px solid #1a3a5a',
        borderRadius: '12px',
        padding: '20px',
        marginBottom: '16px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
        <SkeletonLine width="180px" height="18px" />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {Array.from({ length: rows }).map((_, i) => (
          <SkeletonLine key={i} width={`${90 - i * 15}%`} height="14px" />
        ))}
      </div>
    </div>
  )
}

