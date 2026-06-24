import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Legend,
  Tooltip,
  ResponsiveContainer
} from 'recharts'
import { getCityData } from '../utils/realData'
import { useWeather } from '../hooks/useWeather'

const MAX_COMPARE = 4
const SEARCH_DEBOUNCE_MS = 250
// index 0 is always the baseline (selectedCity); 1-4 are the added compare cities
const SERIES_COLORS = ['#00ff88', '#ff6b35', '#00a8ff', '#ffcc00', '#c77dff']

function normalize(val, min, max) {
  return Math.round(Math.max(0, Math.min(100, ((val - min) / (max - min)) * 100)))
}

const SuggestionRow = React.memo(function SuggestionRow({ city, state, isActive, onSelect, onHover }) {
  return (
    <div
      onMouseDown={() => onSelect(city)}
      onMouseEnter={onHover}
      style={{
        padding: '10px 14px',
        fontSize: 13,
        color: isActive ? '#00ff88' : '#fff',
        background: isActive ? 'rgba(0,255,136,0.1)' : 'transparent',
        cursor: 'pointer',
        borderBottom: '1px solid #1a2a4a',
        display: 'flex',
        justifyContent: 'space-between'
      }}
    >
      <span>{city}</span>
      <span style={{ color: '#8899aa', fontSize: 11 }}>{state}</span>
    </div>
  )
})

const CityChip = React.memo(function CityChip({ city, color, onRemove }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      background: `${color}1a`, border: `1px solid ${color}`, color,
      borderRadius: 20, padding: '5px 10px', fontSize: 12, fontWeight: 600
    }}>
      {city}
      <button
        onClick={() => onRemove(city)}
        aria-label={`Remove ${city}`}
        style={{ background: 'none', border: 'none', color, cursor: 'pointer', fontSize: 13, lineHeight: 1, padding: 0 }}
      >✕</button>
    </div>
  )
})

// SECTION 13 - DEDICATED MULTI-CITY COMPARISON
//
// Moved out of the Analysis tab into its own top-level tab (was a cramped single-city
// dropdown panel). Supports comparing the currently selected city against up to
// MAX_COMPARE additional cities at once via a debounced search/autocomplete, each
// rendered as its own radar series. Each added city gets its own useWeather() call so it
// benefits from the same shared cache/retry/fallback logic as the rest of the app — fixed
// number of hook slots (rules of hooks require a stable call order, not a dynamic loop).
export function CompareCitiesPanel({ selectedCity, selectedState, liveWeather, allCities }) {
  const { t } = useTranslation()
  const [compareCities, setCompareCities] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedTerm, setDebouncedTerm] = useState('')
  const [dropOpen, setDropOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef(null)

  useEffect(() => {
    const id = setTimeout(() => setDebouncedTerm(searchTerm.trim()), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(id)
  }, [searchTerm])

  // Reset comparison set when the user picks a different baseline city on the map
  useEffect(() => {
    setCompareCities([])
    setSearchTerm('')
  }, [selectedCity])

  const cityToState = useMemo(() => {
    const map = {}
    allCities.forEach(c => { map[c.city] = c.state })
    return map
  }, [allCities])

  const suggestions = useMemo(() => {
    if (debouncedTerm.length < 1) return []
    const q = debouncedTerm.toLowerCase()
    return allCities
      .filter(c => c.city !== selectedCity && !compareCities.includes(c.city))
      .filter(c => c.city.toLowerCase().includes(q) || c.state.toLowerCase().includes(q))
      .slice(0, 8)
  }, [debouncedTerm, allCities, selectedCity, compareCities])

  useEffect(() => { setActiveIndex(0) }, [suggestions])

  const handleSelectCity = useCallback((city) => {
    setCompareCities(prev => {
      if (prev.includes(city) || prev.length >= MAX_COMPARE) return prev
      return [...prev, city]
    })
    setSearchTerm('')
    setDropOpen(false)
  }, [])

  const handleRemoveCity = useCallback((city) => {
    setCompareCities(prev => prev.filter(c => c !== city))
  }, [])

  const handleKeyDown = useCallback((e) => {
    if (!dropOpen || suggestions.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex(i => Math.min(i + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const pick = suggestions[activeIndex]
      if (pick) handleSelectCity(pick.city)
    } else if (e.key === 'Escape') {
      setDropOpen(false)
    }
  }, [dropOpen, suggestions, activeIndex, handleSelectCity])

  // Fixed slots, not a loop — required so the hook call order never changes across renders
  const w0 = useWeather(compareCities[0] || null, 'CompareCitiesPanel')
  const w1 = useWeather(compareCities[1] || null, 'CompareCitiesPanel')
  const w2 = useWeather(compareCities[2] || null, 'CompareCitiesPanel')
  const w3 = useWeather(compareCities[3] || null, 'CompareCitiesPanel')
  const compareWeathers = [w0, w1, w2, w3]

  const baseData = useMemo(
    () => (selectedCity && selectedState ? getCityData(selectedCity, selectedState) : null),
    [selectedCity, selectedState]
  )

  const compareEntries = useMemo(() => {
    return compareCities.map((city, i) => ({
      city,
      data: getCityData(city, cityToState[city]),
      weather: compareWeathers[i]?.data
    }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compareCities, cityToState, compareWeathers[0]?.data, compareWeathers[1]?.data, compareWeathers[2]?.data, compareWeathers[3]?.data])

  const seriesCities = useMemo(() => [selectedCity, ...compareCities], [selectedCity, compareCities])

  const radarData = useMemo(() => {
    if (!baseData) return []
    const metrics = [
      { key: 'LST', get: d => d.lst, min: 22, max: 52 },
      { key: 'NDVI', get: d => d.ndvi, min: -0.1, max: 0.7 },
      { key: 'NDBI', get: d => d.ndbi, min: -0.2, max: 0.6 },
      { key: 'AQI', getWeather: w => w?.aqi?.usAQI ?? 0, min: 30, max: 400 },
      { key: 'Wind', getWeather: w => w?.current?.windSpeed ?? 0, min: 5, max: 35 },
      { key: 'NDWI', get: d => d.ndwi, min: -0.4, max: 0.3 }
    ]
    return metrics.map(m => {
      const row = { metric: m.key }
      row[selectedCity] = normalize(m.get ? m.get(baseData) : m.getWeather(liveWeather), m.min, m.max)
      compareEntries.forEach(({ city, data, weather }) => {
        row[city] = normalize(m.get ? m.get(data) : m.getWeather(weather), m.min, m.max)
      })
      return row
    })
  }, [baseData, compareEntries, selectedCity, liveWeather])

  const coolest = useMemo(() => {
    if (!baseData || compareEntries.length === 0) return null
    const all = [{ city: selectedCity, lst: baseData.lst }, ...compareEntries.map(e => ({ city: e.city, lst: e.data.lst }))]
    return all.reduce((min, cur) => (cur.lst < min.lst ? cur : min), all[0])
  }, [baseData, compareEntries, selectedCity])

  return (
    <section className="panel">
      <h3>🌍 {t('panels.cityComparison', 'COMPARE CITIES')}</h3>
      <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: -4, marginBottom: 14 }}>
        {t('compareCities.subtitle', `Comparing against ${selectedCity || 'the selected city'} — search and add up to ${MAX_COMPARE} more cities.`)}
      </p>

      <div style={{ position: 'relative' }}>
        <input
          ref={inputRef}
          value={searchTerm}
          onChange={e => { setSearchTerm(e.target.value); setDropOpen(true) }}
          onFocus={() => setDropOpen(true)}
          onBlur={() => setTimeout(() => setDropOpen(false), 120)}
          onKeyDown={handleKeyDown}
          disabled={compareCities.length >= MAX_COMPARE}
          placeholder={
            compareCities.length >= MAX_COMPARE
              ? t('compareCities.maxReached', `Max ${MAX_COMPARE} cities selected`)
              : t('compareCities.searchPlaceholder', 'Search city or state to compare...')
          }
          style={{
            width: '100%', boxSizing: 'border-box',
            background: '#0a0e1a', border: '1px solid #1a2a4a', borderRadius: 8,
            padding: '12px 16px', color: '#fff', fontSize: 14, outline: 'none'
          }}
        />
        {dropOpen && suggestions.length > 0 && (
          <div style={{
            position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
            background: '#0f1729', border: '1px solid #00ff88', borderRadius: 8,
            zIndex: 1000, maxHeight: 320, overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,0.5)'
          }}>
            {suggestions.map((s, i) => (
              <SuggestionRow
                key={s.city}
                city={s.city}
                state={s.state}
                isActive={i === activeIndex}
                onSelect={handleSelectCity}
                onHover={() => setActiveIndex(i)}
              />
            ))}
          </div>
        )}
      </div>

      {compareCities.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
          {compareCities.map((city, i) => (
            <CityChip key={city} city={city} color={SERIES_COLORS[i + 1]} onRemove={handleRemoveCity} />
          ))}
        </div>
      )}

      {compareCities.length === 0 && (
        <div style={{ marginTop: 18, color: '#94a3b8', fontSize: 13 }}>
          {t('compareCities.empty', 'Search above and add at least one city to see the comparison chart.')}
        </div>
      )}

      {compareCities.length > 0 && baseData && (
        <div style={{ background: '#0f1729', border: '1px solid #1a2a4a', borderRadius: 12, padding: 16, marginTop: 16 }}>
          <ResponsiveContainer width="100%" height={420}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="#1a2a4a" />
              <PolarAngleAxis dataKey="metric" tick={{ fill: '#8899aa', fontSize: 12 }} />
              <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fill: '#8899aa', fontSize: 9 }} />
              {seriesCities.map((city, i) => (
                <Radar
                  key={city}
                  name={city}
                  dataKey={city}
                  stroke={SERIES_COLORS[i]}
                  fill={SERIES_COLORS[i]}
                  fillOpacity={0.15}
                  strokeWidth={2}
                />
              ))}
              <Legend wrapperStyle={{ fontSize: 12, color: '#fff' }} />
              <Tooltip contentStyle={{ background: '#0f1729', border: '1px solid #00ff88', borderRadius: 8, color: '#fff', fontSize: 11 }} />
            </RadarChart>
          </ResponsiveContainer>
          {coolest && (
            <div style={{ marginTop: 12, background: 'rgba(0,255,136,0.1)', border: '1px solid #00ff88', color: '#00ff88', padding: '10px 14px', borderRadius: 8, fontSize: 13 }}>
              🌿 {coolest.city} {t('compareCities.coolest', 'is the coolest selected city')} ({coolest.lst}°C LST)
            </div>
          )}
        </div>
      )}
    </section>
  )
}
