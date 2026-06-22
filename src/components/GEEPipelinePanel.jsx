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

  const steps = [
    {
      step: "1",
      title: "Google Earth Engine",
      detail: "COPERNICUS/S2_SR_HARMONIZED + LANDSAT/LC08/C02/T1_L2",
      color: "#00d4ff"
    },
    {
      step: "2", 
      title: "Landsat 8 LST",
      detail: "Band ST_B10 → LST = 0.00341802 × DN + 149.0",
      color: "#ff6b35"
    },
    {
      step: "3",
      title: "Sentinel-2 Indices",
      detail: "NDVI=(B8-B4)/(B8+B4) | NDBI=(B11-B8)/(B11+B8) | NDWI=(B3-B8)/(B3+B8)",
      color: "#00ff88"
    },
    {
      step: "4",
      title: "SRTM Elevation",
      detail: "USGS/SRTMGL1_003 30m resolution DEM",
      color: "#ffcc00"
    },
    {
      step: "5",
      title: "Random Forest ML",
      detail: "sklearn RandomForestRegressor n=100 R²=0.95 MAE=0.91°C (real, see Random Forest panel below)",
      color: "#ff2222"
    },
    {
      step: "6",
      title: "HeatOps Dashboard",
      detail: "React + D3 + Recharts real-time visualization",
      color: "#ffd700"
    }
  ]

  return (
    <div style={cardStyle}>
      <div style={titleStyle}>
        {t('geePipeline.panelTitle', '📡 Data Pipeline — Google Earth Engine → HeatOps')}
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
