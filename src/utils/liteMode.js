// Lite mode — for low-end phones and slow connections. Auto-detected conservatively
// (≤ 3 GB device memory, ≤ 2 CPU cores, browser "Save-Data", or a 2G/3G connection) and
// switchable by hand (avatar menu / ☰ drawer); the choice is remembered per browser.
//
// What it changes: no 3D globe on the sign-in screen (skips the three.js bundle), the map
// draws state shapes only (no 594-district layer — the single biggest CPU cost on first
// paint), and CSS drops blur / shadows / animations (html[data-lite] rules in App.css).
// Nothing about the DATA changes — same cache, same readings, same honesty labels.
import { useState, useEffect, useCallback } from 'react'

export const LITE_KEY = 'heatops_lite'

export function detectLowEnd() {
  try {
    const n = navigator
    const conn = n.connection || n.mozConnection || n.webkitConnection
    if (conn?.saveData) return true
    if (/(^|[^a-z])(slow-2g|2g|3g)$/.test(String(conn?.effectiveType || ''))) return true
    if (typeof n.deviceMemory === 'number' && n.deviceMemory <= 3) return true
    if (typeof n.hardwareConcurrency === 'number' && n.hardwareConcurrency <= 2) return true
  } catch { /* no navigator hints — assume a normal device */ }
  return false
}

export function readLite() {
  try {
    const v = window.localStorage.getItem(LITE_KEY)
    if (v === 'on') return true
    if (v === 'off') return false
  } catch { /* storage unavailable */ }
  return detectLowEnd()
}

export function applyLiteAttr(on) {
  if (typeof document === 'undefined') return
  if (on) document.documentElement.setAttribute('data-lite', '1')
  else document.documentElement.removeAttribute('data-lite')
}

export function useLiteMode() {
  const [lite, setLiteState] = useState(readLite)
  useEffect(() => { applyLiteAttr(lite) }, [lite])
  const setLite = useCallback((on) => {
    setLiteState(!!on)
    try { window.localStorage.setItem(LITE_KEY, on ? 'on' : 'off') } catch { /* session only */ }
  }, [])
  return { lite, setLite, autoDetected: detectLowEnd() }
}
