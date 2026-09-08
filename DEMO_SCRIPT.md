# BhaskarOps — 8-minute demo script (ISRO BAH 2026, 9–10 Sept)

Open **https://heatops.vercel.app/?demo=Leh:-8,Sri%20Ganganagar:46** before you start (hard-refresh once). Sign in — it lands on the **Government / Planner** view. Keep phone hotspot ready as backup network. Timings are targets; the total is ~8 minutes.

## 0:00 — Opening line (map screen)
> "Every number on this screen can be clicked and traced to its source. IMD tells you how hot and when; BhaskarOps tells you *why*, *where*, and *what to do* — for 1,932 Indian cities, live."

Point at: the map colours ("each state shows the category most of its cities are in right now — hover and it tells you the count, e.g. 38 of 76 cities Moderate"), a weather badge, the "updated X min ago" line, and in the National Summary the hottest-cities list with its **"peak 40°"** tags and the **Today's forecast high** card ("now vs expected — both from the forecast, neither invented").

## 0:45 — The map is live, not a picture
Click **Rajasthan**. Say: "Opening a state reads all its cities live in one call — see the green dots." Hover the state tooltip: the per-category city counts behind the colour, and the median temperature as the headline number. Scroll the city list: "no number here is estimated — a city we can't reach says NO LIVE DATA."

## 1:30 — City dashboard (Sri Ganganagar → forced 46 °C by the demo link)
Search **Sri Ganganagar** → Overview. The banner says "DEMO — forced to 46 °C, not real data". Say it out loud: *"Our demo mode is labelled, because our product never fakes a reading — even for a demo."* Show: the red theme, the Heat Risk Gauge, the live weather card with sources under each metric. Scroll to **30-DAY TEMPERATURE TREND** — "this is our own archive, one real reading a day since June; hollow dots are days we could not reach the city and say so" — and **TODAY'S HIGH vs LOW** from the forecast.

## 2:30 — The action layer (Authority)
Scroll to **HEATWAVE ACTION CHECKLIST** — "ACTIVE — Extreme". "Five Heat Action Plan steps, modelled on Ahmedabad's HAP and NDMA guidelines. Tick one." Then: "At Moderate it becomes preparedness; at Low, routine; below 10 °C it becomes a cold-weather protocol." *(Optional: search Leh → −8 °C → cold checklist, 20 seconds.)*

## 3:30 — The decision engine: Smart Mitigation Planner (the USP)
Back on the map, open **Rajasthan** → press **SMART MITIGATION PLANNER — WHERE SHOULD THE MONEY GO?**
> "Imagine you are the District Magistrate. You have ₹1 crore for heat mitigation. Where does it go?"

Click **₹1 Cr** → **OPTIMIZE MY PLAN**. Read out: "Bikaner, Jaipur, Jodhpur, Kota — ranked on the forecast high, NASA's season-peak surface temperature, ESA built-up share and the canopy gap. Plantation and cooling relief, ₹99.6 L allocated, the ten highest-risk cities move from 78 to 76 — projected, labelled, with a confidence tag." Point at **WHY THIS PLAN?** — "the reasons are sentences, not a black box."
Click **VIEW ON MAP** — four markers appear with before → after. Click one: "the city's inputs and its packages."
Click **SAVE AS PLAN A**, then **₹50 L**: "it re-optimises in real time — Plan A versus current, side by side. This is not a static page; it is a constraint solver."
Open **COST ASSUMPTIONS & METHOD**: "every unit cost is printed — the cool-roof rate comes from the Ahmedabad 2017 pilot tier; the rest are stated assumptions a finance officer can replace. Population is not modelled because we have no verified table, and it says so." **EXPORT REPORT** → the text report for the DDMA meeting.

## 5:15 — Why it's hot + what to do (fast)
**Analysis** tab: scroll to **SATELLITE SURFACE TEMPERATURE (NASA MODIS)** — "this is what Terra saw on Delhi's roofs and roads at 10:30 every clear morning since March: hottest surface 39.9 °C on 20 May, and the gaps are honest — cloud days are left empty, not filled in." Then the heatmap grid — "base is the live temperature; the cell pattern is labelled illustrative."
**Interventions** tab: first the **MITIGATION PLANNER — SRI GANGANAGAR** box — "the same engine, now scoped to this one city for its DM: ₹1 crore here buys this, and this is what it projects" (one click on ₹1 Cr → OPTIMIZE). Then **Recommended plan** — "Tree canopy 9.7 % vs the 30 % target of the 3-30-300 rule; +20 points; Apply." Click **Apply recommended plan** → projected cooling appears. "The cooling model is illustrative and says so; the canopy number is ESA satellite data."

## 6:00 — Compare
**Compare** tab: add Jaipur, Bikaner. "Same chart, two jobs — a collector ranks cities for cooling budgets; a citizen asks *is my city hotter than my parents' city?*"

## 6:30 — AGNI (one pre-tested question)
Floating AGNI button → ask exactly: **"Which Indian city has the best AQI right now?"** Say: "Grounded on our own cache — it will name real cities, and if you ask it about the world it refuses, because it only has India." *(Have the answer screenshot ready in case of quota/network.)*

## 7:00 — Citizen view (thirty seconds, not more)
Switch **Citizen** (navbar) for one breath: "the same data in plain language for residents — safe hours, a WhatsApp share, 11 languages". Switch back. The pitch stays with the authority.

## 7:30 — Data credibility + close
**AI + Export** tab → Export & Share (Copy / WhatsApp / CSV / PDF). Then the honesty line:
> "Every source is named — Open-Meteo, ESA WorldCover, NASA MODIS satellite surface temperature for 1,912 cities, ISRO INSAT-3D requested. Our ML model prints its weak score next to its good one. It refreshes itself every three hours from GitHub. Running cost: zero rupees."

> "BhaskarOps: live heat intelligence for India — honest by design, useful to a citizen and a collector alike."

## If things go wrong
- **Network dead:** open the recorded screen video / screenshots folder; narrate the same script.
- **AGNI busy:** say "free-tier quota — here's the answer from an hour ago" and show the screenshot; move on.
- **Banner confusion:** "That banner is our demo mode — remove `?demo` and every number is live." Show it live on Jaipur.
- **"Isn't this just IMD/BHRIGU?"** — "We complement both: IMD alerts, BHRIGU's archive, our live action layer."

## Pre-demo checklist (morning of)
- `REFRESH_BEFORE_JUDGING.md` freshness check (cache < 3 h old, carried-forward small)
- Hard-refresh the demo tab; sign-in works; demo link loads; AGNI question answered once; planner: Rajasthan → ₹1 Cr → OPTIMIZE gives a plan (if a city has no live reading it is listed as unranked — that is fine)
- Laptop charged; hotspot on; video + screenshots on the desktop; this script printed
