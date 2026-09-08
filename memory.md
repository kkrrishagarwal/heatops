# BhaskarOps Memory

## 1. Project Identity
BhaskarOps is the India-focused urban heat intelligence platform built to monitor, compare, and mitigate heat risk across cities and states.

## 2. Core Product Lens
This project is not simply a weather dashboard. It is a planning and decision-support system that combines:
- live climate and AQI monitoring
- geospatial heat context
- land-cover and urban morphology understanding
- city-to-city comparison
- intervention simulation
- AI explanation and recommendations

## 3. Core Technical Facts (as of 1 Sept 2026)
- Frontend: React 18 + Vite, deployed on Vercel at https://heatops.vercel.app; the Flask app is a legacy prototype, not deployed
- Coverage: 1,956 cities / 28 states + 8 UTs; 1,932 with validated coordinates and live readings; 24 hamlet names honestly blank
- Data: Open-Meteo (weather, AQI, geocoding), ESA WorldCover 10 m (171 cities, incl. tree canopy = class 10), OSM Overpass + Nominatim, a published MODIS dataset for the ML model
- Refresh: GitHub Actions every 3 h (pending `workflow` scope) + laptop cron stopgap every 3 h + Vercel Cron 14:30 IST + 16:00 IST retry (silent 2–4 Sept); every run commits the cache and a daily history snapshot (69+ days kept)
- Smart Mitigation Planner (8 Sept): `src/utils/mitigationPlanner.js` (engine, ASSUMPTIONS) + `src/components/MitigationPlanner.jsx`, opened from the state panel (Authority); Authority-first sign-in. Facilities counts via `scripts/fetchOsmFacilities.mjs` (Overpass rate-limits; re-run to fill)
- Satellite: NASA MODIS MOD11A1 LST via AppEEARS is in the app (1,912 cities, daily since 1 Mar 2026; `scripts/processModisLst.mjs` → `public/data/modis-lst/`; `SatelliteLstPanel` on the Analysis tab; AGNI grounded on it). 2016–2026 for 171 cities still processing at NASA; a peak-season (May–mid-June, 2016–2026) insurance request is the fallback; MOSDAC still pending
- UI: lucide icon set, overline headings, Archivo numerals (4 Sept redesign) — no emoji chrome, no fabricated panels (wind is live; pollen removed)
- Map colour: plurality risk category of a state's live cities (ties → more severe); median temperature kept as the headline number and detail; opening a state refreshes its cities live
- Modes: Citizen / Authority × Mobile / Laptop; opt-in Lite mode for low-end devices
- AGNI: Gemini behind a serverless proxy, India-only scope, "(estimated)" tagging, 5-model fallback chain; free tier ≈ 20 requests/day per model
- Languages: English + 10 Indian languages

## 4. Design and Product Truths
- Real data is more valuable than simulated polish.
- Honest limitations build trust.
- The app must explain heat drivers, not just temperature values.
- Actionability matters more than static storytelling.
- A user should be able to move quickly from geographic selection to decision support.

## 5. Product Lessons Learned
- Users expect a map-first experience, not a raw dataset view.
- Local context and language support matter for usability in India.
- AI is best used as a guide and explainer, not as a black-box authority.
- Freshness and source transparency are critical to credibility.
- Simulated values should be avoided; estimated values must be labeled. Enforced in code: "NO LIVE DATA" badges, carried-forward flags, grid base-temperature line, "baseline" labels, "(estimated)" tags.
- Auto-detection that silently changes the look (Lite mode from memory/core counts) is a mistake — make such things opt-in.
- The 30 % canopy target (3-30-300 rule) is about tree canopy; ESA "vegetation" (trees + grass + crops) overstates it several-fold in Indian cities, so measure tree cover specifically.

## 6. Operational Notes
- Live refresh jobs keep weather cache content current (see PROJECT_EXPLAINED.md §8.9, §8.15 and REFRESH_BEFORE_JUDGING.md).
- GeoJSON and cached data files are core project assets.
- The system architecture should be built to handle national coverage without sacrificing responsiveness.

## 7. Strategic Direction
BhaskarOps should continue to evolve toward a stronger public-interest climate operations tool by improving:
- real-time data automation
- high-resolution urban heat mapping
- clear climate adaptation workflows
- policy-relevant intervention simulations

## 8. Final Product North Star
BhaskarOps should remain a platform that helps people understand the why behind urban heat and turn that understanding into practical mitigation decisions.
