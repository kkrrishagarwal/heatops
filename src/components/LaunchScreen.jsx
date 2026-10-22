import React, { useEffect, useRef, useState, Component, Suspense, lazy } from 'react'
import { Flame, Eye, EyeOff } from 'lucide-react'
import SpaceScene from './SpaceScene'
import { readLite } from '../utils/liteMode'
import { parseJurisdiction, demoPasswordOk, DEMO_CREDENTIALS, jurisdictionName } from '../utils/jurisdiction'
import './LaunchScreen.css'

// The three.js / react-globe.gl bundle is fetched only when the 3D globe will actually be used.
const IntroGlobe = lazy(() => import('./IntroGlobe'))

// Sign-in / registration screen. The authentication logic below (validation, local account
// store, sign-in hand-off to App3D) is unchanged from the previous version; only the layout,
// accessibility and the decorative space scene are new. The scene is aria-hidden artwork and
// is never required to sign in: if WebGL is missing, the context is lost, the globe throws, or
// Lite mode is on, a static Earth image is shown instead and the form works the same.

// Lite mode (low-end devices): no WebGL globe at all — the static Earth stands in.
const LITE_AT_LOAD = readLite()
// ?globe=3d forces the WebGL globe (skips the software-renderer check and the frame-rate
// watchdog) and ?globe=static forces the static Earth — for testing and for demos.
const GLOBE_PARAM = (() => { try { return new URLSearchParams(window.location.search).get('globe') } catch { return null } })()

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

// react-globe.gl's WebGLRenderer throws synchronously if WebGL can't be created; this boundary
// scopes that failure to the globe so the rest of the login screen still works.
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
    this.props.onFail?.()
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

// A WebGL context that is really the CPU pretending to be a GPU (SwiftShader, llvmpipe,
// Microsoft Basic Render Driver, Mesa softpipe). Measured on this screen: the 3D globe kept the
// main thread busy 100 % of the time and the page ran at 3 fps on SwiftShader, against 6 % busy
// with the static Earth. Read from the renderer string, not the user-agent.
function isSoftwareRenderer() {
  try {
    const gl = document.createElement('canvas').getContext('webgl')
    if (!gl) return false
    const ext = gl.getExtension('WEBGL_debug_renderer_info')
    const name = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER) || '')
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    return /swiftshader|llvmpipe|softpipe|software|basic render/i.test(name)
  } catch {
    return false
  }
}

// Watch the real frame rate once the globe is up; if it cannot hold ~20 fps, report it so the
// static Earth takes over. Runs for 3 s only, then stops (no permanent rAF loop).
function watchFrameRate(onSlow, { ms = 3000, minFps = 20 } = {}) {
  let n = 0, raf = 0, stop = false
  const t0 = performance.now()
  const tick = () => {
    if (stop) return
    n++
    const dt = performance.now() - t0
    if (dt < ms) raf = requestAnimationFrame(tick)
    else if (n / (dt / 1000) < minFps && !document.hidden) onSlow(Math.round(n / (dt / 1000)))
  }
  raf = requestAnimationFrame(tick)
  return () => { stop = true; cancelAnimationFrame(raf) }
}

// prefers-reduced-motion and tab visibility, as state (changes rarely; never per frame).
function useMotionPrefs() {
  const [reduce, setReduce] = useState(() => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return false } })
  const [hidden, setHidden] = useState(() => typeof document !== 'undefined' && document.hidden)
  useEffect(() => {
    let mq = null
    try { mq = window.matchMedia('(prefers-reduced-motion: reduce)') } catch { /* old browser */ }
    const onMq = e => setReduce(e.matches)
    const onVis = () => setHidden(document.hidden)
    mq?.addEventListener?.('change', onMq)
    document.addEventListener('visibilitychange', onVis)
    return () => { mq?.removeEventListener?.('change', onMq); document.removeEventListener('visibilitychange', onVis) }
  }, [])
  return { reduce, hidden }
}

// Earth diameter from the viewport (recomputed on resize only).
function earthSizeFor(w, h) {
  if (w <= 560) return Math.round(Math.max(120, Math.min(h * 0.2, w * 0.42)))
  if (w <= 900) return Math.round(Math.max(160, Math.min(h * 0.27, 300)))
  const stageW = w * 0.56
  return Math.round(Math.max(260, Math.min(stageW * 0.58, h * 0.6, 620)))
}
// The globe camera sits 2.1 radii above the surface (fov 50°), so the sphere fills ~73 % of the
// canvas height; the canvas is sized so the sphere matches the orbit artwork and static Earth.
const SPHERE_FILL = 0.73

const LaunchScreen = ({ onSignIn }) => {
  const [webglOk] = useState(() => GLOBE_PARAM !== 'static' && isWebGLAvailable() && (GLOBE_PARAM === '3d' || !isSoftwareRenderer()))
  const [globeFailed, setGlobeFailed] = useState(false)
  const [globeReady, setGlobeReady] = useState(false)
  const [viewport, setViewport] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }))
  const { reduce, hidden } = useMotionPrefs()
  const [authTab, setAuthTab] = useState('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [authError, setAuthError] = useState('')
  const [authSuccess, setAuthSuccess] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const firstField = useRef(null)

  useEffect(() => {
    let raf = 0
    const onResize = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => setViewport({ w: window.innerWidth, h: window.innerHeight })) }
    window.addEventListener('resize', onResize)
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', onResize) }
  }, [])

  // Adaptive fallback: a globe that renders too slowly on this device is swapped for the
  // static Earth (checked once, after it first appears and while the tab is visible).
  useEffect(() => {
    if (!globeReady || globeFailed || GLOBE_PARAM === '3d') return
    let stopWatch = null
    // wait 1 s so texture upload and first-frame work are not counted
    const t = setTimeout(() => { stopWatch = watchFrameRate(fps => { console.info(`[LaunchScreen] globe at ${fps} fps — switching to the static Earth`); setGlobeFailed(true) }) }, 1000)
    return () => { clearTimeout(t); stopWatch?.() }
  }, [globeReady, globeFailed])

  // Jurisdiction demo accounts (central@ / up@ / rj@ … — see utils/jurisdiction.js) sign in
  // directly; every other email goes through the existing local account store below.
  const signInJurisdiction = (rawEmail, rawPassword) => {
    const j = parseJurisdiction(rawEmail)
    if (!j) return false
    if (!demoPasswordOk(rawPassword)) { setAuthError('Password must be at least 4 characters'); return true }
    setAuthError(''); setAuthSuccess('')
    setIsLoading(true)
    setTimeout(() => {
      setIsLoading(false)
      onSignIn({ name: jurisdictionName(j), email: rawEmail.trim().toLowerCase(), jurisdiction: j })
    }, 600)
    return true
  }
  const useCredential = (c) => {
    setAuthTab('login'); setEmail(c.email); setPassword(c.password); setAuthError(''); setAuthSuccess('')
    signInJurisdiction(c.email, c.password)
  }

  const handleSubmit = () => {
    if (authTab === 'login' && /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(email.trim()) && signInJurisdiction(email, password)) return
    if (!email || !password || (authTab === 'register' && !name)) {
      setAuthError('Please fill out all fields')
      return
    }
    // A real address, not "abc": local part, one @, a domain with a dot and a 2+ letter TLD.
    // Accounts are keyed by email, so a typo here silently creates a second account.
    const emailOk = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(email.trim())
    if (!emailOk) {
      setAuthError('Enter a valid email address, e.g. name@example.com')
      return
    }
    if (password.length < 6) {
      setAuthError('Password must be at least 6 characters')
      return
    }
    setAuthError('')
    setAuthSuccess('')

    const users = getStoredUsers()
    const cleanEmail = email.trim().toLowerCase()
    const existing = users.find((u) => u.email.toLowerCase() === cleanEmail)

    if (authTab === 'register') {
      if (existing) {
        setAuthError('An account with this email already exists — please Sign In')
        return
      }
      saveStoredUsers([
        ...users,
        { id: 'usr_' + Date.now(), name: name.trim(), email: cleanEmail, password: hashPassword(password), createdAt: new Date().toISOString() }
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

    // isLoading also pauses the globe and the scene, so no GPU work competes with the
    // dashboard transition (measured earlier: the globe kept the GPU busy otherwise).
    setIsLoading(true)
    setTimeout(() => {
      setIsLoading(false)
      onSignIn({ name: existing.name, email: existing.email })
    }, 800)
  }

  const switchTab = (tab) => { setAuthTab(tab); setAuthError(''); setAuthSuccess('') }
  const onSubmit = (e) => { e.preventDefault(); if (!isLoading) handleSubmit() }

  const motion = hidden || isLoading ? 'paused' : reduce ? 'still' : 'full'
  const compact = viewport.w <= 900
  const earthSize = earthSizeFor(viewport.w, viewport.h)
  const useGlobe = webglOk && (!LITE_AT_LOAD || GLOBE_PARAM === '3d') && !globeFailed
  const canvasSize = Math.round(earthSize / SPHERE_FILL)
  const staticEarth = <img className="ss-earth-static" data-testid="earth-static" src="/space/earth-india-720.webp" alt="" width="720" height="720" decoding="async" fetchpriority="high" onError={e => { e.currentTarget.removeAttribute('src') }} />
  const errId = authError ? 'auth-error' : undefined
  const invalid = authError ? 'true' : undefined

  return (
    <main className="ls-root" data-testid="launch-screen" data-motion={motion} data-earth={useGlobe ? (globeReady ? 'globe' : 'loading') : 'static'}>
      <SpaceScene motion={motion} compact={compact} earthSize={earthSize}>
        {/* Static Earth first: shown at once, and kept if the 3D globe is unavailable. */}
        <div style={{ position: 'absolute', inset: 0, opacity: useGlobe && globeReady ? 0 : 1, transition: 'opacity 0.6s ease' }}>{staticEarth}</div>
        {useGlobe && (
          <div style={{ position: 'absolute', left: '50%', top: '50%', width: canvasSize, height: canvasSize, transform: 'translate(-50%, -50%)', opacity: globeReady ? 1 : 0, transition: 'opacity 0.6s ease' }}>
            <GlobeErrorBoundary fallback={null} onFail={() => setGlobeFailed(true)}>
              <Suspense fallback={null}>
              <IntroGlobe
                active={motion !== 'paused'}
                still={motion === 'still'}
                width={canvasSize}
                height={canvasSize}
                onReady={() => setGlobeReady(true)}
                onFail={() => setGlobeFailed(true)}
              />
              </Suspense>
            </GlobeErrorBoundary>
          </div>
        )}
      </SpaceScene>

      {compact && <div className="ls-hero-spacer" aria-hidden="true" />}

      <section className="ls-panel" aria-labelledby="ls-title">
        <div className="ls-brand">
          <div className="ls-emblem" aria-hidden="true"><Flame size={24} strokeWidth={2.2} /></div>
          <div>
            <h1 id="ls-title" className="ls-name" style={{ margin: 0 }}>BHASKAR OPS</h1>
            <div className="ls-tag">URBAN HEAT ISLAND MONITORING SYSTEM</div>
          </div>
        </div>
        <p className="ls-desc">Heat-risk intelligence for Indian districts: <b>live readings for 1,932 cities</b>, NASA satellite surface temperature, a probabilistic heatwave forecast and an AI-written heat action plan.</p>
        <p className="ls-acronym">BHASKAR — Bharat Heat Analysis, Surveillance, Knowledge &amp; Assessment Resource · OPS — Optimization &amp; Planning System</p>

        <div className="ls-card">
          <div className="ls-tabs" role="tablist" aria-label="Account">
            <button type="button" role="tab" id="tab-login" aria-selected={authTab === 'login'} aria-controls="auth-form" className="ls-tab" onClick={() => switchTab('login')}>Sign In</button>
            <button type="button" role="tab" id="tab-register" aria-selected={authTab === 'register'} aria-controls="auth-form" className="ls-tab" onClick={() => switchTab('register')}>Register</button>
          </div>

          <form id="auth-form" className="ls-form" role="tabpanel" aria-labelledby={authTab === 'login' ? 'tab-login' : 'tab-register'} onSubmit={onSubmit} noValidate aria-busy={isLoading || undefined}>
            {authTab === 'register' && (
              <div className="ls-field">
                <label className="ls-label" htmlFor="auth-name">FULL NAME</label>
                <input id="auth-name" ref={firstField} className="ls-input" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter your name" autoComplete="name" aria-invalid={invalid} aria-describedby={errId} />
              </div>
            )}

            <div className="ls-field">
              <label className="ls-label" htmlFor="auth-email">EMAIL <span className="ls-hint">· a full address, e.g. name@example.com</span></label>
              <input id="auth-email" className="ls-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" autoComplete="email" inputMode="email" aria-invalid={invalid} aria-describedby={errId} />
            </div>

            <div className="ls-field">
              <label className="ls-label" htmlFor="auth-password">PASSWORD <span className="ls-hint">· at least 6 characters</span></label>
              <div className="ls-input-wrap">
                <input id="auth-password" className="ls-input ls-input-pw" type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete={authTab === 'register' ? 'new-password' : 'current-password'} aria-invalid={invalid} aria-describedby={errId} />
                <button type="button" className="ls-eye" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} data-testid="toggle-password">
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {authError && <div id="auth-error" role="alert" className="ls-msg ls-error">{authError}</div>}
            {authSuccess && <div role="status" className="ls-msg ls-success">{authSuccess}</div>}

            <button type="submit" className="ls-submit" disabled={isLoading}>
              {isLoading ? <><span className="ls-spin" aria-hidden="true" />SIGNING IN…</> : authTab === 'login' ? 'SIGN IN' : 'CREATE ACCOUNT'}
            </button>

            <div className="ls-switch">
              {authTab === 'login'
                ? <>Don't have an account? <button type="button" className="ls-link" onClick={() => switchTab('register')}>Register here</button></>
                : <>Already have an account? <button type="button" className="ls-link" onClick={() => switchTab('login')}>Sign In here</button></>}
            </div>
          </form>
        </div>
        <details className="ls-creds" open data-testid="demo-credentials">
          <summary>Demo credentials for judges · click a row to sign in</summary>
          <table>
            <thead><tr><th>Role</th><th>Email</th><th>Password</th></tr></thead>
            <tbody>
              {DEMO_CREDENTIALS.map(c => (
                <tr key={c.email} tabIndex={0} role="button" aria-label={`Sign in as ${c.label}`} onClick={() => useCredential(c)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); useCredential(c) } }} data-testid={`cred-${c.email.split('@')[0]}`}>
                  <td>{c.label}</td><td><code>{c.email}</code></td><td><code>{c.password}</code></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="ls-creds-note">Any state code also works, e.g. <code>mh@gmail.com</code> or <code>gj@bhaskarops.gov.in</code>. Master password <code>bhaskar2026</code>; demo accounts accept any password of 4+ characters.</div>
        </details>
        <p className="ls-foot">Accounts are stored in this browser only. Space artwork is decorative; satellite positions are not live.</p>
      </section>
    </main>
  )
}

export default LaunchScreen
