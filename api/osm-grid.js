// Vercel serverless function: GET /api/osm-grid?lat=26.91&lon=75.79
// Fetches OpenStreetMap power infrastructure (substations, lines) and industrial land around a
// point from the public Overpass API, server-side — Overpass blocks or throttles some client
// networks, and Vercel's egress is a different network. The response is cached by Vercel's CDN
// for a day per location, so each city costs Overpass one query per day at most.
// Geometry only: OpenStreetMap holds no loading or capacity data.
import { overpassQuery, parseOverpassGrid } from '../src/utils/heatPower.js'

const ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://overpass.private.coffee/api/interpreter']

export default async function handler(req, res) {
  const lat = Number(req.query?.lat), lon = Number(req.query?.lon)
  // India's bounding box only — this is not a general-purpose Overpass proxy.
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < 5 || lat > 38 || lon < 66 || lon > 99) {
    return res.status(400).json({ error: 'Pass ?lat=&lon= inside India.' })
  }
  const q = overpassQuery(Math.round(lat * 1000) / 1000, Math.round(lon * 1000) / 1000)
  const errors = []
  const started = Date.now()
  for (const url of ENDPOINTS) {
    const left = 55000 - (Date.now() - started)
    if (left < 5000) break
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), Math.min(25000, left))
    try {
      const r = await fetch(url, { method: 'POST', body: new URLSearchParams({ data: q }), headers: { 'User-Agent': 'BhaskarOps/1.0 (https://heatops.vercel.app)', Accept: 'application/json' }, signal: ctl.signal })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const grid = parseOverpassGrid(await r.json())
      res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800')
      return res.status(200).json({ ...grid, endpoint: url.split('/')[2], fetchedAt: new Date().toISOString() })
    } catch (e) { errors.push(`${url.split('/')[2]}: ${e.name === 'AbortError' ? 'timeout' : e.message}`) } finally { clearTimeout(t) }
  }
  res.setHeader('Cache-Control', 'no-store')
  return res.status(502).json({ error: 'Overpass unavailable', detail: errors })
}
