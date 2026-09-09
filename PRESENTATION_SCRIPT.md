# BhaskarOps — Presentation Script (ISRO BAH 2026, 9–10 September)

*A spoken script, not a click list. Say it in your own words; the facts are exact as of 8 September 2026 and every one of them can be shown live at https://heatops.vercel.app. The click path with timings is in `DEMO_SCRIPT.md`; this file is what you say while you click.*

Speak slowly. Judges remember three things: the problem, the one thing only you do, and the moment you were honest about a limit.

---

## 1. Opening (30 seconds)

> "Good morning. I am [name], and this is BhaskarOps — Bhaskar for the sun, Ops because it is built for the officer who has to act.
>
> Every summer, heat kills more Indians than floods or cyclones, and most of those deaths are in cities. The India Meteorological Department already tells a district *how hot* it will be and *when*. What no one tells a District Magistrate is *where* in their district the heat is worst, *why* it is worst there, and *what to spend their limited budget on*.
>
> BhaskarOps answers those three questions, for 1,956 cities, live, and it never shows a number it cannot trace."

---

## 2. The problem, in the judges' language (45 seconds)

> "Three gaps.
>
> **First, granularity.** Warnings are issued per district. Heat is not felt per district. A tin-roof colony and a tree-lined cantonment in the same district are ten degrees apart on the ground.
>
> **Second, explanation.** A colour-coded alert says 'red'. It does not say 'red because 63 % of this city is built-up and its tree canopy is 17 % against a 30 % target'. Without the *why*, there is no *what to do*.
>
> **Third, money.** A District Magistrate gets a heat-mitigation budget and a list of possible measures — cool roofs, plantation, cooling centres. Nobody gives them a ranked, costed plan for their own district. So the money goes where the last meeting pointed."

---

## 3. The solution, in one breath (30 seconds)

> "BhaskarOps is a live urban-heat decision platform for government authorities. It fuses four real sources — Open-Meteo live weather, NASA MODIS satellite surface temperature, ESA WorldCover land cover, and OpenStreetMap — for every city in India, and it closes the loop: **monitor, explain, decide, act.**
>
> The one thing only we do: you type a budget, and it hands back a ranked, costed, explained mitigation plan for your state or your city — and every rupee in it is traceable to a printed assumption."

---

## 4. What the app looks like — walk-through (5 minutes)

Describe each screen as it appears. The words in bold are what is on screen.

### 4a. Sign-in and the map (45 seconds)

*What they see:* a dark screen, a rotating Earth, a sign-in card. Then the India map: 28 states and 8 UTs, 594 districts, each state coloured green to red, small weather badges where it is raining or dusty, a ticker on top with the hottest city and worst air right now, and a **National Heat Summary** on the right.

> "This is the map as it is right now. Every state is coloured by the risk category *most of its cities are in*, from live readings — not an average that one desert town can drag. Hover a state and it tells you the count: 38 of 76 cities Moderate, 34 Low-Moderate. The colour rests on those numbers, and you can see them.
>
> On the right: the hottest city in India at this minute, today's forecast peak city, how many states are in High risk, and the national average. All from the same live cache, refreshed every hour by day."

### 4b. A state, and the Smart Mitigation Planner (90 seconds) — the USP

*What they see:* click Rajasthan. The right column becomes the state panel: a risk badge, the city-count breakdown behind the colour, the median temperature, and the list of all 76 cities with live readings. Under the state name, an orange button: **SMART MITIGATION PLANNER — WHERE SHOULD THE MONEY GO?**

> "Imagine you are the state's heat officer. You have one crore rupees. Where does it go?"

*Click the button. A chip reads* **FOR THE STATE OFFICER / CMO — BUDGET ALLOCATION ACROSS CITIES.** *Click* **₹1 Cr** *then* **OPTIMIZE MY PLAN**.

> "In under a second: Bikaner, Jaipur, Jodhpur, Kota. Ranked on four real inputs — the forecast high, NASA's season-peak surface temperature for that city, ESA's built-up share, and the tree-canopy gap. The budget is spent where each rupee removes the most projected risk: plantation and cooling relief here, ₹99.6 lakh allocated, the ten highest-risk cities move from 78 to 76 on our composite score.
>
> Two things I want you to notice. The **Why this plan?** box explains the choice in sentences — a finance officer can argue with it. And the word **projected** is on every outcome, with a confidence tag."

*Click* **VIEW ON MAP** *— four markers appear with before → after. Click one.*

> "Each funded city opens with its inputs and its packages: so many roofs, so many hectares, a cooling centre."

*Click* **SAVE AS PLAN A**, *then* **₹50 L**.

> "Change the budget and it re-optimises live — Plan A against the current plan, side by side. This is not a page of numbers. It is a constraint solver."

*Click* **COST ASSUMPTIONS & METHOD**.

> "Every unit cost is printed. The cool-roof rate comes from the Ahmedabad 2017 pilot tier. The rest are stated assumptions a state can replace with its schedule of rates. And one line you will not see in most prototypes: **population is not modelled**, because we do not have a verified per-city table — so the plan reports roofs, hectares and facilities, not a population figure we made up."

### 4c. A city dashboard — Overview (45 seconds)

*What they see:* search Jaipur, open it. Five tabs: OVERVIEW, ANALYSIS, COMPARE, INTERVENTIONS, AI + EXPORT. Overview shows the live weather card with a source under every metric, a Heat Risk Gauge, active alerts, the **Heatwave Action Checklist**, a **30-day temperature trend**, and **Today's high vs low**.

> "For the District Magistrate. Live weather with the source under each number. The Heat Action Plan checklist changes with severity: full activation at High or Extreme — cooling centres, hospital alert, advisory, tankers — preparedness at Moderate, routine at Low, and a cold-weather protocol below 10 °C. Ticks are saved per city with timestamps.
>
> The 30-day trend is our own archive, one real reading a day since June. Where we could not reach a city that day, the dot is hollow. Nothing is interpolated."

### 4d. Analysis — the satellite (45 seconds)

*What they see:* the ANALYSIS tab. A pipeline list of six real sources, ESA land cover bars, OpenStreetMap building density, and the **SATELLITE SURFACE TEMPERATURE (NASA MODIS)** panel with four cards and a weekly chart.

> "This is what NASA's Terra satellite saw on Jaipur's roofs and roads at 10:30 every clear morning since March — hottest surface 40.3 °C on 28 May. The gaps in the chart are cloud days, left empty. The dashed line is the live air temperature, because surface and air are different measurements and we show both without pretending they are the same. 1,912 cities have this."

### 4e. Interventions — the DM's planner and the sliders (45 seconds)

*What they see:* the INTERVENTIONS tab. At the top of the right column, **MITIGATION PLANNER — JAIPUR** with the chip **FOR THE DISTRICT MAGISTRATE — BUDGET ALLOCATION WITHIN THIS CITY**. On the left, three sliders — Urban Greening, Cool Roofs, Water Bodies — and a cool-roof comparison with the ROI calculator.

> "The same engine, now for one city. One crore in Jaipur buys this. Press **APPLY PLAN TO SLIDERS** and the cooling sliders take the plan's values — the projected cooling and the heat grid on the Analysis tab follow. Data to decision to action, on one screen."

### 4f. AGNI and export (30 seconds)

*What they see:* the AI + EXPORT tab. A chat box. Ask: **"What did the NASA satellite measure for Jaipur this season?"**

> "AGNI is our analyst — Gemini behind a proxy, grounded only on our data: this city, any city you name, an India-wide ranking, and the satellite summary. Ask it about the world and it refuses, because it only has India."

*The answer names 40.3 °C on 28 May.* *Then* **EXPORT** *— CSV, PDF, WhatsApp.*

### 4g. Citizen view — one breath (15 seconds)

*Click* **Citizen** *in the nav bar, then back.*

> "The same data in plain language for residents — safe hours, a WhatsApp share, eleven languages. It exists; the product is built for the authority."

---

## 5. Honesty — say it out loud (30 seconds)

> "We removed more than we added this week. Panels that generated 'history' from a city-name hash are gone. Where a city has no reading, it says NO LIVE DATA. Our machine-learning model prints its weak score, −0.39 on unseen cities, next to its good one. The demo override that forces a temperature shows a banner that says it is a demo. A judge who checks any number will find its source — or a label saying it is an estimate."

---

## 6. Close (20 seconds)

> "IMD tells you how hot and when. BHRIGU gives you twenty years of evidence. BhaskarOps tells the officer *where*, *why*, and *what to spend on* — today, for 1,956 cities, at zero rupees a month, and it never fakes a number.
>
> BhaskarOps: live heat intelligence for India, honest by design. Thank you."

---

## 7. Questions you will get, and the answers

**"Is the cooling projection real?"** — "No, and it says so. The cooling coefficients are an illustrative model, labelled on every screen. The inputs are real: live temperature, satellite surface temperature, land cover, building density. The projection is what those inputs put through a stated model give. We would rather show a labelled estimate than a fake measurement."

**"Where does the ₹2,500 per roof come from?"** — "The Cool Roof calculator's basic lime-wash tier, ₹0.5 to ₹2 per square foot from the Ahmedabad 2017 pilot, at the midpoint on a 1,000 sq ft roof, plus ₹1,250 for labour and awareness. It is printed in the assumptions table."

**"Why no population?"** — "We do not have a verified per-city population table. Built-up share stands in for exposure, and the panel says population is not modelled. Give us the Census table and it goes in the same afternoon."

**"How is this different from BHRIGU?"** — "BHRIGU is a 23-year research archive at 1 km — excellent evidence. BhaskarOps is live, operational, and ends in a plan. We complement it; we do not replace it."

**"What keeps it fresh?"** — "A GitHub Actions job rebuilds the 1,932-city cache every hour by day and every three hours at night, retrying connection failures; the browser re-samples every state live and reloads the cache every fifteen minutes. The last run carried zero cities forward."

**"Where is ISRO data?"** — "Requested from MOSDAC for INSAT-3D; not yet granted. NASA MODIS is in because it arrived first. The pipeline that ingests one will ingest the other."

**"Why did Telangana appear only yesterday?"** — "The boundary data predated the 2014 bifurcation. We rebuilt both states from their districts and it is now correct."

---

## 8. If something breaks

- **Network dead:** open the screenshots folder and narrate the same script over them.
- **AGNI rate-limited:** "free-tier quota — here is the answer from an hour ago" and show the screenshot; move on.
- **A city has no live reading:** point at NO LIVE DATA and say "that is the honesty rule working".
- **Planner shows a message instead of a plan:** read the message aloud — it is one of the designed edge cases (budget below minimum, target beyond the model's ceiling).
