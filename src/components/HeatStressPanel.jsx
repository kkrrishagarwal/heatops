import React, { useMemo, useState } from 'react'
import PanelIcon from './PanelIcon'
import { assessHeatStress, heatIndexSteps, HEAT_INDEX_BANDS, WBGT_CATEGORIES } from '../utils/heatStress'

// HEAT STRESS panel — turns the live temperature + humidity into the three numbers that
// decide whether heat is dangerous to a human body: NWS Heat Index, Stull wet-bulb, and an
// ISO 7243 WBGT shade estimate with the TB MED 507 work/rest category. "Show the working"
// prints every formula with today's numbers substituted, for the technical defence.
const card = { background: 'rgba(15,23,42,0.55)', border: '1px solid #1e293b', borderRadius: 10, padding: '10px 12px', minWidth: 0 }
const label = { fontSize: 10, color: '#94a3b8', letterSpacing: 0.7, textTransform: 'uppercase', marginBottom: 4 }
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

  if (simple) {
    return (
      <section className="panel" data-panel="HEAT-STRESS" style={{ borderLeft: `4px solid ${band.color}` }}>
        <h3><PanelIcon name="thermometer" /> HOW THE HEAT FEELS</h3>
        <div style={{ fontSize: 22, fontWeight: 800, color: band.color }}>{steps?.offChart ? '> 57' : now.heatIndex}°C <span style={{ fontSize: 13 }}>{band.label}</span></div>
        <div style={{ fontSize: 12, color: '#cbd5e1', marginTop: 4 }}>{now.temp}°C air with {now.rh}% humidity feels like {now.heatIndex}°C. {band.effect}</div>
        {cat.cat >= 3 && <div style={{ fontSize: 12, color: '#fbbf24', marginTop: 6 }}>If you work outdoors: {cat.workRest}, and drink {cat.water}.</div>}
      </section>
    )
  }

  return (
    <section className="panel" data-panel="HEAT-STRESS" style={{ borderLeft: `4px solid ${band.color}` }}>
      <h3><PanelIcon name="thermometer" /> HEAT STRESS — HEAT INDEX · WET-BULB · WBGT</h3>
      <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 10 }}>
        From live air temperature {now.temp}°C and relative humidity {now.rh}%{demo ? ` (temperature forced by the ?demo link; humidity recomputed for that temperature from today's real moisture${liveWeather?.demoHumidityFrom ? ` — ${liveWeather.demoHumidityFrom.temp}°C / ${liveWeather.demoHumidityFrom.humidity}% → ${now.temp}°C / ${now.rh}%` : ''})` : ''}. Air temperature alone understates danger: humid heat stops sweat from cooling the body.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
        <div style={card} data-testid="heat-index">
          <div style={label}>Heat Index (NWS)</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: band.color }}>{steps?.offChart ? '> 57°C' : `${now.heatIndex}°C`}</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: band.color }}>{band.label}{steps?.offChart ? ' · beyond the NWS chart' : ''}</div>
          <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>{band.effect}</div>
        </div>
        <div style={card} data-testid="wet-bulb">
          <div style={label}>Wet-bulb (Stull 2011)</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: now.wetBulb >= 31 ? '#dc2626' : now.wetBulb >= 28 ? '#f59e0b' : '#e2e8f0' }}>{now.wetBulb}°C</div>
          <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>Lowest temperature sweat can cool skin to. Healthy adults lose the ability to shed heat at around 31°C wet-bulb (lab studies, Vecellio et al. 2022); 35°C is the theoretical limit.</div>
        </div>
        <div style={card} data-testid="wbgt">
          <div style={label}>WBGT — shade estimate</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: cat.cat >= 4 ? '#f87171' : cat.cat === 3 ? '#f59e0b' : '#e2e8f0' }}>{now.wbgt}°C</div>
          <div style={{ fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span aria-hidden="true" style={{ width: 12, height: 12, borderRadius: 2, background: cat.color, border: `2px solid ${cat.ring}` }} />
            {cat.cat ? `Category ${cat.cat} · ${cat.flag} flag` : cat.label}
          </div>
          <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>Outdoor work (moderate): {cat.workRest} · water {cat.water}</div>
        </div>
      </div>

      <div style={{ fontSize: 11, color: '#cbd5e1', marginTop: 10 }} data-testid="heat-stress-peak">
        {peak
          ? <>Worst hour in the next 24 h: <b>{peak.time}</b> — WBGT {peak.wbgt}°C (category {peak.wbgtCategory.cat}), Heat Index {peak.heatIndex}°C at {peak.temp}°C / {peak.rh}%.</>
          : demo ? 'Hourly peak not shown on a ?demo link — the hourly forecast is the real one and would not match the forced temperature.' : 'No hourly forecast to find the peak hour.'}
      </div>

      <button type="button" onClick={() => setShowMath(v => !v)} style={{ marginTop: 10, background: 'transparent', border: '1px solid #334155', color: '#fbbf24', borderRadius: 6, padding: '5px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
        {showMath ? 'Hide the working' : 'Show the working'}
      </button>

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
