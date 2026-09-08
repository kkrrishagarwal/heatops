# BhaskarOps — Stakeholder Alerting: Old Tradition vs. New Tradition vs. Existing Platforms

*Updated 4 September 2026 to match the live product at https://heatops.vercel.app. Every claim below is true of the deployed app today; roadmap items are marked as such.*

## 1. Old tradition — IMD only (without BhaskarOps)

How Indian stakeholders currently receive heatwave information, through the India Meteorological Department (IMD) and existing government systems.

| Aspect | How it works today |
|---|---|
| Alert frequency | Twice-daily district-level heatwave warnings from IMD |
| Alert format | Colour-coded severity: Green (normal), Yellow (be aware), Orange (be prepared), Red (take action) |
| Reasoning given | Severity level only — no explanation of *why* a zone is hot (built-up density, vegetation loss…) |
| Granularity | District level; no city-by-city or locality view |
| Action guidance | One generic advisory for everyone — "avoid peak hours, stay hydrated" — regardless of role |
| Budget / planning support | None — no cost estimates or intervention comparison; officials plan separately |
| Delivery | Email, APIs, apps, websites, social media, print/electronic media, CAP — the user must actively check |

## 2. New tradition — with BhaskarOps

BhaskarOps does not replace IMD — it adds a live, explanatory and actionable layer on top of official alerts.

| Aspect | What BhaskarOps adds |
|---|---|
| Reasoning | Explains *why* a city is hot with real land-cover data (ESA WorldCover: built-up share, vegetation, **tree canopy**) alongside live weather |
| Granularity | State → city → 1,932 cities with live readings (all 28 states and 8 UTs); states coloured by the **risk category most of their cities are in** (plurality vote over live readings, ties → more severe), with the per-category city counts and the median shown as supporting detail; district boundaries on the map. *(The sub-city heatmap grid is an intervention simulator on the city's live temperature, labelled illustrative — not measured hotspots.)* |
| Action guidance — officials | A **severity-adaptive Heat Action Plan checklist**: full activation steps (cooling centres, hospital alert, advisory, tankers, cool-roof priority) at High/Extreme risk, preparedness steps at Moderate, routine at Low, a distinct cold-weather protocol below 10 °C. Modelled on the Ahmedabad HAP / NDMA guidelines; tickable with timestamps |
| Action guidance — citizens | Plain-language risk level, **safe hours for the day**, a neighbourhood help card that changes with the weather, WhatsApp sharing — in 11 Indian languages |
| Budget decisions | **Smart Mitigation Planner**: a budget becomes a ranked, costed, explained plan across the state's cities (projected before/after, funded cities on the map, Plan A vs B, exportable report); cost-of-intervention and budget-for-target modes. Every unit cost is a printed assumption; population is declared not modelled |
| Interventions | Sliders for green cover / cool roofs / water bodies with **projected** cooling (an illustrative model, labelled) and cost estimates from Ahmedabad/Telangana pilot coefficients; a **Recommended plan** per city: tree canopy vs the 30 % target of the 3-30-300 urban-forestry rule |
| Comparison | Multi-city radar (live temperature and AQI axes, baseline indices labelled) so planners can prioritise |
| Transparency | Every number source-labelled; cities without a reading say **"NO LIVE DATA"** (never a guess); stale readings flagged "carried forward"; model accuracy disclosed both ways (R² 0.95 validation / −0.39 unseen-city) |
| Interaction | AGNI conversational analyst, grounded only in the platform's data, India-only by design, "(estimated)" tagging for anything not measured; 11 languages |

> "IMD tells you **how hot** it is and **when** to be careful. BhaskarOps tells you **why** it's hot, **where** the risk is concentrated, and **what to do** about it — with a cost estimate."

## 3. Comparable existing platform — BHRIGU (CSTEP)

BHRIGU (National Heat Insights Explorer, built by CSTEP) is the closest government-backed equivalent — an honest comparison, not a dismissal.

| Aspect | BHRIGU (CSTEP) | BhaskarOps |
|---|---|---|
| Data resolution | 1 km grid, national scale, 5,000+ urban areas | 1,932 cities with live readings; district boundaries; ESA 10 m land cover for 171 cities |
| Data freshness | Historical archive, 2002–2025 | Live — refreshed every few hours; states re-sampled live every 10 minutes in the browser |
| Historical depth | 23 years | 70+ days of daily snapshots (growing nightly) + NASA MODIS satellite surface temperature since March 2026 for 1,912 cities (in the app); 2016–2026 for 171 cities processing at NASA |
| Primary focus | Heat-exposure evidence base for research and policy | Day-to-day operational decisions and public communication |
| Intervention simulation | Not a core feature | Illustrative cooling model + cost estimates + canopy-target recommendation |
| Conversational AI | Not offered | AGNI, grounded and honest |
| Language access | Not specified | 11 Indian languages |
| Best used for | Long-term research, policy evidence, national trends | What to do today, and roughly what it costs |

> "BHRIGU gives cities a strong historical evidence base — a genuinely valuable foundation. BhaskarOps complements it with a live, actionable layer: where BHRIGU shows where heat exposure exists, BhaskarOps shows what to do about it today."

## 4. Equity lens — who is served, and how well

**Old tradition (IMD only)**

| User group | Advantage | Disadvantage |
|---|---|---|
| Poor / vulnerable (daily-wage, outdoor workers) | Free, no smartphone needed; reaches via radio, TV, news; a simple colour code | Generic advice ignores that stopping outdoor work means lost income; district alerts miss hotter micro-areas (tin-roof bastis, treeless colonies) |
| Privileged / resourceful | Easy to act on — AC, car, flexible work; many apps already give this | Minimal — already resourced to adapt |

**New tradition (with BhaskarOps)**

| User group | Advantage | Disadvantage / honest gap |
|---|---|---|
| Poor / vulnerable | **Citizen view** (built): plain-language risk, safe hours today, cold-weather guidance in winter, neighbourhood actions, WhatsApp sharing, 11 languages; **Lite mode** for low-end phones; low-cost cool-roof options (lime wash Rs 0.5–2 / sq ft) in the calculator | Needs a smartphone and internet, which not every household has; locality-level (basti) detail is limited to the ~96 Delhi localities and city points elsewhere — zone-level equity mapping remains roadmap |
| Privileged / resourceful | Cool-roof ROI directly usable; research-level depth available in Authority view | Minimal — already advantaged |

> "Heat hurts most those without AC and those who work outdoors. The citizen view, safe hours and the neighbourhood help card exist for exactly them — and reaching people without smartphones remains the honest gap, which is why officials' checklists and advisories are the other half of the design."

## 5. BHRIGU vs. BhaskarOps — advantage / disadvantage

**BHRIGU**

| Advantage | Disadvantage |
|---|---|
| Large scale: 5,000+ urban areas at 1 km, nationwide | Archival — does not answer "right now" |
| 23-year archive — strong for trends | No intervention simulation found |
| Government-backed (CSTEP) credibility | No conversational/AI layer; less accessible to non-technical users |
| Demographic + infrastructure + land-use evidence base | No stated multilingual support; no cost quantification |

**BhaskarOps**

| Advantage | Disadvantage |
|---|---|
| Live, self-refreshing — answers "what's happening right now" | Shorter archive (70+ days of our own + 6 months of MODIS; 10-year MODIS processing) vs 23 years |
| Illustrative intervention model + cost estimates + canopy recommendation — "what to do and roughly at what cost" | Intervention cooling is a labelled model, not a measurement |
| AGNI — natural-language access, grounded, honest | New and unestablished — no institutional credibility yet |
| 11 Indian languages; Citizen and Authority views | ML model's unseen-city generalisation is weak (R² −0.39, disclosed in-app) |
| Radical transparency — sources, gaps and limits always labelled | 1,932 cities vs BHRIGU's 5,000+ urban areas |

> "BHRIGU is a large, established evidence base — strong for research and long-term policy. BhaskarOps is a live, actionable decision tool — strong for day-to-day operational use. We do not want to replace BHRIGU; we complement it."
