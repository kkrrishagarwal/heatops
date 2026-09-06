import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Legend } from 'recharts'
import PanelIcon from './PanelIcon'
import { fetchJson } from '../utils/fetchJson'

// NASA MODIS land-surface temperature for the selected city, from public/data/modis-lst/
// (built by scripts/processModisLst.mjs from AppEEARS point samples of MOD11A1.061).
// Real satellite readings only: cloud-blocked days are gaps, nothing is interpolated, and
// the QC rule that filtered them is printed. Surface temperature is not air temperature —
// the panel says so, because a 40 °C rooftop and a 33 °C weather station are both true.
let indexPromise = null
function loadIndex() {
  if (!indexPromise) indexPromise = fetchJson('/data/modis-lst/index.json', { timeoutMs: 20000 }).catch(e => { indexPromise = null; throw e })
  return indexPromise
}
const stateFiles = new Map()
function loadStateFile(file) {
  if (!stateFiles.has(file)) stateFiles.set(file, fetchJson(`/data/modis-lst/${file}`, { timeoutMs: 20000 }).catch(e => { stateFiles.delete(file); throw e }))
  return stateFiles.get(file)
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
    loadIndex().then(async idx => {
      if (cancelled) return
      setMeta(idx.meta)
      const s = idx.cities?.[`${city}|${state}`]
      if (!s) { setStatus('missing'); return }
      setSummary(s)
      const sf = await loadStateFile(s.file)
      if (cancelled) return
      const rows = (sf.cities?.[`${city}|${state}`] || []).map(([date, d, n]) => ({ date, label: fmt(date), day: d, night: n }))
      setSeries(rows); setStatus('ready')
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
                  <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 6, fontSize: 11 }} formatter={(v, name) => [`${v}°C`, name === 'day' ? t('modis.day', 'Day surface') : t('modis.night', 'Night surface')]} />
                  <Legend wrapperStyle={{ fontSize: 10 }} formatter={v => (v === 'day' ? t('modis.day', 'Day surface') : t('modis.night', 'Night surface'))} />
                  {typeof liveTemp === 'number' && <ReferenceLine y={liveTemp} stroke="rgba(56,189,248,0.6)" strokeDasharray="4 3" label={{ value: `${t('modis.liveAir', 'live air')} ${liveTemp}°C`, fontSize: 9, fill: '#7dd3fc', position: 'insideTopRight' }} />}
                  <Line type="monotone" dataKey="day" stroke="#f59e0b" strokeWidth={1.8} dot={{ r: 2 }} connectNulls={false} isAnimationActive={false} />
                  <Line type="monotone" dataKey="night" stroke="#818cf8" strokeWidth={1.5} dot={{ r: 2 }} connectNulls={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
          <div style={{ fontSize: 10, color: '#64748b', marginTop: 6, lineHeight: 1.5 }}>
            {t('modis.caveat', 'Land-surface temperature is what the satellite sees on roofs, roads and soil at overpass time — it runs several degrees above the air temperature a weather station reports on hot clear days. The two are different measurements; both are real.')}
            {' '}{t('modis.qc', 'Gaps are cloud-blocked days (kept out by MODIS QC: good/other quality, LST error ≤ 2 K); nothing is interpolated.')}
            {' '}<span style={{ color: '#94a3b8' }}>{t('modis.source', 'Source: NASA LP DAAC MOD11A1.061 (Terra MODIS, 1 km) via AppEEARS point samples, {{from}} → {{to}}.', { from: meta?.dateRange?.from || '', to: meta?.dateRange?.to || '' })}</span>
          </div>
        </>
      )}
    </section>
  )
}
