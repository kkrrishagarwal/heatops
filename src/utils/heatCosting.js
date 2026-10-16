// Costing + consequences for the AI Co-Pilot's directive — computed deterministically from
// the planner's published unit costs (mitigationPlanner.ASSUMPTIONS) and the heat-stress
// data, then handed to the AI as DATA so every rupee and every "if not controlled" line is
// traceable. The AI may allocate and explain; it may not invent a price or a death count.
//
// Two horizons:
//   emergency  — this week's response at the activation level (cooling centres, water
//                stations). Items the model holds no price for (SMS blasts, ORS stock,
//                fire-tender fuel for misting runs) are listed as "not priced", not guessed.
//   seasonal   — the structural plan the Mitigation Planner would buy with the chosen budget
//                (cool roofs, plantation, reflective surfaces…) and what it projects.
import { ASSUMPTIONS, optimisePlan, budgetForTarget, fmtINR } from './mitigationPlanner'

const EMERGENCY_QTY = {
  critical: { coolingCentres: 4, waterStations: 10 },
  alert: { coolingCentres: 2, waterStations: 6 },
  watch: { coolingCentres: 0, waterStations: 2 },
  cold: { coolingCentres: 0, waterStations: 0 },
  routine: { coolingCentres: 0, waterStations: 0 }
}
export const TARGET_REDUCTION_PCT = 15
export const BUDGET_PRESETS = [2500000, 5000000, 10000000, 50000000]

export function unitCostTable() {
  const A = ASSUMPTIONS
  return [
    { item: 'Cooling centre (set-up + staffing, season)', unitCost: A.coolingCentreCost, unit: 'centre' },
    { item: 'Drinking-water station', unitCost: A.waterStationCost, unit: 'station' },
    { item: 'Cool roof, lime-wash, 1,000 sq ft', unitCost: A.coolRoofPerSqft * A.roofSqft + A.coolRoofLabourPerRoof, unit: 'roof' },
    { item: 'Plantation (400 trees, 3-yr care)', unitCost: A.treesPerHa * A.costPerTree, unit: 'hectare' },
    { item: 'Reflective pavement', unitCost: A.reflectivePerM2 * 10000, unit: 'hectare' },
    { item: 'School / hospital heat retrofit', unitCost: A.facilityRetrofitCost, unit: 'facility' }
  ]
}

// Productive outdoor hours lost per worker per day under the WBGT work/rest category, for a
// moderate-work 8-hour shift: rest minutes per hour / 60 × 8.
export function workHoursLost(workRest) {
  const m = /(\d+)\s*min work\s*\/\s*(\d+)\s*min rest/i.exec(workRest || '')
  if (!m) return 0
  return Math.round((Number(m[2]) / 60) * 8 * 10) / 10
}

export function buildCosting({ profile, level, stress, outlook, budget }) {
  const A = ASSUMPTIONS
  const q = EMERGENCY_QTY[level] || EMERGENCY_QTY.routine
  const items = []
  if (q.coolingCentres) items.push({ item: 'Cooling centres', qty: q.coolingCentres, unitCost: A.coolingCentreCost, cost: q.coolingCentres * A.coolingCentreCost })
  if (q.waterStations) items.push({ item: 'Drinking-water stations', qty: q.waterStations, unitCost: A.waterStationCost, cost: q.waterStations * A.waterStationCost })
  const emergency = {
    items,
    total: items.reduce((s, i) => s + i.cost, 0),
    notPriced: level === 'critical' || level === 'alert' ? ['SMS / WhatsApp advisory blasts', 'ORS and IV-fluid stock', 'Fire-tender fuel for misting runs', 'Overtime for control-room and health staff'] : []
  }

  let seasonal = null
  let target = null
  if (profile && profile.risk != null && budget > 0) {
    const plan = optimisePlan([profile], budget)
    if (plan && !plan.error) {
      seasonal = {
        budget, spent: plan.spent, riskBefore: plan.stateBefore, riskAfter: plan.stateAfter, reductionPct: plan.reductionPct,
        roofs: plan.roofs, hectaresGreen: plan.hectaresGreen, coolingUnits: plan.coolingUnits, hectaresReflective: plan.hectaresReflective || 0, facilities: plan.facilities || 0,
        byType: Object.values(plan.byType || {}).map(t => ({ type: t.type, cost: t.cost, qty: t.qty, unit: t.unit })),
        confidence: plan.confidence
      }
    }
    const t = budgetForTarget([profile], TARGET_REDUCTION_PCT)
    target = t && !t.error
      ? { reductionPct: TARGET_REDUCTION_PCT, investment: t.spent, riskBefore: t.stateBefore, riskAfter: t.stateAfter }
      : t && t.error === 'unreachable' ? { reductionPct: TARGET_REDUCTION_PCT, unreachable: true, maxReductionPct: t.maxReductionPct, ceilingInvestment: t.maxPlan?.spent ?? null } : null
  }

  // Consequences, only from data the panel already shows.
  const hotDays = Array.isArray(outlook?.days) ? outlook.days.filter(d => ['watch', 'heatwave', 'severe'].includes(d.level)).length : 0
  const hoursLost = workHoursLost(stress?.workRest)
  const consequences = {
    hotDaysNext7: hotDays,
    thresholdC: outlook?.threshold?.t ?? null,
    peakForecastC: outlook?.peak?.maxTemp ?? null,
    heatIndexC: stress?.heatIndex ?? null,
    heatIndexBand: stress?.heatIndexBandLabel || null,
    heatIndexEffect: stress?.heatIndexEffect || null,
    wetBulbC: stress?.wetBulb ?? null,
    wbgtCat: stress?.wbgtCat ?? null,
    workHoursLostPerWorkerPerDay: hoursLost,
    exposureWindow: '12:00–16:00'
  }

  return { unitCosts: unitCostTable(), emergency, seasonal, target, consequences, fmt: { emergencyTotal: fmtINR(emergency.total), seasonalSpent: seasonal ? fmtINR(seasonal.spent) : null, targetInvestment: target && !target.unreachable ? fmtINR(target.investment) : null } }
}
