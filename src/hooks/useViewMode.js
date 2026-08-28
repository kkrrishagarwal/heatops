import { useState, useEffect, useCallback } from 'react'

// View mode — "compact" (shown to users as 📱 Mobile: stacked panels, full-width
// map) vs "full" (💻 Laptop: side-by-side map + panels). It is a user choice
// independent of the device: the CSS keys
// off `html[data-view-mode]`, not media queries, so a phone can run Full and a
// desktop can run Compact. First visit auto-selects from the viewport width;
// once the user picks a mode it is stored and the auto rule stops applying.

export const VIEW_MODE_KEY = 'heatops_view_mode'
export const VIEW_MODES = ['compact', 'full']
const AUTO_BREAKPOINT_PX = 768

export function readStoredViewMode() {
  try {
    const v = window.localStorage.getItem(VIEW_MODE_KEY)
    return VIEW_MODES.includes(v) ? v : null
  } catch {
    return null // private mode / storage disabled — behave as "no choice yet"
  }
}

export function autoViewMode() {
  if (typeof window === 'undefined') return 'full'
  return window.innerWidth <= AUTO_BREAKPOINT_PX ? 'compact' : 'full'
}

// Stamped on <html> so every stylesheet rule can key off it. Called
// synchronously in main.jsx before the first render to avoid a flash of the
// wrong layout, then kept in sync by the hook below.
export function applyViewModeAttr(mode) {
  if (typeof document === 'undefined') return
  document.documentElement.setAttribute('data-view-mode', mode)
}

export function useViewMode() {
  const [stored, setStored] = useState(readStoredViewMode)
  const [auto, setAuto] = useState(autoViewMode)

  // Until the user chooses, follow the viewport (rotating a tablet, resizing a
  // window). After a choice, the stored value wins and resize is ignored.
  useEffect(() => {
    if (stored) return undefined
    const onResize = () => setAuto(autoViewMode())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [stored])

  const viewMode = stored || auto

  useEffect(() => {
    applyViewModeAttr(viewMode)
  }, [viewMode])

  const setViewMode = useCallback((mode) => {
    if (!VIEW_MODES.includes(mode)) return
    setStored(mode)
    try {
      window.localStorage.setItem(VIEW_MODE_KEY, mode)
    } catch {
      // storage unavailable — the choice still applies for this session
    }
  }, [])

  return { viewMode, setViewMode, isAuto: !stored }
}
