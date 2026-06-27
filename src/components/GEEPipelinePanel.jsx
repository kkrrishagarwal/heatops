import React from 'react'
import { useTranslation } from 'react-i18next'

// SECTION 12 - GEE REFERENCE PANEL
export function GEEPipelinePanel() {
  const { t } = useTranslation()
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
    marginBottom: "16px"
  }

  // This panel previously described a Google Earth Engine pipeline that was never actually
  // built — no GEE auth, no service account, no ee.Initialize() call anywhere in this repo.
  // Rewritten to describe what the app genuinely runs today.
  const steps = [
    {
      step: "1",
      title: "Open-Meteo (live)",
      detail: "Live surface/skin temperature, elevation (SRTM), AQI (CAMS) — no auth, free, real-time",
      color: "#00d4ff"
    },
    {
      step: "2",
      title: "ESA WorldCover 10m (2021)",
      detail: "Real Sentinel-1/2 classification, public AWS S3 — vegetation/built-up/water fractions for 36 representative cities",
      color: "#00ff88"
    },
    {
      step: "3",
      title: "SRTM Elevation",
      detail: "30m DEM, returned directly by the Open-Meteo Elevation API",
      color: "#ffcc00"
    },
    {
      step: "4",
      title: "Random Forest ML",
      detail: "sklearn RandomForestRegressor n=100, trained on real MODIS-derived data from 20 global cities (real, see Random Forest panel below — not India-specific)",
      color: "#ff2222"
    },
    {
      step: "5",
      title: "BhaskarOps Dashboard",
      detail: "React + D3 + Recharts real-time visualization",
      color: "#ffd700"
    }
  ]

  return (
    <div style={cardStyle}>
      <div style={titleStyle}>
        {t('geePipeline.panelTitle', '📡 Data Pipeline — Real Sources → BhaskarOps')}
      </div>
      <div style={{
        display:"flex",
        flexDirection:"column",
        gap:8,
        position: "relative"
      }}>
        {steps.map((s, i) => (
          <div key={i} style={{
            display:"flex",
            alignItems:"flex-start",
            gap:12,
            position: "relative"
          }}>
            <div style={{
              width:28, height:28,
              borderRadius:"50%",
              background:s.color,
              display:"flex",
              alignItems:"center",
              justifyContent:"center",
              fontSize:12,
              fontWeight:800,
              color:"#000",
              flexShrink:0,
              zIndex: 1
            }}>
              {s.step}
            </div>
            {i < steps.length-1 && (
              <div style={{
                position:"absolute",
                left:13, top:28,
                width:2, height:28,
                background:"rgba(255,255,255,0.1)",
                zIndex: 0
              }}/>
            )}
            <div>
              <div style={{
                fontSize:12,
                fontWeight:700,
                color:s.color
              }}>
                {s.title}
              </div>
              <div style={{
                fontSize:10,
                color:"rgba(255,255,255,0.5)",
                fontFamily:"monospace",
                marginTop:2
              }}>
                {s.detail}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
