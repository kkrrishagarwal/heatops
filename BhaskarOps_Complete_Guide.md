# BhaskarOps — The Complete Guide

**Hackyard Build 2026 · IIT Guwahati · Team B26-0322**

BhaskarOps (earlier name HeatOps) is a web platform that monitors urban heat across India and helps a district administration decide what to do about it: live readings for 1,932 cities, NASA satellite surface temperature, land cover, a probabilistic heatwave forecast, an AI-written Heat Action Protocol with its cost, a budget planner, an action tracker, and exportable reports.

This guide is written from the base level. It assumes no prior knowledge of meteorology, satellites or the code, and it explains each term the first time it is used.

- Live site: https://heatops.vercel.app
- Written from the code as deployed on 20 October 2026, for the Grand Finale panel (24–25 October 2026). Where a number on screen is an estimate, this guide says so, because the app says so.
- New since the 17 October edition: the six-workspace dashboard (section 9), the ensemble heatwave probability (sections 9.2 and 11.11), the action tracker (9.5), the report builder (9.6), photographs for every city and district (section 17), and charts that state their own takeaway.

## Contents

1. Why this app exists
2. What BhaskarOps is, and who it is for
3. The concepts, explained from zero
4. Where the data comes from
5. The screens: a guided tour
6. The Command Center in detail
7. The AI Heat Response Co-Pilot
8. The Mitigation Planner and the cost model
9. The city dashboard, tab by tab
10. AGNI, the AI analyst
11. Every formula and threshold
12. Real, estimated, or fixed? The honesty rule
13. Technical architecture
14. Limits and known gaps
15. Demo script and judge questions
16. Glossary
17. Location photographs

---

## 1. Why this app exists

Heat is the deadliest weather hazard in India and the least visible. A cyclone has a track and a landfall time; a heatwave arrives as a number on a thermometer that looks only slightly higher than yesterday's. Between 1992 and 2020 India recorded more than 25,000 heat-related deaths in official counts, and studies that measure "excess mortality" (how many more people died than usual) put the real figure far higher. The people who die are mostly those who cannot avoid the heat: construction workers, street vendors, delivery riders, farm labourers, the elderly in top-floor rooms, infants in tin-roofed housing.

Cities make it worse. Concrete, asphalt and tin absorb sunlight by day and release it at night, so a city centre can stay 3–6 °C hotter than the fields around it. This is the **urban heat island**. As India urbanises, more people live inside these islands every year.

India has a response framework. The National Disaster Management Authority (NDMA) publishes heatwave guidelines, the India Meteorological Department (IMD) issues warnings, and cities such as Ahmedabad have Heat Action Plans (HAPs): open cooling centres, move outdoor work to the morning, alert hospitals, send advisories. Ahmedabad's plan, started in 2013, is credited with avoiding over a thousand deaths a year.

The gap is operational. A district officer on a hot morning has the IMD bulletin and a phone, and has to answer: how bad is it here, today; which of the plan's steps should I trigger; what will it cost; and what happens if I do nothing. BhaskarOps is built to answer those four questions, for any of 1,932 Indian cities, from real data, in one screen.

---

## 2. What BhaskarOps is, and who it is for

**BHASKAR** stands for Bharat Heat Analysis, Surveillance, Knowledge & Assessment Resource; **OPS** for Optimization & Planning System. It is a website (React, runs in any modern browser) with a small server behind it for the AI calls and the data refresh.

### Two audiences, two views

| View | Who | What they see |
|---|---|---|
| Authority | District Magistrate, Municipal Commissioner, DDMA control room, health and labour officers, planners | The full platform: the Command Center map, the AI Co-Pilot with costs and consequences, the Mitigation Planner, satellite data, the city dashboard with all tabs |
| Citizen | Residents and families | A plain-language view: how hot it feels, a danger word, safe hours today, what to do, a WhatsApp share, and a simple chat with the AI |

Authority is the default; the toggle is in the top bar. Everything in the citizen view is also in the authority view.

> **The one rule the whole app follows.** A number that was not measured is labelled: "(estimated)", "illustrative", "model-based estimate", "no reading", or "no live data". The app never invents a reading for a city it has no data for, never estimates deaths, and never says "Agent37" or "satellite" about something that is not. When a judge asks "where does this number come from?", the answer is on the screen next to the number.

---

## 3. The concepts, explained from zero

These are the ideas the app is built on. Each is explained in plain terms first, then with the precise definition the app uses.

### 3.1 Air temperature versus how hot it feels

A thermometer in the shade, 2 metres above ground, gives the **air temperature**. This is what the weather report means by "36 °C". But the body does not feel air temperature alone; it feels how easily it can cool itself, and that depends mostly on **humidity** (the amount of water vapour in the air). Sweat cools you only when it evaporates, and it evaporates slowly in humid air. So 36 °C at 20 % humidity (Jaisalmer in May) feels very different from 36 °C at 70 % humidity (Kolkata in June).

The app shows three measures of "how hot it feels", each with a specific job:

- **Heat Index.** The United States National Weather Service's "feels like" temperature. It combines air temperature and relative humidity into one number and has published danger bands: Caution (≥ 26.7 °C), Extreme Caution (≥ 32.2 °C), Danger (≥ 39.4 °C), Extreme Danger (≥ 51.7 °C). This is the number the app shows in big type as "Feels like X °C" with a danger word.
- **Wet-bulb temperature.** The lowest temperature a wet surface (like sweating skin) can reach by evaporation. It is the physical limit of how much sweat can cool you. Laboratory studies (Vecellio et al., 2022) found that healthy young adults lose the ability to shed heat at a wet-bulb of about 31 °C; 35 °C is the theoretical survival limit even at rest in the shade. The app computes it with Stull's 2011 formula.
- **WBGT (Wet-Bulb Globe Temperature).** The international standard (ISO 7243) for deciding how long a person can work in heat. It blends the wet-bulb (humidity), air temperature and radiant heat from the sun. Occupational tables (the US Army's TB MED 507, used worldwide) give a work/rest ratio per hour for each WBGT band: for example at WBGT 31.1–32.2 °C a worker doing moderate work needs 30 minutes of rest every hour. The app uses this to write the labour order ("outdoor work 06:00–11:00") and to count work hours lost. No weather service reports radiant heat, so the app computes the *shade* WBGT and labels it a floor: in the sun the true value is higher.

### 3.2 Land surface temperature versus air temperature

A satellite cannot measure the air at 2 metres. It measures the temperature of the **ground surface** it sees: rooftops, roads, bare soil, fields. In sunshine the ground is much hotter than the air above it: a Jaipur rooftop can read 55 °C while the air is 42 °C, and bare rock in Leh can read 44 °C on a May morning while the air is 20 °C. This surface reading is called **LST** (land surface temperature).

Why use it at all? Because it is measured everywhere, at the same moment, by the same instrument, for twenty years. NASA's Terra satellite carries the MODIS instrument, which maps the whole Earth's surface temperature every day at 1 km resolution, passing over India at about 10:30 am (and 10:30 pm). The app holds MODIS readings for 1,912 cities since March 2026 and for 167 cities back to 2016. That is how the Historical slider can show 2016 against 2024, and how the planner knows a city's "season peak surface".

One catch: satellites cannot see through cloud. MODIS marks cloudy pixels as "no data", and the app keeps those as gaps rather than guessing. In the monsoon, most of India has no clear-sky reading for weeks; the app's "14-day composite" option shows each city's most recent clear-sky reading and says so.

### 3.3 The urban heat island

Built-up land absorbs more sunlight than vegetation and releases it slowly at night, traffic and air-conditioners add heat, and tall buildings block the wind. The result is a city that is warmer than its surroundings, most sharply at night. The app measures this directly: it fetches the live temperature at a point about 40 km outside the city (0.35° north, 0.10° east) and subtracts. A gap of more than 3.5 °C is labelled "Severe UHI effect".

### 3.4 Built-up fraction, vegetation, elevation

**Built-up fraction** is the share of the ground covered by man-made surfaces: buildings, roads, pavements, yards. It comes from the European Space Agency's WorldCover map (2021), which classifies every 10 m × 10 m square of the Earth from Sentinel satellite images. For each of 171 cities the app counts the classes in a box of about 5 km around the city centre: 58 % built-up for Raipur means 58 % of that box is sealed surface. It is land cover, not a count of buildings (the dashboard's Urban Morphology panel counts actual buildings from OpenStreetMap). Built-up share drives the heat island and sizes the planner's cool-roof packages.

**Vegetation fraction** is the share covered by trees, grass and crops. Trees cool their surroundings by shading and by *evapotranspiration* (releasing water vapour, which takes heat with it). The app compares a city's tree cover with the "3-30-300" target used by urban foresters (30 % canopy).

**Elevation** is height above sea level, from NASA's SRTM radar survey (30 m grid). Air cools by about 6.5 °C per 1,000 m of height, which is why Leh at 3,500 m is cold while Jaipur at 430 m is hot. The app uses elevation to pick the right IMD rule (see 3.5).

### 3.5 What counts as a heatwave: the IMD rules

IMD declares a heatwave when a station's maximum temperature reaches at least 40 °C in the plains, 37 °C on the coast, or 30 °C in the hills, *and* is either 4.5 °C above the normal for that date or reaches 45 °C outright (47 °C for a "severe" heatwave), on two consecutive days. The app applies the threshold and absolute rules to the 7-day forecast and calls the result a "threshold-based outlook, not an IMD warning", because it does not hold the per-city climatological normals the departure rule needs. Official warnings remain at mausam.imd.gov.in.

### 3.6 Air quality: AQI and PM

**PM2.5** and **PM10** are particles in the air small enough to enter the lungs (2.5 and 10 micrometres across). The **AQI** (Air Quality Index) turns pollutant concentrations into one 0–500 number with health bands (Good, Moderate, Unhealthy for Sensitive Groups, Unhealthy, Very Unhealthy, Hazardous). Heat and pollution compound: hot, still air traps dust and ozone, and the same people are vulnerable to both. The app uses the US EPA scale, delivered through Open-Meteo from the European CAMS model; it is not CPCB station data and the screen says so.

### 3.7 Interpolation: filling the space between cities

The app has readings at 1,932 points, but a map needs a value everywhere. **Inverse-distance weighting (IDW)** estimates the value at any location as an average of the nearest readings, with nearer readings weighted more (by 1/distance²). The Command Center uses IDW for the continuous thermal surface, for districts without their own city, and for the wind field. The rules that keep it honest: use only the nearest 8 readings, never reach farther than ~150 km on dense layers (~400 km on the sparse satellite and land-cover layers, with the result rounded and labelled "estimated from X"), and leave anything beyond that blank.

### 3.8 Choropleth, composite, semantic zoom

- **Choropleth.** A map where each area (state, district) is filled with a colour that encodes a value. The app's state colour is decided by a vote: the risk bucket that the most cities in that state fall into (ties go to the hotter bucket, because a disaster map should not understate risk).
- **Composite.** A satellite image built from several days, taking each location's most recent clear-sky reading. Standard practice for cloudy regions; the app labels the window ("last pass within 14 days").
- **Semantic zoom.** The map shows different detail at different scales: a clean state view when zoomed out, per-district colours and borders when zoomed in or when a state is selected.

---

## 4. Where the data comes from

| Data | Source | Coverage | Freshness |
|---|---|---|---|
| Air temperature, humidity, wind, forecast, UV | Open-Meteo forecast API (free, no key; aggregates national weather models and ECMWF) | 1,932 cities in all 36 states and UTs | Bulk cache refreshed several times a day; the selected city fetched live |
| Air quality (US AQI, PM2.5, PM10, NO₂, O₃) | Open-Meteo air-quality API (Copernicus CAMS model) | Same | Same |
| Satellite land surface temperature | NASA MODIS MOD11A1 (Terra, 1 km), point samples via NASA AppEEARS; quality-filtered to clear-sky pixels | 1,912 cities since 1 Mar 2026; 167 cities since 2016; daily national file of 184 dates | Static archive to 2 Sep 2026 |
| Daily true-colour satellite image | NASA GIBS, VIIRS (Suomi NPP) | Whole country, one image per day | Previous day |
| Land cover (built-up, vegetation, water, bare) | ESA WorldCover 10 m, 2021 | 171 cities, ~5 km box each; other cities estimated from the nearest classified city, labelled | Static |
| Elevation | NASA SRTM 30 m via Open-Meteo | All located cities | Static |
| Building count | OpenStreetMap via Overpass | Selected city, 1 km radius | Live |
| Schools and hospitals | OpenStreetMap | 6 cities, 3 km radius | Static |
| Satellite imagery basemap | Esri World Imagery (Maxar); Esri dark canvas | Whole world, to street level | Static |
| Map boundaries | GeoJSON: 36 states/UTs, 594 districts, official J&K/Ladakh file | India | Static |
| Daily archive | The app's own snapshots of the bulk cache | 86+ days since 22 Jun 2026 | One per refresh |

### The refresh pipeline

1. A script fetches all 1,932 cities from Open-Meteo in batches (temperature, cloud, rain chance, today's high, wind speed and direction, AQI, PM10) and writes `live-weather-cache.json` plus a dated snapshot.
2. GitHub Actions runs it hourly in the day and every three hours at night and commits the result, which redeploys the site automatically. A Vercel cron is the backup.
3. If a batch fails, those cities keep their previous values and are flagged "carried forward"; the map's status badge turns from LIVE to CACHED when the cache is older than 36 hours.
4. In the browser, selecting a city fetches its full live weather (7-day and hourly forecast, humidity, wind, UV); opening a state refreshes that state's cities live.

---

## 5. The screens: a guided tour

### 5.1 Sign-in

Register with any name, email and password (6+ characters), then sign in. Accounts live only in the browser's local storage; there is no server-side user database, which is deliberate for a demo and stated in the guide's limits. After sign-in an Authority user on a laptop lands on the Command Center; a Citizen, or any phone, lands on the classic map.

### 5.2 The Command Center (Authority, laptop)

A full-screen map with three floating panels and no page scrolling. It opens on an **All-India National Overview** with nothing selected: the left panel shows the hottest city right now, how many cities are forecast at or above 40 °C today, and the national mean; the right panel waits in standby. Clicking a state, clicking a district, or searching a city selects it and both panels switch to that locality. Section 6 covers every control.

### 5.3 The classic map

The original screen: the India map on the left, an information panel on the right with the national summary, quick picks (Delhi, Mumbai, Bengaluru, Jaipur, Chennai, Kolkata), and, when a state is selected, its city list with live temperatures, the state-level Mitigation Planner, and the Hottest Cities list. "Analyze" opens the city dashboard.

### 5.4 The city dashboard

On a laptop in the Authority view, the dashboard is an executive workspace. A left sidebar lists six numbered workspaces: Overview, Prediction, Analysis, Compare, Interventions, AI + Export. A shared header shows the city's photograph, coordinates and elevation, a LIVE / CACHED / DEMO / OFFLINE status, the IST clock, a city search, and the audience and language controls. The selected city is kept when you switch workspaces. Citizens, and anyone on a phone, keep the simpler tab layout (Overview, What to do, Compare). Section 9 walks through each workspace.

### 5.5 AGNI

The AI analyst, reachable from a floating button on every screen and from the AI + Export tab. Section 10.

### 5.6 Profile

Name, email, current view with a switch, points and badges, recent sign-ins.

---

## 6. The Command Center in detail

### 6.1 The map

The map is a proper tile-map engine (Leaflet), so it zooms from all of India (zoom 4) to individual city blocks (zoom 19) with the scroll wheel, the + / − buttons, or ◎ "fly to the selected city". The state and district boundaries are re-drawn as vectors at every zoom, so they stay crisp.

| Base map | What it is |
|---|---|
| Dark | Esri dark canvas; streets and place names appear as you zoom in. |
| Satellite | Esri World Imagery (Maxar), the Google-Earth-style view, sharp to street level. From zoom 11, roads, rail and place labels are drawn on top. |
| NASA true colour | NASA's actual daily photograph of India (VIIRS). In Live Pass mode it follows the date you scrub, clouds included. Native resolution 250 m, so it is a weather-scale picture, not a street-scale one. |

### 6.2 Layers: what the colours mean

| Layer | Meaning |
|---|---|
| Air temperature | Live Open-Meteo readings, 1,932 cities. In Forecast mode, today's forecast highs. |
| Surface temperature | NASA MODIS land surface temperature (ground, ~10:30 am). Latest clear-sky pass per city, a scrubbed day, or a year's April–June mean. |
| Built-up share | ESA WorldCover built-up percentage, 171 classified cities; others estimated from the nearest, labelled. |

### 6.3 Colours and surfaces

**Spectral thermal** (default) is a continuous scale from violet (below 10 °C) through blue, cyan, green, yellow and orange to crimson (45 °C and above), so a 29 °C district and a 31 °C district are visibly different shades. **NDMA risk tiers** paints the six discrete buckets instead (Low < 25, Low-Moderate 25–30, Moderate 30–35, High 35–40, Very High 40–45, Extreme ≥ 45 °C). The tier *labels* appear in badges and tooltips under either palette. Built-up share has its own green (open land) → red (dense) scale with a legend.

**District choropleth** fills state and district polygons. **Continuous spectrum** replaces the fills with a smooth interpolated field computed from the city readings and clipped to India's outline, with the borders drawn over it, the way a meteorological chart looks.

### 6.4 Semantic zoom and per-district colours

Zoomed out, each state wears one colour (the bucket most of its cities fall in) and district borders are faint. The selected state is the exception: it shows its internal district-by-district gradient under a glowing cyan outline. From zoom 6, every district gets its own colour: 451 of the 594 districts share a name with a city and take that reading directly; the rest take a distance-weighted mean of the two nearest cities in their state (within 150 km); on the sparse satellite and land-cover layers the search widens to 400 km across state lines, rounded and labelled "estimated". Hovering a district shows its name, value, tier and source city; clicking it opens that city.

### 6.5 The timeline scrubber (bottom panel)

| Mode | What it does |
|---|---|
| Historical | Drag through 2016–2026. Each year shows the April–June mean clear-sky surface temperature for the 166 cities with a multi-year satellite record, and the states recolour from them. The readout gives the selected city's figure for that year, including its hottest single day. |
| Live Pass | With Surface temperature on: drag day by day through 184 satellite passes (1 Mar – 2 Sep 2026) for the whole country. The caption gives the honest count: "149 cities with a pass that day, 1,110 shown from their last pass within 14 days, 653 none (cloud)". A checkbox switches the 14-day composite off to see exact-day coverage only. With NASA true colour on, the photograph follows the date. |
| Forecast | Drag 0–6 days: the readout shows the selected city's forecast high, low, condition and rain chance; the map shows today's forecast highs nationally. |

### 6.6 Wind and heat advection

The "Live wind & heat advection flow" switch starts a Windy-style particle animation: 1,500 particles drift along the real 10-metre wind from the 1,932 city readings (interpolated between them), fading into trails. In **Thermal wind** mode each particle is coloured by the air temperature it carries, so hot westerlies crossing the plains show as orange and red streams. In **Stagnation zones** mode, places where the wind is under 6 km/h while the air is above 40 °C or PM10 above 150 µg/m³ pulse magenta: heat and dust the wind is not clearing. Hovering the map opens a probe with the wind vector ("24 km/h WNW (290°)"), an "advective heat load" reading and a "ventilation index"; both labels are heuristics and say so. Nothing is drawn farther than ~150 km from a city reading; no synthetic wind is ever added.

### 6.7 The left panel

Layer, base map, colour and surface switches; the wind controls; "Heat colours on the map" (off leaves borders only) and "Show city dots" (one dot per reading, off by default to keep the map clean); then, for the selected city, the **Alert triage** badge (temperature, activation level, feels-like, the reasons) and the 10 × 10 thermal grid, which starts from the city's real temperature and adds an illustrative ±2 °C intra-city pattern, labelled as such. With no city selected the panel shows the national summary.

### 6.8 The right panel

The AI Heat Response Co-Pilot (section 7) and the Heatwave Action Checklist (section 9.1).

### 6.9 The floating search

A translucent pill at the top of the map: type any of 1,932 city names; results show each city's live temperature; Enter picks the first; picking a city flies the map to it.

---

## 7. The AI Heat Response Co-Pilot

This is the feature that turns the platform from a monitor into an operations tool. It writes, for the selected city, a municipal Heat Action Protocol in the form a District Magistrate would act on.

### 7.1 What goes in

The city's live temperature and humidity, today's high, the 7-day forecast, the heat-stress numbers (Heat Index, wet-bulb, WBGT, work/rest category), the IMD-threshold outlook (worst level this week, any multi-day spell, the first hot day), land cover (built-up and tree share), the composite risk score, and a costing block (section 7.5). Nothing else: no ward names, no population, no facility lists, because the project holds none.

### 7.2 The rule-based pre-assessment

Before any AI runs, deterministic rules set an activation level, shown with its reasons:

| Level | Trigger (any one) |
|---|---|
| CRITICAL | air temperature (now or today's high) ≥ 45 °C · Heat Index "Extreme Danger" · WBGT black flag (≥ 32.2 °C) · the outlook shows heatwave or severe conditions this week |
| ALERT | ≥ 42 °C · Heat Index "Danger" · WBGT red flag · a day above the IMD threshold this week |
| WATCH | ≥ 37 °C · Heat Index "Extreme Caution" · WBGT yellow flag |
| COLD | current temperature below 10 °C (a cold-weather protocol applies) |
| ROUTINE | none of the above |

### 7.3 Which AI writes the plan

The server tries three tiers in order and labels the result: (1) an **Agent37**-hosted agent, if an instance is configured (the code path is built; no instance is configured in production, by the team's decision not to add a payment card); (2) **Google Gemini**, with the same prompt, in JSON mode, using the key the AGNI chat already uses; (3) the **rule-based protocol**, if both are unreachable. The panel shows a green banner naming the engine, model and time for AI output, or an amber "Offline protocol — not generated by an AI" banner with the reason. The browser side never hangs: "Use offline protocol now" is available while the AI works, and a time-out falls back automatically.

### 7.4 What comes out

- **Headline and situation**: one sentence, then two or three explaining the data and the level.
- **Actions**, 4–10, each with a title, concrete detail, an owner (a district role: Municipal Commissioner / ULB, CMHO / District Health, Labour Department, District Information Officer, PHED / Jal Board, DDMA control room, Fire & Emergency Services, the power distribution company, District Education Officer), a deadline and a priority P1–P3.
- **Labour order**: shift window (e.g. 06:00–11:00), restriction (12:00–16:00 no outdoor work), work/rest cycle.
- **Public advisory** as an SMS in English (kept within the GSM character set) and Hindi.
- **SDMA incident**: type, severity, summary.
- **Estimated cost** (7.5) and **If this is not controlled** (7.6).
- **Assumptions**: what the AI could not verify. In testing, Gemini listed missing items here rather than guessing, which is the behaviour the prompt demands.

### 7.5 Estimated cost

A "Seasonal budget to plan with" selector (₹25 L, ₹50 L, ₹1 Cr, ₹5 Cr) feeds the Mitigation Planner, and the Co-Pilot receives two costings it may allocate but not re-price:

- **This week's emergency response** at the activation level, priced from the planner's published unit costs: at CRITICAL, 4 cooling centres × ₹5 L and 10 drinking-water stations × ₹50,000 = ₹25 L; at ALERT, 2 and 6. Items with no unit cost in the model (SMS blasts, ORS stock, fuel for misting runs, overtime) are listed as "not priced", never guessed.
- **Seasonal investment**: what the planner would buy with the chosen budget (cool roofs, plantation, reflective surfaces, cooling units) and the projected composite-risk change, plus the investment needed for a 15 % risk cut, or a statement that the model's ceiling is lower.

Every figure is labelled a model-based estimate from published unit costs, not a quotation.

### 7.6 If this is not controlled

A red card with a summary, three to six consequences each traceable to a number on screen (days at or above the IMD threshold, the Heat Index band and its documented effect, work hours lost per worker per day from the WBGT category, wet-bulb), and who is hit first (outdoor workers, vendors and riders, the elderly and infants in poorly cooled housing, patients). Below it, a **chart**: for each of the next seven days, the hours an outdoor worker on a normal 09:00–17:00 shift spends inside the 12:00–16:00 danger window on days the forecast Heat Index reaches "Extreme Caution" or worse (4 h), against 0 h under the protocol's 06:00–11:00 order. "Show the theory" explains the dose–response reasoning (how hot × how long) with sources, and states plainly that no deaths or admissions are estimated because no mortality model is held.

### 7.7 Simulated actions and the Executive Brief

Three buttons, "Dispatch ward advisory", "Simulate SMS broadcast" (it counts characters and SMS segments) and "Log incident to SDMA", write time-stamped entries with reference numbers (e.g. SDMA-RJ-171020261423) to an action log kept in the browser. Nothing is sent anywhere, and the log says so. **Export Executive Heat Action Brief** opens a printable one-page document for the District Magistrate: situation, the heat-stress numbers, the 7-day forecast against the IMD threshold, the actions table, the labour order, the SMS texts, the SDMA incident, the cost, the consequences, the action log, assumptions, data sources, and which engine produced the plan.

---

## 8. The Mitigation Planner and the cost model

The planner answers "where should the money go?" for a state (across its cities) or for one city. It is deterministic: the same inputs always give the same plan, and every assumption is printed.

### 8.1 Three modes

| Mode | You enter | You get |
|---|---|---|
| I have a budget | A rupee amount (presets ₹25 L to ₹5 Cr, slider to ₹10 Cr) | An optimised split across cities and intervention types, risk before → after, allocation bars, "why this plan" bullets, a city-by-city table |
| I want to estimate a cost | One intervention and a quantity | Cost, projected cooling, risk before → after, the calculation lines |
| I have a target | A desired risk reduction (2–30 %) | The investment needed, found by binary search over the optimiser, or a statement that the target is beyond the model's ceiling |

### 8.2 The composite risk score (0–100)

```
t          = the higher of the forecast high and the live temperature
tempPts    = 10 (t < 25) · 30 (< 30) · 50 (< 35) · 70 (< 40) · 85 (< 45) · 95 (≥ 45)
surfacePts = clamp(MODIS season-peak surface − 35, 0, 10)
builtPts   = built-up % × 0.2
canopy     = clamp(tree cover % / 30, 0, 1) × 10
risk       = clamp(round(tempPts + surfacePts + builtPts − canopy), 0, 100)
```

Labels: ≥ 80 CRITICAL, ≥ 65 HIGH, ≥ 45 MODERATE, otherwise LOW. A confidence grade (high / medium / low) reflects how much of the input is real data for that city rather than a fallback.

### 8.3 Unit costs (all printed in the app)

| Item | Unit cost | Basis |
|---|---|---|
| Cool roof, lime-wash, 1,000 sq ft | ₹2,500 per roof | ₹1.25 per sq ft (midpoint of the Ahmedabad 2017 pilot's ₹0.5–2) + ₹1,250 labour |
| Plantation | ₹1.40 L per hectare | 400 trees × ₹350 including three years' care |
| Cooling centre | ₹5 L | assumption |
| Drinking-water station | ₹50,000 | assumption |
| Reflective pavement | ₹15 L per hectare | ₹150 per m² |
| School / hospital heat retrofit | ₹1.5 L | assumption |

### 8.4 How the optimiser works

Each city's "priority core" is a 1 km radius (about 314 ha). Candidate packages are generated per city (1 ha of plantation, 100 cool roofs, a cooling centre, 1 ha of reflective surface, a facility retrofit), each with an estimated risk-point gain: cooling of 18 °C per unit of tree fraction, 14 per unit of roof fraction, 12 per unit of reflective fraction (the same illustrative coefficients the dashboard sliders use), at 4 risk points per °C; cooling centres 1.5 points, water stations 0.15, facilities 0.4. The optimiser is greedy: it repeatedly buys the package with the best points-per-rupee, weighted by the city's risk and built-up share, with diminishing returns (×0.9 for every ₹25 L already spent in the same city) and a 40 % cap on relief spending, until the budget is exhausted. The reported reduction carries a ±20 % band. Population is not modelled, because no verified per-city table is held; the planner says so.

---

## 9. The city dashboard, workspace by workspace

Every workspace follows the same pattern: a numbered header, a row of headline tiles, analytical sections, and a "Show detail panels" drawer at the bottom that keeps every earlier panel intact. Every number carries a coloured provenance label: LIVE, CACHED, DEMO, FORECAST, ENSEMBLE, SATELLITE, RECORDED, ESTIMATE, RULE-BASED, AI-GENERATED, SELF-REPORTED or UNAVAILABLE. Every chart has labelled axes with units, the relevant IMD threshold line, and a "How to read" line that states the takeaway in plain words. A chart with nothing to show says so (for example "0% on every day") instead of looking empty.

### 9.1 Overview: City Intelligence Command Center

| Part | What it shows | Source |
|---|---|---|
| Photographic hero | The city's landmark photograph with its licence and creator (section 17), district count, coordinates, elevation and how many of the state's cities are live | Wikimedia Commons; app data |
| Headline tiles | Current temperature and feels-like; Heat Risk Index (0–100 ring); People at risk, shown as **UNAVAILABLE** because no approved population dataset is held; active alerts by severity | Open-Meteo; composite model; rules |
| 01 City climate map | The state's districts coloured by live air temperature, MODIS surface temperature, or satellite imagery; click a district to open its city | Open-Meteo, NASA MODIS, Esri |
| 02 Urban morphology | Land-cover bars, 7-day forecast highs, highest-reading districts, hottest cities in the state | ESA WorldCover, Open-Meteo |
| 03 Composite risk and triage | Risk ring, activation level, priority alerts, key insights, the top three rule-based actions, and Economic impact shown as **UNAVAILABLE** | Rules on live data |
| Detail panels | Weather conditions, "How dangerous is the heat?", AI Co-Pilot, checklist, 7-day outlook, 30-day trend (gaps shown where the archive has no reading), satellite indices, precautions | As in earlier editions |

Every alert on this screen is derived from data. The fixed "Global Climate Systems" panel and the hardcoded "Marine heatwave active" and "MODERATE urban heat" alerts were removed on 19 October 2026.

### 9.2 Prediction: Forecast Intelligence

The deterministic forecast says what one model run expects. The **ensemble** asks how sure we are: the same weather model (NOAA GFS, served by Open-Meteo) is run 31 times from slightly different starting conditions.

| Part | What it shows |
|---|---|
| Heatwave probability | The share of the 31 runs that meet the IMD threshold rule for this terrain on 2 days in a row, or reach 45 °C on any day, within 7 days. Example: "0% · 0 of 31 runs meet the criterion". |
| Forecast peak and uncertainty | The middle forecast's peak, the range 8 in 10 runs fall inside, and the average spread (±°C). |
| 01 Daily maximum chart | Shaded likely range, the middle forecast with its values, the standard single-run forecast as a dashed line, and the red IMD threshold. A 72-hour hourly view is one click away. |
| 02 Chance of a heatwave-level day | One bar per day: the share of runs reaching the threshold. |
| 03 District risk timeline | Seven days × up to eight cities (the selected city and the state's hottest), each cell coloured by IMD class. Each city stands in for its district, and the panel says so. |
| 04 How to read this forecast | The method and what is not included. |
| Detail panels | The District Magistrate's weekly brief, budget plan and outlook from earlier editions. |

This is agreement between runs, not a calibrated probability and not an IMD warning. The IMD "departure from normal" rule is not applied because the project holds no per-city climatological normal. The ensemble is fetched live, cached for 30 minutes, and used under Open-Meteo's non-commercial terms.

### 9.3 Analysis: Geospatial Heat Intelligence

A GIS-style layout: a layer rail on the left (air temperature now, today's forecast high, MODIS surface temperature, built-up share), a basemap switch (dark or satellite) and an opacity slider; the state's district map in the centre; and a district drill-down on the right. Clicking a district shows its photograph, its value and how it was derived (own city or nearest cities), its rank in the state, the nearest city's live readings and land cover, and a button to open that city.

Three diagnostics sit under the map:

- **How the districts compare:** a histogram of district values with the hottest and coolest named.
- **Do more built-up cities run hotter?** Cities are grouped by built-up share (under 20%, 20–40%, 40–60%, 60% or more). Bars show each group's average high; under each bar is the same group compared with the typical town in its own state. Today this reads: built-up cities have higher highs (about 28 °C → 33 °C), but compared fairly within their own state the most built-up cities are under 1 °C warmer, because many lightly built cities are cool hill towns. The full 171-city scatter is one click away. This is a descriptive pattern, not proof of cause.
- **Data coverage:** how many districts have their own reading, a nearest-city value, a sparse estimate, or none.

The detail panels keep the MODIS panel, the Random Forest scorecard (see the note below), land cover, urban morphology, the heat grid and the data pipeline.

> **About the machine-learning model.** It is a research prototype and the panel says so: a scikit-learn Random Forest trained on 341 rows from 20 global megacities (not India) to predict surface temperature from vegetation, built-up and elevation. On a random split it scores R² 0.95; when five whole cities are held out it scores R² −0.39, meaning it does not generalise to unseen cities. The app shows both numbers and uses the model for nothing on screen.

### 9.4 Compare: Multi-City Intelligence

Any two to four of the 1,932 cities side by side. The first column follows the city selected in the header; the others are remembered on this browser. Each city card shows its photograph and credit, air temperature now, today's high, Heat Risk Index, AQI, built-up share and the MODIS season peak, each with its label. Below: a side-by-side bar for any chosen metric; the 7-day forecast highs of every city on one chart with the 40 °C line; synchronised satellite maps (zooming one zooms all, with a dashed ring for the ~5 km land-cover sample); and an optional AI summary written by Gemini from the numbers on screen only. The older radar panel remains in the drawer.

### 9.5 Interventions: Heat Action & Resource Planning

| Part | What it shows |
|---|---|
| Action tracker | The rule-based actions for the city's activation level (NDMA / Ahmedabad Heat Action Plan), each with priority, owner, deadline, a note field and a status: **Recommended, Planned, In progress, Completed, Marked verified (self-reported)**. Officers can add local actions. Filters: all, open, P1, P2, P3. |
| Status board | Counts per status and a priority × open/done table. |
| Budget allocation | The existing optimiser at ₹25 L, ₹50 L, ₹1 Cr or ₹5 Cr: spend by intervention type and the projected risk change. Economic loss avoided is **UNAVAILABLE**. |
| Activity log | Who changed which action, from what to what, and when. |
| Export | The whole tracker as CSV. |

A notice on the screen states where statuses live: in this browser only. They are not sent to a server, not visible to other officers, and are lost if site data is cleared. "Marked verified" is the officer's own declaration; the app does not check field work. The earlier panels (green-cover plan, sliders, Cool Roof calculator, city planner, outlook, wind) are in the drawer.

### 9.6 AI + Export: Decision Support

The AI Heat Co-Pilot (section 7) sits beside a report builder. Choose **Daily, Weekly or Custom** (any date range in the last 366 days). The report uses recorded daily readings from the app's own archive (`/api/weather-history`), today's live reading and the forecast. Headline tiles show days with data (and how many are missing), the highest day high and days at or above the threshold, and mean and maximum AQI. Exports: **CSV** of every row behind the report, and a **printable report** that the browser saves as PDF, with the current situation, recorded readings, the 7-day forecast and every action with its status. A snapshot of action statuses from the Interventions workspace sits below. AGNI chat, quick share, glossary and team details are in the drawer.

---

## 10. AGNI, the AI analyst

AGNI (Analytical Ground-level heat iNtelligence Interface) is a chat assistant grounded in the numbers on screen. The browser sends the question to the app's own server, which calls Google Gemini; the API key never reaches the browser. The model is given the selected city's live readings, readings for any other city or state named in the question, an India-wide ranking block for "hottest / cleanest" questions, a satellite line, and the preferred reply language. Its instructions: use only the numbers given, say "no data" otherwise, tag anything else "(estimated)", stay on heat, climate, air quality and planning, India only, never write code, and reply in the language the user writes in (it handles Hindi and Hinglish). Limits: 10 questions a minute per visitor; if the AI is unreachable, heat questions get a templated answer from the on-screen data, clearly marked as an offline fallback. The site's interface is translated into 11 Indian languages.

---

## 11. Every formula and threshold

### 11.1 Heat Index (US NWS)

```
T in °F, RH in %
simple = 0.5 × (T + 61 + (T − 68) × 1.2 + RH × 0.094)
if mean(simple, T) < 80 °F → HI = simple
else (Rothfusz 1990):
HI = −42.379 + 2.04901523 T + 10.14333127 RH − 0.22475541 T·RH − 0.00683783 T² − 0.05481717 RH²
     + 0.00122874 T²·RH + 0.00085282 T·RH² − 0.00000199 T²·RH²
RH < 13 % and 80–112 °F: HI −= ((13 − RH)/4) × √((17 − |T − 95|)/17)
RH > 85 % and 80–87 °F:  HI += ((RH − 85)/10) × ((87 − T)/5)
Bands: Caution ≥ 26.7 °C · Extreme Caution ≥ 32.2 · Danger ≥ 39.4 · Extreme Danger ≥ 51.7
Above 135 °F (57 °C) the NWS chart ends; the app shows "> 57 °C".
```

### 11.2 Wet-bulb (Stull 2011)

```
Tw = T·atan(0.151977·√(RH + 8.313659)) + atan(T + RH) − atan(RH − 1.676331)
     + 0.00391838·RH^1.5·atan(0.023101·RH) − 4.686035
(T in °C; valid RH 5–99 %, T −20…50 °C; ±1 °C)
```

### 11.3 WBGT, shade estimate (ISO 7243) and work/rest (TB MED 507)

```
WBGT = 0.7 × Tnw + 0.3 × Tg,  natural wet-bulb Tnw ≈ Tw,  globe Tg ≈ air T in shade
Category 1 ≥ 25.6 °C: no limit · 2 ≥ 27.8: 50/10 min · 3 ≥ 29.4: 40/20 · 4 ≥ 31.1: 30/30 · 5 ≥ 32.2: 20/40 (moderate work)
Work hours lost per 8-h shift = rest minutes per hour / 60 × 8
```

### 11.4 Demo humidity (why a forced 46 °C does not give an impossible number)

When a rehearsal link forces a temperature, the app keeps the day's real moisture content (dew point) and recomputes relative humidity at the new temperature with the Magnus formula, because heating air lowers its RH. Without this, 46 °C with an evening's 60 % RH would give a 38 °C wet-bulb, which has never been observed on Earth.

### 11.5 State colour

Take every city in the state with a reading; the state's temperature is their median; the colour is the bucket with the most cities, ties to the hotter bucket. Readings under 45 minutes old are used alone when at least min(5, n) exist. Under the spectral palette the colour is the continuous colour of the median.

### 11.6 IMD heatwave outlook

```
threshold = 40 °C plains · 37 °C coast · 30 °C hills (elevation ≥ 900 m)
day level: ≥ 47 severe · ≥ 45 heatwave · ≥ threshold watch · ≥ threshold − 3 warm · else normal
spell = 2+ consecutive days at watch or worse
```

### 11.7 Urban heat island gap

```
UHI = city temperature − temperature at (lat + 0.35°, lon + 0.10°)
≤ 0 parity · ≤ 1.5 mild · ≤ 3.5 moderate · > 3.5 severe
```

### 11.8 Interpolation (IDW)

```
value(x) = Σ wᵢ·vᵢ / Σ wᵢ,  wᵢ = 1 / (dᵢ² + ε), over the 8 nearest readings
blank beyond 1.5° (~150 km); 4° on sparse layers
district value = direct city reading if names match,
                 else 1/(km+5)-weighted mean of the 2 nearest same-state cities within 150 km
```

### 11.9 Wind vectors

```
Open-Meteo gives speed (km/h) and the direction the wind blows FROM (°).
u = −speed·sin(dir),  v = −speed·cos(dir)
```

### 11.10 Air quality bands (US AQI)

≤ 50 Good · ≤ 100 Moderate · ≤ 150 Unhealthy for Sensitive Groups · ≤ 200 Unhealthy · ≤ 300 Very Unhealthy · > 300 Hazardous.

### 11.11 Ensemble heatwave probability

For each of the 31 runs, take its daily maxima for the next 7 days. A run **qualifies** if it has 2 consecutive days at or above the terrain threshold T (40 °C plains, 37 °C coast, 30 °C hills at 900 m or more), or any day at 45 °C or more.

```
probability = qualifying runs ÷ runs with at least 2 valid days
per-day chance = runs with max ≥ T that day ÷ runs with a value that day
likely range = 10th to 90th percentile of the runs' daily maxima (linear interpolation)
uncertainty  = ½ × mean(90th − 10th percentile) over the week
```

Missing values are dropped and the counts are shown, for example "27 of 31 runs".

### 11.12 Built-up comparison within the same state

For each classified city: `difference = its forecast high − median forecast high of all live cities in its state` (states with at least 5 live cities). The value under each built-up band is the average difference of its cities. Comparing within the state removes most of the climate effect (hills, coast, desert) that dominates the raw averages.

---

## 12. Real, estimated, or fixed? The honesty rule

### Measured or live

- City temperature, humidity, wind, forecast, AQI and pollutants (Open-Meteo); state medians and colours; the hottest-cities list.
- NASA MODIS surface temperature, quality-filtered; cloud days left as gaps.
- NASA VIIRS daily imagery; Esri imagery.
- ESA WorldCover land cover for 171 cities; OpenStreetMap building counts; SRTM elevation.

### Estimated, and labelled as such on screen

- A state with no live cities ("estimated"); land cover for a city outside the 171 ("est. from X, ~N km"); districts without their own city ("nearest cities …" or "estimated (rounded) from …").
- The modelled "Surface Temp (live)" on the Overview, labelled as not a satellite reading.
- The heat grid's ±2 °C pattern, the intervention sliders, and every planner outcome ("model-based estimates").
- The WBGT ("shade estimate"), the wind probe's heat-load and ventilation labels ("heuristic"), the 14-day satellite composite.
- Demo-link temperatures (banner: "this browser only, not real data").

### Self-reported, and labelled as such

- Intervention statuses, notes and added actions (Interventions workspace): set by the officer on one browser, never verified by the app.

### Not available, and shown as UNAVAILABLE

- People at risk (no approved population dataset) and economic impact (no validated source). Nothing is substituted.

### Fixed text with no live source (still to label or remove)

- On the classic-map ticker: "El Niño Active" and "Sat Pass: Next 16:45 IST"; the "SAT ACTIVE" and "AGENT ONLINE" badges; the progress tracker in the AI + Export drawer.
- Removed on 19 October 2026: the Global Climate Systems panel, the "Marine heatwave active" alert and the baseline "MODERATE urban heat" alert.

---

## 13. Technical architecture

| Area | Detail |
|---|---|
| Front end | React 18 + Vite; Tailwind and plain CSS; Leaflet for the Command Center map (no API key, no paid service); react-simple-maps + d3 for the classic map; Recharts for charts; HTML5 canvas for the wind particles and the thermal raster; i18next for 11 languages. |
| Server | Vercel serverless functions: `/api/ask-ai` (AGNI → Gemini), `/api/heat-agent` (Co-Pilot: Agent37 → Gemini → rules), `/api/weather-history`, and two cron routes for the cache refresh. The Vite dev server mirrors them, so `npm run dev` runs everything locally. |
| Secrets | Only server-side environment variables: `GEMINI_API_KEY`; optional `AGENT37_API_KEY` / `AGENT37_INSTANCE_ID`; `GITHUB_TOKEN` and `CRON_SECRET` for the refresh. No key is ever shipped to the browser. All map and weather services used by the browser need no key at all. |
| Data refresh | GitHub Actions (hourly by day, three-hourly at night) commits the bulk cache and a daily snapshot; the commit redeploys the site. |
| Offline behaviour | Map, cached readings, satellite archive, land cover, planner, heat stress, the Co-Pilot's rule-based protocol, the brief and exports all work without internet. Live fetches, AI calls, imagery tiles and the wind layer need it; each fails to a labelled fallback, never to a blank screen (error boundaries wrap the app and the map). |
| Images | Location photographs come from Wikimedia Commons, then Openverse, then a branded placeholder, with licence checks and attribution (section 17). Openverse's anonymous limit (5 searches an hour) is respected in the browser; an offline builder fills the rest. |
| Tests | `npm test` runs 11 unit tests for the image resolver (licence and evidence rules, source order, switches, broken-link fallthrough, rate-limit budget). `npm run build` is the production build. |
| Validation | Every AI reply is parsed, validated and clamped before it reaches the page; URL parameters are strictly parsed (junk values are ignored, never coerced); rate limits protect the AI routes. |
| Storage | Accounts, settings, checklist ticks, intervention statuses, compare choices, action logs and last-known weather live in the browser's local storage. Nothing about users is sent to a server. |

---

## 14. Limits and known gaps

- No ward boundaries, population, or facility locations are held, so plans describe zones by type and the AI is barred from inventing wards. Deep zoom shows real roads and buildings from Esri/OpenStreetMap, not wards.
- No mortality model: the app never estimates deaths or hospital admissions.
- Satellite surface temperature is the ground, not the air; the 14-day composite is labelled; monsoon weeks have few clear-sky readings.
- Land cover covers 171 cities (2021 data); schools and hospitals only 6 cities.
- Accounts are browser-only; the inner sign-in screen after logout accepts any non-empty credentials.
- Agent37 is integrated but not active in production (no instance), so the Co-Pilot runs on Gemini; the team cannot claim Agent37 use.
- Several fixed-text widgets remain (section 12) and should be labelled or removed before judging.
- Open-Meteo's free tier can rate-limit a single IP after very heavy use; the app then shows cached readings, labelled. The ensemble forecast is free for non-commercial use only.
- Intervention statuses are stored in one browser; there is no shared backend for them yet.
- The district risk timeline uses each district's city forecast; no per-district forecast is held.
- The report's archive has gaps on days the refresh failed (for example 21 of 30 days for Jaipur in a 30-day report); the report counts them.
- Photographs: 80 of 619 districts still show a placeholder, and Openverse could not be checked on 20 October because its API was down (section 17).

---

## 15. Demo script and judge questions

### A three-minute walkthrough

1. **0:00–0:40, the problem.** Open https://heatops.vercel.app and sign in as Government / Planner. "India loses thousands of lives to heat every year; a district officer has an IMD bulletin and a phone. This is the All-India view: 1,932 cities live, satellite surface temperature, and the hottest city right now."
2. **0:40–1:10, the data.** Switch to Satellite, then Surface temperature; drag Historical to 2019, then 2024: "real NASA readings, year by year". Zoom into a state: per-district colours; hover a district: "reading from Unnao".
3. **1:10–1:40, the city.** Click "Full dashboard". Overview: the landmark photo with its licence, the risk ring, and "People at risk: UNAVAILABLE. We don't invent numbers we don't hold." Open **Prediction**: "31 forecast runs; this is the chance of a heatwave, and this is how sure we are."
4. **1:40–2:30, operations.** Use the rehearsal link (`?demo=Jaipur:46`): the triage turns CRITICAL. In **AI + Export**, run the Co-Pilot: actions with owners and deadlines, the labour order, the SMS in Hindi, the cost in rupees, and the "if this is not controlled" chart. In **Interventions**, set one action to In progress and one to Marked verified, then export the tracker.
5. **2:30–3:00, defence.** Show the weekly report and its PDF. "Every number has its source label. Every chart says what it means. What we don't have, we say. Open-source maps, no paid keys."

### Questions to expect, and the honest answers

| Question | Answer |
|---|---|
| Is this just a weather wrapper? | The weather is one input. The product is the triage rules, the heat-stress maths, the satellite archive, the cost model, the optimiser and the AI protocol, all on screen with their working. |
| Why is the AI output trustworthy? | It is given only our numbers and unit costs, told to list what it lacks, and its reply is validated before display. The banner names the engine. The rule-based protocol is one click away and is what runs offline. |
| Why are the hills red in the satellite view? | Because MODIS measures the ground at 10:30 am; bare high-altitude rock gets hotter than the air. The tooltip says "surface", and the long-record cities in J&K are on the Jammu side. |
| Where are the ward boundaries? | There is no public dataset for them; we show real roads and buildings and never label anything a ward. |
| How many deaths will this prevent? | We don't estimate deaths; no validated India-wide model exists. We show exposure hours and work hours lost, which are measurable, and cite the Ahmedabad plan's published effect. |
| What does "heatwave probability 0%" mean? | None of the 31 ensemble runs reaches the IMD threshold on two days in a row this week. It is agreement between runs, not an IMD warning; the method is on screen. |
| Are built-up cities really hotter? | On raw averages yes (about 28 °C → 33 °C), but compared with towns in their own state the gap is under 1 °C today; daytime air temperature hides most urban heat, which shows more in the satellite surface layer and at night. |
| Is the intervention tracker an official record? | No. It is a working aid stored on the officer's browser, labelled self-reported, and exportable to CSV for filing. |
| Can a government deploy this? | Yes: open-source stack, no paid keys, server-side secrets, IMD or CPCB feeds can replace Open-Meteo behind the same interface; Open-Meteo itself can be self-hosted for a paid deployment. |

---

## 16. Glossary

| Term | Meaning |
|---|---|
| AQI | Air Quality Index, 0–500, from pollutant concentrations; the app uses the US EPA scale. |
| Built-up fraction | Share of land covered by man-made surfaces (ESA WorldCover class 50). |
| Choropleth | A map that colours areas by a value. |
| Composite | A satellite layer built from each location's most recent clear-sky reading within a window. |
| Dew point | The temperature at which the air's moisture would condense; a measure of absolute humidity. |
| Elevation | Height above sea level, metres. |
| Ensemble | Many runs of the same weather model from slightly different starting conditions; their spread shows how certain the forecast is. |
| Heat Action Plan (HAP) | A city or district's pre-agreed set of heatwave measures (Ahmedabad's is the Indian model). |
| Heat Index | NWS "feels like" temperature from air temperature and humidity. |
| IDW | Inverse-distance weighting: interpolation that weights nearer readings more. |
| IMD | India Meteorological Department, the official forecaster and issuer of heatwave warnings. |
| LST | Land surface temperature, the ground's temperature as seen by a satellite. |
| MODIS | NASA's Moderate Resolution Imaging Spectroradiometer on the Terra and Aqua satellites; daily 1 km LST. |
| NDMA | National Disaster Management Authority, author of India's heatwave guidelines. |
| Openverse | A search engine for openly licensed images and audio, run by WordPress.org. |
| Open-Meteo | A free weather API aggregating national weather models; no key required. |
| Provenance label | The coloured tag beside a number saying where it comes from (LIVE, FORECAST, ESTIMATE, UNAVAILABLE…). |
| PM2.5 / PM10 | Airborne particles under 2.5 / 10 micrometres. |
| SDMA / DDMA | State / District Disaster Management Authority. |
| SRTM | NASA's Shuttle Radar Topography Mission, the global elevation survey. |
| UHI | Urban heat island: a city warmer than its surroundings. |
| ULB | Urban local body (municipal corporation or council). |
| VIIRS | NASA/NOAA imager on the Suomi NPP satellite; the daily true-colour picture. |
| WBGT | Wet-Bulb Globe Temperature, the occupational heat-stress standard (ISO 7243). |
| Wet-bulb temperature | The lowest temperature reachable by evaporative cooling; the physical limit of sweating. |

Sources named in the app: NWS Heat Index (Rothfusz 1990); Stull, J. Appl. Meteor. Climatol. 50 (2011); ISO 7243:2017; US Army TB MED 507; Vecellio et al., J. Appl. Physiol. 132 (2022); IMD heatwave criteria; NDMA heat-wave guidelines; Ahmedabad Heat Action Plan; NASA LP DAAC MOD11A1.061; ESA WorldCover 2021; NASA GIBS; Open-Meteo.

---

## 17. Location photographs

Every city and district has an identity photograph, a labelled auto-resolved photograph, or a branded placeholder. A photograph is never shown as a measurement, and an unrelated picture is never used.

**Order of sources:**

1. **Verified:** 34 hand-picked landmarks (for example India Gate, Hawa Mahal, Rumi Darwaza), fetched from Wikimedia Commons with their licence and author.
2. **Auto · Wikimedia Commons:** the lead image of the place's Wikipedia article, only if the file is hosted on Commons under a free licence, and not a map, flag, seal or SVG diagram.
3. **Auto · Openverse:** an openly licensed photograph found by Openverse search. Accepted licences are CC BY, CC BY-SA, CC0 and the Public Domain Mark; non-commercial and no-derivatives licences are rejected. A result needs a licence link, a creator for attribution licences, an HTTPS photo URL, a source page and a minimum size. The place must be named and corroborated by a second signal (the state or "India" in the title or tags, or the name in both); a title match alone is never accepted.
4. **Placeholder:** a branded card that says no verified photograph exists.

Auto-resolved photographs carry the label **"Auto-resolved · Not hand-verified"**. Every photograph shows its creator, licence and a link to its source page. If an image fails to load, the next source is tried. Openverse can be switched off on its own (`VITE_OPENVERSE_ENABLED=false`), as can its live lookup (`VITE_OPENVERSE_LIVE=false`).

**Measured coverage on 20 October 2026** (`node scripts/imageCoverageReport.mjs`, all 619 districts the map draws, district-level lookup):

| Status | Districts | Share |
|---|---:|---:|
| Verified | 21 | 3.4% |
| Auto-resolved · Wikimedia Commons | 518 | 83.7% |
| Auto-resolved · Openverse | 0 | 0% |
| Placeholder | 80 | 12.9% |

Every district was checked against Wikimedia. Openverse was not measured for the 80 placeholders because its API was down that day (its own health check reported a database outage). Coverage is therefore not complete, and the report says so. The full per-district list is in `docs/IMAGE_COVERAGE.md`.
