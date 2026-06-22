import React, { useEffect, useState } from 'react'

const CustomCursor = () => {
  const [cursor, setCursor] = useState({ x: 0, y: 0 })
  const [laggedCursor, setLaggedCursor] = useState({ x: 0, y: 0 })
  const [isActive, setIsActive] = useState(false)

  useEffect(() => {
    const handleMouseMove = (e) => {
      setCursor({ x: e.clientX, y: e.clientY })
    }

    const handleMouseDown = () => setIsActive(true)
    const handleMouseUp = () => setIsActive(false)

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mousedown', handleMouseDown)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mousedown', handleMouseDown)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [])

  // Cursor lag effect
  useEffect(() => {
    let animationId

    const updateLag = () => {
      setLaggedCursor((prev) => ({
        x: prev.x + (cursor.x - prev.x) * 0.12,
        y: prev.y + (cursor.y - prev.y) * 0.12
      }))
      animationId = requestAnimationFrame(updateLag)
    }

    animationId = requestAnimationFrame(updateLag)

    return () => cancelAnimationFrame(animationId)
  }, [cursor])

  return (
    <>
      {/* Outer ring (lagged) */}
      <div
        className={`custom-cursor ${isActive ? 'active' : ''}`}
        style={{
          left: `${laggedCursor.x - 10}px`,
          top: `${laggedCursor.y - 10}px`
        }}
      />

      {/* Inner dot (exact) */}
      <div
        className="custom-cursor-dot"
        style={{
          left: `${cursor.x - 2}px`,
          top: `${cursor.y - 2}px`
        }}
      />
    </>
  )
}

export default CustomCursor
