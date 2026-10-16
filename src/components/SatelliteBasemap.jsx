import React, { useMemo, useState } from 'react'

// Raster satellite basemap under the SVG India map, positioned with the SAME d3 Mercator
// projection the vector layers use, so imagery and borders line up exactly. Web-Mercator
// tiles (z/x/y) are placed by projecting each tile's NW and SE corners. Sources (no API key):
//   esri  — Esri World Imagery (Maxar / Earthstar Geographics), the Google-Maps-style view
//   gibs  — NASA GIBS VIIRS (Suomi NPP) true-colour, one image per calendar day, so the Live
//           Pass date shows the real satellite picture of India for that day (cloud and all).
//           VIIRS's 3,000 km swath leaves no orbit gaps over India, unlike MODIS Terra's.
// Tiles that fail to load (offline, missing date) are simply dropped — the dark surface shows.
const INDIA_BBOX = { west: 66, east: 98, south: 5, north: 38 }

export const BASEMAPS = {
  dark: { label: 'Dark', attribution: '' },
  esri: { label: 'Satellite', attribution: 'Imagery © Esri, Maxar, Earthstar Geographics, and the GIS User Community' },
  gibs: { label: 'NASA true colour', attribution: 'NASA EOSDIS GIBS / Worldview — VIIRS SNPP corrected reflectance (true colour)' }
}

function tileUrl(source, z, x, y, date) {
  if (source === 'gibs') return `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_SNPP_CorrectedReflectance_TrueColor/default/${date}/GoogleMapsCompatible_Level9/${z}/${y}/${x}.jpg`
  return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`
}
const lon2x = (lon, z) => Math.floor(((lon + 180) / 360) * 2 ** z)
const lat2y = (lat, z) => { const r = (lat * Math.PI) / 180; return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z) }
const x2lon = (x, z) => (x / 2 ** z) * 360 - 180
const y2lat = (y, z) => { const n = Math.PI - (2 * Math.PI * y) / 2 ** z; return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n))) }

// GIBS true colour needs a day that has been processed — yesterday is always safe.
export function gibsSafeDate(date) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return date
  const d = new Date(Date.now() - 36 * 3600 * 1000)
  return d.toISOString().slice(0, 10)
}

export default function SatelliteBasemap({ projection, source = 'esri', date, zoomScale = 1, width = 800, height = 600, opacity = 1 }) {
  const [failed, setFailed] = useState(() => new Set())
  const z = zoomScale >= 2.6 ? 6 : 5 // 16 tiles at z5, 64 at z6 — enough for the India view
  const tiles = useMemo(() => {
    const out = []
    const x0 = lon2x(INDIA_BBOX.west, z), x1 = lon2x(INDIA_BBOX.east, z)
    const y0 = lat2y(INDIA_BBOX.north, z), y1 = lat2y(INDIA_BBOX.south, z)
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
      const nw = projection([x2lon(x, z), y2lat(y, z)])
      const se = projection([x2lon(x + 1, z), y2lat(y + 1, z)])
      if (!nw || !se) continue
      out.push({ key: `${source}/${z}/${x}/${y}/${date || ''}`, x: nw[0], y: nw[1], w: se[0] - nw[0], h: se[1] - nw[1], url: tileUrl(source, z, x, y, date) })
    }
    return out
  }, [projection, source, date, z])
  if (source === 'dark') return null
  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }} aria-hidden="true" data-testid="basemap">
      <g opacity={opacity}>
        {tiles.filter(t => !failed.has(t.key)).map(t => (
          // +0.5 px overlap hides hairline seams between tiles after CSS scaling
          <image key={t.key} href={t.url} x={t.x} y={t.y} width={t.w + 0.5} height={t.h + 0.5} preserveAspectRatio="none" onError={() => setFailed(prev => new Set(prev).add(t.key))} />
        ))}
      </g>
    </svg>
  )
}
