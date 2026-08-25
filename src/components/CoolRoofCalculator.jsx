import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { SourceBadge } from './DataBadges'

// ─── COOL ROOF AWARENESS + ROI CALCULATOR ───────────────────────────────────
// Educational card explaining what cool roofs are + a personal ROI calculator.
// Physics model reuses the exact Albedo → °C formula from the Interventions tab
// slider (App.jsx: cooling = roofSlider * 14, where roofSlider is capped at 0.2 —
// the same coefficient used in PhysicsPanel.jsx). No new formula is introduced;
// each coating tier maps to an albedo boost within that same 0–0.2 slider range.

// Cost tiers sourced from real Indian pilot programs:
//   - Basic lime-wash: ₹0.5–2 per sq ft (Ahmedabad pilot, 2017)
//   - Premium reflective coating (elastomeric/acrylic): ₹15–30 per sq ft
// albedoBoost is the Δalbedo each tier achieves, expressed on the same 0–0.2
// scale as the Interventions tab's Cool Roof slider (lime-wash is a lighter
// treatment than the full reflective coating the slider's max represents).
const ROOF_COOLING_COEFFICIENT = 14 // °C per albedo unit — from App.jsx roofSlider*14 / PhysicsPanel.jsx
const MAX_ALBEDO_BOOST = 0.2 // matches the Interventions tab slider's max (roofSlider range 0–0.2)

const COST_TIERS = [
  { key: 'lime', label: 'Basic Lime-wash', minPerSqft: 0.5, maxPerSqft: 2, lifespanYears: 1, albedoBoost: 0.1 },
  { key: 'premium', label: 'Premium Reflective Coating', minPerSqft: 15, maxPerSqft: 30, lifespanYears: 5, albedoBoost: MAX_ALBEDO_BOOST },
]

// Average Indian residential electricity rate (₹/kWh) — used for AC savings estimate.
// National average for domestic consumers is ₹6–8/kWh across most states.
const AVG_ELECTRICITY_RATE = 7 // ₹ per kWh

// Estimated AC energy savings per sq ft of cool-roofed area per month during
// summer months (kWh). Derived from Ahmedabad/Hyderabad pilot data showing
// 20–40% reduction in cooling energy for treated buildings.
const AC_SAVINGS_KWH_PER_SQFT_PER_MONTH = 0.09

// Number of months per year where cooling savings apply (Indian summer: Mar–Oct)
const COOLING_MONTHS_PER_YEAR = 8

// Formats a ₹ amount using the Indian numbering system (thousand → lakh → crore →
// arab) instead of the international thousand/million/billion scale, since costs
// and savings shown here are meant to read naturally to an Indian user.
function formatINRAmount(amount) {
  const sign = amount < 0 ? '-' : ''
  const abs = Math.abs(amount)
  if (abs >= 1e9) return `${sign}${parseFloat((abs / 1e9).toFixed(2))} Arab`
  if (abs >= 1e7) return `${sign}${parseFloat((abs / 1e7).toFixed(2))} Cr`
  if (abs >= 1e5) return `${sign}${parseFloat((abs / 1e5).toFixed(2))} L`
  if (abs >= 1e3) return `${sign}${parseFloat((abs / 1e3).toFixed(1))}K`
  return `${sign}${Math.round(abs)}`
}

export function CoolRoofCalculator() {
  const { t } = useTranslation()
  const [roofArea, setRoofArea] = useState('')
  const [selectedTier, setSelectedTier] = useState('lime')

  const area = parseFloat(roofArea) || 0
  const tier = COST_TIERS.find(c => c.key === selectedTier) || COST_TIERS[0]

  // Cost range
  const costMin = area * tier.minPerSqft
  const costMax = area * tier.maxPerSqft
  const costAvg = (costMin + costMax) / 2

  // Temperature reduction — identical formula to the Interventions tab slider:
  // cooling(°C) = albedoBoost * 14. Each tier's albedoBoost is capped at the
  // same 0.2 the slider allows, so this number always matches what that slider
  // would show at an equivalent coating strength.
  const tempReduction = (tier.albedoBoost * ROOF_COOLING_COEFFICIENT).toFixed(1)

  // Monthly electricity savings
  const monthlySavings = area * AC_SAVINGS_KWH_PER_SQFT_PER_MONTH * AVG_ELECTRICITY_RATE
  const annualSavings = monthlySavings * COOLING_MONTHS_PER_YEAR

  // Payback period
  const paybackYears = annualSavings > 0 ? costAvg / annualSavings : 0

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
    marginBottom: '16px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  }

  return (
    <div style={cardStyle}>
      {/* ── SECTION A: Educational Card ── */}
      <div style={sectionTitle}>
        🏠 {t('coolRoof.title', 'Cool Roof — What It Is & Why It Works')}
      </div>

      <div style={{
        fontSize: '12px', color: 'rgba(255,255,255,0.8)', lineHeight: 1.7,
        marginBottom: '16px',
      }}>
        {t('coolRoof.explanation',
          'A cool roof uses a reflective coating (white paint, lime-wash, or specialized elastomeric coatings) to bounce sunlight back instead of absorbing it. This reduces indoor temperature by 2–5°C and can cut AC electricity bills by 20–40%.'
        )}
      </div>

      {/* Visual Comparison: Dark vs Cool Roof */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px',
        marginBottom: '16px',
      }}>
        {/* Dark Roof */}
        <div style={{
          background: 'linear-gradient(135deg, #3a1a1a 0%, #1a0a0a 100%)',
          border: '1px solid rgba(255, 80, 80, 0.3)',
          borderRadius: '10px', padding: '14px', textAlign: 'center',
        }}>
          <div style={{ fontSize: '28px', marginBottom: '6px' }}>🔥</div>
          <div style={{ fontSize: '13px', fontWeight: '700', color: '#ff6b6b', marginBottom: '4px' }}>
            {t('coolRoof.darkRoof', 'Dark Roof')}
          </div>
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>
            {t('coolRoof.darkDesc', 'Albedo 0.1–0.3')}
          </div>
          <div style={{ fontSize: '10px', color: 'rgba(255,100,100,0.8)', marginTop: '4px' }}>
            {t('coolRoof.darkAbsorbs', 'Absorbs 70–90% of solar heat')}
          </div>
          <div style={{
            marginTop: '8px', fontSize: '20px', fontWeight: '800', color: '#ff4444',
          }}>
            ↑ +5–15°C
          </div>
          <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)' }}>
            {t('coolRoof.darkSurface', 'surface temp above ambient')}
          </div>
        </div>

        {/* Cool Roof */}
        <div style={{
          background: 'linear-gradient(135deg, #1a2a3a 0%, #0a1a2a 100%)',
          border: '1px solid rgba(0, 200, 255, 0.3)',
          borderRadius: '10px', padding: '14px', textAlign: 'center',
        }}>
          <div style={{ fontSize: '28px', marginBottom: '6px' }}>❄️</div>
          <div style={{ fontSize: '13px', fontWeight: '700', color: '#00d4ff', marginBottom: '4px' }}>
            {t('coolRoof.coolRoof', 'Cool / Reflective Roof')}
          </div>
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>
            {t('coolRoof.coolDesc', 'Albedo 0.7–0.9')}
          </div>
          <div style={{ fontSize: '10px', color: 'rgba(0,200,255,0.8)', marginTop: '4px' }}>
            {t('coolRoof.coolReflects', 'Reflects 70–90% of solar heat')}
          </div>
          <div style={{
            marginTop: '8px', fontSize: '20px', fontWeight: '800', color: '#00ff88',
          }}>
            ↓ 2–5°C
          </div>
          <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)' }}>
            {t('coolRoof.coolSurface', 'indoor temperature reduction')}
          </div>
        </div>
      </div>

      {/* Real-world credibility */}
      <div style={{
        background: 'rgba(0, 255, 136, 0.05)',
        border: '1px solid rgba(0, 255, 136, 0.15)',
        borderRadius: '8px', padding: '10px 12px',
        fontSize: '11px', color: 'rgba(255,255,255,0.65)', lineHeight: 1.6,
        marginBottom: '20px',
      }}>
        <span style={{ color: '#00ff88', fontWeight: 700 }}>📍 {t('coolRoof.realWorld', 'Real-world adoption:')}</span>{' '}
        {t('coolRoof.realWorldText',
          'Telangana is India\'s first state to launch a formal Cool Roof Policy (2023–2028, April 2023). Ahmedabad and Hyderabad ran voluntary cool roof pilot programmes starting 2017, which became the foundation for this state-level policy. Multiple Indian cities now include cool roofs in their Heat Action Plans.'
        )}
      </div>

      {/* ── SECTION B: ROI Calculator ── */}
      <div style={{ ...sectionTitle, marginTop: '8px' }}>
        🧮 {t('coolRoof.calcTitle', 'Cool Roof ROI Calculator')}
      </div>

      {/* Input: Roof Area */}
      <div style={{ marginBottom: '14px' }}>
        <label style={{ fontSize: '12px', color: '#ffcc00', fontWeight: '700', display: 'block', marginBottom: '6px' }}>
          {t('coolRoof.roofAreaLabel', '📐 Your Roof Area (sq ft):')}
        </label>
        <input
          type="number"
          min="0"
          max="100000"
          placeholder="e.g. 1000"
          value={roofArea}
          onChange={e => setRoofArea(e.target.value)}
          style={{
            width: '100%', padding: '10px 14px', fontSize: '14px',
            background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,204,0,0.3)',
            borderRadius: '8px', color: '#fff', outline: 'none',
            fontFamily: 'monospace',
          }}
        />
      </div>

      {/* Coating Type Selector */}
      <div style={{ marginBottom: '16px' }}>
        <label style={{ fontSize: '12px', color: '#00d4ff', fontWeight: '700', display: 'block', marginBottom: '8px' }}>
          {t('coolRoof.coatingType', '🎨 Coating Type:')}
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          {COST_TIERS.map(c => (
            <button
              key={c.key}
              onClick={() => setSelectedTier(c.key)}
              style={{
                padding: '10px 12px', fontSize: '11px', fontWeight: '600',
                background: selectedTier === c.key
                  ? 'rgba(0, 212, 255, 0.15)'
                  : 'rgba(0,0,0,0.3)',
                border: selectedTier === c.key
                  ? '1px solid rgba(0, 212, 255, 0.5)'
                  : '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px', color: '#fff', cursor: 'pointer',
                transition: 'all 0.2s',
                textAlign: 'left',
              }}
            >
              <div style={{ color: selectedTier === c.key ? '#00d4ff' : 'rgba(255,255,255,0.7)' }}>
                {c.label}
              </div>
              <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>
                ₹{c.minPerSqft}–{c.maxPerSqft}/sq ft · {c.lifespanYears} {c.lifespanYears === 1 ? 'year' : 'years'} lifespan
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Results Grid */}
      {area > 0 && (
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px',
          marginTop: '4px',
        }}>
          {/* Cost Estimate */}
          <div style={{
            background: 'rgba(255, 204, 0, 0.06)',
            border: '1px solid rgba(255, 204, 0, 0.2)',
            borderRadius: '10px', padding: '14px',
          }}>
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {t('coolRoof.costEstimate', 'Coating Cost')}
            </div>
            <div style={{ fontSize: '22px', fontWeight: '800', color: '#ffcc00' }}>
              ₹{formatINRAmount(costMin)}–₹{formatINRAmount(costMax)}
            </div>
            <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>
              ₹{tier.minPerSqft}–{tier.maxPerSqft} × {area.toLocaleString()} sq ft
            </div>
          </div>

          {/* Temperature Reduction */}
          <div style={{
            background: 'rgba(0, 255, 136, 0.06)',
            border: '1px solid rgba(0, 255, 136, 0.2)',
            borderRadius: '10px', padding: '14px',
          }}>
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {t('coolRoof.tempReduction', 'Temp Reduction')}
            </div>
            <div style={{ fontSize: '22px', fontWeight: '800', color: '#00ff88' }}>
              ↓ {tempReduction}°C
            </div>
            <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>
              {t('coolRoof.tempBasis', `Albedo Δ+${tier.albedoBoost} × 14°C/unit (Interventions slider model)`)}
            </div>
          </div>

          {/* Monthly AC Savings */}
          <div style={{
            background: 'rgba(0, 136, 255, 0.06)',
            border: '1px solid rgba(0, 136, 255, 0.2)',
            borderRadius: '10px', padding: '14px',
          }}>
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {t('coolRoof.acSavings', 'AC Savings (Summer)')}
            </div>
            <div style={{ fontSize: '22px', fontWeight: '800', color: '#0088ff' }}>
              ₹{formatINRAmount(monthlySavings)}
              <span style={{ fontSize: '12px', fontWeight: '400' }}>/mo</span>
            </div>
            <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>
              ₹{formatINRAmount(annualSavings)}/year ({COOLING_MONTHS_PER_YEAR} cooling months)
            </div>
          </div>

          {/* Payback Period */}
          <div style={{
            background: 'rgba(168, 85, 247, 0.06)',
            border: '1px solid rgba(168, 85, 247, 0.2)',
            borderRadius: '10px', padding: '14px',
          }}>
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {t('coolRoof.payback', 'Payback Period')}
            </div>
            <div style={{ fontSize: '22px', fontWeight: '800', color: '#a855f7' }}>
              {paybackYears < 0.1 ? '< 1' : paybackYears < 1 ? Math.round(paybackYears * 12) : paybackYears.toFixed(1)}
              <span style={{ fontSize: '12px', fontWeight: '400' }}>
                {paybackYears < 1 ? ' months' : ' years'}
              </span>
            </div>
            <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>
              {t('coolRoof.paybackNote', 'cost recovered via AC savings')}
            </div>
          </div>
        </div>
      )}

      {/* Empty state prompt */}
      {area === 0 && (
        <div style={{
          textAlign: 'center', padding: '20px', fontSize: '12px',
          color: 'rgba(255,255,255,0.35)', fontStyle: 'italic',
        }}>
          {t('coolRoof.enterArea', '👆 Enter your roof area above to see cost estimates, savings & payback period')}
        </div>
      )}

      {/* Source Attribution */}
      <div style={{ marginTop: '14px', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
        <SourceBadge source="PhysicsPanel (Albedo Model)" />
        <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)' }}>
          {t('coolRoof.costSource', 'Costs: Ahmedabad/Telangana pilot data · Savings: @₹7/kWh avg domestic rate')}
        </span>
      </div>
    </div>
  )
}
