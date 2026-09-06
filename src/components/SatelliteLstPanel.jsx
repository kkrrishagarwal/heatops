import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, ReferenceDot, Legend } from 'recharts'
import PanelIcon from './PanelIcon'
import { loadModisIndex, loadModisStateFile } from '../utils/modisLst'

// NASA MODIS land-surface temperature for the selected city, from public/data/modis-lst/
// (built by scripts/processModisLst.mjs from AppEEARS point samples of MOD11A1.061).
// Real satellite readings only: cloud-blocked days are gaps, nothing is interpolated, and
// the QC rule that filtered them is printed. Surface temperature is not air temperature —
// the panel says so, because a 40 °C rooftop and a 33 °C weather station are both true.
// The daily series (one dot per clear overpass, with cloud gaps) read as noise on a small
// chart. Weekly averages of the clear-sky readings are far easier to read and still honest:
// each point says how many clear days it rests on, and weeks with no clear day stay empty.
function weeklyAverages(rows) {
  if (!rows.length) return []
  const start = new Date(rows[0][0] + 'T00:00:00').getTime()
  const weeks = new Map()
  for (const [date, d, n] of rows) {
    const w = Math.floor((new Date(date + 'T00:00:00').getTime() - start) / (7 * 86400000))
    const b = weeks.get(w) || { w, dates: [], day: [], night: [] }
    b.dates.push(date); if (d !== null) b.day.push(d); if (n !== null) b.night.push(n)
    weeks.set(w, b)
  }
  const mean = a => (a.length ? Math.round((a.reduce((x, y) => x + y, 0) / a.length) * 10) / 10 : null)
  return [...weeks.values()].sort((a, b) => a.w - b.w).map(b => {
    const weekStart = new Date(start + b.w * 7 * 86400000)
    // local-date ISO string (toISOString would shift IST midnight back to the previous UTC day)
    const iso = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, '0')}-${String(weekStart.getDate()).padStart(2, '0')}`
    return { date: iso, label: fmt(iso), day: mean(b.day), night: mean(b.night), clearDays: b.day.length, clearNights: b.night.length }
  })
}
function fmt(iso) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

export default function SatelliteLstPanel({ city, state, liveTemp }) {
  const { t } = useTranslation()
  const [status, setStatus] = useState('loading') // loading | ready | missing | error
  const [meta, setMeta] = useState(null)
  const [summary, setSummary] = useState(null)
  const [series, setSeries] = useState(null)

  useEffect(() => {
    if (!city || !state) return
    let cancelled = false
    setStatus('loading'); setSummary(null); setSeries(null)
    loadModisIndex().then(async idx => {
      if (cancelled) return
      setMeta(idx.meta)
      const s = idx.cities?.[`${city}|${state}`]
      if (!s) { setStatus('missing'); return }
      setSummary(s)
      const sf = await loadModisStateFile(s.file)
      if (cancelled) return
      setSeries(weeklyAverages(sf.cities?.[`${city}|${state}`] || [])); setStatus('ready')
    }).catch(() => { if (!cancelled) setStatus('error') })
    return () => { cancelled = true }
  }, [city, state])

  const totalDays = meta?.dateRange ? Math.round((new Date(meta.dateRange.to) - new Date(meta.dateRange.from)) / 86400000) + 1 : null

  return (
    <section className="panel" data-panel="MODIS">
      <h3><PanelIcon name="satellite" /> {t('modis.title', 'SATELLITE SURFACE TEMPERATURE (NASA MODIS)')}</h3>
      {status === 'loading' && <div style={{ fontSize: 12, color: '#94a3b8' }}>{t('modis.loading', 'Loading NASA MODIS samples…')}</div>}
      {status === 'error' && <div style={{ fontSize: 12, color: '#94a3b8' }}>{t('modis.error', 'Satellite data file unavailable right now.')}</div>}
      {status === 'missing' && (
        <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.5 }}>
          {t('modis.missing', 'No quality-passed MODIS reading for this city in the current sample period ({{from}} → {{to}}) — cloud cover blocked every overpass, or the city is outside the sampled set. Nothing is estimated.', { from: meta?.dateRange?.from || '', to: meta?.dateRange?.to || '' })}
        </div>
      )}
      {status === 'ready' && summary && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8, marginBottom: 10 }}>
            <div className="metric-card" data-testid="modis-latest-day">
              <span className="metric-label">{t('modis.latestDay', 'LATEST CLEAR-SKY DAY')}</span>
              <span className="metric-value">{summary.latestDay ? `${summary.latestDay.c.toFixed(1)}°C` : '—'}</span>
              <span style={{ fontSize: 10, color: '#94a3b8' }}>{summary.latestDay ? `${t('modis.surface', 'surface')} · ${fmt(summary.latestDay.date)} ~10:30 IST` : ''}</span>
            </div>
            <div className="metric-card" data-testid="modis-latest-night">
              <span className="metric-label">{t('modis.latestNight', 'LATEST CLEAR-SKY NIGHT')}</span>
              <span className="metric-value">{summary.latestNight ? `${summary.latestNight.c.toFixed(1)}°C` : '—'}</span>
              <span style={{ fontSize: 10, color: '#94a3b8' }}>{summary.latestNight ? `${t('modis.surface', 'surface')} · ${fmt(summary.latestNight.date)} ~22:30 IST` : ''}</span>
            </div>
            <div className="metric-card" data-testid="modis-hottest">
              <span className="metric-label">{t('modis.hottest', 'HOTTEST SURFACE THIS SEASON')}</span>
              <span className="metric-value">{summary.hottestDay ? `${summary.hottestDay.c.toFixed(1)}°C` : '—'}</span>
              <span style={{ fontSize: 10, color: '#94a3b8' }}>{summary.hottestDay ? fmt(summary.hottestDay.date) : ''}</span>
            </div>
            <div className="metric-card" data-testid="modis-mean">
              <span className="metric-label">{t('modis.mean', 'SEASON MEAN DAY / NIGHT')}</span>
              <span className="metric-value">{summary.meanDay != null ? `${summary.meanDay.toFixed(1)}` : '—'} / {summary.meanNight != null ? `${summary.meanNight.toFixed(1)}°C` : '—'}</span>
              <span style={{ fontSize: 10, color: '#94a3b8' }}>{t('modis.clearDays', '{{n}} clear days of {{total}}', { n: summary.clearDays, total: totalDays ?? '?' })}</span>
            </div>
          </div>
          {series && series.length > 2 && (
            <div style={{ width: '100%', height: 170 }}>
              <ResponsiveContainer>
                <LineChart data={series} margin={{ top: 6, right: 10, left: -10, bottom: 0 }}>
                  <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#94a3b8' }} interval="preserveStartEnd" minTickGap={34} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} domain={[d => Math.floor(d - 1), d => Math.ceil(d + 1)]} tickFormatter={v => `${Math.round(v)}°`} allowDecimals={false} axisLine={false} tickLine={false} width={46} />
                  <Tooltip
                    contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 6, fontSize: 11 }}
                    labelFormatter={l => `${t('modis.weekOf', 'Week of')} ${l}`}
                    formatter={(v, name, p) => [`${v}°C (${name === 'day' ? p.payload.clearDays : p.payload.clearNights} ${t('modis.clearDaysShort', 'clear days')})`, name === 'day' ? t('modis.day', 'Day surface, weekly avg') : t('modis.night', 'Night surface, weekly avg')]}
                  />
                  <Legend wrapperStyle={{ fontSize: 10 }} formatter={v => (v === 'day' ? t('modis.day', 'Day surface, weekly avg') : t('modis.night', 'Night surface, weekly avg'))} />
                  {typeof liveTemp === 'number' && <ReferenceLine y={liveTemp} stroke="rgba(56,189,248,0.7)" strokeDasharray="4 3" label={{ value: `${t('modis.liveAir', 'live AIR now')} ${liveTemp}°C`, fontSize: 9, fill: '#7dd3fc', position: 'insideBottomRight' }} />}
                  {summary.hottestDay && (() => { const wk = series.find(w => w.date <= summary.hottestDay.date && summary.hottestDay.date < new Date(new Date(w.date + 'T00:00:00').getTime() + 7 * 86400000).toISOString().slice(0, 10)); return wk ? <ReferenceDot x={wk.label} y={wk.day ?? summary.hottestDay.c} r={5} fill="#ef4444" stroke="#fff" strokeWidth={1} label={{ value: `${t('modis.peak', 'peak')} ${summary.hottestDay.c}°`, fontSize: 9, fill: '#fca5a5', position: 'top' }} /> : null })()}
                  <Line type="monotone" dataKey="day" stroke="#f59e0b" strokeWidth={2.2} dot={{ r: 3 }} connectNulls={false} isAnimationActive={false} />
                  <Line type="monotone" dataKey="night" stroke="#818cf8" strokeWidth={1.6} dot={{ r: 2.5 }} connectNulls={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
          <div style={{ fontSize: 10, color: '#64748b', marginTop: 6, lineHeight: 1.5 }}>
            {t('modis.caveat', 'Land-surface temperature is what the satellite sees on roofs, roads and soil at overpass time — it runs several degrees above the air temperature a weather station reports on hot clear days. The two are different measurements; both are real.')}
            {' '}{t('modis.qc', 'Each point is the average of that week\'s clear-sky readings (hover for how many); weeks with no clear day are left empty. Cloud-blocked days are excluded by MODIS QC (good/other quality, LST error ≤ 2 K); nothing is interpolated.')}
            {' '}<span style={{ color: '#94a3b8' }}>{t('modis.source', 'Source: NASA LP DAAC MOD11A1.061 (Terra MODIS, 1 km) via AppEEARS point samples, {{from}} → {{to}}.', { from: meta?.dateRange?.from || '', to: meta?.dateRange?.to || '' })}</span>
          </div>
        </>
      )}
    </section>
  )
}
