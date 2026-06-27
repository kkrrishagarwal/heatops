import React from 'react'
import { useTranslation } from 'react-i18next'
import { SourceBadge } from './DataBadges'

// SECTION 3 - ML MODEL PANEL
//
// mlModel is the static JSON at public/data/ml_model_real.json, produced by
// scripts/train_lst_model.py — a real RandomForestRegressor trained on real
// MODIS-derived satellite data (see disclosure block below). It is the same
// for every city since the model itself is global, not per-city; cityName is
// only used for the panel's heading.
export function MLModelPanel({ mlModel, cityName }) {
  const { t } = useTranslation()

  if (!mlModel) {
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
        {t('mlModel.loading', 'Loading model data…')}
      </div>
    )
  }

  const fi = mlModel.feature_importance || {}
  const holdout = mlModel.city_holdout || {}

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

  const statBox = {
    background: "rgba(0, 255, 136, 0.05)",
    border: "1px solid rgba(0, 255, 136, 0.2)",
    borderRadius: "8px",
    padding: "12px",
    textAlign: "center"
  }

  const statLabel = {
    fontSize: "10px",
    color: "rgba(255, 255, 255, 0.5)",
    textTransform: "uppercase",
    marginBottom: "6px"
  }

  const statVal = {
    fontSize: "20px",
    fontWeight: "700",
    marginBottom: "4px"
  }

  const statSub = {
    fontSize: "9px",
    color: "rgba(255, 255, 255, 0.4)",
    fontStyle: "italic"
  }

  const trainPct = mlModel.total_samples
    ? Math.round((mlModel.train_samples / mlModel.total_samples) * 100)
    : 80
  const testPct = 100 - trainPct

  return (
    <div style={cardStyle}>
      <div style={titleStyle}>
        {t('mlModel.panelTitle', '🤖 Random Forest Model — {{cityName}}', { cityName })}
      </div>

      {/* Honest data source disclosure — not buried, shown right at the top */}
      <div style={{
        marginBottom: 14,
        padding: "8px 12px",
        background: "rgba(255,204,0,0.06)",
        border: "1px solid rgba(255,204,0,0.25)",
        borderRadius: 8,
        fontSize: 10,
        lineHeight: 1.5,
        color: "rgba(255,255,255,0.75)"
      }}>
        ⚠️ {mlModel.disclosure}
      </div>

      {/* Model metadata */}
      <div style={{
        display:"grid",
        gridTemplateColumns:"1fr 1fr 1fr",
        gap:8, marginBottom:8
      }}>
        <div style={statBox}>
          <div style={statLabel}>{t('mlModel.r2Score', 'R² Score')}</div>
          <div style={{
            ...statVal,
            color:"#00ff88"
          }}>
            {mlModel.r2_score}
          </div>
          <div style={statSub}>{t('mlModel.testSet', 'Random split test')}</div>
        </div>
        <div style={statBox}>
          <div style={statLabel}>{t('mlModel.mae', 'MAE')}</div>
          <div style={{
            ...statVal,
            color:"#ffcc00"
          }}>
            {mlModel.mae}°C
          </div>
          <div style={statSub}>{t('mlModel.meanAbsError', 'Mean Abs Error')}</div>
        </div>
        <div style={statBox}>
          <div style={statLabel}>{t('mlModel.trainTest', 'Train/Test')}</div>
          <div style={{
            ...statVal,
            color:"#00d4ff",
            fontSize:16
          }}>
            {trainPct}/{testPct}
          </div>
          <div style={statSub}>{t('mlModel.splitRatio', 'Split ratio')}</div>
        </div>
      </div>

      {/* City-held-out generalization check — the stricter, more honest metric */}
      <div style={{
        marginBottom: 14,
        padding: "8px 12px",
        background: "rgba(255,107,53,0.05)",
        border: "1px solid rgba(255,107,53,0.2)",
        borderRadius: 8,
        fontSize: 10,
        lineHeight: 1.6,
        color: "rgba(255,255,255,0.65)"
      }}>
        <b style={{ color: "#ff6b35" }}>{t('mlModel.generalizationCheck', 'Unseen-city generalization check:')}</b>{' '}
        {t('mlModel.generalizationDetail', 'R² {{r2}} / MAE {{mae}}°C when entire cities ({{cities}}) are held out of training entirely, not just held-out years.', { r2: holdout.r2_score, mae: holdout.mae, cities: (holdout.held_out_cities || []).join(', ') })}
        {' '}{holdout.note}
      </div>

      {/* Train/Test split visual */}
      <div style={{marginBottom:14}}>
        <div style={{
          fontSize:10,
          color:"rgba(255,255,255,0.5)",
          marginBottom:6
        }}>
          {t('mlModel.datasetSplit', 'Dataset Split ({{n}} samples)', { n: mlModel.total_samples })}
        </div>
        <div style={{
          display:"flex",
          height:20,
          borderRadius:6,
          overflow:"hidden",
          border:"1px solid #1a2a4a"
        }}>
          <div style={{
            flex:`0 0 ${trainPct}%`,
            background:"rgba(0,255,136,0.4)",
            display:"flex",
            alignItems:"center",
            justifyContent:"center",
            fontSize:10,
            color:"#00ff88",
            fontWeight:700
          }}>
            {t('mlModel.trainSamples', 'Train ({{n}} samples)', { n: mlModel.train_samples })}
          </div>
          <div style={{
            flex:`0 0 ${testPct}%`,
            background:"rgba(255,107,53,0.4)",
            display:"flex",
            alignItems:"center",
            justifyContent:"center",
            fontSize:10,
            color:"#ff6b35",
            fontWeight:700
          }}>
            {t('mlModel.testSamples', 'Test ({{n}})', { n: mlModel.test_samples })}
          </div>
        </div>
      </div>

      {/* Feature importance bars */}
      <div style={{
        fontSize:11,
        color:"rgba(255,255,255,0.5)",
        marginBottom:8
      }}>
        {t('mlModel.featureImportance', 'Feature Importance (Gini)')}
      </div>
      {[
        { key:"ndbi", label:"NDBI", color:"#ff2222" },
        { key:"ndvi", label:"NDVI", color:"#00ff88" },
        { key:"elevation",label:t('mlModel.elevation', 'Elevation'),color:"#888" },
      ].map(f => (
        <div key={f.key} style={{marginBottom:8}}>
          <div style={{
            display:"flex",
            justifyContent:"space-between",
            fontSize:11, marginBottom:4
          }}>
            <span style={{color:"#fff"}}>{f.label}</span>
            <span style={{
              color:f.color,
              fontWeight:700
            }}>
              {fi[f.key]?.toFixed(2) || "N/A"}
            </span>
          </div>
          <div style={{
            height:8,
            background:"#0a0e1a",
            borderRadius:4,
            overflow:"hidden"
          }}>
            <div style={{
              height:"100%",
              width:`${(fi[f.key]||0)*100}%`,
              background:f.color,
              borderRadius:4,
              transition:"width 1s ease"
            }}/>
          </div>
        </div>
      ))}

      {/* Model info */}
      <div style={{
        marginTop:12,
        padding:"8px 12px",
        background:"rgba(0,255,136,0.05)",
        borderRadius:8,
        border:"1px solid rgba(0,255,136,0.1)"
      }}>
        <div style={{
          fontSize:10,
          color:"rgba(255,255,255,0.5)",
          lineHeight:1.6
        }}>
          <b style={{color:"#00ff88"}}>
            {t('mlModel.model', 'Model:')}</b> RandomForestRegressor
          (n_estimators=100, max_depth=None,
          random_state=42)<br/>
          <b style={{color:"#00ff88"}}>
            {t('mlModel.features', 'Features:')}</b> NDVI, NDBI, Elevation<br/>
          <b style={{color:"#00ff88"}}>
            {t('mlModel.target', 'Target:')}</b> {mlModel.target}<br/>
          <b style={{color:"#00ff88"}}>
            {t('mlModel.source', 'Source:')}</b> {mlModel.source?.title} — {mlModel.source?.publisher}, DOI: {mlModel.source?.doi}
        </div>
      </div>

      <SourceBadge
        source={`MODIS (${mlModel.cities} global cities, ${mlModel.year_range}) — Data in Brief, Elsevier`}
      />
    </div>
  )
}
