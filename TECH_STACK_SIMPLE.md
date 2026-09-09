# BhaskarOps — Tech Stack, the Simple Version

*For teammates answering "what is it built with?" Every answer fits in one breath. Live site: https://heatops.vercel.app (10 September 2026).*

---

## The one-line answer

**A React website, served by Vercel, that reads live weather from Open-Meteo, satellite data from NASA and ESA, and asks Google Gemini questions through our own small server function. No database, no paid service, zero rupees a month.**

---

## If they ask "what is the frontend?"

| Question | Answer |
|---|---|
| Language | JavaScript (React 18), built with Vite |
| The map | react-simple-maps + d3 — draws India from GeoJSON files (28 states, 8 UTs, 594 districts) |
| Charts | Recharts |
| Icons | lucide-react (vector icons, no emoji) |
| Languages | react-i18next, 11 Indian languages in `src/i18n/locales/` |
| Login | Local to the browser (localStorage) — a demo login, no accounts on a server |
| Where the code is | One main file `src/App.jsx` (~6,000 lines) + 25 components in `src/components/` |

**One line:** "React with Vite; the map is react-simple-maps on GeoJSON; charts are Recharts; 11 languages with i18next."

---

## If they ask "what is the backend?"

| Question | Answer |
|---|---|
| Server | Vercel serverless functions in `api/` — four small Node.js files |
| `api/ask-ai.js` | AGNI: sends the question plus real city data to Google Gemini; the API key stays on the server |
| `api/weather-history.js` | Serves the daily archive for the 30-day trend |
| `api/refresh-weather-cache*.js` | Vercel cron refresh (backup path) |
| Database | **None.** Everything is JSON files in the repo (`public/`), rebuilt by a script |

**One line:** "Four serverless functions on Vercel and JSON files — no database."

---

## If they ask "where does the data come from?"

| Data | Source | How fresh |
|---|---|---|
| Live temperature, forecast high, AQI, rain, cloud | **Open-Meteo** (free API) | Rebuilt every hour by day, every 3 h at night, by a GitHub Actions job; the browser also refreshes the opened city and state live |
| Satellite surface temperature | **NASA MODIS MOD11A1** (Terra, 1 km) via NASA AppEEARS | 1,912 cities daily since March 2026; 171 cities every day 2016–2026 |
| Land cover, tree canopy, built-up share | **ESA WorldCover 10 m** (2021) | Static, 171 cities |
| Buildings, schools, hospitals | **OpenStreetMap** (Overpass API) | Live for buildings; counts pre-fetched for facilities |
| Elevation | **SRTM 30 m** via Open-Meteo | Static |
| Map boundaries | GADM GeoJSON, simplified with mapshaper | Static |

**One line:** "Open-Meteo for live weather, NASA MODIS for satellite heat, ESA WorldCover for land cover, OpenStreetMap for buildings — all free and open."

---

## If they ask "how does the data refresh itself?"

1. A **GitHub Actions** workflow (`.github/workflows/refresh-weather.yml`) runs `scripts/refreshWeatherCache.mjs`.
2. The script asks Open-Meteo for all 1,932 cities in batches, marks any city it could not reach as "carried forward" (never guesses).
3. It commits `public/live-weather-cache.json` and a daily snapshot to GitHub.
4. The commit makes Vercel rebuild the site. Done — no server of ours is ever running.

**One line:** "A GitHub Actions job refreshes the data and commits it; Vercel redeploys automatically."

---

## If they ask "what is the AI?"

- **AGNI** = Google **Gemini** behind our proxy (`api/ask-ai.js`).
- It is **grounded**: we attach the selected city's real numbers, any city named in the question, an India-wide ranking, and the NASA satellite summary. It answers from those, refuses world questions, and tags anything not measured as "(estimated)".
- Five Gemini models in a fallback chain, so a quota limit on one does not stop the demo.

**One line:** "Gemini through our own server function, grounded on the city's real data."

---

## If they ask "what is the ML model?"

- A **Random Forest** (scikit-learn, Python, trained offline) on a published MODIS dataset of 20 global cities.
- It is a **research prototype**, not the source of any number in the app. We show its honest scores: R² 0.95 on the test split and **−0.39 on cities it has never seen**.

**One line:** "A scikit-learn Random Forest prototype whose weak score we print next to its good one."

---

## If they ask "how is the Smart Mitigation Planner computed?"

- Pure JavaScript in the browser (`src/utils/mitigationPlanner.js`), no server.
- Each city gets a 0–100 risk score from forecast high + NASA season peak + built-up share − tree canopy.
- The budget is spent greedily on "packages" (100 roofs, 1 ha of trees, a cooling centre…) by projected risk-points per rupee.
- Every unit cost is a printed assumption; the cool-roof rate comes from the Ahmedabad 2017 pilot.

**One line:** "A deterministic optimiser in the browser: rank cities, then spend where each rupee removes the most projected risk."

---

## If they ask "how is it hosted and what does it cost?"

- **GitHub** (code) → **Vercel** (hosting, free Hobby tier, auto-deploy on push).
- Cost: **₹0 / month**. No servers, no paid APIs, no database.

---

## If they ask "how do you test it?"

- **Playwright** browser tests run against localhost and again against the live site after every deploy: login → map → state → city → each panel, reading the numbers back.
- Build: `npm run build` (Vite). Dev: `npm run dev`.

---

## Numbers to keep in your head

| | |
|---|---|
| Cities | 1,956 listed, 1,932 with live readings |
| States/UTs | 28 + 8, 594 districts on the map |
| Languages | 11 |
| Satellite readings | 528,421 quality-passed (2016–2026) |
| Serverless functions | 4 |
| Monthly cost | ₹0 |

---

*Longer versions: `PROJECT_EXPLAINED.md` (how everything works), `architecture.md` (diagrams), `JUDGES_BRIEF.md` (pitch + Q&A).*
