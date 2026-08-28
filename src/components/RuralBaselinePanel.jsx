import React, { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { getWeatherData } from '../utils/weatherAPI'
import { SourceBadge } from './DataBadges'

// ─── REAL-TIME RURAL BASELINE UHI COMPARISON ─────────────────────────────────
// Compares the selected city's live temperature with a nearby rural/non-urban
// reference point (~35-40 km away) in the same geographic climate belt.
// UHI Delta = City Temp − Rural Temp

const CACHE_TTL_MS = 8 * 60 * 1000 // 8 min cache matching useWeather TTL

export function RuralBaselinePanel({ cityName, cityState, cityLat, cityLon, cityTemp }) {
  const { t } = useTranslation()
  const [ruralData, setRuralData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const cacheRef = useRef(new Map()) // key: "lat,lon" -> { data, timestamp }

  // Target coordinates for rural baseline: offset ~0.35° lat (~39km) and ~0.10° lon (~11km)
  // to sample the surrounding agricultural/rural landscape outside the dense urban core.
  const ruralLat = typeof cityLat === 'number' ? Math.round((cityLat + 0.35) * 10000) / 10000 : null
  const ruralLon = typeof cityLon === 'number' ? Math.round((cityLon + 0.10) * 10000) / 10000 : null

  useEffect(() => {
    if (ruralLat == null || ruralLon == null) {
      setRuralData(null)
      return
    }

    const key = `${ruralLat},${ruralLon}`
    const cached = cacheRef.current.get(key)
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
      setRuralData(cached.data)
      setLoading(false)
      setError(null)
      return
    }

    let isMounted = true
    setLoading(true)
    setError(null)

    getWeatherData(ruralLat, ruralLon)
      .then(res => {
        if (!isMounted) return
        const temp = typeof res?.current?.temperature_2m === 'number'
          ? Math.round(res.current.temperature_2m)
          : null
        const result = {
          temp,
          humidity: res?.current?.relative_humidity_2m,
          elevation: res?.elevation,
          lat: ruralLat,
          lon: ruralLon,
        }
        cacheRef.current.set(key, { data: result, timestamp: Date.now() })
        setRuralData(result)
        setLoading(false)
      })
      .catch(err => {
        if (!isMounted) return
        console.warn('[RuralBaselinePanel] failed to fetch rural baseline:', err)
        setError(err)
        setLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [ruralLat, ruralLon])

  const cardStyle = {
    background: 'rgba(10, 14, 26, 0.95)',
    border: '1px solid #1a3a5a',
    borderRadius: '12px',
    padding: '20px',
    marginBottom: '16px',
  }

  const sectionTitle = {
    fontSize: '16px',
    fontWeight: '700',
    color: '#fff',
    marginBottom: '14px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  }

  const hasCityTemp = typeof cityTemp === 'number'
  const hasRuralTemp = typeof ruralData?.temp === 'number'
  const uhiDelta = hasCityTemp && hasRuralTemp ? cityTemp - ruralData.temp : null

  // UHI Severity Classification
  const getUhiSeverity = (delta) => {
    if (delta == null) return { label: 'Calculating...', color: '#888', badge: '⚪' }
    if (delta <= 0) return { label: t('uhi.severity.minimal', 'No Heat Island / Parity'), color: '#22c55e', badge: '🟢', desc: t('uhi.desc.parity', 'Urban and rural temperatures are equal or maritime buffer active.') }
    if (delta <= 1.5) return { label: t('uhi.severity.mild', 'Mild UHI Effect'), color: '#eab308', badge: '🟡', desc: t('uhi.desc.mild', 'Slight urban heat buildup in densely built clusters.') }
    if (delta <= 3.5) return { label: t('uhi.severity.moderate', 'Moderate UHI Effect'), color: '#ea580c', badge: '🟠', desc: t('uhi.desc.moderate', 'Noticeable urban heat trapping from concrete, asphalt, and traffic.') }
    return { label: t('uhi.severity.severe', 'Severe UHI Effect'), color: '#ef4444', badge: '🔴', desc: t('uhi.desc.severe', 'Extreme heat island effect. Concrete retention and low vegetation cause severe urban heat trapping.') }
  }

  const severity = getUhiSeverity(uhiDelta)

  return (
    <div style={cardStyle}>
      <div style={sectionTitle}>
        🏙️ vs 🌾 {t('uhi.panelTitle', 'Real-Time Rural Baseline (Urban Heat Island)')}
      </div>

      {/* Dynamic One-liner takeaway */}
      {uhiDelta != null && (
        <div style={{
          background: 'rgba(255, 255, 255, 0.04)',
          borderLeft: `4px solid ${severity.color}`,
          borderRadius: '4px 8px 8px 4px',
          padding: '10px 14px',
          marginBottom: '16px',
          fontSize: '13px',
          color: '#fff',
          lineHeight: 1.6,
        }}>
          {uhiDelta > 0 ? (
            <span>
              {t('uhi.summaryWarm', '{{city}} is {{delta}}°C hotter than surrounding rural areas — this difference is the direct ', {
                city: cityName || 'Your city',
                delta: Math.abs(uhiDelta).toFixed(0),
              })}
              <strong style={{ color: severity.color }}>{t('uhi.uhiTerm', 'Urban Heat Island (UHI) effect')}</strong>.
            </span>
          ) : (
            <span>
              {t('uhi.summaryEqual', '{{city}} is currently in thermal parity with surrounding rural areas (Δ {{delta}}°C).', {
                city: cityName || 'Your city',
                delta: uhiDelta.toFixed(0),
              })}
            </span>
          )}
        </div>
      )}

      {/* Side-by-Side Comparison */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto 1fr',
        gap: '10px',
        alignItems: 'center',
        marginBottom: '16px',
      }}>
        {/* Urban City Box */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.12) 0%, rgba(10, 14, 26, 0.6) 100%)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '10px',
          padding: '14px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            🏙️ {t('uhi.urbanLabel', 'Urban Core')}
          </div>
          <div style={{ fontSize: '13px', fontWeight: '700', color: '#fff', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {cityName || 'Selected City'}
          </div>
          <div style={{ fontSize: '26px', fontWeight: '800', color: '#ff6b6b', marginTop: '6px' }}>
            {hasCityTemp ? `${cityTemp}°C` : '...'}
          </div>
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>
            {t('uhi.urbanSubtext', 'Concrete, asphalt & traffic')}
          </div>
        </div>

        {/* Delta Indicator */}
        <div style={{ textAlign: 'center', padding: '0 4px' }}>
          <div style={{
            fontSize: '11px', fontWeight: '800', color: severity.color,
            background: 'rgba(0,0,0,0.5)', border: `1px solid ${severity.color}`,
            borderRadius: '20px', padding: '6px 10px', whiteSpace: 'nowrap',
          }}>
            {uhiDelta != null ? (
              `${uhiDelta > 0 ? '+' : ''}${uhiDelta}°C Δ`
            ) : loading ? (
              '...'
            ) : (
              '--'
            )}
          </div>
          <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>
            {t('uhi.deltaLabel', 'UHI Gap')}
          </div>
        </div>

        {/* Rural Reference Box */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.12) 0%, rgba(10, 14, 26, 0.6) 100%)',
          border: '1px solid rgba(34, 197, 94, 0.3)',
          borderRadius: '10px',
          padding: '14px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            🌾 {t('uhi.ruralLabel', 'Rural Baseline')}
          </div>
          <div style={{ fontSize: '13px', fontWeight: '700', color: '#22c55e', marginTop: '2px' }}>
            {t('uhi.ruralPeriphery', 'Periphery (~40km)')}
          </div>
          <div style={{ fontSize: '26px', fontWeight: '800', color: '#22c55e', marginTop: '6px' }}>
            {hasRuralTemp ? `${ruralData.temp}°C` : loading ? '...' : '--'}
          </div>
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>
            {t('uhi.ruralSubtext', 'Open vegetation & soil')}
          </div>
        </div>
      </div>

      {/* Severity Status Card */}
      <div style={{
        background: 'rgba(0, 0, 0, 0.3)',
        borderRadius: '8px',
        padding: '10px 14px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '12px',
        border: '1px solid rgba(255,255,255,0.06)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '14px' }}>{severity.badge}</span>
          <span style={{ fontSize: '12px', fontWeight: '700', color: severity.color }}>
            {severity.label}
          </span>
        </div>
        <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>
          {severity.desc}
        </div>
      </div>

      {/* Attribution Footer */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
        <SourceBadge source="Open-Meteo API (Live Coordinates + Periphery Sampling)" />
        <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)' }}>
          {t('uhi.methodology', 'Rural baseline calculated at +0.35° lat offset outside urban footprint')}
        </span>
      </div>
    </div>
  )
}

