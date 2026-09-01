import React, { useState, useEffect, Suspense, lazy } from 'react'
import CustomCursor from './components/CustomCursor'
// Navbar3D (old top navbar) removed — use CompactNavbar inside App
import App from './App'
import AudienceChooser from './components/AudienceChooser'
import { readStoredAudience, storeAudience } from './hooks/useAudienceMode'
import { createLoadingScreen } from './utils/3d-effects'
import '../src/3d-styles.css'
import { readLite, applyLiteAttr } from './utils/liteMode'

// Stamp html[data-lite] before anything renders, so the sign-in screen and the map both
// get the low-end CSS (no blur/shadows/animations) from the first paint.
applyLiteAttr(readLite())

// Lazy-loaded so the react-globe.gl/three.js bundle (only used on the login
// screen) doesn't get pulled into the same chunk as the dashboard/map code —
// keeps the 3D globe additive without growing what every other screen has to load.
const LaunchScreen = lazy(() => import('./components/LaunchScreen'))

const App3D = () => {
  const [screen, setScreen] = useState('launch') // 'launch' or 'dashboard'
  const [user, setUser] = useState(null)
  // Asked once per browser: citizen vs authority view (see hooks/useAudienceMode.js)
  const [audienceChosen, setAudienceChosen] = useState(() => readStoredAudience() !== null)

  const handleSignIn = (userData) => {
    // Show loading screen
    createLoadingScreen(() => {
      setUser(userData)
      setScreen('dashboard')
    })
  }

  // Hide default cursor globally
  useEffect(() => {
    document.body.style.cursor = 'none'
    return () => {
      document.body.style.cursor = 'auto'
    }
  }, [])

  if (screen === 'launch') {
    return (
      <>
        <CustomCursor />
        <Suspense fallback={<div style={{ width: '100vw', height: '100vh', background: '#030712' }} />}>
          <LaunchScreen onSignIn={handleSignIn} />
        </Suspense>
      </>
    )
  }

  // Dashboard with 3D enhancements
  if (!audienceChosen) {
    return (
      <>
        <CustomCursor />
        <AudienceChooser
          userName={user?.name}
          onChoose={(mode) => { storeAudience(mode); setAudienceChosen(true) }}
        />
      </>
    )
  }
  return (
    <>
      <CustomCursor />
      <App user={user} />
    </>
  )
}

export default App3D
