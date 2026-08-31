# BhaskarOps — Presentation Content

## Submission Form Answers

**Brief about your Idea** (1024 char limit, current: ~1002)

BhaskarOps is a real-time Urban Heat Island (UHI) monitoring and intervention-planning dashboard covering 1,956 Indian cities across all 36 states/UTs, built for ISRO BAH 2026, scoped pan-India, not just Delhi NCR. Users land on an interactive India map color-coded by heat severity down to district level, then drill into any city for a 5-tab dashboard: live weather/AQI, satellite-derived heat indices (LST, NDVI, NDBI), side-by-side city comparison, interactive cooling-intervention sliders with projected temperature impact, and AGNI - an AI analyst answering heat questions in plain language across 11 Indian languages using structured templates (heatwave warnings, vulnerability scores, carbon footprint, ROI). Every number traces to a real source (Open-Meteo, ESA WorldCover, OpenStreetMap, a MODIS-trained ML model), with honest "not available" or "(estimated)" labels instead of invented numbers. The live site self-refreshes daily via an automated cron pipeline, never a frozen demo snapshot.

**What problem are you trying to solve?** (2000 char limit, current: ~1945)

Indian cities are experiencing intensifying Urban Heat Islands (UHI) - dense, built-up, low-vegetation zones that run several degrees hotter than surrounding rural areas, worsening heatwaves, energy demand, and health risk for residents. This isn't confined to one metro region: rapid concretization, shrinking green cover, and high population density push temperatures well above safe limits across states during summer, disproportionately affecting outdoor workers, the elderly, and low-income households without reliable cooling access. While BAH 2026 names Delhi NCR as its problem statement, BhaskarOps deliberately covers all 36 states/UTs and their districts, including rural areas, since the same UHI mechanism plays out nationwide.

The deeper problem isn't a lack of data — satellite land-cover data, weather data, and air quality data all already exist — it's that nobody has stitched them into one accessible, actionable tool. Today:
1. Citizens have no simple way to see WHY their city/neighborhood is hot, just that it is.
2. Urban planners and municipal officials have no way to compare cities or simulate which cooling intervention (green cover, reflective roofs, water bodies) would actually work best for their specific city before committing budget.
3. Existing dashboards, where they exist, are usually English-only, excluding non-English-speaking municipal staff and citizens — the people who most need this information to act on it.
4. Most heat-monitoring tools are static viewers: they show the problem but give no path to action, and many existing hackathon-style projects use simulated/placeholder numbers that fall apart under scrutiny.

BhaskarOps solves this by fusing real satellite, weather, and ML-derived data into one platform that closes the full loop — monitor, compare, simulate intervention impact, and get a plain-language explanation — in 11 Indian languages, with every number traceable to a real source.

**Technology Stack being used** (1024 char limit, current: ~980)

Frontend: React 18 + Vite, react-simple-maps (interactive India map with district-level GeoJSON), Recharts (radar/trend charts), Three.js / react-globe.gl (3D login globe), i18next (11-language support).

Backend: Vercel serverless functions (Node.js) — proxy Gemini API calls (key never reaches the browser) and run a scheduled Vercel Cron job that refreshes live weather/AQI data daily and auto-commits it via the GitHub REST API, triggering an auto-redeploy.

AI: Google Gemini (gemini-2.5-flash) powering AGNI, the AI heat analyst persona.

Data/ML: Open-Meteo (live weather, AQI, elevation), ESA WorldCover 10m satellite land-cover data (vegetation/built-up/water fractions), OpenStreetMap Overpass API (building density), scikit-learn RandomForestRegressor trained offline in Python on a published MODIS land-surface-temperature dataset.

Hosting/CI: Vercel (static hosting + serverless functions + Cron), GitHub (version control + automated data commits triggering redeploys).

**Is this your first hackathon? If Yes, then please share your experience.**

Yes, this is my first hackathon. It's been a genuine crash course in building something real under time pressure rather than just a tutorial project — going from "the map looks slow" to actually proving it with a CPU profiler and fixing the real bottleneck, setting up a fully automated daily data-refresh pipeline so the live site never goes stale for judges, and hitting real-world constraints like third-party API rate limits firsthand instead of reading about them. The biggest lesson has been that "it works on my machine" and "it's actually fixed, with evidence" are very different bars, and that distinction matters a lot more once something is live for judges to poke at on their own schedule rather than during a scheduled demo.

---

## What BhaskarOps Is

## All Features (Small → Big)

### Micro / UI & UX
- **Civic-tech dark theme** — dark slate base with a single amber accent and desaturated risk colours (no neon); readable in a government meeting room, not just a demo
- **Heat-reactive theme colour** — the dashboard's accent/glow follows the *selected city's live temperature* in four tiers (≥45 °C red · 35–44 orange · 25–34 yellow · <25 green); the Heat Risk Gauge label uses the same tiers
- **🧑 Citizen / 🏛️ Authority view** — a one-time "Who are you?" screen after sign-in; Citizen = essentials in plain language (city, temperature, risk badge, air-quality category, one tip; Overview · What to do · Compare), Authority = the full technical dashboard; switchable later from the profile menu / ☰ drawer / laptop navbar, or via `?view=citizen`
- **📱 Mobile / 💻 Laptop layout toggle** — independent of the audience choice; auto-picks by screen width on first visit, remembered afterwards
- **Mobile header with ☰ drawer** — stacked rows and a drawer for language / view switches / profile; nothing scrolls sideways at 375 px
- **3D rotating globe login screen** — Three.js / react-globe.gl animated globe before sign-in, sets the tone immediately
- **Animated heat ticker (navbar)** — scrolling live temperature readout across cities in the top bar
- **Quick Picks shortcuts** — one-click pill buttons (Delhi, Mumbai, Bengaluru, Jaipur, Chennai, Kolkata) so users skip search on first open
- **Heat Index color legend** — always-visible panel key mapping 6 heat tiers (Low → Extreme) to colors, plus a white pulsing-dot entry that explains the heatwave-state markers on the map
- **Floating AGNI button** — AI assistant accessible from every tab, not locked behind the AI+Export tab
- **📤 Share with family (WhatsApp)** — one tap in Citizen view opens WhatsApp with the city's temperature, risk level, air quality and safety tip pre-filled
- **Weather-condition map badges** — a single 🌫️ dust / 🌧️ rain / ☁️ heavy-cloud icon at the centre of each state whose readings cross the threshold (PM10 ≥ 400, rain ≥ 60 %, cloud ≥ 80 %); unaffected states stay clean solid heat colour; citizens see only their own city's condition
- **Map fit + sane zoom** — India fills 93 % of the map card; zoom-out stops at "fit" instead of shrinking the map into empty space
- **PDF export** — full city report downloadable as PDF
- **CSV export** — raw data download for planners who need it in a spreadsheet
- **Language switcher** — dropdown in navbar; changes the entire UI instantly without page reload

### City-Level Data Features
- **Live weather card** — Open-Meteo: temperature, feels-like, humidity, wind speed/direction, pressure, UV index, cloud cover; auto-caches with freshness indicator ("Cached — X min ago") and force-refresh button; if Open-Meteo is down it shows the last cached reading *labelled as cached*, never an error page
- **No fabricated numbers, anywhere** — a city without a live reading shows "NO LIVE DATA" (the old "~21.8 °C"-style estimates were removed after being caught 7 °C from reality); carried-forward cache values are flagged, never shown as fresh
- **Air Quality Index (AQI)** — US AQI + PM2.5/PM10/NO₂/O₃ breakdown from Open-Meteo CAMS
- **7-day forecast strip** — daily min/max temp for the coming week
- **Next 12-hour chart** — hourly temperature curve for the current day
- **Year-over-year temperature delta** — compares live LST against the same city's prior-year value ("2.3°C hotter than last year")
- **Historical heatwave event timeline** — past heatwave occurrences for the selected city
- **Heat Risk Gauge** — semicircular arc, needle on the city's live temperature; the readout (label + dot) uses the same four tiers as the theme colour, so the gauge and the page never disagree
- **Safe hours today (Citizen)** — one bar for the day from the hourly feels-like forecast (🔴 avoid ≥ 40 °C · 🟡 only if necessary 35–39 °C · 🟢 safe), a "Right now" status line and the time windows written out
- **How you can help your neighbourhood (Citizen)** — five concrete local actions (check on elderly and vulnerable neighbours, help maintain a public water point or shaded rest spot, spread the word about cool roofs, ask the RWA/ward office about the Heat Action Plan, grow heat-resistant plants at home); on High/Extreme days the elderly-check moves to the top in red
- **Heatwave Action Checklist (Authority)** — five Heat Action Plan steps (cooling centres, hospital alert, public advisory, water tankers, prioritise Cool Roof / green cover) with STANDBY/ACTIVE status from the live risk, tickable with timestamps, saved per city in the browser
- **Satellite indices panel** — Land Surface Temperature (LST), NDVI, NDBI, NDWI displayed with a live-temperature reading from Open-Meteo's SRTM endpoint
- **Land cover breakdown** — real ESA WorldCover 10m data: vegetation %, built-up %, water % for 36 representative cities
- **Building density** — live OpenStreetMap Overpass API query around the city's coordinates
- **ML-based LST prediction** — RandomForestRegressor (scikit-learn) trained offline on a published MODIS dataset; shows both the validation R²=0.95 and the harder unseen-city R²=−0.39, disclosed honestly side-by-side

### App-Wide / Platform Features
- **Interactive India map** — react-simple-maps rendering 36 states + 594 districts from real GeoJSON; geometry projected in small chunks across animation frames (chunked render) so the page never freezes while drawing 630 paths
- **State drill-down** — click any state → map zooms in, city dots appear color-coded by heat severity using the same 6-tier HEAT_INDEX_BUCKETS palette
- **Pulsing heatwave markers** — animated white dot overlays on the 5 currently active extreme-heat states (Delhi, Rajasthan, UP, Gujarat, Bihar); explained in the Heat Index legend
- **National Heat Summary card** — right-panel empty-state shows: hottest city right now, count of states at extreme/high risk, national average temperature — all from the daily-refreshed live cache
- **Compare Cities tab** — debounced search + autocomplete to add up to 4 extra cities; 6-axis radar chart (LST, NDVI, NDBI, AQI, Wind speed, NDWI) with per-city color series; "coolest city" callout
- **Interventions tab** — interactive sliders for cooling measures (green cover %, reflective roof %, water body area) with a projected °C temperature reduction calculated from the ML model; designed for planners, not just viewers
- **AGNI AI Analyst** — Google Gemini (gemini-2.5-flash) behind a Vercel serverless proxy (API key never reaches the browser); 7 structured response templates triggered by question intent: Heatwave Early Warning · Heat Vulnerability Index · UHI Carbon Footprint · Cooling Degree Days · Night UHI Analysis · Intervention ROI Calculator · Multi-City Comparison; every figure without a live source is tagged "(estimated)" rather than passed off as real data; answers in whichever of the 11 UI languages is active
- **11 Indian languages** — English + Hindi · Bengali · Tamil · Telugu · Marathi · Gujarati · Urdu · Kannada · Odia · Punjabi; 278 translation keys covering every label, placeholder, status message, and button across all panels; proper nouns (AGNI, NDVI, MODIS, etc.) intentionally left in their standard form
- **Auto-refresh pipeline (every 3 hours)** — a GitHub Actions job (paced to Open-Meteo's weighted rate limit, no serverless time cap) plus a Vercel Cron fallback at 14:30 IST with a 16:00 IST retry pass, re-fetches live weather/AQI for all 1,932 tracked cities from Open-Meteo in batches, and commits the refreshed `live-weather-cache.json` **plus a compact snapshot of the day** (`public/data/history/YYYY-MM-DD.json`) back to GitHub in one commit via the Git Data API — the push triggers an automatic Vercel redeploy, so the live site is never more than ~24 hours stale with no manual intervention
- **Historic weather data** — every cron run is kept (64+ days of daily snapshots, backfilled from git history), served by `GET /api/weather-history?city=…&state=…&days=30`, browsable at `/history.html` and exportable to CSV; carried-forward days are flagged in the data and drawn hollow in the viewer; optional Postgres mirror (`DATABASE_URL`) — currently paused, the in-repo files are the source of truth
- **Validated city coordinates** — 1,932 of 1,956 cities geocoded with a state check (Open-Meteo, then OSM Nominatim with "City, State, India"): an audit found 202 cities pointing at the wrong place (Tawang in Java, Kutch in Colorado…) and 267 unresolved; all fixed (spelling aliases + OSM fallback) or honestly blank now — 24 hamlet/colony names remain blank
- **Coverage: 1,956 cities across all 36 states/UTs** — pan-India scope including rural areas, not a single-metro demo (1,932 with live readings; the rest say so instead of guessing)
- **AGNI conversation memory + markdown** — the last 10 turns travel with each question ("aur uska AQI?" is understood), other cities/states named in a question get their real cached readings attached, and replies render as proper bold/lists instead of raw asterisks
- **Opened state refreshes live** — clicking a state fetches its cities' current temperatures in one batched call (10-min memory), so the city list, the state average / map colour and the selected city always agree; fresh rows show a green dot
- **Graceful degradation** — error boundaries around the map and every panel ("Something went wrong — Try again"), 10-second timeouts on every fetch, cached fallbacks labelled as such

---

## Why "BhaskarOps" and "AGNI"? — The Naming Rationale
Names were chosen deliberately, not decoratively — each one encodes both what the platform does and why it's rooted in India.

**BhaskarOps**
- **Bhaskar (भास्कर)** is the Sanskrit/Hindi word for the **Sun** — the literal source of the heat the entire platform exists to measure, model, and mitigate. Naming a heat-monitoring system after the Sun isn't a stylistic flourish; it names the actual physical cause at the center of the problem statement.
- It's also a working backronym for what the platform technically *is*:
  **B**harat **H**eat **A**nalysis, **S**urveillance, **K**nowledge **&** **A**ssessment **R**esource
- **OPS — Optimization & Planning System** — deliberately *not* just "Dashboard" or "Monitor." The Interventions tab's cooling-impact sliders and the AI's ROI/heatwave-warning templates exist precisely so this is something a city planner can act on, not only observe. "Ops" signals the tool is built for operational decisions, not passive viewing.
- Together: **Bhaskar(Sun) + Ops(Operations)** = an operational response system built around the Sun's heat impact on India ("Bharat") — name and function are the same statement.

**AGNI**
- **Agni (अग्नि)** is the Sanskrit/Hindi word for **Fire** — thematically the natural counterpart to Bhaskar (Sun): Bhaskar names the heat's *source*, Agni names its *intensity and danger*, which is exactly what the AI analyst is built to interpret (heatwave risk, vulnerability scoring, night-heat danger). Agni is also a name many Indian users already recognize from India's own missile program, lending the persona a sense of precision and credibility before it says a word.
- Its backronym matches its actual job: **A**nalytical **G**round-level heat i**N**telligence **I**nterface — i.e. an analytical layer that interprets ground-level (not just satellite-altitude) heat readings and surfaces them as intelligence a human can act on.
- The pairing (Bhaskar = the Sun that causes the heat, Agni = the fire/AI that reads and explains the heat) gives the platform a coherent, culturally-grounded identity rather than two unrelated invented names — fitting for a project built specifically for Bharat ("BAH" = Bharatiya Antariksh Hackathon) rather than a generic global tool with an India skin.

## The Problem
Indian cities are experiencing intensifying urban heat islands — built-up, low-vegetation zones running several degrees hotter than surrounding areas — but city planners and citizens have no single, accessible tool that combines live conditions, satellite-derived land cover, and a model for predicting heat severity, in a way that's usable beyond English-speaking technical staff.

## How It Works, Step by Step
1. User signs in → a one-time **"Who are you?"** screen (🧑 Citizen / 🏛️ Government-Planner / Skip) → lands on an interactive map of India, with a "Today's National Heat Summary" card (hottest city right now, states in extreme/high risk, national average temp) and a **Quick Picks** row (Delhi, Mumbai, Bengaluru, Jaipur, Chennai, Kolkata) for one-click access to major cities without searching
2. Clicks a state (or a Quick Pick) → map zooms to show that state's cities, color-coded by average heat severity, with real district boundaries (not a simplified outline)
3. Clicks a city → opens a 5-tab dashboard scoped to that city
4. **Overview tab**: live temperature/humidity/wind/AQI (refreshed from Open-Meteo), a year-over-year delta ("2.3°C hotter than last year"), and a timeline of past heatwave events for that city
5. **Analysis tab**: real surface temperature reading, vegetation/built-up/water cover percentages (from satellite land-cover classification), and live building density around the city center
6. **Compare tab**: search and stack up to 4 other cities against the current one on a 6-axis radar chart (heat, vegetation, built-up density, air quality, wind, water cover)
7. **Interventions tab**: drag sliders for cooling measures (more green cover, reflective roofs, etc.) and see a projected temperature impact
8. **AI + Export tab** (and the floating AI icon, available everywhere): ask **AGNI** — BhaskarOps' AI analyst persona — plain-language questions about the selected city's heat situation; AGNI answers using structured templates (heatwave warning, vulnerability index, carbon footprint, etc.) grounded in real live data, clearly labeling any figure it doesn't have live data for as "(estimated)" rather than presenting it as fact; export findings as PDF, CSV, or a WhatsApp-shareable summary
9. Entire UI works in 11 languages, so it's usable by non-English-speaking municipal staff, not just English-speaking analysts
10. **Citizen view** trims all of the above to the essentials — temperature, a plain-language risk badge, air-quality category, one tip, *Safe hours today*, a WhatsApp share button and a "how you can help your neighbourhood" card — while **Authority view** adds a tickable Heatwave Action Checklist for the district team

## Core Features (by tab)
- **Interactive India Map** — click any state → drill into its cities, color-coded by heat severity, with district-level detail (real GeoJSON boundaries: 594 districts + 35 states, rendered incrementally so the map never freezes the page while it draws in)
- **Today's National Heat Summary + Quick Picks** — empty-state right panel shows live national stats (hottest city, states at extreme/high risk, national average temp) plus one-click pill shortcuts to 6 major cities, skipping search entirely
- **Overview tab** — live weather, AQI, year-over-year temperature comparison, historical heatwave timeline for the selected city
- **Analysis tab** — satellite indices (surface temp, vegetation/built-up/water fractions), urban morphology (real building density), ML-based LST prediction
- **Compare tab** — search-and-add up to 4 cities for side-by-side radar-chart comparison across LST, NDVI, NDBI, AQI, wind, NDWI
- **Interventions tab** — interactive sliders simulating cooling interventions and their projected impact
- **AI + Export tab** — AGNI (AI Analyst) chat + report/CSV/WhatsApp export
- **Floating AGNI Assistant** — accessible from any screen, not just one tab
- **Citizen view (Overview · What to do · Compare)** — the same live data in plain language, plus Safe hours, Share with family, the neighbourhood help card and the city-comparison radar
- **Authority extras** — Heatwave Action Checklist (HAP steps), weather-condition badges for every affected state on the map, exports
- **Historic data** — `/history.html` viewer + CSV export of every day's readings since 22 June 2026

## Data Sources (credibility slide)
Every number shown is traceable to a real source, with honest "not available" fallbacks rather than fabricated placeholders:
- **Open-Meteo** — live surface temperature, elevation (SRTM), air quality (CAMS); the daily bulk cache of all 1,932 cities is committed to the repo so every reading is auditable in git history
- **Open-Meteo geocoding + OSM Nominatim** — city coordinates, each validated to lie in its own state (wrong-place hits rejected, unresolved cities left blank rather than guessed)
- **ESA WorldCover 10m (2021)** — real satellite land-cover classification (vegetation/built-up/water %) for 36 representative cities
- **OpenStreetMap (Overpass API)** — live building density/urban morphology
- **Machine Learning** — RandomForestRegressor (scikit-learn, n=100 trees) trained on a real, published MODIS dataset (20 global megacities, 2000–2018, Data in Brief/Elsevier) predicting land surface temperature from NDVI/NDBI/elevation — R²=0.95 on standard validation, with an honestly-disclosed weaker R²=-0.39 on a stricter unseen-city holdout test

## AI Capabilities — AGNI (Analytical Ground-level heat iNtelligence Interface)
- **Google Gemini (gemini-2.5-flash)** integration, branded as **AGNI**, BhaskarOps' AI heat analyst — ask plain-language questions about any city's heat/climate ("Why is Jaipur so hot right now?", "Best 3 cooling interventions for this city?")
- **7 structured response templates** AGNI recognizes by question intent:
  1. Heatwave Early Warning (7-day risk forecast, probability tier, recommended actions)
  2. Heat Vulnerability Index (LST/AQI/built-up/population components → 0-100 risk score)
  3. UHI Carbon Footprint (extra cooling demand, CO₂ equivalent, trees-to-offset)
  4. Cooling Degree Days (year-over-year energy-demand trend)
  5. Night UHI Analysis (day vs. night surface temp, why nighttime heat is more dangerous)
  6. Intervention ROI Calculator (investment vs. energy/healthcare/productivity returns, payback period)
  7. Multi-City Comparison (up to 5 cities side by side)
- **Honesty by design**: AGNI only has real live data for City, Surface Temp (LST), Vegetation Fraction (NDVI), Built-up Fraction (NDBI), and AQI. Every other figure these templates ask for (population, CO₂/energy costs, historical CDD, night LST, ROI costs) is explicitly tagged "(estimated)" in the response rather than presented as a live reading — the same "real data with honest gaps disclosed" principle the rest of the platform follows (see Data Sources above), now applied to the AI layer too.
- Supports all 11 platform languages — ask AGNI a question in Hindi, Tamil, Bengali, etc. and it replies in that language.
- Backend proxy architecture — Gemini API key never exposed to the browser.

## Other Notable Details
- **11 languages** supported (English + Hindi, Bengali, Tamil, Telugu, Marathi, Gujarati, Urdu, Kannada, Odia, Punjabi)
- **3D rotating globe** login screen (Three.js)
- Export options: PDF report, CSV download, WhatsApp share
- Fully responsive, dark-themed "mission control" aesthetic
- **Self-refreshing live data, judging-day-ready**: a GitHub Actions job runs every 3 hours (with a daily Vercel Cron fallback), re-fetching live weather/AQI for all 1,932 tracked cities from Open-Meteo and committing the refreshed snapshot back to the repo (triggering an automatic redeploy) — so the National Heat Summary, hottest-cities leaderboard and navbar ticker are never more than ~24 h stale even with nobody touching the deployment; every run is also kept as a daily history file, so the archive grows on its own
- **Radical honesty, enforced in code**: carried-forward readings are flagged with their real observation time; cities without a reading say "NO LIVE DATA"; the ML model's weak unseen-city score is shown next to the good one; AGNI tags every non-live figure "(estimated)"
- **Two independent switches**: audience (Citizen / Authority) × layout (Mobile / Laptop) — any combination works, both remembered per browser
- **Profiled and fixed a real cursor-lag bug**, not a guess: a CDP CPU profile (sign-in → map screen → 15s of cursor movement) showed react-simple-maps' own path-projection math — not any app feature — consuming 37.7% of all CPU time in one ~45-second synchronous block right after the map mounted (594 districts + 35 states being projected to SVG paths all at once). Fixed by rendering that geometry in small chunks across animation frames instead of one block; confirmed via before/after profiling that the cursor-movement phase of the same test dropped from 69.5s to 15.9s.

## Tech Stack
React 18 + Vite · Recharts · react-simple-maps · Three.js/react-globe.gl · i18next · Vercel serverless functions (Node.js) · scikit-learn (Python, offline-trained model)

---

## How is it different from other existing ideas?

Most UHI/climate dashboards built for hackathons (and a fair number of real government tools) fall into one of two traps:
- **Pure visualization, no real data** — pretty maps with simulated/random numbers behind them, which fall apart the moment someone asks "where does this number come from"
- **Real data, but a dead-end viewer** — shows you the problem (it's hot here) but gives no path to action (what do I do about it)

BhaskarOps is built to avoid both:
- **Every number is traceable to a named, real source** (Open-Meteo, ESA WorldCover, OSM, a published MODIS dataset) — and where real data genuinely isn't available for a given city, it says "not available" instead of inventing a plausible-looking number.
- **The AI layer carries the same honesty principle**: AGNI tags every figure it can't ground in real live data as "(estimated)" instead of presenting an invented number as a live reading — credibility isn't just a data-sourcing slide, it's enforced in the AI's own responses.
- **It closes the loop**: monitoring (Overview/Analysis) → comparison (Compare) → action (Interventions, with quantified projected impact) → communication (AGNI explains it in plain language, Export shares it with stakeholders).
- **Honest ML reporting**: the prediction model's accuracy is shown two ways — a flattering same-city metric (R²=0.95) and a much harder unseen-city metric (R²=-0.39). Disclosing both signals the model's real limitations rather than hiding them.
- **Built for India's actual linguistic diversity** (11 languages), not just English.
- **Stays fresh without anyone babysitting it**: a GitHub Actions job re-fetches live data for all 1,932 cities every 3 hours and auto-redeploys — so a judge checking the live site weeks after submission still sees data that's at most ~24h old, not a frozen demo snapshot.

## How will it solve the problem?

It gives three different users a reason to actually use it:
- **Citizens** get an accessible (multi-language), real-data view of how hot their city is and why — a dedicated Citizen view with a plain-language risk badge, *Safe hours today*, a WhatsApp share button and concrete ways to help their neighbourhood, plus one-click Quick Picks to major cities — building public awareness and pressure for local action.
- **Urban planners/municipal officials** get the Authority view — the Heatwave Action Checklist for the day a city crosses High risk, the weather overlays, historic data for trend evidence — and the Compare and Interventions tabs — a way to benchmark their city against others and simulate which intervention (green cover vs. reflective roofing vs. water bodies) gives the best cooling return before committing budget to it.
- **Decision-makers without technical backgrounds** get AGNI — they can ask "why is this city hot" in plain language and get an answer grounded in the real underlying data, or request a structured heatwave warning, vulnerability score, or ROI breakdown without needing to interpret raw numbers themselves.

## USP of the Proposed Solution

"A heat dashboard you can show a judge, a planner, or a non-English-speaking citizen — and every number survives the question 'where's that from?'"

Concretely: (1) genuine multi-source real-data fusion with honest gaps disclosed rather than papered over, (2) an actionable intervention simulator, not just a viewer, (3) a conversational AI layer grounded in that real data, (4) accessibility across 11 Indian languages, (5) full national coverage — 1,956 cities, all 36 states/UTs, not a single-city demo.

---

## Architecture Diagram

```
+-----------------------------------------------------------------------+
|                          BROWSER (Client)                             |
|  +-------------------------------------------------------------+      |
|  |  React 18 + Vite SPA                                        |      |
|  |  +-----------+ +-----------+ +----------+ +--------------+  |      |
|  |  | India Map | |Dashboard +| | Compare  | |     AGNI     |  |      |
|  |  | (chunked  | |Quick Picks| | (radar   | |  (chat UI,   |  |      |
|  |  |  render)  | |   Tabs    | |  chart)  | | 7 templates) |  |      |
|  |  +-----------+ +-----------+ +----------+ +--------------+  |      |
|  |  i18next (11 languages)  ·  Three.js (login globe)          |      |
|  |  Citizen/Authority x Mobile/Laptop · heat-reactive theme    |      |
|  |  error boundaries · cached fallbacks (labelled)             |      |
|  +-------------------------------------------------------------+      |
+---------------+-------------------------------------+-----------------+
                | direct browser fetch                | POST /api/ask-ai
                v                                      v
  +----------------------------+      +-----------------------------+
  |   EXTERNAL DATA APIs       |      |  VERCEL SERVERLESS FUNCTION |
  |  (called directly, no key  |      |      (api/ask-ai.js)        |
  |   needed client-side)      |      |  - holds GEMINI_API_KEY     |
  |  - Open-Meteo (weather/AQI)|      |    server-side only         |
  |  - Open-Meteo Elevation    |      |  - AGNI persona + grounding |
  |  - OSM Overpass (buildings)|      |    rule live in system      |
  |  - live-weather-cache.json |      |    prompt; proxies to Gemini|
  |    (National Heat Summary, |      |  - never exposes key to     |
  |    Hottest Cities, ticker) |      |    the browser bundle       |
  +--------------+-------------+      +--------------+--------------+
                 ^                                    v
                 | reads daily-      +-----------------------------+
                 | refreshed file    |   Google Gemini API         |
  +-----------------------------+    |   (gemini-2.5-flash)        |
  | GITHUB ACTIONS (every 3 h)     |   +-----------------------------+
  | + VERCEL CRON fallback (14:30) |
  | -> scripts/refreshWeatherCache |
  | -> fetches all 1,932 cities    |
  |    from Open-Meteo (batched)   |
  | -> flags any city it could not |
  |    refresh as carried-forward  |
  | -> commits live-weather-cache. |
  |    json + data/history/DATE.   |
  |    json + index.json in ONE    |
  |    commit (GitHub Git Data API)|
  | -> push triggers Vercel auto-  |
  |    redeploy with fresh data    |
  +--------------------------------+
                 |
                 v
  +--------------------------------+
  | HISTORY (grows every night)    |
  | - public/data/history/*.json   |
  |   one compact file per day     |
  | - GET /api/weather-history     |
  |   ?city=&state=&days=          |
  | - /history.html viewer, CSV    |
  |   export script                |
  | - optional Postgres mirror     |
  |   (DATABASE_URL; paused)       |
  +--------------------------------+

  +---------------------------------------------------------------+
  |              STATIC/PRE-COMPUTED DATA (bundled at build time)  |
  |  - india_states_full.geojson / india_districts_full.geojson    |
  |  - lulc_real.json - ESA WorldCover classification (36 cities)  |
  |    (built offline via scripts/build_lulc_data.py, reading      |
  |     directly from ESA's public AWS S3 bucket)                  |
  |  - ml_model_real.json - RandomForestRegressor predictions       |
  |    (trained offline via scripts/train_lst_model.py on a         |
  |     published MODIS dataset, results baked in at build time)    |
  +---------------------------------------------------------------+
```

## Use-Case Diagram (actors & interactions)

```
                    +-----------------------+
                    |   BhaskarOps Platform    |
   +---------+      |                       |
   | Citizen |------+-> Pick "Citizen" view  |
   +---------+      |   View city heat map  |
                    |   View live weather/AQI|
                    |   See safe hours today  |
                    |   Ask AGNI a question   |
                    |   Share with family     |
                    |     (WhatsApp)          |
                    |   Help the neighbourhood|
                    |                       |
   +----------+     |                       |
   |  Urban   |-----+-> Pick "Authority" view|
   | Planner  |     |   Compare multiple     |
   +----------+     |     cities             |
                    |   Simulate intervention |
                    |     impact              |
                    |   Export PDF report      |
                    |                       |
   +----------+     |                       |
   | Disaster |-----+-> View heatwave        |
   |  Mgmt    |     |     history/timeline   |
   | Official |     |   Tick the Heatwave    |
   +----------+     |     Action Checklist   |
                    |   Monitor AQI / weather |
                    |     overlays            |
                    |   Download weather      |
                    |     history CSV         |
                    +-----------------------+
```

---

## Estimated Implementation Cost

**As built today (hackathon/demo stage): effectively ₹0/month**
- Open-Meteo, OSM Overpass, ESA WorldCover (S3): free, no API key
- Gemini API: free tier
- Vercel hosting: free tier (Hobby plan covers this comfortably)

**If scaled to a real state/national government deployment**, rough monthly estimate (₹85/$1):

| Item | Estimated cost |
|---|---|
| Gemini API (paid tier, moderate traffic) | ₹4,000-25,000/month depending on usage |
| Hosting (Vercel Pro or equivalent cloud) | ₹1,500-12,500/month |
| Domain + SSL | ~₹1,300/year |
| Optional: live Google Earth Engine satellite processing (currently static pre-computed data for 36 cities) | ₹0-42,000+/month depending on GEE commercial licensing and compute |
| Optional: dedicated backend/database (currently localStorage-based demo auth) | ₹1,500-8,500/month |
| **Total realistic range** | **~₹8,000-85,000/month**, scaling with usage |

One-time development cost: N/A — built iteratively as a hackathon prototype, not scoped upfront against a fixed budget.
