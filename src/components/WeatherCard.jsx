import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useWeather } from '../hooks/useWeather'
import { getISTDateTime } from '../utils/istClock'

/**
 * WeatherCard Component
 * Displays complete weather information for a selected city
 * Includes: current conditions, 7-day forecast, hourly forecast, AQI
 *
 * Data comes from the shared useWeather() hook — the same cache/dedup/retry layer used
 * everywhere else in the app, so selecting a city only triggers ONE network request even
 * though multiple panels (this card, Health & Safety, AI Analyst, Export) all need it.
 */
function formatCacheAge(timestamp, t) {
  if (!timestamp) return ''
  const mins = Math.max(0, Math.round((Date.now() - timestamp) / 60000))
  if (mins < 1) return t('weatherCard.justNow', 'just now')
  if (mins < 60) return t('weatherCard.minAgo', '{{mins}} min ago', { mins })
  const hrs = Math.round(mins / 60)
  return hrs < 24 ? t('weatherCard.hAgo', '{{hrs}}h ago', { hrs }) : t('weatherCard.dAgo', '{{days}}d ago', { days: Math.round(hrs / 24) })
}

export function WeatherCard({ city, state, onClose }) {
  const { t } = useTranslation()
  const { data: weather, loading, error, isStale, cachedAt, timedOut, forceRefresh } = useWeather(city, state, 'WeatherCard')
  const [istTime, setIstTime] = useState(getISTDateTime())

  // Live IST clock
  useEffect(() => {
    const interval = setInterval(() => {
      setIstTime(getISTDateTime())
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  if (!city) return null

  // Only show a full error/loading state if there is NO data of any kind (live or cached)
  // for this city — if we have a cached fallback, show it normally with a small stale badge
  // instead of an error box, so the dashboard never looks broken during a demo.
  if (!weather && (timedOut || error)) {
    return (
      <div style={styles.card}>
        <div style={styles.header}>
          <h3 style={styles.title}>⚠️ {t('weatherCard.weatherUnavailable', 'Weather Unavailable')}</h3>
          <button onClick={onClose} style={styles.closeBtn}>✕</button>
        </div>
        <div style={{ ...styles.section, color: '#ff6b6b' }}>
          {timedOut
            ? t('weatherCard.timedOut', 'Weather data for {{city}} is taking too long to load (no cached data available yet).', { city })
            : (error?.message || t('weatherCard.fetchFailed', 'Failed to fetch weather data'))}
        </div>
        <button onClick={forceRefresh} style={styles.retryBtn}>↻ {t('weatherCard.forceRefresh', 'Force Refresh')}</button>
      </div>
    )
  }

  if (!weather && loading) {
    return (
      <div style={styles.card}>
        <div style={styles.header}>
          <h3 style={styles.title}>⟳ {t('weatherCard.fetchingWeather', 'Fetching Weather...')}</h3>
          <button onClick={onClose} style={styles.closeBtn}>✕</button>
        </div>
        <div style={{ ...styles.section, textAlign: 'center', color: '#888' }}>
          {t('weatherCard.loadingRealtimeFor', 'Loading real-time weather for {{city}}...', { city })}
        </div>
      </div>
    )
  }

  if (!weather) return null

  return (
    <div style={styles.card}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h3 style={styles.title}>
            {weather.current.condition.icon} {weather.city}, {weather.state}
          </h3>
          <div style={styles.coords}>
            📍 {weather.lat.toFixed(2)}°N {Math.abs(weather.lon).toFixed(2)}°E
          </div>
          {weather.isFallbackLocation && (
            <div style={styles.fallbackBadge}>
              📍 {t('weatherCard.fallbackLocation', 'Live weather not available for {{city}} specifically — showing {{fallbackCity}}, {{state}}\'s nearest available real data point, as an estimate.', { city, fallbackCity: weather.fallbackCityUsed, state: weather.state })}
            </div>
          )}
          {isStale && (
            <div style={styles.staleBadge}>
              ⏱ {t('weatherCard.cachedAgo', 'Cached — {{age}}', { age: formatCacheAge(cachedAt, t) })}
              <button onClick={forceRefresh} style={styles.staleRefreshBtn}>↻ {t('weatherCard.forceRefresh', 'Force Refresh')}</button>
            </div>
          )}
        </div>
        <button onClick={onClose} style={styles.closeBtn}>✕</button>
      </div>

      {/* IST Clock */}
      <div style={styles.clockSection}>
        <div style={styles.timeDisplay}>
          {istTime.timeEmoji} {istTime.timeString}
        </div>
        <div style={styles.dateDisplay}>
          📅 {istTime.dateString}
        </div>
        <div style={styles.tzDisplay}>
          IST (UTC+5:30) • {istTime.timeOfDay}
        </div>
      </div>

      {/* Main Temperature */}
      <div style={styles.mainTemp}>
        <div style={styles.tempBig}>
          {weather.current.temp}°C
        </div>
        <div style={styles.condition}>
          {weather.current.condition.label}
        </div>
        <div style={styles.feelsLike}>
          {t('weatherCard.feelsLike', 'Feels like {{temp}}°C', { temp: weather.current.feelsLike })}
        </div>
        <div style={styles.todayRange}>
          ▲ {weather.today.maxTemp}°C / ▼ {weather.today.minTemp}°C
        </div>
      </div>

      {/* Stats Grid */}
      <div style={styles.statsGrid}>
        <StatBox icon="💧" label={t('weatherCard.humidity', 'Humidity')} value={`${weather.current.humidity}%`} />
        <StatBox icon="💨" label={t('weatherCard.wind', 'Wind')} value={`${weather.current.windSpeed} km/h ${weather.current.windDirection}`} />
        <StatBox icon="🌡️" label={t('weatherCard.pressure', 'Pressure')} value={`${weather.current.pressure} hPa`} />
        <StatBox icon="👁️" label={t('weatherCard.visibility', 'Visibility')} value={`${weather.current.visibility} km`} />
        <StatBox icon="☀️" label={t('weatherCard.uvIndex', 'UV Index')} value={weather.current.uvIndex} />
        <StatBox icon="☁️" label={t('weatherCard.cloudCover', 'Cloud Cover')} value={`${weather.current.cloudCover}%`} />
        <StatBox icon="🌅" label={t('weatherCard.sunrise', 'Sunrise')} value={weather.today.sunrise} />
        <StatBox icon="🌇" label={t('weatherCard.sunset', 'Sunset')} value={weather.today.sunset} />
      </div>

      {/* AQI Section */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>
          🌍 {t('weatherCard.aqiTitle', 'Air Quality Index (AQI)')}
        </div>
        <div style={styles.aqiContainer}>
          <div style={{ ...styles.aqiValue, color: weather.aqi.category.color }}>
            {weather.aqi.category.label}
          </div>
          <div style={styles.aqiScore}>
            {t('weatherCard.score', 'Score:')} <strong>{weather.aqi.usAQI}</strong>
          </div>
        </div>
        <div style={styles.aqiDetails}>
          <AQIDetail icon="🔵" label="PM2.5" value={`${weather.aqi.pm25} µg/m³`} />
          <AQIDetail icon="🔴" label="PM10" value={`${weather.aqi.pm10} µg/m³`} />
          <AQIDetail icon="🟣" label="NO₂" value={`${weather.aqi.no2} ppb`} />
          <AQIDetail icon="🟠" label="O₃" value={`${weather.aqi.o3} ppb`} />
        </div>
      </div>

      {/* 7-Day Forecast */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>📊 {t('weatherCard.sevenDayForecast', '7-Day Forecast')}</div>
        <div style={styles.forecastContainer}>
          {weather.forecast.slice(0, 7).map((day, i) => (
            <div key={i} style={styles.forecastDay}>
              <div style={styles.forecastDate}>{day.date}</div>
              <div style={styles.forecastIcon}>{day.condition.icon}</div>
              <div style={styles.forecastTemp}>
                <span style={styles.tempMax}>{day.maxTemp}°</span>
                <span style={styles.tempMin}>{day.minTemp}°</span>
              </div>
              <div style={styles.forecastRain}>💧 {day.rainChance}%</div>
            </div>
          ))}
        </div>
      </div>

      {/* Hourly Forecast (next 12 hours) */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>⏰ {t('weatherCard.next12Hours', 'Next 12 Hours')}</div>
        <div style={styles.hourlyContainer}>
          {weather.hourly.slice(0, 12).map((hr, i) => (
            <div key={i} style={styles.hourlySlot}>
              <div style={styles.hourlyTime}>{hr.time}</div>
              <div style={styles.hourlyIcon}>{hr.condition.icon}</div>
              <div style={styles.hourlyTemp}>{hr.temp}°</div>
              <div style={styles.hourlyHumidity}>{hr.humidity}%</div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div style={styles.footer}>
        📡 {t('weatherCard.dataSource', 'Data: Open-Meteo.com (WMO • ERA5 reanalysis)')} • {isStale
          ? t('weatherCard.cachedFooter', 'Cached {{age}}', { age: formatCacheAge(cachedAt, t) })
          : t('weatherCard.updatedFooter', 'Updated: {{time}} IST', { time: new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }) })}
      </div>
    </div>
  )
}

// Sub-component: Stat Box
function StatBox({ icon, label, value }) {
  return (
    <div style={styles.statBox}>
      <div style={styles.statIcon}>{icon}</div>
      <div style={styles.statLabel}>{label}</div>
      <div style={styles.statValue}>{value}</div>
    </div>
  )
}

// Sub-component: AQI Detail
function AQIDetail({ icon, label, value }) {
  return (
    <div style={styles.aqiDetailItem}>
      <span style={styles.aqiDetailIcon}>{icon}</span>
      <span style={styles.aqiDetailLabel}>{label}</span>
      <span style={styles.aqiDetailValue}>{value}</span>
    </div>
  )
}

// Styles
const styles = {
  card: {
    background: 'rgba(10, 14, 26, 0.98)',
    border: '1px solid rgba(0, 255, 136, 0.2)',
    borderRadius: '14px',
    padding: '20px',
    marginTop: '16px',
    maxWidth: '100%',
    maxHeight: '80vh',
    overflowY: 'auto',
    fontSize: '14px',
    color: '#e0e0e0',
    fontFamily: "'Inter', 'Segoe UI', sans-serif"
  },

  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '16px',
    paddingBottom: '12px',
    borderBottom: '1px solid rgba(0, 255, 136, 0.15)'
  },

  title: {
    margin: '0',
    fontSize: '18px',
    fontWeight: '700',
    color: '#fff'
  },

  coords: {
    fontSize: '12px',
    color: 'rgba(255, 255, 255, 0.5)',
    marginTop: '6px'
  },

  closeBtn: {
    background: 'rgba(255, 107, 107, 0.1)',
    border: '1px solid rgba(255, 107, 107, 0.3)',
    color: '#ff6b6b',
    fontSize: '18px',
    cursor: 'pointer',
    padding: '6px 10px',
    borderRadius: '6px',
    transition: 'all 0.2s',
    fontWeight: '600'
  },

  retryBtn: {
    background: 'rgba(0, 255, 136, 0.1)',
    border: '1px solid rgba(0, 255, 136, 0.3)',
    color: '#22c55e',
    fontSize: '13px',
    cursor: 'pointer',
    padding: '8px 14px',
    borderRadius: '6px',
    fontWeight: '600'
  },

  staleBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '10px',
    color: 'rgba(255, 200, 100, 0.8)',
    marginTop: '6px',
    fontStyle: 'italic'
  },

  fallbackBadge: {
    fontSize: '10px',
    color: 'rgba(0, 212, 255, 0.85)',
    background: 'rgba(0, 212, 255, 0.08)',
    border: '1px solid rgba(0, 212, 255, 0.25)',
    borderRadius: '6px',
    padding: '5px 8px',
    marginTop: '6px',
    lineHeight: 1.4
  },

  staleRefreshBtn: {
    background: 'rgba(255, 200, 100, 0.1)',
    border: '1px solid rgba(255, 200, 100, 0.3)',
    color: 'rgba(255, 200, 100, 0.9)',
    fontSize: '9px',
    cursor: 'pointer',
    padding: '2px 8px',
    borderRadius: '4px',
    fontWeight: '600',
    fontStyle: 'normal'
  },

  clockSection: {
    background: 'linear-gradient(135deg, rgba(0, 255, 136, 0.1), rgba(34, 197, 94, 0.05))',
    border: '1px solid rgba(0, 255, 136, 0.25)',
    borderRadius: '10px',
    padding: '14px',
    marginBottom: '14px',
    textAlign: 'center'
  },

  timeDisplay: {
    fontSize: '20px',
    fontWeight: '700',
    color: '#22c55e',
    marginBottom: '6px'
  },

  dateDisplay: {
    fontSize: '13px',
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: '4px'
  },

  tzDisplay: {
    fontSize: '11px',
    color: 'rgba(255, 255, 255, 0.5)',
    fontStyle: 'italic'
  },

  mainTemp: {
    background: 'rgba(0, 255, 136, 0.08)',
    border: '1px solid rgba(0, 255, 136, 0.2)',
    borderRadius: '10px',
    padding: '16px',
    marginBottom: '14px',
    textAlign: 'center'
  },

  tempBig: {
    fontSize: '32px',
    fontWeight: '700',
    color: '#22c55e',
    marginBottom: '6px'
  },

  condition: {
    fontSize: '14px',
    color: '#e0e0e0',
    marginBottom: '6px'
  },

  feelsLike: {
    fontSize: '12px',
    color: 'rgba(255, 255, 255, 0.6)',
    marginBottom: '8px'
  },

  todayRange: {
    fontSize: '13px',
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '500'
  },

  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))',
    gap: '10px',
    marginBottom: '14px'
  },

  statBox: {
    background: 'rgba(0, 100, 255, 0.08)',
    border: '1px solid rgba(0, 150, 255, 0.15)',
    borderRadius: '8px',
    padding: '10px',
    textAlign: 'center'
  },

  statIcon: {
    fontSize: '18px',
    marginBottom: '4px'
  },

  statLabel: {
    fontSize: '10px',
    color: 'rgba(255, 255, 255, 0.5)',
    textTransform: 'uppercase',
    marginBottom: '4px',
    fontWeight: '500'
  },

  statValue: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#fff'
  },

  section: {
    marginBottom: '14px'
  },

  sectionTitle: {
    fontSize: '13px',
    fontWeight: '700',
    color: '#22c55e',
    marginBottom: '10px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },

  aqiContainer: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '10px',
    marginBottom: '10px'
  },

  aqiValue: {
    fontSize: '16px',
    fontWeight: '700',
    padding: '10px',
    background: 'rgba(255, 255, 255, 0.05)',
    borderRadius: '6px',
    textAlign: 'center'
  },

  aqiScore: {
    fontSize: '13px',
    padding: '10px',
    background: 'rgba(255, 255, 255, 0.05)',
    borderRadius: '6px',
    textAlign: 'center',
    color: 'rgba(255, 255, 255, 0.7)'
  },

  aqiDetails: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '8px'
  },

  aqiDetailItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '11px',
    padding: '6px',
    background: 'rgba(255, 255, 255, 0.03)',
    borderRadius: '4px'
  },

  aqiDetailIcon: {
    fontSize: '14px'
  },

  aqiDetailLabel: {
    color: 'rgba(255, 255, 255, 0.6)',
    minWidth: '30px'
  },

  aqiDetailValue: {
    color: '#fff',
    fontWeight: '600',
    marginLeft: 'auto'
  },

  forecastContainer: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(70px, 1fr))',
    gap: '8px'
  },

  forecastDay: {
    background: 'rgba(255, 200, 100, 0.05)',
    border: '1px solid rgba(255, 150, 50, 0.15)',
    borderRadius: '8px',
    padding: '10px',
    textAlign: 'center'
  },

  forecastDate: {
    fontSize: '10px',
    color: 'rgba(255, 255, 255, 0.5)',
    marginBottom: '4px',
    fontWeight: '500'
  },

  forecastIcon: {
    fontSize: '24px',
    margin: '4px 0'
  },

  forecastTemp: {
    display: 'flex',
    justifyContent: 'center',
    gap: '6px',
    fontSize: '12px',
    marginBottom: '4px',
    fontWeight: '600'
  },

  tempMax: {
    color: '#ffa500'
  },

  tempMin: {
    color: 'rgba(255, 255, 255, 0.5)'
  },

  forecastRain: {
    fontSize: '10px',
    color: 'rgba(100, 200, 255, 0.7)'
  },

  hourlyContainer: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(60px, 1fr))',
    gap: '6px'
  },

  hourlySlot: {
    background: 'rgba(100, 150, 255, 0.08)',
    border: '1px solid rgba(100, 150, 255, 0.15)',
    borderRadius: '6px',
    padding: '8px',
    textAlign: 'center',
    fontSize: '10px'
  },

  hourlyTime: {
    color: 'rgba(255, 255, 255, 0.6)',
    marginBottom: '3px',
    fontWeight: '500'
  },

  hourlyIcon: {
    fontSize: '18px',
    margin: '3px 0'
  },

  hourlyTemp: {
    fontSize: '13px',
    fontWeight: '700',
    color: '#fff',
    marginBottom: '3px'
  },

  hourlyHumidity: {
    fontSize: '9px',
    color: 'rgba(100, 200, 255, 0.7)'
  },

  footer: {
    fontSize: '10px',
    color: 'rgba(255, 255, 255, 0.4)',
    marginTop: '14px',
    paddingTop: '12px',
    borderTop: '1px solid rgba(255, 255, 255, 0.1)',
    textAlign: 'center',
    fontStyle: 'italic'
  }
}
