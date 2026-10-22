// Jurisdiction from the sign-in email (hackathon demo accounts).
//   central / india / admin / ndma @…            → Central Command, all-India
//   <state code or name> @gmail.com | @bhaskarops.gov.in → that state's administrator
// DEMO RULE: these accounts accept their listed password, the master password, or any password
// of 4+ characters, so a judge is never locked out by a typo. This is NOT real security; real
// deployment needs government SSO (e.g. Parichay) with server-side role checks.
export const MASTER_PASSWORD = 'bhaskar2026'

export const STATE_CODES = {
  ap: 'Andhra Pradesh', ar: 'Arunachal Pradesh', as: 'Assam', assam: 'Assam', br: 'Bihar', bihar: 'Bihar',
  cg: 'Chhattisgarh', ct: 'Chhattisgarh', ch: 'Chandigarh', chd: 'Chandigarh', dl: 'Delhi', delhi: 'Delhi', ncr: 'Delhi',
  ga: 'Goa', goa: 'Goa', gj: 'Gujarat', gujarat: 'Gujarat', hr: 'Haryana', haryana: 'Haryana', hp: 'Himachal Pradesh',
  jk: 'Jammu and Kashmir', jh: 'Jharkhand', ka: 'Karnataka', kl: 'Kerala', kerala: 'Kerala', ld: 'Ladakh', la: 'Ladakh', leh: 'Ladakh', ladakh: 'Ladakh',
  lk: 'Lakshadweep', mp: 'Madhya Pradesh', mh: 'Maharashtra', maharashtra: 'Maharashtra', mn: 'Manipur', ml: 'Meghalaya', mz: 'Mizoram',
  nl: 'Nagaland', od: 'Odisha', or: 'Odisha', odisha: 'Odisha', pb: 'Punjab', punjab: 'Punjab', py: 'Puducherry', rj: 'Rajasthan', rajasthan: 'Rajasthan',
  sk: 'Sikkim', tn: 'Tamil Nadu', ts: 'Telangana', tg: 'Telangana', telangana: 'Telangana', tr: 'Tripura', up: 'Uttar Pradesh', uk: 'Uttarakhand', ut: 'Uttarakhand',
  wb: 'West Bengal', an: 'Andaman and Nicobar Islands', dn: 'Dadra and Nagar Haveli and Daman and Diu', dd: 'Dadra and Nagar Haveli and Daman and Diu'
}
const STATE_NAMES = [...new Set(Object.values(STATE_CODES))]
const CENTRAL = new Set(['central', 'india', 'admin', 'ndma', 'centre', 'center'])
// Where a state administrator lands (the state capital or main city, as named in the city list).
export const STATE_HQ = {
  'Uttar Pradesh': 'Lucknow', Rajasthan: 'Jaipur', Delhi: 'New Delhi', Assam: 'Guwahati', Ladakh: 'Leh', Maharashtra: 'Mumbai', Gujarat: 'Ahmedabad',
  Bihar: 'Patna', 'West Bengal': 'Kolkata', 'Tamil Nadu': 'Chennai', Karnataka: 'Bengaluru', Telangana: 'Hyderabad', Kerala: 'Thiruvananthapuram',
  'Madhya Pradesh': 'Bhopal', Odisha: 'Bhubaneswar', Punjab: 'Amritsar', Haryana: 'Gurugram', 'Himachal Pradesh': 'Shimla', Uttarakhand: 'Dehradun',
  'Jammu and Kashmir': 'Srinagar', Jharkhand: 'Ranchi', Chhattisgarh: 'Raipur', 'Andhra Pradesh': 'Visakhapatnam', Goa: 'Panaji', Chandigarh: 'Chandigarh'
}

export const DEMO_CREDENTIALS = [
  { email: 'central@gmail.com', password: 'admin2026', label: 'Central Admin · All-India' },
  { email: 'up@gmail.com', password: 'up2026', label: 'Uttar Pradesh State Admin' },
  { email: 'rj@gmail.com', password: 'rj2026', label: 'Rajasthan State Admin' },
  { email: 'delhi@gmail.com', password: 'delhi2026', label: 'Delhi NCR State Admin' },
  { email: 'assam@gmail.com', password: 'assam2026', label: 'Assam State Admin · IIT Guwahati host' },
  { email: 'leh@gmail.com', password: 'leh2026', label: 'Ladakh State Admin · cold-mode demo' }
]

const norm = s => String(s || '').toLowerCase().replace(/[^a-z]/g, '')

// Returns { type: 'central' } | { type: 'state', state } | null (not a jurisdiction account).
export function parseJurisdiction(email) {
  const e = String(email || '').trim().toLowerCase()
  const at = e.indexOf('@')
  if (at < 1) return null
  const domain = e.slice(at + 1)
  if (!/^(gmail\.com|bhaskarops\.gov\.in|ndma\.gov\.in)$/.test(domain)) return null
  const prefix = e.slice(0, at)
  const key = norm(prefix)
  if (CENTRAL.has(key) || domain === 'ndma.gov.in') return { type: 'central' }
  if (STATE_CODES[key]) return { type: 'state', state: STATE_CODES[key] }
  // a full state name, e.g. "uttarpradesh@" or "tamil.nadu@"
  const byName = STATE_NAMES.find(n => norm(n) === key)
  if (byName) return { type: 'state', state: byName }
  // "up.admin@", "rj-sdma@": the first token as a code
  const first = norm(prefix.split(/[._-]/)[0])
  if (STATE_CODES[first]) return { type: 'state', state: STATE_CODES[first] }
  return null
}

// Demo password rule: the listed password, the master password, or any 4+ character password.
export function demoPasswordOk(password) {
  return typeof password === 'string' && password.trim().length >= 4
}

export function jurisdictionLabel(j) {
  if (!j) return null
  return j.type === 'central' ? '🇮🇳 CENTRAL COMMAND // ALL-INDIA JURISDICTION' : `🏛️ STATE ADMIN: ${j.state.toUpperCase()} // INTRA-STATE TRANSPARENCY ACTIVE`
}
export function jurisdictionName(j) {
  return !j ? '' : j.type === 'central' ? 'Central Command (All-India)' : `${j.state} State Admin`
}
