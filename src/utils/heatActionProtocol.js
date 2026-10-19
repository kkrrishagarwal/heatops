// Municipal Heat Action Protocol — the deterministic, rule-based plan. It is:
//   1. what the Agent37 Co-Pilot falls back to when the agent cannot be reached, and
//   2. the shape (PLAN_SCHEMA_TEXT) the agent is asked to return,
// so the panel renders one format whichever produced it. Pure module, no browser APIs:
// imported by the React panel AND by the server route (api/_lib/heatAgent.js).
//
// Activation levels (air temperature = the higher of now and today's forecast high):
//   CRITICAL ≥ 45 °C, or Heat Index "Extreme Danger", or WBGT black flag, or IMD heatwave /
//            severe day in the 7-day outlook
//   ALERT    ≥ 42 °C, or Heat Index "Danger", or WBGT red flag, or an above-threshold day
//   WATCH    ≥ 37 °C, or Heat Index "Extreme Caution", or WBGT yellow flag
//   COLD     current temperature < 10 °C
//   ROUTINE  otherwise
// Steps follow the NDMA heat-wave guidelines and the Ahmedabad Heat Action Plan. Nothing here
// invents ward names, counts or routes: the project holds no ward or population data, so
// zones are described by what the data does show (built-up share, outdoor-worker clusters).

export const LEVELS = {
  critical: { label: 'CRITICAL — full activation', color: '#991b1b' },
  alert: { label: 'ALERT — activate', color: '#dc2626' },
  watch: { label: 'WATCH — prepare', color: '#f59e0b' },
  cold: { label: 'COLD — cold-weather protocol', color: '#2563eb' },
  routine: { label: 'ROUTINE — monitor', color: '#15803d' }
}

const n = v => (typeof v === 'number' && Number.isFinite(v) ? v : null)

export function activationLevel(input) {
  const temps = [n(input?.current?.temp), n(input?.today?.maxTemp)].filter(v => v != null)
  const peakT = temps.length ? Math.max(...temps) : null
  const hiKey = input?.stress?.heatIndexBandKey
  const wbgtCat = n(input?.stress?.wbgtCat)
  const worst = input?.outlook?.worst
  if (n(input?.current?.temp) != null && input.current.temp < 10) return { level: 'cold', peakT, reasons: [`air temperature ${input.current.temp} °C is below 10 °C`] }
  const reasons = []
  const crit = []
  if (peakT != null && peakT >= 45) crit.push(`air temperature ${peakT} °C ≥ 45 °C`)
  if (hiKey === 'extreme-danger') crit.push('Heat Index in "Extreme Danger"')
  if (wbgtCat === 5) crit.push('WBGT black flag (≥ 32.2 °C)')
  if (worst === 'heatwave' || worst === 'severe') crit.push(`IMD-threshold outlook shows ${worst} conditions this week`)
  if (crit.length) return { level: 'critical', peakT, reasons: crit }
  if (peakT != null && peakT >= 42) reasons.push(`air temperature ${peakT} °C ≥ 42 °C`)
  if (hiKey === 'danger') reasons.push('Heat Index in "Danger"')
  if (wbgtCat === 4) reasons.push('WBGT red flag (31.1–32.2 °C)')
  if (worst === 'watch') reasons.push('a day above the IMD heatwave threshold this week')
  if (reasons.length) return { level: 'alert', peakT, reasons }
  const w = []
  if (peakT != null && peakT >= 37) w.push(`air temperature ${peakT} °C ≥ 37 °C`)
  if (hiKey === 'extreme-caution') w.push('Heat Index in "Extreme Caution"')
  if (wbgtCat === 3) w.push('WBGT yellow flag (29.4–31.1 °C)')
  if (w.length) return { level: 'watch', peakT, reasons: w }
  return { level: 'routine', peakT, reasons: ['no heat threshold crossed'] }
}

// The JSON contract the agent must return (also the fallback's shape).
export const PLAN_SCHEMA_TEXT = `{
  "level": "critical" | "alert" | "watch" | "cold" | "routine",
  "headline": string (one sentence, max 140 chars),
  "situation": string (2-3 sentences: what the data shows and why this level),
  "actions": [ {
    "title": string (imperative, max 80 chars),
    "detail": string (max 240 chars, concrete: where, how, what to publish),
    "owner": string (district role, e.g. "Municipal Commissioner / ULB", "CMHO / District Health", "Labour Department", "District Information Officer", "PHED / Jal Board", "DDMA control room", "Fire & Emergency Services", "Power distribution company", "District Education Officer"),
    "deadline": string (e.g. "within 6 hours", "before 06:00 tomorrow", "this week"),
    "priority": "P1" | "P2" | "P3",
    "category": "cooling" | "health" | "advisory" | "water" | "labour" | "misting" | "power" | "schools" | "monitoring" | "infrastructure" | "cold"
  } ] (4 to 10 items, P1 first),
  "labour": { "restrictHours": string, "shiftWindow": string, "workRest": string } | null,
  "publicAdvisory": { "en": string (SMS, max 300 chars), "hi": string (Hindi SMS, max 300 chars) },
  "sdmaIncident": { "type": string, "severity": "low" | "moderate" | "high" | "severe", "summary": string (max 300 chars) } | null,
  "budget": {
    "emergencyThisWeek": [ { "item": string, "qty": number, "unitCost": number (₹, ONLY from DATA.costing.unitCosts), "cost": number (= qty × unitCost) } ],
    "emergencyTotal": number (₹, the sum of the items above),
    "seasonal": { "investment": number (₹), "riskBefore": number, "riskAfter": number, "whatItBuys": string (max 200 chars) } | null,
    "notPriced": [ string ] (things that cost money but DATA holds no price for),
    "note": string (max 240 chars: where the figures come from and what they are not)
  },
  "ifNotControlled": {
    "summary": string (max 240 chars, ONLY from DATA.costing.consequences — no death or casualty counts),
    "consequences": [ string ] (3 to 6 items, each traceable to a number in DATA),
    "whoIsHitFirst": [ string ] (max 4 groups, e.g. "outdoor construction and MGNREGA workers")
  },
  "assumptions": [ string ] (what you assumed or could not verify, max 6)
}`

const fmt = v => (v == null ? '—' : `${v}`)
const fmtINR = n => (n >= 1e7 ? `₹${(n / 1e7).toFixed(2).replace(/\.?0+$/, '')} Cr` : n >= 1e5 ? `₹${(n / 1e5).toFixed(2).replace(/\.?0+$/, '')} L` : `₹${Math.round(n).toLocaleString('en-IN')}`)

export function buildFallbackPlan(input) {
  const city = input?.city || 'this city'
  const state = input?.state || ''
  const { level, peakT, reasons } = activationLevel(input)
  const s = input?.stress || {}
  const built = n(input?.landCover?.builtUp)
  const spell = input?.outlook?.spell
  const firstHot = spell?.from || input?.outlook?.firstHotDay || null
  const zones = built != null
    ? `the dense built-up core (${built}% built-up within ~5 km of the centre per ESA WorldCover), bus depots, markets and construction sites`
    : 'the dense built-up core, bus depots, markets and construction sites'
  const actions = []
  const add = (priority, category, title, detail, owner, deadline) => actions.push({ priority, category, title, detail, owner, deadline })

  if (level === 'critical' || level === 'alert') {
    const crit = level === 'critical'
    add('P1', 'labour', 'Shift outdoor work to 06:00–11:00', `Order construction, MGNREGA and municipal field work to run 06:00–11:00${crit ? ' and stop between 12:00 and 16:00' : ', with no heavy work 12:00–16:00'}. Enforce shade, water and rest breaks on site.`, 'Labour Department', crit ? 'order today, effective tomorrow 06:00' : 'within 24 hours')
    add('P1', 'cooling', 'Activate cooling centres', `Open all identified cooling centres (public halls, temples, bus depots) ${crit ? '10:00–22:00' : '11:00–18:00'}, publish the list on SMS/WhatsApp and local radio, and staff each with ORS and a first-aid kit.`, 'Municipal Commissioner / ULB', 'within 6 hours')
    add('P1', 'health', 'Put hospitals on heat-illness alert', 'Ready heat-stroke wards and cold-water immersion, stock ORS and IV fluids at PHCs, and keep 108 ambulances on standby near markets and labour chowks.', 'CMHO / District Health', 'within 6 hours')
    add('P1', 'advisory', 'Issue public heat advisory', 'Broadcast the advisory below by SMS, WhatsApp, RWA groups and local radio: avoid 12:00–16:00 outdoors, drink water often, check on elderly neighbours, know the warning signs.', 'District Information Officer', 'within 3 hours')
    add('P2', 'water', 'Deploy water points and tankers', `Run tankers and drinking-water kiosks for slums, labour chowks and construction sites in ${zones}.`, 'PHED / Jal Board', 'today')
    if (crit) add('P2', 'misting', 'Run misting / water-sprinkling along hot corridors', `Deploy fire-tender and municipal sprinkler runs 11:00–16:00 along market streets and bus stands in ${zones}. Routes to be drawn by the ULB; no route data is held here.`, 'Fire & Emergency Services', 'from 11:00 today')
    add('P2', 'power', 'Protect power supply for cooling', 'Defer planned outages in the afternoon peak and prioritise feeders serving hospitals, cooling centres and water pumping.', 'Power distribution company', 'today')
    add('P2', 'schools', 'Adjust school timings', crit ? 'Move classes to morning hours ending by 11:30, suspend outdoor assemblies and sports.' : 'Suspend outdoor assemblies and afternoon sports; ensure drinking water in every school.', 'District Education Officer', 'from tomorrow')
    add('P3', 'monitoring', 'Run the control room 24×7', 'DDMA control room to track heat-illness cases from hospitals daily, the IMD district warning, and this dashboard; escalate if the outlook worsens.', 'DDMA control room', 'until the spell ends')
    add('P3', 'infrastructure', 'Queue cool-roof and shade works', 'Prioritise cool roofs for schools, health centres and low-income housing, and shade nets at bus stops — use the Interventions tab planner for budget.', 'Urban Planning / Town Planner', 'this season')
  } else if (level === 'watch') {
    add('P1', 'monitoring', 'Watch the forecast daily', 'Track the IMD district bulletin and this dashboard each morning; pre-draft the SMS advisory for quick release.', 'DDMA control room', 'daily')
    add('P2', 'cooling', 'Ready cooling centres (do not open yet)', 'Confirm locations, staffing, ORS and water for each cooling centre so they can open within hours.', 'Municipal Commissioner / ULB', 'this week')
    add('P2', 'water', 'Confirm tanker availability', 'Verify water-tanker contracts and routes to vulnerable localities.', 'PHED / Jal Board', 'this week')
    add('P2', 'labour', 'Brief employers on heat rules', 'Remind construction employers of water, shade and rest-break duties and the 06:00–11:00 shift plan for hotter days.', 'Labour Department', 'this week')
    add('P3', 'health', 'Refresh health-staff training', 'Brief PHC staff on heat-illness triage and cooling.', 'CMHO / District Health', 'this week')
  } else if (level === 'cold') {
    add('P1', 'cold', 'Open night shelters', 'Open night shelters for the homeless, publish locations, and stock blankets and bedding.', 'Municipal Commissioner / ULB', 'today')
    add('P1', 'advisory', 'Issue cold-exposure advisory', 'Warn outdoor and early-morning workers: layered clothing, warm breaks, no unventilated heaters indoors.', 'District Information Officer', 'today')
    add('P2', 'health', 'Alert health facilities', 'Prepare for hypothermia and carbon-monoxide poisoning cases.', 'CMHO / District Health', 'today')
    add('P3', 'monitoring', 'Monitor overnight minimums', 'Track forecast minimums and shelter occupancy each evening.', 'DDMA control room', 'daily')
  } else {
    add('P3', 'monitoring', 'Routine monitoring', 'No activation needed. Keep cooling-centre lists and SMS templates current so activation takes hours, not days.', 'DDMA control room', 'ongoing')
    add('P3', 'infrastructure', 'Use the quiet period for long-term cooling', 'Plan cool roofs, tree planting and shade structures for next summer with the Interventions tab planner.', 'Urban Planning / Town Planner', 'this season')
  }

  const hot = level === 'critical' || level === 'alert'
  const labour = hot
    ? { restrictHours: level === 'critical' ? '12:00–16:00 no outdoor work' : '12:00–16:00 no heavy outdoor work', shiftWindow: '06:00–11:00', workRest: s.workRest || '—' }
    : null
  // English SMS stays in the GSM-7 alphabet (no °) so it fits 153-character segments.
  const tempTxt = peakT != null ? `${peakT}C` : 'high heat'
  const publicAdvisory = level === 'cold'
    ? { en: `${city}: cold alert. Night shelters are open. Wear layers, keep children and elderly warm, and never use a heater or angithi in a closed room.`, hi: `${city}: शीत लहर चेतावनी। रैन बसेरे खुले हैं। गर्म कपड़े पहनें, बच्चों और बुज़ुर्गों को गर्म रखें, बंद कमरे में अंगीठी या हीटर न जलाएँ।` }
    : hot
      ? { en: `${city} heat alert: ${tempTxt}. Avoid going out 12-4 pm. Drink water often, wear light cotton, check on elderly and children. Dizziness or confusion: call 108. Cooling centres are open.`, hi: `${city} लू चेतावनी: ${peakT != null ? `${peakT}°C` : 'भीषण गर्मी'}। दोपहर 12 से 4 बजे बाहर न निकलें। बार-बार पानी पिएँ, हल्के सूती कपड़े पहनें, बुज़ुर्गों और बच्चों का ध्यान रखें। चक्कर या बेहोशी हो तो 108 पर कॉल करें। शीतलन केंद्र खुले हैं।` }
      : { en: `${city}: warm conditions. Drink water regularly and avoid strenuous outdoor work in the afternoon.`, hi: `${city}: गर्मी का मौसम। नियमित रूप से पानी पिएँ और दोपहर में भारी बाहरी काम से बचें।` }

  const sdmaIncident = hot
    ? { type: level === 'critical' ? 'Heatwave — full Heat Action Plan activation' : 'Heat alert — Heat Action Plan activation', severity: level === 'critical' ? 'severe' : 'high', summary: `${city}${state ? `, ${state}` : ''}: ${reasons.join('; ')}. Heat Index ${fmt(s.heatIndex)}°C, WBGT (shade est.) ${fmt(s.wbgt)}°C.${firstHot ? ` Outlook: above-threshold from ${firstHot}.` : ''}` }
    : null

  // Budget and consequences from the deterministic costing the client computed (if present).
  const cst = input?.costing || null
  const budget = cst ? {
    emergencyThisWeek: (cst.emergency?.items || []).map(i => ({ item: i.item, qty: i.qty, unitCost: i.unitCost, cost: i.cost })),
    emergencyTotal: cst.emergency?.total ?? 0,
    seasonal: cst.seasonal ? { investment: cst.seasonal.spent, riskBefore: cst.seasonal.riskBefore, riskAfter: cst.seasonal.riskAfter, whatItBuys: `${cst.seasonal.roofs} cool roofs · ${cst.seasonal.hectaresGreen} ha plantation · ${cst.seasonal.coolingUnits} cooling units${cst.seasonal.hectaresReflective ? ` · ${cst.seasonal.hectaresReflective} ha reflective surfaces` : ''}` } : null,
    notPriced: cst.emergency?.notPriced || [],
    note: `Unit costs from the Mitigation Planner's published assumptions (Ahmedabad cool-roof pilot 2017, ₹350 per tree incl. 3-year care, ₹5 L per cooling centre). Model-based estimates, not quotations.${cst.target ? (cst.target.unreachable ? ` A ${cst.target.reductionPct}% risk cut is beyond the model's ceiling (~${cst.target.maxReductionPct}%).` : ` A ${cst.target.reductionPct}% composite-risk cut needs about ${fmtINR(cst.target.investment)}.`) : ''}`
  } : null
  const cq = cst?.consequences || null
  const ifNotControlled = cq ? {
    summary: hot
      ? `Without these measures, ${cq.hotDaysNext7} of the next 7 days stay at or above the ${cq.thresholdC ?? 40}°C IMD threshold${cq.peakForecastC != null ? ` (peak ${cq.peakForecastC}°C)` : ''}, with heat exposure unmanaged in the ${cq.exposureWindow} window.`
      : `Current readings do not cross an activation threshold; the main cost of inaction is being unprepared when they do.`,
    consequences: [
      ...(cq.hotDaysNext7 ? [`${cq.hotDaysNext7} day(s) in the next 7 at or above the IMD threshold with no cooling centres or water points open.`] : []),
      ...(cq.heatIndexBand ? [`Heat Index ${cq.heatIndexC}°C (${cq.heatIndexBand}): ${cq.heatIndexEffect || 'heat illness risk rises with exposure'}`] : []),
      ...(cq.workHoursLostPerWorkerPerDay ? [`Outdoor work at WBGT category ${cq.wbgtCat}: ${cq.workHoursLostPerWorkerPerDay} of every 8 working hours must be rest — enforced by order, or paid for in heat casualties and lost output.`] : []),
      ...(cq.wetBulbC != null && cq.wetBulbC >= 28 ? [`Wet-bulb ${cq.wetBulbC}°C: sweating cools the body less; by ~31°C even healthy adults cannot shed heat (Vecellio et al. 2022).`] : []),
      ...(hot ? ['Afternoon power demand for cooling peaks while hospitals and water pumping compete for the same feeders.'] : [])
    ],
    whoIsHitFirst: hot ? ['Outdoor construction and MGNREGA workers', 'Street vendors and delivery riders', 'Elderly people and infants in top-floor or tin-roof housing', 'Patients in facilities without reliable cooling'] : []
  } : null

  const headline = {
    critical: `${city}: CRITICAL heat — activate the full Heat Action Plan now`,
    alert: `${city}: heat ALERT — activate cooling, health and labour measures today`,
    watch: `${city}: heat WATCH — prepare, nothing to activate yet`,
    cold: `${city}: cold-weather protocol`,
    routine: `${city}: routine monitoring — no activation needed`
  }[level]

  const situation = `Activation level ${level.toUpperCase()} because ${reasons.join('; ')}. `
    + `Now ${fmt(input?.current?.temp)}°C at ${fmt(input?.current?.humidity)}% humidity → Heat Index ${fmt(s.heatIndex)}°C (${s.heatIndexBandLabel || '—'}), wet-bulb ${fmt(s.wetBulb)}°C, WBGT shade estimate ${fmt(s.wbgt)}°C.`
    + (input?.outlook?.headline ? ` 7-day outlook: ${input.outlook.headline}.` : '')

  return {
    level,
    headline,
    situation,
    actions,
    labour,
    publicAdvisory,
    sdmaIncident,
    budget,
    ifNotControlled,
    assumptions: [
      'Rule-based protocol (NDMA heat-wave guidelines, Ahmedabad Heat Action Plan) — not generated by the agent.',
      'No ward, population or facility-location data is held, so zones are described, not named.',
      'WBGT is a shade estimate from temperature and humidity; in direct sun it is higher.',
      ...(input?.demo ? ['Temperatures include a ?demo override — this is a rehearsal scenario, not a live reading.'] : [])
    ]
  }
}

// Validate and clamp a plan object from any source (agent JSON is untrusted). Returns a
// clean plan or null if it is unusable.
export function sanitisePlan(raw) {
  if (!raw || typeof raw !== 'object') return null
  const str = (v, max) => (typeof v === 'string' ? v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, max) : '')
  const oneOf = (v, list, d) => (list.includes(v) ? v : d)
  const actions = Array.isArray(raw.actions) ? raw.actions.slice(0, 12).map(a => ({
    title: str(a?.title, 100),
    detail: str(a?.detail, 320),
    owner: str(a?.owner, 80),
    deadline: str(a?.deadline, 60),
    priority: oneOf(a?.priority, ['P1', 'P2', 'P3'], 'P2'),
    category: str(a?.category, 30) || 'monitoring'
  })).filter(a => a.title) : []
  if (!actions.length) return null
  const order = { P1: 0, P2: 1, P3: 2 }
  actions.sort((a, b) => order[a.priority] - order[b.priority])
  const labour = raw.labour && typeof raw.labour === 'object'
    ? { restrictHours: str(raw.labour.restrictHours, 80), shiftWindow: str(raw.labour.shiftWindow, 80), workRest: str(raw.labour.workRest, 80) }
    : null
  const pa = raw.publicAdvisory && typeof raw.publicAdvisory === 'object' ? raw.publicAdvisory : {}
  const inc = raw.sdmaIncident && typeof raw.sdmaIncident === 'object' ? raw.sdmaIncident : null
  const money = v => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.round(Math.min(v, 1e11)) : null)
  const b = raw.budget && typeof raw.budget === 'object' ? raw.budget : null
  const budget = b ? {
    emergencyThisWeek: Array.isArray(b.emergencyThisWeek) ? b.emergencyThisWeek.slice(0, 12).map(i => ({ item: str(i?.item, 80), qty: money(i?.qty) ?? 0, unitCost: money(i?.unitCost) ?? 0, cost: money(i?.cost) ?? 0 })).filter(i => i.item) : [],
    emergencyTotal: money(b.emergencyTotal) ?? 0,
    seasonal: b.seasonal && typeof b.seasonal === 'object' ? { investment: money(b.seasonal.investment) ?? 0, riskBefore: money(b.seasonal.riskBefore), riskAfter: money(b.seasonal.riskAfter), whatItBuys: str(b.seasonal.whatItBuys, 240) } : null,
    notPriced: Array.isArray(b.notPriced) ? b.notPriced.slice(0, 8).map(x => str(x, 80)).filter(Boolean) : [],
    note: str(b.note, 300)
  } : null
  const n = raw.ifNotControlled && typeof raw.ifNotControlled === 'object' ? raw.ifNotControlled : null
  const ifNotControlled = n ? {
    summary: str(n.summary, 300),
    consequences: Array.isArray(n.consequences) ? n.consequences.slice(0, 6).map(x => str(x, 240)).filter(Boolean) : [],
    whoIsHitFirst: Array.isArray(n.whoIsHitFirst) ? n.whoIsHitFirst.slice(0, 4).map(x => str(x, 80)).filter(Boolean) : []
  } : null
  return {
    level: oneOf(raw.level, Object.keys(LEVELS), 'routine'),
    headline: str(raw.headline, 160),
    situation: str(raw.situation, 700),
    actions,
    labour: labour && (labour.restrictHours || labour.shiftWindow) ? labour : null,
    publicAdvisory: { en: str(pa.en, 320), hi: str(pa.hi, 320) },
    sdmaIncident: inc ? { type: str(inc.type, 100), severity: oneOf(inc.severity, ['low', 'moderate', 'high', 'severe'], 'moderate'), summary: str(inc.summary, 400) } : null,
    budget: budget && (budget.emergencyThisWeek.length || budget.seasonal) ? budget : null,
    ifNotControlled: ifNotControlled && (ifNotControlled.summary || ifNotControlled.consequences.length) ? ifNotControlled : null,
    assumptions: Array.isArray(raw.assumptions) ? raw.assumptions.slice(0, 6).map(a => str(a, 240)).filter(Boolean) : []
  }
}
