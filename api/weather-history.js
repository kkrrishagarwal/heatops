// Vercel serverless function: GET /api/weather-history
//
//   ?city=New%20Delhi&state=Delhi&days=30   → one city's daily series
//   ?runs=1                                 → list of refresh runs / available days
//
// Reads from Postgres when DATABASE_URL is configured; otherwise from the daily snapshot
// files the cron commits under public/data/history/ (fetched as static assets of this
// same deployment). Same handler logic is reused by the Vite dev middleware.
import { readFile } from 'fs/promises'
import path from 'path'
import { handleWeatherHistory } from './_lib/weatherHistoryApi.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed. Use GET.' })
  }
  // The snapshot files are bundled into this function (vercel.json → includeFiles), so
  // read them from disk first. HTTP is only a fallback, and it must use the PUBLIC host the
  // request came in on — VERCEL_URL is the deployment-specific host, which sits behind
  // Vercel's deployment protection and answers 401 to server-side fetches.
  const publicHost = req.headers['x-forwarded-host'] || req.headers.host || process.env.VERCEL_PROJECT_PRODUCTION_URL
  const loadStatic = async (relPath) => {
    try {
      return JSON.parse(await readFile(path.join(process.cwd(), 'public', relPath), 'utf8'))
    } catch (fsErr) {
      const r = await fetch(`https://${publicHost}/${relPath}`, { headers: { accept: 'application/json' } })
      if (!r.ok) throw new Error(`static ${relPath} → HTTP ${r.status} (fs: ${fsErr.code || fsErr.message})`)
      return r.json()
    }
  }
  const { status, body } = await handleWeatherHistory(req.query || {}, { loadStatic })
  res.setHeader('Cache-Control', 'public, max-age=300')
  return res.status(status).json(body)
}
