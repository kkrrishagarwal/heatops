// Commits a new version of public/live-weather-cache.json directly to GitHub via the REST
// API. This is the only reliable way to update a STATIC asset on a Vercel static deployment —
// serverless functions have no persistent/writable disk across invocations, so the function
// can't just write the file locally and expect the live site to see it. Pushing a commit
// reuses the exact git-push -> Vercel-auto-redeploy pipeline already confirmed working for
// every other change in this project; no new storage service needed.
const OWNER = 'kkrrishagarwal'
const REPO = 'heatops'
const FILE_PATH = 'public/live-weather-cache.json'
const BRANCH = 'main'

function githubHeaders() {
  const token = process.env.GITHUB_TOKEN
  if (!token) throw new Error('GITHUB_TOKEN environment variable is not set')
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28'
  }
}

// Returns { sha, cities } — the current file's git blob SHA (required to update it) and its
// already-parsed cities object (used as the failure-safe baseline in refreshWeatherData).
export async function getCurrentCacheFile() {
  const res = await fetch(
    `https://api.github.com/repos/${OWNER}/${REPO}/contents/${FILE_PATH}?ref=${BRANCH}`,
    { headers: githubHeaders() }
  )
  if (!res.ok) throw new Error(`GitHub GET contents failed: ${res.status} ${await res.text()}`)
  const data = await res.json()
  const decoded = Buffer.from(data.content, 'base64').toString('utf8')
  let cities = {}
  try { cities = JSON.parse(decoded).cities || {} } catch {}
  return { sha: data.sha, cities }
}

export async function commitCacheFile(payload, sha) {
  const content = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64')
  const res = await fetch(
    `https://api.github.com/repos/${OWNER}/${REPO}/contents/${FILE_PATH}`,
    {
      method: 'PUT',
      headers: githubHeaders(),
      body: JSON.stringify({
        message: `Automated daily weather cache refresh — ${payload.lastUpdated}`,
        content,
        sha,
        branch: BRANCH
      })
    }
  )
  if (!res.ok) throw new Error(`GitHub PUT contents failed: ${res.status} ${await res.text()}`)
  return res.json()
}
