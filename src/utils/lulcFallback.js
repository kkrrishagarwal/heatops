// Extends the real ESA WorldCover classification (public/data/lulc_real.json, one
// representative city per state/UT — see scripts/build_lulc_data.py) to every city in the app
// without ever inventing a number for a city that has no real measurement.
//
// When the selected city has no entry of its own, this resolves the NEAREST real entry instead
// of just saying "not available":
//   - If the city has a precise coordinate (cityCoordinates.json), find the geographically
//     nearest of the 36 real LULC points by great-circle distance.
//   - If it doesn't (a town with no resolvable coordinate at all), fall back to that state's
//     designated representative city — guaranteed to exist for all 36 states/UTs (verified
//     1:1 against STATE_DATA).
// Either way the result is tagged isFallback:true with exactly which real city it borrowed
// from and how far away, so the UI can label it as an estimate rather than a direct
// measurement — same honesty standard as the existing real-vs-illustrative split in this app.
import { getExactCoordinates, haversineKm, STATE_REPRESENTATIVE_CITY } from './cityCoordinateResolver'

export function getLulcWithFallback(cityName, stateName, lulcReal, coordsData) {
  if (!lulcReal?.cities) return null

  // Matched by state too, not just name — STATE_DATA's city lists occasionally group an
  // NCR-style city under more than one state's list for user convenience (e.g. "Faridabad"
  // appears under both Haryana, where its real LULC entry actually is, AND Delhi). Matching
  // by name alone would silently pass off another state's real measurement as this city's own
  // under the wrong state label; requiring the state to match too means a mismatch correctly
  // falls through to the coordinate-based nearest-neighbor lookup below instead.
  const ownEntry = lulcReal.cities[cityName]
  if (ownEntry && ownEntry.state === stateName) {
    return { ...ownEntry, cityName, isFallback: false }
  }

  const ownCoords = coordsData && getExactCoordinates(coordsData, cityName, stateName)
  if (ownCoords) {
    let nearestCity = null
    let nearestDist = Infinity
    for (const [candidateCity, candidateEntry] of Object.entries(lulcReal.cities)) {
      const d = haversineKm(ownCoords.lat, ownCoords.lon, candidateEntry.lat, candidateEntry.lon)
      if (d < nearestDist) {
        nearestDist = d
        nearestCity = candidateCity
      }
    }
    if (nearestCity) {
      return {
        ...lulcReal.cities[nearestCity],
        cityName,
        isFallback: true,
        fallbackCity: nearestCity,
        fallbackState: lulcReal.cities[nearestCity].state,
        distanceKm: Math.round(nearestDist)
      }
    }
  }

  // No coordinate at all for this town — fall back to its own state's representative city.
  const repCity = stateName && STATE_REPRESENTATIVE_CITY[stateName]
  if (repCity && lulcReal.cities[repCity]) {
    return {
      ...lulcReal.cities[repCity],
      cityName,
      isFallback: true,
      fallbackCity: repCity,
      fallbackState: stateName,
      distanceKm: null
    }
  }

  return null
}
