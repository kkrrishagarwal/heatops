import React, { useEffect, useRef, useState } from 'react'
import Globe from 'react-globe.gl'
import { AmbientLight, DirectionalLight } from 'three'

const earthTexture = '/textures/earth-blue-marble.jpg'
const INDIA_COORDS = { lat: 20.5937, lng: 78.9629 }

// A real error boundary (the previous function-component version could never
// catch anything). If WebGL/three.js throws while rendering the globe, the
// login screen keeps working and shows `fallback` instead of going blank.
class GlobeErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { failed: false }
  }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(error) {
    console.warn('[IntroGlobe] globe failed to render, using fallback:', error?.message)
  }
  render() {
    return this.state.failed ? (this.props.fallback ?? null) : this.props.children
  }
}

// Decorative auto-rotating globe on the sign-in screen. It used to carry a
// "Skip" button and an intro zoom-to-India; the zoom was never triggered and
// Skip only stopped the spin, so both were removed (5 Sept 2026).
const IntroGlobe = ({
  active = true,
  style,
  className,
  width = 380,
  height = 380,
}) => {
  const globeRef = useRef(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    return () => setMounted(false)
  }, [])

  useEffect(() => {
    const globe = globeRef.current
    if (!globe || !mounted) return

    const controls = globe.controls()
    controls.autoRotate = active
    controls.autoRotateSpeed = 0.6
    controls.enableZoom = false
    controls.enablePan = false

    globe.lights([
      new AmbientLight(0xffffff, 2.2 * Math.PI),
      new DirectionalLight(0xffffff, 0.6 * Math.PI),
    ])

    globe.pointOfView({ lat: 12, lng: 50, altitude: 2.2 }, 1200)

    return () => globe.pauseAnimation?.()
  }, [active, mounted])

  if (!mounted) return null

  return (
    <div
      className={className}
      style={{
        pointerEvents: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        ...style,
      }}
    >
      <Globe
        ref={globeRef}
        width={width}
        height={height}
        globeImageUrl={earthTexture}
        backgroundColor="rgba(0,0,0,0)"
        atmosphereColor="#d97706"
        atmosphereAltitude={0.18}
        rendererConfig={{ antialias: false, powerPreference: 'low-power' }}
        pointsData={[INDIA_COORDS]}
        pointLat="lat"
        pointLng="lng"
        pointColor={() => '#d97706'}
        pointAltitude={0.01}
        pointRadius={0.5}
        ringsData={[INDIA_COORDS]}
        ringLat="lat"
        ringLng="lng"
        ringColor={() => (t) => `rgba(217,119,6,${1 - t})`}
        ringMaxRadius={6}
        ringPropagationSpeed={2}
        ringRepeatPeriod={1400}
      />
    </div>
  )
}

export default IntroGlobe
