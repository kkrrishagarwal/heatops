// SECTION 1 - CITY BASELINE DATA (illustrative, NOT a real data pipeline)
//
// getCityData() below is a city-name-seeded illustrative baseline, NOT real satellite/
// reanalysis/monitoring data. It still backs a few non-data-citing features deliberately
// left as-is (dashboard theme color, the heat-zone what-if simulator, the city-compare
// panel, and the spatial-recommendation area/cost estimate) — none of those present
// themselves as a real measurement. Anywhere a number is shown WITH a specific source
// citation (Satellite Indices panel, AI Analyst context, exports), the app uses real data
// instead — see liveWeather (Open-Meteo, fetched in App.jsx) for live surface temperature/
// elevation/AQI, and lulcReal (public/data/lulc_real.json, real ESA WorldCover
// classification) for vegetation/built-up/water fractions — falling back to an explicit
// "not available" rather than ever substituting a value from this file under a
// real-sounding label.
//
// A previous version of this file shipped a DATA_SOURCES map citing Landsat/Sentinel/
// ERA5/CPCB/GHSL for these seeded numbers; that was false and has been removed for the
// same reason the original fake Random Forest model was rebuilt on real data instead
// (see scripts/train_lst_model.py).

// State-level illustrative baseline (NOT a real measurement — see file header)
const STATE_DATA = {
  "Andhra Pradesh": { avgLST: 41, ndvi: 0.28, ndbi: 0.37, ndwi: -0.09, aqi: 130, elevation: 100 },
  "Arunachal Pradesh": { avgLST: 25, ndvi: 0.70, ndbi: 0.08, ndwi: 0.25, aqi: 35, elevation: 1500 },
  "Assam": { avgLST: 35, ndvi: 0.52, ndbi: 0.20, ndwi: 0.08, aqi: 85, elevation: 50 },
  "Bihar": { avgLST: 43, ndvi: 0.30, ndbi: 0.38, ndwi: -0.08, aqi: 190, elevation: 60 },
  "Chhattisgarh": { avgLST: 41, ndvi: 0.40, ndbi: 0.32, ndwi: -0.05, aqi: 130, elevation: 400 },
  "Delhi": { avgLST: 45.2, ndvi: 0.18, ndbi: 0.52, ndwi: -0.31, aqi: 287, elevation: 216 },
  "Goa": { avgLST: 34, ndvi: 0.50, ndbi: 0.22, ndwi: 0.08, aqi: 65, elevation: 50 },
  "Gujarat": { avgLST: 44, ndvi: 0.15, ndbi: 0.45, ndwi: -0.16, aqi: 175, elevation: 100 },
  "Haryana": { avgLST: 42, ndvi: 0.28, ndbi: 0.40, ndwi: -0.10, aqi: 175, elevation: 200 },
  "Himachal Pradesh": { avgLST: 28, ndvi: 0.62, ndbi: 0.12, ndwi: 0.18, aqi: 45, elevation: 1500 },
  "Jharkhand": { avgLST: 40, ndvi: 0.38, ndbi: 0.34, ndwi: -0.06, aqi: 145, elevation: 300 },
  "Karnataka": { avgLST: 38, ndvi: 0.38, ndbi: 0.32, ndwi: -0.04, aqi: 110, elevation: 600 },
  "Kerala": { avgLST: 32, ndvi: 0.58, ndbi: 0.18, ndwi: 0.12, aqi: 55, elevation: 100 },
  "Madhya Pradesh": { avgLST: 40, ndvi: 0.32, ndbi: 0.36, ndwi: -0.08, aqi: 135, elevation: 500 },
  "Maharashtra": { avgLST: 39, ndvi: 0.30, ndbi: 0.38, ndwi: -0.06, aqi: 145, elevation: 600 },
  "Manipur": { avgLST: 26, ndvi: 0.60, ndbi: 0.14, ndwi: 0.14, aqi: 48, elevation: 800 },
  "Meghalaya": { avgLST: 24, ndvi: 0.64, ndbi: 0.10, ndwi: 0.20, aqi: 42, elevation: 1000 },
  "Mizoram": { avgLST: 22, ndvi: 0.68, ndbi: 0.06, ndwi: 0.24, aqi: 35, elevation: 1200 },
  "Nagaland": { avgLST: 22, ndvi: 0.66, ndbi: 0.08, ndwi: 0.22, aqi: 40, elevation: 1300 },
  "Odisha": { avgLST: 40, ndvi: 0.40, ndbi: 0.30, ndwi: 0.02, aqi: 120, elevation: 100 },
  "Punjab": { avgLST: 41, ndvi: 0.28, ndbi: 0.38, ndwi: -0.12, aqi: 160, elevation: 250 },
  "Rajasthan": { avgLST: 44, ndvi: 0.12, ndbi: 0.48, ndwi: -0.32, aqi: 165, elevation: 300 },
  "Sikkim": { avgLST: 18, ndvi: 0.72, ndbi: 0.04, ndwi: 0.28, aqi: 30, elevation: 1800 },
  "Tamil Nadu": { avgLST: 38, ndvi: 0.32, ndbi: 0.36, ndwi: 0.02, aqi: 125, elevation: 200 },
  "Telangana": { avgLST: 42.1, ndvi: 0.24, ndbi: 0.45, ndwi: -0.12, aqi: 156, elevation: 500 },
  "Tripura": { avgLST: 28, ndvi: 0.58, ndbi: 0.16, ndwi: 0.10, aqi: 65, elevation: 100 },
  "Uttar Pradesh": { avgLST: 42, ndvi: 0.24, ndbi: 0.42, ndwi: -0.14, aqi: 210, elevation: 180 },
  "Uttarakhand": { avgLST: 30, ndvi: 0.55, ndbi: 0.15, ndwi: 0.16, aqi: 75, elevation: 1200 },
  "West Bengal": { avgLST: 37, ndvi: 0.42, ndbi: 0.28, ndwi: 0.06, aqi: 140, elevation: 50 },
  "Jammu and Kashmir": { avgLST: 28, ndvi: 0.48, ndbi: 0.20, ndwi: 0.10, aqi: 65, elevation: 1000 },
  "Ladakh": { avgLST: 15, ndvi: 0.32, ndbi: 0.08, ndwi: 0.04, aqi: 25, elevation: 3500 },
  "Chandigarh": { avgLST: 41, ndvi: 0.28, ndbi: 0.40, ndwi: -0.10, aqi: 175, elevation: 320 },
  "Puducherry": { avgLST: 34, ndvi: 0.36, ndbi: 0.34, ndwi: 0.08, aqi: 95, elevation: 10 },
  "Andaman and Nicobar Islands": { avgLST: 31, ndvi: 0.54, ndbi: 0.18, ndwi: 0.14, aqi: 50, elevation: 100 },
  "Lakshadweep": { avgLST: 30, ndvi: 0.48, ndbi: 0.16, ndwi: 0.16, aqi: 48, elevation: 5 },
  "Dadra and Nagar Haveli and Daman and Diu": { avgLST: 42, ndvi: 0.26, ndbi: 0.40, ndwi: -0.08, aqi: 140, elevation: 150 }
}

// Get city data with state-level calibrated calculation (illustrative — see file header)
function getCityData(cityName, stateName) {
  // Generate calibrated data for all cities using state baseline
  const stateBase = STATE_DATA[stateName] || {}
  const seed = cityName.split('')
    .reduce((a,c)=>a+c.charCodeAt(0),0)
  const s = (seed % 100) / 100

  return {
    lst:       parseFloat((
      (stateBase.avgLST||38) + s*4 - 2
    ).toFixed(1)),
    ndvi:      parseFloat((
      (stateBase.ndvi||0.3) + s*0.1 - 0.05
    ).toFixed(2)),
    ndbi:      parseFloat((
      (stateBase.ndbi||0.35) + s*0.1 - 0.05
    ).toFixed(2)),
    ndwi:      parseFloat((
      (stateBase.ndwi||-0.1) + s*0.1 - 0.05
    ).toFixed(2)),
    elevation: Math.round(
      (stateBase.elevation||100) + s*50 - 25
    ),
    water_body_pct:   parseFloat((1+s*10).toFixed(1)),
    area_sqkm:        Math.round(50 + s*500)
  }
}

export {
  getCityData,
  STATE_DATA
}
