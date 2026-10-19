import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, CartesianGrid } from 'recharts'
import { niceScale, yLabel, tipStyle } from './workspaceKit'
import PanelIcon from './PanelIcon'
import { fetchJson } from '../utils/fetchJson'

// 30-day temperature trend for the selected city, from the platform's own daily history
// archive (public/data/history via /api/weather-history). Real readings only: days the
// nightly refresh carried forward are drawn hollow and counted in the caption; days with
// no snapshot are simply gaps. Nothing is interpolated.
const DAYS = 30

function fmtDay(iso) {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

export default function CityTrendPanel({ city, state, liveTemp }) {
  const { t } = useTranslation()
  const [rows, setRows] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!city || !state) return
    let cancelled = false
    setRows(null); setError(null)
    fetchJson(`/api/weather-history?city=${encodeURIComponent(city)}&state=${encodeURIComponent(state)}&days=${DAYS}`, { timeoutMs: 12000 })
      .then(d => { if (!cancelled) setRows(Array.isArray(d?.points) ? d.points : []) })
      .catch(e => { if (!cancelled) setError(e?.message || 'failed') })
    return () => { cancelled = true }
  }, [city, state])

  const data = (rows || []).filter(p => typeof p.temp === 'number').map(p => ({
    date: p.date, ts: Date.parse(`${p.date}T00:00:00+05:30`), label: fmtDay(p.date), temp: p.temp, carried: !!p.carried, aqi: p.aqi ?? null
  }))
  const temps = data.map(d => d.temp)
  // insert empty days so the line breaks where the archive has no reading
  const series = []
  for (let i = 0; i < data.length; i++) {
    series.push(data[i])
    const next = data[i + 1]
    if (next && next.ts - data[i].ts > 1.5 * 86400000) series.push({ ts: data[i].ts + 86400000, temp: null, label: 'no reading' })
  }
  const stats = temps.length ? {
    min: Math.min(...temps), max: Math.max(...temps),
    avg: Math.round((temps.reduce((a, b) => a + b, 0) / temps.length) * 10) / 10,
    carried: data.filter(d => d.carried).length
  } : null

  return (
    <section className="panel" data-panel="TREND">
      <h3><PanelIcon name="trending-up" /> {t('trend.title', '30-DAY TEMPERATURE TREND')}</h3>
      {rows === null && !error && <div style={{ fontSize: 12, color: '#94a3b8' }}>{t('trend.loading', 'Loading the daily archive…')}</div>}
      {error && <div style={{ fontSize: 12, color: '#94a3b8' }}>{t('trend.unavailable', 'History archive unavailable right now.')}</div>}
      {rows !== null && !error && data.length < 3 && (
        <div style={{ fontSize: 12, color: '#94a3b8' }}>{t('trend.noData', 'Not enough archived days for this city yet — the archive grows with every refresh.')}</div>
      )}
      {stats && data.length >= 3 && (
        <>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 11, color: '#cbd5e1', marginBottom: 8 }}>
            <span>{t('trend.range', 'Range')}: <strong>{stats.min}–{stats.max}°C</strong></span>
            <span>{t('trend.avg', 'Average')}: <strong>{stats.avg}°C</strong></span>
            {typeof liveTemp === 'number' && <span>{t('trend.now', 'Now')}: <strong>{liveTemp}°C</strong></span>}
            <span>{data.length} {t('trend.days', 'days')}{stats.carried ? ` · ${stats.carried} ${t('trend.carried', 'carried forward (hollow)')}` : ''}</span>
          </div>
          <div style={{ width: '100%', height: 180 }}>
            <ResponsiveContainer>
              <LineChart data={series} margin={{ top: 10, right: 12, left: 4, bottom: 0 }}>
                <CartesianGrid stroke="#1F2937" strokeDasharray="3 3" vertical={false} />
                {/* time axis, so days missing from the archive show as real gaps instead of being squeezed out */}
                <XAxis dataKey="ts" type="number" scale="time" domain={['dataMin', 'dataMax']} tickFormatter={v => fmtDay(new Date(v).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }))} tick={{ fontSize: 10, fill: '#94a3b8' }} tickCount={6} axisLine={false} tickLine={false} />
                {(() => { const sc = niceScale([...temps, liveTemp], { step: 2 }); return <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} domain={sc.domain} ticks={sc.ticks} tickFormatter={v => `${v}°`} axisLine={false} tickLine={false} width={58} label={yLabel('Temperature (°C)')} /> })()}
                <Tooltip
                  {...tipStyle}
                  formatter={(v, _n, p) => [`${v}°C${p?.payload?.carried ? ' (carried forward)' : ''}`, t('trend.temp', 'Temperature')]}
                  labelFormatter={(l, p) => p?.[0]?.payload?.label || ''}
                />
                {typeof liveTemp === 'number' && <ReferenceLine y={liveTemp} stroke="#38BDF8" strokeDasharray="5 4" label={{ value: `Now ${liveTemp}°C`, fill: '#38BDF8', fontSize: 10.5, fontWeight: 700, position: 'insideTopRight' }} />}
                <Line
                  type="monotone" dataKey="temp" connectNulls={false} stroke="#d97706" strokeWidth={2} isAnimationActive={false}
                  dot={(props) => {
                    const { cx, cy, payload } = props
                    if (cx == null || cy == null || payload.temp == null) return null
                    return <circle key={payload.ts} cx={cx} cy={cy} r={3} fill={payload.carried ? '#0f172a' : '#d97706'} stroke="#d97706" strokeWidth={1.5} />
                  }}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div style={{ fontSize: 10, color: '#64748b', marginTop: 6 }}>
            {t('trend.source', 'Source: BhaskarOps daily archive (one Open-Meteo reading per day, taken at each refresh) — hollow dots are days the refresh could not reach this city and carried the previous reading forward. Dashed blue line = current live reading. Gaps in the line are days missing from the archive.')}
          </div>
        </>
      )}
    </section>
  )
}
