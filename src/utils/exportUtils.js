// SECTION 6 - EXPORT AND SHARE UTILITIES
//
// Every value in these exports must be real and traceable to an actual source, or shown
// as "N/A" — never a substituted estimate under a real-sounding label. realData below is
// expected to carry only genuinely real fields:
//   { surfaceTemp, elevation, aqi, humidity, windSpeed, vegetationPct, builtUpPct,
//     waterPct, lulcAvailable, mlR2, mlMae, mlAlgorithm }
// Callers should pass `null`/`undefined` for anything not actually available (e.g.
// vegetationPct for a city outside the 36-city ESA WorldCover set) rather than fabricate it.

function fmt(value, unit = '', decimals = null) {
  if (typeof value !== 'number' || Number.isNaN(value)) return 'N/A'
  const v = decimals === null ? value : value.toFixed(decimals)
  return `${v}${unit}`
}

// CSV download — one real summary row per city, not a fabricated pixel grid
export function downloadCSV(cityName, stateName, realData = {}) {
  const headers = [
    "city","state","surface_temp_c_live","elevation_m","aqi_live",
    "vegetation_pct","builtup_pct","water_pct",
    "ml_r2_score","ml_mae_c","source"
  ]

  const row = [
    cityName,
    stateName,
    fmt(realData.surfaceTemp, '', 1),
    fmt(realData.elevation, '', 0),
    fmt(realData.aqi),
    fmt(realData.vegetationPct),
    fmt(realData.builtUpPct),
    fmt(realData.waterPct),
    fmt(realData.mlR2),
    fmt(realData.mlMae, '', 2),
    "Open-Meteo (live) + ESA WorldCover 2021 (36 representative cities only)"
  ].join(",")

  const csv = [headers.join(","), row].join("\n")
  const blob = new Blob([csv], {type:"text/csv"})
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `${cityName.replace(/ /g,"_")}_bhaskarops_data.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// WhatsApp share — real values only, "N/A" where not available for this city
export function shareWhatsApp(cityName, stateName, realData = {}) {
  const msg =
    `🛰️ *BhaskarOps — ${cityName} Report*\n\n` +
    `📍 City: ${cityName}, ${stateName}\n` +
    `🌡️ Surface Temp: ${fmt(realData.surfaceTemp, '°C', 1)} (Open-Meteo, live)\n` +
    `🌿 Vegetation: ${fmt(realData.vegetationPct, '%')} (ESA WorldCover)\n` +
    `🏗️ Built-up: ${fmt(realData.builtUpPct, '%')} (ESA WorldCover)\n` +
    `💧 Water: ${fmt(realData.waterPct, '%')} (ESA WorldCover)\n` +
    `😷 AQI: ${fmt(realData.aqi)} (Open-Meteo Air Quality / CAMS, live)\n` +
    `🏔️ Elevation: ${fmt(realData.elevation, 'm', 0)} (SRTM, via Open-Meteo)\n\n` +
    `🤖 *ML Model* (trained on real MODIS-derived global-cities data, not India-specific — see in-app disclosure)\n` +
    `R² Score: ${fmt(realData.mlR2)}\n` +
    `MAE: ${fmt(realData.mlMae, '°C', 2)}\n\n` +
    `📡 Data: Open-Meteo (live) + ESA WorldCover 2021\n` +
    `🔬 BAH 2026 | CCSU IMS Ghaziabad`

  window.open(
    `https://wa.me/?text=${encodeURIComponent(msg)}`,
    "_blank"
  )
}

// PDF Report Generator — real values only, explicit "Not available" where applicable
export async function generatePDF(cityName, stateName, realData = {}) {

  const lulcRow = (label, value) => `
    <tr><td>${label}</td>
        <td>${fmt(value, '%')}</td>
        <td>${typeof value === 'number' ? 'ESA WorldCover 10m (2021)' : 'Not available for this city'}</td></tr>`

  const reportHTML = `
<!DOCTYPE html>
<html>
<head>
  <title>BhaskarOps — ${cityName} Report</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      background: #fff; color: #000;
      padding: 40px; max-width: 800px;
      margin: 0 auto;
    }
    h1 { color: #c00; font-size: 22px; }
    h2 { color: #333; font-size: 16px;
         border-bottom: 2px solid #c00;
         padding-bottom: 6px; }
    .grid { display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px; margin: 20px 0; }
    .card { border: 1px solid #ddd;
            border-radius: 8px;
            padding: 16px; }
    .val { font-size: 28px; font-weight: 700;
           color: #c00; }
    .lbl { font-size: 11px; color: #666;
           text-transform: uppercase; }
    .src { font-size: 10px; color: #999;
           font-style: italic; }
    table { width: 100%;
            border-collapse: collapse; }
    td, th { padding: 8px 12px;
             border: 1px solid #ddd;
             text-align: left; }
    th { background: #f5f5f5; }
    .footer { margin-top: 40px;
              padding-top: 20px;
              border-top: 1px solid #ddd;
              font-size: 11px; color: #999; }
  </style>
</head>
<body>
  <h1>🛰️ BhaskarOps Urban Heat Island Report</h1>
  <p><b>City:</b> ${cityName}, ${stateName} |
     <b>Generated:</b> ${new Date().toLocaleDateString('en-IN')} |
     <b>BAH 2026</b></p>

  <h2>Live & Real Data Summary</h2>
  <div class="grid">
    <div class="card">
      <div class="lbl">Surface Temperature (live)</div>
      <div class="val">${fmt(realData.surfaceTemp, '°C', 1)}</div>
      <div class="src">Open-Meteo modeled ground temp — not satellite-measured LST</div>
    </div>
    <div class="card">
      <div class="lbl">Elevation</div>
      <div class="val">${fmt(realData.elevation, 'm', 0)}</div>
      <div class="src">SRTM 30m DEM, via Open-Meteo</div>
    </div>
    <div class="card">
      <div class="lbl">Air Quality Index (live)</div>
      <div class="val">${fmt(realData.aqi)}</div>
      <div class="src">Open-Meteo Air Quality (CAMS) — not CPCB</div>
    </div>
  </div>

  <h2>Land Cover (ESA WorldCover 10m, 2021)</h2>
  <table>
    <tr><th>Class</th><th>Value</th><th>Source</th></tr>
    ${lulcRow('Vegetation', realData.vegetationPct)}
    ${lulcRow('Built-up', realData.builtUpPct)}
    ${lulcRow('Water', realData.waterPct)}
  </table>
  ${typeof realData.vegetationPct !== 'number' ? '<p style="font-size:11px;color:#900">Real land-cover classification has only been computed for one representative city per state so far — not available for this specific city.</p>' : ''}

  <h2>ML Model Performance</h2>
  <table>
    <tr><th>Metric</th><th>Value</th></tr>
    <tr><td>Algorithm</td>
        <td>${realData.mlAlgorithm || 'RandomForestRegressor (n=100, seed=42)'}</td></tr>
    <tr><td>R² Score</td>
        <td>${fmt(realData.mlR2)}</td></tr>
    <tr><td>MAE</td>
        <td>${fmt(realData.mlMae, '°C', 2)}</td></tr>
    <tr><td>Training data</td>
        <td>Real MODIS-derived LST/NDVI/NDBI/Elevation, 20 global cities (2000–2018) —
            not India-specific; see in-app model disclosure</td></tr>
  </table>

  <div class="footer">
    <b>Data Sources:</b> Open-Meteo (live weather, AQI, elevation) | ESA WorldCover 10m 2021 (land cover, 36 representative cities)<br/>
    <b>Team:</b> CCSU IMS Ghaziabad | BAH 2026 Problem Statement: Urban Heat Island, Delhi NCR<br/>
</html>`

  const win = window.open("", "_blank")
  win.document.write(reportHTML)
  win.document.close()
  win.print()
}

// Text to speech function
export function speakText(text) {
  if(!window.speechSynthesis) {
    return false
  }
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(
    text.replace(/[*_#]/g, "")
  )
  utterance.rate = 0.9
  utterance.pitch = 1.0
  utterance.volume = 1.0

  const voices =
    window.speechSynthesis.getVoices()
  const english = voices.find(
    v => v.lang.startsWith("en")
  )
  if(english) utterance.voice = english

  window.speechSynthesis.speak(utterance)
  return true
}

// Stop text to speech
export function stopSpeaking() {
  if(window.speechSynthesis) {
    window.speechSynthesis.cancel()
  }
}
