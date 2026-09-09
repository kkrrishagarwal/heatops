# BhaskarOps Architecture

## 1. Overview
BhaskarOps is a multi-layer application designed to collect, process, visualize, and explain urban heat risk across India. The system combines a front-end dashboard, backend AI proxy, scheduled data refresh jobs, and externally sourced climate/satellite datasets.

## 2. High-Level Architecture

```mermaid
flowchart LR
    U[User Browser] --> FE[React 18 + Vite SPA]
    FE -->|direct fetch| EXT[Open-Meteo weather · AQI · geocoding\nOSM Overpass]
    FE -->|static| CACHE[public/live-weather-cache.json\n1,932 cities]
    FE -->|static| GEO[GeoJSON 35 state/UT + 594 district boundaries\nlulc_real.json · ml_model_real.json]
    FE -->|POST| AI[/api/ask-ai · Gemini proxy\n5-model fallback chain]
    AI --> GEMINI[Google Gemini]
    JOB[GitHub Actions every 3 h\n+ Vercel Cron 14:30 IST + 16:00 retry] --> REFRESH[refreshWeatherData]
    REFRESH --> COMMIT[Git Data API commit:\ncache + data/history/DATE.json + index]
    COMMIT --> DEPLOY[Vercel auto-redeploy] --> CACHE
    COMMIT --> HIST[/api/weather-history · history.html · CSV]
    SCRIPTS[Offline scripts: geocodeCities · build_lulc_data · train_lst_model] --> GEO
```

Status (1 Sept 2026): everything in this diagram is deployed at https://heatops.vercel.app except the GitHub Actions job, which is written (`.github/workflows/`) and waiting for a token with the `workflow` scope to be pushed. Full plain-language detail lives in `PROJECT_EXPLAINED.md` (§8 is the change log).

## 3. Frontend Layer
### Stack
- React 18
- Vite
- Recharts
- react-simple-maps
- i18next
- Three.js / react-globe.gl

### Responsibilities
- Render India map and state/city drill-down interactions (state colour = the plurality risk category of its cities' live readings (ties → more severe), median temperature shown as detail; weather-condition badges per state; opening a state refreshes its cities live in one batched call)
- Two independent modes: audience (Citizen / Authority) × layout (Mobile / Laptop); opt-in Lite mode for low-end devices (no WebGL globe, states-only map, no blur/animations)
- Display live weather, AQI, and forecast cards
- Surface heat-risk categories and visual scores
- Run comparison and intervention planning workflows
- Provide AI analyst chat experience
- Support multilingual interface rendering

### Key Modules
- App entry and orchestration in `src/App.jsx`
- Weather and live data hooks in `src/hooks/useWeather.js`
- Data utilities in `src/utils/`
- UI components such as `WeatherCard.jsx`, `AIAnalystPanel.jsx`, `MLModelPanel.jsx`, and `SpatialRecommendation.jsx`

## 4. Backend and API Layer
### Flask application (legacy — not deployed)
`app.py`, `templates/` and `static/` are the original prototype and are not part of the production deployment. Everything the browser needs is static files plus the serverless functions below.

### Serverless / proxy layer
Serverless functions under `api/` (Vercel) and `netlify/functions/` (mirror):
- `api/ask-ai.js` — AGNI proxy: Gemini key server-side, rate limit per client, system prompt with grounding rule, India-only geographic scope, "(estimated)" tagging, conversation memory; five Gemini models tried in order on quota/overload
- `api/refresh-weather-cache.js` — the daily full refresh (14:30 IST); `api/refresh-weather-retry.js` — the 16:00 IST retry pass for rate-limited batches
- `api/weather-history.js` — `GET /api/weather-history?city=&state=&days=` from the bundled daily snapshots
- `api/_lib/githubCommit.js` — multi-file commits through GitHub's Git Data API

## 5. Data Flow
### 5.1 Weather and AQI data
- Open-Meteo provides current weather and air-quality data for 1,932 geocoded cities (coordinates validated to lie in their own state; Open-Meteo → OSM Nominatim → spelling aliases; 24 hamlet names honestly blank).
- The bulk cache is refreshed by the scheduled jobs and committed to the repo together with a compact daily history snapshot; readings a batch could not refresh are carried forward and flagged (`isCarriedForward`, real `observedAt`).
- The selected city is always fetched live; opening a state refreshes all its cities in one batched call (10-minute memory) so list, state median and map colour agree.

### 5.2 Geo and land data
- India district/state GeoJSON files under `public/data/`
- Geo features are used for map rendering and city-localization logic.
- NASA MODIS MOD11A1 satellite land-surface temperature (daily, 1 km) via Earthdata/AppEEARS: `scripts/processModisLst.mjs` converts the raw point-sample CSVs (git-ignored, ~70 MB each) into `public/data/modis-lst/` (one index + one file per state, QC-filtered, °C); `SatelliteLstPanel` shows it on the Analysis tab beside the live air reading, for 1,912 cities since 1 March 2026. The 2016–2026 record for 171 cities is in (yearly Apr–Jun means and hottest day per year, per state file).
- Land-cover metrics come from ESA WorldCover 10 m (2021) classified offline for 171 cities (`build_lulc_data.py`: built-up, vegetation, water, and tree canopy = class 10 alone); other cities borrow the nearest classified city, labelled with the distance. Building density is a live OSM Overpass query.

### 5.3 AI analysis
- Client sends natural-language queries to the serverless proxy.
- Proxy reads the secure Gemini API key on the server side.
- The browser attaches real cached readings for any city/state named in the question, plus an India-wide ranking block (best/worst AQI, hottest/coolest) for superlative questions; the prompt forbids global/international claims and any figure not in context is tagged "(estimated)".

## 6. Storage and Refresh
### Local project storage
- `public/data/` stores district, state, and derived data.
- `public/live-weather-cache.json` holds cached weather snapshots used by the app and refresh jobs.

### Refresh pipeline
- GitHub Actions every 3 hours (written; pending the owner's `workflow` scope), a laptop-cron stopgap (`scripts/localAutoRefresh.sh`, every 3 h while the dev machine is on), plus Vercel Cron at 14:30 IST with a 16:00 IST retry pass (silent 2–4 Sept); every run commits `live-weather-cache.json` + `public/data/history/YYYY-MM-DD.json` + `index.json` in one commit, which triggers the redeploy.
- 65+ days of daily snapshots are kept in-repo (optional Postgres mirror coded, paused); `scripts/exportWeatherHistory.mjs` writes them to CSV.

## 7. Security and Trust Model
- API keys are kept server-side and never exposed in the client bundle.
- Synthetic or estimated values are clearly marked instead of being masqueraded as exact live metrics: cities without a reading say "NO LIVE DATA" (never a guessed number), carried-forward readings are flagged, the Analysis grid states its base temperature and that its cell pattern is illustrative, state-panel NDVI/NDBI are labelled "baseline", and the ML model shows its weak unseen-city R² next to the good one.
- Data provenance is tied to underlying providers such as Open-Meteo, OSM, ESA WorldCover, and ML prediction outputs.

## 8. Scalability and Operation
- Frontend is optimized for responsive map interaction and chart rendering.
- Caching limits repeated weather fetches and reduces latency.
- The system supports national coverage with modular fetch-and-refresh patterns.
- Scheduled jobs decouple live data freshness from UI rendering.

## 9. Architectural Principles
- Real data over placeholders
- Honest disclosure over false precision
- Server-side secrets over browser exposure
- Actionability over simple visualization
- India-first context and language inclusion

## 10. Notable Architectural Decisions
- Use React for a highly interactive dashboard experience.
- Keep AI access behind a backend proxy for security and control.
- Store refreshed weather snapshots in a simple JSON cache for rebuild and redeploy workflows.
- Keep geospatial datasets local or cached to ensure quick map interactions.
- Use modular utility files to separate business logic from views.
