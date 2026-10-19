import React, { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { fetchJson } from '../utils/fetchJson'
import { districtKey, districtName } from '../utils/districtHeat'
import { drawThermalRaster } from '../utils/thermalRaster'
import { JK_STATE_BOUNDARIES } from '../utils/jkStateBoundaries'

// Deep-zoom tile map for the Command Center (the classic screen keeps its SVG map). Leaflet,
// no API key. Zoom 4 (all of India) → 19 (city blocks). Layers, bottom to top:
//   base      dark   — Esri World Dark Gray canvas (streets and labels appear as you zoom in)
//             esri   — Esri World Imagery (Maxar), native to z19, the Google-Earth look
//             gibs   — NASA GIBS VIIRS true colour, one image per day (native 250 m, z ≤ 9;
//                      over-zoomed beyond that, so it is a weather-scale overlay, not a
//                      building-scale one)
//   reference         Esri World Transportation + Boundaries & Places over imagery from z ≥ 11:
//                     real roads, rail and labels. (No ward-boundary dataset exists for India
//                     in this project, so nothing claims to be a ward.)
//   states/districts  the same simplified GeoJSON as the classic map, coloured from stateData
//                     (so the scrubber, composite and layer choice all apply), crisp at any
//                     zoom because Leaflet re-renders the vectors per zoom level
//   points            optional city readings; focus ring on the selected city
// Tiles that fail (offline) simply stay blank; the vectors and HUD keep working.
const GEO_VERSION = '2026-09-08b'
const URLS = {
  states: `/data/india_states_full.geojson?v=${GEO_VERSION}`,
  districts: `/data/india_districts_full.geojson?v=${GEO_VERSION}`,
  jk: `/data/jk_ladakh_official.geojson?v=${GEO_VERSION}`
}
const INDIA_BOUNDS = L.latLngBounds([5.5, 66.5], [37.6, 98.5])
const ATTR = {
  dark: 'Basemap © Esri, HERE, Garmin, OpenStreetMap contributors',
  esri: 'Imagery © Esri, Maxar, Earthstar Geographics, and the GIS User Community',
  gibs: 'NASA EOSDIS GIBS / Worldview — VIIRS SNPP true colour'
}
const NO_DATA_FILL = '#334155'

let geoCache = null
function loadGeo() {
  if (!geoCache) geoCache = Promise.all([fetchJson(URLS.states, { timeoutMs: 90000 }), fetchJson(URLS.districts, { timeoutMs: 90000 }), fetchJson(URLS.jk, { timeoutMs: 90000 })]).catch(err => { geoCache = null; throw err })
  return geoCache
}

export default function HudLeafletMap({ stateData, resolveStateName, points = [], focus = null, basemap = 'dark', basemapDate = null, selectedState = null, onStateClick = () => {}, onZoomChange = () => {}, showDots = false, showFills = true, tooltipText = () => '', controlRef, districtHeat = null, onDistrictClick = () => {}, onGeoLoaded = () => {}, detailZoom = 6, raster = false, rasterPoints = null, rgbOf = null, fillStrength = 0.88 }) {
  const elRef = useRef(null)
  const mapRef = useRef(null)
  const layersRef = useRef({})
  const dataRef = useRef({ stateData, resolveStateName, tooltipText, onStateClick, districtHeat, onDistrictClick })
  const basemapRef = useRef(basemap)
  basemapRef.current = basemap
  const fillsRef = useRef(showFills)
  fillsRef.current = showFills
  const rasterRef = useRef({ raster, rasterPoints, rgbOf })
  rasterRef.current = { raster, rasterPoints, rgbOf }
  const fillStrengthRef = useRef(fillStrength)
  fillStrengthRef.current = fillStrength
  const selectedRef = useRef(selectedState)
  selectedRef.current = selectedState
  // Semantic zoom: per-district colours and crisp district borders once zoomed to z ≥ detailZoom
  // or a state is selected; a clean state-level choropleth otherwise.
  // National zoom: only the SELECTED state shows its districts; from detailZoom every state does.
  const isDetail = () => { const m = mapRef.current; return !!(m && m.getZoom() >= detailZoom) }
  const isDetailFor = (feature) => isDetail() || (!!selectedRef.current && dataRef.current.resolveStateName(feature) === selectedRef.current)
  dataRef.current = { stateData, resolveStateName, tooltipText, onStateClick, districtHeat, onDistrictClick }

  // ── create the map once ─────────────────────────────────────────────────
  useEffect(() => {
    if (!elRef.current || mapRef.current) return undefined
    const map = L.map(elRef.current, { zoomControl: false, attributionControl: true, minZoom: 4, maxZoom: 19, zoomSnap: 0.25, wheelPxPerZoomLevel: 90, worldCopyJump: false, preferCanvas: false })
    map.attributionControl.setPosition('bottomleft').setPrefix(false)
    map.fitBounds(INDIA_BOUNDS, { padding: [10, 10] })
    map.setMaxBounds(INDIA_BOUNDS.pad(0.6))
    mapRef.current = map
    const panes = { base: 100, raster: 300, ref: 350, vectors: 400, points: 450 }
    for (const [name, z] of Object.entries(panes)) { map.createPane(name); map.getPane(name).style.zIndex = String(z) }
    map.on('zoomend', () => { onZoomChange(map.getZoom()); restyle() })
    const rc = L.DomUtil.create('canvas', 'hud-raster', map.getPane('raster'))
    rc.style.position = 'absolute'; rc.style.pointerEvents = 'none'
    layersRef.current.rasterCanvas = rc
    const redrawRaster = () => {
      const { raster: on, rasterPoints: pts, rgbOf: rgb } = rasterRef.current
      const sz = map.getSize()
      L.DomUtil.setPosition(rc, map.containerPointToLayerPoint([0, 0]))
      rc.style.width = `${sz.x}px`; rc.style.height = `${sz.y}px`
      if (!on || !pts || !rgb) { rc.width = 1; rc.height = 1; return }
      drawThermalRaster({ canvas: rc, width: sz.x, height: sz.y, points: pts, rgbOf: rgb, maskFeatures: layersRef.current.maskFeatures || [],
        unproject: (x, y) => { const ll = map.containerPointToLatLng([x, y]); return [ll.lat, ll.lng] },
        project: (lat, lon) => { const p = map.latLngToContainerPoint([lat, lon]); return [p.x, p.y] } })
    }
    layersRef.current.redrawRaster = redrawRaster
    map.on('moveend', redrawRaster); map.on('resize', redrawRaster)
    map.on('zoomstart', () => { rc.width = 1; rc.height = 1 })
    if (controlRef) controlRef.current = {
      zoomIn: () => map.zoomIn(1), zoomOut: () => map.zoomOut(1), reset: () => map.fitBounds(INDIA_BOUNDS, { padding: [10, 10] }), flyTo: (lat, lon, z = 11) => map.flyTo([lat, lon], z, { duration: 1.2 }), getZoom: () => map.getZoom(),
      // for overlays drawn in screen space (wind particles): geo ↔ container pixels, size, and
      // a way to follow pans/zooms
      project: (lat, lon) => { const p = map.latLngToContainerPoint([lat, lon]); return [p.x, p.y] },
      unproject: (x, y) => { const ll = map.containerPointToLatLng([x, y]); return [ll.lat, ll.lng] },
      getSize: () => { const sz = map.getSize(); return [sz.x, sz.y] },
      on: (evt, fn) => { map.on(evt, fn); return () => map.off(evt, fn) },
      getContainer: () => map.getContainer()
    }
    onZoomChange(map.getZoom())

    // vector layers
    const style = (feature) => {
      const name = dataRef.current.resolveStateName(feature)
      const d = dataRef.current.stateData?.[name]
      const color = d?.riskBucket?.color || NO_DATA_FILL
      return { color: '#ffffff', weight: 1.2, opacity: 0.9, fillColor: color, fillOpacity: 0.45 }
    }
    const districtStyle = (feature) => ({ ...style(feature), color: '#0a1628', weight: 0.5, opacity: 0.6, fillOpacity: 0.35 })
    const bind = (feature, layer) => {
      layer.on({
        mouseover: e => {
          if (isDetailFor(feature)) { e.target.setStyle({ weight: 2.5, color: '#f59e0b', opacity: 1 }); e.target.bringToFront() }
          else { const sl = layersRef.current.stateByName?.get(dataRef.current.resolveStateName(feature)); if (sl) { sl.setStyle({ color: '#f59e0b', weight: 2.5 }); sl.bringToFront() } }
        },
        // Restore the OUTLINE only — the fill is owned by restyle() (colours toggle, zoom fade),
        // so resetting the whole style here would re-paint a state the user switched off.
        mouseout: e => {
          const name = dataRef.current.resolveStateName(feature)
          const sl = layersRef.current.stateByName?.get(name)
          if (sl) sl.setStyle(name === selectedRef.current ? { color: '#38bdf8', weight: 3 } : { color: '#ffffff', weight: 1.2 })
          if (e.target.options.district) { const det = isDetailFor(feature); const onR = rasterRef.current.raster; e.target.setStyle({ color: onR ? 'rgba(255,255,255,0.35)' : '#0a1628', weight: det ? 0.8 : 0.5, opacity: det ? 0.65 : (onR ? 0.2 : 0.12) }) }
          else e.target.setStyle(name === selectedRef.current ? { color: '#38bdf8', weight: 3, opacity: 0.9 } : { color: '#ffffff', weight: 1.2, opacity: 0.9 })
        },
        click: () => {
          const d = layer.options.district && isDetailFor(feature) ? dataRef.current.districtHeat?.[districtKey(feature)] : null
          if (d?.city) dataRef.current.onDistrictClick(d.city, d.state)
          else dataRef.current.onStateClick(dataRef.current.resolveStateName(feature))
        }
      })
      layer.bindTooltip(() => {
        const state = dataRef.current.resolveStateName(feature)
        const d = layer.options.district && isDetailFor(feature) ? dataRef.current.districtHeat?.[districtKey(feature)] : null
        if (!d) return dataRef.current.tooltipText(state)
        const unit = dataRef.current.districtHeat.__unit || '°C'
        const src = d.method === 'direct' ? `reading from ${d.city}` : d.method === 'nearest' ? `nearest cities: ${d.cities.join(', ')}` : d.method === 'far' ? `estimated (rounded) from ${d.cities.join(', ')} — sparse layer` : 'no city reading within reach'
        return `<b>${districtName(feature)}</b>, ${state}<br>${d.value == null ? '<span class="t-muted">no reading</span>' : `<b>${d.value}${unit}</b>`} <span class="t-badge" style="background:${d.color}">${d.label || ''}</span><br><span class="t-muted">${src}</span>${d.city ? `<br><span class="t-muted">click to open ${d.city}</span>` : ''}`
      }, { sticky: true, direction: 'top', opacity: 0.95, className: 'hud-leaflet-tip' })
    }
    loadGeo().then(([states, districts, jk]) => {
      if (mapRef.current !== map) return // this map was torn down (StrictMode double-mount) before the data arrived
      const isJK = f => /jammu|kashmir|ladakh/i.test(dataRef.current.resolveStateName(f) || '')
      const nonJkStates = (states.features || []).filter(f => !isJK(f))
      const stateFeatures = {
        type: 'FeatureCollection',
        features: [...nonJkStates, ...(JK_STATE_BOUNDARIES.features || [])]
      }
      const districtFeatures = { type: 'FeatureCollection', features: (districts.features || []).filter(f => !isJK(f)) }
      const jkFeatures = { type: 'FeatureCollection', features: (jk.features || []) }
      layersRef.current.districts = L.geoJSON(districtFeatures, { pane: 'vectors', style: districtStyle, onEachFeature: (f, l) => { l.options.district = true; bind(f, l) } }).addTo(map)
      layersRef.current.jk = L.geoJSON(jkFeatures, { pane: 'vectors', style, onEachFeature: (f, l) => { l.options.district = true; bind(f, l) } }).addTo(map)
      layersRef.current.states = L.geoJSON(stateFeatures, { pane: 'vectors', interactive: false, style: f => ({ ...style(f), fillOpacity: 0 }) }).addTo(map)
      layersRef.current.stateByName = new Map()
      layersRef.current.states.eachLayer(l => layersRef.current.stateByName.set(dataRef.current.resolveStateName(l.feature), l))
      layersRef.current.maskFeatures = [...districtFeatures.features, ...jkFeatures.features]
      onGeoLoaded(layersRef.current.maskFeatures)
      restyle(); layersRef.current.redrawRaster?.()
    }).catch(err => console.warn('[HudLeafletMap] geo load failed:', err?.message))

    return () => { map.remove(); mapRef.current = null; layersRef.current = {} }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── recolour vectors when the scrubbed data changes ─────────────────────
  const restyle = () => {
    const { districts, states, jk } = layersRef.current
    const map = mapRef.current
    const sd = dataRef.current.stateData
    const colorOf = f => sd?.[dataRef.current.resolveStateName(f)]?.riskBucket?.color || NO_DATA_FILL
    // The heat tint carries the data at national scale; at street scale it only hides the
    // roads, so it fades from full strength at z8 to a light wash by z14.
    const z = map ? map.getZoom() : 5
    const fade = z <= 8 ? 1 : z >= 14 ? 0.3 : 1 - ((z - 8) / 6) * 0.7
    const onRaster = rasterRef.current.raster
    const base = !fillsRef.current || onRaster ? 0 : (basemapRef.current === 'dark' ? fillStrengthRef.current : Math.min(0.6, fillStrengthRef.current))
    const dh = dataRef.current.districtHeat
    const distColor = (f, det) => (det && dh?.[districtKey(f)] ? dh[districtKey(f)].color : colorOf(f))
    const edge = onRaster ? 'rgba(255,255,255,0.35)' : '#0a1628'
    districts?.eachLayer(l => { const det = isDetailFor(l.feature); l.setStyle({ fillColor: distColor(l.feature, det), fillOpacity: base * 0.9 * fade, color: edge, opacity: det ? 0.65 : (onRaster ? 0.2 : 0.12), weight: det ? 0.8 : 0.5 }) })
    jk?.eachLayer(l => { const det = isDetailFor(l.feature); l.setStyle({ fillColor: distColor(l.feature, det), fillOpacity: base * fade, color: edge, opacity: det ? 0.65 : (onRaster ? 0.2 : 0.12), weight: det ? 0.8 : 0.5 }) })
    states?.eachLayer(l => l.setStyle({ color: dataRef.current.resolveStateName(l.feature) === selectedState ? '#38bdf8' : '#ffffff', weight: dataRef.current.resolveStateName(l.feature) === selectedState ? 3 : 1.2 }))
  }
  useEffect(() => { restyle() }, [stateData, selectedState, showFills, districtHeat, raster, fillStrength]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { layersRef.current.redrawRaster?.() }, [raster, rasterPoints, rgbOf])

  // ── base + reference tiles ──────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current; if (!map) return
    const L0 = layersRef.current
    if (L0.base) { map.removeLayer(L0.base); L0.base = null }
    if (L0.ref) { map.removeLayer(L0.ref); L0.ref = null }
    if (L0.ref2) { map.removeLayer(L0.ref2); L0.ref2 = null }
    const common = { pane: 'base', maxZoom: 19, crossOrigin: true, errorTileUrl: '' }
    if (basemap === 'esri') {
      L0.base = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { ...common, maxNativeZoom: 19, attribution: ATTR.esri }).addTo(map)
      L0.ref = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}', { pane: 'ref', maxZoom: 19, maxNativeZoom: 19, minZoom: 11, opacity: 0.9, crossOrigin: true, errorTileUrl: '' }).addTo(map)
      L0.ref2 = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', { pane: 'ref', maxZoom: 19, maxNativeZoom: 19, minZoom: 9, opacity: 0.9, crossOrigin: true, errorTileUrl: '' }).addTo(map)
    } else if (basemap === 'gibs' && basemapDate) {
      L0.base = L.tileLayer(`https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_SNPP_CorrectedReflectance_TrueColor/default/${basemapDate}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`, { ...common, maxNativeZoom: 9, attribution: ATTR.gibs }).addTo(map)
      L0.ref = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}', { pane: 'ref', maxZoom: 19, maxNativeZoom: 19, minZoom: 11, opacity: 0.9, crossOrigin: true, errorTileUrl: '' }).addTo(map)
    } else {
      // Esri's dark canvas is served to z16; beyond that Leaflet upscales it and the imagery-grade
      // road/label reference layer takes over the detail. (CARTO's free tiles now watermark
      // "API KEY REQUIRED" on real domains, so they are not used.)
      L0.base = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', { ...common, maxNativeZoom: 16, attribution: ATTR.dark }).addTo(map)
      L0.ref = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}', { pane: 'ref', maxZoom: 19, maxNativeZoom: 16, minZoom: 9, opacity: 0.9, crossOrigin: true, errorTileUrl: '' }).addTo(map)
      L0.ref2 = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}', { pane: 'ref', maxZoom: 19, maxNativeZoom: 19, minZoom: 15, opacity: 0.85, crossOrigin: true, errorTileUrl: '' }).addTo(map)
    }
    restyle() // fill strength depends on the base map (lighter over imagery)
  }, [basemap, basemapDate])

  // ── points + focus ──────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current; if (!map) return
    const L0 = layersRef.current
    if (L0.points) { map.removeLayer(L0.points); L0.points = null }
    if (showDots && points.length) {
      L0.points = L.layerGroup(points.map(p => L.circleMarker([p.lat, p.lon], { pane: 'points', radius: 3.5, color: '#020617', weight: 0.6, fillColor: p.color, fillOpacity: 0.9 }).bindTooltip(p.label, { direction: 'top', className: 'hud-leaflet-tip' }))).addTo(map)
    }
  }, [points, showDots])
  useEffect(() => {
    const map = mapRef.current; if (!map) return
    const L0 = layersRef.current
    if (L0.focus) { map.removeLayer(L0.focus); L0.focus = null }
    if (focus) {
      L0.focus = L.marker([focus.lat, focus.lon], { pane: 'points', interactive: false, icon: L.divIcon({ className: 'hud-focus', html: '<span class="hud-focus-ring"></span><span class="hud-focus-dot"></span>', iconSize: [28, 28], iconAnchor: [14, 14] }) }).addTo(map)
    }
  }, [focus])

  return <div ref={elRef} data-testid="leaflet-map" style={{ position: 'absolute', inset: 0, background: '#050b18' }} />
}
