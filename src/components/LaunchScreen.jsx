import React, { useEffect, useRef, useState } from 'react'
import { readLite } from '../utils/liteMode'

// Lite mode (low-end devices): the starfield is drawn once, with no animation loop.
const LITE_AT_LOAD = readLite()

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


const LaunchScreen = ({ onSignIn }) => {
  const canvasRef = useRef(null)
  const starAnimRef = useRef(null)
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

  // Starfield background plus a hand-drawn wireframe globe with an orbiting
  // satellite — plain 2D canvas, no WebGL, no texture download. (A three.js
  // "Blue Marble" globe used to sit here: 1.7 MB of JavaScript, a 1.4 MB
  // texture and a permanent GPU render loop on the first screen, for a
  // decoration the sign-in card never depended on. Removed 5 Sept 2026.)
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

      if (wideScreen) {
        const cx = W * 0.62
        const cy = H * 0.52
        const R = Math.min(W, H) * 0.22

        for (let lat = -80; lat <= 80; lat += 20) {
          const y = R * Math.sin((lat * Math.PI) / 180)
          const rx = Math.sqrt(Math.max(0, R * R - y * y))
          ctx.beginPath()
          ctx.ellipse(cx, cy + y, rx, rx * 0.3, 0, 0, Math.PI * 2)
          ctx.strokeStyle = 'rgba(217,119,6,0.35)'
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
          ctx.strokeStyle = `rgba(217,119,6,${Math.cos(angle) > 0 ? 0.4 : 0.15})`
          ctx.lineWidth = 0.8
          ctx.stroke()
        }

        ctx.beginPath()
        ctx.arc(cx, cy, R, 0, Math.PI * 2)
        ctx.strokeStyle = 'rgba(217,119,6,0.5)'
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
        ctx.fillStyle = '#d97706'
        ctx.fillRect(-8, -3, 16, 6)
        ctx.fillStyle = '#22c55e'
        ctx.fillRect(-22, -2, 12, 4)
        ctx.fillRect(10, -2, 12, 4)
        ctx.restore()

        ctx.beginPath()
        ctx.setLineDash([4, 8])
        ctx.ellipse(cx, cy, orbitA, orbitB, 0, 0, Math.PI * 2)
        ctx.strokeStyle = 'rgba(217,119,6,0.15)'
        ctx.lineWidth = 1
        ctx.stroke()
        ctx.setLineDash([])
      }

      frame += 1
      // Lite mode: draw the stars once; no per-frame loop on low-end devices
      if (!LITE_AT_LOAD) animId = requestAnimationFrame(draw)
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
  }, [wideScreen])

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
    // Stop the starfield loop the instant sign-in starts so the dashboard
    // transition is not competing with a background animation.
    try { if (starAnimRef.current) cancelAnimationFrame(starAnimRef.current) } catch (e) {}
    starAnimRef.current = null
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

      <div style={{
        position: 'relative',
        zIndex: 10,
        width: '100%',
        maxWidth: '420px',
        background: 'rgba(13,21,40,0.92)',
        border: '1px solid #1a2a4a',
        borderRadius: '16px',
        backdropFilter: 'blur(10px)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.45)',
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
            <div style={{ fontSize: 28, fontWeight: 'bold', color: '#d97706', letterSpacing: 1 }}>BHASKAR OPS</div>
            <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 4, lineHeight: 1.5 }}>
              BHASKAR — Bharat Heat Analysis, Surveillance, Knowledge & Assessment Resource
            </div>
            <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 18, lineHeight: 1.5 }}>
              OPS — Optimization &amp; Planning System
            </div>
            <div style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'monospace', letterSpacing: 2, marginTop: 6 }}>
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
            <div style={{ color: '#dc2626', fontSize: 12, textAlign: 'center', fontFamily: 'monospace' }}>
              {authError}
            </div>
          )}

          {authSuccess && (
            <div style={{ color: '#22c55e', fontSize: 12, textAlign: 'center', fontFamily: 'monospace' }}>
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
                  style={{ background: 'none', border: 'none', padding: 0, color: '#d97706', cursor: 'pointer', fontSize: 12, fontWeight: 'bold' }}
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
                  style={{ background: 'none', border: 'none', padding: 0, color: '#d97706', cursor: 'pointer', fontSize: 12, fontWeight: 'bold' }}
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
