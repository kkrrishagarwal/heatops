import React from 'react'
import { useTranslation } from 'react-i18next'
import { SourceBadge } from './DataBadges'

// SECTION 13 - LAND USE / LAND COVER PANEL
//
// lulcData is the static JSON at public/data/lulc_real.json, produced by
// scripts/build_lulc_data.py — real ESA WorldCover 10m classification, read
// directly from the public no-auth S3 bucket, for one representative city
// per state (state capital / largest city). It is NOT available for every
// city in the app. When the selected city isn't in the dataset, this panel
// says so explicitly instead of estimating a number.
export function LandCoverPanel({ lulcData, cityName }) {
  const { t } = useTranslation()

  if (!lulcData) {
    return (
      <div style={{
        background: "rgba(10, 14, 26, 0.95)",
        border: "1px solid #1a3a5a",
        borderRadius: "12px",
        padding: "20px",
        marginBottom: "16px",
        color: "rgba(255,255,255,0.5)",
        fontSize: 12
      }}>
        Loading land cover data…
      </div>
    )
  }

  const cardStyle = {
    background: "rgba(10, 14, 26, 0.95)",
    border: "1px solid #1a3a5a",
    borderRadius: "12px",
    padding: "20px",
    marginBottom: "16px",
  }

  const titleStyle = {
    fontSize: "16px",
    fontWeight: "700",
    color: "#fff",
    marginBottom: "16px",
    display: "flex",
    alignItems: "center",
    gap: "8px"
  }

  const entry = lulcData.cities?.[cityName]

  if (!entry) {
    return (
      <div style={cardStyle}>
        <div style={titleStyle}>
          {t('landCover.panelTitle', '🌍 Land Use / Land Cover — {{cityName}}', { cityName })}
        </div>
        <div style={{
          padding: "12px 14px",
          background: "rgba(255,204,0,0.06)",
          border: "1px solid rgba(255,204,0,0.25)",
          borderRadius: 8,
          fontSize: 11,
          lineHeight: 1.6,
          color: "rgba(255,255,255,0.75)"
        }}>
          {t(
            'landCover.notAvailable',
            'No real classification computed for {{cityName}} yet — this panel only covers one representative city per state so far (see the state\'s capital/largest city). Showing an estimated number here would misrepresent it as real data, so it is intentionally left blank for this city.',
            { cityName }
          )}
        </div>
      </div>
    )
  }

  const segments = [
    { key: 'builtUp', label: t('landCover.builtUp', 'Built-up'), color: '#ff6b35', value: entry.builtUp },
    { key: 'vegetation', label: t('landCover.vegetation', 'Vegetation'), color: '#00ff88', value: entry.vegetation },
    { key: 'water', label: t('landCover.water', 'Water'), color: '#00a8ff', value: entry.water },
    { key: 'bareOther', label: t('landCover.bareOther', 'Bare Soil / Other'), color: '#94a3b8', value: entry.bareOther },
  ]

  return (
    <div style={cardStyle}>
      <div style={titleStyle}>
        {t('landCover.panelTitle', '🌍 Land Use / Land Cover — {{cityName}}', { cityName })}
      </div>

      <div style={{
        marginBottom: 14,
        padding: "8px 12px",
        background: "rgba(0,168,255,0.06)",
        border: "1px solid rgba(0,168,255,0.25)",
        borderRadius: 8,
        fontSize: 10,
        lineHeight: 1.5,
        color: "rgba(255,255,255,0.75)"
      }}>
        {t(
          'landCover.scopeNote',
          'Classified from a real ~{{radius}}km sample area around {{cityName}}\'s center — not a full administrative-boundary breakdown.',
          { radius: lulcData.source?.sampleAreaRadiusKm, cityName }
        )}
      </div>

      {/* Stacked bar */}
      <div style={{
        display: "flex",
        height: 24,
        borderRadius: 8,
        overflow: "hidden",
        border: "1px solid #1a2a4a",
        marginBottom: 14
      }}>
        {segments.map(s => (
          s.value > 0 && (
            <div
              key={s.key}
              title={`${s.label}: ${s.value}%`}
              style={{
                flex: `0 0 ${s.value}%`,
                background: s.color,
                opacity: 0.85
              }}
            />
          )
        ))}
      </div>

      {/* Legend / values */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
        {segments.map(s => (
          <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: s.color, flexShrink: 0 }} />
            <span style={{ color: "rgba(255,255,255,0.7)" }}>{s.label}</span>
            <span style={{ color: "#fff", fontWeight: 700, marginLeft: "auto" }}>{s.value}%</span>
          </div>
        ))}
      </div>

      <SourceBadge
        source={`${lulcData.source?.title} (${lulcData.source?.resolution}) — ${lulcData.source?.publisher}`}
      />
    </div>
  )
}
