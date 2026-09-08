# BhaskarOps — SIH Idea Submission (6-slide template)

Content mapped to the SIH idea-submission template, slide by slide. Points only, no
paragraphs, sized to fit the template boxes. Replace the [bracketed] fields on slide 1.
Everything below is true of the live prototype at https://heatops.vercel.app as of 1 Sept 2026.

---

## Slide 1 — Title slide (Template 1)

- **Problem Statement ID:** [enter]
- **Problem Statement Title:** [enter]
- **Theme:** [Climate / Environment / Disaster Management — pick the one on the portal]
- **PS Category:** Software
- **Team ID:** [enter]
- **Team Name:** [enter]
- **Idea title:** **BhaskarOps** — India's Urban Heat Island monitoring & intervention platform, with **AGNI**, an AI heat analyst grounded in real data

---

## Slide 2 — Idea title / Proposed solution (Template 2)

**Detailed explanation of the proposed solution**
- Interactive India map, colour-coded by live heat severity, drill-down to 594 districts
- 1,956 cities across all 28 states and 8 UTs; 1,932 with live readings (the rest say "NO LIVE DATA", never a guess)
- City dashboard: Overview (live weather/AQI) · Analysis (satellite indices, land cover, ML) · Compare (radar vs 4 cities) · Interventions (cooling sliders → projected °C) · AGNI + Export
- Two audiences, one product: **Citizen view** (plain-language risk badge, safe hours today, WhatsApp share, how to help the neighbourhood) and **Authority view** (full dashboard + Heatwave Action Checklist)
- **Compare tab serves both:** officials rank cities by live heat, air and canopy to decide where cooling money goes first; citizens see "is my city hotter than my parents' city?" and share it — one chart, allocation for one audience, awareness for the other
- 11 Indian languages; Mobile / Laptop layouts

**How it addresses the problem**
- The data already exists (satellite land cover, weather, AQI) but sits in silos — BhaskarOps fuses it into one tool anyone can open
- Closes the loop: **monitor → compare → simulate intervention → communicate** (AGNI explains, Export shares)
- Reaches the people who act: residents, ward officers, planners, non-technical decision-makers

**Innovation and uniqueness**
- **Radical honesty in code:** every number is traceable to a named source; gaps say "NO LIVE DATA", stale values are flagged "carried forward", AI figures without live data are tagged "(estimated)"
- **AGNI, India-only by design:** answers rankings from a real 1,932-city cache, refuses global claims, remembers the conversation, replies in 11 languages
- **Intervention simulator + Recommended plan + Cool Roof ROI**, not just a viewer — each city's tree canopy (ESA WorldCover) vs the 30 % target of the 3-30-300 urban-forestry rule, one click to apply
- **Self-refreshing:** every 3 hours the platform re-fetches all cities, commits the data to GitHub and redeploys itself; 65+ days of daily history kept

---

## Slide 3 — Technical approach (Template 3)

**Technologies used**
- **Frontend:** React 18 + Vite · react-simple-maps (GeoJSON: 35 state/UT boundaries, 594 districts, chunked render) · Recharts · Three.js globe · i18next (11 languages)
- **Backend:** Node.js serverless functions on Vercel — Gemini proxy (key never reaches the browser), cron refresh; **GitHub Actions** job every 3 h; GitHub Git Data API commits data back to the repo
- **AI:** Google Gemini via AGNI persona; 5-model fallback chain; system prompt enforces grounding, India-only scope, "(estimated)" tagging
- **Data / ML:** Open-Meteo (live weather, AQI, geocoding) · ESA WorldCover 10 m (land cover incl. tree canopy) · NASA MODIS MOD11A1 satellite land-surface temperature via Earthdata/AppEEARS (in the app: 1,912 cities, daily since 1 March 2026; 2016–2026 series processing) · OpenStreetMap Overpass + Nominatim (building density, validated coordinates) · scikit-learn RandomForest trained offline on a published MODIS dataset (20 cities, 2000–2018)
- **Hosting/CI:** Vercel (static + serverless + cron) · GitHub (version control, data commits, Actions)
- No hardware required

**Methodology / process (flow)**

```
DATA PIPELINE (runs itself)
Open-Meteo ──► refresh job (every 3 h, paced) ──► live-weather-cache.json
                                                 + daily history snapshot
              ──► commit to GitHub (Git Data API) ──► Vercel auto-redeploy ──► browser

USER FLOW
Sign in ──► "Who are you?" (Citizen / Authority) ──► India map (each state coloured by the category most of its cities are in,
weather badges) ──► click state (its cities refreshed live in one call) ──► click city
──► Overview · Analysis · Compare · Interventions ──► ask AGNI (grounded on the same data)
──► Share / Export / Heatwave Action Checklist
```

- **Working prototype:** live at heatops.vercel.app (all features above are deployed and verified with automated browser tests)

---

## Slide 4 — Feasibility and viability (Template 4)

**Feasibility**
- Already built and deployed; zero-cost stack (free tiers of Open-Meteo, ESA, OSM, Gemini, Vercel, GitHub) — ₹0/month today
- 65+ days of real daily data already archived; pipeline runs unattended
- Scales by configuration: adding a city = one line + automatic geocoding with state validation

**Potential challenges and risks**
- Third-party rate limits (Open-Meteo weighted quota; Gemini free tier ≈ 20 requests/day per model)
- Data gaps: 24 hamlet/colony names unresolvable; time-of-day bias if snapshots are taken at dawn
- ML model trained on non-Indian megacities (validation R² 0.95, unseen-city R² −0.39)
- Slow networks / low-end phones: ~4 MB first load (map GeoJSON + app)
- Dependence on free external APIs for a public-service tool

**Strategies to overcome them**
- Paced 3-hourly refresh + cron fallback + retry pass; failures leave old values *flagged*, never blank
- 5-model Gemini chain; paid key for production; India-only ranking answers computed from our own cache
- Validated geocoding (Open-Meteo → OSM Nominatim → spelling aliases); honest "NO LIVE DATA"; peak-hour (14:30 IST) snapshots
- Both R² scores disclosed on screen; roadmap: retrain on ISRO INSAT-3D LST via MOSDAC
- Chunked map rendering, cached fallbacks, error boundaries; Lite mode for low-end phones (no 3D globe, states-only map); scale path: Postgres history mirror (already coded, paused)

---

## Slide 5 — Impact and benefits (Template 5)

**Potential impact on the target audience**
- **Citizens:** know today's risk in their own language, the safe hours to go out, and how to protect neighbours — shareable on WhatsApp in one tap; compare their city with family's or a travel destination
- **Municipal officials / planners:** a severity-adaptive Heat Action Plan checklist (activation at High risk, preparedness at Moderate, a cold-weather list below 10 °C); compare cities on live heat, air quality and canopy to prioritise budgets and justify activations; simulate green cover / cool roofs / water bodies before spending; download history as evidence
- **Decision-makers:** ask AGNI "why is this city hot?" and get an answer grounded in the same numbers the map shows

**Benefits**
- **Social:** heat-health awareness for vulnerable groups (elderly, outdoor workers); 11 languages; citizen and authority on one shared picture
- **Economic:** target cooling budgets where projected °C reduction is highest; Cool Roof ROI calculator (Ahmedabad/Telangana pilot coefficients); lower cooling-energy demand
- **Environmental:** promotes green cover, reflective roofs and water bodies; tracks air quality alongside heat
- **Governance:** transparent, auditable data (every daily snapshot is in git); an operational aid for Heat Action Plans across all 28 states and 8 UTs, not one metro

---

## Slide 6 — Research and references (Template 6)

- **Open-Meteo** — live weather, air quality (CAMS), geocoding: https://open-meteo.com/en/docs
- **NASA MODIS MOD11A1 v6.1** — Terra land-surface temperature, daily 1 km (LP DAAC), retrieved via AppEEARS: https://lpdaac.usgs.gov/products/mod11a1v061/ · https://appeears.earthdatacloud.nasa.gov
- **ESA WorldCover 10 m (2021)** — satellite land-cover classification: https://esa-worldcover.org/en
- **OpenStreetMap** — Overpass API (building density): https://wiki.openstreetmap.org/wiki/Overpass_API · Nominatim (geocoding): https://nominatim.org
- **MODIS land-surface-temperature dataset** — "Time-series dataset on land surface temperature, vegetation, built up areas and other climatic factors in top 20 global cities (2000–2018)", *Data in Brief*, Elsevier: https://doi.org/10.1016/j.dib.2019.103803
- **3-30-300 rule** — Konijnendijk, C. C. (2023). Evidence-based guidelines for greener, healthier, more resilient neighbourhoods: introducing the 3-30-300 rule. *Journal of Forestry Research* 34(3): https://doi.org/10.1007/s11676-022-01523-z · canopy-deficit audit: *Nature Communications* (2024) https://doi.org/10.1038/s41467-024-53402-2
- **URDPFI Guidelines 2014** (MoHUA) — 10–12 m² open space per person: https://mohua.gov.in/upload/uploadfiles/files/URDPFI%20Guidelines%20Vol%20I(2).pdf
- **NDMA** — Guidelines for preparation of Action Plan: Prevention and Management of Heat Wave: https://ndma.gov.in/Natural-Hazards/Heat-Wave
- **Ahmedabad Heat Action Plan** (AMC / NRDC / IIPH-G) — basis of the Heatwave Action Checklist
- **Telangana Cool Roof Policy 2023–28** (MA&UD, Govt. of Telangana) — cool-roof cost/benefit coefficients
- **India Meteorological Department** — heatwave criteria: https://mausam.imd.gov.in
- **ISRO MOSDAC / INSAT-3D** — planned LST source: https://www.mosdac.gov.in
- **Live prototype:** https://heatops.vercel.app · **Source:** https://github.com/kkrrishagarwal/heatops
