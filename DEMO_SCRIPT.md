# BhaskarOps — 8-minute demo script (ISRO BAH 2026, 9–10 Sept)

Open **https://heatops.vercel.app/?demo=Leh:-8,Sri%20Ganganagar:46** before you start (hard-refresh once). Sign in, choose **Government / Planner**. Keep phone hotspot ready as backup network. Timings are targets; the total is ~8 minutes.

## 0:00 — Opening line (map screen)
> "Every number on this screen can be clicked and traced to its source. IMD tells you how hot and when; BhaskarOps tells you *why*, *where*, and *what to do* — for 1,932 Indian cities, live."

Point at: the map colours ("each state shows the category most of its cities are in right now — hover and it tells you the count, e.g. 38 of 76 cities Moderate"), a weather badge, the "updated X min ago" line, and in the National Summary the hottest-cities list with its **"peak 40°"** tags and the **Today's forecast high** card ("now vs expected — both from the forecast, neither invented").

## 0:45 — The map is live, not a picture
Click **Rajasthan**. Say: "Opening a state reads all its cities live in one call — see the green dots." Hover the state tooltip: the per-category city counts behind the colour, and the median temperature as the headline number. Scroll the city list: "no number here is estimated — a city we can't reach says NO LIVE DATA."

## 1:30 — City dashboard (Sri Ganganagar → forced 46 °C by the demo link)
Search **Sri Ganganagar** → Overview. The banner says "DEMO — forced to 46 °C, not real data". Say it out loud: *"Our demo mode is labelled, because our product never fakes a reading — even for a demo."* Show: the red theme, the Heat Risk Gauge, the live weather card with sources under each metric. Scroll to **30-DAY TEMPERATURE TREND** — "this is our own archive, one real reading a day since June; hollow dots are days we could not reach the city and say so" — and **TODAY'S HIGH vs LOW** from the forecast.

## 2:30 — The action layer (Authority)
Scroll to **HEATWAVE ACTION CHECKLIST** — "ACTIVE — Extreme". "Five Heat Action Plan steps, modelled on Ahmedabad's HAP and NDMA guidelines. Tick one." Then: "At Moderate it becomes preparedness; at Low, routine; below 10 °C it becomes a cold-weather protocol." *(Optional: search Leh → −8 °C → cold checklist, 20 seconds.)*

## 3:30 — Why it's hot + what to do
**Analysis** tab: scroll to **SATELLITE SURFACE TEMPERATURE (NASA MODIS)** — "this is what Terra saw on Delhi's roofs and roads at 10:30 every clear morning since March: hottest surface 39.9 °C on 20 May, and the gaps are honest — cloud days are left empty, not filled in." Then the heatmap grid — "base is the live temperature; the cell pattern is labelled illustrative."
**Interventions** tab: **Recommended plan** — "Tree canopy 9.7 % vs the 30 % target of the 3-30-300 rule; +20 points; Apply." Click **Apply recommended plan** → projected cooling appears. "The cooling model is illustrative and says so; the canopy number is ESA satellite data."

## 5:00 — Compare (both audiences)
**Compare** tab: add Jaipur, Bikaner. "Same chart, two jobs — a collector ranks cities for cooling budgets; a citizen asks *is my city hotter than my parents' city?*"

## 5:45 — AGNI (one pre-tested question)
Floating AGNI button → ask exactly: **"Which Indian city has the best AQI right now?"** Say: "Grounded on our own cache — it will name real cities, and if you ask it about the world it refuses, because it only has India." *(Have the answer screenshot ready in case of quota/network.)*

## 6:45 — Citizen view (the other half)
Switch **Citizen** (navbar). Show: plain-language strip, **Safe hours today**, **How you can help your neighbourhood** (urgent list at 46 °C), the **Share with family** WhatsApp button, language switch to Hindi. "11 languages; Lite mode for low-end phones."

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
- Hard-refresh the demo tab; sign-in works; demo link loads; AGNI question answered once
- Laptop charged; hotspot on; video + screenshots on the desktop; this script printed
