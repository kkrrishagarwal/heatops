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
  let lastUpdated = null
  try {
    const parsed = JSON.parse(decoded)
    cities = parsed.cities || {}
    lastUpdated = parsed.lastUpdated || null
  } catch {}
  return { sha: data.sha, cities, lastUpdated }
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

// Fetches any repo file as parsed JSON (null when it doesn't exist yet) — used for the
// history index so a run can append its day to the list.
export async function getRepoJson(filePath) {
  const res = await fetch(
    `https://api.github.com/repos/${OWNER}/${REPO}/contents/${filePath}?ref=${BRANCH}`,
    { headers: githubHeaders() }
  )
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`GitHub GET ${filePath} failed: ${res.status} ${await res.text()}`)
  const data = await res.json()
  try { return JSON.parse(Buffer.from(data.content, 'base64').toString('utf8')) } catch { return null }
}

// Commits several files in ONE commit using the Git Data API (blobs → tree → commit → ref).
// The contents API used by commitCacheFile() can only write one file per commit, and every
// commit triggers a Vercel deploy — writing the cache + the day's history snapshot + the
// index as three commits would mean three deploys a night. Retries once on a non-fast-forward
// (someone pushed between reading the ref and updating it).
//
// files: [{ path: 'public/live-weather-cache.json', content: '<utf8 string>' }, ...]
// opts.dryRun: create blobs + tree but stop before the commit/ref update (safe API test)
export async function commitFiles(files, message, opts = {}) {
  const api = `https://api.github.com/repos/${OWNER}/${REPO}`
  const headers = { ...githubHeaders(), 'Content-Type': 'application/json' }
  const gh = async (method, url, body) => {
    const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined })
    if (!res.ok) throw new Error(`GitHub ${method} ${url.replace(api, '')} failed: ${res.status} ${await res.text()}`)
    return res.json()
  }
  for (let attempt = 1; attempt <= 2; attempt++) {
    const ref = await gh('GET', `${api}/git/ref/heads/${BRANCH}`)
    const parentSha = ref.object.sha
    const parent = await gh('GET', `${api}/git/commits/${parentSha}`)
    const tree = []
    for (const f of files) {
      const blob = await gh('POST', `${api}/git/blobs`, { content: f.content, encoding: 'utf-8' })
      tree.push({ path: f.path, mode: '100644', type: 'blob', sha: blob.sha })
    }
    const newTree = await gh('POST', `${api}/git/trees`, { base_tree: parent.tree.sha, tree })
    if (opts.dryRun) return { dryRun: true, parentSha, treeSha: newTree.sha, files: tree.map(t => t.path) }
    const commit = await gh('POST', `${api}/git/commits`, { message, tree: newTree.sha, parents: [parentSha] })
    const res = await fetch(`${api}/git/refs/heads/${BRANCH}`, { method: 'PATCH', headers, body: JSON.stringify({ sha: commit.sha, force: false }) })
    if (res.ok) return { commit: { sha: commit.sha }, files: tree.map(t => t.path) }
    const text = await res.text()
    if (attempt === 1 && (res.status === 422 || res.status === 409)) {
      console.warn(`[githubCommit] ref update rejected (${res.status}) — retrying once against the new head`)
      continue
    }
    throw new Error(`GitHub PATCH ref failed: ${res.status} ${text}`)
  }
}

