import React from 'react'
import { useTranslation } from 'react-i18next'

// SECTION 9 - SPATIAL RECOMMENDATION
export function SpatialRecommendation({
  cityData, cityName }) {
  const { t } = useTranslation()

  const hotZones = cityData.ndbi > 0.5
    ? t('spatial.hotZonesCBD', 'Central Business District, Industrial zones')
    : t('spatial.hotZonesResidential', 'Dense residential areas, Commercial corridors')

  const greenPriority = cityData.ndvi < 0.2
    ? t('spatial.greenCritical', 'CRITICAL — Less than 20% vegetation')
    : t('spatial.greenHigh', 'HIGH — Moderate vegetation deficit')

  return (
    <div style={{
      background:"rgba(255,204,0,0.05)",
      border:"1px solid rgba(255,204,0,0.2)",
      borderRadius:10,
      padding:14,
      marginTop:12
    }}>
      <div style={{
        fontSize:13,
        fontWeight:700,
        color:"#ffcc00",
        marginBottom:10
      }}>
        {t('spatial.panelTitle', '📍 WHERE to Intervene in {{cityName}}', { cityName })}
      </div>

      <div style={{
        fontSize:11,
        color:"rgba(255,255,255,0.8)",
        lineHeight:1.7
      }}>
        <b style={{color:"#ff6b35"}}>
          {t('spatial.hottestZones', '🔴 Hottest Zones:')}
        </b> {hotZones}
        <br/>
        <b style={{color:"#00ff88"}}>
          {t('spatial.greenPriority', '🌳 Green Priority:')}
        </b> {greenPriority}
        <br/>
        <b style={{color:"#0088ff"}}>
          {t('spatial.waterPriority', '💧 Water Priority:')}
        </b>{" "}
        {cityData.water_body_pct < 5
          ? t('spatial.waterUrgent', 'Water body creation urgent')
          : t('spatial.waterMaintain', 'Maintain existing water bodies')}
        <br/>
        <b style={{color:"#ffcc00"}}>
          {t('spatial.areaNeeded', '📏 Area needed:')}
        </b>{" "}
        {Math.round(
          cityData.area_sqkm * 0.15
        )} {t('spatial.areaDescription', 'km² of green cover for target NDVI ≥ 0.35')}
        <br/>
        <b style={{color:"#ff6b35"}}>
          {t('spatial.estimatedCost', '💰 Estimated cost:')}
        </b>{" "}
        ₹{(
          cityData.area_sqkm *
          0.15 * 100 * 3
        ).toFixed(0)} lakh{" "}
        {t('spatial.costNote', '(@ ₹3 lakh/hectare avg)')}
      </div>
    </div>
  )
}
