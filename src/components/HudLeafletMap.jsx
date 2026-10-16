import React, { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { fetchJson } from '../utils/fetchJson'

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

export default function HudLeafletMap({ stateData, resolveStateName, points = [], focus = null, basemap = 'dark', basemapDate = null, selectedState = null, onStateClick = () => {}, onZoomChange = () => {}, showDots = false, tooltipText = () => '', controlRef }) {
  const elRef = useRef(null)
  const mapRef = useRef(null)
  const layersRef = useRef({})
  const dataRef = useRef({ stateData, resolveStateName, tooltipText, onStateClick })
  const basemapRef = useRef(basemap)
  basemapRef.current = basemap
  dataRef.current = { stateData, resolveStateName, tooltipText, onStateClick }

  // ── create the map once ─────────────────────────────────────────────────
  useEffect(() => {
    if (!elRef.current || mapRef.current) return undefined
    const map = L.map(elRef.current, { zoomControl: false, attributionControl: true, minZoom: 4, maxZoom: 19, zoomSnap: 0.25, wheelPxPerZoomLevel: 90, worldCopyJump: false, preferCanvas: false })
    map.attributionControl.setPosition('bottomleft').setPrefix(false)
    map.fitBounds(INDIA_BOUNDS, { padding: [10, 10] })
    map.setMaxBounds(INDIA_BOUNDS.pad(0.6))
    mapRef.current = map
    const panes = { base: 100, ref: 350, vectors: 400, points: 450 }
    for (const [name, z] of Object.entries(panes)) { map.createPane(name); map.getPane(name).style.zIndex = String(z) }
    map.on('zoomend', () => { onZoomChange(map.getZoom()); restyle() })
    if (controlRef) controlRef.current = { zoomIn: () => map.zoomIn(1), zoomOut: () => map.zoomOut(1), reset: () => map.fitBounds(INDIA_BOUNDS, { padding: [10, 10] }), flyTo: (lat, lon, z = 11) => map.flyTo([lat, lon], z, { duration: 1.2 }), getZoom: () => map.getZoom() }
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
        mouseover: e => { e.target.setStyle({ weight: 2.5, color: '#f59e0b' }); e.target.bringToFront() },
        mouseout: e => { e.target.setStyle(e.target.options.district ? districtStyle(feature) : style(feature)) },
        click: () => dataRef.current.onStateClick(dataRef.current.resolveStateName(feature))
      })
      layer.bindTooltip(() => dataRef.current.tooltipText(dataRef.current.resolveStateName(feature)), { sticky: true, direction: 'top', opacity: 0.95, className: 'hud-leaflet-tip' })
    }
    loadGeo().then(([states, districts, jk]) => {
      if (mapRef.current !== map) return // this map was torn down (StrictMode double-mount) before the data arrived
      const isJK = f => /jammu|kashmir|ladakh/i.test(dataRef.current.resolveStateName(f) || '')
      const stateFeatures = { type: 'FeatureCollection', features: (states.features || []).filter(f => !isJK(f)) }
      const districtFeatures = { type: 'FeatureCollection', features: (districts.features || []).filter(f => !isJK(f)) }
      const jkFeatures = { type: 'FeatureCollection', features: (jk.features || []) }
      layersRef.current.districts = L.geoJSON(districtFeatures, { pane: 'vectors', style: districtStyle, onEachFeature: (f, l) => { l.options.district = true; bind(f, l) } }).addTo(map)
      layersRef.current.states = L.geoJSON(stateFeatures, { pane: 'vectors', style: f => ({ ...style(f), fillOpacity: 0 }), onEachFeature: bind }).addTo(map)
      layersRef.current.jk = L.geoJSON(jkFeatures, { pane: 'vectors', style, onEachFeature: bind }).addTo(map)
      restyle()
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
    const base = basemapRef.current === 'dark' ? 0.55 : 0.4
    districts?.eachLayer(l => l.setStyle({ fillColor: colorOf(l.feature), fillOpacity: base * 0.8 * fade }))
    jk?.eachLayer(l => l.setStyle({ fillColor: colorOf(l.feature), fillOpacity: base * fade }))
    states?.eachLayer(l => l.setStyle({ color: dataRef.current.resolveStateName(l.feature) === selectedState ? '#22d3ee' : '#ffffff', weight: dataRef.current.resolveStateName(l.feature) === selectedState ? 2.5 : 1.2 }))
  }
  useEffect(() => { restyle() }, [stateData, selectedState]) // eslint-disable-line react-hooks/exhaustive-deps

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
