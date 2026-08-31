// Vercel Cron target: GET /api/refresh-weather-cache-retry — runs ~90 minutes after the
// full run (10:30 UTC = 16:00 IST) and refetches ONLY the cities the full run had to carry
// forward because Open-Meteo rate-limited some batches. A much smaller request set (a few
// hundred cities at most), so it reliably fits the per-minute budget. Commits nothing when
// nothing was carried forward.
import { runRefresh } from './_lib/runRefresh.js'

export default function handler(req, res) {
  return runRefresh(req, res, { onlyCarried: true })
}
