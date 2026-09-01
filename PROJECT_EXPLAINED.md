# PROJECT_EXPLAINED.md

> This file is for you to read yourself — a beginner-friendly guide to the entire BhaskarOps codebase.
> **Last updated: 28 August 2026** — Section 8 at the bottom covers everything that changed that day (visual redesign, mobile layout, resilience layer, view-mode toggle, weather fallback, AGNI upgrade, cross-tab sync).
> Jargon has been avoided wherever possible. Every "real data" vs "estimated/static" claim below was confirmed by actually reading the code, not guessed.

---

## 1. QUICK OVERVIEW

**What this app does:** BhaskarOps is an India-wide Urban Heat Island (UHI) monitoring dashboard — it shows live temperature/AQI/weather for 1,956 Indian cities, explains satellite-based heat indices (LST, NDVI, NDBI, NDWI), and simulates the impact of cooling interventions (cool roofs, urban greening, water bodies). It also has an AI chat assistant called AGNI that answers questions in 11 Indian languages. It was built for ISRO's BAH 2026 hackathon.

**Languages/Frameworks — what's used and why:**

| Thing | Why it was used |
|---|---|
| **React (Vite)** | The dashboard is highly interactive (tabs, sliders, live-updating charts) — React's state-driven UI model is a natural fit, and Vite's dev server + build are both fast. |
| **JavaScript (JSX), not TypeScript** | Simplicity for a small team/hackathon pace — the type-checking overhead was skipped. |
| **react-simple-maps + d3-geo** | For India's choropleth map (coloring state/district boundaries) — this library is built specifically for SVG-based geographic maps and takes GeoJSON directly. |
| **react-globe.gl + three.js** | Only for the intro/launch screen — to show a rotating 3D Earth globe, which isn't possible with pure CSS/SVG. |
| **recharts** | Charts (radar comparison, line trends, bar charts) — a React-native charting library with low boilerplate. |
| **react-i18next** | For supporting 11 Indian languages — this is the industry-standard i18n library for React. |
| **Node.js scripts (.mjs)** | Data-refresh scripts (weather cache, city geocoding) — small standalone scripts that run via cron or manually; a full backend framework wasn't needed for them. |
| **Vercel/Netlify Serverless Functions** | To hide the Gemini API key from the browser for AGNI chat (calling it directly from the frontend would expose the key), and to run the daily cron job. |
| **Python (scikit-learn, rasterio, h5py)** | These are purely **offline data-science scripts** (run once, not a live backend) — training the ML model (scikit-learn), processing satellite raster imagery (rasterio, for ESA WorldCover), and reading INSAT satellite HDF5 files (h5py) — Python's ecosystem is much better suited to these tasks than JavaScript. |
| **Flask (app.py) — LEGACY, no longer used** | This was an early prototype backend. There's no reference to it anywhere in the active codebase (App.jsx, vercel.json, netlify.toml, package.json scripts) — the production app never touches it. Safe to ignore. |

---

## 2. FOLDER STRUCTURE EXPLAINED

```
heatops/
├── src/                          — The entire React frontend lives here (this is the real app)
│   ├── App.jsx                   — The 4,600+ line MAIN file. Auth screen, India map, all 5 dashboard tabs — everything is in this one file (see Section 5 for a breakdown)
│   ├── App3D.jsx                 — The first wrapper that loads — shows LaunchScreen, then App.jsx (the main dashboard) after sign-in
│   ├── main.jsx                  — The actual React entry point (index.html loads this, and it renders App3D.jsx)
│   ├── App.css / index.css / 3d-styles.css — Styling
│   ├── components/                — Reusable UI pieces — each one a small, focused component (Section 5/6 has a file-by-file breakdown)
│   ├── components/AppErrorBoundary.jsx — Safety net: if a section crashes, shows "Something went wrong — Try again" instead of a blank page (root + map-level)
│   ├── components/ViewModeToggle.jsx   — The 📱 Mobile / 💻 Laptop layout switch in every navbar
│   ├── components/AudienceToggle.jsx   — The 🧑 Citizen / 🏛️ Authority switch (laptop navbars; the mobile drawer has its own row)
│   ├── components/AudienceChooser.jsx  — The one-time "Who are you?" screen after sign-in (see 8.10)
│   ├── components/HeatActionChecklist.jsx — Authority-only Heatwave Action Checklist (5 HAP steps, ticks saved per city in the browser)
│   ├── hooks/
│   │   ├── useWeather.js          — The shared hook for fetching live weather data — caching + retry + fallback chain (live → cached → error) all live here
│   │   ├── useViewMode.js         — Remembers the user's Mobile/Laptop layout choice (localStorage) and stamps it on <html>
│   │   └── useAudienceMode.js     — Remembers Citizen/Authority (localStorage `heatops_audience`, or ?view=citizen|authority) and stamps it on <html>
│   ├── utils/                     — Pure logic/helper functions (no UI) — data fetching, math, formatting
│   │   ├── weatherAPI.js          — Fetches REAL live weather+AQI from Open-Meteo (for one city, on demand) — every call has a 10s timeout
│   │   ├── fetchJson.js           — The one shared "fetch JSON safely" helper (timeout, status check, clean errors) used by every data load
│   │   ├── bulkWeatherCache.js    — Holds the daily bulk cache in memory so any part of the app can look a city up (used for fallbacks + AGNI)
│   │   ├── agniLocationContext.js — Finds cities/states named in an AGNI question and attaches their real cached data
│   │   ├── realData.js            — ⚠️ ILLUSTRATIVE/SEEDED data (not real) — details in Section 7
│   │   ├── dashboardUtils.js      — Map math + login/auth localStorage helpers + heatmap-grid buckets & intervention-impact preview
│   │   ├── cityCoordinateResolver.js — Finds a city's lat/lon (exact match or fallback)
│   │   ├── stateLiveRefresh.js    — One batched Open-Meteo call for the opened state's cities (see 8.15)
│   │   ├── lulcFallback.js        — "Nearest real city" fallback logic for land-cover data
│   │   ├── osmUtils.js            — Fetches live building-density from OpenStreetMap
│   │   ├── istClock.js            — An always-correct India time clock
│   │   ├── exportUtils.js         — CSV/PDF/WhatsApp export functions — ⚠️ **currently not used anywhere** (dead code)
│   │   └── 3d-effects.js          — Visual polish effects (card tilt, particles) — for App3D/Card3D
│   ├── data/
│   │   └── cityCoordinates.json   — Real lat/lon lookup for 1,932 cities (geocoded offline, each validated to lie in its own state)
│   └── i18n/                      — Translation files for 11 languages (react-i18next setup)
│
├── api/                           — Vercel serverless functions (production backend)
│   ├── ask-ai.js                  — Backend proxy for AGNI chat (the Gemini API key lives here)
│   ├── refresh-weather-cache.js   — The daily cron hits this (14:30 IST) — refreshes weather for all cities AND saves the day's history (see 8.9)
│   ├── refresh-weather-cache-retry.js — Second cron (16:00 IST): refetches only the cities the full run had to carry forward (see 8.15)
│   ├── weather-history.js         — GET /api/weather-history — a city's past readings (Postgres if configured, else the snapshot files)
│   └── _lib/                      — Shared logic: askAI.js, refreshWeatherData.js, githubCommit.js (now commits several files at once), weatherHistory.js (daily snapshots), weatherHistoryDb.js (Postgres), weatherHistoryApi.js
│
├── netlify/functions/             — Same AGNI proxy, for Netlify deploys (if Netlify is used instead of Vercel)
│
├── scripts/                       — Standalone Node/Python scripts — run manually or via cron, the app itself never runs these
│   ├── refreshWeatherCache.mjs    — Bulk weather refresh (local/manual run)
│   ├── weatherCacheDaemon.mjs     — Runs the one above in a loop every 20 min (for local dev)
│   ├── backfillWeatherHistory.mjs — One-off: rebuilds public/data/history/ from every past cron commit (add --db to load Postgres too)
│   ├── geocodeCities.mjs          — Builds src/data/cityCoordinates.json — Open-Meteo + OSM Nominatim, every result validated to lie in its own state (see 8.13)
│   ├── exportWeatherHistory.mjs   — Exports the daily history snapshots to a CSV (one row per city per day, with a carried_forward flag)
│   ├── train_lst_model.py         — Trains the ML model (real MODIS data, but non-Indian cities)
│   ├── build_lulc_data.py         — Pulls real land-cover data from ESA WorldCover
│   └── build_lst_insat.py         — ISRO INSAT satellite pipeline — ⚠️ **not active yet**, pending MOSDAC approval
│
├── public/
│   ├── data/                      — All REAL data files the browser fetches (geojson maps, ML model output, LULC output, city coords)
│   │   └── history/               — One compact snapshot per day of the bulk weather cache + index.json (historic data, tier 1)
│   ├── history.html               — Standalone viewer for the historic weather data (pick a city, see its daily series; carried-forward days drawn hollow/dashed)
│   └── live-weather-cache.json    — Daily-refreshed bulk weather cache (1,932 cities, powers the map/ticker/city list)
│
├── app.py, static/, templates/, requirements.txt, .venv/  — ⚠️ LEGACY Flask prototype, not used in production
├── .github/workflows/refresh-weather.yml — PRIMARY weather refresh: every 3 hours on GitHub Actions (paced, no time limit), commits cache + history (see 8.15)
├── vercel.json                    — Deploy config + fallback cron schedules (14:30 IST full run, 16:00 IST retry)
├── netlify.toml                   — Netlify deploy config
└── package.json                   — Dependencies + build scripts (npm run dev/build)
```

---

## 3. DATA FLOW — SIMPLE VERSION

Here's what happens, step by step, when a user opens the app:

1. **The sign-in screen appears** (`LaunchScreen.jsx`) — with a 3D globe. Login/register happens purely in `localStorage` (there's no real database — this is demo-level auth, not real user accounts).

2. **After sign-in, the map screen appears** (the `IndiaMap` component inside `App.jsx`). At this point, `public/live-weather-cache.json` gets fetched in the background — a file that already has the current temperature, rain-chance, AQI, cloud-cover, and PM10 stored for all 1,932 cities (because fetching all 2,050 cities live would be far too slow).

3. **Where does this cache come from?** Every afternoon at **14:30 IST** (`"0 9 * * *"` UTC in `vercel.json` — peak-heat hours; it used to run at 05:34 IST, the coolest moment of the day, which coloured the map from pre-dawn temperatures all day), a Vercel cron job triggers `api/refresh-weather-cache.js`. This function fetches fresh data for every city from Open-Meteo, and — since serverless functions can't save files persistently — commits the result straight to GitHub via `githubCommit.js`, which automatically triggers a new deploy. That's why the map shows "Heat data loaded X min ago."

4. **When a user clicks a state/city**, `App.jsx` does two things for that city in parallel:
   - Fetches **real-time live weather** via the `useWeather()` hook (directly from Open-Meteo, just for this one city — fresher than the bulk cache). **If that live call fails** (timeout, rate limit, outage), the hook automatically shows the city's reading from the bulk cache instead, clearly labelled "Showing cached data from X ago" — it only shows an error if the cache has nothing for that city either (see Section 8.5).
   - Also pulls an **illustrative baseline** from `getCityData()` (which is NOT real — see Section 7) — used only for cosmetic/demo features

5. **The dashboard's 5 tabs open up**: Overview (live weather+AQI), Analysis (satellite indices, ML model, land cover), Compare (multi-city radar chart), Interventions (cooling sliders + physics + cool-roof calculator), AI+Export (AGNI chat + download/share).

6. **When someone asks AGNI a question**, the browser doesn't call Google Gemini directly (that would expose the API key) — it calls `/api/ask-ai` (a Vercel function), which calls Gemini on its own and sends the answer. The request also carries the last few chat turns (so follow-ups make sense) and real cached data for any other cities/states named in the question (see Section 8.7). The endpoint allows 10 questions per minute per user. back.

7. **When does data refresh:** The weather cache refreshes daily (via the midnight-UTC cron). Map boundaries (geojson), the ML model, and land-cover data are all static files that don't change until someone manually re-runs a script.

---

## 4. TECHNOLOGIES USED — WHY EACH ONE

| Technology | What it's used for | Why it was chosen |
|---|---|---|
| React 18 + Vite | The entire frontend UI | Fast dev experience, component-based, a natural fit for an interactive dashboard |
| react-simple-maps + d3-geo | India's choropleth map | A library built specifically for SVG-based geographic maps, supports GeoJSON directly |
| react-globe.gl + three.js | The intro screen's 3D globe | Purely for visual polish — not possible without 3D rendering |
| recharts | All charts (radar, line, bar) | Low-boilerplate charting that works well with React |
| react-i18next | 11 languages | The industry-standard React i18n solution |
| Tailwind CSS (partial) + custom CSS | Styling | A config file exists, but most styling is actually custom inline styles in App.jsx |
| Open-Meteo API | Live weather, AQI, forecast | Free, no API key needed, non-commercial use allowed — perfect for a hackathon budget |
| ESA WorldCover (satellite) | Real land-cover classification | A free, publicly available 10m-resolution satellite land-cover dataset |
| Google Gemini (gemini-2.5-flash) | AGNI AI chat | Fast + affordable LLM, given the "AGNI" persona via a structured prompt |
| Vercel Serverless Functions | AGNI proxy + cron-based cache refresh | Necessary to hide API keys from the browser; Vercel cron is built in |
| GitHub REST API (via githubCommit.js) | Persisting the refreshed cache | Serverless functions have no persistent disk, so a GitHub commit acts as the "storage" |
| scikit-learn (Python) | Training the LST-prediction ML model | The standard, battle-tested library for training a model like Random Forest |
| rasterio (Python) | Processing satellite raster imagery | Needed to read ESA WorldCover's geospatial raster files |
| localStorage (browser) | Login/auth, remembered preferences | There's no real backend database, so this is demo-level persistence |

---

## 5. KEY FEATURES → WHICH FILE IT'S IN

| Looking for this feature | File |
|---|---|
| **India map (colors, layers, zoom/pan)** | `src/App.jsx` — search for `IndiaMap`, `DistrictsLayer`, `WeatherOverlayIcons` |
| **Heat-index color logic (which state gets which color)** | `src/App.jsx` — search for `getHeatIndexColor` |
| **Weather-condition badges on the map (rain/dust/cloud icon at the state centre)** | `src/App.jsx` — search for `WeatherOverlayIcons`, `WEATHER_OVERLAY_ICONS`, `liveStateWeatherCondition` |
| **Heat-reactive theme colour (red/orange/yellow/green from the selected city's live temperature)** | `src/App.jsx` — search for `UI_THEME_BUCKETS`, `getThemeVars`, `getThemeAccent`; the Heat Risk Gauge readout uses the same four tiers |
| **City list "NO LIVE DATA" (no fabricated temperatures)** | `src/App.jsx` — search for `no-live-data` inside `CityPanel`; global search fallback right below the `Search any city` input |
| **Map fit / zoom floor (1× = fit to card)** | `src/App.jsx` — `INDIA_MAP_PROJECTION_CONFIG` (scale 1120, centre 23.2°N) and `setMapScale` (wheel + the +/−/↺ buttons) |
| **Live weather (temp, humidity, forecast) for one city** | `src/utils/weatherAPI.js` + `src/hooks/useWeather.js` + UI: `src/components/WeatherCard.jsx` |
| **AQI calculation/category** | `src/utils/weatherAPI.js` (function `getAQICategory`) |
| **Bulk weather cache (all cities, for the map/ticker)** | `scripts/refreshWeatherCache.mjs` (local) / `api/refresh-weather-cache.js` (production cron) → output: `public/live-weather-cache.json` |
| **Historic weather (every day's readings)** | Snapshots: `public/data/history/` via `api/_lib/weatherHistory.js`; Postgres: `api/_lib/weatherHistoryDb.js` (needs `DATABASE_URL`); read: `api/weather-history.js`; backfill: `scripts/backfillWeatherHistory.mjs` |
| **ML model (LST prediction)** | Train: `scripts/train_lst_model.py` → Output: `public/data/ml_model_real.json` → Display: `src/components/MLModelPanel.jsx` |
| **Land cover (vegetation/built-up/water %)** | Build: `scripts/build_lulc_data.py` → Output: `public/data/lulc_real.json` → Display: `src/components/LandCoverPanel.jsx` + fallback logic: `src/utils/lulcFallback.js` |
| **Intervention sliders (cool roof/greening/water)** | `src/App.jsx` — search for `roofSlider`, `treeSlider`, `waterSlider` (Interventions tab) |
| **Cool Roof ROI calculator** | `src/components/CoolRoofCalculator.jsx` |
| **Physics explanations (formulas)** | `src/components/PhysicsPanel.jsx` |
| **AGNI AI chatbot (frontend)** | `src/components/AIAnalystPanel.jsx` (main chat UI) + `src/components/FloatingAIAssistant.jsx` (floating bubble wrapper) |
| **AGNI AI chatbot (backend/prompt)** | `api/_lib/askAI.js` (system prompt + Gemini call + rate limit + conversation memory) → entry points: `api/ask-ai.js` (Vercel), `netlify/functions/ask-ai.js` (Netlify), dev: `vite.config.js` |
| **AGNI: other cities/states in a question** | `src/utils/agniLocationContext.js` (called from `AIAnalystPanel.jsx`) |
| **Citizen / Authority view (audience)** | `src/hooks/useAudienceMode.js` + `src/components/AudienceChooser.jsx` (asked once after sign-in) + `src/components/AudienceToggle.jsx` + citizen strip/tabs in `src/App.jsx` |
| **Citizen extras: Share with family (WhatsApp), Safe hours today, How you can help your neighbourhood** | `src/App.jsx` — search for `whatsapp-share`, `SAFEHOURS`, `safe-hours-now`, `data-panel="HELP"` |
| **Heatwave Action Checklist (Authority)** | `src/components/HeatActionChecklist.jsx` (localStorage key `heatops_checklist:<city>|<state>`), rendered after PANEL K in `src/App.jsx` |
| **Historic weather viewer + CSV** | `public/history.html` (reads `/api/weather-history`) + `scripts/exportWeatherHistory.mjs` |
| **City coordinates (geocoding + validation)** | `scripts/geocodeCities.mjs` → `src/data/cityCoordinates.json`; live fallback chain in `src/utils/weatherAPI.js` (`getCityCoordinates`) |
| **Mobile header (stacked rows + ☰ drawer)** | `src/App.jsx` — search for `CompactNavbar`, `audienceSwitchRow`; CSS `html[data-view-mode="compact"]` in `src/App.css` |
| **AGNI markdown replies (bold, lists, headings)** | `src/components/AIAnalystPanel.jsx` (`react-markdown`, `className="chat-bubble ai md"`) + `.chat-bubble.md` styles in `src/App.css` |
| **Mobile / Laptop layout toggle** | `src/components/ViewModeToggle.jsx` + `src/hooks/useViewMode.js` + CSS rules `html[data-view-mode="compact"]` in `src/App.css` |
| **"Data may be outdated / Live data unavailable" notes** | `src/App.jsx` — search for `CacheStatusNote`, `liveCacheStatus`, `isCacheStale` |
| **Error screens ("Something went wrong", "Map could not be displayed")** | `src/components/AppErrorBoundary.jsx` (mounted in `src/main.jsx` and around `IndiaMap` in `src/App.jsx`) |
| **Weather fallback when Open-Meteo fails** | `src/hooks/useWeather.js` (`resolveFallback`) + `src/utils/bulkWeatherCache.js` + partial-card rendering in `src/components/WeatherCard.jsx` |
| **Intervention sliders → Analysis grid preview & badge** | `src/utils/dashboardUtils.js` (`computeInterventionImpact`, `getGridBucket`) + `src/App.jsx` (search `intervention-preview`, `grid-updated-badge`) |
| **Collapsible map legend** | `src/App.jsx` — search for `legendOpen` inside `IndiaMap` |
| **City comparison (radar chart)** | `src/components/CompareCitiesPanel.jsx` |
| **Multilingual/language switcher** | `src/i18n/index.js` + `src/i18n/locales/*.json` — in App.jsx, search for `SUPPORTED_LANGUAGES`, `changeLanguage` |
| **Sign-in/Register screen** | `src/components/LaunchScreen.jsx` |
| **Export (CSV/PDF/WhatsApp share)** | `src/utils/exportUtils.js` ⚠️ (built, but currently not used anywhere) |
| **"Where to intervene" recommendations** | `src/components/SpatialRecommendation.jsx` |
| **Rural vs Urban heat comparison (UHI gap)** | `src/components/RuralBaselinePanel.jsx` ⚠️ (built, uses live data, but isn't currently rendered anywhere in App.jsx — this is the same feature as the earlier "Priority 2" idea) |

---

## 6. HOW TO MAKE COMMON CHANGES

- **Want to change colors/design** → Most styling is inline styles right inside `src/App.jsx` (each component has its own `style={{...}}` object). Global CSS: `src/App.css` / `src/index.css`. Heat-index colors specifically: the `getHeatIndexColor()` function in `App.jsx`.

- **Want to add a new city** → Cities are hardcoded in the `STATE_DATA` object at the top of `src/App.jsx` (a `cities: [...]` array inside each state). After adding a new city, if you want its real lat/lon, you'll need to re-run `scripts/geocodeCities.mjs` so `src/data/cityCoordinates.json` gets updated (otherwise that city will just use the state-level fallback coordinate).

- **Want to change AGNI's (the AI's) behavior** → The system prompt lives in `api/_lib/askAI.js`. Both deploy targets (Vercel + Netlify) share this exact file, so changing it in one place applies everywhere.

- **Want to add a new tab/panel** → Follow the existing pattern: (1) create a new `.jsx` file in `src/components/` (look at small self-contained components like `PhysicsPanel.jsx` or `CoolRoofCalculator.jsx` as a reference), (2) import it in `App.jsx`, (3) drop `<YourComponent />` inside the `activeTab === 'TabName'` block for whichever tab you want it in. For a brand-new tab, add its name to the `TABS` array (search `App.jsx` for `const TABS =`).

- **Want to add a new language** → Add a new `.json` file in `src/i18n/locales/` (copy `hi.json` and translate it, for example), then add it to the `SUPPORTED_LANGUAGES` list in `src/i18n/index.js`.

- **Want to change how often weather refreshes** → Change the `schedule` (cron syntax) inside the `crons` array in `vercel.json`.

- **Want to change when data counts as "outdated"** → `CACHE_STALE_MS` in `src/App.jsx` (currently 36 hours — the cron is daily, so this tolerates one late run).

- **Want to change the colour palette** → The base tokens are CSS variables at the top of `src/App.css` (`--primary` amber `#d97706`, `--dark-bg`, `--card-bg`, and the risk colours `--extreme/--high/--moderate/--safe`). Map/legend colours: `HEAT_INDEX_BUCKETS` in `src/App.jsx`. Heatmap-grid colours: `GRID_BUCKETS` in `src/utils/dashboardUtils.js`. Heat-reactive panel accents: `UI_THEME_BUCKETS` in `src/App.jsx`.

- **Want to change the Mobile/Laptop auto-default breakpoint** → `AUTO_BREAKPOINT_PX` in `src/hooks/useViewMode.js` (768px).

- **Want AGNI to remember more/less of the chat, or allow more questions per minute** → `MAX_HISTORY_TURNS` and `RATE_LIMIT_MAX` in `api/_lib/askAI.js`.

- **Want to change any network timeout** → each call passes `timeoutMs` to `fetchJson()` (`src/utils/fetchJson.js`); the default is 10s, GeoJSON maps use 90s.

---

## 7. WHAT'S REAL DATA VS WHAT'S ESTIMATED/STATIC

### ✅ Real / Live (comes from an actual source)
- **Live weather, humidity, wind, forecast, AQI (per-city)** — Open-Meteo API (`src/utils/weatherAPI.js`)
- **Bulk cache (temp/rain/AQI/cloud/PM10 for 1,932 cities)** — Open-Meteo, refreshed daily (`public/live-weather-cache.json`)
- **Land cover % (vegetation/built-up/water)** — ESA WorldCover 10m satellite data (`public/data/lulc_real.json`), direct for representative cities only; other cities use a "nearest real city" fallback (honestly labeled)
- **Building density** — a live OpenStreetMap Overpass API call (`src/utils/osmUtils.js`)
- **ML model metrics (R², feature importance)** — a genuinely trained Random Forest, on real MODIS satellite training data — **but ⚠️ the training data is from non-Indian cities (20 global cities)**, and this is disclosed in the UI too
- **Map boundaries** — real GeoJSON state/district shapefiles
- **AGNI's answers** — a real, live Gemini API call (if it's offline, a clearly-labeled canned fallback shows instead)
- **City coordinates** — real geocoded lat/lon (1,932 cities, each validated to lie in its own state), from Open-Meteo + OSM Nominatim geocoding

### ⚠️ Estimated / Fallback (derived from a real source, but not a direct measurement)
- **Land-cover for non-representative cities** — borrows the nearest real city's data, labeled as an estimate/with the distance shown
- **Building density when Overpass fails** — shows "unavailable," never fakes a number
- **Carried-forward bulk-cache values** — when the nightly refresh can't reach Open-Meteo for a batch of cities, their previous values are kept but flagged (`isCarriedForward`), and the history viewer/CSV show them as “carried forward”, never as fresh readings
- **Cities with no live reading** — the map-screen city list and global search show an explicit "NO LIVE DATA" badge (search may show the state's *live* average, labelled "(state avg)"). Nothing is estimated: the earlier "~21.8°C"-style guesses (state avgLST ± a hash of the city name) were removed on 29 Aug 2026 after they were caught 7°C from reality. City coordinates are validated to lie in their own state (`scripts/geocodeCities.mjs`, Open-Meteo + OSM Nominatim); 24 of 1,956 cities remain unresolved and stay honestly blank.
- **ML model applied to any Indian city** — the model itself is real, but since it's trained on non-Indian data, its predictions for Indian cities should be treated as a "generalization estimate"

### ❌ Static / Illustrative (fabricated, not a real measurement)
- **`src/utils/realData.js` (`STATE_DATA`, `getCityData()`)** — this file's own comments say it's "illustrative, NOT a real data pipeline." City-level LST/NDVI/NDBI/NDWI numbers are generated from a formula (a seed built from the letters of the city's name) — the same city always gets the same number, but that number never came from a satellite or sensor. It's only used for: the dashboard's theme color, the "what-if" heat simulator, the City Compare panel's LST/NDVI/NDBI/NDWI, and the Spatial Recommendation's area/cost estimate.
- **The Physics panel's formulas/cost estimates** — educational content, cited but static, not live
- **The Cool Roof calculator's cost coefficients** — reference numbers cited from real Indian pilot programs (Ahmedabad/Telangana), but they're static constants, not a live pricing feed

**A simple rule of thumb the codebase itself follows:** wherever the UI shows a "Source: ..." badge (the `DataBadges.jsx` component), that number is real. Wherever there's no badge (like some Compare-panel fields, or the what-if simulator), it's the illustrative data from `realData.js`.

---

## 8. WHAT CHANGED ON 28–29 AUGUST 2026 — THE UPGRADE IN PLAIN LANGUAGE

Everything below was built, tested with real failure simulations / Playwright screenshots, and committed on 28–29 August 2026 (8.1–8.9 on the 28th, 8.10–8.14 on the 29th). Each item says what the problem was, what it looks like now, and exactly where the code lives.

### 8.1 Visual redesign — a professional civic-tech look

**Before:** neon green/cyan "hackathon" colours, glows, and gradients. **Now:** a single amber accent (`#d97706`) on a dark slate base, desaturated risk colours (Extreme `#b91c1c`, High `#c2410c`, Moderate `#ca8a04`, Safe `#15803d`), no glow effects — closer to an NDMA/IMD-style government dashboard.

It was done in reviewed sections: **1** palette variables → **2** navbar (outline-style badges) → **3** ticker bar (muted text, red only for genuinely critical values like an AQI over 300 — a bug that stopped this from ever firing was fixed) → **1b** a four-part sweep that applied the palette everywhere the CSS variables couldn't reach (the map screen, dashboard panels, every component, launch/sign-in screens, even the custom cursor and loading screen) → **4** the map legend (see 8.2).

A useful lesson from this pass, recorded so nobody repeats it: most of the visible UI is styled with inline `style={}` in `src/App.jsx`, not CSS classes. Changing a CSS class often changes nothing on screen. The sweep also found three CSS variables (`--green`, `--orange`, `--red`) that had been deleted while still referenced — those rules were silently dropped by the browser (invisible progress bars, unstyled buttons). All fixed; an audit now shows zero undefined variables.

**Files:** `src/App.css`, `src/index.css`, `src/3d-styles.css`, `src/App.jsx`, every file in `src/components/`, `src/utils/3d-effects.js`.

### 8.2 Map legend + mobile map layout

- **Legend:** the "HEAT INDEX" card used to sit permanently over the map (covering ~60% of it on a phone). It's now collapsed into a small **🎨 Legend** button; tap to expand, ✕ to close. Its colours come from the same `HEAT_INDEX_BUCKETS` list that colours the states, so they can't drift apart. (`src/App.jsx`, search `legendOpen`.)
- **Phone layout:** the map screen was a fixed two-column row (58% map / 42% panel) even at 375px, so India rendered about 105px wide. On phones the two columns now stack — map first, full width (India ≈ 205px wide, ~4× the area), side panel below. Because the page body itself can't scroll in this app, the map container becomes the scroll area. (`src/App.css`, the `html[data-view-mode="compact"]` rules; `src/App.jsx` classes `map-layout`, `map-layout-map`, `map-layout-side`.)

### 8.3 Resilience — the app degrades gracefully instead of breaking

Built in three priorities, each verified by actually blocking, delaying, or corrupting network responses:

1. **Never a permanent spinner or blank page.** The map's data loader used to cache a *failed* download forever ("Loading map data…" for the whole session). It now shows "Map data could not be loaded" with a **Retry** button. Two safety nets were added: a root-level one (`src/main.jsx`) that turns any crash into a "Something went wrong — Try again / Reload" card, and a map-level one so a broken map leaves the navbar, ticker and panels working. (`src/components/AppErrorBoundary.jsx`.)
2. **Honest data states everywhere.** The bulk weather cache can now be *loading*, *ready*, *outdated* (older than 36h) or *unavailable*. One shared `CacheStatusNote` shows the right line in every panel, the ticker badge says **LIVE / LOADING / CACHED / OFFLINE**, and a small chip on the map says when its colours come from cached or missing data. Before this, a missing cache silently showed hardcoded seed values as if they were live.
3. **Every network call has a real timeout.** A shared helper, `src/utils/fetchJson.js`, gives each request a time limit (10s by default), treats non-200 responses as errors, and never lets a broken JSON body escape as a crash. All Open-Meteo calls, the weather cache, the ML/land-cover files and the GeoJSON maps go through it.

Plus, on the server: the AGNI chat endpoint now allows **10 questions per minute per user**, caps question length, and returns clean errors instead of crashing on bad input (`api/_lib/askAI.js`).

### 8.4 Weather-condition overlay on the map (rain / dust / cloud)

For each state, the app averages the bulk cache's PM10, rain-chance and cloud-cover across that state's cities, then picks **one** condition in priority order: dust if average PM10 ≥ 400, else rain if average rain chance ≥ 60%, else cloud if average cloud cover ≥ 80%, else clear.

**Updated 29 Aug (twice):** the original translucent tints were too subtle to notice, so they were first replaced by pattern fills over the whole state (stripes / dashes / dots). That was accurate but cluttered: in the monsoon, 26 of 36 states cross the heavy-cloud or rain threshold on an ordinary day, so most of India ended up textured and the heat colours underneath were hard to read. The overlay is now **one small icon badge per affected state** — a white cloud (heavy cloud), a cloud with blue drops (rain) or orange dust waves (dust) on a dark backing disc at the state's centroid. The icons are **vector shapes, not emoji**: an emoji inside SVG `<text>` needs an OS colour-emoji font the browser will use within SVG, and on machines without one only the disc rendered ("white rings, no icon"); paths render the same everywhere — and states with no active condition show clean, solid heat-index colour with nothing on them. The legend rows describe the badge. **Citizen view** shows only the badge for the selected city's state plus a one-line "🌧️ Rain likely" / "🌫️ Dusty air (high PM10)" / "☁️ Heavy cloud" note in the citizen strip; **Authority view** shows badges for every affected state. (`src/App.jsx` — `WeatherOverlayIcons`, `WEATHER_OVERLAY_ICONS`, `liveStateWeatherCondition`, `WX_WORDS`.)

### 8.5 City-level weather fallback — live → cached → error

When you open a city, the app asks Open-Meteo for fresh weather. Open-Meteo is free and occasionally rate-limits or times out. The order is now:

1. **Live API** (fresh, most accurate) — with retries and backoff if rate-limited.
2. **Cached reading** — if live fails, the hook checks this browser's last successful reading for that city *and* the daily bulk cache, and shows whichever is fresher, labelled **"Showing cached data from X ago — live data temporarily unavailable."** with a Force Refresh button. If the slow path takes more than 10s, the cached reading is shown immediately while the live call keeps trying.
3. **Error** — only if neither exists (rare, since the cache covers 1,932 cities).

The bulk cache only has temperature, AQI, PM10, rain chance and cloud cover, so the cached card is a shorter version (no forecast, no humidity) and says so in its footer. Example: with Open-Meteo blocked and **Delhi** chosen, the card shows New Delhi's cached 32°C / AQI 152 instead of "Failed to fetch". (`src/hooks/useWeather.js` → `resolveFallback`; `src/utils/bulkWeatherCache.js`; `src/components/WeatherCard.jsx`.)

### 8.6 📱 Mobile / 💻 Laptop view toggle

A switch in the top-right of every navbar. **Mobile** = stacked panels, full-width map, one-column dashboard. **Laptop** = map and panels side by side, everything visible at once. The names describe the *layout*, not the device — anyone can pick either on any screen. First visit auto-selects (≤768px → Mobile), and the choice is saved in the browser (`localStorage` key `heatops_view_mode`). Technically the choice is stamped on the page as `<html data-view-mode="compact|full">` and the CSS reads that instead of screen size, so there's one layout system, not two. (`src/hooks/useViewMode.js`, `src/components/ViewModeToggle.jsx`, `src/main.jsx`, rules in `src/App.css`.)

### 8.7 AGNI upgrade — memory, other cities, a human voice, strict scope

- **Conversation memory:** the chat sends its last 10 turns with each question, so "aur uska AQI?" after asking about Delhi is understood as Delhi's AQI. (`src/components/AIAnalystPanel.jsx` builds `history`; `api/_lib/askAI.js` passes it to Gemini as a multi-turn conversation.)
- **Other cities and states:** the question (and the last few turns) is scanned for city/state names in the bulk cache — with common aliases like Bangalore, Bombay, Gurgaon, Orissa. Matched cities get their real cached readings attached; matched states get a computed summary (average temperature, hottest and coolest cities, worst AQI). So "Rajasthan mein sabse garam sheher?" is answered from data, and "Mumbai vs Bengaluru" compares real numbers. Anything not in the cache is answered with "is city ka data abhi available nahi hai" — the prompt forbids guessing. (`src/utils/agniLocationContext.js`.)
- **Voice:** the system prompt now describes AGNI as a warm, knowledgeable friend who loves this field — natural sentences, brief greetings for "hi" (no data dump), visible concern when a situation is dangerous, one consistent personality.
- **Domain depth:** general questions inside the field ("UHI effect kya hota hai?") get a proper expert explanation, labelled as general climate science rather than app data.
- **Scope boundary:** anything outside heat/climate/environment (coding, trivia, homework…) is politely declined and redirected, and AGNI holds that line even if the user insists.
- **Honesty:** never invents a reading; says when data isn't available.

All of this lives in the system prompt in `api/_lib/askAI.js` (sections WHO YOU ARE, VOICE & PERSONALITY, CONVERSATION MEMORY, DOMAIN DEPTH, MULTI-PART QUESTIONS, SCOPE BOUNDARY, HONESTY).

### 8.8 Cross-tab sync — Interventions ↔ Analysis

The three cooling sliders live on the **Interventions** tab but change the temperature heatmap grid on the **Analysis** tab, and nothing used to say so. Now:

- Under the sliders, a live preview box recalculates as you drag: "−5.0°C per cell · 100/100 cells move to a cooler category · Extreme → Moderate: 45 · High → Low: 30 …", with a "View on Analysis tab →" shortcut.
- When you then open Analysis, a "✨ Updated based on your intervention settings" badge sits above the grid for six seconds.

How the two tabs share state: all three slider values are ordinary React state at the top of `App.jsx` (`treeSlider`, `roofSlider`, `waterSlider`), and both tabs read the same variables. The preview uses the exact same cell formula (`getCellTemp`) and the same colour thresholds (`getGridBucket`) as the grid, so what it predicts is what you see. A timestamp (`interventionTouchedAt`) records the last slider change; the Analysis tab shows the badge when it opens after that timestamp, once per change. (`src/utils/dashboardUtils.js`: `GRID_BUCKETS`, `getGridBucket`, `computeInterventionImpact`; `src/App.jsx`: search `intervention-preview`, `grid-updated-badge`.)

### 8.9 Historic weather data — every cron run is now kept

**Before:** the nightly refresh overwrote `public/live-weather-cache.json`, so yesterday's readings were gone (except buried in git commits). **Now** every run is stored twice:

- **Tier 1 — snapshot files (no setup needed).** The cron writes a compact file for the day, `public/data/history/YYYY-MM-DD.json` (~60 KB: temperature, rain chance, AQI, cloud cover, PM10 for all ~1,900 cities), and updates `public/data/history/index.json` (the list of days). These go into the **same GitHub commit** as the cache — `api/_lib/githubCommit.js` now uses GitHub's Git Data API to commit several files at once — so it is still one commit and one deploy per night. `scripts/backfillWeatherHistory.mjs` rebuilt this from the repo's history: **63 days, 22 June → 28 August 2026**, are already there.
- **Tier 2 — a real database (optional).** Set `DATABASE_URL` (any Postgres — Neon, Vercel Postgres, Supabase, Railway) in Vercel's environment variables and the same run also inserts one row per city into `weather_observations` (plus one row per run in `weather_runs`). Tables are created automatically; re-runs are idempotent. Run `node scripts/backfillWeatherHistory.mjs --db` once to load the 63 historical days into it.

**Carried-forward readings are flagged (radical honesty).** When an Open-Meteo batch fails, the refresh keeps a city's previous values so the map never blanks out — but that value is now stamped `isCarriedForward: true` with its real `observedAt`, and the day's snapshot stores it as `carried = 1`. The backfill also labels older runs: if a city's whole reading is identical to the previous day's, it is marked `carried = 2` (“inferred”). The history viewer draws these as dashed lines / hollow points and labels them “⚠️ carried forward” in the table; the CSV export has a `carried_forward` column. Rebuilding the history this way showed **43% of all city-days over the last two months were carried-forward values** — e.g. Jaisalmer's week-long flat stretches — which is why this flag matters.

**Reading it:** `GET /api/weather-history?city=New%20Delhi&state=Delhi&days=30` returns that city's daily series (`source: "postgres"` when the database is configured, otherwise `"snapshots"`); `?runs=1` lists the available days. The local `npm run dev` server serves the same endpoint. There is a standalone viewer at **`/history.html`** (pick a city → daily temperature/AQI/rain series; carried-forward days are drawn hollow/dashed) and `node scripts/exportWeatherHistory.mjs` writes the whole archive to CSV with a `carried_forward` column. The main dashboard doesn't chart it yet — it's the data foundation for trend charts.

**Files:** `api/_lib/weatherHistory.js`, `api/_lib/weatherHistoryDb.js`, `api/_lib/weatherHistoryApi.js`, `api/weather-history.js`, `api/refresh-weather-cache.js`, `api/_lib/githubCommit.js`, `scripts/refreshWeatherCache.mjs`, `scripts/backfillWeatherHistory.mjs`, `.env.example`.

### 8.10 Citizen / Authority view — who the dashboard is for

Separate from the 📱 Mobile / 💻 Laptop toggle (that's *density*; this is *audience*), so any combination works — "Citizen + Mobile", "Authority + Laptop", etc.

- **First sign-in:** a one-time screen asks **"Who are you?"** with two big choices — **🧑‍🤝‍🧑 Citizen** and **🏛️ Government / Planner** — and a "Skip, show me everything →" link (Skip = Authority). The choice is saved in the browser (`localStorage` key `heatops_audience`) and never asked again. A direct link works too: `?view=citizen` or `?view=authority` sets it without the question.
- **Citizen view:** top bar shows only the essentials — 📍 city, 🌡️ temperature, a plain-language **risk badge** (Low / Medium / High / Extreme, from the same rules as the Health & Safety panel), the air-quality category and one 💡 safety tip; the system badges (HEAT HIGH, EL NIÑO, SYSTEM OPS, SAT ACTIVE) and the ticker are hidden. The dashboard has three tabs: **Overview** (weather card with AQI shown as a category only, heat-risk gauge, alerts) and **What to do** (the Health & Safety precautions plus a simple AGNI box with resident-friendly suggestions). AGNI is told the audience is a resident and answers without jargon.
- **Compare for citizens (added 30 Aug):** the Compare tab (radar chart vs up to 4 other cities) is in the citizen tab set too — "is my city hotter than my parents' city?" is a resident's question; Analysis, Interventions and AI + Export stay Authority-only (AGNI is still one tap away via the floating button).
- **Citizen extras:** a **📤 Share with family** button (WhatsApp `wa.me` link pre-filled with the city's temperature, risk level, air quality and safety tip), a **Safe hours today** section — one clean bar for the day (🔴 avoid ≥ 40 °C feels-like, 🟡 only if necessary 35–39 °C, 🟢 safe), a prominent "Right now: …" status line and the time windows written out on one wrapping line underneath (no truncated labels at 375 px), and a **How you can help your neighbourhood** card on *What to do* (five concrete actions; on High/Extreme days the "check on elderly neighbours NOW" step moves first in red).
- **Authority view:** everything as before — every badge, all five tabs, ML model, comparisons, intervention calculators, exports — plus a **Heatwave Action Checklist** on the Overview tab: five Heat Action Plan steps (cooling centres, health-department alert, public advisory, water tankers, prioritise Cool Roof/green-cover interventions with a link to the Interventions tab). It shows STANDBY until the city's risk reaches High/Extreme, then ACTIVE; ticks are saved in the browser per city with a timestamp, so it works as a live operational aid in a demo (`src/components/HeatActionChecklist.jsx`).
- **Switching later** is deliberately *not* in the header: it's the "👁️ View: Citizen ⚙️ · switch to Authority" item in the avatar menu (map screen), the "View" row in the mobile ☰ drawer, and a "Switch to … view" button on the My Profile page.

**Files:** `src/hooks/useAudienceMode.js` (state + storage + URL param), `src/components/AudienceChooser.jsx` (the one-time screen, mounted from `src/App3D.jsx`), `src/App.jsx` (citizen top-bar strip, tab set, `data-panel` tags on the Overview panels, menu items), `src/App.css` (which panels each citizen tab shows), `src/components/WeatherCard.jsx` (`simpleAqi`), `src/components/AIAnalystPanel.jsx` (citizen suggestions/placeholder/context).

### 8.11 Mobile header without sideways scrolling + AGNI replies that render properly

- **Mobile header:** the compact navbar used to be one long row that scrolled horizontally. It now stacks into rows (brand + clock + ☰ on top, the badges underneath, the ticker in a single-item "most critical" mode) and the rarely used controls — language, Mobile/Laptop, Citizen/Authority, profile, logout — live in a ☰ drawer. Nothing scrolls sideways at 375 px. (`CompactNavbar`, `TickerBar compact` in `src/App.jsx`; compact rules in `src/App.css`.)
- **AGNI markdown:** Gemini answers in markdown (bold, bullet lists, headings) and the chat used to show the raw asterisks. Bubbles are now rendered with `react-markdown` (`className="chat-bubble ai md"`), with list markers restored (the global CSS reset had hidden them). (`src/components/AIAnalystPanel.jsx`, `.chat-bubble.md` in `src/App.css`.)

### 8.12 Theme colour follows the selected city's live temperature

The dashboard's accent/glow/background tint used to come from the *state's* illustrative heat bucket, so a cool hill town in a hot state was painted orange. It now follows the **currently selected city's live current temperature**, in four tiers that match the risk language everywhere else:

| Live temperature | Tier | Accent |
|---|---|---|
| ≥ 45 °C | Extreme | red `#dc2626` |
| 35–44.9 °C | High | orange `#ea580c` |
| 25–34.9 °C | Moderate | yellow `#eab308` |
| < 25 °C | Low | green `#22c55e` |

`UI_THEME_BUCKETS` → `getThemeVars(temp)` sets `--theme-accent / --theme-glow / --theme-bg-*` on the dashboard container and the map side panel; when no live reading exists yet it falls back to the seeded value (only for colour — never shown as a number). The **Heat Risk Gauge** readout (label + dot) was aligned to the same four tiers, so the gauge no longer says "LOW-MODERATE 🟢" under a yellow heading. Verified with Playwright by forcing three different live temperatures on three cities.

### 8.13 No fabricated temperatures — and every city's coordinates verified

**The bug:** the map-screen city list showed "~21.8 °C" for cities missing from the live cache. That number was `state avgLST ± a hash of the city name` — invented — and it was caught 7 °C from reality (Sundernagar, HP, on a 29 °C afternoon). Digging into *why* those cities were missing exposed two data problems in `cityCoordinates.json`:

1. **267 cities had no coordinates** — Open-Meteo's geocoder doesn't know Sundernagar, Keylong, Akhnoor, Nandprayag, Suheli Par… so the nightly cron never fetched them.
2. **202 cities pointed at the wrong place** — Tawang in East Java, Hunder in Denmark, Drass in Austria, Kutch in Colorado, Koderma in Albania — because the old script trusted the first hit for a bare city name. Those showed as *live* readings, which is worse than an estimate.

**The fix, in three parts:**
- **UI (honesty):** the city list shows an explicit **"NO LIVE DATA"** badge (tooltip: nothing is estimated); global search falls back to the *live* state median labelled "(state median)", then blank; the live-fetch geocoder only accepts a hit whose state matches, otherwise it uses the labelled state-representative fallback — and that fallback reading is no longer shown as the selected city's own temperature in the list.
- **Data (`scripts/geocodeCities.mjs`):** every result must be in India *and* either carry the requested state as its admin1/address.state or lie inside the padded bounding box of that state's already-trusted cities (~35 km — this keeps Delhi-NCR entries like Gurugram/Noida, which are legitimately in Haryana/UP). Open-Meteo first, then **OSM Nominatim** with "City, State, India" (1 request/second). Result: **1,932 / 1,956 cities validated** (1,500 Open-Meteo state-matched, 392 Nominatim, 40 accepted by bounding box), none outside India's bounding box. A spelling-alias table (Tinsukhia→Tinsukia, Tumkuru→Tumakuru, Mohindergarh→Mahendragarh, Zuluk→Dzuluk…) plus a bare-name second attempt resolved 24 more on 30 Aug; 24 tiny places (colony names, hamlets) remain unresolved and stay honestly blank.
- **Refresh (`api/_lib/refreshWeatherData.js`, `scripts/refreshWeatherCache.mjs`):** both used to carry forward *every* previously cached key, so a removed wrong-place city would have lived on as a "carried forward" reading. They now only carry forward cities still in the coordinate list. The cache was refreshed with the corrected coordinates (1,908 fresh readings; e.g. Sundernagar 25 °C at 21:40 IST, Tawang 9 °C, Suheli Par 28 °C).

### 8.14 Map fills its card; zoom-out stops at "fit"

Two reasons the Authority map could look like a small India floating in an empty card: zoom-out went down to 0.5× although 1× was already fit-to-card (each "−" only shrank the map into empty space), and the projection left ~17 % of the box unused under Kanyakumari. Now the zoom floor is **1×** for the button and the scroll wheel (the "−" button is disabled at fit and returning to 1× re-centres the pan), and the projection is `scale 1120, centre 23.2°N`, so India fills **93 %** of the box. Verified with screenshots at 1920×1080, 1366×768, 1280×860, 1024×600, 900×420 and 375×812 — nothing clips at Kashmir, Arunachal or the A&N / Lakshadweep labels. Very short windows remain height-bound (India is roughly square, so a 200 px-tall card can only show a ~190 px India).

### 8.15 The map was coloured from pre-dawn temperatures — fixed at the source and on open

**What you saw:** Udaipur listed at 23 °C, then 28 °C the moment it was selected; Rajasthan, MP and the south coloured green on a hot afternoon. **Why:** the nightly cron ran at 00:00 UTC = **05:34 IST**, the coolest minute of the day, and the whole map, city list and state averages are coloured from that snapshot until the next run — while a selected city's WeatherCard is fetched live. Two fixes:

1. **Cron moved to 09:00 UTC = 14:30 IST** (peak heat). The daily history snapshot is therefore an afternoon reading from 31 Aug 2026 onwards (earlier days in `public/data/history/` are dawn readings — the CSV/viewer show the `lastUpdated` time of each day).
2. **Live refresh of the opened state** (`src/utils/stateLiveRefresh.js`): when you click a state, its cities' current temperature / cloud / rain chance are fetched in **one batched Open-Meteo call** (≤ 100 cities per call; 10-minute memory per state) and merged into the same cache every panel reads. So the city list, the state's average (→ map colour and side-panel badge), the ticker and the selected city all agree. Fresh rows carry a small green dot (tooltip "Live reading from the last few minutes"); the panel note reads "Live temps · Rajasthan refreshed just now (daily cache from 9h ago for the rest of India)". AQI keeps its cached value (different endpoint, changes slowly). If the call fails, nothing changes and the cached values stay labelled with their own age.

3. **A retry cron for rate-limited batches** (added the same day, after the first 14:30 IST run came back with 432 of 1,932 cities carried forward): Open-Meteo weights a multi-location request by its location count against the 600/min budget, and Vercel's egress IPs are shared, so a 1,932-city burst sometimes gets 429s. The full run now uses two lanes (weather, then AQI) with 5 s / 10 s back-off, and a second cron — `GET /api/refresh-weather-cache-retry` at **10:30 UTC = 16:00 IST** — refetches *only* the cities flagged `isCarriedForward` (a few hundred at most, which fits the budget), rewrites the cache and today's snapshot, and commits nothing if there was nothing to retry. (`api/_lib/runRefresh.js` is the shared body of both endpoints; `refreshWeatherData(…, { onlyCarried: true })`.)

4. **The refresh itself moved to GitHub Actions** (`.github/workflows/refresh-weather.yml`, **every 3 hours**, plus a manual "Run workflow" button). Probing Open-Meteo showed the real limit: it weights a multi-location request by its location count, so the *first* 300-city batch succeeds and every later one is rejected for the rest of that minute — a 1,932-city refresh needs several minutes of pacing, which a 60-second Vercel Hobby function can never have. The Actions job runs the paced local script (`scripts/refreshWeatherCache.mjs`: 100-city batches, 25 s apart, 65 s back-off, 6 attempts), then commits cache + snapshot + index authored as the repository owner (Vercel Hobby only deploys team members' commits). The Vercel crons stay as a fallback. Net effect: the map is never more than ~3 hours old, and carried-forward counts should be 0 on a normal run.

**State colour = median, not mean (31 Aug):** a state's heat index on the map is the *median* of its cities' live temperatures — if half of a state's cities are at ≥ 30 °C the state is MODERATE (yellow) even when a few cold hill stations drag the average below 30, and it only turns HIGH (orange) once half its cities are ≥ 35 °C. The side panel tile is "MEDIAN TEMP · N cities" with a tooltip explaining it; the map tooltip says "live median of N cities". (`liveStateHeatIndex` in `src/App.jsx`.)

Not changed: the 6-tier map colour scale (LOW < 25 · LOW-MODERATE 25–30 · MODERATE 30–35 · HIGH 35–40 · VERY HIGH 40–45 · EXTREME 45+). With afternoon data the same scale now paints Rajasthan/MP in the moderate/high yellows and oranges it should.

### 8.16 AGNI: India-only scope, real rankings, and a model chain (1 Sep 2026)

**The bug (user test):** "which city has the best AQI in the entire world?" → "The city of Delhi has the best AQI in the entire world" (twice); and "BhaskarOps' current cache only includes cities in Delhi". Three causes, three fixes:

1. **Ranking questions had no data.** The context builder only attached cities/states *named* in the question; "which city has the best AQI" names none, so the model was left with the selected city as its only data point and crowned it. Now any superlative/ranking or world/global question gets an **INDIA-WIDE RANKING** block computed from the cache (best/worst AQI, hottest/coolest — top 5 each, with a note about ties), and state summaries gained a "best (cleanest) AQI" line. (`src/utils/agniLocationContext.js`)
2. **An empty cache was silent.** If the bulk city cache was not in memory (map-screen load failed, or AGNI opened before it finished) the builder returned nothing, and the prompt implied the selected city was the whole dataset. The AGNI panel now awaits a lazy, retrying loader (`ensureBulkWeatherCache()` in `src/utils/bulkWeatherCache.js`) before building context, and if the cache is still empty the context says **CITY CACHE NOT LOADED** explicitly.
3. **No geographic-scope rule.** New non-negotiable section in the system prompt (`api/_lib/askAI.js`): India-only data; never a global/international claim or India-vs-world comparison; superlatives only when the ranking/state summary says so; the selected city is never a default answer; repeating a question doesn't change grounding.

The identical repeated answer was not a canned reply (the only template is the labelled offline "why is it hot" fallback) — same prompt, same missing data, same guess. With the ranking in context the answers are data-grounded and vary in wording.

**Verified with real conversations (local key, same prompt as production):** from Delhi, Mumbai, Chennai, Jaipur, Bengaluru and Kolkata starts — "best AQI in the entire world" → "I only have data for Indian cities, so I can't compare globally… within India the cleanest air is tied: Noklak, Munsiari (AQI 17)…"; "which Indian city currently has the best AQI" → the same five, tie acknowledged; "AQI in Gujarat" → worst Lunawada 68 / cleanest Savarkundla 40; "hottest city on earth" → declined globally, Musiri 39 °C within India; repeat question → different wording, same grounded content.

**Quota finding — important for the demo:** the Gemini free tier allows **20 requests per day** on `gemini-2.5-flash` (`generate_content_free_tier_requests, limit: 20`). AGNI now tries a **model chain** — `gemini-3.5-flash-lite → gemini-3.1-flash-lite → gemini-2.5-flash → gemini-3.5-flash → gemini-flash-lite-latest` — moving to the next model on a 429 (quota/rate), 503 (overload) or 404 (retired model), each with its own free-tier budget. Override with the server env var `GEMINI_MODELS="a,b,c"`. For judging day a paid-tier key is still the safe choice.

### 8.16 One-hour pass (1 Sept 2026): live grid, recommended plan, Lite mode, cache retry

- **Analysis heatmap grid + Interventions preview run on the live temperature.** Base = the selected city's live current temperature → else the state's live median → only then the illustrative seed; a line under the grid heading says which (`grid-base`) and that the ±2 °C cell-to-cell variation is an illustrative intra-city pattern, not measured. Verified: Anand Vihar Overview 28 °C → grid average 27.9 °C (was a 44 °C grid under a 27 °C Overview).
- **Recommended plan (Interventions tab):** the city's vegetation share from ESA WorldCover (own point, or the nearest classified city — labelled with the distance) against the **30 % canopy target of the 3-30-300 urban-forestry rule** (Konijnendijk, 2021); shows the percentage points to add, a cool-roof share sized to the built-up fraction, the projected cooling from the same illustrative slider model, and an **Apply recommended plan** button that sets the sliders. Caveat printed on the card: WorldCover's "vegetation" lumps trees, grass and cropland over a ~10 km box, while the rule is about neighbourhood tree canopy — so the gap shown is a minimum. (Anand Vihar reads 47 % because its nearest classified point is central Delhi's box; a local tree survey would show far less.)
- **Lite mode** (`src/utils/liteMode.js`, `html[data-lite]`): auto-on for ≤ 3 GB memory, ≤ 2 cores, Save-Data or 2G/3G; switchable from the avatar menu / ☰ drawer, remembered per browser. No WebGL globe on sign-in, states-only map (the 594-district layer is skipped — SVG paths drop from ~630 to ~170), and CSS drops blur / shadows / animations. Data and labels unchanged.
- **Cache load retries** 3× with backoff before the map is declared cache-less.

---

## Bonus: Things that are built but not currently used (orphaned code)

While exploring the codebase, these 4 files turned up fully written but not imported/rendered anywhere:
- `src/components/Card3D.jsx` — a generic 3D-tilt card wrapper
- `src/components/SkeletonLoader.jsx` — loading shimmer placeholders
- `src/components/RuralBaselinePanel.jsx` — rural-vs-urban heat comparison (uses live data, looks fully functional — likely already built for a future feature)
- `src/utils/exportUtils.js` — CSV/PDF/WhatsApp export functions

These aren't "bugs" — they just haven't been wired into any tab/component yet. If you want to activate any of them later, it's just a matter of importing them in `App.jsx` and rendering them in the right place.
