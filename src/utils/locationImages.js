// City & District Visual Identity System — registry + resolver.
//
// Resolution order (the brief's fallback hierarchy):
//   1. verified   — a hand-checked entry in VERIFIED below (city or district), with its
//                   landmark, Wikimedia Commons file, licence and author
//   2. auto       — the lead image of the place's Wikipedia article, fetched at runtime
//                   with its licence and author from the Commons API; labelled "auto-resolved,
//                   not hand-verified" in the UI. Only when the provider is enabled.
//   3. placeholder — a branded, text-only location card that says no verified photo exists
// Every resolved image carries { src, alt, landmark, source, licence, author, status }.
// Photographs are contextual identity only; nothing here is a measurement.
//
// Provider switch: the Wikipedia/Commons provider is OFF until the team approves an external,
// attribution-licensed image source (see PROVIDER_ENABLED). With it off, only VERIFIED entries
// and placeholders are used, so nothing unverified is ever shown.
export const PROVIDER_ENABLED = false

// Hand-verified entries. `page` is the English Wikipedia article whose lead image is used
// (fetched live, licence read from Commons); `landmark` is what the picture shows.
export const VERIFIED = {
  'New Delhi|Delhi': { landmark: 'India Gate', page: 'India Gate' },
  'Delhi|Delhi': { landmark: 'India Gate', page: 'India Gate' },
  'Jaipur|Rajasthan': { landmark: 'Hawa Mahal', page: 'Hawa Mahal' },
  'Lucknow|Uttar Pradesh': { landmark: 'Rumi Darwaza', page: 'Rumi Darwaza' },
  'Mumbai|Maharashtra': { landmark: 'Gateway of India', page: 'Gateway of India' },
  'Kolkata|West Bengal': { landmark: 'Victoria Memorial', page: 'Victoria Memorial, Kolkata' },
  'Hyderabad|Telangana': { landmark: 'Charminar', page: 'Charminar' },
  'Chennai|Tamil Nadu': { landmark: 'Marina Beach', page: 'Marina Beach' },
  'Bengaluru|Karnataka': { landmark: 'Vidhana Soudha', page: 'Vidhana Soudha' },
  'Chandigarh|Chandigarh': { landmark: 'Capitol Complex', page: 'Chandigarh Capitol Complex' },
  'Shimla|Himachal Pradesh': { landmark: 'Viceregal Lodge', page: 'Rashtrapati Niwas' },
  'Ahmedabad|Gujarat': { landmark: 'Sabarmati Ashram', page: 'Sabarmati Ashram' },
  'Agra|Uttar Pradesh': { landmark: 'Taj Mahal', page: 'Taj Mahal' },
  'Varanasi|Uttar Pradesh': { landmark: 'Dashashwamedh Ghat', page: 'Dashashwamedh Ghat' },
  'Amritsar|Punjab': { landmark: 'Golden Temple', page: 'Golden Temple' },
  'Bhopal|Madhya Pradesh': { landmark: 'Taj-ul-Masajid', page: 'Taj-ul-Masajid' },
  'Pune|Maharashtra': { landmark: 'Shaniwar Wada', page: 'Shaniwar Wada' },
  'Thiruvananthapuram|Kerala': { landmark: 'Padmanabhaswamy Temple', page: 'Padmanabhaswamy Temple' },
  'Guwahati|Assam': { landmark: 'Kamakhya Temple', page: 'Kamakhya Temple' },
  'Leh|Ladakh': { landmark: 'Leh Palace', page: 'Leh Palace' },
  'Srinagar|Jammu and Kashmir': { landmark: 'Dal Lake', page: 'Dal Lake' },
  'Jodhpur|Rajasthan': { landmark: 'Mehrangarh Fort', page: 'Mehrangarh' },
  'Udaipur|Rajasthan': { landmark: 'City Palace', page: 'City Palace, Udaipur' },
  'Bhubaneswar|Odisha': { landmark: 'Lingaraja Temple', page: 'Lingaraja Temple' },
  'Patna|Bihar': { landmark: 'Golghar', page: 'Golghar' },
  'Raipur|Chhattisgarh': { landmark: 'Vivekananda Sarovar', page: 'Vivekananda Sarovar' },
  'Dehradun|Uttarakhand': { landmark: 'Forest Research Institute', page: 'Forest Research Institute' },
  'Gandhinagar|Gujarat': { landmark: 'Akshardham', page: 'Akshardham (Gandhinagar)' },
  'Nagpur|Maharashtra': { landmark: 'Deekshabhoomi', page: 'Deekshabhoomi' },
  'Visakhapatnam|Andhra Pradesh': { landmark: 'RK Beach', page: 'Ramakrishna Beach' },
  'Kochi|Kerala': { landmark: 'Chinese fishing nets', page: 'Chinese fishing nets' },
  'Madurai|Tamil Nadu': { landmark: 'Meenakshi Temple', page: 'Meenakshi Temple' },
  'Mysuru|Karnataka': { landmark: 'Mysore Palace', page: 'Mysore Palace' },
  'Sri Ganganagar|Rajasthan': { landmark: 'Gurudwara Buddha Johad', page: 'Gurudwara Buddha Johad' }
}

const cache = new Map() // key → promise of result
const memo = (k, fn) => { if (!cache.has(k)) cache.set(k, fn().catch(() => null)); return cache.get(k) }

// Wikipedia lead image + Commons licence metadata, no API key. Two requests, cached.
async function wikiImage(page) {
  const api = `https://en.wikipedia.org/w/api.php?origin=*&format=json&action=query&redirects=1&prop=pageimages&piprop=original|name&pithumbsize=1200&titles=${encodeURIComponent(page)}`
  const r = await fetch(api); if (!r.ok) return null
  const j = await r.json()
  const p = Object.values(j?.query?.pages || {})[0]
  const file = p?.pageimage; const src = p?.original?.source
  if (!file || !src) return null
  let licence = null, author = null
  try {
    const c = await fetch(`https://commons.wikimedia.org/w/api.php?origin=*&format=json&action=query&prop=imageinfo&iiprop=extmetadata&titles=${encodeURIComponent('File:' + file)}`)
    const cj = await c.json()
    const info = Object.values(cj?.query?.pages || {})[0]?.imageinfo?.[0]?.extmetadata
    licence = info?.LicenseShortName?.value || null
    author = (info?.Artist?.value || '').replace(/<[^>]+>/g, '').trim() || null
  } catch { /* licence unknown — still attributed to Wikimedia Commons */ }
  return { src, file, licence, author, source: 'Wikimedia Commons' }
}

export function placeholderFor({ city, district, state }) {
  const name = city || district || state || 'Location'
  return { status: 'placeholder', src: null, alt: `${name}: no verified photograph`, landmark: null, source: null, licence: null, author: null, label: `${name}${state && name !== state ? `, ${state}` : ''}` }
}

// Resolve the identity image for a city (and/or district) in a state.
// Until the external provider is approved, even VERIFIED entries are not fetched (their assets
// are hosted on Wikimedia): the UI shows the branded placeholder and says why.
export async function resolveLocationImage({ city, district, state, allowAuto = PROVIDER_ENABLED, providerOn = PROVIDER_ENABLED }) {
  if (!providerOn) return placeholderFor({ city, district, state })
  const tryKey = async (key, status, landmarkHint) => {
    const v = VERIFIED[key]
    if (!v) return null
    const img = await memo(`v:${key}`, () => wikiImage(v.page))
    return img ? { ...img, status: 'verified', landmark: v.landmark, alt: `${v.landmark}, ${key.split('|')[0]}` } : null
  }
  if (city && state) { const r = await tryKey(`${city}|${state}`); if (r) return r }
  if (district && state) { const r = await tryKey(`${district}|${state}`); if (r) return r }
  if (allowAuto) {
    for (const [title, label] of [city && [`${city}, ${state}`, city], city && [city, city], district && [`${district} district`, `${district} district`]].filter(Boolean)) {
      const img = await memo(`a:${title}`, () => wikiImage(title))
      if (img) return { ...img, status: 'auto', landmark: null, alt: `${label} (auto-resolved image, not hand-verified)` }
    }
  }
  return placeholderFor({ city, district, state })
}

export const VERIFIED_COUNT = Object.keys(VERIFIED).length
