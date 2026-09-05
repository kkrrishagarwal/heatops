# BhaskarOps — Pitch Content (PPT-AI ready)

One idea per section. Each "##" is one slide. Facts match the live product at heatops.vercel.app (September 2026).

---

## Title
**BhaskarOps** — India's live urban-heat platform, with **AGNI**, an AI analyst grounded in real data.

Live monitoring for 1,932 Indian cities. Plain-language guidance for citizens. Action playbooks for officials.

[Suggested visual: full-bleed screenshot of the India heat map with the BhaskarOps wordmark]

---

## The Problem in One Line
Indian cities are getting hotter, the data to act already exists — but it sits in silos nobody can use in time.

Citizens don't know *why* their city is hot. Officials have no live, city-level picture. Most tools are English-only or show fake numbers.

[Suggested visual: three-icon row — citizen, official, siloed databases]

---

## Our USP in One Line
**"A heat dashboard you can show a judge, a planner, or a non-English-speaking citizen — and every number survives the question 'where's that from?'"**

[Suggested visual: single bold statement slide]

---

## What BhaskarOps Does
- Live heat map of India, coloured by real city temperatures
- 1,956 cities across all 36 states/UTs; 1,932 with live readings
- City dashboards: weather, satellite indices, comparisons, interventions
- Citizen view and Authority view — two audiences, one product
- AGNI: ask questions in plain language, in 11 Indian languages

[Suggested visual: dashboard screenshot with the five tabs highlighted]

---

## The Heat-Intelligence Pipeline
STEP 1: Detect → Live temperature and air quality for every city, refreshed every few hours
STEP 2: Predict → Risk level for each city, from the same rules used everywhere in the app
STEP 3: Analyze → Why it's hot: built-up share, vegetation, tree canopy from satellite land cover
STEP 4: Compare → Rank cities and states; benchmark one city against four others
STEP 5: Recommend → Cooling plan per city: canopy target, cool roofs, projected effect and cost
STEP 6: Act → Citizens get safe hours and help cards; officials get a Heat Action Plan checklist

[Suggested visual: six-step horizontal flowchart]

---

## Two Audiences, One Product
**Citizen view** — temperature, a plain risk badge, safe hours today, a WhatsApp share button, how to help neighbours.

**Authority view** — full dashboard, satellite indices, comparisons, interventions, a severity-adaptive Heat Action Plan checklist.

Chosen once at sign-in. Switchable any time.

[Suggested visual: side-by-side phone screenshots — Citizen vs Authority]

---

## Citizen Journey
STEP 1: Sign in → Choose "Citizen"
STEP 2: Map → See India coloured by live heat; tap your state
STEP 3: City → See temperature, risk level, air quality in plain language
STEP 4: What to do → Safe hours today and a neighbourhood help list, matched to the weather
STEP 5: Share → One tap sends the summary to family on WhatsApp
STEP 6: Ask AGNI → "Is it safe to go out today?" answered from real data

[Suggested visual: vertical journey flow with phone mockups]

---

## Authority Journey
STEP 1: Sign in → Choose "Government / Planner"
STEP 2: Map → States coloured by the live median of their cities; weather badges
STEP 3: State → All its cities refreshed live; open the hottest
STEP 4: Analyse → Satellite indices, land cover, model insights
STEP 5: Plan → Compare cities; simulate cool roofs, green cover, water bodies
STEP 6: Act → Tick the Heat Action Plan checklist; export the report

[Suggested visual: vertical journey flow with laptop mockups]

---

## Compare — One Chart, Two Jobs
- Radar of live temperature, air quality, wind and land cover for up to five cities
- **Officials:** rank cities to decide where cooling budgets go first; justify activations
- **Citizens:** "Is my city hotter than my parents' city?" — and share the answer on WhatsApp
- Same data, different decisions

[Suggested visual: radar chart comparing four cities, with two caption boxes — Official / Citizen]

---

## The Heat Action Plan Checklist Adapts to the Weather
- **Extreme / High:** full activation — cooling centres, hospital alert, advisory, tankers, cool-roof priority
- **Moderate:** preparedness — monitor, pre-position advisories, centres ready
- **Low:** routine monitoring, no activation
- **Cold (below 10 °C):** night shelters, cold-exposure advisory, livestock care

Modelled on the Ahmedabad HAP and NDMA guidelines. Ticks saved per city.

[Suggested visual: four-column tier table with colour bands red / amber / grey / blue]

---

## Recommended Plan for Every City
- Tree canopy today (ESA WorldCover satellite data)
- Target: 30 % canopy — the "30" of the 3-30-300 urban-forestry rule
- Gap to close, cool-roof share for the built-up area, projected cooling
- One click applies the plan to the intervention sliders

[Suggested visual: metric-card row — canopy now / target / to add / projected cooling]

---

## Data Refresh Cycle — the Site Keeps Itself Fresh
STEP 1: Fetch → Open-Meteo readings for all 1,932 cities, in paced batches
STEP 2: Flag → Any city that could not be refreshed is marked "carried forward", never shown as fresh
STEP 3: Snapshot → Today's readings saved as a daily history file
STEP 4: Commit → Cache and history pushed to GitHub automatically
STEP 5: Redeploy → Vercel rebuilds the site with the new data
STEP 6: Live sample → In the browser, every state re-sampled every 10 minutes

[Suggested visual: circular pipeline diagram]

---

## Live Data Fallback — Never a Blank Screen
STEP 1: Live API → Ask Open-Meteo for the selected city right now
STEP 2: Cached reading → If live fails, show the last reading, labelled "cached from X ago"
STEP 3: Honest gap → If nothing exists, show "NO LIVE DATA" — never an invented number

[Suggested visual: three-step decision flow with green / amber / grey outcomes]

---

## AGNI — the AI Analyst
STEP 1: Question → User asks in any of 11 languages
STEP 2: Ground → Real data for the selected city, any named cities, and an India-wide ranking is attached
STEP 3: Answer → Gemini replies through a secure proxy; the API key never reaches the browser
STEP 4: Label → Anything not measured is tagged "(estimated)"; global claims are refused

Five AI models in a fallback chain — the analyst stays up when one runs out of quota.

[Suggested visual: chat mockup — "Which Indian city has the cleanest air right now?"]

---

## Radical Honesty, Enforced in Code
- Every number is traceable to a named source
- Cities without a reading say "NO LIVE DATA" — nothing is estimated
- Stale readings are flagged "carried forward" with their real time
- Illustrative values (intervention model, baseline indices) are labelled as such
- The ML model shows its weak score next to its good one

[Suggested visual: screenshot collage of the honesty labels]

---

## Honest Model Disclosure
**Our model scores R² 0.95 on known cities and −0.39 on cities it has never seen — we print both, because a judge who checks would find the second one anyway.**

Trained on a published MODIS dataset of 20 global cities. Roadmap: retrain on Indian data.

[Suggested visual: two big numbers side by side, 0.95 and −0.39]

---

## Data Sources
- **Open-Meteo** — live weather, air quality, geocoding
- **ESA WorldCover 10 m** — vegetation, built-up, tree canopy
- **NASA MODIS (MOD11A1)** — satellite surface temperature, 2016–2026 (integration in progress)
- **OpenStreetMap** — building density, validated coordinates
- **ISRO INSAT-3D** — requested via MOSDAC as the next layer

[Suggested visual: logo row of data providers with a "free & open" badge]

---

## Technology Stack
- **Frontend:** React 18, Vite, react-simple-maps, Recharts, i18next (11 languages)
- **Backend:** Node.js serverless functions on Vercel; GitHub Actions for data refresh
- **AI:** Google Gemini via the AGNI proxy, 5-model fallback chain
- **Data:** Open-Meteo, ESA WorldCover, NASA MODIS, OpenStreetMap; scikit-learn model trained offline

Running cost today: ₹0 per month. No hardware.

[Suggested visual: four-row tagged stack diagram]

---

## Architecture at a Glance
STEP 1: Browser → React app loads the map, cache and satellite data files
STEP 2: Live calls → Open-Meteo for the selected city and state samples
STEP 3: AGNI → Questions go to a serverless proxy, then to Gemini
STEP 4: Refresh job → Fetches all cities, commits to GitHub, triggers redeploy
STEP 5: History → Daily snapshots served by an API, a viewer page and CSV export

[Suggested visual: boxed architecture diagram with arrows]

---

## Built for Low-End Phones Too
- Mobile and laptop layouts; works at 375 px wide
- Lite mode: no 3D, lighter map, no animations — same data
- 11 Indian languages, including Hindi, Bengali, Tamil, Telugu, Marathi, Urdu

[Suggested visual: budget phone mockup showing the citizen view]

---

## How We Compare
- **IMD alerts:** say how hot and when. **BhaskarOps:** says why, where, and what to do
- **BHRIGU (CSTEP):** a 23-year research archive. **BhaskarOps:** a live, actionable decision tool
- We complement both; we replace neither

[Suggested visual: three-column comparison table]

---

## Key Demo Features
- Live India map with median-based state colours and weather badges
- 30-day temperature trend for any city, from our own daily archive — and "33 °C now, 40 °C expected" from the forecast high
- Citizen view with safe hours and WhatsApp share
- Severity-adaptive Heat Action Plan checklist
- Recommended canopy plan with one-click apply
- AGNI answering a ranking question from real data
- Demo mode: `?demo=Leh:-8,Sri Ganganagar:46` shows the cold protocol and full heat activation in one session, clearly labelled as a demo

[Suggested visual: six feature thumbnails in a grid]

---

## Evaluation Criteria Mapping
- **Innovation:** the first Indian heat tool that closes the loop — monitor → explain → simulate → act — with honesty enforced in code
- **Technical:** live multi-source data fusion, self-refreshing pipeline, grounded AI, verified with automated browser tests
- **Usability:** two audiences, 11 languages, low-end-phone mode, plain-language guidance
- **Presentation:** every claim on these slides can be clicked and checked on the live site

[Suggested visual: four quadrant cards]

---

## Impact
- **Citizens:** know today's risk, safe hours, and how to protect neighbours
- **Officials:** a Heat Action Plan that activates itself when a city crosses High risk
- **Planners:** compare cities and target cooling budgets where they cool the most
- **Everyone:** transparent data, auditable in public

[Suggested visual: impact icons with one line each]

---

## Feasibility
- Already built and deployed; ₹0 per month on free tiers
- 70+ days of real daily data archived; the pipeline runs unattended
- Known risks — API limits, data gaps, model limits — each has a working answer
- Next: NASA MODIS integration, ISRO INSAT-3D, Indian retraining of the model

[Suggested visual: roadmap timeline — done / in progress / next]

---

## Closing
**BhaskarOps: live heat intelligence for India — honest by design, useful to a citizen and a collector alike.**

Live now: heatops.vercel.app

[Suggested visual: closing slide with the URL and a QR code]
