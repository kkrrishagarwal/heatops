import React, { useMemo, useState } from 'react'
import PanelIcon from './PanelIcon'
import { assessHeatStress, heatIndexSteps, HEAT_INDEX_BANDS, WBGT_CATEGORIES } from '../utils/heatStress'

// HEAT STRESS panel — "how dangerous is the heat?" in plain words: what it feels like (NWS
// Heat Index), a danger word, what outdoor workers should do (work/rest from the ISO 7243
// WBGT estimate and TB MED 507) and the worst time of day. "Show the science" reveals the
// three technical numbers (Heat Index, Stull wet-bulb, WBGT) and every formula with today's
// values substituted, for the technical defence.
const card = { background: 'rgba(15,23,42,0.55)', border: '1px solid #1e293b', borderRadius: 10, padding: '10px 12px', minWidth: 0 }
const label = { fontSize: 10, color: '#94a3b8', letterSpacing: 0.7, textTransform: 'uppercase', marginBottom: 4 }
const PLAIN = {
  'extreme-danger': { label: 'EXTREMELY DANGEROUS', effect: 'Heat stroke is very likely. Stay indoors in a cool place.' },
  danger: { label: 'DANGEROUS', effect: 'Heat exhaustion is likely and heat stroke is possible. Avoid going out in the afternoon.' },
  'extreme-caution': { label: 'BE VERY CAREFUL', effect: 'Cramps or heat exhaustion can happen if you stay out long or work hard.' },
  caution: { label: 'TAKE CARE', effect: 'You may tire faster if you stay out long. Drink water.' },
  none: { label: 'SAFE', effect: 'No heat risk right now.' }
}
const mono = { fontFamily: '"IBM Plex Mono", ui-monospace, monospace', fontSize: 11, color: '#cbd5e1', lineHeight: 1.6, overflowWrap: 'anywhere' }

export default function HeatStressPanel({ liveWeather, city, simple = false }) {
  const [showMath, setShowMath] = useState(false)
  const { now, peak, demo } = useMemo(() => assessHeatStress(liveWeather), [liveWeather])

  if (!now) {
    return (
      <section className="panel" data-panel="HEAT-STRESS">
        <h3><PanelIcon name="thermometer" /> HEAT STRESS</h3>
        <div style={{ fontSize: 12, color: '#94a3b8' }}>
          {liveWeather?.isPartial || (liveWeather?.current && typeof liveWeather.current.humidity !== 'number')
            ? `Only a cached temperature is available for ${city || 'this city'} right now — heat stress needs live humidity. Use Force Refresh on the Health & Safety panel to retry the live reading.`
            : `Waiting for the live temperature and humidity for ${city || 'this city'}…`}
        </div>
      </section>
    )
  }

  const band = now.heatIndexBand
  const cat = now.wbgtCategory
  const steps = heatIndexSteps(now.temp, now.rh)

  // Plain-language wording for the headline: most readers (and many judges) do not know
  // what "Heat Index" or "WBGT" mean, so the panel leads with "feels like" and what to do;
  // the three technical numbers and their formulas sit behind "Show the science".
  const plain = PLAIN[band.key]
  const feels = steps?.offChart ? 'over 57' : `${now.heatIndex}`
  const [work, rest] = (cat.workRest.match(/\d+/g) || [])
  const workerLine = cat.cat >= 2 && work
    ? `Outdoor workers: work ${work} minutes, then rest ${rest} minutes in the shade, every hour. Drink ${cat.water.replace(' per hour', '')} of water an hour.`
    : 'Outdoor workers: normal working hours are fine — keep drinking water.'

  const headline = (
    <>
      <div data-testid="heat-feels" style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 26, fontWeight: 800, color: band.color }}>Feels like {feels}°C</span>
        <span style={{ fontSize: 12, fontWeight: 800, color: '#0f172a', background: band.color === '#15803d' ? '#22c55e' : band.color, borderRadius: 5, padding: '2px 8px' }}>{plain.label}</span>
      </div>
      <div style={{ fontSize: 13, color: '#e2e8f0', marginTop: 6 }}>
        The air is {now.temp}°C{now.rh >= 40 ? `, but ${now.rh}% humidity makes it feel hotter` : ` with ${now.rh}% humidity`}. {plain.effect}
      </div>
    </>
  )

  if (simple) {
    return (
      <section className="panel" data-panel="HEAT-STRESS" style={{ borderLeft: `4px solid ${band.color}` }}>
        <h3><PanelIcon name="thermometer" /> HOW HOT DOES IT FEEL?</h3>
        {headline}
        {cat.cat >= 2 && <div style={{ fontSize: 12, color: '#fbbf24', marginTop: 8 }}>{workerLine}</div>}
      </section>
    )
  }

  return (
    <section className="panel" data-panel="HEAT-STRESS" style={{ borderLeft: `4px solid ${band.color}` }}>
      <h3><PanelIcon name="thermometer" /> HOW DANGEROUS IS THE HEAT?</h3>
      {headline}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 10, fontSize: 12, color: '#cbd5e1' }}>
        <div data-testid="heat-workers">👷 {workerLine}</div>
        <div data-testid="heat-stress-peak">🕒 {peak
          ? <>Worst time in the next 24 hours: <b>{peak.time}</b> (feels like {peak.heatIndex}°C).</>
          : demo ? 'Worst time of day is not shown on a demo link.' : 'No hourly forecast to find the worst time of day.'}</div>
        {demo && <div style={{ fontSize: 10, color: '#94a3b8' }}>Demo link: temperature forced to {now.temp}°C; humidity recalculated for that temperature from today's real moisture{liveWeather?.demoHumidityFrom ? ` (${liveWeather.demoHumidityFrom.temp}°C / ${liveWeather.demoHumidityFrom.humidity}% → ${now.temp}°C / ${now.rh}%)` : ''}.</div>}
      </div>

      <button type="button" data-testid="heat-science-toggle" onClick={() => setShowMath(v => !v)} style={{ marginTop: 10, background: 'transparent', border: '1px solid #334155', color: '#fbbf24', borderRadius: 6, padding: '5px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
        {showMath ? 'Hide the science' : 'Show the science (for experts)'}
      </button>

      {showMath && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginTop: 10 }}>
          <div style={card} data-testid="heat-index">
            <div style={label}>Heat Index (US NWS)</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: band.color }}>{steps?.offChart ? '> 57°C' : `${now.heatIndex}°C`}</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: band.color }}>{band.label}</div>
            <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>The "feels like" number above: temperature + humidity.</div>
          </div>
          <div style={card} data-testid="wet-bulb">
            <div style={label}>Wet-bulb (Stull 2011)</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: now.wetBulb >= 31 ? '#dc2626' : now.wetBulb >= 28 ? '#f59e0b' : '#e2e8f0' }}>{now.wetBulb}°C</div>
            <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>How far sweat can cool the body. Around 31°C even healthy adults stop being able to cool down (Vecellio et al. 2022).</div>
          </div>
          <div style={card} data-testid="wbgt">
            <div style={label}>WBGT, shade (ISO 7243)</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: cat.cat >= 4 ? '#f87171' : cat.cat === 3 ? '#f59e0b' : '#e2e8f0' }}>{now.wbgt}°C</div>
            <div style={{ fontSize: 11, fontWeight: 700 }}>{cat.cat ? `Category ${cat.cat} · ${cat.flag} flag` : cat.label}</div>
            <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>The standard used to set work/rest times (US Army TB MED 507) — gives the workers' line above.</div>
          </div>
        </div>
      )}

      {showMath && steps && (
        <div data-testid="heat-stress-math" style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <div style={label}>1 · Heat Index — US National Weather Service</div>
            <div style={mono}>
              T = {now.temp}°C = {steps.tF}°F, RH = {now.rh}%<br />
              Simple form: HI = 0.5·(T + 61 + (T−68)·1.2 + 0.094·RH) = {steps.simpleF}°F<br />
              {steps.method === 'simple'
                ? <>Mean of simple HI and T is below 80°F → simple form used: HI = {steps.hiF}°F = <b>{steps.hiC}°C</b></>
                : <>Mean of simple HI and T ≥ 80°F → Rothfusz regression:<br />
                  HI = −42.379 + 2.04901523·T + 10.14333127·RH − 0.22475541·T·RH − 0.00683783·T² − 0.05481717·RH² + 0.00122874·T²·RH + 0.00085282·T·RH² − 0.00000199·T²·RH² = {steps.regressionF}°F<br />
                  {steps.adjustment === 'low-humidity' && <>Low-humidity adjustment (RH &lt; 13%, 80–112°F): −((13−RH)/4)·√((17−|T−95|)/17) = {steps.adjustmentF}°F<br /></>}
                  {steps.adjustment === 'high-humidity' && <>High-humidity adjustment (RH &gt; 85%, 80–87°F): ((RH−85)/10)·((87−T)/5) = +{steps.adjustmentF}°F<br /></>}
                  HI = {steps.hiF}°F = <b>{steps.hiC}°C</b>{steps.offChart && <> — above 135°F the NWS table ends and the regression is extrapolating; reported as "&gt; 57°C"</>}</>}
            </div>
          </div>
          <div>
            <div style={label}>2 · Wet-bulb — Stull (2011)</div>
            <div style={mono}>
              Tw = T·atan(0.151977·√(RH + 8.313659)) + atan(T + RH) − atan(RH − 1.676331) + 0.00391838·RH^1.5·atan(0.023101·RH) − 4.686035<br />
              with T = {now.temp}°C, RH = {now.rh}% → <b>Tw = {now.wetBulb}°C</b> (valid RH 5–99%, T −20…50°C; ±1°C)
            </div>
          </div>
          <div>
            <div style={label}>3 · WBGT — ISO 7243 (shade)</div>
            <div style={mono}>
              WBGT = 0.7·Tnw + 0.3·Tg, natural wet-bulb Tnw ≈ Tw, globe Tg ≈ air T in shade<br />
              = 0.7 × {now.wetBulb} + 0.3 × {now.temp} = <b>{now.wbgt}°C</b><br />
              No weather API reports globe (radiant) temperature, so in direct sun the true WBGT is higher — treat this as the floor.
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
            <table style={{ fontSize: 11, color: '#cbd5e1', borderCollapse: 'collapse' }}>
              <thead><tr style={{ color: '#94a3b8', textAlign: 'left' }}><th style={{ paddingBottom: 4 }}>Heat Index</th><th>Band</th></tr></thead>
              <tbody>{HEAT_INDEX_BANDS.map((b, i) => (
                <tr key={b.key} style={{ fontWeight: b.key === band.key ? 800 : 400 }}>
                  <td style={{ padding: '2px 8px 2px 0' }}>{i === 0 ? `≥ ${b.min}°C` : b.min === -Infinity ? `< ${HEAT_INDEX_BANDS[i - 1].min}°C` : `${b.min}–${HEAT_INDEX_BANDS[i - 1].min}°C`}</td>
                  <td style={{ color: b.color }}>{b.label}</td>
                </tr>
              ))}</tbody>
            </table>
            <table style={{ fontSize: 11, color: '#cbd5e1', borderCollapse: 'collapse' }}>
              <thead><tr style={{ color: '#94a3b8', textAlign: 'left' }}><th style={{ paddingBottom: 4 }}>WBGT</th><th>Cat.</th><th>Work / rest per hour</th></tr></thead>
              <tbody>{WBGT_CATEGORIES.filter(c => c.cat > 0).map((c, i, arr) => (
                <tr key={c.cat} style={{ fontWeight: c.cat === cat.cat ? 800 : 400 }}>
                  <td style={{ padding: '2px 8px 2px 0' }}>{i === 0 ? `≥ ${c.min}°C` : `${c.min}–${arr[i - 1].min}°C`}</td>
                  <td>{c.cat} {c.flag}</td>
                  <td>{c.workRest}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          <div style={{ fontSize: 10, color: '#64748b' }}>
            Sources: NWS Heat Index (Rothfusz 1990; NWS adjustments) · Stull, J. Appl. Meteor. Climatol. 50 (2011) 2267–2269 · ISO 7243:2017 WBGT · US Army TB MED 507 heat categories (moderate work, acclimatised workers). Inputs: Open-Meteo 2 m temperature and relative humidity.
          </div>
        </div>
      )}
    </section>
  )
}
