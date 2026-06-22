const map = L.map('map', {
  center: [22.3511148, 78.6677428],
  zoom: 5,
  minZoom: 4,
  maxZoom: 8,
  zoomControl: false
})

const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map)

const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
  attribution: 'Tiles &copy; Esri'
})

const terrainLayer = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenTopoMap contributors'
})

const baseLayers = {
  'Standard': osmLayer,
  'Satellite': satelliteLayer,
  'Terrain': terrainLayer
}

const overlayLayers = {
  heat: null,
  districts: L.layerGroup().addTo(map),
  stations: L.layerGroup().addTo(map)
}

const tooltip = document.getElementById('tooltip')
const statusBadge = document.getElementById('statusBadge')
const searchInput = document.getElementById('searchInput')
const searchBtn = document.getElementById('searchBtn')
const themeToggle = document.getElementById('themeToggle')
const locateBtn = document.getElementById('locateBtn')
const zoomInBtn = document.getElementById('zoomInBtn')
const zoomOutBtn = document.getElementById('zoomOutBtn')
const resetBtn = document.getElementById('resetBtn')
const heatToggleBtn = document.getElementById('heatToggleBtn')
const borderToggleBtn = document.getElementById('borderToggleBtn')
const stationToggleBtn = document.getElementById('stationToggleBtn')
const satelliteToggleBtn = document.getElementById('satelliteToggleBtn')
const terrainToggleBtn = document.getElementById('terrainToggleBtn')
const fullscreenBtn = document.getElementById('fullscreenBtn')

const detailTitle = document.getElementById('detailTitle')
const detailSubtitle = document.getElementById('detailSubtitle')
const detailTemp = document.getElementById('detailTemp')
const detailHumidity = document.getElementById('detailHumidity')
const detailWind = document.getElementById('detailWind')
const detailAqi = document.getElementById('detailAqi')
const detailRain = document.getElementById('detailRain')
const detailSunrise = document.getElementById('detailSunrise')
const detailSunset = document.getElementById('detailSunset')
const forecastList = document.getElementById('forecastList')

let districtLayer = null
let districtFeatures = []
let allMarkers = []
let selectedMarker = null
let activeHeat = true
let activeBounds = true
let activeStations = true
let currentMode = 'dark'

function formatTime(value) {
  if (!value) return '--'
  const date = new Date(value)
  return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}

function formatWeatherCode(code) {
  const map = {
    0: 'Clear',
    1: 'Mainly clear',
    2: 'Partly cloudy',
    3: 'Overcast',
    45: 'Fog',
    48: 'Depositing rime fog',
    51: 'Drizzle',
    53: 'Moderate drizzle',
    55: 'Dense drizzle',
    61: 'Rain',
    63: 'Heavy rain',
    65: 'Storm rain',
    71: 'Snow',
    73: 'Heavy snow',
    75: 'Snowstorm',
    80: 'Rain showers',
    81: 'Heavy rain showers',
    95: 'Thunderstorm'
  }
  return map[code] || 'Variable clouds'
}

function getHeatColor(temp) {
  if (temp <= 5) return '#0b3d91'
  if (temp <= 15) return '#3a8fd1'
  if (temp <= 25) return '#2db76b'
  if (temp <= 33) return '#f2c631'
  if (temp <= 40) return '#f28d2d'
  return '#d84a39'
}

function setStatus(message) {
  statusBadge.textContent = message
}

function setTheme(mode) {
  currentMode = mode
  document.body.classList.toggle('light-mode', mode === 'light')
  document.body.classList.toggle('dark-mode', mode === 'dark')
  themeToggle.textContent = mode === 'dark' ? 'Light mode' : 'Dark mode'
}

function showTooltip(event, html) {
  tooltip.innerHTML = html
  tooltip.style.left = `${event.containerPoint.x + 14}px`
  tooltip.style.top = `${event.containerPoint.y + 14}px`
  tooltip.classList.remove('hidden')
}

function hideTooltip() {
  tooltip.classList.add('hidden')
}

function updateDetailPanel(data) {
  detailTitle.textContent = `${data.district}, ${data.state}`
  detailSubtitle.textContent = 'Current conditions from district station'
  detailTemp.textContent = `${data.weather.current.temperature ?? '--'}°C`
  detailHumidity.textContent = `${data.weather.hourly.relativehumidity_2m?.[0] ?? '--'}%`
  detailWind.textContent = `${data.weather.current.windspeed ?? '--'} km/h`
  detailAqi.textContent = data.weather.aqi?.hourly?.pm2_5?.length ? `${Math.round(data.weather.aqi.hourly.pm2_5[0])}` : '--'
  detailRain.textContent = `${data.weather.hourly.precipitation_probability?.[0] ?? '--'}%`
  detailSunrise.textContent = formatTime(data.weather.daily.sunrise?.[0])
  detailSunset.textContent = formatTime(data.weather.daily.sunset?.[0])

  forecastList.innerHTML = ''
  const daily = data.weather.daily
  if (daily && daily.time) {
    daily.time.slice(0, 7).forEach((date, index) => {
      const card = document.createElement('div')
      card.className = 'forecast-card'
      const icon = formatWeatherCode(daily.weathercode?.[index])
      const max = daily.temperature_2m_max?.[index] ?? '--'
      const min = daily.temperature_2m_min?.[index] ?? '--'
      const rain = daily.precipitation_probability_max?.[index] ?? '--'
      card.innerHTML = `
        <div>
          <span>${new Date(date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' })}</span>
          <strong>${max}° / ${min}°</strong>
        </div>
        <div>
          <span>${icon}</span>
          <span>${rain}%</span>
        </div>`
      forecastList.appendChild(card)
    })
  }
}

function makePopupContent(feature) {
  const props = feature.properties
  return `<div style="font-size:14px; font-weight:600; margin-bottom:6px;">${props.title}</div>
    <div style="font-size:13px; color:#cbd5e1;">Click station dot for full forecast</div>`
}

function loadDistricts() {
  setStatus('Loading district boundaries…')
  fetch('/districts')
    .then((response) => response.json())
    .then((data) => {
      districtFeatures = data.features
      districtLayer = L.geoJSON(data, {
        style: () => ({
          color: '#74c0fc',
          weight: 1,
          opacity: 0.7,
          fillOpacity: 0.04
        }),
        onEachFeature: (feature, layer) => {
          layer.on({
            mouseover: (event) => {
              if (!activeBounds) return
              event.target.setStyle({
                weight: 2.75,
                color: '#d6ffb7',
                opacity: 1,
                fillOpacity: 0.08
              })
              const props = feature.properties
              showTooltip(event, `
                <strong>${props.title}</strong>
                <div style="margin-top:8px; font-size:13px; color:#cbd5e1;">Hover for weather details</div>
              `)
            },
            mouseout: () => {
              if (!activeBounds) return
              districtLayer.resetStyle(event.target)
              hideTooltip()
            }
          })
        }
      }).addTo(overlayLayers.districts)
      drawStationMarkers(data.features)
      loadHeatmap()
      setStatus('Interactive weather map ready')
    })
    .catch((error) => {
      console.error(error)
      setStatus('Failed to load districts. Refresh page.')
    })
}

function drawStationMarkers(features) {
  overlayLayers.stations.clearLayers()
  allMarkers = []
  features.forEach((feature) => {
    const [lat, lon] = feature.properties.center
    if (!lat || !lon) return
    const marker = L.circleMarker([lat, lon], {
      radius: 4,
      fillColor: '#ff3f3f',
      color: '#ff9f9f',
      weight: 1,
      opacity: 0.9,
      fillOpacity: 1
    })

    marker.on('click', () => fetchWeatherForDistrict(feature.properties.district))
    marker.on('mouseover', (event) => {
      event.target.setStyle({ radius: 6 })
    })
    marker.on('mouseout', (event) => {
      event.target.setStyle({ radius: 4 })
    })

    marker.bindTooltip(feature.properties.title, { direction: 'top', offset: [0, -8], opacity: 0.95 })
    marker.addTo(overlayLayers.stations)
    allMarkers.push({ marker, feature })
  })
}

function loadHeatmap() {
  fetch('/heatmap')
    .then((response) => response.json())
    .then((data) => {
      const points = data.points.map((p) => [p.lat, p.lon, Math.max(0.1, Math.min(1, (p.value + 5) / 45))])
      if (overlayLayers.heat) {
        overlayLayers.heat.setLatLngs(points)
      } else {
        overlayLayers.heat = L.heatLayer(points, {
          radius: 24,
          blur: 18,
          maxZoom: 7,
          gradient: {
            0.0: '#0b3d91',
            0.2: '#3a8fd1',
            0.4: '#2db76b',
            0.6: '#f2c631',
            0.8: '#f28d2d',
            1.0: '#d84a39'
          }
        }).addTo(map)
      }
    })
    .catch(console.error)
}

function fetchWeatherForDistrict(districtName) {
  setStatus(`Loading weather for ${districtName}…`)
  fetch(`/weather/${encodeURIComponent(districtName)}`)
    .then((response) => response.json())
    .then((data) => {
      if (data.error) {
        setStatus(data.error)
        return
      }
      updateDetailPanel(data)
      updateMarkerPopup(data)
      setStatus(`Weather updated for ${data.district}`)
    })
    .catch((error) => {
      console.error(error)
      setStatus('Failed to fetch weather data')
    })
}

function updateMarkerPopup(data) {
  if (!selectedMarker) {
    selectedMarker = L.circleMarker([data.center.lat, data.center.lon], {
      radius: 8,
      fillColor: '#ffea53',
      color: '#ffffff',
      weight: 2,
      fillOpacity: 0.95
    }).addTo(map)
  } else {
    selectedMarker.setLatLng([data.center.lat, data.center.lon])
  }
}

function toggleLayer(layerName, active) {
  if (layerName === 'heat') {
    active ? overlayLayers.heat?.addTo(map) : overlayLayers.heat?.remove()
  }
  if (layerName === 'districts') {
    active ? overlayLayers.districts.addTo(map) : overlayLayers.districts.remove()
  }
  if (layerName === 'stations') {
    active ? overlayLayers.stations.addTo(map) : overlayLayers.stations.remove()
  }
}

function enableSatelliteView() {
  map.removeLayer(terrainLayer)
  map.removeLayer(osmLayer)
  satelliteLayer.addTo(map)
}

function enableTerrainView() {
  map.removeLayer(satelliteLayer)
  map.removeLayer(osmLayer)
  terrainLayer.addTo(map)
}

function enableStandardView() {
  map.removeLayer(satelliteLayer)
  map.removeLayer(terrainLayer)
  osmLayer.addTo(map)
}

function resetMapView() {
  map.setView([22.3511148, 78.6677428], 5)
}

function searchDistrict() {
  const query = searchInput.value.trim().toLowerCase()
  if (!query) return
  const feature = districtFeatures.find((feature) => feature.properties.district?.toLowerCase() === query)
  if (feature) {
    const [lat, lon] = feature.properties.center
    map.flyTo([lat, lon], 7)
    setStatus(`Found ${feature.properties.title}`)
  } else {
    setStatus('District not found, try a different spelling')
  }
}

searchBtn.addEventListener('click', searchDistrict)
searchInput.addEventListener('keypress', (event) => {
  if (event.key === 'Enter') searchDistrict()
})

themeToggle.addEventListener('click', () => {
  setTheme(currentMode === 'dark' ? 'light' : 'dark')
})

locateBtn.addEventListener('click', () => {
  map.locate({ setView: true, maxZoom: 7 })
})

zoomInBtn.addEventListener('click', () => map.zoomIn())
zoomOutBtn.addEventListener('click', () => map.zoomOut())
resetBtn.addEventListener('click', resetMapView)

heatToggleBtn.addEventListener('click', () => {
  activeHeat = !activeHeat
  toggleLayer('heat', activeHeat)
  heatToggleBtn.classList.toggle('active', activeHeat)
})

borderToggleBtn.addEventListener('click', () => {
  activeBounds = !activeBounds
  toggleLayer('districts', activeBounds)
  borderToggleBtn.classList.toggle('active', activeBounds)
})

stationToggleBtn.addEventListener('click', () => {
  activeStations = !activeStations
  toggleLayer('stations', activeStations)
  stationToggleBtn.classList.toggle('active', activeStations)
})

satelliteToggleBtn.addEventListener('click', () => {
  enableSatelliteView()
  satelliteToggleBtn.classList.add('active')
  terrainToggleBtn.classList.remove('active')
})

terrainToggleBtn.addEventListener('click', () => {
  enableTerrainView()
  terrainToggleBtn.classList.add('active')
  satelliteToggleBtn.classList.remove('active')
})

fullscreenBtn.addEventListener('click', () => {
  const element = document.documentElement
  if (!document.fullscreenElement) {
    element.requestFullscreen().catch(console.error)
  } else {
    document.exitFullscreen().catch(console.error)
  }
})

map.on('mousemove', (event) => {
  if (!tooltip.classList.contains('hidden')) {
    tooltip.style.left = `${event.containerPoint.x + 14}px`
    tooltip.style.top = `${event.containerPoint.y + 14}px`
  }
})

map.on('click', hideTooltip)
map.on('mouseout', hideTooltip)

setTheme('dark')
loadDistricts()
setInterval(() => {
  if (selectedMarker && detailTitle.textContent !== 'Select a district') {
    searchDistrict()
  }
  loadHeatmap()
  setStatus('Live weather feed refreshed')
}, 300000)
