// Transport-independent logic for GET /api/weather-history (used by the Vercel function
// and the Vite dev middleware). `loadStatic(relPath)` must return parsed JSON for a
// repo-relative static file such as "data/history/index.json".
import { isDbConfigured, queryCityHistory, listRuns } from './weatherHistoryDb.js'
import { cityHistoryFromSnapshots } from './weatherHistory.js'

export async function handleWeatherHistory(query, { loadStatic }) {
  const city = typeof query.city === 'string' ? query.city.trim() : ''
  const state = typeof query.state === 'string' ? query.state.trim() : ''
  const days = Math.max(1, Math.min(parseInt(query.days, 10) || 30, 366))
  const wantRuns = query.runs === '1' || query.runs === 'true'

  if (!city && !wantRuns) {
    return { status: 400, body: { error: 'Pass ?city=<name>[&state=<state>][&days=30] or ?runs=1' } }
  }

  // ── Tier 2: database ──
  if (isDbConfigured()) {
    try {
      if (wantRuns) {
        return { status: 200, body: { source: 'postgres', runs: await listRuns({ limit: 400 }) } }
      }
      const points = await queryCityHistory({ city, state, days })
      return { status: 200, body: { source: 'postgres', city, state: state || null, days, points } }
    } catch (err) {
      console.error('[weather-history] database query failed, falling back to snapshots:', err.message)
    }
  }

  // ── Tier 1: snapshot files ──
  let index
  try {
    index = await loadStatic('data/history/index.json')
  } catch (err) {
    return { status: 503, body: { error: 'No weather history available yet (no database configured and no snapshot index found).', detail: err.message } }
  }
  if (wantRuns) {
    return { status: 200, body: { source: 'snapshots', runs: (index.days || []).map(d => ({ observedAt: d.lastUpdated, date: d.date, cityCount: d.cityCount, source: 'snapshot' })).reverse() } }
  }
  const points = await cityHistoryFromSnapshots(index, { city, state, days }, day => loadStatic(`data/history/${day.file}`))
  return { status: 200, body: { source: 'snapshots', city, state: state || null, days, points } }
}
