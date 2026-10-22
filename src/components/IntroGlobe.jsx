import React, { useEffect, useRef, useState } from 'react'
import Globe from 'react-globe.gl'
import { AmbientLight, DirectionalLight } from 'three'

// 2048 px WebP of NASA Blue Marble (public/space, built by scripts/buildSpaceAssets.py) —
// a quarter of the 4096 px original's pixels, 172 KB instead of 1.46 MB.
const DEFAULT_TEXTURE = '/space/earth-2k.webp'
const DEFAULT_BUMP = '/space/earth-bump-1k.jpg'
const INDIA_COORDS = { lat: 20.5937, lng: 78.9629 }

// Decorative auto-rotating globe on the sign-in screen (react-globe.gl / three.js).
//   active   — rotate and render; false pauses the render loop entirely (tab hidden, signing in)
//   still    — render, but do not rotate (prefers-reduced-motion)
//   onFail   — called if the WebGL context is lost, so the parent can show the static Earth
// The India marker is a decorative highlight, not a measurement.
const IntroGlobe = ({
  active = true,
  still = false,
  style,
  className,
  width = 380,
  height = 380,
  textureUrl = DEFAULT_TEXTURE,
  bumpUrl = DEFAULT_BUMP,
  atmosphereColor = '#4FB3FF',
  onFail,
  onReady,
}) => {
  const globeRef = useRef(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    return () => setMounted(false)
  }, [])

  // One-time renderer setup: lights, camera on India, capped pixel ratio, context-loss watch.
  useEffect(() => {
    const globe = globeRef.current
    if (!globe || !mounted) return
    const controls = globe.controls()
    controls.enableZoom = false
    controls.enablePan = false
    controls.enableRotate = false
    globe.lights([
      new AmbientLight(0xffffff, 1.7 * Math.PI),
      new DirectionalLight(0xffffff, 1.0 * Math.PI),
    ])
    globe.pointOfView({ lat: 16, lng: 80, altitude: 2.1 }, 0)
    let renderer = null
    try {
      renderer = globe.renderer()
      // A 3× phone or 2× laptop screen would otherwise render 4–9× the pixels; 1.5 is sharp
      // enough for a decorative globe and keeps integrated GPUs cool.
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))
    } catch { /* renderer not ready */ }
    const canvas = renderer?.domElement
    const lost = e => { e.preventDefault?.(); onFail?.('context lost') }
    canvas?.addEventListener('webglcontextlost', lost)
    return () => canvas?.removeEventListener('webglcontextlost', lost)
  }, [mounted]) // eslint-disable-line react-hooks/exhaustive-deps

  // Motion: rotate slowly, hold still, or stop the render loop.
  useEffect(() => {
    const globe = globeRef.current
    if (!globe || !mounted) return
    const controls = globe.controls()
    controls.autoRotate = active && !still
    controls.autoRotateSpeed = 0.35
    if (active) globe.resumeAnimation?.()
    else globe.pauseAnimation?.()
  }, [active, still, mounted])

  if (!mounted) return null

  return (
    <div
      className={className}
      style={{ pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', ...style }}
    >
      <Globe
        ref={globeRef}
        onGlobeReady={() => onReady?.()}
        width={width}
        height={height}
        globeImageUrl={textureUrl}
        bumpImageUrl={bumpUrl}
        backgroundColor="rgba(0,0,0,0)"
        atmosphereColor={atmosphereColor}
        atmosphereAltitude={0.2}
        rendererConfig={{ antialias: false, powerPreference: 'low-power' }}
        pointsData={[INDIA_COORDS]}
        pointLat="lat"
        pointLng="lng"
        pointColor={() => '#F59E0B'}
        pointAltitude={0.01}
        pointRadius={0.5}
        ringsData={[INDIA_COORDS]}
        ringLat="lat"
        ringLng="lng"
        ringColor={() => (t) => `rgba(245,158,11,${1 - t})`}
        ringMaxRadius={6}
        ringPropagationSpeed={still ? 0 : 1.6}
        ringRepeatPeriod={1600}
      />
    </div>
  )
}

export default IntroGlobe
