// Shared body of the two cron endpoints:
//   /api/refresh-weather-cache        — the daily full run (every city)
//   /api/refresh-weather-cache-retry  — a follow-up that refetches ONLY the cities the full
//                                        run had to carry forward (Open-Meteo rate-limits a
//                                        1,900-city burst from Vercel's shared egress IPs
//                                        often enough that 100–450 cities came back stale)
// Both verify CRON_SECRET, refresh, write cache + today's history snapshot + index in one
// GitHub commit, and optionally mirror to Postgres. The retry pass commits nothing when
// there is nothing to retry.
import { refreshWeatherData } from './refreshWeatherData.js'
import { getCurrentCacheFile, getRepoJson, commitFiles } from './githubCommit.js'
import { buildSnapshot, updateIndex, historyFilePath, INDEX_PATH } from './weatherHistory.js'
import { isDbConfigured, saveRunToDb } from './weatherHistoryDb.js'

export async function runRefresh(req, res, { onlyCarried = false } = {}) {
  // Vercel sends "Authorization: Bearer <CRON_SECRET>" on its own cron requests when the env
  // var is set — verifying it stops a random visitor from triggering commits/redeploys.
  const expected = process.env.CRON_SECRET
  const authHeader = req.headers['authorization']
  if (expected && authHeader !== `Bearer ${expected}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  const tag = onlyCarried ? 'refresh-weather-cache-retry' : 'refresh-weather-cache'
  const startedAt = Date.now()
  try {
    const { cities: existingCities, lastUpdated: previousLastUpdated } = await getCurrentCacheFile()
    const run = await refreshWeatherData(existingCities, previousLastUpdated, { onlyCarried })
    if (run.nothingToDo) {
      console.log(`[${tag}] nothing carried forward — no commit`)
      return res.status(200).json({ ok: true, skipped: true, reason: 'nothing carried forward' })
    }
    const { payload, batchCount, failedBatches, carriedForward, attempted, refreshed } = run

    const snapshot = buildSnapshot(payload)
    const index = updateIndex(await getRepoJson(INDEX_PATH), snapshot)
    const commitResult = await commitFiles(
      [
        { path: 'public/live-weather-cache.json', content: JSON.stringify(payload) },
        { path: historyFilePath(snapshot.date), content: JSON.stringify(snapshot) },
        { path: INDEX_PATH, content: JSON.stringify(index, null, 2) }
      ],
      onlyCarried
        ? `Automated weather cache retry — ${payload.lastUpdated} (${refreshed}/${attempted} carried-forward cities refreshed)`
        : `Automated daily weather cache refresh — ${payload.lastUpdated}`
    )

    let db = null
    if (isDbConfigured()) {
      try {
        db = { ok: true, ...(await saveRunToDb(payload, { source: onlyCarried ? 'cron-retry' : 'cron' })) }
      } catch (err) {
        console.error(`[${tag}] database write failed:`, err.message)
        db = { ok: false, error: err.message }
      }
    }

    const durationSec = Math.round((Date.now() - startedAt) / 1000)
    console.log(`[${tag}] OK in ${durationSec}s — ${payload.cityCount} cities, ${failedBatches}/${batchCount} batches failed, ${carriedForward} cities carried forward`)
    return res.status(200).json({
      ok: true,
      mode: onlyCarried ? 'retry' : 'full',
      cityCount: payload.cityCount,
      lastUpdated: payload.lastUpdated,
      attempted,
      refreshed,
      failedBatches,
      batchCount,
      carriedForward,
      commitSha: commitResult.commit?.sha,
      history: { date: snapshot.date, daysIndexed: index.days.length },
      db,
      durationSec
    })
  } catch (err) {
    const durationSec = Math.round((Date.now() - startedAt) / 1000)
    console.error(`[${tag}] FAILED:`, err.message)
    return res.status(500).json({ ok: false, error: err.message, durationSec })
  }
}
