// Vercel Cron target: GET /api/refresh-weather-cache, scheduled once daily in vercel.json.
// Pulls fresh weather/AQI for all cities and commits the result straight to GitHub, which
// triggers the existing auto-redeploy — see api/_lib/refreshWeatherData.js and
// api/_lib/githubCommit.js for why each piece works the way it does.
import { refreshWeatherData } from './_lib/refreshWeatherData.js'
import { getCurrentCacheFile, commitCacheFile } from './_lib/githubCommit.js'

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
    const { sha, cities: existingCities } = await getCurrentCacheFile()
    const { payload, batchCount, failedBatches } = await refreshWeatherData(existingCities)
    const commitResult = await commitCacheFile(payload, sha)
    const durationSec = Math.round((Date.now() - startedAt) / 1000)

    console.log(`[refresh-weather-cache] OK in ${durationSec}s — ${payload.cityCount} cities, ${failedBatches}/${batchCount} batches failed, commit ${commitResult.commit?.sha}`)
    return res.status(200).json({
      ok: true,
      cityCount: payload.cityCount,
      lastUpdated: payload.lastUpdated,
      failedBatches,
      batchCount,
      commitSha: commitResult.commit?.sha,
      durationSec
    })
  } catch (err) {
    const durationSec = Math.round((Date.now() - startedAt) / 1000)
    console.error('[refresh-weather-cache] FAILED:', err.message)
    return res.status(500).json({ ok: false, error: err.message, durationSec })
  }
}
