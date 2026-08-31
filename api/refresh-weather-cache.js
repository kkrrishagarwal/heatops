// Vercel Cron target: GET /api/refresh-weather-cache — the daily FULL run (every city),
// scheduled at 09:00 UTC = 14:30 IST (peak heat) in vercel.json. Body lives in
// api/_lib/runRefresh.js, shared with the retry endpoint.
import { runRefresh } from './_lib/runRefresh.js'

export default function handler(req, res) {
  return runRefresh(req, res, { onlyCarried: false })
}
