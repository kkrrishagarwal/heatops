import React, { useMemo } from 'react'

// Decorative deep-space backdrop for the sign-in screen. Everything here is artwork: the Moon,
// planets, satellites and orbits are not positioned from real ephemerides or tracking data.
//
// Performance budget (no per-frame JavaScript at all):
//   stars      3 static layers, each ONE element whose stars are box-shadows (painted once)
//   twinkle    3 small layers animating opacity only (compositor-friendly)
//   orbits     two static SVGs (far half under the Earth, near half over it); satellites and
//              the Moon move with transform-only CSS animations (no repaint per frame)
//   meteors    2 CSS streaks on long cycles, visible ~4 % of the time; no timers
//   Earth      the parent passes it in as children (react-globe.gl or the static fallback)
// `motion`: 'full' | 'still' (prefers-reduced-motion) | 'paused' (tab hidden / signing in).

function mulberry32(seed) { return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }
function starShadows(seed, count, w, h, alphaMin, alphaMax, tint = false) {
  const r = mulberry32(seed); const out = []
  for (let i = 0; i < count; i++) {
    const x = Math.round(r() * w), y = Math.round(r() * h), a = (alphaMin + r() * (alphaMax - alphaMin)).toFixed(2)
    const c = tint && r() < 0.18 ? (r() < 0.5 ? `rgba(170,205,255,${a})` : `rgba(255,214,170,${a})`) : `rgba(255,255,255,${a})`
    out.push(`${x}px ${y}px ${c}`)
  }
  return out.join(',')
}

export default function SpaceScene({ motion = 'full', compact = false, earthSize = 420, children }) {
  const layers = useMemo(() => ({
    far: starShadows(11, 420, 2560, 1440, 0.25, 0.6, true),
    mid: starShadows(23, 150, 2560, 1440, 0.45, 0.85, true),
    near: starShadows(37, 40, 2560, 1440, 0.7, 1),
    tw1: starShadows(41, 14, 2560, 1440, 0.8, 1),
    tw2: starShadows(53, 14, 2560, 1440, 0.8, 1),
    tw3: starShadows(67, 12, 2560, 1440, 0.8, 1)
  }), [])


  // Orbits are drawn in Earth radii (R = 100 units) around the Earth's centre.
  const R = 100
  const orbitA = { rx: 1.38 * R, ry: 0.36 * R, rot: -16 }
  const orbitB = { rx: 1.7 * R, ry: 0.56 * R, rot: 14 }
  const span = 2.1 * R // half-width of the SVG viewBox

  return (
    <div className={`ss-root ss-${motion}${compact ? ' ss-compact' : ''}`} aria-hidden="true">
      <div className="ss-nebula" />
      <div className="ss-stars ss-far" style={{ boxShadow: layers.far }} />
      <div className="ss-stars ss-mid" style={{ boxShadow: layers.mid }} />
      <div className="ss-stars ss-near" style={{ boxShadow: layers.near }} />
      <div className="ss-stars ss-tw ss-tw1" style={{ boxShadow: layers.tw1 }} />
      <div className="ss-stars ss-tw ss-tw2" style={{ boxShadow: layers.tw2 }} />
      <div className="ss-stars ss-tw ss-tw3" style={{ boxShadow: layers.tw3 }} />
      {!compact && <>
        <span className="ss-meteor ss-m1" />
        <span className="ss-meteor ss-m2" />
      </>}

      <div className="ss-stage">
        {!compact && (
          <>
            <div className="ss-planet ss-giant">
              <img src="/space/planet-giant.webp" alt="" width="200" height="200" decoding="async" loading="lazy" />
              <svg className="ss-ring" viewBox="-100 -40 200 80"><ellipse cx="0" cy="0" rx="92" ry="22" fill="none" stroke="rgba(226,196,160,0.55)" strokeWidth="5" /><ellipse cx="0" cy="0" rx="78" ry="17" fill="none" stroke="rgba(226,196,160,0.25)" strokeWidth="3" /></svg>
            </div>
            <img className="ss-planet ss-red" src="/space/planet-red.webp" alt="" width="96" height="96" decoding="async" loading="lazy" />
            <span className="ss-asteroid ss-a1" /><span className="ss-asteroid ss-a2" /><span className="ss-asteroid ss-a3" />
          </>
        )}

        <div className="ss-earth-slot" style={{ width: earthSize, height: earthSize }}>
          {/* back orbit layer sits under the Earth so the far half of each orbit is hidden */}
          <svg className="ss-orbits ss-back" viewBox={`${-span} ${-span} ${2 * span} ${2 * span}`} style={{ width: earthSize * 2.1, height: earthSize * 2.1 }}>
            <g transform={`rotate(${orbitA.rot})`}><ellipse rx={orbitA.rx} ry={orbitA.ry} className="ss-orbit" /></g>
            <g transform={`rotate(${orbitB.rot})`}><ellipse rx={orbitB.rx} ry={orbitB.ry} className="ss-orbit ss-orbit-dash" /></g>
            {!compact && <ellipse rx={1.62 * R} ry={1.24 * R} className="ss-orbit ss-orbit-moon" />}
            <circle r={1.12 * R} className="ss-graticule" />
            <circle r={1.26 * R} className="ss-graticule ss-graticule-2" />
          </svg>

          <div className="ss-earth">{children}</div>

          <svg className="ss-orbits ss-front" viewBox={`${-span} ${-span} ${2 * span} ${2 * span}`} style={{ width: earthSize * 2.1, height: earthSize * 2.1 }}>
            <defs><clipPath id="ss-front-half"><rect x={-span} y="0" width={2 * span} height={span} /></clipPath></defs>
            {/* near half of each orbit, drawn over the Earth */}
            <g transform={`rotate(${orbitA.rot})`} clipPath="url(#ss-front-half)"><ellipse rx={orbitA.rx} ry={orbitA.ry} className="ss-orbit ss-orbit-front" /></g>
            <g transform={`rotate(${orbitB.rot})`} clipPath="url(#ss-front-half)"><ellipse rx={orbitB.rx} ry={orbitB.ry} className="ss-orbit ss-orbit-dash ss-orbit-front" /></g>
          </svg>

          {/* Moving bodies: transform-only CSS animation (GPU compositor, no repaint). An orbit
              plane is tilted and squashed; inside it an arm rotates; the body counter-rotates
              and un-squashes so it stays upright and round. z-index flips at the half-way points
              so a satellite passes behind the Earth on the far side. */}
          {[
            { o: orbitA, dur: 46, delay: 0, kind: 'sat', size: 0.2 },
            { o: orbitB, dur: 74, delay: -30, kind: 'sat', size: 0.16 },
            ...(compact ? [] : [{ o: { rx: 1.62 * R, ry: 1.24 * R, rot: 0 }, dur: 180, delay: -40, kind: 'moon', size: 0.28 }])
          ].map((b, i) => {
            const k = b.o.ry / b.o.rx
            const px = earthSize / (2 * R) // px per orbit unit
            const style = { '--tilt': `${b.o.rot}deg`, '--k': k, '--rx': `${b.o.rx * px}px`, '--dur': `${b.dur}s`, '--delay': `${b.delay}s`, '--size': `${b.size * R * px}px` }
            return (
              <div key={i} className={`ss-plane ss-plane-${b.kind}`} style={style}>
                <div className="ss-arm">
                  <div className="ss-body">
                    {b.kind === 'moon'
                      ? <img src="/space/moon.webp" alt="" width="256" height="256" decoding="async" className="ss-moon" />
                      : <svg viewBox="-10 -4 20 8" className="ss-sat"><rect x="-2.2" y="-1.6" width="4.4" height="3.2" rx="0.6" fill="#cbd5e1" /><rect x="-9" y="-1.1" width="5.6" height="2.2" fill="#2563EB" stroke="#93c5fd" strokeWidth="0.3" /><rect x="3.4" y="-1.1" width="5.6" height="2.2" fill="#2563EB" stroke="#93c5fd" strokeWidth="0.3" /><circle r="0.7" cx="0" cy="-2.3" fill="#F59E0B" /></svg>}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
