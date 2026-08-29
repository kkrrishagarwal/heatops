import { useState, useEffect, useCallback } from 'react'

// Audience mode — WHO the dashboard is for. Independent of the Mobile/Laptop layout
// toggle (that is density; this is audience), so any combination works.
//
//   citizen   — plain-language essentials: city, temperature, a simple risk badge, a
//               safety tip, AQI as a category, Overview + "What to do" only
//   authority — the full technical dashboard (every badge, tab, model detail, calculator)
//
// First-time users are asked once (AudienceChooser, right after sign-in); the choice is
// stored in localStorage and reused. "Skip" on that screen means authority. A URL
// parameter ?view=authority|citizen sets it directly (shareable "direct link" access).

export const AUDIENCE_KEY = 'heatops_audience'
export const AUDIENCES = ['citizen', 'authority']

export function readStoredAudience() {
  try {
    const fromUrl = new URLSearchParams(window.location.search).get('view')
    if (AUDIENCES.includes(fromUrl)) {
      window.localStorage.setItem(AUDIENCE_KEY, fromUrl)
      return fromUrl
    }
    const v = window.localStorage.getItem(AUDIENCE_KEY)
    return AUDIENCES.includes(v) ? v : null
  } catch {
    return null
  }
}

export function storeAudience(mode) {
  if (!AUDIENCES.includes(mode)) return
  try { window.localStorage.setItem(AUDIENCE_KEY, mode) } catch { /* storage unavailable — session only */ }
  applyAudienceAttr(mode)
}

export function applyAudienceAttr(mode) {
  if (typeof document === 'undefined') return
  document.documentElement.setAttribute('data-audience', mode || 'citizen')
}

export function useAudienceMode() {
  // null = never chosen (the chooser screen handles that); the dashboard itself treats
  // null as citizen — simplicity first for anyone who somehow lands here unasked.
  const [stored, setStored] = useState(readStoredAudience)
  const audience = stored || 'citizen'

  useEffect(() => { applyAudienceAttr(audience) }, [audience])

  const setAudience = useCallback((mode) => {
    if (!AUDIENCES.includes(mode)) return
    setStored(mode)
    storeAudience(mode)
  }, [])

  return { audience, setAudience, hasChosen: !!stored }
}
