import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
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
    date: p.date, label: fmtDay(p.date), temp: p.temp, carried: !!p.carried, aqi: p.aqi ?? null
  }))
  const temps = data.map(d => d.temp)
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
          <div style={{ width: '100%', height: 150 }}>
            <ResponsiveContainer>
              <LineChart data={data} margin={{ top: 6, right: 10, left: -18, bottom: 0 }}>
                <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#94a3b8' }} interval="preserveStartEnd" minTickGap={28} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} domain={['dataMin - 2', 'dataMax + 2']} axisLine={false} tickLine={false} width={40} />
                <Tooltip
                  contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 6, fontSize: 11 }}
                  formatter={(v, _n, p) => [`${v}°C${p?.payload?.carried ? ' (carried forward)' : ''}`, t('trend.temp', 'Temperature')]}
                  labelFormatter={l => l}
                />
                {typeof liveTemp === 'number' && <ReferenceLine y={liveTemp} stroke="rgba(217,119,6,0.55)" strokeDasharray="4 3" />}
                <Line
                  type="monotone" dataKey="temp" stroke="#d97706" strokeWidth={2} isAnimationActive={false}
                  dot={(props) => {
                    const { cx, cy, payload } = props
                    if (cx == null || cy == null) return null
                    return <circle key={payload.date} cx={cx} cy={cy} r={3} fill={payload.carried ? '#0f172a' : '#d97706'} stroke="#d97706" strokeWidth={1.5} />
                  }}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div style={{ fontSize: 10, color: '#64748b', marginTop: 6 }}>
            {t('trend.source', 'Source: BhaskarOps daily archive (one Open-Meteo reading per day, taken at each refresh) — hollow dots are days the refresh could not reach this city and carried the previous reading forward. Dashed line = current live reading.')}
          </div>
        </>
      )}
    </section>
  )
}
