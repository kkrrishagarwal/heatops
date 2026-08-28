// Builds extra, real-data context for AGNI from the bulk live-weather cache when the
// user's question mentions cities or states other than the one currently selected.
//
// This does NOT make AGNI a general-knowledge assistant: every number here comes from
// public/live-weather-cache.json (the same daily cache the map, ticker and panels use).
// Locations that are not in that cache produce no numbers — the context explicitly tells
// the model to say the data is unavailable rather than guess.

import { getBulkWeatherCities, getBulkWeatherLastUpdated } from './bulkWeatherCache'
import { getAQICategory } from './weatherAPI'

// Common alternate spellings users type. Keys are what people write, values are the
// city names as they appear in the cache. Matching is case-insensitive.
const CITY_ALIASES = {
  delhi: 'New Delhi',
  'new delhi': 'New Delhi',
  bangalore: 'Bengaluru',
  bombay: 'Mumbai',
  calcutta: 'Kolkata',
  madras: 'Chennai',
  gurgaon: 'Gurugram',
  trivandrum: 'Thiruvananthapuram',
  poona: 'Pune',
  baroda: 'Vadodara',
  benares: 'Varanasi',
  banaras: 'Varanasi',
  cochin: 'Kochi',
  mysore: 'Mysuru',
  mangalore: 'Mangaluru',
  vizag: 'Visakhapatnam',
  trichy: 'Tiruchirappalli',
  simla: 'Shimla',
  ooty: 'Udhagamandalam',
  pondicherry: 'Puducherry'
}

const STATE_ALIASES = {
  orissa: 'Odisha',
  uttaranchal: 'Uttarakhand',
  'up': 'Uttar Pradesh',
  'mp': 'Madhya Pradesh',
  'hp': 'Himachal Pradesh',
  'j&k': 'Jammu and Kashmir',
  'tn': 'Tamil Nadu',
  'ap': 'Andhra Pradesh',
  'wb': 'West Bengal'
}

const MAX_CITIES = 6
const MAX_STATES = 3
const MAX_CONTEXT_CHARS = 3600 // server rejects context > 4000; leave headroom for the base line

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Whole-word, case-insensitive match that also tolerates Hinglish suffixes glued on
// ("Delhi ka", "Mumbai mein", "Rajasthan-wale").
function mentions(text, name) {
  if (!name || name.length < 3) return false
  const re = new RegExp(`(^|[^a-z])${escapeRegExp(name.toLowerCase())}(?=$|[^a-z])`, 'i')
  return re.test(text)
}

function ageLabel(iso) {
  if (!iso) return 'unknown age'
  const hrs = Math.round((Date.now() - new Date(iso).getTime()) / 36e5)
  if (hrs < 1) return 'under an hour old'
  if (hrs < 48) return `${hrs}h old`
  return `${Math.round(hrs / 24)}d old`
}

function fmtCity(entry) {
  const parts = [`${entry.city}, ${entry.state}`]
  if (typeof entry.temp === 'number') parts.push(`temp ${entry.temp}°C`)
  if (typeof entry.aqi === 'number') parts.push(`AQI ${entry.aqi} (${getAQICategory(Math.min(500, entry.aqi)).label})`)
  if (typeof entry.pm10 === 'number') parts.push(`PM10 ${entry.pm10} µg/m³`)
  if (typeof entry.rainChance === 'number') parts.push(`rain chance ${entry.rainChance}%`)
  if (typeof entry.cloudCover === 'number') parts.push(`cloud cover ${entry.cloudCover}%`)
  return parts.join(', ')
}

// Index the cache once per call (cheap: ~1.7k entries) into city + state lookups.
function indexCache(cities) {
  const byCity = new Map() // lowercase city -> [entries]
  const byState = new Map() // lowercase state -> { name, entries }
  for (const entry of Object.values(cities)) {
    if (!entry?.city) continue
    const c = entry.city.toLowerCase()
    if (!byCity.has(c)) byCity.set(c, [])
    byCity.get(c).push(entry)
    if (entry.state) {
      const s = entry.state.toLowerCase()
      if (!byState.has(s)) byState.set(s, { name: entry.state, entries: [] })
      byState.get(s).entries.push(entry)
    }
  }
  return { byCity, byState }
}

function summariseState(name, entries) {
  const withTemp = entries.filter(e => typeof e.temp === 'number')
  const withAqi = entries.filter(e => typeof e.aqi === 'number')
  const hottest = [...withTemp].sort((a, b) => b.temp - a.temp)
  const coolest = [...withTemp].sort((a, b) => a.temp - b.temp)
  const worstAqi = [...withAqi].sort((a, b) => b.aqi - a.aqi)
  const avg = withTemp.length ? (withTemp.reduce((s, e) => s + e.temp, 0) / withTemp.length).toFixed(1) : null
  const lines = [`State: ${name} — ${entries.length} cities in the cache`]
  if (avg != null) lines.push(`  average temp ${avg}°C`)
  if (hottest.length) lines.push(`  hottest: ${hottest.slice(0, 5).map(e => `${e.city} ${e.temp}°C`).join(', ')}`)
  if (coolest.length) lines.push(`  coolest: ${coolest.slice(0, 3).map(e => `${e.city} ${e.temp}°C`).join(', ')}`)
  if (worstAqi.length) lines.push(`  worst AQI: ${worstAqi.slice(0, 3).map(e => `${e.city} ${e.aqi} (${getAQICategory(Math.min(500, e.aqi)).label})`).join(', ')}`)
  return lines.join('\n')
}

/**
 * @param {string} question  the user's question
 * @param {string} currentCity  the currently selected city (its live context is added by the caller)
 * @returns {{ text: string, cities: string[], states: string[] }}  extra context block ('' if nothing matched)
 */
export function buildLocationContext(question, currentCity) {
  const cities = getBulkWeatherCities()
  const lastUpdated = getBulkWeatherLastUpdated()
  const q = String(question || '')
  if (!q.trim() || !cities || !Object.keys(cities).length) {
    return { text: '', cities: [], states: [] }
  }
  const { byCity, byState } = indexCache(cities)
  const current = String(currentCity || '').toLowerCase()

  // --- states mentioned ---
  const stateHits = []
  for (const [key, { name, entries }] of byState) {
    if (mentions(q, name)) stateHits.push({ name, entries, key })
  }
  for (const [alias, canonical] of Object.entries(STATE_ALIASES)) {
    const hit = byState.get(canonical.toLowerCase())
    if (hit && mentions(q, alias) && !stateHits.some(s => s.key === canonical.toLowerCase())) {
      stateHits.push({ name: hit.name, entries: hit.entries, key: canonical.toLowerCase() })
    }
  }

  // --- cities mentioned (direct names + aliases), longest names first so "New Delhi"
  //     wins over a shorter overlapping match ---
  const cityHits = new Map() // lowercase city -> entry
  const candidateNames = [...byCity.keys()].sort((a, b) => b.length - a.length)
  for (const name of candidateNames) {
    if (cityHits.size >= MAX_CITIES) break
    // skip city names that are also a matched state name (e.g. "Delhi" the city vs the state)
    if (mentions(q, name)) cityHits.set(name, byCity.get(name)[0])
  }
  for (const [alias, canonical] of Object.entries(CITY_ALIASES)) {
    const entries = byCity.get(canonical.toLowerCase())
    if (entries && mentions(q, alias) && !cityHits.has(canonical.toLowerCase())) {
      cityHits.set(canonical.toLowerCase(), entries[0])
    }
  }
  // Don't repeat the currently selected city — the caller already sends its live values
  cityHits.delete(current)

  const cityList = [...cityHits.values()].slice(0, MAX_CITIES)
  const stateList = stateHits.slice(0, MAX_STATES)
  if (!cityList.length && !stateList.length) {
    return {
      text: `\nOTHER LOCATIONS: none of the other Indian cities/states in BhaskarOps' data were recognised in this question. If the user asks about a specific city or state that is not listed above, say that BhaskarOps does not have data for it right now — do not guess or invent numbers.`,
      cities: [],
      states: []
    }
  }

  const lines = []
  lines.push(`\nADDITIONAL REAL DATA from BhaskarOps' daily weather cache (${ageLabel(lastUpdated)}; these are cached readings, not live):`)
  for (const entry of cityList) lines.push(`- ${fmtCity(entry)}`)
  for (const st of stateList) lines.push(summariseState(st.name, st.entries))
  if (cityList.length >= 2) {
    lines.push(`Comparison requested: use the numbers above for ${cityList.map(e => e.city).join(' vs ')}; do not add values that are not listed.`)
  }
  lines.push(`Only the locations listed here and the selected city have data. For any other city/state the user names, say BhaskarOps does not have data for it right now — never guess.`)

  let text = lines.join('\n')
  if (text.length > MAX_CONTEXT_CHARS) text = text.slice(0, MAX_CONTEXT_CHARS - 1) + '…'
  return { text, cities: cityList.map(e => e.city), states: stateList.map(s => s.name) }
}
