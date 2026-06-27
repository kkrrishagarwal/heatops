// Shared coordinate-resolution layer used by both the live weather pipeline (weatherAPI.js)
// and the LULC/satellite-data fallback (lulcFallback.js).
//
// Why this exists: the app covers 1,956 cities, but only 1,689 of them have a precise,
// state-disambiguated lat/lon already resolved offline (src/data/cityCoordinates.json, built
// by scripts/geocodeCities.mjs). The other 267 are small towns that Open-Meteo's geocoding API
// genuinely has zero listing for (verified directly — not a strictness/query-format issue).
// Before this fix, the live per-click weather fetch (weatherAPI.js) ignored the bundled
// coordinates entirely and re-geocoded by NAME ONLY on every request, with no state
// disambiguation — so a same-named city in the wrong state could silently return another
// city's real weather under the selected city's name (e.g. any of the 3 Indian "Bilaspur"s).
//
// STATE_REPRESENTATIVE_CITY mirrors the "one real-data city per state/UT" design already
// established for LULC (public/data/lulc_real.json, scripts/build_lulc_data.py) — reused here
// as the deterministic, always-available fallback target when a city has no coordinate of its
// own: every entry below is itself present in cityCoordinates.json with a precise lat/lon
// (verified), so this fallback never has a dead end.
export const STATE_REPRESENTATIVE_CITY = {
  "Andaman and Nicobar Islands": "Port Blair",
  "Andhra Pradesh": "Visakhapatnam",
  "Arunachal Pradesh": "Itanagar",
  "Assam": "Guwahati",
  "Bihar": "Patna",
  "Chandigarh": "Chandigarh",
  "Chhattisgarh": "Raipur",
  "Dadra and Nagar Haveli and Daman and Diu": "Silvassa",
  "Delhi": "New Delhi",
  "Goa": "Panaji",
  "Gujarat": "Ahmedabad",
  "Haryana": "Faridabad",
  "Himachal Pradesh": "Shimla",
  "Jammu and Kashmir": "Jammu",
  "Jharkhand": "Ranchi",
  "Karnataka": "Bengaluru",
  "Kerala": "Thiruvananthapuram",
  "Ladakh": "Leh",
  "Lakshadweep": "Kavaratti",
  "Madhya Pradesh": "Bhopal",
  "Maharashtra": "Mumbai",
  "Manipur": "Imphal",
  "Meghalaya": "Shillong",
  "Mizoram": "Aizawl",
  "Nagaland": "Kohima",
  "Odisha": "Bhubaneswar",
  "Puducherry": "Puducherry",
  "Punjab": "Ludhiana",
  "Rajasthan": "Jaipur",
  "Sikkim": "Gangtok",
  "Tamil Nadu": "Chennai",
  "Telangana": "Hyderabad",
  "Tripura": "Agartala",
  "Uttar Pradesh": "Lucknow",
  "Uttarakhand": "Dehradun",
  "West Bengal": "Kolkata"
}

// Module-level so every caller (weatherAPI.js, lulcFallback.js, components) shares one fetch.
let coordsPromise = null
export function loadCityCoordinates() {
  if (!coordsPromise) {
    coordsPromise = fetch('/data/cityCoordinates.json')
      .then(r => r.json())
      .catch(() => ({}))
  }
  return coordsPromise
}

export function getExactCoordinates(coordsData, cityName, stateName) {
  return coordsData?.[`${cityName}|${stateName}`] || null
}

// Haversine great-circle distance in km — used to find the real LULC data point nearest a
// city that doesn't have its own classification yet.
export function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}
