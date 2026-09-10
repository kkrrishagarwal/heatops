# BhaskarOps — Briefing for Judges and SIH Deck Content

*Short version for the panel and for building slides. Facts match the live product at https://heatops.vercel.app on 8 September 2026. The story, the spoken script, the demo path and the full feature map are in `PROJECT_STORY.md`; the technical deep-dive is `PROJECT_EXPLAINED.md`.*

**Contents:** 1. In one page · 2. Slide-by-slide content · 3. Where we stand — IMD, BHRIGU, equity · 4. Questions judges ask

---

## 1. In one page

### Title
**BhaskarOps** — India's live urban-heat platform, with **AGNI**, an AI analyst grounded in real data.

Live monitoring for 1,932 Indian cities. Plain-language guidance for citizens. Action playbooks for officials.

[Suggested visual: full-bleed screenshot of the India heat map with the BhaskarOps wordmark]

### The Problem in One Line
Indian cities are getting hotter, the data to act already exists — but it sits in silos nobody can use in time.

Citizens don't know *why* their city is hot. Officials have no live, city-level picture. Most tools are English-only or show fake numbers.

[Suggested visual: three-icon row — citizen, official, siloed databases]

### Our USP in One Line
**"A heat dashboard you can show a judge, a planner, or a citizen — and every number survives the question 'where's that from?'"**

[Suggested visual: single bold statement slide]

### What BhaskarOps Does
- Live heat map of India, coloured by real city temperatures
- 1,956 cities across all 28 states and 8 UTs; 1,932 with live readings
- City dashboards: weather, satellite indices, comparisons, interventions
- Citizen view and Authority view — two audiences, one product
- AGNI: ask questions in plain language, in 11 Indian languages

[Suggested visual: dashboard screenshot with the five tabs highlighted]

### Smart Mitigation Planner — the Decision Engine
**"I have ₹1 crore for heat mitigation. Where should it go?"**

STEP 1: Budget → preset or custom amount
STEP 2: Rank → every city in the state scored on forecast high, NASA satellite peak, built-up share, canopy gap
STEP 3: Optimise → the budget is spent where each rupee removes the most projected risk (roofs, plantation, cooling centres, water, reflective surfaces, schools and hospitals)
STEP 4: Explain → "Why this plan?" in plain sentences, every unit cost printed
STEP 5: Decide → before/after, funded cities on the map, Plan A vs Plan B, export for the DDMA meeting

Also: "What does +5 % canopy cost in Bikaner?" and "What budget reaches a 10 % reduction?" — same engine.

[Suggested visual: planner screenshot — ₹1 Cr allocation bars, before/after cards, map markers]

### Radical Honesty, Enforced in Code
- Every number is traceable to a named source
- Cities without a reading say "NO LIVE DATA" — nothing is estimated
- Stale readings are flagged "carried forward" with their real time
- Illustrative values (intervention model, baseline indices) are labelled as such
- The ML model shows its weak score next to its good one

[Suggested visual: screenshot collage of the honesty labels]

---

---

## 2. Slide-by-slide content

### The Heat-Intelligence Pipeline
STEP 1: Detect → Live temperature and air quality for every city, refreshed hourly; 7-day heatwave outlook against IMD thresholds
STEP 2: Predict → Risk level for each city, from the same rules used everywhere in the app
STEP 3: Analyze → Why it's hot: built-up share, vegetation, tree canopy from satellite land cover
STEP 4: Compare → Rank cities and states; benchmark one city against four others
STEP 5: Recommend → Cooling plan per city: canopy target, cool roofs, projected effect and cost
STEP 6: Act → Citizens get safe hours and help cards; officials get a Heat Action Plan checklist

[Suggested visual: six-step horizontal flowchart]

### Two Audiences, One Product
**Citizen view** — temperature, a plain risk badge, safe hours today, a WhatsApp share button, how to help neighbours.

**Authority view** — full dashboard, satellite indices, comparisons, interventions, a severity-adaptive Heat Action Plan checklist.

Chosen once at sign-in. Switchable any time.

[Suggested visual: side-by-side phone screenshots — Citizen vs Authority]

### Citizen Journey
STEP 1: Sign in → Choose "Citizen"
STEP 2: Map → See India coloured by live heat; tap your state
STEP 3: City → See temperature, risk level, air quality in plain language
STEP 4: What to do → Safe hours today and a neighbourhood help list, matched to the weather
STEP 5: Share → One tap sends the summary to family on WhatsApp
STEP 6: Ask AGNI → "Is it safe to go out today?" answered from real data

[Suggested visual: vertical journey flow with phone mockups]

### Authority Journey
STEP 1: Sign in → Choose "Government / Planner"
STEP 2: Map → Each state coloured by the risk category most of its cities are in; weather badges
STEP 3: State → All its cities refreshed live; open the hottest
STEP 4: Analyse → Satellite indices, land cover, model insights
STEP 5: Plan → Compare cities; simulate cool roofs, green cover, water bodies
STEP 6: Act → Tick the Heat Action Plan checklist; export the report

[Suggested visual: vertical journey flow with laptop mockups]

### Compare — One Chart, Two Jobs
- Radar of live temperature, air quality, wind and land cover for up to five cities
- **Officials:** rank cities to decide where cooling budgets go first; justify activations
- **Citizens:** "Is my city hotter than my parents' city?" — and share the answer on WhatsApp
- Same data, different decisions

[Suggested visual: radar chart comparing four cities, with two caption boxes — Official / Citizen]

### The Heat Action Plan Checklist Adapts to the Weather
- **Extreme / High:** full activation — cooling centres, hospital alert, advisory, tankers, cool-roof priority
- **Moderate:** preparedness — monitor, pre-position advisories, centres ready
- **Low:** routine monitoring, no activation
- **Cold (below 10 °C):** night shelters, cold-exposure advisory, livestock care

Modelled on the Ahmedabad HAP and NDMA guidelines. Ticks saved per city.

[Suggested visual: four-column tier table with colour bands red / amber / grey / blue]

### Recommended Plan for Every City
- Tree canopy today (ESA WorldCover satellite data)
- Target: 30 % canopy — the "30" of the 3-30-300 urban-forestry rule
- Gap to close, cool-roof share for the built-up area, projected cooling
- One click applies the plan to the intervention sliders

[Suggested visual: metric-card row — canopy now / target / to add / projected cooling]

### Data Refresh Cycle — the Site Keeps Itself Fresh
STEP 1: Fetch → Open-Meteo readings for all 1,932 cities, in paced batches
STEP 2: Flag → Any city that could not be refreshed is marked "carried forward", never shown as fresh
STEP 3: Snapshot → Today's readings saved as a daily history file
STEP 4: Commit → Cache and history pushed to GitHub automatically
STEP 5: Redeploy → Vercel rebuilds the site with the new data
STEP 6: Live sample → In the browser, every state re-sampled every 10 minutes

[Suggested visual: circular pipeline diagram]

### Live Data Fallback — Never a Blank Screen
STEP 1: Live API → Ask Open-Meteo for the selected city right now
STEP 2: Cached reading → If live fails, show the last reading, labelled "cached from X ago"
STEP 3: Honest gap → If nothing exists, show "NO LIVE DATA" — never an invented number

[Suggested visual: three-step decision flow with green / amber / grey outcomes]

### AGNI — the AI Analyst
STEP 1: Question → User asks in any of 11 languages
STEP 2: Ground → Real data for the selected city, any named cities, and an India-wide ranking is attached
STEP 3: Answer → Gemini replies through a secure proxy; the API key never reaches the browser
STEP 4: Label → Anything not measured is tagged "(estimated)"; global claims are refused

Five AI models in a fallback chain — the analyst stays up when one runs out of quota.

[Suggested visual: chat mockup — "Which Indian city has the cleanest air right now?"]

### Honest Model Disclosure
**Our model scores R² 0.95 on known cities and −0.39 on cities it has never seen — we print both, because a judge who checks would find the second one anyway.**

Trained on a published MODIS dataset of 20 global cities. Roadmap: retrain on Indian data.

[Suggested visual: two big numbers side by side, 0.95 and −0.39]

### Data Sources
- **Open-Meteo** — live weather, air quality, geocoding
- **ESA WorldCover 10 m** — vegetation, built-up, tree canopy
- **NASA MODIS (MOD11A1)** — satellite land-surface temperature, daily 1 km: 1,912 cities since March 2026, and a **ten-year record (2016–2026)** for 171 cities shown year by year
- **OpenStreetMap** — building density, validated coordinates
- **ISRO INSAT-3D** — requested via MOSDAC as the next layer

[Suggested visual: logo row of data providers with a "free & open" badge]

### Technology Stack
- **Frontend:** React 18, Vite, react-simple-maps, Recharts, i18next (11 languages)
- **Backend:** Node.js serverless functions on Vercel; GitHub Actions for data refresh
- **AI:** Google Gemini via the AGNI proxy, 5-model fallback chain
- **Data:** Open-Meteo, ESA WorldCover, NASA MODIS, OpenStreetMap; scikit-learn model trained offline

Running cost today: ₹0 per month. No hardware.

[Suggested visual: four-row tagged stack diagram]

### Architecture at a Glance
STEP 1: Browser → React app loads the map, cache and satellite data files
STEP 2: Live calls → Open-Meteo for the selected city and state samples
STEP 3: AGNI → Questions go to a serverless proxy, then to Gemini
STEP 4: Refresh job → Fetches all cities, commits to GitHub, triggers redeploy
STEP 5: History → Daily snapshots served by an API, a viewer page and CSV export

[Suggested visual: boxed architecture diagram with arrows]

### Built for Low-End Phones Too
- Mobile and laptop layouts; works at 375 px wide
- Lite mode: no 3D, lighter map, no animations — same data
- 11 Indian languages, including Hindi, Bengali, Tamil, Telugu, Marathi, Urdu

[Suggested visual: budget phone mockup showing the citizen view]

### How We Compare
- **IMD alerts:** say how hot and when. **BhaskarOps:** says why, where, and what to do
- **BHRIGU (CSTEP):** a 23-year research archive. **BhaskarOps:** a live, actionable decision tool
- We complement both; we replace neither

[Suggested visual: three-column comparison table]

### Key Demo Features
- Smart Mitigation Planner: ₹1 crore → ranked, costed, explained plan; re-optimises live at ₹50 lakh; funded cities on the map
- Live India map: each state coloured by the category most of its cities are in (ties err toward the more severe), with the city counts on hover
- NASA MODIS satellite surface temperature for the selected city: hottest surface this season with its date, weekly chart, and AGNI answering from the same numbers
- 30-day temperature trend for any city, from our own daily archive — and "33 °C now, 40 °C expected" from the forecast high
- Citizen view with safe hours and WhatsApp share
- Severity-adaptive Heat Action Plan checklist
- Recommended canopy plan with one-click apply
- AGNI answering a ranking question from real data
- Demo mode: `?demo=Leh:-8,Sri Ganganagar:46` shows the cold protocol and full heat activation in one session, clearly labelled as a demo

[Suggested visual: six feature thumbnails in a grid]

### Evaluation Criteria Mapping
- **Innovation:** the first Indian heat tool that closes the loop — monitor → explain → decide → act — with a budget optimiser that explains itself and honesty enforced in code
- **Technical:** live multi-source data fusion, self-refreshing pipeline, grounded AI, verified with automated browser tests
- **Usability:** two audiences, 11 languages, low-end-phone mode, plain-language guidance
- **Presentation:** every claim on these slides can be clicked and checked on the live site

[Suggested visual: four quadrant cards]

### Impact
- **Citizens:** know today's risk, safe hours, and how to protect neighbours
- **Officials:** a Heat Action Plan that activates itself when a city crosses High risk
- **Planners:** compare cities and target cooling budgets where they cool the most
- **Everyone:** transparent data, auditable in public

[Suggested visual: impact icons with one line each]

### Feasibility
- Already built and deployed; ₹0 per month on free tiers
- 70+ days of real daily data archived; the pipeline runs unattended
- Known risks — API limits, data gaps, model limits — each has a working answer
- Next: NASA MODIS 2016–2026 history, ISRO INSAT-3D, Indian retraining of the model

[Suggested visual: roadmap timeline — done / in progress / next]

### Closing
**BhaskarOps: live heat intelligence for India — honest by design, useful to a citizen and a collector alike.**

Live now: heatops.vercel.app

[Suggested visual: closing slide with the URL and a QR code]

---

---

## 3. Where we stand — IMD, BHRIGU, equity

*Updated 4 September 2026 to match the live product at https://heatops.vercel.app. Every claim below is true of the deployed app today; roadmap items are marked as such.*

### 1. Old tradition — IMD only (without BhaskarOps)

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

### 2. New tradition — with BhaskarOps

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

### 3. Comparable existing platform — BHRIGU (CSTEP)

BHRIGU (National Heat Insights Explorer, built by CSTEP) is the closest government-backed equivalent — an honest comparison, not a dismissal.

| Aspect | BHRIGU (CSTEP) | BhaskarOps |
|---|---|---|
| Data resolution | 1 km grid, national scale, 5,000+ urban areas | 1,932 cities with live readings; district boundaries; ESA 10 m land cover for 171 cities |
| Data freshness | Historical archive, 2002–2025 | Live — refreshed every few hours; states re-sampled live every 10 minutes in the browser |
| Historical depth | 23 years | 70+ days of daily snapshots (growing nightly) + NASA MODIS satellite surface temperature since March 2026 for 1,912 cities (in the app); 2016–2026 for 171 cities in the app |
| Primary focus | Heat-exposure evidence base for research and policy | Day-to-day operational decisions and public communication |
| Intervention simulation | Not a core feature | Illustrative cooling model + cost estimates + canopy-target recommendation |
| Conversational AI | Not offered | AGNI, grounded and honest |
| Language access | Not specified | 11 Indian languages |
| Best used for | Long-term research, policy evidence, national trends | What to do today, and roughly what it costs |

> "BHRIGU gives cities a strong historical evidence base — a genuinely valuable foundation. BhaskarOps complements it with a live, actionable layer: where BHRIGU shows where heat exposure exists, BhaskarOps shows what to do about it today."

### 4. Equity lens — who is served, and how well

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

### 5. BHRIGU vs. BhaskarOps — advantage / disadvantage

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

---

## 4. Questions judges ask

### Questions judges ask, and the answers

**"Is the cooling projection real?"** — "No, and it says so. The cooling coefficients are an illustrative model, labelled on every screen. The inputs are real: live temperature, satellite surface temperature, land cover, building density. The projection is what those inputs put through a stated model give. We would rather show a labelled estimate than a fake measurement."

**"Where does the ₹2,500 per roof come from?"** — "The Cool Roof calculator's basic lime-wash tier, ₹0.5 to ₹2 per square foot from the Ahmedabad 2017 pilot, at the midpoint on a 1,000 sq ft roof, plus ₹1,250 for labour and awareness. It is printed in the assumptions table."

**"Why no population?"** — "We do not have a verified per-city population table. Built-up share stands in for exposure, and the panel says population is not modelled. Give us the Census table and it goes in the same afternoon."

**"How is this different from BHRIGU?"** — "BHRIGU is a 23-year research archive at 1 km — excellent evidence. BhaskarOps is live, operational, and ends in a plan. We complement it; we do not replace it."

**"What keeps it fresh?"** — "A GitHub Actions job rebuilds the 1,932-city cache every hour by day and every three hours at night, retrying connection failures; the browser re-samples every state live and reloads the cache every fifteen minutes. The last run carried zero cities forward."

**"Where is ISRO data?"** — "Requested from MOSDAC for INSAT-3D; not yet granted. NASA MODIS is in because it arrived first. The pipeline that ingests one will ingest the other."

**"Why did Telangana appear only yesterday?"** — "The boundary data predated the 2014 bifurcation. We rebuilt both states from their districts and it is now correct."

---

### If something breaks during the demo

- **Network dead:** open the screenshots folder and narrate the same script over them.
- **AGNI rate-limited:** "free-tier quota — here is the answer from an hour ago" and show the screenshot; move on.
- **A city has no live reading:** point at NO LIVE DATA and say "that is the honesty rule working".
- **Planner shows a message instead of a plan:** read the message aloud — it is one of the designed edge cases (budget below minimum, target beyond the model's ceiling).


---
