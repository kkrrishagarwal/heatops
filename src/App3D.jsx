import React, { useState, useEffect } from 'react'
import LaunchScreen from './components/LaunchScreen'
import CustomCursor from './components/CustomCursor'
// Navbar3D (old top navbar) removed — use CompactNavbar inside App
import App from './App'
import { createLoadingScreen } from './utils/3d-effects'
import '../src/3d-styles.css'

const App3D = () => {
  const [screen, setScreen] = useState('launch') // 'launch' or 'dashboard'
  const [user, setUser] = useState(null)

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
        <LaunchScreen onSignIn={handleSignIn} />
      </>
    )
  }

  // Dashboard with 3D enhancements
  return (
    <>
      <CustomCursor />
      <App user={user} />
    </>
  )
}

export default App3D
