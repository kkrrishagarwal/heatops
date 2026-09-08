// Smart Mitigation Planner — the decision engine behind "I have ₹X, where should it go?"
//
// Everything here is a TRANSPARENT ESTIMATION MODEL, not a measurement. Every coefficient
// is listed in ASSUMPTIONS with where it comes from, and the UI prints them next to every
// number. The inputs that ARE measured: live temperature (Open-Meteo), NASA MODIS season
// peak surface temperature, ESA WorldCover built-up share and tree canopy, OpenStreetMap
// school/hospital counts (where fetched). Population is NOT modelled — there is no verified
// per-city population table in the project, so the planner reports exposure as built-up
// area, roofs and facilities instead of printing a population figure it cannot back.
//
// Units of work ("packages") are the things a municipality actually procures. Allocation
// is greedy by projected risk-points per rupee, with diminishing returns per city so the
// budget spreads to the next-worst city instead of piling everything on the first one.
// That is the whole optimiser — simple enough to explain to a District Magistrate in one
// breath, and deterministic, so the same inputs always give the same plan.

export const ASSUMPTIONS = {
  coreRadiusKm: 1,          // "priority core" = 1 km around the city centre (same radius as the OSM building-density panel)
  esaSampleRadiusKm: 5,     // ESA WorldCover fractions are computed over ~5 km around the centre (public/data/lulc_real.json)
  buildingFootprintM2: 400, // one building per 400 m² of built-up land → roofs in the core (assumption; used only where no OSM count exists)
  roofSqft: 1000,           // average roof treated per building, sq ft (assumption)
  coolRoofPerSqft: 1.25,    // ₹/sq ft — midpoint of the basic lime-wash tier (₹0.5–2, Ahmedabad pilot 2017) used by the Cool Roof calculator
  coolRoofLabourPerRoof: 1250, // ₹ — application labour + awareness per roof (assumption)
  treesPerHa: 400,          // urban plantation density (assumption; typical avenue/park spacing)
  costPerTree: 350,         // ₹ — sapling + planting + 3-year maintenance (assumption; state Nagar Van norms vary)
  coolingCentreCost: 500000,   // ₹ — retrofit of an existing hall: shading, fans, water, signage (assumption)
  waterStationCost: 50000,     // ₹ — public drinking-water point (assumption)
  reflectivePerM2: 150,        // ₹/m² — reflective pavement / road coating (assumption)
  facilityRetrofitCost: 150000, // ₹ — cool roof + shading for one school or hospital (assumption)
  // Impact coefficients — the app's existing illustrative cooling model (dashboardUtils.computeInterventionImpact):
  treeCoolingPerFraction: 18,  // °C at 100 % of the sample area under new canopy → 0.18 °C per +1 % canopy
  roofCoolingPerFraction: 14,  // °C at 100 % of roofs treated, scaled by the slider's 0.2 max → 2.8 °C at full coverage
  roofSliderMax: 0.2,
  reflectiveCoolingPerFraction: 12, // °C at 100 % of the core surface treated (water/surface coefficient of the same model)
  riskPointsPerDegC: 4,        // 1 °C of projected local cooling ≈ 4 risk points on the 0–100 composite (assumption)
  coolingCentrePoints: 1.5,    // exposure relief per centre, cities at High or worse only (assumption; no temperature change modelled)
  waterStationPoints: 0.15,
  facilityPoints: 0.4,         // per school/hospital made heat-safe (assumption)
  diminishing: 0.9,            // each further ₹25 L placed in the same city yields 90 % of the previous tranche's effect (assumption)
  diminishingTranche: 2500000,
  minBudget: 50000,            // below one water station nothing can be procured
  reliefMaxShare: 0.4,         // cooling centres + water stations may take at most 40 % of a budget: they relieve exposure but do not cool the city (portfolio rule)
}

export const INTERVENTIONS = {
  green: { key: 'green', label: 'Green infrastructure', icon: 'leaf', color: '#22c55e', unit: '1 ha plantation' },
  roofs: { key: 'roofs', label: 'Cool roofs', icon: 'home', color: '#38bdf8', unit: '100 roofs' },
  cooling: { key: 'cooling', label: 'Cooling infrastructure', icon: 'droplets', color: '#60a5fa', unit: 'centre / water station' },
  surfaces: { key: 'surfaces', label: 'Reflective surfaces', icon: 'sun', color: '#f59e0b', unit: '1 ha pavement' },
  facilities: { key: 'facilities', label: 'Priority public facilities', icon: 'building', color: '#f472b6', unit: 'school / hospital' },
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
export const fmtINR = n => {
  if (n == null || !isFinite(n)) return '—'
  const a = Math.abs(n)
  if (a >= 1e7) return `₹${(n / 1e7).toFixed(a >= 1e8 ? 1 : 2)} Cr`
  if (a >= 1e5) return `₹${(n / 1e5).toFixed(a >= 1e6 ? 1 : 2)} L`
  return `₹${Math.round(n).toLocaleString('en-IN')}`
}

// ---------- 1. City risk profile (0–100 composite) ----------
// temp: live current temperature (°C) or null; modisPeak: season's hottest surface (°C) or null;
// lulc: { builtUp, treeCover|vegetation, isFallback }; facilities: { schools, hospitals } | null
export function cityRiskProfile({ city, state, temp, tempMax, modisPeak, lulc, facilities, buildingsCore }) {
  const t = typeof tempMax === 'number' ? Math.max(tempMax, temp ?? -99) : temp
  let tempPts = null
  if (typeof t === 'number') tempPts = t < 25 ? 10 : t < 30 ? 30 : t < 35 ? 50 : t < 40 ? 70 : t < 45 ? 85 : 95
  const surfacePts = typeof modisPeak === 'number' ? clamp((modisPeak - 35) * 1.0, 0, 10) : 0
  // Only a city's OWN ESA classification counts. The nearest-city fallback the dashboard
  // uses for display would let a village inherit Bikaner's 60 % built-up share and rank
  // level with it — so for ranking, fallback land cover is treated as unknown.
  const own = lulc && !lulc.isFallback
  const builtUp = own && typeof lulc.builtUp === 'number' ? lulc.builtUp : null
  const canopy = own ? (typeof lulc.treeCover === 'number' ? lulc.treeCover : (typeof lulc.vegetation === 'number' ? lulc.vegetation : null)) : null
  const builtPts = builtUp != null ? builtUp * 0.2 : 0
  const canopyRelief = canopy != null ? clamp(canopy / 30, 0, 1) * 10 : 0
  const risk = tempPts == null ? null : clamp(Math.round(tempPts + surfacePts + builtPts - canopyRelief), 0, 100)
  const coreAreaHa = Math.PI * ASSUMPTIONS.coreRadiusKm ** 2 * 100
  const roofs = typeof buildingsCore === 'number' ? buildingsCore
    : builtUp != null ? Math.round((builtUp / 100) * coreAreaHa * 10000 / ASSUMPTIONS.buildingFootprintM2) : null
  const canopyGapPct = canopy != null ? Math.max(0, 30 - canopy) : null
  const lulcFallbackCity = lulc?.isFallback ? lulc.fallbackCity : null
  const inputs = { temp: typeof temp === 'number', forecastHigh: typeof tempMax === 'number', modis: typeof modisPeak === 'number', lulc: !!lulc && !lulc.isFallback, lulcFallback: !!lulc?.isFallback, facilities: !!facilities, osmBuildings: typeof buildingsCore === 'number' }
  const score = (inputs.temp ? 1 : 0) + (inputs.modis ? 1 : 0) + (inputs.lulc ? 1 : 0) + (inputs.facilities ? 0.5 : 0)
  const confidence = risk == null ? 'none' : score >= 3 ? 'high' : score >= 2 ? 'medium' : 'low'
  return { city, state, risk, tempPts, surfacePts, builtPts, canopyRelief, temp, tempMax, modisPeak, builtUp, canopy, canopyGapPct, roofs, coreAreaHa, facilities: facilities || null, lulcFallbackCity, inputs, confidence, riskLabel: riskLabel(risk) }
}
export function riskLabel(r) {
  if (r == null) return { label: 'NO DATA', color: '#64748b' }
  if (r >= 80) return { label: 'CRITICAL', color: '#b91c1c' }
  if (r >= 65) return { label: 'HIGH', color: '#c2410c' }
  if (r >= 45) return { label: 'MODERATE', color: '#ca8a04' }
  return { label: 'LOW', color: '#15803d' }
}

// ---------- 2. Packages a city can absorb ----------
// Each package: { type, city, cost, points (projected risk points, before diminishing), qty, detail }
function packagesFor(p) {
  const A = ASSUMPTIONS
  const out = []
  if (p.risk == null) return out
  // Green: 1 ha plantation packages inside the 1 km priority core, up to the canopy gap
  // (the ESA canopy share is assumed to hold in the core too)
  if (p.canopyGapPct != null && p.canopyGapPct > 0) {
    const coreHa = p.coreAreaHa
    const maxHa = Math.min(60, Math.round(p.canopyGapPct / 100 * coreHa))
    const pctPerHa = 100 / coreHa
    for (let i = 0; i < maxHa; i++) out.push({ type: 'green', cost: A.treesPerHa * A.costPerTree, points: pctPerHa / 100 * A.treeCoolingPerFraction * A.riskPointsPerDegC, qty: 1, unit: 'ha', detail: `${A.treesPerHa} trees × ${fmtINR(A.costPerTree)}` })
  }
  // Cool roofs: 100-roof packages up to the core's roofs
  if (p.roofs) {
    const perRoof = A.roofSqft * A.coolRoofPerSqft + A.coolRoofLabourPerRoof
    const n = Math.min(100, Math.floor(p.roofs / 100))
    for (let i = 0; i < n; i++) out.push({ type: 'roofs', cost: 100 * perRoof, points: (100 / p.roofs) * A.roofCoolingPerFraction * A.roofSliderMax * A.riskPointsPerDegC, qty: 100, unit: 'roofs', detail: `100 × (${A.roofSqft} sq ft × ₹${A.coolRoofPerSqft} + ₹${A.coolRoofLabourPerRoof} labour)` })
  }
  // Cooling infrastructure: centres only where risk is High or worse; water stations anywhere
  if (p.risk >= 65) for (let i = 0; i < 2; i++) out.push({ type: 'cooling', cost: A.coolingCentreCost, points: A.coolingCentrePoints, qty: 1, unit: 'cooling centre', detail: 'hall retrofit: shade, fans, water, signage' })
  for (let i = 0; i < 5; i++) out.push({ type: 'cooling', cost: A.waterStationCost, points: A.waterStationPoints, qty: 1, unit: 'water station', detail: 'public drinking-water point' })
  // Reflective surfaces: 1 ha packages, up to 10 % of the core
  const coreHa = p.coreAreaHa
  for (let i = 0; i < Math.round(coreHa * 0.1); i++) out.push({ type: 'surfaces', cost: 10000 * A.reflectivePerM2, points: (1 / coreHa) * A.reflectiveCoolingPerFraction * A.riskPointsPerDegC, qty: 1, unit: 'ha', detail: `10,000 m² × ₹${A.reflectivePerM2}` })
  // Facilities: one package per school/hospital counted by OSM
  const fac = (p.facilities?.schools || 0) + (p.facilities?.hospitals || 0)
  for (let i = 0; i < Math.min(fac, 30); i++) out.push({ type: 'facilities', cost: A.facilityRetrofitCost, points: A.facilityPoints, qty: 1, unit: 'facility', detail: 'cool roof + shading for one school/hospital' })
  return out.map(k => ({ ...k, city: p.city, state: p.state }))
}

// ---------- 3. Optimiser: budget → plan ----------
// profiles: cityRiskProfile[] for the state. Returns the plan or an { error } object.
export function optimisePlan(profiles, budget, opts = {}) {
  const A = ASSUMPTIONS
  const usable = profiles.filter(p => p.risk != null)
  if (!(budget > 0)) return { error: 'zero', message: 'Enter a budget above ₹0.' }
  if (budget < A.minBudget) return { error: 'tooSmall', message: `Budget is below the minimum estimated implementation cost (${fmtINR(A.minBudget)} for one water station).` }
  if (!usable.length) return { error: 'noData', message: 'No city in this state has a live reading yet, so nothing can be ranked.' }
  // priority weight: risk × exposure (built-up share) — used to order tie-breaks and the explanation
  const weight = p => (p.risk / 100) * (0.5 + 0.5 * ((p.builtUp ?? 30) / 100))
  // exposure: built-up share stands in for people affected (no population table) — it cancels
  // the small-core artefact where 100 roofs in a village look like they cool 20 % of the town
  const candidates = usable.flatMap(packagesFor).map(k => { const p = usable.find(x => x.city === k.city); return { ...k, priority: weight(p), riskFactor: p.risk / 100, exposure: Math.max(0.05, (p.builtUp ?? 25) / 100) } })
  if (!candidates.length) return { error: 'noIntervention', message: 'No suitable intervention can be priced for these cities (no land-cover or roof data).' }
  const perCitySpend = {}
  let reliefSpent = 0
  const chosen = []
  let remaining = budget
  const only = opts.onlyTypes ? new Set(opts.onlyTypes) : null
  const pool = candidates.filter(k => !only || only.has(k.type))
  // greedy on projected points per rupee, with diminishing returns per city
  while (true) {
    let best = null, bestVal = 0, bestIdx = -1
    for (let i = 0; i < pool.length; i++) {
      const k = pool[i]
      if (k.cost > remaining) continue
      if (k.type === 'cooling' && reliefSpent + k.cost > budget * A.reliefMaxShare) continue
      const n = (perCitySpend[k.city] || 0) / A.diminishingTranche
      // projected points scale with the city's own risk (cooling a cool town removes little
      // risk) and shrink with every ₹25 L already placed there
      const eff = k.points * k.riskFactor * Math.pow(A.diminishing, n)
      const val = (eff * k.exposure * (0.5 + k.priority)) / k.cost
      if (val > bestVal) { bestVal = val; best = k; bestIdx = i }
    }
    if (!best) break
    const n = (perCitySpend[best.city] || 0) / A.diminishingTranche
    chosen.push({ ...best, effPoints: best.points * best.riskFactor * Math.pow(A.diminishing, n) })
    perCitySpend[best.city] = (perCitySpend[best.city] || 0) + best.cost
    remaining -= best.cost
    if (best.type === 'cooling') reliefSpent += best.cost
    pool.splice(bestIdx, 1)
    if (chosen.length > 2000) break
  }
  if (!chosen.length) return { error: 'tooSmall', message: `Budget is below the cheapest package available for these cities.` }
  return summarise(profiles, usable, chosen, budget, remaining)
}

function summarise(profiles, usable, chosen, budget, remaining) {
  const byType = {}
  const byCity = {}
  for (const k of chosen) {
    const t = (byType[k.type] ||= { type: k.type, cost: 0, qty: 0, unit: k.unit, packages: 0, points: 0, units: {} })
    t.cost += k.cost; t.qty += k.qty; t.packages += 1; t.points += k.effPoints; t.units[k.unit] = (t.units[k.unit] || 0) + k.qty
    const c = (byCity[k.city] ||= { city: k.city, state: k.state, cost: 0, points: 0, types: {}, items: [] })
    c.cost += k.cost; c.points += k.effPoints
    const ct = (c.types[k.type] ||= { type: k.type, cost: 0, qty: 0, unit: k.unit, packages: 0, units: {} })
    ct.cost += k.cost; ct.qty += k.qty; ct.packages += 1; ct.units[k.unit] = (ct.units[k.unit] || 0) + k.qty
  }
  const cities = Object.values(byCity).map(c => {
    const p = usable.find(x => x.city === c.city)
    const after = Math.max(0, Math.round(p.risk - c.points))
    return { ...c, before: p.risk, after, profile: p }
  }).sort((a, b) => b.cost - a.cost)
  // Headline before/after = the state's PRIORITY SET: its ten highest-risk cities (fixed before
  // optimisation, so a plan cannot flatter itself by funding fewer cities). The whole-state
  // average is reported alongside; in a 76-city state it barely moves at ₹1 Cr, honestly.
  const prioritySet = [...usable].sort((a, b) => b.risk - a.risk).slice(0, Math.min(10, usable.length))
  const afterMap = Object.fromEntries(cities.map(c => [c.city, c.after]))
  const avgBefore = prioritySet.reduce((s, p) => s + p.risk, 0) / prioritySet.length
  const avgAfter = prioritySet.reduce((s, p) => s + (afterMap[p.city] ?? p.risk), 0) / prioritySet.length
  const allBefore = usable.reduce((s, p) => s + p.risk, 0) / usable.length
  const allAfter = usable.reduce((s, p) => s + (afterMap[p.city] ?? p.risk), 0) / usable.length
  const spent = budget - remaining
  const trees = (byType.green?.qty || 0) * ASSUMPTIONS.treesPerHa
  const roofs = byType.roofs?.qty || 0
  const conf = cities.map(c => c.profile.confidence)
  const confidence = conf.every(c => c === 'high') ? 'high' : conf.some(c => c === 'low') ? 'low' : 'medium'
  const reduction = avgBefore > 0 ? (avgBefore - avgAfter) / avgBefore : 0
  return {
    budget, spent, remaining, byType, cities, trees, roofs,
    hectaresGreen: byType.green?.qty || 0, coolingUnits: byType.cooling?.qty || 0, facilities: byType.facilities?.qty || 0, hectaresReflective: byType.surfaces?.qty || 0,
    stateBefore: Math.round(avgBefore), stateAfter: Math.round(avgAfter), prioritySize: prioritySet.length, priorityCities: prioritySet.map(p => p.city),
    allBefore: Math.round(allBefore * 10) / 10, allAfter: Math.round(allAfter * 10) / 10,
    reductionPct: [Math.round(reduction * 100 * 0.8), Math.round(reduction * 100 * 1.2)], // ± range: the model's own uncertainty band (assumption)
    confidence, citiesRanked: usable.length, citiesCovered: cities.length,
    why: explain(cities, usable, byType),
  }
}

function explain(cities, usable, byType) {
  const lines = []
  const top = cities[0]
  if (top && usable.length === 1) {
    const p = top.profile
    lines.push(`${p.city} scores ${p.risk}/100 (${p.riskLabel.label.toLowerCase()}) on the composite: forecast high ${p.tempMax ?? p.temp} °C${p.modisPeak != null ? `, NASA MODIS season peak surface ${p.modisPeak} °C` : ''}${p.builtUp != null ? `, ${p.builtUp}% built-up` : ''}${p.canopy != null ? `, canopy ${p.canopy}% against the 30 % target` : ''}.`)
    if (top.types.green) lines.push(`Plantation is funded because the canopy gap is ${p.canopyGapPct.toFixed(0)} points and each hectare in the 1 km core projects ${(100 / p.coreAreaHa / 100 * ASSUMPTIONS.treeCoolingPerFraction).toFixed(2)} °C of cooling for ${fmtINR(ASSUMPTIONS.treesPerHa * ASSUMPTIONS.costPerTree)}.`)
    if (top.types.roofs) lines.push(`Cool roofs are funded because ${p.roofs ? `the core has ~${p.roofs.toLocaleString('en-IN')} roofs and` : ''} each 100 treated roofs cost ${fmtINR(100 * (ASSUMPTIONS.roofSqft * ASSUMPTIONS.coolRoofPerSqft + ASSUMPTIONS.coolRoofLabourPerRoof))} at the lime-wash rate.`)
  } else if (top) {
    const p = top.profile
    lines.push(`${p.city} gets the largest share: composite risk ${p.risk}/100 (${p.riskLabel.label.toLowerCase()})${p.modisPeak != null ? `, NASA MODIS season peak surface ${p.modisPeak} °C` : ''}${p.builtUp != null ? `, ${p.builtUp}% built-up` : ''}.`)
    if (p.canopyGapPct && top.types.green) lines.push(`Its tree canopy is ${p.canopy}% against the 30 % target of the 3-30-300 rule — a ${p.canopyGapPct.toFixed(0)}-point gap, which is why plantation is funded there.`)
    else if (p.canopyGapPct) lines.push(`Its tree canopy is ${p.canopy}% against the 30 % target — plantation there costs ${fmtINR(ASSUMPTIONS.treesPerHa * ASSUMPTIONS.costPerTree)} per hectare and only enters the plan once cheaper measures are exhausted.`)
  }
  const order = Object.values(byType).sort((a, b) => b.points / b.cost - a.points / a.cost)
  if (order.length > 1) lines.push(`Per rupee, ${INTERVENTIONS[order[0].type].label.toLowerCase()} gives the most projected risk reduction ${usable.length === 1 ? 'here' : 'in these cities'}, so it is funded first; ${INTERVENTIONS[order[order.length - 1].type].label.toLowerCase()} is funded last.`)
  const skipped = usable.length - cities.length
  if (skipped > 0) lines.push(`${skipped} lower-risk ${skipped === 1 ? 'city was' : 'cities were'} not funded at this budget — raising it extends the plan down the ranking.`)
  if (byType.cooling) lines.push(`Cooling centres and water stations are capped at ${Math.round(ASSUMPTIONS.reliefMaxShare * 100)} % of the budget: they relieve exposure quickly but do not cool the city.`)
  if (usable.length > 1) lines.push('Every further ₹25 L in the same city counts for 10 % less than the previous ₹25 L, so the budget spreads to the next-worst city rather than piling up in one.')
  else lines.push('Every further ₹25 L in this city counts for 10 % less than the previous ₹25 L — the model saturates rather than promising linear gains.')
  return lines
}

// ---------- 4. Mode 2: intervention → cost for one city ----------
export function estimateIntervention(profile, type, quantity) {
  const A = ASSUMPTIONS
  if (!profile || profile.risk == null) return { error: 'noData', message: 'No live reading for this city yet.' }
  const coreHa = profile.coreAreaHa
  if (type === 'green') {
    // quantity = target canopy increase in percentage points across the 1 km core
    const ha = Math.round(quantity / 100 * coreHa)
    const trees = ha * A.treesPerHa
    const cost = trees * A.costPerTree
    const cooling = quantity / 100 * A.treeCoolingPerFraction
    return { type, quantity, ha, trees, cost, cooling, points: Math.round(cooling * A.riskPointsPerDegC), lines: [`${quantity}% of the ${Math.round(coreHa).toLocaleString('en-IN')} ha priority core (1 km radius) = ${ha.toLocaleString('en-IN')} ha`, `${ha.toLocaleString('en-IN')} ha × ${A.treesPerHa} trees/ha = ${trees.toLocaleString('en-IN')} trees`, `${trees.toLocaleString('en-IN')} × ₹${A.costPerTree} = ${fmtINR(cost)}`] }
  }
  if (type === 'roofs') {
    // quantity = roofs
    const perRoof = A.roofSqft * A.coolRoofPerSqft + A.coolRoofLabourPerRoof
    const cost = quantity * perRoof
    const frac = profile.roofs ? Math.min(1, quantity / profile.roofs) : 0
    const cooling = frac * A.roofCoolingPerFraction * A.roofSliderMax
    return { type, quantity, cost, cooling, points: Math.round(cooling * A.riskPointsPerDegC), coverage: frac, lines: [`${quantity.toLocaleString('en-IN')} roofs × (${A.roofSqft} sq ft × ₹${A.coolRoofPerSqft} lime-wash + ₹${A.coolRoofLabourPerRoof} labour) = ${fmtINR(cost)}`, profile.roofs ? `${Math.round(frac * 100)}% of the ~${profile.roofs.toLocaleString('en-IN')} roofs in the 1 km core` : 'roof count unknown for this city'] }
  }
  if (type === 'cooling') {
    const cost = quantity * A.coolingCentreCost
    return { type, quantity, cost, cooling: 0, points: quantity * A.coolingCentrePoints, lines: [`${quantity} cooling centre${quantity === 1 ? '' : 's'} × ${fmtINR(A.coolingCentreCost)} = ${fmtINR(cost)}`, 'no temperature change is modelled — exposure relief only'] }
  }
  if (type === 'surfaces') {
    const cost = quantity * 10000 * A.reflectivePerM2
    const cooling = (quantity / profile.coreAreaHa) * A.reflectiveCoolingPerFraction
    return { type, quantity, cost, cooling, points: Math.round(cooling * A.riskPointsPerDegC), lines: [`${quantity} ha × 10,000 m² × ₹${A.reflectivePerM2} = ${fmtINR(cost)}`] }
  }
  if (type === 'facilities') {
    const cost = quantity * A.facilityRetrofitCost
    return { type, quantity, cost, cooling: 0, points: quantity * A.facilityPoints, lines: [`${quantity} facilities × ${fmtINR(A.facilityRetrofitCost)} = ${fmtINR(cost)}`] }
  }
  return { error: 'unknown', message: 'Unknown intervention.' }
}

// ---------- 5. Mode 3: target → budget ----------
export function budgetForTarget(profiles, targetReductionPct, maxBudget = 5e8) {
  let lo = ASSUMPTIONS.minBudget, hi = maxBudget, best = null
  const target = targetReductionPct / 100
  const reductionOf = plan => plan && !plan.error && plan.stateBefore > 0 ? (plan.stateBefore - plan.stateAfter) / plan.stateBefore : 0
  const ceiling = optimisePlan(profiles, hi)
  const maxRed = reductionOf(ceiling)
  if (maxRed < target) return { error: 'unreachable', maxReductionPct: Math.round(maxRed * 100), maxPlan: ceiling, message: `A ${targetReductionPct}% reduction is beyond what the interventions in this model can deliver for this state — the ceiling is about ${Math.round(maxRed * 100)}% (every package the model knows about, ${fmtINR(ceiling.spent)}). Physical cooling in the 1 km cores cannot remove the rest; that is honest, not a bug.` }
  for (let i = 0; i < 22; i++) {
    const mid = Math.round((lo + hi) / 2)
    const plan = optimisePlan(profiles, mid)
    if (reductionOf(plan) >= target) { best = plan; hi = mid } else lo = mid
    if (hi - lo < 25000) break
  }
  return best
}
