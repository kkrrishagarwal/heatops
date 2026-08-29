// Historic weather storage — tier 1: daily snapshot files committed to the repo.
//
// Every refresh of public/live-weather-cache.json used to overwrite the previous day, so
// the only "history" was git. Now each run also produces a compact snapshot for that day
// (public/data/history/YYYY-MM-DD.json) plus an index (public/data/history/index.json)
// listing every day available. These are plain static files, so the frontend and the
// /api/weather-history endpoint can read them with no database at all. When DATABASE_URL
// is configured the same run is additionally written to Postgres (weatherHistoryDb.js).
//
// Snapshot format (compact — ~60 KB/day instead of ~200 KB):
//   { date, lastUpdated, cityCount, fields: [...], cities: { "City|State": [temp, rainChance, aqi, cloudCover, pm10, carried] } }
// "carried": 0 = fresh reading that run, 1 = the refresh flagged it as carried forward
// (its Open-Meteo batch failed, previous values kept), 2 = inferred by the backfill (the
// whole reading was identical to the previous day's, in a run made before flagging existed).

export const HISTORY_DIR = 'public/data/history'
export const INDEX_PATH = `${HISTORY_DIR}/index.json`
export const SNAPSHOT_FIELDS = ['temp', 'rainChance', 'aqi', 'cloudCover', 'pm10', 'carried']
export const CARRIED_LABEL = { 0: null, 1: 'flagged', 2: 'inferred' }

export function snapshotDate(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid lastUpdated timestamp: ${iso}`)
  return d.toISOString().slice(0, 10) // UTC calendar day, same as the cron schedule
}

export function historyFilePath(date) {
  return `${HISTORY_DIR}/${date}.json`
}

// payload = { lastUpdated, cityCount, cities: { "City|State": {city,state,temp,...} } }
export function buildSnapshot(payload) {
  const cities = {}
  for (const [key, c] of Object.entries(payload.cities || {})) {
    cities[key] = SNAPSHOT_FIELDS.map(f => {
      if (f === 'carried') return c?.isCarriedForward === true ? 1 : c?.carriedForwardInferred === true ? 2 : 0
      return typeof c?.[f] === 'number' ? c[f] : null
    })
  }
  return {
    date: snapshotDate(payload.lastUpdated),
    lastUpdated: payload.lastUpdated,
    cityCount: Object.keys(cities).length,
    fields: SNAPSHOT_FIELDS,
    cities
  }
}

// Inverse of buildSnapshot — back to the live-cache object shape.
export function expandSnapshot(snapshot) {
  const fields = snapshot.fields || SNAPSHOT_FIELDS
  const cities = {}
  for (const [key, values] of Object.entries(snapshot.cities || {})) {
    const [city, state = ''] = key.split('|')
    const entry = { city, state }
    fields.forEach((f, i) => { if (f !== 'carried') entry[f] = values?.[i] ?? null })
    const carried = fields.includes('carried') ? (values?.[fields.indexOf('carried')] ?? 0) : 0
    entry.isCarriedForward = carried >= 1
    entry.carriedForwardSource = CARRIED_LABEL[carried] ?? null
    cities[key] = entry
  }
  return { lastUpdated: snapshot.lastUpdated, cityCount: Object.keys(cities).length, cities }
}

export function emptyIndex() {
  return { updatedAt: null, fields: SNAPSHOT_FIELDS, days: [] }
}

// Adds/replaces the entry for the snapshot's day (a re-run on the same day wins), keeps
// the list sorted by date ascending.
export function updateIndex(index, snapshot) {
  const base = index && Array.isArray(index.days) ? index : emptyIndex()
  const days = base.days.filter(d => d.date !== snapshot.date)
  days.push({ date: snapshot.date, file: `${snapshot.date}.json`, lastUpdated: snapshot.lastUpdated, cityCount: snapshot.cityCount })
  days.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  return { updatedAt: new Date().toISOString(), fields: SNAPSHOT_FIELDS, days }
}

// Pulls one city's series out of a set of snapshots (used by the read API when there is
// no database). `loadSnapshot(day)` resolves a snapshot object for an index entry.
export async function cityHistoryFromSnapshots(index, { city, state, days = 30 }, loadSnapshot) {
  const wanted = String(city || '').trim().toLowerCase()
  const wantedState = String(state || '').trim().toLowerCase()
  const entries = (index?.days || []).slice(-Math.max(1, Math.min(days, 366)))
  const points = []
  for (const day of entries) {
    let snap
    try { snap = await loadSnapshot(day) } catch { continue }
    if (!snap?.cities) continue
    let key = Object.keys(snap.cities).find(k => {
      const [c, s = ''] = k.toLowerCase().split('|')
      return c === wanted && (!wantedState || s === wantedState)
    })
    if (!key) continue
    const values = snap.cities[key]
    const fields = snap.fields || SNAPSHOT_FIELDS
    const point = { date: day.date, observedAt: snap.lastUpdated }
    fields.forEach((f, i) => { if (f !== 'carried') point[f] = values?.[i] ?? null })
    const carried = fields.includes('carried') ? (values?.[fields.indexOf('carried')] ?? 0) : 0
    point.isCarriedForward = carried >= 1
    point.carriedForwardSource = CARRIED_LABEL[carried] ?? null
    points.push(point)
  }
  return points
}
