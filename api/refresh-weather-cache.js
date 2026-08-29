// Vercel Cron target: GET /api/refresh-weather-cache, scheduled once daily in vercel.json.
// Pulls fresh weather/AQI for all cities and commits the result straight to GitHub, which
// triggers the existing auto-redeploy — see api/_lib/refreshWeatherData.js and
// api/_lib/githubCommit.js for why each piece works the way it does.
import { refreshWeatherData } from './_lib/refreshWeatherData.js'
import { getCurrentCacheFile, getRepoJson, commitFiles } from './_lib/githubCommit.js'
import { buildSnapshot, updateIndex, historyFilePath, INDEX_PATH } from './_lib/weatherHistory.js'
import { isDbConfigured, saveRunToDb } from './_lib/weatherHistoryDb.js'

export default async function handler(req, res) {
  // Vercel automatically sends "Authorization: Bearer <CRON_SECRET>" on requests it makes to
  // this path when CRON_SECRET is set as an env var — verifying it stops a random visitor who
  // finds this URL from triggering repeated GitHub commits/redeploys on your behalf.
  const expected = process.env.CRON_SECRET
  const authHeader = req.headers['authorization']
  if (expected && authHeader !== `Bearer ${expected}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const startedAt = Date.now()
  try {
    const { cities: existingCities, lastUpdated: previousLastUpdated } = await getCurrentCacheFile()
    const { payload, batchCount, failedBatches, carriedForward } = await refreshWeatherData(existingCities, previousLastUpdated)

    // History tier 1: today's compact snapshot + updated index, committed together with
    // the cache in ONE commit (one deploy), so nothing about the existing pipeline changes.
    const snapshot = buildSnapshot(payload)
    const index = updateIndex(await getRepoJson(INDEX_PATH), snapshot)
    const commitResult = await commitFiles(
      [
        { path: 'public/live-weather-cache.json', content: JSON.stringify(payload) },
        { path: historyFilePath(snapshot.date), content: JSON.stringify(snapshot) },
        { path: INDEX_PATH, content: JSON.stringify(index, null, 2) }
      ],
      `Automated daily weather cache refresh — ${payload.lastUpdated}`
    )

    // History tier 2: Postgres, when DATABASE_URL is set. A database hiccup must never
    // fail the cache refresh itself, so it is logged and reported, not thrown.
    let db = null
    if (isDbConfigured()) {
      try {
        db = { ok: true, ...(await saveRunToDb(payload, { source: 'cron' })) }
      } catch (err) {
        console.error('[refresh-weather-cache] database write failed:', err.message)
        db = { ok: false, error: err.message }
      }
    }

    const durationSec = Math.round((Date.now() - startedAt) / 1000)
    console.log(`[refresh-weather-cache] OK in ${durationSec}s — ${payload.cityCount} cities, ${failedBatches}/${batchCount} batches failed, ${carriedForward} cities carried forward, commit ${commitResult.commit?.sha}, history day ${snapshot.date} (${index.days.length} days indexed), db ${db ? (db.ok ? `+${db.inserted} rows` : 'FAILED') : 'not configured'}`)
    return res.status(200).json({
      ok: true,
      cityCount: payload.cityCount,
      lastUpdated: payload.lastUpdated,
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
    console.error('[refresh-weather-cache] FAILED:', err.message)
    return res.status(500).json({ ok: false, error: err.message, durationSec })
  }
}
