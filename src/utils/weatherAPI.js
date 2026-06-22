/**
 * Weather Data System — Open-Meteo Free API (no key needed)
 * Provides real-time weather, AQI, forecasts for any Indian city with accurate IST time
 */

// WMO Weather Code to readable conditions mapping
const WMO_CODES = {
  0:  { label: 'Clear Sky',           icon: '☀️',  isDay: '☀️',  isNight: '🌙' },
  1:  { label: 'Mainly Clear',         icon: '🌤️', isDay: '🌤️', isNight: '🌙' },
  2:  { label: 'Partly Cloudy',        icon: '⛅',  isDay: '⛅',  isNight: '☁️' },
  3:  { label: 'Overcast',             icon: '☁️',  isDay: '☁️',  isNight: '☁️' },
  45: { label: 'Foggy',               icon: '🌫️', isDay: '🌫️', isNight: '🌫️' },
  48: { label: 'Icy Fog',             icon: '🌫️', isDay: '🌫️', isNight: '🌫️' },
  51: { label: 'Light Drizzle',       icon: '🌦️', isDay: '🌦️', isNight: '🌧️' },
  53: { label: 'Drizzle',             icon: '🌧️', isDay: '🌧️', isNight: '🌧️' },
  55: { label: 'Heavy Drizzle',       icon: '🌧️', isDay: '🌧️', isNight: '🌧️' },
  61: { label: 'Light Rain',          icon: '🌦️', isDay: '🌦️', isNight: '🌧️' },
  63: { label: 'Moderate Rain',       icon: '🌧️', isDay: '🌧️', isNight: '🌧️' },
  65: { label: 'Heavy Rain',          icon: '🌧️', isDay: '🌧️', isNight: '🌧️' },
  66: { label: 'Freezing Rain',       icon: '🌨️', isDay: '🌨️', isNight: '🌨️' },
  67: { label: 'Heavy Freezing Rain', icon: '🌨️', isDay: '🌨️', isNight: '🌨️' },
  71: { label: 'Light Snow',          icon: '🌨️', isDay: '🌨️', isNight: '❄️' },
  73: { label: 'Moderate Snow',       icon: '❄️',  isDay: '❄️',  isNight: '❄️' },
  75: { label: 'Heavy Snow',          icon: '❄️',  isDay: '❄️',  isNight: '❄️' },
  77: { label: 'Snow Grains',         icon: '🌨️', isDay: '🌨️', isNight: '🌨️' },
  80: { label: 'Light Showers',       icon: '🌦️', isDay: '🌦️', isNight: '🌧️' },
  81: { label: 'Moderate Showers',    icon: '🌧️', isDay: '🌧️', isNight: '🌧️' },
  82: { label: 'Heavy Showers',       icon: '⛈️',  isDay: '⛈️',  isNight: '⛈️' },
  85: { label: 'Snow Showers',        icon: '🌨️', isDay: '🌨️', isNight: '🌨️' },
  86: { label: 'Heavy Snow Showers',  icon: '❄️',  isDay: '❄️',  isNight: '❄️' },
  95: { label: 'Thunderstorm',        icon: '⛈️',  isDay: '⛈️',  isNight: '⛈️' },
  96: { label: 'Thunderstorm + Hail', icon: '⛈️',  isDay: '⛈️',  isNight: '⛈️' },
  99: { label: 'Thunderstorm + Heavy Hail', icon: '🌩️', isDay: '🌩️', isNight: '🌩️' }
}

// Get weather condition from WMO code
export function getCondition(code, isDay = true) {
  const entry = WMO_CODES[code] || { label: 'Unknown', icon: '🌡️', isDay: '🌡️', isNight: '🌡️' }
  return {
    label: entry.label,
    icon: isDay ? entry.isDay : entry.isNight
  }
}

// Get AQI category from US AQI index
export function getAQICategory(aqi) {
  if (aqi <= 50) return { label: '🟢 Good', color: '#22c55e', category: 'GOOD' }
  if (aqi <= 100) return { label: '🟡 Moderate', color: '#eab308', category: 'MODERATE' }
  if (aqi <= 150) return { label: '🟠 Unhealthy for Sensitive Groups', color: '#f97316', category: 'USG' }
  if (aqi <= 200) return { label: '🔴 Unhealthy', color: '#ef4444', category: 'UNHEALTHY' }
  if (aqi <= 300) return { label: '🟣 Very Unhealthy', color: '#8b5cf6', category: 'VU' }
  return { label: '🟤 Hazardous', color: '#dc2626', category: 'HAZARDOUS' }
}

// Get wind direction from degrees
export function getWindDirection(degrees) {
  const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW']
  const index = Math.round(((degrees % 360) / 22.5))
  return dirs[index % 16]
}

// Step 1: Get city coordinates from Open-Meteo Geocoding API
export async function getCityCoordinates(cityName) {
  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName)}&count=5&language=en&format=json`
    const res = await fetch(url)
    const data = await res.json()

    if (!data.results || data.results.length === 0) {
      throw new Error(`City "${cityName}" not found`)
    }

    // Prefer India results
    const indiaResult = data.results.find(r => r.country_code === 'IN') || data.results[0]

    return {
      lat: indiaResult.latitude,
      lon: indiaResult.longitude,
      name: indiaResult.name,
      state: indiaResult.admin1 || '',
      country: indiaResult.country,
      timezone: indiaResult.timezone || 'Asia/Kolkata'
    }
  } catch (err) {
    console.error('Geocoding error:', err)
    throw err
  }
}

// Step 2: Fetch current weather + forecast from Open-Meteo
export async function getWeatherData(lat, lon) {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?` + new URLSearchParams({
      latitude: lat,
      longitude: lon,

      // Current conditions
      current: [
        'temperature_2m',
        'relative_humidity_2m',
        'apparent_temperature',
        'is_day',
        'precipitation',
        'rain',
        'weather_code',
        'cloud_cover',
        'wind_speed_10m',
        'wind_direction_10m',
        'wind_gusts_10m',
        'surface_pressure',
        'visibility',
        'uv_index'
      ].join(','),

      // Hourly forecast (next 24 hours)
      hourly: [
        'temperature_2m',
        'relative_humidity_2m',
        'apparent_temperature',
        'precipitation_probability',
        'precipitation',
        'weather_code',
        'wind_speed_10m',
        'uv_index',
        'visibility'
      ].join(','),

      // Daily forecast (7 days)
      daily: [
        'weather_code',
        'temperature_2m_max',
        'temperature_2m_min',
        'apparent_temperature_max',
        'apparent_temperature_min',
        'sunrise',
        'sunset',
        'precipitation_sum',
        'precipitation_probability_max',
        'wind_speed_10m_max',
        'uv_index_max'
      ].join(','),

      timezone: 'Asia/Kolkata',   // IST — CRITICAL
      forecast_days: 7,
      wind_speed_unit: 'kmh',
      precipitation_unit: 'mm'
    })

    const res = await fetch(url)
    if (!res.ok) throw new Error(`Weather API error: ${res.status}`)
    return await res.json()
  } catch (err) {
    console.error('Weather data error:', err)
    throw err
  }
}

// Step 3: Get Air Quality (AQI) — separate Open-Meteo endpoint
export async function getAirQuality(lat, lon) {
  try {
    const url = `https://air-quality-api.open-meteo.com/v1/air-quality?` + new URLSearchParams({
      latitude: lat,
      longitude: lon,
      current: [
        'pm10',
        'pm2_5',
        'carbon_monoxide',
        'nitrogen_dioxide',
        'sulphur_dioxide',
        'ozone',
        'us_aqi'
      ].join(','),
      timezone: 'Asia/Kolkata'
    })

    const res = await fetch(url)
    if (!res.ok) throw new Error(`AQI API error: ${res.status}`)
    return await res.json()
  } catch (err) {
    console.error('Air quality error:', err)
    throw err
  }
}

// Main function: Fetch complete weather data
export async function fetchCompleteWeather(cityName) {
  try {
    // Get coordinates
    const coords = await getCityCoordinates(cityName)

    // Fetch weather, forecast, and AQI in parallel
    const [weather, aqiData] = await Promise.all([
      getWeatherData(coords.lat, coords.lon),
      getAirQuality(coords.lat, coords.lon)
    ])

    const { current, hourly, daily } = weather

    return {
      // Location
      city: coords.name,
      state: coords.state,
      lat: coords.lat,
      lon: coords.lon,
      timezone: coords.timezone,

      // Current conditions
      current: {
        temp: Math.round(current.temperature_2m),
        feelsLike: Math.round(current.apparent_temperature),
        humidity: current.relative_humidity_2m,
        windSpeed: Math.round(current.wind_speed_10m),
        windGust: Math.round(current.wind_gusts_10m),
        windDirection: getWindDirection(current.wind_direction_10m),
        pressure: Math.round(current.surface_pressure),
        visibility: Math.round(current.visibility),
        uvIndex: Math.round(current.uv_index * 10) / 10,
        cloudCover: current.cloud_cover,
        precipitation: current.precipitation || 0,
        condition: getCondition(current.weather_code, current.is_day),
        isDay: current.is_day
      },

      // Today
      today: {
        maxTemp: Math.round(daily.temperature_2m_max[0]),
        minTemp: Math.round(daily.temperature_2m_min[0]),
        sunrise: new Date(daily.sunrise[0]).toLocaleTimeString('en-IN', {
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'Asia/Kolkata'
        }),
        sunset: new Date(daily.sunset[0]).toLocaleTimeString('en-IN', {
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'Asia/Kolkata'
        })
      },

      // 7-day forecast
      forecast: daily.time.map((date, i) => ({
        date: new Date(date).toLocaleDateString('en-IN', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          timeZone: 'Asia/Kolkata'
        }),
        maxTemp: Math.round(daily.temperature_2m_max[i]),
        minTemp: Math.round(daily.temperature_2m_min[i]),
        condition: getCondition(daily.weather_code[i]),
        rainChance: daily.precipitation_probability_max[i],
        windMax: Math.round(daily.wind_speed_10m_max[i]),
        uvMax: Math.round(daily.uv_index_max[i] * 10) / 10
      })),

      // 24-hour hourly forecast
      hourly: hourly.time.slice(0, 24).map((time, i) => ({
        time: new Date(time).toLocaleTimeString('en-IN', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
          timeZone: 'Asia/Kolkata'
        }),
        temp: Math.round(hourly.temperature_2m[i]),
        feelsLike: Math.round(hourly.apparent_temperature[i]),
        humidity: hourly.relative_humidity_2m[i],
        rainChance: hourly.precipitation_probability[i],
        condition: getCondition(hourly.weather_code[i]),
        windSpeed: Math.round(hourly.wind_speed_10m[i]),
        visibility: Math.round(hourly.visibility[i])
      })),

      // Air Quality
      aqi: {
        pm25: aqiData.current?.pm2_5 ? aqiData.current.pm2_5.toFixed(1) : 'N/A',
        pm10: aqiData.current?.pm10 ? aqiData.current.pm10.toFixed(1) : 'N/A',
        no2: aqiData.current?.nitrogen_dioxide ? aqiData.current.nitrogen_dioxide.toFixed(1) : 'N/A',
        o3: aqiData.current?.ozone ? aqiData.current.ozone.toFixed(1) : 'N/A',
        co: aqiData.current?.carbon_monoxide ? aqiData.current.carbon_monoxide.toFixed(1) : 'N/A',
        so2: aqiData.current?.sulphur_dioxide ? aqiData.current.sulphur_dioxide.toFixed(1) : 'N/A',
        // The EPA US AQI scale officially caps at 500 — Open-Meteo's calculated value can
        // exceed that during extreme pollution events (e.g. dust storms), so clip for display
        usAQI: Math.min(500, aqiData.current?.us_aqi || 0),
        category: getAQICategory(Math.min(500, aqiData.current?.us_aqi || 0))
      }
    }
  } catch (err) {
    console.error('Complete weather fetch error:', err)
    throw err
  }
}

// Pre-fetched major Indian city coordinates (for instant map markers)
export const MAJOR_CITY_COORDS = {
  'Delhi': { lat: 28.6139, lon: 77.2090 },
  'Mumbai': { lat: 19.0760, lon: 72.8777 },
  'Bengaluru': { lat: 12.9716, lon: 77.5946 },
  'Chennai': { lat: 13.0827, lon: 80.2707 },
  'Hyderabad': { lat: 17.3850, lon: 78.4867 },
  'Kolkata': { lat: 22.5726, lon: 88.3639 },
  'Pune': { lat: 18.5204, lon: 73.8567 },
  'Ahmedabad': { lat: 23.0225, lon: 72.5714 },
  'Jaipur': { lat: 26.9124, lon: 75.7873 },
  'Lucknow': { lat: 26.8467, lon: 80.9462 },
  'Chandigarh': { lat: 30.7333, lon: 76.7794 },
  'Bhopal': { lat: 23.2599, lon: 77.4126 },
  'Visakhapatnam': { lat: 17.6868, lon: 83.2185 },
  'Srinagar': { lat: 34.0837, lon: 74.7973 },
  'Leh': { lat: 34.1526, lon: 77.5771 },
  'Guwahati': { lat: 26.1445, lon: 91.7362 },
  'Kochi': { lat: 9.9312, lon: 76.2673 },
  'Thiruvananthapuram': { lat: 8.5241, lon: 76.9366 },
  'Agra': { lat: 27.1767, lon: 78.0081 },
  'Varanasi': { lat: 25.3176, lon: 82.9739 }
}
