# PROJECT_EXPLAINED.md

> This file is for you to read yourself — a beginner-friendly guide to the entire BhaskarOps codebase.
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
│   ├── hooks/
│   │   └── useWeather.js          — The shared hook for fetching live weather data — caching + retry + offline-fallback all live here
│   ├── utils/                     — Pure logic/helper functions (no UI) — data fetching, math, formatting
│   │   ├── weatherAPI.js          — Fetches REAL live weather+AQI from Open-Meteo (for one city, on demand)
│   │   ├── realData.js            — ⚠️ ILLUSTRATIVE/SEEDED data (not real) — details in Section 7
│   │   ├── dashboardUtils.js      — Map math + login/auth localStorage helpers
│   │   ├── cityCoordinateResolver.js — Finds a city's lat/lon (exact match or fallback)
│   │   ├── lulcFallback.js        — "Nearest real city" fallback logic for land-cover data
│   │   ├── osmUtils.js            — Fetches live building-density from OpenStreetMap
│   │   ├── istClock.js            — An always-correct India time clock
│   │   ├── exportUtils.js         — CSV/PDF/WhatsApp export functions — ⚠️ **currently not used anywhere** (dead code)
│   │   └── 3d-effects.js          — Visual polish effects (card tilt, particles) — for App3D/Card3D
│   ├── data/
│   │   └── cityCoordinates.json   — Real lat/lon lookup for 1,689 cities (geocoded offline)
│   └── i18n/                      — Translation files for 11 languages (react-i18next setup)
│
├── api/                           — Vercel serverless functions (production backend)
│   ├── ask-ai.js                  — Backend proxy for AGNI chat (the Gemini API key lives here)
│   ├── refresh-weather-cache.js   — The daily cron hits this — refreshes weather for all cities
│   └── _lib/                      — Logic shared between the two functions above (askAI.js, refreshWeatherData.js, githubCommit.js)
│
├── netlify/functions/             — Same AGNI proxy, for Netlify deploys (if Netlify is used instead of Vercel)
│
├── scripts/                       — Standalone Node/Python scripts — run manually or via cron, the app itself never runs these
│   ├── refreshWeatherCache.mjs    — Bulk weather refresh (local/manual run)
│   ├── weatherCacheDaemon.mjs     — Runs the one above in a loop every 20 min (for local dev)
│   ├── geocodeCities.mjs          — Builds src/data/cityCoordinates.json
│   ├── train_lst_model.py         — Trains the ML model (real MODIS data, but non-Indian cities)
│   ├── build_lulc_data.py         — Pulls real land-cover data from ESA WorldCover
│   └── build_lst_insat.py         — ISRO INSAT satellite pipeline — ⚠️ **not active yet**, pending MOSDAC approval
│
├── public/
│   ├── data/                      — All REAL data files the browser fetches (geojson maps, ML model output, LULC output, city coords)
│   └── live-weather-cache.json    — Daily-refreshed bulk weather cache (all ~2,050 cities, powers the map/ticker)
│
├── app.py, static/, templates/, requirements.txt, .venv/  — ⚠️ LEGACY Flask prototype, not used in production
├── vercel.json                    — Deploy config + daily cron schedule
├── netlify.toml                   — Netlify deploy config
└── package.json                   — Dependencies + build scripts (npm run dev/build)
```

---

## 3. DATA FLOW — SIMPLE VERSION

Here's what happens, step by step, when a user opens the app:

1. **The sign-in screen appears** (`LaunchScreen.jsx`) — with a 3D globe. Login/register happens purely in `localStorage` (there's no real database — this is demo-level auth, not real user accounts).

2. **After sign-in, the map screen appears** (the `IndiaMap` component inside `App.jsx`). At this point, `public/live-weather-cache.json` gets fetched in the background — a file that already has the current temperature, rain-chance, AQI, cloud-cover, and PM10 stored for all ~2,050 cities (because fetching all 2,050 cities live would be far too slow).

3. **Where does this cache come from?** Every night, a Vercel cron job (`"0 0 * * *"` in `vercel.json`) triggers `api/refresh-weather-cache.js`. This function fetches fresh data for every city from Open-Meteo, and — since serverless functions can't save files persistently — commits the result straight to GitHub via `githubCommit.js`, which automatically triggers a new deploy. That's why the map shows "Heat data loaded X min ago."

4. **When a user clicks a state/city**, `App.jsx` does two things for that city in parallel:
   - Fetches **real-time live weather** via the `useWeather()` hook (directly from Open-Meteo, just for this one city — fresher than the bulk cache)
   - Also pulls an **illustrative baseline** from `getCityData()` (which is NOT real — see Section 7) — used only for cosmetic/demo features

5. **The dashboard's 5 tabs open up**: Overview (live weather+AQI), Analysis (satellite indices, ML model, land cover), Compare (multi-city radar chart), Interventions (cooling sliders + physics + cool-roof calculator), AI+Export (AGNI chat + download/share).

6. **When someone asks AGNI a question**, the browser doesn't call Google Gemini directly (that would expose the API key) — it calls `/api/ask-ai` (a Vercel function), which calls Gemini on its own and sends the answer back.

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
| **India map (colors, layers, zoom/pan)** | `src/App.jsx` — search for `IndiaMap`, `DistrictsLayer`, `WeatherOverlayLayer` |
| **Heat-index color logic (which state gets which color)** | `src/App.jsx` — search for `getHeatIndexColor` |
| **Weather-condition overlay (rain/dust/cloud tint+icons)** | `src/App.jsx` — search for `WeatherOverlayLayer`, `WeatherOverlayIcons`, `liveStateWeatherCondition` |
| **Live weather (temp, humidity, forecast) for one city** | `src/utils/weatherAPI.js` + `src/hooks/useWeather.js` + UI: `src/components/WeatherCard.jsx` |
| **AQI calculation/category** | `src/utils/weatherAPI.js` (function `getAQICategory`) |
| **Bulk weather cache (all cities, for the map/ticker)** | `scripts/refreshWeatherCache.mjs` (local) / `api/refresh-weather-cache.js` (production cron) → output: `public/live-weather-cache.json` |
| **ML model (LST prediction)** | Train: `scripts/train_lst_model.py` → Output: `public/data/ml_model_real.json` → Display: `src/components/MLModelPanel.jsx` |
| **Land cover (vegetation/built-up/water %)** | Build: `scripts/build_lulc_data.py` → Output: `public/data/lulc_real.json` → Display: `src/components/LandCoverPanel.jsx` + fallback logic: `src/utils/lulcFallback.js` |
| **Intervention sliders (cool roof/greening/water)** | `src/App.jsx` — search for `roofSlider`, `treeSlider`, `waterSlider` (Interventions tab) |
| **Cool Roof ROI calculator** | `src/components/CoolRoofCalculator.jsx` |
| **Physics explanations (formulas)** | `src/components/PhysicsPanel.jsx` |
| **AGNI AI chatbot (frontend)** | `src/components/AIAnalystPanel.jsx` (main chat UI) + `src/components/FloatingAIAssistant.jsx` (floating bubble wrapper) |
| **AGNI AI chatbot (backend/prompt)** | `api/_lib/askAI.js` (system prompt + Gemini call) → entry points: `api/ask-ai.js` (Vercel), `netlify/functions/ask-ai.js` (Netlify) |
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

---

## 7. WHAT'S REAL DATA VS WHAT'S ESTIMATED/STATIC

### ✅ Real / Live (comes from an actual source)
- **Live weather, humidity, wind, forecast, AQI (per-city)** — Open-Meteo API (`src/utils/weatherAPI.js`)
- **Bulk cache (temp/rain/AQI/cloud/PM10 for ~2,050 cities)** — Open-Meteo, refreshed daily (`public/live-weather-cache.json`)
- **Land cover % (vegetation/built-up/water)** — ESA WorldCover 10m satellite data (`public/data/lulc_real.json`), direct for representative cities only; other cities use a "nearest real city" fallback (honestly labeled)
- **Building density** — a live OpenStreetMap Overpass API call (`src/utils/osmUtils.js`)
- **ML model metrics (R², feature importance)** — a genuinely trained Random Forest, on real MODIS satellite training data — **but ⚠️ the training data is from non-Indian cities (20 global cities)**, and this is disclosed in the UI too
- **Map boundaries** — real GeoJSON state/district shapefiles
- **AGNI's answers** — a real, live Gemini API call (if it's offline, a clearly-labeled canned fallback shows instead)
- **City coordinates** — real geocoded lat/lon (1,689 cities), from Open-Meteo's geocoding

### ⚠️ Estimated / Fallback (derived from a real source, but not a direct measurement)
- **Land-cover for non-representative cities** — borrows the nearest real city's data, labeled as an estimate/with the distance shown
- **Building density when Overpass fails** — shows "unavailable," never fakes a number
- **ML model applied to any Indian city** — the model itself is real, but since it's trained on non-Indian data, its predictions for Indian cities should be treated as a "generalization estimate"

### ❌ Static / Illustrative (fabricated, not a real measurement)
- **`src/utils/realData.js` (`STATE_DATA`, `getCityData()`)** — this file's own comments say it's "illustrative, NOT a real data pipeline." City-level LST/NDVI/NDBI/NDWI numbers are generated from a formula (a seed built from the letters of the city's name) — the same city always gets the same number, but that number never came from a satellite or sensor. It's only used for: the dashboard's theme color, the "what-if" heat simulator, the City Compare panel's LST/NDVI/NDBI/NDWI, and the Spatial Recommendation's area/cost estimate.
- **The Physics panel's formulas/cost estimates** — educational content, cited but static, not live
- **The Cool Roof calculator's cost coefficients** — reference numbers cited from real Indian pilot programs (Ahmedabad/Telangana), but they're static constants, not a live pricing feed

**A simple rule of thumb the codebase itself follows:** wherever the UI shows a "Source: ..." badge (the `DataBadges.jsx` component), that number is real. Wherever there's no badge (like some Compare-panel fields, or the what-if simulator), it's the illustrative data from `realData.js`.

---

## Bonus: Things that are built but not currently used (orphaned code)

While exploring the codebase, these 4 files turned up fully written but not imported/rendered anywhere:
- `src/components/Card3D.jsx` — a generic 3D-tilt card wrapper
- `src/components/SkeletonLoader.jsx` — loading shimmer placeholders
- `src/components/RuralBaselinePanel.jsx` — rural-vs-urban heat comparison (uses live data, looks fully functional — likely already built for a future feature)
- `src/utils/exportUtils.js` — CSV/PDF/WhatsApp export functions

These aren't "bugs" — they just haven't been wired into any tab/component yet. If you want to activate any of them later, it's just a matter of importing them in `App.jsx` and rendering them in the right place.
