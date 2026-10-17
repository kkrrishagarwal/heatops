// Continuous thermal raster for the Command Center (NOAA / Windy style). Inverse-distance
// weighting of the active layer's city points onto a coarse screen grid, upscaled with the
// browser's bilinear filter, then clipped to India's outline (the union of the district
// polygons) so nothing is painted over sea or neighbouring countries. A cell farther than
// ~150 km from any city is left transparent — nothing is invented.
const K = 8
const MAX_DEG = 1.5 // dense layers
const MAX_DEG_SPARSE = 4 // ~170-city layers reach farther, so the field is continuous over India
const CELL = 6 // screen px per sample; 1440×900 → ~36k samples, a few ms

function buildBins(points) {
  const bins = new Map()
  for (const p of points) { if (typeof p.lat !== 'number' || typeof p.value !== 'number') continue; const k = `${Math.floor(p.lat)},${Math.floor(p.lon)}`; if (!bins.has(k)) bins.set(k, []); bins.get(k).push(p) }
  return bins
}
function idw(bins, lat, lon, maxDeg = MAX_DEG) {
  const found = []
  const bl = Math.floor(lat), bo = Math.floor(lon)
  for (let r = 0; r <= 4; r++) {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue
      const b = bins.get(`${bl + dy},${bo + dx}`); if (b) for (const p of b) found.push(p)
    }
    if (found.length >= K) break
  }
  if (!found.length) return null
  const cosLat = Math.cos((lat * Math.PI) / 180)
  const near = found.map(p => { const dx = (p.lon - lon) * cosLat, dy = p.lat - lat; return { p, d2: dx * dx + dy * dy } }).sort((a, b) => a.d2 - b.d2).slice(0, K)
  if (near[0].d2 > maxDeg * maxDeg) return null
  let w = 0, v = 0
  for (const { p, d2 } of near) { const ww = 1 / (d2 + 2e-4); w += ww; v += p.value * ww }
  return v / w
}

// canvas: sized to the map container; project(lat, lon) → [x, y]; unproject(x, y) → [lat, lon]
// rgbOf(value) → [r, g, b]; maskFeatures: GeoJSON features whose union is India
export function drawThermalRaster({ canvas, width, height, points, unproject, project, rgbOf, maskFeatures, alpha = 0.9 }) {
  const ctx = canvas.getContext('2d')
  canvas.width = width; canvas.height = height
  ctx.clearRect(0, 0, width, height)
  if (!points?.length) return { samples: 0, filled: 0 }
  const bins = buildBins(points)
  const maxDeg = points.length < 500 ? MAX_DEG_SPARSE : MAX_DEG
  const cols = Math.ceil(width / CELL) + 1, rows = Math.ceil(height / CELL) + 1
  const small = document.createElement('canvas'); small.width = cols; small.height = rows
  const sctx = small.getContext('2d')
  const img = sctx.createImageData(cols, rows)
  let filled = 0
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const [lat, lon] = unproject(c * CELL, r * CELL)
    const v = idw(bins, lat, lon, maxDeg)
    const i = (r * cols + c) * 4
    if (v == null) { img.data[i + 3] = 0; continue }
    const [R, G, B] = rgbOf(v)
    img.data[i] = R; img.data[i + 1] = G; img.data[i + 2] = B; img.data[i + 3] = Math.round(alpha * 255)
    filled++
  }
  sctx.putImageData(img, 0, 0)
  // upscale smoothly, then clip to India
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(small, 0, 0, cols, rows, 0, 0, cols * CELL, rows * CELL)
  if (maskFeatures?.length) {
    ctx.globalCompositeOperation = 'destination-in'
    ctx.beginPath()
    for (const f of maskFeatures) {
      const g = f.geometry; if (!g) continue
      const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : []
      for (const poly of polys) for (const ring of poly) {
        ring.forEach(([lon, lat], k) => { const [x, y] = project(lat, lon); if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y) })
        ctx.closePath()
      }
    }
    ctx.fillStyle = '#000'; ctx.fill('nonzero')
    ctx.globalCompositeOperation = 'source-over'
  }
  return { samples: cols * rows, filled }
}
