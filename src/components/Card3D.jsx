import React, { useEffect, useRef } from 'react'
import { create3DCardTilt } from '../utils/3d-effects'

const Card3D = ({ children, className = '', style = {}, ...props }) => {
  const cardRef = useRef(null)

  useEffect(() => {
    if (!cardRef.current) return
    const cleanup = create3DCardTilt(cardRef.current, {
      maxRotation: 8,
      scale: 1.02,
      perspective: 1000
    })
    return cleanup
  }, [])

  return (
    <div
      ref={cardRef}
      className={`glass-card ${className}`}
      style={{
        transition: 'transform 0.15s ease',
        ...style
      }}
      {...props}
    >
      <div className="shine" />
      <div style={{ position: 'relative', zIndex: 2 }}>
        {children}
      </div>
    </div>
  )
}

export default Card3D
