import React from 'react'
import { useTranslation } from 'react-i18next'
import { SourceBadge } from './DataBadges'

// SECTION 8 - PHYSICS EXPLANATION PANEL
export function PhysicsPanel({ cityData }) {
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
    marginBottom: "16px",
    display: "flex",
    alignItems: "center",
    gap: "8px"
  }

  const items = [
    {
      icon: "🌳",
      title: t('physics.items.urbanGreening', 'Urban Greening'),
      physics: "Evapotranspiration releases latent heat, reducing sensible heat flux. Leaf albedo reflects 20-30% solar radiation.",
      formula: "LST ↓ = ΔET × λ / (ρCp)",
      cooling: "18°C per NDVI unit",
      where: "High NDBI zones (city center, commercial areas)",
      cost: "₹2-8 lakh per hectare"
    },
    {
      icon: "🏠",
      title: t('physics.items.coolRoofs', 'Cool Roofs'),
      physics: "High-albedo surfaces (α=0.7-0.9) reflect shortwave radiation. Reduces roof surface temp by 20-40°C directly.",
      formula: "Q_net = (1-α) × G_solar",
      cooling: "14°C per NDBI unit decrease",
      where: "Dense residential rooftops, industrial zones",
      cost: "₹50,000-2 lakh per 1000 sqm"
    },
    {
      icon: "💧",
      title: t('physics.items.waterBodies', 'Water Bodies'),
      physics: "Evaporative cooling via water vapor flux. Specific heat of water (4186 J/kgK) buffers temperature extremes.",
      formula: "Q_evap = m × L_v (2.26 MJ/kg)",
      cooling: "12°C per NDWI unit",
      where: "Parks, vacant lots, peripheral urban areas",
      cost: "₹5-20 lakh per hectare"
    }
  ]

  return (
    <div style={cardStyle}>
      <div style={titleStyle}>
        {t('physics.panelTitle', '⚛️ Physics of UHI Interventions')}
      </div>

      {items.map((item, idx) => (
        <div key={idx} style={{
          background:"rgba(0,255,136,0.03)",
          border:"1px solid rgba(0,255,136,0.1)",
          borderRadius:10,
          padding:14,
          marginBottom:10
        }}>
          <div style={{
            fontSize:14, fontWeight:700,
            color:"#00ff88", marginBottom:6
          }}>
            {item.icon} {item.title}
          </div>
          <div style={{
            fontSize:11,
            color:"rgba(255,255,255,0.7)",
            lineHeight:1.6,
            marginBottom:6
          }}>
            {item.physics}
          </div>
          <div style={{
            fontFamily:"monospace",
            fontSize:11,
            color:"#00d4ff",
            background:"rgba(0,0,0,0.3)",
            padding:"4px 8px",
            borderRadius:6,
            marginBottom:6
          }}>
            {item.formula}
          </div>
          <div style={{
            display:"grid",
            gridTemplateColumns:"1fr 1fr",
            gap:6, fontSize:11
          }}>
            <div>
              <span style={{
                color:"rgba(255,255,255,0.4)"
              }}>
                {t('physics.where', 'Where:')}{" "}
              </span>
              <span style={{color:"#fff"}}>
                {item.where}
              </span>
            </div>
            <div>
              <span style={{
                color:"rgba(255,255,255,0.4)"
              }}>
                {t('physics.cost', 'Cost:')}{" "}
              </span>
              <span style={{color:"#ffcc00"}}>
                {item.cost}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
