// Vercel serverless function: compact JSON for the BhaskarOps field-officer mobile app
// (built in FlutterFlow; any HTTP client works). CORS-open, read-only, no key needed.
//   GET /api/mobile?city=Lucknow&state=Uttar%20Pradesh
// Returns the live reading (Open-Meteo), heat stress, IMD-threshold 7-day outlook, the
// activation level, the top rule-based actions (NDMA / Ahmedabad HAP) and ready-made alert
// text in English and Hindi. Same rules as the web app; nothing is invented.
import { readFile } from 'fs/promises'
import path from 'path'
import { computeHeatStress } from '../src/utils/heatStress.js'
import { buildOutlook } from '../src/utils/heatwaveOutlook.js'
import { activationLevel, buildFallbackPlan, LEVELS } from '../src/utils/heatActionProtocol.js'

let coords = null
async function coordsFor(city, state) {
  if (!coords) coords = JSON.parse(await readFile(path.join(process.cwd(), 'src/data/cityCoordinates.json'), 'utf8'))
  const table = coords.cities || coords
  const k = `${city}|${state}`
  if (table[k]) return table[k]
  const lc = city.toLowerCase()
  const hit = Object.entries(table).find(([key]) => key.split('|')[0].toLowerCase() === lc && (!state || key.toLowerCase().endsWith(`|${state.toLowerCase()}`)))
  return hit ? { ...hit[1], key: hit[0] } : null
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Use GET.' })
  const city = String(req.query?.city || '').trim().slice(0, 60), state = String(req.query?.state || '').trim().slice(0, 60)
  if (!city) return res.status(400).json({ error: 'Pass ?city=<name>&state=<state>, e.g. ?city=Lucknow&state=Uttar%20Pradesh' })
  const c = await coordsFor(city, state).catch(() => null)
  if (!c || typeof c.lat !== 'number') return res.status(404).json({ error: `No coordinates for ${city}${state ? `, ${state}` : ''}.` })
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${c.lat}&longitude=${c.lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature&daily=temperature_2m_max,temperature_2m_min&forecast_days=7&timezone=Asia/Kolkata`
  let wx
  try { const r = await fetch(url); if (!r.ok) throw new Error(`HTTP ${r.status}`); wx = await r.json() } catch (e) { return res.status(502).json({ error: `Weather source unavailable (${e.message}).` }) }
  const temp = Math.round(wx.current?.temperature_2m), rh = wx.current?.relative_humidity_2m
  const forecast = (wx.daily?.time || []).map((d, i) => ({ date: d, maxTemp: Math.round(wx.daily.temperature_2m_max[i]), minTemp: Math.round(wx.daily.temperature_2m_min[i]) }))
  const outlook = buildOutlook(forecast, { elevation: wx.elevation ?? null, isCoastal: false })
  const s = computeHeatStress(temp, rh)
  const stress = s ? { heatIndex: s.heatIndex, heatIndexBandKey: s.heatIndexBand.key, heatIndexBandLabel: s.heatIndexBand.label, wetBulb: s.wetBulb, wbgt: s.wbgt, wbgtCat: s.wbgtCategory.cat, workRest: s.wbgtCategory.workRest } : {}
  const input = { city: c.city || city, state: c.state || state, current: { temp, humidity: rh }, today: { maxTemp: forecast[0]?.maxTemp ?? null, minTemp: forecast[0]?.minTemp ?? null }, stress, outlook: outlook ? { worst: outlook.worst, threshold: outlook.threshold.t, thresholdKind: outlook.threshold.kind, spell: outlook.spells[0] || null } : {} }
  const act = activationLevel(input)
  const plan = buildFallbackPlan(input)
  const area = `${input.city}, ${input.state}`
  const cold = act.level === 'cold'
  res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=1800')
  return res.status(200).json({
    city: input.city, state: input.state, lat: c.lat, lon: c.lon, observedAt: wx.current?.time || null, source: 'Open-Meteo (live)',
    now: { tempC: temp, humidity: rh, feelsLikeC: s?.heatIndex ?? Math.round(wx.current?.apparent_temperature), band: s?.heatIndexBand.label ?? null, wbgtC: s?.wbgt ?? null, workRest: s?.wbgtCategory.workRest ?? null },
    activation: { level: act.level, label: LEVELS[act.level]?.label, color: LEVELS[act.level]?.color, reasons: act.reasons },
    outlook: outlook ? { threshold: outlook.threshold.t, terrain: outlook.threshold.kind, worst: outlook.worst, days: outlook.days.map(d => ({ date: d.date, maxC: d.maxTemp, minC: d.minTemp, level: d.level })) } : null,
    actions: plan.actions.slice(0, 5).map(a => ({ priority: a.priority, title: a.title, owner: a.owner, deadline: a.deadline })),
    alert: {
      en: cold ? `COLD ALERT ${area}. Stay warm; use night shelters. -BhaskarOps` : `HEAT ALERT ${area}${forecast[0] ? `: max ${forecast[0].maxTemp}°C` : ''}. Avoid 12-4 PM outdoors, drink water, check on elderly. Emergency 108. -BhaskarOps`,
      hi: cold ? `शीतलहर चेतावनी — ${area}। गर्म कपड़े पहनें, रैन बसेरों का उपयोग करें। — BhaskarOps` : `लू चेतावनी — ${area}${forecast[0] ? `: अधिकतम तापमान ${forecast[0].maxTemp} डिग्री` : ''}। दोपहर 12 से 4 बजे तक बाहर न निकलें, बार-बार पानी पिएँ। आपात स्थिति में 108। — BhaskarOps`
    },
    labels: { now: 'LIVE', outlook: 'FORECAST', actions: 'RULE-BASED' }
  })
}
