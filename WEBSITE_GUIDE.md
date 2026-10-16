# BhaskarOps — Complete Website Guide

Everything the website does, screen by screen, with where each number comes from.
Written from the code as it stood on 14 October 2026, not from the older docs in this folder.

- **Live site:** https://heatops.vercel.app
- **Local:** `npm run dev` → http://localhost:5173
- **Stack:** React 18 + Vite, Tailwind/CSS, react-simple-maps + d3 (map), Recharts (charts), react-globe.gl (login globe), i18next (11 languages), Vercel serverless functions (AI chat, weather history, cache refresh).

**Contents**

1. [What the product is](#1-what-the-product-is)
2. [Screen flow](#2-screen-flow)
3. [Sign-in and accounts](#3-sign-in-and-accounts)
4. [Top navigation bar](#4-top-navigation-bar)
5. [Map screen](#5-map-screen)
6. [City dashboard](#6-city-dashboard)
7. [AGNI, the AI assistant](#7-agni-the-ai-assistant)
8. [Profile and admin screens](#8-profile-and-admin-screens)
9. [Modes, languages and URL parameters](#9-modes-languages-and-url-parameters)
10. [Where the data comes from](#10-where-the-data-comes-from)
11. [Every formula and threshold](#11-every-formula-and-threshold)
12. [Backend, deployment and environment](#12-backend-deployment-and-environment)
13. [Real vs estimated vs hardcoded](#13-real-vs-estimated-vs-hardcoded)
14. [What works without internet](#14-what-works-without-internet)
15. [Known gaps and loose ends](#15-known-gaps-and-loose-ends)
16. [File map](#16-file-map)

---

## 1. What the product is

BhaskarOps (earlier name: HeatOps) is an urban-heat monitoring and planning site for India. It shows live air temperature and air quality for 1,932 cities across all 36 states and UTs, satellite surface temperature from NASA MODIS, land cover from ESA WorldCover, and a budget planner that recommends where to spend on cooling measures.

- **BHASKAR** = Bharat Heat Analysis, Surveillance, Knowledge & Assessment Resource. **OPS** = Optimization & Planning System.
- **Two audiences.** *Authority* (officials, planners) gets the full technical dashboard. *Citizen* gets a plain-language view: temperature, risk word, air quality, what to do today. Authority is the default.
- **Design rule used throughout:** a number that is not measured is labelled "(estimated)", "illustrative" or "NO LIVE DATA". The site does not invent a reading for a city it has no data for.

---

## 2. Screen flow

```
Launch screen (sign in / register)
        │  success → 2-second "CONNECTING TO SATELLITES…" loader
        ▼
Map screen  ──click state → pick city → "Analyze"──►  City dashboard
   │                                                    │
   └── avatar menu ──► Profile                          └── "← Back to Map"
```

| Screen | What it is |
|---|---|
| Launch | Rotating globe, starfield, sign-in/register card |
| Map | India heat map on the left (58%), info panel on the right (42%) |
| Dashboard | Tabbed analysis of one city |
| Profile | User card, current view, points, recent sign-ins |
| Admin | Login analytics charts (not reachable from the UI, see §8) |

The map stays mounted while the dashboard is open, so going back is instant.

---

## 3. Sign-in and accounts

**Launch screen** ([src/components/LaunchScreen.jsx](src/components/LaunchScreen.jsx))

- Tabs: **Sign In** / **Register**. Fields: full name (register only), email, password, show/hide password.
- Validation: all fields required; email must look like `name@example.com`; password at least 6 characters.
- Register saves the account and switches to Sign In — it does not log the user in.
- Sign In checks the email exists and the password matches, then loads the app.
- The submit button is click-only; pressing Enter does nothing.

**How accounts are stored:** entirely in the browser's `localStorage` (`heatops_users`). There is no backend and no database. The password is stored as a simple 32-bit hash, which the code itself describes as "not real cryptographic security". Accounts exist only on the device and browser that created them.

**Logout** returns to a second, inner sign-in screen (animated wireframe globe), not the launch screen. That inner screen has "Remember me (30 days)" and a "Forgot password?" hint that shows a masked name in an alert. No email is ever sent.

---

## 4. Top navigation bar

Left to right on the laptop layout:

- **Brand:** 🛰️ BHASKAR OPS / THERMAL.
- **Status pills** (authority only): HEAT HIGH, CLIMATE EL NIÑO, SYSTEM OPS. These are fixed labels, not live.
- **Audience toggle:** 🧑 Citizen | 🏛️ Authority.
- **Layout toggle:** 📱 Mobile | 💻 Laptop.
- **Live clock** with weekday.
- **Language dropdown:** 11 languages.
- **🤖 AGENT ONLINE** badge (fixed label).
- **Avatar menu:** My Profile, My Badges, switch view, Lite mode on/off, Logout.
- **LOGOUT** button.

**Ticker bar** (authority view) scrolls eight items: Heat Leader, Peak City, AQI Alert, Climate, Sat Pass, Storm Watch, Mumbai, Shimla. A left badge reads LIVE, LOADING, CACHED (data older than 36 hours) or OFFLINE. Values turn red at AQI > 300, temperature ≥ 45 °C, or rain chance ≥ 80%. "Climate: El Niño Active", "Sat Pass: Next 16:45 IST" and "SAT ACTIVE" are fixed text.

**Citizen strip** (citizen view) replaces the ticker: 📍 city, 🌡️ temperature, a risk pill (Extreme/High/Medium/Low), air quality label, weather phrase, and one tip.

**Mobile layout:** brand, clock and a ☰ drawer holding layout, language, view switch, Lite mode, profile and logout.

---

## 5. Map screen

The Authority view on a laptop opens on the **Command Center** (§5.5); the classic map screen below is one click away ("Classic map") and is what citizens and phones see.

### 5.1 The map

- Drawn from local GeoJSON files (36 states/UTs, 594 districts, a separate official J&K/Ladakh boundary file). No map tile server is used.
- **Hover a state:** tooltip with the state's temperature, how it was derived ("live median of N cities…"), a risk badge, the reason for the colour, and the city count.
- **Click a state:** selects it and its first city; the right panel changes.
- **Zoom/pan:** mouse wheel, +/−/↺ buttons, drag. Zoom range 1× to 5×.
- **Search box:** "Search any city in India…" — at least 2 letters, up to 10 results, each with live temperature or "NO LIVE DATA". Clicking a result opens its dashboard.
- **Minimise/Maximise** collapses the map to a thin bar.
- **Weather badges** on states: dust (average PM10 ≥ 400 µg/m³), rain (rain chance ≥ 60%), cloud (cover ≥ 80%).
- **Island pills:** "Lakshadweep ↗" and "A&N Islands ↗" make the tiny UTs clickable.
- **Planner markers:** cities funded by the Mitigation Planner appear as rings labelled "City before→after".
- **Legend** (bottom-left, collapsed by default) and a **cache chip** (top-left) when data is loading, unavailable or stale.
- If the map files fail to load: an error message with a Retry button, not a blank screen.

### 5.2 How a state gets its colour

1. Take every city in the state that has a reading.
2. The **state temperature** is the median of those readings.
3. The **colour** is the risk bucket that the most cities fall into; a tie goes to the hotter bucket.
4. A state with no readings falls back to a hardcoded baseline and the tooltip says "(estimated)".

| Bucket | Air temperature |
|---|---|
| EXTREME | ≥ 45 °C |
| VERY HIGH | 40–45 °C |
| HIGH | 35–40 °C |
| MODERATE | 30–35 °C |
| LOW-MODERATE | 25–30 °C |
| LOW | < 25 °C |

Colours run red → orange → yellow from EXTREME down to LOW-MODERATE; only LOW (< 25 °C) is green. The legend, state badge, gauge and Hottest Cities dots use the same colours.

### 5.3 Right panel — no state selected

"Today's National Heat Summary":

- **Hottest city right now.**
- **Today's forecast high** (the highest forecast maximum in the country).
- **Heatwave watch:** how many cities are forecast ≥ 40 °C, with a callout at ≥ 45 °C. Labelled "same-day watch, not an official warning".
- **States in Extreme/High risk.**
- **Average national temperature.**
- **Quick Picks:** Delhi, Mumbai, Bengaluru, Jaipur, Chennai, Kolkata — one click to the dashboard.

### 5.4 Right panel — state selected

- State name and risk badge.
- **Smart Mitigation Planner** button (authority only) — see §6.6.
- The colour rule in words: "Map colour = the most common category among N cities".
- Tiles: median temperature, NDVI baseline, NDBI baseline, AQI. The NDVI/NDBI tiles are illustrative state baselines and say so in their tooltip.
- **City list:** searchable; each row shows the live temperature (green dot if under 15 minutes old) or "NO LIVE DATA". Select a city, then **🔥 Analyze {city}** opens the dashboard.
- Hottest Cities list, a heat legend, and Recent Sign-ins.

### 5.5 Command Center (authority, laptop)

File: [src/components/CommandCenterHud.jsx](src/components/CommandCenterHud.jsx). A map-centric layout with no page scroll: the India map fills the viewport and three translucent docks float over it.

- **Top bar:** city and its rank/risk badge, data freshness (LIVE / CACHED with age), IST clock, Citizen/Authority toggle, "Classic map", "Full dashboard →", Logout.
- **Left dock:** layer toggles — *Air temperature* (live Open-Meteo readings for 1,932 cities), *Surface temperature* (latest NASA MODIS clear-sky pass for 1,912 cities), *Built-up share* (ESA WorldCover, 171 cities); city search (defaults to Sri Ganganagar); the alert triage badge (temperature, activation level, feels-like, reasons); the 10×10 thermal grid with its "illustrative pattern" note.
- **Right dock:** the AI Heat Response Co-Pilot (§6.8) and the Heatwave Action Checklist.
- **Bottom scrubber:** *Historical* scrubs 2016–2026 and plots each year's April–June mean surface temperature for the 166 cities with a multi-year MODIS record (`public/data/modis-lst/yearly-peaks.json`, built by [scripts/buildModisYearlyPeaks.mjs](scripts/buildModisYearlyPeaks.mjs)); *Live Pass* scrubs the selected state's daily satellite passes (e.g. Rajasthan on 11 April 2026: 74 of 76 cities clear-sky) with the latest national pass at the left stop; *Forecast* scrubs the selected city's 7-day forecast while the map shows today's forecast highs nationally.
- Every overlay point is a real reading joined to a real coordinate; cloud-blocked days are gaps, not estimates. Lite mode turns the point overlays off.

---

## 6. City dashboard

Header: ← Back to Map, city and state, audience toggle, layout toggle, language, Sign Out.

| Audience | Tabs |
|---|---|
| Citizen | Overview · What to do · Compare |
| Authority | Overview · Prediction · Analysis · Compare · Interventions · AI + Export |

### 6.1 Overview (both audiences)

| Panel | What it shows | Source |
|---|---|---|
| **Share** (citizen) | "Share with family" WhatsApp link pre-filled with temperature, risk, air quality and a tip | Live readings |
| **Safe hours today** (citizen) | 24-hour bar: green < 35 °C feels-like, yellow 35–39, red ≥ 40 | Open-Meteo hourly |
| **Weather Conditions** | Temperature, feels-like, max/min, humidity, wind, pressure, visibility, UV, cloud, sunrise/sunset, AQI with PM2.5/PM10/NO₂/O₃, 7-day forecast, next 12 hours | Open-Meteo, live |
| **7-Day Heatwave Outlook** | Seven bars of forecast maxima against the IMD threshold for the terrain | Open-Meteo + IMD thresholds |
| **30-Day Temperature Trend** | Line chart from the site's own daily archive | `/api/weather-history` |
| **Today's High vs Low** | Two bars | Open-Meteo daily |
| **Satellite Indices** | Surface temperature (modelled), vegetation/built-up/water %, elevation | Open-Meteo, ESA WorldCover, SRTM |
| **Heat Risk Gauge** | Needle on a 15–50 °C dial | City live temp → state median → estimate |
| **Active Alerts** | Dismissible alerts: state heat > 45 °C, AQI > 300, and others | Mixed (see §13) |
| **How dangerous is the heat?** | "Feels like X °C" with a plain danger word (Safe / Take care / Be very careful / Dangerous / Extremely dangerous), what outdoor workers should do, and the worst time of day. "Show the science (for experts)" reveals Heat Index, wet-bulb, WBGT and every formula. Citizens see the same headline without the button. | Formulas on live temperature + humidity, see §11.12 |
| **AI Heat Response Co-Pilot** (authority) | AI-written Heat Action Protocol (Gemini; Agent37 if an instance is configured), simulated actions, Executive Brief | See §6.8 |
| **Heatwave Action Checklist** (authority) | Tick-list that adapts to severity | Rules, see below |
| **Health & Safety Precautions** | Rule-based advice list | Rules on temperature and AQI |
| **Global Climate Systems** | ENSO, IOD, MJO, PDO, NAO, Polar Vortex | Fixed text |

**Heatwave Action Checklist** ([src/components/HeatActionChecklist.jsx](src/components/HeatActionChecklist.jsx)) — modelled on NDMA guidelines and the Ahmedabad Heat Action Plan:

| Condition | List shown |
|---|---|
| Risk Extreme or High | 5 steps: cooling centres, health department alert, public advisory, water tankers, review cool-roof/green interventions |
| Risk Medium | 3 preparedness steps |
| Below 10 °C | 4 cold-weather steps (night shelters, cold advisory, hypothermia alert, animals) |
| Otherwise | "Routine monitoring", no list |

Ticks are time-stamped and saved in the browser per city. The panel says it is "an operational aid, not an official record".

### 6.2 What to do (citizen)

The Overview content plus:

- **How you can help your neighbourhood** — a static list that changes with severity.
- **Ask AGNI — is it safe today?** — the AI chat, in simple language.

### 6.3 Prediction (authority)

"District Brief" for the District Magistrate ([src/components/PredictionBrief.jsx](src/components/PredictionBrief.jsx)):

1. **Three header cards:** *When* (heatwave spell dates), *How bad today* (composite risk out of 100), *If you act* (risk before → after).
2. **7-day outlook** with "if nothing is done" vs "with the plan".
3. **This week — get the team on it:** the checklist steps as a table with an owner (Municipal Commissioner, CMHO, District Information Officer, PHED/Jal Board, Town Planner, DDMA control room) and a due-by.
4. **Where the budget goes:** quick budget buttons (₹25 L / ₹50 L / ₹1 Cr / ₹5 Cr) and the allocation.
5. **The heat map if you act:** two 10×10 grids, today vs with the plan.

### 6.4 Analysis (authority)

- **Temperature Heatmap Grid:** 10×10 cells around the city's real base temperature. The ±2 °C cell-to-cell pattern is labelled illustrative.
- **Data Pipeline panel:** a static list of the six data sources.
- **Satellite Surface Temperature (NASA MODIS):** latest clear-sky day and night, hottest surface this season, season means, a weekly chart (dotted where cloud blocked the satellite), and a year-by-year peak-season chart back to 2016 where available.
- **Random Forest Model:** an honest scorecard of a research model (see §11.7). The panel states it is not the source of any number in the app.
- **Land Use / Land Cover:** stacked bar of built-up, vegetation, water, bare soil.
- **Urban Morphology:** live building count within 1 km from OpenStreetMap.

### 6.5 Compare (both audiences)

Add up to 4 cities to a radar chart with six axes: LST, NDVI, NDBI, AQI, Wind, NDWI. Temperature, AQI and wind are live; NDVI/NDBI/NDWI are illustrative baselines and the panel says so.

### 6.6 Interventions (authority)

- **Recommended plan for the city:** compares tree cover with a 30% target (the 3-30-300 rule) and suggests tree and cool-roof levels. "Apply recommended plan →" sets the sliders.
- **UHI Interventions sliders:** Urban Greening (0–30%), Cool Roofs (0–20%), Water Bodies (0–10%), with a before/after mini-grid and a "Preview on a 40 °C day" toggle.
- **Cool Roof ROI Calculator:** enter roof area, choose lime-wash or premium coating; get cost range, temperature reduction, AC savings and payback period.
- **Physics of UHI Interventions:** three static cards with the governing formula for greening, cool roofs and water bodies.
- **Mitigation Planner** — the main planning tool:

| Mode | What you enter | What you get |
|---|---|---|
| **I have a budget** | ₹ amount (presets ₹25 L to ₹5 Cr, slider to ₹10 Cr) | An optimised split across cities and intervention types |
| **I want to estimate a cost** | An intervention and a quantity | Cost, cooling, risk before → after, the calculation lines |
| **I have a target** | Desired risk reduction (2–30%) | The investment needed |

  Output: risk before/after, allocation bars, "Why this plan?" bullets, per-city breakdown. Buttons: View on Map, Apply Plan to Sliders, Save as Plan A (compare two budgets), Export Report (.txt), CSV, Cost Assumptions & Method.

  The planner works at two levels: **state** (opened from the map panel; splits a budget across cities) and **city** (on this tab; splits within one city).

- **Wind & Atmosphere:** live wind direction, speed, gust, pressure.

### 6.7 AI + Export (authority)

- **AGNI chat** (see §7).
- **Points & Badges:** +10 points per city analysed; badges First Analysis, Tree Hugger, City Explorer, AI Explorer. Kept for the session only.
- **Glossary:** LST, NDVI, NDBI, NDWI, UHI, ENSO, IOD, MJO.
- **Export & Share:** Copy Summary, WhatsApp Share, CSV Download, PDF Report (opens a printable page and the browser's print dialog).
- **Progress tracker** and **Team & Methodology:** static text.

### 6.8 AI Heat Response Co-Pilot (authority, Overview tab and Command Center)

Files: [src/components/HeatCoPilot.jsx](src/components/HeatCoPilot.jsx), [api/_lib/heatAgent.js](api/_lib/heatAgent.js), [src/utils/heatActionProtocol.js](src/utils/heatActionProtocol.js), [src/utils/executiveBrief.js](src/utils/executiveBrief.js).

1. **Status line:** on load the panel pings `GET /api/heat-agent`, which reports which AI engine is available: an Agent37 instance (if `AGENT37_API_KEY` and `AGENT37_INSTANCE_ID` are set) or Google Gemini (the same server-side key AGNI uses). The project currently runs on Gemini; the Agent37 path is built but dormant because no instance has been created.
2. **Rule-based pre-assessment:** the activation level from the thresholds below, with the reasons.
3. **Run AI Co-Pilot:** sends the city's temperature, humidity, heat stress, 7-day IMD-threshold outlook, land cover and risk score to `POST /api/heat-agent`. The server tries Agent37 first (if configured), then Gemini in JSON mode (up to 25 s per model, same model chain as AGNI), asking for a Heat Action Protocol (actions with owner, deadline and priority; labour order; English and Hindi SMS; SDMA incident; assumptions). The reply is validated and clamped before it reaches the page.
4. **Never hangs:** "Use offline protocol now" appears while the AI works. If no engine is configured, both time out or fail, or neither returns valid JSON, the rule-based protocol is shown instead with an amber banner giving the reason. AI output gets a green banner naming the engine, model, time and tokens, and the Executive Brief footer says the same.
5. **Simulated actions:** "Dispatch ward advisory", "Simulate SMS broadcast" (counts characters and SMS segments), "Log incident to SDMA". Each writes a time-stamped entry with a reference number (e.g. `SDMA-RJ-…`) to an action log kept in the browser. Nothing is sent anywhere, and the log says so.
6. **Export Executive Heat Action Brief:** a printable one-page brief for the District Magistrate (situation, heat-stress numbers, 7-day forecast, actions table, labour order, SMS text, SDMA incident, action log, assumptions, data sources and who produced the plan).

| Activation level | Trigger (any one) |
|---|---|
| CRITICAL | air temperature (now or today's high) ≥ 45 °C · Heat Index "Extreme Danger" · WBGT black flag · IMD-threshold outlook shows heatwave/severe |
| ALERT | ≥ 42 °C · Heat Index "Danger" · WBGT red flag · a day above the IMD threshold |
| WATCH | ≥ 37 °C · Heat Index "Extreme Caution" · WBGT yellow flag |
| COLD | current temperature < 10 °C |
| ROUTINE | none of the above |

The AI is told to use only the numbers it is given and never to invent ward names, population or facility counts, because the project holds none; in testing, Gemini listed what was missing under "assumptions" rather than guessing.

---

## 7. AGNI, the AI assistant

AGNI = Analytical Ground-level heat iNtelligence Interface.

- **Where:** a floating button at the bottom-right of the map and dashboard, the AI + Export tab, and the citizen "What to do" tab. All three share one conversation.
- **Suggestion chips** fill the input (authority: 4 analytical questions; citizen: 3 safety questions).
- **How it answers:** the browser sends the question to the site's own server route `POST /api/ask-ai`, which calls Google Gemini. The API key stays on the server and never reaches the browser.
- **What it is told:** the selected city's live temperature, land-cover percentages and AQI; readings for any other cities or states named in the question; an India-wide ranking block for "hottest/cleanest" questions; a NASA MODIS line; the preferred reply language.
- **Rules in its instructions:** use only numbers it was given, say "no data" otherwise, tag anything else "(estimated)"; stay on heat, climate, air quality and planning; India only; never write code; reply in the language the user writes in.
- **Limits:** question ≤ 2,000 characters; 10 requests per minute per visitor; a 4-second gap between questions; one automatic retry when busy.
- **If the AI is unreachable:** an error bubble with Retry. For questions containing "hot" or "heat", a templated answer built from the on-screen live data appears, clearly marked "[Offline fallback answer…]".

---

## 8. Profile and admin screens

**Profile:** avatar, name, email, current view with a switch button, points, the First Analysis badge, recent sign-ins.

**Admin Analytics:** four stat cards (users, login events, cities analysed, success rate), charts for hourly logins, 30-day login trend and top 10 cities, and a recent-activity table. All of it reads browser `localStorage`, so it reflects one device only.

The admin screen cannot be reached through the interface: no account is ever given the admin role, so the "Admin Panel" menu item never appears.

---

## 9. Modes, languages and URL parameters

**Languages (11):** English, Hindi, Bengali, Marathi, Telugu, Tamil, Gujarati, Urdu, Kannada, Odia, Punjabi. Chosen manually from the dropdown and remembered. About 305 strings are translated; some text (map tooltips, ticker labels, legend bucket names) is English only.

**Lite mode:** for slow phones. Removes the globe, district layer and animations. Switches on automatically only for Save-Data or 2G connections.

**Layout:** Mobile below 768 px on first visit, otherwise Laptop; either can be forced.

**URL parameters**

| Parameter | Effect |
|---|---|
| `?view=citizen` or `?view=authority` | Sets the audience |
| `?demoTemp=46` | Treats whichever city is selected as 46 °C |
| `?demo=Leh:-8,Sri Ganganagar:46` | Per-city overrides; other cities stay real |
| `?relative=0` | On a demo link, turns off rank-based colouring |

Demo behaviour:

- Values must be plain numbers (46, -8, 45.5) and are clamped to −25…60 °C. "46abc", "1e9", empty values and broken pairs are ignored; one broken pair does not discard the others. A link with no valid value stays in normal live mode (no banner, no demo colours).
- Humidity is recomputed for the forced temperature, keeping the day's real moisture content (dew point) — heating air lowers its relative humidity. Without this, 46 °C with an evening's 60 % humidity would give an impossible Heat Index.
- On `npm run dev`, a URL with a broken `%` escape is repaired and redirected instead of returning HTTP 500 (production already handles this).
- A banner appears on the dashboard: "🧪 DEMO — {city} forced to N°C … (this browser only, not real data)".
- The override changes the selected city's dashboard (checklist, gauge, precautions, forecast). The map's temperatures remain real.
- On demo links the map colours states by **rank among today's readings** (hottest 10%, hotter 25%, …). The legend and tooltip say the colour is a rank, not an IMD danger level.

---

## 10. Where the data comes from

| Data | Source | Coverage | Freshness |
|---|---|---|---|
| City temperature, forecast, humidity, wind, UV | Open-Meteo forecast API (free, no key) | 1,932 cities | Live per selected city; bulk cache for the map |
| Air quality (US AQI, PM2.5, PM10, NO₂, O₃) | Open-Meteo air-quality API (CAMS) | Same | Same |
| Satellite surface temperature | NASA MODIS MOD11A1.061 (Terra, 1 km) via AppEEARS | 1,912 cities from 1 Mar 2026; 167 cities with a record from 2016 | Static, to 2 Sep 2026 |
| Land cover | ESA WorldCover 10 m (2021) | 171 cities, ~5 km box each | Static |
| Elevation | SRTM 30 m, via Open-Meteo | All located cities | Static |
| Building density | OpenStreetMap via Overpass (two mirrors) | Selected city, 1 km radius | Live |
| Schools and hospitals | OpenStreetMap | 6 cities only, 3 km radius | Static, 8 Sep 2026 |
| Map boundaries | Local GeoJSON | 36 states/UTs, 594 districts | Static |
| Daily archive | The site's own snapshots | 86 days, 22 Jun – 27 Sep 2026, with gaps | One per refresh |

**The live weather pipeline**

1. A refresh script fetches all 1,932 cities from Open-Meteo in batches and writes `public/live-weather-cache.json` plus a dated snapshot under `public/data/history/`.
2. It is meant to run on GitHub Actions (hourly in the day, every three hours at night) and commit the result, which redeploys the site. A Vercel cron at 14:30 IST and a retry at 16:00 IST are the backup.
3. If a batch fails, those cities keep their previous values and are flagged "carried forward".
4. In the browser: the cache loads on start and every 15 minutes. If it is older than 45 minutes, the map fetches a live sample of about 8 cities per state. Opening a state refreshes all its cities live. Selecting a city fetches its full live weather (kept for 8 minutes).
5. If a live fetch fails, the city shows its last saved reading or the cache value, labelled as cached.

**Refresh status:** the GitHub Actions refresh is running (checked 13 October 2026: successful runs several times a day). A local checkout only gets the new data on `git pull`, so run `git pull --rebase` before demoing from a laptop, or the app will show CACHED.

---

## 11. Every formula and threshold

### 11.1 State temperature and colour
Median of the state's city air temperatures; colour = bucket with the most cities (§5.2). Readings under 45 minutes old are used alone when the state has at least min(5, n) of them.

### 11.2 "Feels like"
Open-Meteo's `apparent_temperature`. The site does not compute its own heat index or wet-bulb temperature.

### 11.3 Urban Heat Island gap
`UHI = city temperature − temperature at a point 0.35° north and 0.10° east (~40 km away)`

| Gap | Label |
|---|---|
| ≤ 0 | No heat island / parity |
| ≤ 1.5 °C | Mild |
| ≤ 3.5 °C | Moderate |
| > 3.5 °C | Severe |

### 11.4 Heatwave outlook (IMD thresholds)

| Terrain | Threshold |
|---|---|
| Plains | 40 °C |
| Coast | 37 °C |
| Hills (elevation ≥ 900 m) | 30 °C |

Day level: ≥ 47 severe · ≥ 45 heatwave · ≥ threshold watch · ≥ threshold − 3 warm · else normal. A spell is two or more consecutive days at watch or worse. IMD's departure-from-normal rule is not applied because the site holds no climatological normals; the panel states this and points to mausam.imd.gov.in.

### 11.5 Air quality (US AQI)
≤ 50 Good · ≤ 100 Moderate · ≤ 150 Unhealthy for Sensitive Groups · ≤ 200 Unhealthy · ≤ 300 Very Unhealthy · > 300 Hazardous.

### 11.6 Precautions
Hot list at ≥ 38 °C (EXTREME at ≥ 45; two extra items if AQI > 200) · cold list below 15 °C · otherwise general advice.

### 11.7 Machine-learning model
- scikit-learn Random Forest, 100 trees. Features: NDVI, NDBI, elevation. Target: MODIS daytime surface temperature.
- Trained on 341 rows from 20 global megacities (Data in Brief, DOI 10.1016/j.dib.2019.103803). No Indian cities.
- Random 80/20 split: **R² 0.95, MAE 0.906 °C**.
- Holding out five whole cities: **R² −0.389, MAE 5.541 °C** — it does not generalise to unseen cities, and the panel shows this.
- Feature importance: elevation 0.505, NDBI 0.389, NDVI 0.106.
- Only the metrics are shipped. The model makes no prediction in the app.

### 11.8 Intervention cooling model (illustrative)
`cooling (°C) = tree fraction × 18 + cool-roof fraction × 14 + water fraction × 12`

Slider maximums are 0.30, 0.20 and 0.10. The same coefficients drive the heatmap grid, the recommended plan and the planner.

### 11.9 Composite risk score (0–100), used by the planner

```
t          = the higher of the forecast high and the live temperature
tempPts    = 10 (<25) · 30 (<30) · 50 (<35) · 70 (<40) · 85 (<45) · 95 (≥45)
surfacePts = clamp(MODIS season peak − 35, 0, 10)
builtPts   = built-up % × 0.2
canopy     = clamp(tree cover % / 30, 0, 1) × 10
risk       = clamp(round(tempPts + surfacePts + builtPts − canopy), 0, 100)
```

Labels: ≥ 80 CRITICAL · ≥ 65 HIGH · ≥ 45 MODERATE · else LOW. Confidence (high/medium/low) reflects how much real data the city has.

### 11.10 Planner cost assumptions

| Item | Value |
|---|---|
| Cool roof | ₹1.25 per sq ft (lime-wash midpoint, Ahmedabad pilot 2017) + ₹1,250 labour → ₹2,500 per 1,000 sq ft roof |
| Tree | ₹350 including 3-year maintenance; 400 per hectare → ₹1.40 L per hectare |
| Cooling centre | ₹5 L |
| Water station | ₹50,000 |
| Reflective pavement | ₹150 per m² → ₹15 L per hectare |
| School/hospital retrofit | ₹1.5 L |
| Priority core | 1 km radius (~314 ha) |
| Risk points per °C of cooling | 4 |
| Diminishing returns | ×0.9 per ₹25 L already spent in the same city |
| Cap on relief spending (centres + water) | 40% of budget |

**Optimiser:** greedy and deterministic. It repeatedly buys the package with the best risk-points-per-rupee, weighted by the city's risk and built-up share, until the budget runs out. The reported reduction carries a ±20% band. Population is not modelled because there is no verified per-city table; the planner says so.

### 11.11 Cool Roof ROI calculator

| Coating | Cost | Lifespan | Temperature reduction |
|---|---|---|---|
| Basic lime-wash | ₹0.5–2 per sq ft | 1 year | 1.4 °C |
| Premium reflective | ₹15–30 per sq ft | 5 years | 2.8 °C |

AC savings = area × 0.09 kWh per sq ft per month × ₹7 per kWh, over 8 cooling months. Payback = average coating cost ÷ annual savings.

### 11.12 Heat stress ([src/utils/heatStress.js](src/utils/heatStress.js))

| Quantity | Method |
|---|---|
| Heat Index | US NWS: Steadman simple form below 80 °F, otherwise the Rothfusz regression with the NWS low- and high-humidity adjustments. Above 135 °F (57 °C) the NWS chart ends, so the panel shows "> 57 °C". |
| Wet-bulb | Stull (2011): `Tw = T·atan(0.151977·√(RH+8.313659)) + atan(T+RH) − atan(RH−1.676331) + 0.00391838·RH^1.5·atan(0.023101·RH) − 4.686035` |
| WBGT (shade estimate) | ISO 7243: `WBGT = 0.7·Tnw + 0.3·Tg`, natural wet-bulb ≈ Stull wet-bulb, globe ≈ air temperature in shade. No API gives globe temperature, so in sun the true value is higher. |

| Heat Index | Band |
|---|---|
| ≥ 51.7 °C | Extreme Danger |
| 39.4–51.7 °C | Danger |
| 32.2–39.4 °C | Extreme Caution |
| 26.7–32.2 °C | Caution |

| WBGT | Category (TB MED 507) | Moderate work / rest per hour |
|---|---|---|
| ≥ 32.2 °C | 5 Black | 20 / 40 min |
| 31.1–32.2 °C | 4 Red | 30 / 30 min |
| 29.4–31.1 °C | 3 Yellow | 40 / 20 min |
| 27.8–29.4 °C | 2 Green | 50 / 10 min |
| 25.6–27.8 °C | 1 White | no limit |

The Australian BoM WBGT shortcut was tested and rejected: it reads about 5 °C high in hot, dry air.

---

## 12. Backend, deployment and environment

**Server routes** (Vercel functions in [api/](api/))

| Route | Method | Purpose |
|---|---|---|
| `/api/ask-ai` | POST | AGNI: validates input, rate-limits, calls Gemini with a five-model fallback chain |
| `/api/heat-agent` | GET / POST | GET: which AI engine is available (Agent37 / Gemini). POST: run the Co-Pilot (6 runs per minute per visitor); always returns a plan, labelled `agent37`, `gemini` or `fallback` |
| `/api/weather-history` | GET | `?city=&state=&days=` returns a city's archive series; `?runs=1` lists refresh runs |
| `/api/refresh-weather-cache` | GET (cron) | Full cache refresh, commits to GitHub |
| `/api/refresh-weather-cache-retry` | GET (cron) | Re-fetches only cities that failed |

In local development the Vite dev server serves `/api/ask-ai` and `/api/weather-history` itself, so `npm run dev` is enough.

**Environment variables** (server-side only; see [.env.example](.env.example))

| Variable | Needed for |
|---|---|
| `GEMINI_API_KEY` | AGNI and the AI Co-Pilot |
| `GEMINI_MODELS` | Optional override of the model chain |
| `CRON_SECRET` | Protecting the cron routes |
| `GITHUB_TOKEN` | Letting the cron commit the refreshed cache |
| `DATABASE_URL` | Optional Postgres mirror of the archive |
| `AGENT37_API_KEY`, `AGENT37_INSTANCE_ID` | Optional: puts an Agent37 instance in front of Gemini for the Co-Pilot. Not set in production |

**Deployment:** Vercel (primary). A Netlify config exists but only wires up `/api/ask-ai`.

**Browser storage:** accounts, login history, language, audience, layout, Lite mode, checklist ticks and last-known weather are all in `localStorage`. Nothing about users is sent to a server. Page analytics use Vercel Analytics.

**Error handling:** an error boundary wraps the whole app and the map separately. A crash shows "Something went wrong" with Try again / Reload, not a white screen.

**Legacy code:** [app.py](app.py), [templates/](templates/) and [static/](static/) are an older Flask prototype. The React site does not use them.

---

## 13. Real vs estimated vs hardcoded

**Measured or live**
- City temperature, forecast, humidity, wind, AQI and pollutants (Open-Meteo).
- State medians, map colours, weather badges, the hottest-cities list and ticker values derived from them.
- NASA MODIS surface temperature (quality-checked; cloudy days left as gaps, nothing interpolated).
- ESA WorldCover land cover for 171 cities.
- OpenStreetMap building counts.
- ML model metrics.

**Estimated, and labelled as such on screen**
- A state with no live cities (baseline value, "(estimated)").
- Land cover for a city outside the 171 (nearest classified city, "est. from X (~N km)").
- "Surface Temp (live)" on the Overview — modelled by Open-Meteo, labelled as not a satellite reading.
- The heatmap grid's cell-to-cell pattern, the intervention sliders and every planner outcome ("model-based estimates").
- Demo-link temperatures (banner).

**Hardcoded with no "static" label on screen**
- Global Climate Systems panel (ENSO "El Niño", IOD, MJO, PDO, NAO, Polar Vortex).
- Ticker items "El Niño Active", "Sat Pass: Next 16:45 IST", "SAT ACTIVE".
- Nav pills HEAT HIGH / CLIMATE EL NIÑO / SYSTEM OPS and the "AGENT ONLINE" badge.
- The "Marine heatwave active" alert, always shown for Gujarat, Maharashtra, Kerala and Tamil Nadu.
- The "MODERATE urban heat" alert, driven by a baseline NDBI value.
- The progress tracker (7 of 8, 87.5%).

---

## 14. What works without internet

Run locally with `npm run dev` and no connection:

| Works | Does not work |
|---|---|
| Sign-in, map, colours and medians from the cached file | Live weather for a selected city (falls back to cached, labelled) |
| MODIS, land cover, ML scorecard, planner, calculators, heat stress | AGNI (error bubble; templated fallback for heat questions) |
| Co-Pilot offline protocol, simulated actions, Executive Brief | The AI Co-Pilot itself (falls back to the offline protocol, labelled) |
| 30-day trend (reads local snapshot files) | Building density ("unavailable") |
| Checklist, exports, language switching | Rural baseline / UHI gap |
| | Google Fonts (system fonts are used instead) |

---

## 15. Known gaps and loose ends

Things a careful reviewer could find. None stops the site from running.

**Behaviour**
- **Re-login after logout accepts anything.** The inner sign-in screen lets in any non-empty email and password; only the launch screen checks credentials.
- **Admin screen is unreachable** (§8).
- **30-day trend never shows carried-forward days.** The panel reads a field called `carried`; the API sends `isCarriedForward`.
- **PDF report may print elevation as N/A.** It reads the value from the wrong place.
- **Demo city names are not checked** against the city list; an unknown name is simply never matched.
- **Compare tab** resolves an added city's state by name only, so two cities with the same name can be confused.
- **The floating AGNI drawer** does not pass the state name, so it probably lacks the MODIS line that the tab version sends.
- **The clock says IST** but shows the device's local time.
- **Hidden native cursor:** the site replaces the mouse pointer with a custom one everywhere.

**Text that no longer matches the data**
- Land cover is described as "36 representative cities" in the Data Pipeline panel and the CSV export; the file has 171.
- AGNI's instructions name NASA POWER as the rural-baseline source; the code uses Open-Meteo.
- Exports are stamped "BAH 2026 | CCSU IMS Ghaziabad" and "Delhi NCR".
- The legend row "Active heatwave (major states)" has nothing on the map behind it.
- The ticker's "Peak City" is the second-hottest city by current temperature.
- The ML data file gives the year range as both 2000–2017 and 2000–2018.
- Physics panel cost ranges differ from the planner's unit costs.

**Data**
- The weather cache in this checkout dates from 27 September 2026.
- Schools-and-hospitals data covers only 6 cities.
- 24 small localities have no coordinates and rely on live geocoding.
- ISRO INSAT-3D data has been requested but is not in the product; the parser script has never been run.

**Not in the product at all**
- No ward-level data or population data.
- No real SMS, alerting or incident-logging integration — the Co-Pilot's actions are simulated and labelled.
- No server-side user accounts.

---

## 16. File map

| Path | What it holds |
|---|---|
| [index.html](index.html), [src/main.jsx](src/main.jsx), [src/App3D.jsx](src/App3D.jsx) | Entry point, launch → app switch |
| [src/App.jsx](src/App.jsx) | Map, navbar, dashboard, all tabs, state data table |
| [src/components/](src/components/) | One file per panel (planner, checklist, MODIS, weather card, AGNI, …) |
| [src/hooks/useWeather.js](src/hooks/useWeather.js) | Live weather per city, caching, demo overrides |
| [src/utils/weatherAPI.js](src/utils/weatherAPI.js) | Open-Meteo calls, AQI categories |
| [src/utils/mitigationPlanner.js](src/utils/mitigationPlanner.js) | Risk score, cost model, optimiser |
| [src/utils/heatwaveOutlook.js](src/utils/heatwaveOutlook.js) | IMD threshold classification |
| [src/utils/stateLiveRefresh.js](src/utils/stateLiveRefresh.js) | Batched live refresh per state |
| [src/utils/agniLocationContext.js](src/utils/agniLocationContext.js) | Extra city/state facts sent to AGNI |
| [src/utils/exportUtils.js](src/utils/exportUtils.js) | CSV, WhatsApp, printable report |
| [src/utils/heatStress.js](src/utils/heatStress.js) | Heat Index, wet-bulb, WBGT, work/rest categories |
| [src/utils/heatActionProtocol.js](src/utils/heatActionProtocol.js) | Activation levels, rule-based protocol, plan validation |
| [src/components/HeatCoPilot.jsx](src/components/HeatCoPilot.jsx), [api/_lib/heatAgent.js](api/_lib/heatAgent.js) | AI Co-Pilot (browser panel; server tiers Agent37 → Gemini → rule-based) |
| [src/components/CommandCenterHud.jsx](src/components/CommandCenterHud.jsx), [src/utils/hudOverlay.js](src/utils/hudOverlay.js) | Command Center HUD (full-screen map, docks, timeline scrubber, real-reading overlays) |
| [src/i18n/](src/i18n/) | 11 language files |
| [api/](api/) | Serverless routes and their shared code |
| [scripts/](scripts/) | Data builders: weather refresh, MODIS, land cover, geocoding, ML training |
| [public/live-weather-cache.json](public/live-weather-cache.json) | Bulk weather cache |
| [public/data/](public/data/) | GeoJSON, MODIS, land cover, ML metrics, coordinates, daily history |
| [vite.config.js](vite.config.js), [vercel.json](vercel.json) | Dev middleware, build, crons |
