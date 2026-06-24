// SECTION 14 - OPENSTREETMAP URBAN MORPHOLOGY (real, live, no auth)
//
// Queries the public Overpass API for real building counts within a fixed radius of a
// city's coordinates. Overpass is a free, shared community resource with no SLA — it can
// be slow or briefly unavailable under load, so this has a client-side timeout and the
// caller must treat a failure as "not available," never substitute an estimate.

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter'
const QUERY_TIMEOUT_MS = 12000
const RADIUS_M = 1000

export async function getBuildingDensity(lat, lon) {
  const query = `[out:json][timeout:10];(way["building"](around:${RADIUS_M},${lat},${lon}););out count;`

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), QUERY_TIMEOUT_MS)

  try {
    const res = await fetch(OVERPASS_URL, {
      method: 'POST',
      body: query,
      signal: controller.signal
    })
    if (!res.ok) throw new Error(`Overpass API error: ${res.status}`)
    const data = await res.json()
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
