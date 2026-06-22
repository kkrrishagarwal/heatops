// Long-running process: calls refreshWeatherCache() every REFRESH_INTERVAL_MS.
// For local/dev use, run this directly: `node scripts/weatherCacheDaemon.mjs &`
// (or under pm2/systemd for a persistent server).
//
// For a production static deployment (Vercel/Netlify), this script's logic should instead run
// inside a scheduled serverless function (Vercel Cron / Netlify Scheduled Functions) that writes
// the same JSON shape to a small persistent store, since serverless functions don't keep a
// long-lived process or writable local disk across invocations.

import { refreshWeatherCache } from './refreshWeatherCache.mjs'

const REFRESH_INTERVAL_MS = 20 * 60 * 1000 // 20 minutes — well inside Open-Meteo's free-tier quota

async function tick() {
  const startedAt = Date.now()
  try {
    await refreshWeatherCache()
  } catch (err) {
    console.error('refresh failed:', err.message)
  }
  console.log(`tick took ${Math.round((Date.now() - startedAt) / 1000)}s — next run in ${REFRESH_INTERVAL_MS / 60000}min`)
}

console.log(`weatherCacheDaemon starting — refreshing every ${REFRESH_INTERVAL_MS / 60000} minutes`)
tick()
setInterval(tick, REFRESH_INTERVAL_MS)
