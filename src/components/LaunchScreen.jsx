import React, { useEffect, useRef, useState, Component } from 'react'
import Globe from 'react-globe.gl'
import { AmbientLight, DirectionalLight } from 'three'

// Texture copied from three-globe's bundled examples into public/textures —
// three-globe's package.json "exports" map blocks importing it directly via
// JS import, so it's served as a plain static asset instead.
//
// earth-dark.jpg (the previous texture) is a near-black monochrome map meant
// for a night-mode look — with no scene lights of its own to compensate, that
// rendered as a barely-visible black globe. earth-blue-marble.jpg is NASA's
// Blue Marble imagery — real-looking blue oceans and green/brown landmasses.
const earthTexture = '/textures/earth-blue-marble.jpg'

// Centroid of India — used to place the highlight ring/point on the globe.
const INDIA_COORDS = { lat: 20.5937, lng: 78.9629 }

const USERS_KEY = 'heatops_users'

// Not real cryptographic security — this is a client-only localStorage demo
// with no backend/database, so there's nothing a real hash would protect
// against here. This just avoids writing the raw password string to disk.
function hashPassword(password) {
  let hash = 0
  for (let i = 0; i < password.length; i += 1) {
    hash = (hash << 5) - hash + password.charCodeAt(i)
    hash |= 0
  }
  return String(hash)
}

function getStoredUsers() {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY) || '[]')
  } catch {
    return []
  }
}

function saveStoredUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users))
}

// react-globe.gl's WebGLRenderer throws synchronously if WebGL can't be
// created (seen for real in VSCode's embedded "Simple Browser" webview, which
// has no GPU context) — and with no boundary, that uncaught error unmounts
// the ENTIRE app, not just the globe, since React 18 tears down the whole
// tree on an uncaught render/effect error. This boundary scopes the failure
// to just the globe so the rest of the login screen still works.
class GlobeErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { failed: false }
  }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(error) {
    console.warn('3D globe failed to render (likely no WebGL support), falling back:', error.message)
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

function isWebGLAvailable() {
  try {
    const canvas = document.createElement('canvas')
    return !!(window.WebGLRenderingContext && (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')))
  } catch {
    return false
  }
}

const LaunchScreen = ({ onSignIn }) => {
  const canvasRef = useRef(null)
  const globeRef = useRef(null)
  const starAnimRef = useRef(null)
  const [globeSize, setGlobeSize] = useState(380)
  const [webglOk] = useState(isWebGLAvailable)
  const [authTab, setAuthTab] = useState('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [authError, setAuthError] = useState('')
  const [authSuccess, setAuthSuccess] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [wideScreen, setWideScreen] = useState(false)

  useEffect(() => {
    const updateScreen = () => setWideScreen(window.innerWidth > 768)
    updateScreen()
    window.addEventListener('resize', updateScreen)
    return () => window.removeEventListener('resize', updateScreen)
  }, [])

  // Starfield background, always drawn. When WebGL isn't available (or the
  // <Globe> below throws), this also draws the original hand-drawn wireframe
  // globe + orbiting satellite as a fallback, per the explicit instruction to
  // keep that as a backup rather than show nothing.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    const stars = Array.from({ length: 200 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      r: Math.random() * 1.5 + 0.5,
      o: Math.random() * 0.7 + 0.3
    }))

    let frame = 0
    let animId

    const draw = () => {
      const W = canvas.width
      const H = canvas.height
      ctx.clearRect(0, 0, W, H)

      stars.forEach((s) => {
        ctx.beginPath()
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255,255,255,${s.o})`
        ctx.fill()
      })

      if (!webglOk) {
        const cx = W * 0.62
        const cy = H * 0.52
        const R = Math.min(W, H) * 0.22

        for (let lat = -80; lat <= 80; lat += 20) {
          const y = R * Math.sin((lat * Math.PI) / 180)
          const rx = Math.sqrt(Math.max(0, R * R - y * y))
          ctx.beginPath()
          ctx.ellipse(cx, cy + y, rx, rx * 0.3, 0, 0, Math.PI * 2)
          ctx.strokeStyle = 'rgba(0,212,255,0.35)'
          ctx.lineWidth = 0.8
          ctx.stroke()
        }

        for (let i = 0; i < 12; i += 1) {
          const angle = (i / 12) * Math.PI * 2 + frame * 0.008
          ctx.beginPath()
          for (let t = 0; t <= Math.PI * 2; t += 0.05) {
            const x3d = R * Math.cos(t) * Math.cos(angle)
            const y3d = R * Math.sin(t)
            const x2d = cx + x3d
            const y2d = cy + y3d * 0.5
            if (t === 0) ctx.moveTo(x2d, y2d)
            else ctx.lineTo(x2d, y2d)
          }
          ctx.strokeStyle = `rgba(0,212,255,${Math.cos(angle) > 0 ? 0.4 : 0.15})`
          ctx.lineWidth = 0.8
          ctx.stroke()
        }

        ctx.beginPath()
        ctx.arc(cx, cy, R, 0, Math.PI * 2)
        ctx.strokeStyle = 'rgba(0,212,255,0.5)'
        ctx.lineWidth = 1.5
        ctx.stroke()

        const orbitA = R * 1.45
        const orbitB = R * 0.55
        const satAngle = frame * 0.025
        const sx = cx + orbitA * Math.cos(satAngle)
        const sy = cy + orbitB * Math.sin(satAngle)

        ctx.save()
        ctx.translate(sx, sy)
        ctx.rotate(satAngle + Math.PI / 4)
        ctx.fillStyle = '#00d4ff'
        ctx.fillRect(-8, -3, 16, 6)
        ctx.fillStyle = '#00ff88'
        ctx.fillRect(-22, -2, 12, 4)
        ctx.fillRect(10, -2, 12, 4)
        ctx.restore()

        ctx.beginPath()
        ctx.setLineDash([4, 8])
        ctx.ellipse(cx, cy, orbitA, orbitB, 0, 0, Math.PI * 2)
        ctx.strokeStyle = 'rgba(0,212,255,0.15)'
        ctx.lineWidth = 1
        ctx.stroke()
        ctx.setLineDash([])
      }

      frame += 1
      animId = requestAnimationFrame(draw)
      // expose the current animation id so parent handlers (sign-in) can cancel
      // the starfield loop immediately when transitioning screens.
      starAnimRef.current = animId
    }

    draw()

    return () => {
      cancelAnimationFrame(animId)
      starAnimRef.current = null
      window.removeEventListener('resize', resize)
    }
  }, [webglOk])

  // Size the globe relative to viewport, same general footprint as the old canvas globe.
  useEffect(() => {
    const updateGlobeSize = () => {
      const size = Math.min(window.innerWidth, window.innerHeight) * (wideScreen ? 0.42 : 0.6)
      setGlobeSize(Math.max(240, Math.min(480, size)))
    }
    updateGlobeSize()
    window.addEventListener('resize', updateGlobeSize)
    return () => window.removeEventListener('resize', updateGlobeSize)
  }, [wideScreen])

  // Slow auto-rotation so the globe feels alive without requiring user interaction.
  // Explicit pauseAnimation() on cleanup as a belt-and-suspenders measure
  // alongside the library's own unmount destructor (see handleSubmit for the
  // main fix — pausing as soon as sign-in starts, not on eventual unmount).
  useEffect(() => {
    const globe = globeRef.current
    if (!globe) return
    const controls = globe.controls()
    controls.autoRotate = true
    controls.autoRotateSpeed = 0.6
    controls.enableZoom = false
    globe.pointOfView({ lat: 15, lng: 78, altitude: 2.2 })

    // react-globe.gl/three-render-objects default to NO scene lights (lights: []),
    // so with the earth-dark.jpg texture this rendered as an almost-unlit black
    // sphere. A strong ambient light keeps the whole globe visible regardless of
    // which side currently faces the (auto-rotating) camera, and a soft
    // directional light adds gentle shading so it still reads as 3D rather than
    // flat. Intensities use the Math.PI scaling three.js's physically-correct
    // lighting expects (same convention globe.gl's own internal default uses).
    globe.lights([
      new AmbientLight(0xffffff, 2.2 * Math.PI),
      new DirectionalLight(0xffffff, 0.6 * Math.PI)
    ])

    return () => globe.pauseAnimation?.()
  }, [])

  const handleSubmit = () => {
    if (!email || !password || (authTab === 'register' && !name)) {
      setAuthError('Please fill out all fields')
      return
    }
    setAuthError('')
    setAuthSuccess('')

    const users = getStoredUsers()
    const existing = users.find((u) => u.email.toLowerCase() === email.toLowerCase())

    if (authTab === 'register') {
      if (existing) {
        setAuthError('An account with this email already exists — please Sign In')
        return
      }
      saveStoredUsers([
        ...users,
        { id: 'usr_' + Date.now(), name, email, password: hashPassword(password), createdAt: new Date().toISOString() }
      ])
      setAuthSuccess('Account created! Please Sign In.')
      setAuthTab('login')
      setPassword('')
      return
    }

    // Sign In — never auto-creates an account.
    if (!existing) {
      setAuthError('No account found with this email — please Register first')
      return
    }
    if (existing.password !== hashPassword(password)) {
      setAuthError('Incorrect password')
      return
    }

    setIsLoading(true)
    // Stop the globe's render loop the instant sign-in starts, rather than
    // waiting for it to unmount ~3s later when createLoadingScreen's overlay
    // finishes — measured via a CDP trace that GPUTask stayed pegged at
    // 850-1000ms/sec for several seconds into the dashboard transition, and
    // the globe (invisible behind the opaque loading overlay this whole time
    // anyway) was the cause, confirmed by an A/B trace with it disabled.
    // stop any active animations immediately to avoid background CPU/GPU
    // work during the dashboard transition (starfield + three-globe loop).
    try { if (starAnimRef.current) cancelAnimationFrame(starAnimRef.current) } catch (e) {}
    starAnimRef.current = null
    globeRef.current?.pauseAnimation?.()
    setTimeout(() => {
      setIsLoading(false)
      onSignIn({ name: existing.name, email: existing.email })
    }, 800)
  }

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      position: 'relative',
      overflow: 'hidden',
      background: '#030712',
      display: 'flex',
      alignItems: 'center',
      justifyContent: wideScreen ? 'flex-start' : 'center'
    }}>
      <canvas ref={canvasRef} style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: 0,
        opacity: wideScreen ? 1 : 0.4
      }}/>

      {webglOk && (
        <div style={{
          position: 'absolute',
          top: '52%',
          left: '62%',
          transform: 'translate(-50%, -50%)',
          zIndex: 1,
          opacity: wideScreen ? 1 : 0.4,
          pointerEvents: 'none'
        }}>
          <GlobeErrorBoundary fallback={null}>
            <Globe
              ref={globeRef}
              width={globeSize}
              height={globeSize}
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
          </GlobeErrorBoundary>
        </div>
      )}

      <div style={{
        position: 'relative',
        zIndex: 10,
        width: '100%',
        maxWidth: '420px',
        background: 'rgba(13,21,40,0.92)',
        border: '1px solid #1a2a4a',
        borderRadius: '16px',
        backdropFilter: 'blur(10px)',
        boxShadow: '0 0 40px rgba(0,212,255,0.1)',
        margin: wideScreen ? '0 0 0 8%' : '0 16px'
      }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          width: '100%',
          padding: '32px',
          boxSizing: 'border-box'
        }}>
          <div style={{ textAlign: 'center', marginBottom: 8 }}>
            <div style={{ fontSize: 28, fontWeight: 'bold', color: '#00d4ff', letterSpacing: 1 }}>BHASKAR OPS</div>
            <div style={{ fontSize: 10, color: 'rgba(0,212,255,0.65)', marginTop: 4, lineHeight: 1.5 }}>
              BHASKAR — Bharat Heat Analysis, Surveillance, Knowledge & Assessment Resource
            </div>
            <div style={{ fontSize: 10, color: 'rgba(0,212,255,0.65)', marginTop: 18, lineHeight: 1.5 }}>
              OPS — Optimization &amp; Planning System
            </div>
            <div style={{ fontSize: 10, color: '#00d4ff', fontFamily: 'monospace', letterSpacing: 2, marginTop: 6 }}>
              URBAN HEAT ISLAND MONITORING SYSTEM
            </div>
          </div>

          <div style={{ display: 'flex', gap: 0, background: '#0a0f1e', borderRadius: 8, padding: 4 }}>
            <button
              type="button"
              onClick={() => { setAuthTab('login'); setAuthError(''); setAuthSuccess('') }}
              style={{
                flex: 1,
                padding: '8px',
                borderRadius: 6,
                border: 'none',
                background: authTab === 'login' ? 'var(--theme-accent)' : 'transparent',
                color: authTab === 'login' ? '#000' : '#64748b',
                cursor: 'pointer',
                fontSize: 13,
                transition: 'background 0.4s ease'
              }}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setAuthTab('register'); setAuthError(''); setAuthSuccess('') }}
              style={{
                flex: 1,
                padding: '8px',
                borderRadius: 6,
                border: 'none',
                background: authTab === 'register' ? 'var(--theme-accent)' : 'transparent',
                color: authTab === 'register' ? '#000' : '#64748b',
                cursor: 'pointer',
                fontSize: 13,
                transition: 'background 0.4s ease'
              }}
            >
              Register
            </button>
          </div>

          {authTab === 'register' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 11, color: '#64748b', fontFamily: 'monospace' }}>FULL NAME</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name"
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  background: '#0d1528',
                  border: '1px solid #1a2a4a',
                  borderRadius: 8,
                  color: '#e2e8f0',
                  fontSize: 14,
                  boxSizing: 'border-box',
                  outline: 'none'
                }}
              />
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 11, color: '#64748b', fontFamily: 'monospace' }}>EMAIL</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              style={{
                width: '100%',
                padding: '10px 14px',
                background: '#0d1528',
                border: '1px solid #1a2a4a',
                borderRadius: 8,
                color: '#e2e8f0',
                fontSize: 14,
                boxSizing: 'border-box',
                outline: 'none'
              }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 11, color: '#64748b', fontFamily: 'monospace' }}>PASSWORD</label>
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              style={{
                width: '100%',
                padding: '10px 14px',
                background: '#0d1528',
                border: '1px solid #1a2a4a',
                borderRadius: 8,
                color: '#e2e8f0',
                fontSize: 14,
                boxSizing: 'border-box',
                outline: 'none'
              }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{
                background: 'none',
                border: 'none',
                color: '#64748b',
                cursor: 'pointer',
                fontSize: 14,
                textAlign: 'left',
                padding: 0
              }}
            >
              {showPassword ? 'HIDE PASSWORD' : 'SHOW PASSWORD'}
            </button>
          </div>

          {authError && (
            <div style={{ color: '#ff4444', fontSize: 12, textAlign: 'center', fontFamily: 'monospace' }}>
              {authError}
            </div>
          )}

          {authSuccess && (
            <div style={{ color: '#00ff88', fontSize: 12, textAlign: 'center', fontFamily: 'monospace' }}>
              {authSuccess}
            </div>
          )}

          <button
            type="button"
            onClick={handleSubmit}
            style={{
              width: '100%',
              padding: '12px',
              background: 'linear-gradient(90deg, var(--theme-accent), #cc7a1a)',
              border: 'none',
              borderRadius: 8,
              color: '#000',
              fontSize: 15,
              fontWeight: 'bold',
              cursor: 'pointer',
              marginTop: 4,
              boxShadow: '0 0 20px var(--theme-glow)',
              transition: 'background 0.4s ease, box-shadow 0.4s ease'
            }}
          >
            {authTab === 'login' ? 'SIGN IN' : 'CREATE ACCOUNT'}
          </button>

          <div style={{ textAlign: 'center', fontSize: 12, color: '#64748b' }}>
            {authTab === 'login' ? (
              <>
                Don't have an account?{' '}
                <button
                  type="button"
                  onClick={() => { setAuthTab('register'); setAuthError(''); setAuthSuccess('') }}
                  style={{ background: 'none', border: 'none', padding: 0, color: '#00d4ff', cursor: 'pointer', fontSize: 12, fontWeight: 'bold' }}
                >
                  Register here
                </button>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => { setAuthTab('login'); setAuthError(''); setAuthSuccess('') }}
                  style={{ background: 'none', border: 'none', padding: 0, color: '#00d4ff', cursor: 'pointer', fontSize: 12, fontWeight: 'bold' }}
                >
                  Sign In here
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default LaunchScreen
