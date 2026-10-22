import { useEffect, useState, useCallback } from 'react'

// Operating mode for the administrative platform (replaces the old Citizen / Authority switch):
//   disaster — Disaster Command (SDMA / NDMA): heat-risk triage, alerts, interventions
//   power    — Power Grid & Electricity Load: the Heat + Power workspace and grid layers
// Shared across components through one module-level value + an event, remembered per browser.
const KEY = 'bhaskarops_ops_mode'
const EVT = 'bhaskarops:opsmode'
export const OPS_MODES = ['disaster', 'power']
let current = (() => { try { const v = localStorage.getItem(KEY); return OPS_MODES.includes(v) ? v : 'disaster' } catch { return 'disaster' } })()

export function setOpsMode(mode) {
  if (!OPS_MODES.includes(mode) || mode === current) return
  current = mode
  try { localStorage.setItem(KEY, mode) } catch { /* private mode */ }
  window.dispatchEvent(new CustomEvent(EVT, { detail: mode }))
}

export function useOpsMode() {
  const [mode, setMode] = useState(current)
  useEffect(() => { const on = e => setMode(e.detail); window.addEventListener(EVT, on); return () => window.removeEventListener(EVT, on) }, [])
  return [mode, useCallback(m => setOpsMode(m), [])]
}
