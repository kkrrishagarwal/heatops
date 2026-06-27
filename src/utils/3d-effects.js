// 3D Effects and utilities for BhaskarOps

export const create3DCardTilt = (element, options = {}) => {
  const {
    maxRotation = 8,
    scale = 1.02,
    perspective = 1000
  } = options

  const handleMouseMove = (e) => {
    if (!element) return

    const rect = element.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const cx = rect.width / 2
    const cy = rect.height / 2

    const rotX = ((y - cy) / cy) * -maxRotation
    const rotY = ((x - cx) / cx) * maxRotation

    element.style.transform = `
      perspective(${perspective}px)
      rotateX(${rotX}deg)
      rotateY(${rotY}deg)
      scale(${scale})
    `

    // Shine effect
    const shine = element.querySelector('.shine')
    if (shine) {
      shine.style.background = `
        radial-gradient(
          circle at ${x}px ${y}px,
          rgba(255, 255, 255, 0.08) 0%,
          transparent 70%
        )
      `
    }
  }

  const handleMouseLeave = () => {
    if (!element) return
    element.style.transform =
      `perspective(${perspective}px) rotateX(0) rotateY(0) scale(1)`
  }

  element.addEventListener('mousemove', handleMouseMove)
  element.addEventListener('mouseleave', handleMouseLeave)

  return () => {
    element.removeEventListener('mousemove', handleMouseMove)
    element.removeEventListener('mouseleave', handleMouseLeave)
  }
}

export const particleBurst = (x, y, color = '#00ff88') => {
  const count = 20
  for (let i = 0; i < count; i++) {
    const particle = document.createElement('div')
    const angle = (i / count) * Math.PI * 2
    const speed = 60 + Math.random() * 60
    const size = 4 + Math.random() * 4

    particle.style.cssText = `
      position: fixed;
      left: ${x}px;
      top: ${y}px;
      width: ${size}px;
      height: ${size}px;
      background: ${color};
      border-radius: 50%;
      pointer-events: none;
      z-index: 9999;
      --dx: ${Math.cos(angle) * speed}px;
      --dy: ${Math.sin(angle) * speed}px;
    `

    const style = document.createElement('style')
    style.innerHTML = `
      @keyframes particle-fly-${i} {
        0% {
          transform: translate(0, 0);
          opacity: 1;
        }
        100% {
          transform: translate(var(--dx), var(--dy));
          opacity: 0;
        }
      }
    `
    document.head.appendChild(style)

    particle.style.animation = `particle-fly-${i} 0.8s ease-out forwards`
    document.body.appendChild(particle)

    setTimeout(() => {
      particle.remove()
      style.remove()
    }, 800)
  }
}

export const typewriterEffect = (text, callback) => {
  let index = 0
  const result = ''

  const interval = setInterval(() => {
    if (index < text.length) {
      callback(text.substring(0, index + 1))
      index++
    } else {
      clearInterval(interval)
    }
  }, 50)

  return () => clearInterval(interval)
}

export const createScanLine = () => {
  const line = document.createElement('div')
  line.style.cssText = `
    position: fixed;
    top: -2px;
    left: 0;
    right: 0;
    height: 2px;
    background: rgba(0, 255, 136, 0.3);
    filter: blur(4px);
    z-index: 5000;
    pointer-events: none;
    animation: scan-line-v 4s linear infinite;
  `
  document.body.appendChild(line)
  return () => line.remove()
}

export const countUpAnimation = (element, start, end, duration = 1000) => {
  const range = end - start
  const increment = range / (duration / 16)
  let current = start

  const interval = setInterval(() => {
    current += increment
    if (current >= end) {
      current = end
      clearInterval(interval)
    }
    element.textContent = Math.floor(current)
  }, 16)

  return () => clearInterval(interval)
}

export const heatPulseEffect = (element) => {
  const wrapper = document.createElement('div')
  wrapper.style.position = 'relative'

  // Create 3 concentric rings
  for (let i = 0; i < 3; i++) {
    const ring = document.createElement('div')
    const delay = i * 200

    ring.style.cssText = `
      position: absolute;
      inset: -20px;
      border: 2px solid rgba(255, 100, 0, 0.6);
      border-radius: 50%;
      animation: heat-pulse-${i + 1} 1.5s ease-out;
      animation-delay: ${delay}ms;
      animation-iteration-count: infinite;
      pointer-events: none;
    `

    wrapper.appendChild(ring)
  }

  element.style.position = 'relative'
  element.appendChild(wrapper)

  return () => wrapper.remove()
}

export const createLoadingScreen = (onComplete) => {
  const overlay = document.createElement('div')
  overlay.style.cssText = `
    position: fixed;
    inset: 0;
    background: #00000f;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    color: #00ff88;
    font-family: 'Courier New', monospace;
  `

  const messages = [
    'CONNECTING TO SATELLITES...',
    'LOADING URBAN HEAT DATA...',
    'CALIBRATING CLIMATE MODELS...',
    'LAUNCHING BHASKAROPS...'
  ]

  let messageIndex = 0
  const messageEl = document.createElement('div')
  messageEl.style.cssText = `
    font-size: 14px;
    text-align: center;
    height: 60px;
    display: flex;
    align-items: center;
    text-shadow: 0 0 10px #00ff88;
  `

  const progressBar = document.createElement('div')
  progressBar.style.cssText = `
    width: 200px;
    height: 4px;
    border: 1px solid #00ff88;
    margin-top: 30px;
    overflow: hidden;
    border-radius: 2px;
  `

  const progressFill = document.createElement('div')
  progressFill.style.cssText = `
    height: 100%;
    background: linear-gradient(90deg, #00ff88, #00d4ff);
    width: 0%;
    animation: loading-fill 2s ease-in-out forwards;
  `

  const style = document.createElement('style')
  style.innerHTML = `
    @keyframes loading-fill {
      0% { width: 0%; }
      100% { width: 100%; }
    }
  `

  document.head.appendChild(style)
  progressBar.appendChild(progressFill)
  overlay.appendChild(messageEl)
  overlay.appendChild(progressBar)
  document.body.appendChild(overlay)

  const messageInterval = setInterval(() => {
    if (messageIndex < messages.length) {
      messageEl.textContent = messages[messageIndex]
      messageIndex++
    } else {
      clearInterval(messageInterval)
      setTimeout(() => {
        overlay.style.animation = 'fade-out 0.5s ease-out forwards'
        setTimeout(() => {
          overlay.remove()
          style.remove()
          onComplete?.()
        }, 500)
      }, 300)
    }
  }, 500)

  const fadeStyle = document.createElement('style')
  fadeStyle.innerHTML = `
    @keyframes fade-out {
      0% { opacity: 1; }
      100% { opacity: 0; }
    }
  `
  document.head.appendChild(fadeStyle)
}

export const animateStaggeredCards = (cards, delay = 100) => {
  cards.forEach((card, index) => {
    card.style.animation = `slideIn 0.6s ease-out`
    card.style.animationDelay = `${index * delay}ms`
    card.style.animationFillMode = 'both'
  })
}
