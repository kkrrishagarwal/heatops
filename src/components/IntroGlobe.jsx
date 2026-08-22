import React, { useEffect, useRef, useState } from 'react'
import Globe from 'react-globe.gl'
import { AmbientLight, DirectionalLight } from 'three'

const earthTexture = '/textures/earth-blue-marble.jpg'
const INDIA_COORDS = { lat: 20.5937, lng: 78.9629 }

function GlobeErrorBoundary({ fallback, children }) {
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    // keep the boundary simple and safe for the login screen
  }, [])

  return failed ? fallback : children
}

const IntroGlobe = ({
  active = true,
  introTriggered = false,
  skipIntro = false,
  onZoomComplete,
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
    controls.autoRotate = active && !introTriggered && !skipIntro
    controls.autoRotateSpeed = 0.6
    controls.enableZoom = false
    controls.enablePan = false

    globe.lights([
      new AmbientLight(0xffffff, 2.2 * Math.PI),
      new DirectionalLight(0xffffff, 0.6 * Math.PI),
    ])

    if (!introTriggered && !skipIntro) {
      globe.pointOfView({ lat: 12, lng: 50, altitude: 2.2 }, 1200)
    }

    return () => globe.pauseAnimation?.()
  }, [active, introTriggered, mounted, skipIntro])

  useEffect(() => {
    const globe = globeRef.current
    if (!globe || !mounted) return

    if (skipIntro) {
      const controls = globe.controls()
      controls.autoRotate = false
      globe.pointOfView({ lat: INDIA_COORDS.lat, lng: INDIA_COORDS.lng, altitude: 0.28 }, 300)
      onZoomComplete?.()
      return
    }

    if (!introTriggered) return

    const controls = globe.controls()
    controls.autoRotate = false
    globe.pointOfView({ lat: INDIA_COORDS.lat, lng: INDIA_COORDS.lng, altitude: 0.28 }, 2000)

    const timer = setTimeout(() => {
      onZoomComplete?.()
    }, 2200)

    return () => clearTimeout(timer)
  }, [introTriggered, mounted, onZoomComplete, skipIntro])

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
        atmosphereColor="#00d4ff"
        atmosphereAltitude={0.18}
        rendererConfig={{ antialias: false, powerPreference: 'low-power' }}
        pointsData={[INDIA_COORDS]}
        pointLat="lat"
        pointLng="lng"
        pointColor={() => '#00ff88'}
        pointAltitude={0.01}
        pointRadius={0.5}
        ringsData={[INDIA_COORDS]}
        ringLat="lat"
        ringLng="lng"
        ringColor={() => (t) => `rgba(0,255,136,${1 - t})`}
        ringMaxRadius={6}
        ringPropagationSpeed={2}
        ringRepeatPeriod={1400}
      />
    </div>
  )
}

export default IntroGlobe
