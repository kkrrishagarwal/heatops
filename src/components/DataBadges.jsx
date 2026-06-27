// SECTION 2 - DATA SOURCE LABELS COMPONENTS
import { useTranslation } from 'react-i18next'

// Source badge for charts and cards. Only the "Source:" label is translated — the `source`
// text itself is a dataset citation (e.g. "ESA WorldCover 10m (2021) — real proxy for NDVI...",
// "MODIS ... Data in Brief, Elsevier"), which stays in its standard English form like any other
// dataset/proper-noun reference elsewhere in the app.
export function SourceBadge({ source }) {
  const { t } = useTranslation()
  return (
    <div style={{
      fontSize: 9,
      color: "rgba(255,255,255,0.35)",
      marginTop: 4,
      fontStyle: "italic",
      display: "flex",
      alignItems: "center",
      gap: 4
    }}>
      <span style={{
        color: "#00ff88",
        fontSize: 8
      }}>📡</span>
      {t('dataBadges.source', 'Source:')} {source}
    </div>
  )
}

