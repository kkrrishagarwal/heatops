import React, { useEffect, useRef } from 'react'

// Windy-style wind + thermal advection particle layer for the Command Center. Zero
// dependencies: an HTML5 canvas over the Leaflet map, pointer-events none.
//
// Data: every city in the bulk weather cache that has a live wind reading (Open-Meteo
// wind_speed_10m km/h, wind_direction_10m ° meteorological = direction the wind blows FROM)
// plus its temperature and PM10. Vectors are interpolated onto a screen grid by inverse-
// distance weighting over the nearest stations. Where no city reading lies within ~1.5°
// (≈ 150 km) the cell has NO DATA and particles are not drawn — nothing is invented. If the cache has
// no wind at all yet (first refresh after the field was added), the layer draws nothing and
// the dock says so.
//
// Colour modes:
//   thermal     particle colour = interpolated air temperature (cyan < 30, amber 30–38,
//               orange 38–44, crimson→pink ≥ 44 °C): hot air being carried = heat advection
//   stagnation  magenta pulse where wind < 6 km/h and (temp > 40 °C or PM10 > 150 µg/m³):
//               heat and dust that the wind is not clearing; faint grey elsewhere
// The animation pauses while the toggle is off, while the tab is hidden, and during a pan
// or zoom (the grid is rebuilt when the map settles).
const K_NEAREST = 8
const MAX_RADIUS_DEG = 4 // search ring for neighbours
const MAX_NEAREST_DEG = 1.5 // a cell farther than this (~150 km) from any city has no data
const CELL_PX = 14

const compass16 = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW']
export const compassOf = deg => compass16[Math.round((((deg % 360) + 360) % 360) / 22.5) % 16]

export function thermalColor(t) {
  if (t == null) return 'rgba(148,163,184,0.35)'
  if (t < 30) return '#38bdf8'
  if (t < 38) return '#fbbf24'
  if (t < 44) return '#f97316'
  return t < 47 ? '#ef4444' : '#fca5a5'
}

// Plain-language readouts for the probe. Heuristics are named as such in the UI.
export function describeProbe(s) {
  if (!s) return null
  const westerly = s.dir >= 225 && s.dir <= 315
  const heatLoad = s.temp == null ? '—'
    : s.temp >= 42 && s.speed >= 8 && westerly ? 'HIGH — hot westerly ("Loo"-type) corridor'
    : s.temp >= 40 && s.speed >= 8 ? 'High — hot air being carried in'
    : s.temp >= 36 ? 'Moderate' : 'Low'
  const ventilation = s.speed < 6 && s.temp != null && s.temp > 40 ? 'Stagnant — heat not clearing'
    : s.speed < 6 ? 'Poor' : s.speed < 12 ? 'Fair' : 'Good'
  return { heatLoad, ventilation }
}

// Build stations from the bulk cache + coordinates.
export function windStations(liveCityCache, coords) {
  const out = []
  for (const [key, c] of Object.entries(liveCityCache || {})) {
    const xy = coords?.[key]
    if (!xy || typeof c?.windSpeed !== 'number' || typeof c?.windDir !== 'number' || typeof xy.lat !== 'number') continue
    const rad = (c.windDir * Math.PI) / 180
    // meteorological direction is where the wind comes FROM → velocity points the other way
    out.push({ lat: xy.lat, lon: xy.lon, u: -c.windSpeed * Math.sin(rad), v: -c.windSpeed * Math.cos(rad), speed: c.windSpeed, dir: c.windDir, temp: typeof c.temp === 'number' ? c.temp : null, pm10: typeof c.pm10 === 'number' ? c.pm10 : null })
  }
  return out
}

function buildIndex(stations) {
  const bins = new Map()
  for (const s of stations) { const k = `${Math.floor(s.lat)},${Math.floor(s.lon)}`; if (!bins.has(k)) bins.set(k, []); bins.get(k).push(s) }
  return bins
}

function interpolate(bins, lat, lon) {
  // expand the search ring until K_NEAREST stations are found or the radius cap is hit
  const found = []
  const bl = Math.floor(lat), bo = Math.floor(lon)
  for (let r = 0; r <= MAX_RADIUS_DEG; r++) {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue
      const b = bins.get(`${bl + dy},${bo + dx}`); if (b) for (const s of b) found.push(s)
    }
    if (found.length >= K_NEAREST) break
  }
  if (!found.length) return null
  const cosLat = Math.cos((lat * Math.PI) / 180)
  let wsum = 0, u = 0, v = 0, t = 0, tw = 0, pm = 0, pmw = 0
  const near = found.map(s => { const dx = (s.lon - lon) * cosLat, dy = s.lat - lat; return { s, d2: dx * dx + dy * dy } }).sort((a, b) => a.d2 - b.d2).slice(0, K_NEAREST)
  if (near[0].d2 > MAX_NEAREST_DEG * MAX_NEAREST_DEG) return null
  for (const { s, d2 } of near) {
    const w = 1 / (d2 + 1e-4)
    wsum += w; u += s.u * w; v += s.v * w
    if (s.temp != null) { t += s.temp * w; tw += w }
    if (s.pm10 != null) { pm += s.pm10 * w; pmw += w }
  }
  u /= wsum; v /= wsum
  return { u, v, speed: Math.hypot(u, v), dir: ((Math.atan2(-u, -v) * 180) / Math.PI + 360) % 360, temp: tw ? t / tw : null, pm10: pmw ? pm / pmw : null }
}

export default function WindParticleCanvas({ mapCtl, stations, enabled = false, mode = 'thermal', speed = 1, lite = false, onProbe }) {
  const canvasRef = useRef(null)
  const state = useRef({ grid: null, cols: 0, rows: 0, particles: [], raf: 0, paused: false, lastT: 0 })
  const propsRef = useRef({ mode, speed, onProbe }); propsRef.current = { mode, speed, onProbe }

  useEffect(() => {
    const ctl = mapCtl?.current; const canvas = canvasRef.current
    if (!ctl || !canvas || !enabled) return undefined
    const st = state.current
    const ctx = canvas.getContext('2d')
    const dpr = Math.min(1.5, window.devicePixelRatio || 1)
    const bins = buildIndex(stations)
    const N = lite ? 400 : 1500

    const resize = () => {
      const [w, h] = ctl.getSize()
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr)
      canvas.style.width = `${w}px`; canvas.style.height = `${h}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    const buildGrid = () => {
      const [w, h] = ctl.getSize()
      st.cols = Math.ceil(w / CELL_PX) + 1; st.rows = Math.ceil(h / CELL_PX) + 1
      st.grid = new Array(st.cols * st.rows)
      for (let r = 0; r < st.rows; r++) for (let c = 0; c < st.cols; c++) {
        const [lat, lon] = ctl.unproject(c * CELL_PX, r * CELL_PX)
        st.grid[r * st.cols + c] = stations.length ? interpolate(bins, lat, lon) : null
      }
    }
    const sample = (x, y) => {
      const c = Math.floor(x / CELL_PX), r = Math.floor(y / CELL_PX)
      if (c < 0 || r < 0 || c >= st.cols || r >= st.rows) return null
      return st.grid[r * st.cols + c]
    }
    const spawn = (p) => { const [w, h] = ctl.getSize(); p.x = Math.random() * w; p.y = Math.random() * h; p.age = 0; p.maxAge = 40 + Math.random() * 80 }
    st.particles = Array.from({ length: N }, () => { const p = {}; spawn(p); return p })

    const zoomFactor = () => Math.max(0.6, Math.min(3, ctl.getZoom() / 5))
    const frame = (t) => {
      if (st.paused || document.hidden) { st.raf = 0; return }
      const { mode: m, speed: sp } = propsRef.current
      const [w, h] = ctl.getSize()
      // fade the previous frame → trails
      ctx.globalCompositeOperation = 'destination-in'
      ctx.fillStyle = 'rgba(0,0,0,0.92)'
      ctx.fillRect(0, 0, w, h)
      ctx.globalCompositeOperation = 'source-over'
      ctx.lineWidth = 1.3
      ctx.lineCap = 'round'
      const k = 0.09 * sp * zoomFactor()
      const pulse = 0.55 + 0.45 * Math.sin(t / 350)
      for (const p of st.particles) {
        const s = sample(p.x, p.y)
        if (!s || p.age++ > p.maxAge) { spawn(p); continue }
        const nx = p.x + s.u * k, ny = p.y - s.v * k
        let color
        if (m === 'stagnation') {
          const trapped = s.speed < 6 && ((s.temp != null && s.temp > 40) || (s.pm10 != null && s.pm10 > 150))
          color = trapped ? `rgba(232,121,249,${pulse})` : s.speed < 10 ? 'rgba(248,113,113,0.45)' : 'rgba(148,163,184,0.28)'
        } else color = thermalColor(s.temp)
        ctx.strokeStyle = color
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(nx, ny); ctx.stroke()
        p.x = nx; p.y = ny
        if (nx < 0 || ny < 0 || nx > w || ny > h) spawn(p)
      }
      st.raf = requestAnimationFrame(frame)
    }
    const start = () => { if (!st.raf && !st.paused && !document.hidden) st.raf = requestAnimationFrame(frame) }
    const stop = () => { if (st.raf) cancelAnimationFrame(st.raf); st.raf = 0 }
    const clear = () => { ctx.globalCompositeOperation = 'source-over'; ctx.clearRect(0, 0, canvas.width, canvas.height) }

    resize(); buildGrid(); start()
    const offs = [
      ctl.on('movestart', () => { st.paused = true; stop(); clear() }),
      ctl.on('zoomstart', () => { st.paused = true; stop(); clear() }),
      ctl.on('moveend', () => { resize(); buildGrid(); st.particles.forEach(spawn); st.paused = false; start() }),
      ctl.on('resize', () => { resize(); buildGrid() })
    ]
    const onVis = () => { if (document.hidden) stop(); else start() }
    document.addEventListener('visibilitychange', onVis)

    // probe: sample the grid under the cursor
    const container = ctl.getContainer()
    let probeT = 0
    const onMove = (e) => {
      const now = performance.now(); if (now - probeT < 60) return; probeT = now
      const rect = container.getBoundingClientRect()
      const s = sample(e.clientX - rect.left, e.clientY - rect.top)
      propsRef.current.onProbe?.(s ? { ...s, clientX: e.clientX, clientY: e.clientY } : null)
    }
    const onLeave = () => propsRef.current.onProbe?.(null)
    container.addEventListener('mousemove', onMove); container.addEventListener('mouseleave', onLeave)

    return () => { stop(); clear(); offs.forEach(f => f()); document.removeEventListener('visibilitychange', onVis); container.removeEventListener('mousemove', onMove); container.removeEventListener('mouseleave', onLeave); propsRef.current.onProbe?.(null) }
  }, [mapCtl, stations, enabled, lite])

  return <canvas ref={canvasRef} data-testid="wind-canvas" className="pointer-events-none absolute inset-0 z-[500]" style={{ display: enabled ? 'block' : 'none' }} />
}
