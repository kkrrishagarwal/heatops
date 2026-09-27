// SECTION 14 - OPENSTREETMAP URBAN MORPHOLOGY (real, live, no auth)
//
// Queries the public Overpass API for real building counts within a fixed radius of a
// city's coordinates. Overpass is a free, shared community resource with no SLA — it can
// be slow or briefly unavailable under load, so this has a client-side timeout and the
// caller must treat a failure as "not available," never substitute an estimate.

// Two endpoints, tried in order. The main overpass-api.de instance started answering 406
// "Not Acceptable" to every query form (raw POST, form POST and GET alike) — verified
// 27 Sept 2026 — and a 406 carries no CORS headers, so in a browser it surfaces as a CORS
// error and the building-density card went permanently "unavailable". The kumi.systems
// mirror answers the identical query, so it stands in until the main instance recovers.
const OVERPASS_URLS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter'
]
const QUERY_TIMEOUT_MS = 12000
const RADIUS_M = 1000

async function runOverpass(query, signal) {
  let lastErr = null
  for (const url of OVERPASS_URLS) {
    try {
      const res = await fetch(url, { method: 'POST', body: query, signal })
      if (!res.ok) throw new Error(`Overpass API error: ${res.status}`)
      return await res.json()
    } catch (err) {
      if (signal?.aborted) throw err
      lastErr = err
    }
  }
  throw lastErr || new Error('Overpass unavailable')
}

export async function getBuildingDensity(lat, lon) {
  const query = `[out:json][timeout:10];(way["building"](around:${RADIUS_M},${lat},${lon}););out count;`

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), QUERY_TIMEOUT_MS)

  try {
    const data = await runOverpass(query, controller.signal)
    const countEl = data.elements?.find(e => e.type === 'count')
    const total = countEl ? parseInt(countEl.tags?.total ?? '0', 10) : null
    if (total === null || Number.isNaN(total)) throw new Error('Overpass response missing count')

    const areaSqKm = Math.PI * (RADIUS_M / 1000) ** 2
    return {
      buildingCount: total,
      radiusM: RADIUS_M,
      densityPerSqKm: Math.round(total / areaSqKm)
    }
  } finally {
    clearTimeout(timeoutId)
  }
}
