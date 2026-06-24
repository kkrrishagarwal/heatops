import React, { useEffect, useRef } from 'react'

// Previously used React state (setCursor/setLaggedCursor) for position tracking,
// which meant every single mousemove event triggered a re-render, and the lag
// animation's useEffect had `cursor` as a dependency — so it tore down and
// restarted a requestAnimationFrame loop on every pixel of mouse movement. That
// was the actual cause of the reported cursor lag/jank, not just the visual
// "lag" effect by design. Now everything is refs + direct style mutation, with
// one persistent rAF loop for the component's lifetime — zero React re-renders
// in the hot path.
const CustomCursor = () => {
  const outerRef = useRef(null)
  const dotRef = useRef(null)
  const targetRef = useRef({ x: 0, y: 0 })
  const laggedRef = useRef({ x: 0, y: 0 })

  useEffect(() => {
    const handleMouseMove = (e) => {
      targetRef.current.x = e.clientX
      targetRef.current.y = e.clientY
      if (dotRef.current) {
        dotRef.current.style.left = `${e.clientX - 2}px`
        dotRef.current.style.top = `${e.clientY - 2}px`
      }
    }
    const handleMouseDown = () => outerRef.current?.classList.add('active')
    const handleMouseUp = () => outerRef.current?.classList.remove('active')

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mousedown', handleMouseDown)
    window.addEventListener('mouseup', handleMouseUp)

    // Outer ring now tracks the cursor 1:1 (no trailing interpolation) — the previous
    // 0.12 lag factor created a deliberate slow-follow trail that read as "laggy" on a
    // live demo even though it was a design choice, not a performance issue.
    let animationId
    const updateLag = () => {
      const lag = laggedRef.current
      const target = targetRef.current
      lag.x = target.x
      lag.y = target.y
      if (outerRef.current) {
        outerRef.current.style.left = `${lag.x - 10}px`
        outerRef.current.style.top = `${lag.y - 10}px`
      }
      animationId = requestAnimationFrame(updateLag)
    }
    animationId = requestAnimationFrame(updateLag)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mousedown', handleMouseDown)
      window.removeEventListener('mouseup', handleMouseUp)
      cancelAnimationFrame(animationId)
    }
  }, [])

  return (
    <>
      {/* Outer ring (lagged) */}
      <div ref={outerRef} className="custom-cursor" />
      {/* Inner dot (exact) */}
      <div ref={dotRef} className="custom-cursor-dot" />
    </>
  )
}

export default CustomCursor
