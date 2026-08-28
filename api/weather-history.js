// Vercel serverless function: GET /api/weather-history
//
//   ?city=New%20Delhi&state=Delhi&days=30   → one city's daily series
//   ?runs=1                                 → list of refresh runs / available days
//
// Reads from Postgres when DATABASE_URL is configured; otherwise from the daily snapshot
// files the cron commits under public/data/history/ (fetched as static assets of this
// same deployment). Same handler logic is reused by the Vite dev middleware.
import { handleWeatherHistory } from './_lib/weatherHistoryApi.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed. Use GET.' })
  }
  const base = `https://${process.env.VERCEL_URL || req.headers.host}`
  const loadStatic = async (relPath) => {
    const r = await fetch(`${base}/${relPath}`, { headers: { accept: 'application/json' } })
    if (!r.ok) throw new Error(`static ${relPath} → HTTP ${r.status}`)
    return r.json()
  }
  const { status, body } = await handleWeatherHistory(req.query || {}, { loadStatic })
  res.setHeader('Cache-Control', 'public, max-age=300')
  return res.status(status).json(body)
}
