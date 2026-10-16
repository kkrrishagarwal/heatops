# BhaskarOps — Poori Website Guide (Hinglish)

Website kya-kya karti hai, screen by screen, aur har number kahan se aata hai.
Yeh guide 16 October 2026 ke code se likhi gayi hai, is folder ke purane docs se nahi. English version: [WEBSITE_GUIDE.md](WEBSITE_GUIDE.md).

- **Live site:** https://heatops.vercel.app
- **Local:** `npm run dev` → http://localhost:5173
- **Stack:** React 18 + Vite, Tailwind/CSS, react-simple-maps + d3 (map), Recharts (charts), react-globe.gl (login globe), i18next (11 bhashayein), Vercel serverless functions (AI chat, weather history, cache refresh).

**Contents**

1. [Product kya hai](#1-product-kya-hai)
2. [Screen flow](#2-screen-flow)
3. [Sign-in aur accounts](#3-sign-in-aur-accounts)
4. [Top navigation bar](#4-top-navigation-bar)
5. [Map screen](#5-map-screen)
6. [City dashboard](#6-city-dashboard)
7. [AGNI, AI assistant](#7-agni-ai-assistant)
8. [Profile aur admin screens](#8-profile-aur-admin-screens)
9. [Modes, bhashayein aur URL parameters](#9-modes-bhashayein-aur-url-parameters)
10. [Data kahan se aata hai](#10-data-kahan-se-aata-hai)
11. [Har formula aur threshold](#11-har-formula-aur-threshold)
12. [Backend, deployment aur environment](#12-backend-deployment-aur-environment)
13. [Real vs estimated vs hardcoded](#13-real-vs-estimated-vs-hardcoded)
14. [Internet ke bina kya chalta hai](#14-internet-ke-bina-kya-chalta-hai)
15. [Jaani-pehchaani kamiyan](#15-jaani-pehchaani-kamiyan)
16. [File map](#16-file-map)

---

## 1. Product kya hai

BhaskarOps (pehle naam: HeatOps) India ke liye ek urban-heat monitoring aur planning website hai. Yeh 36 states/UTs ke 1,932 shehron ka live hawa ka temperature aur air quality dikhati hai, NASA MODIS satellite se zameen ki surface temperature, ESA WorldCover se land cover, aur ek budget planner jo batata hai ki cooling ke upay par paisa kahan lagana chahiye.

- **BHASKAR** = Bharat Heat Analysis, Surveillance, Knowledge & Assessment Resource. **OPS** = Optimization & Planning System.
- **Do tarah ke users.** *Authority* (adhikari, planners) ko poora technical dashboard milta hai. *Citizen* ko seedhi-saadi bhasha mein view milta hai: temperature, risk ka ek shabd, air quality, aaj kya karein. Default Authority hai.
- **Poori site ka ek niyam:** jo number naapa nahi gaya, us par "(estimated)", "illustrative" ya "NO LIVE DATA" ka label hota hai. Jis sheher ka data nahi hai, uske liye site koi reading banati nahi.

---

## 2. Screen flow

```
Launch screen (sign in / register)
        │  success → 2-second "CONNECTING TO SATELLITES…" loader
        ▼
Command Center (Authority, laptop)  ⇄  Classic map screen (Citizen / phone)
        │  city chunein → "Full dashboard →" / "Analyze"
        ▼
City dashboard  ──"← Back to Map"──► wapas
```

| Screen | Kya hai |
|---|---|
| Launch | Ghoomta hua globe, taare, sign-in/register card |
| Command Center | Poori screen par map, uske upar teen floating docks (§5.5) |
| Classic map | Baayin taraf India heat map (58%), daayin taraf info panel (42%) |
| Dashboard | Ek sheher ka tab-wise analysis |
| Profile | User card, current view, points, recent sign-ins |
| Admin | Login analytics charts (UI se pahunch nahi sakte, §8 dekhein) |

Dashboard khula ho tab bhi map mounted rehta hai, isliye wapas jaana turant hota hai.

---

## 3. Sign-in aur accounts

**Launch screen** ([src/components/LaunchScreen.jsx](src/components/LaunchScreen.jsx))

- Tabs: **Sign In** / **Register**. Fields: poora naam (sirf register mein), email, password, show/hide password.
- Validation: saare fields zaroori; email `name@example.com` jaisa dikhna chahiye; password kam se kam 6 characters.
- Register account save karke Sign In par le jaata hai — login nahi karta.
- Sign In check karta hai ki email maujood hai aur password match karta hai, phir app load hoti hai.
- Submit button sirf click se chalta hai; Enter dabane se kuch nahi hota.

**Accounts kahan rakhe jaate hain:** poore ke poore browser ke `localStorage` mein (`heatops_users`). Koi backend ya database nahi hai. Password ek simple 32-bit hash ke roop mein rakha jaata hai, jise code khud "not real cryptographic security" kehta hai. Account sirf usi device aur browser par hota hai jahan banaya gaya.

**Logout** ek doosri, andar wali sign-in screen (animated wireframe globe) par le jaata hai, launch screen par nahi. Us screen par "Remember me (30 days)" aur "Forgot password?" hai jo alert mein naam ka hint dikhata hai. Koi email kabhi nahi bheji jaati.

---

## 4. Top navigation bar

Laptop layout mein baayein se daayein:

- **Brand:** 🛰️ BHASKAR OPS / THERMAL.
- **Status pills** (sirf authority): HEAT HIGH, CLIMATE EL NIÑO, SYSTEM OPS. Yeh fixed labels hain, live nahi.
- **Audience toggle:** 🧑 Citizen | 🏛️ Authority.
- **Layout toggle:** 📱 Mobile | 💻 Laptop.
- **Live clock** weekday ke saath.
- **Language dropdown:** 11 bhashayein.
- **🤖 AGENT ONLINE** badge (fixed label).
- **Avatar menu:** My Profile, My Badges, view switch, Lite mode on/off, Logout.
- **LOGOUT** button.

**Ticker bar** (authority view) aath cheezein scroll karta hai: Heat Leader, Peak City, AQI Alert, Climate, Sat Pass, Storm Watch, Mumbai, Shimla. Baayin badge LIVE, LOADING, CACHED (36 ghante se purana data) ya OFFLINE dikhata hai. AQI > 300, temperature ≥ 45 °C ya baarish ki sambhavna ≥ 80% par values laal ho jaati hain. "Climate: El Niño Active", "Sat Pass: Next 16:45 IST" aur "SAT ACTIVE" fixed text hain.

**Citizen strip** (citizen view) ticker ki jagah aata hai: 📍 sheher, 🌡️ temperature, risk pill (Extreme/High/Medium/Low), air quality label, mausam ka ek vakya, aur ek tip.

**Mobile layout:** brand, clock aur ek ☰ drawer jismein layout, bhasha, view switch, Lite mode, profile aur logout hain.

---

## 5. Map screen

Laptop par Authority view **Command Center** (§5.5) par khulta hai; neeche wala classic map screen ek click door hai ("Classic map") aur yahi citizens aur phones ko dikhta hai.

### 5.1 Map

- Local GeoJSON files se bana hai (36 states/UTs, 594 districts, J&K/Ladakh ki alag official boundary file). Koi map tile server use nahi hota.
- **State par hover:** tooltip mein state ka temperature, woh kaise nikla ("live median of N cities…"), risk badge, rang ki wajah, aur shehron ki ginti.
- **State par click:** state aur uska pehla sheher select hota hai; daayan panel badal jaata hai.
- **Zoom/pan:** mouse wheel, +/−/↺ buttons, drag. Zoom 1× se 5× tak.
- **Search box:** "Search any city in India…" — kam se kam 2 akshar, zyada se zyada 10 results, har ek ke saath live temperature ya "NO LIVE DATA". Result par click se uska dashboard khulta hai.
- **Minimise/Maximise** map ko ek patli bar mein samet deta hai.
- **Weather badges** states par: dhool (average PM10 ≥ 400 µg/m³), baarish (sambhavna ≥ 60%), baadal (cover ≥ 80%).
- **Island pills:** "Lakshadweep ↗" aur "A&N Islands ↗" chhote UTs ko clickable banate hain.
- **Planner markers:** jin shehron ko Mitigation Planner fund karta hai, woh "City before→after" label wale rings ke roop mein dikhte hain.
- **Legend** (neeche-baayein, default mein band) aur **cache chip** (upar-baayein) jab data load ho raha ho, na mile ya purana ho.
- Agar map files load na hon: Retry button ke saath error message, khaali screen nahi.

### 5.2 State ko rang kaise milta hai

1. State ke har us sheher ko lo jiski reading hai.
2. **State ka temperature** un readings ka median hai.
3. **Rang** woh risk bucket hai jismein sabse zyada sheher aate hain; barabari par garam wala bucket jeet-ta hai.
4. Jis state mein koi reading nahi, woh hardcoded baseline par chala jaata hai aur tooltip "(estimated)" kehta hai.

| Bucket | Hawa ka temperature |
|---|---|
| EXTREME | ≥ 45 °C |
| VERY HIGH | 40–45 °C |
| HIGH | 35–40 °C |
| MODERATE | 30–35 °C |
| LOW-MODERATE | 25–30 °C |
| LOW | < 25 °C |

Rang EXTREME se LOW-MODERATE tak laal → narangi → peela chalte hain; sirf LOW (< 25 °C) hara hai. Legend, state badge, gauge aur Hottest Cities ke dots yahi rang use karte hain.

### 5.3 Daayan panel — koi state select nahi

"Today's National Heat Summary":

- **Abhi sabse garam sheher.**
- **Aaj ka forecast high** (desh mein sabse zyada forecast maximum).
- **Heatwave watch:** kitne shehron ka forecast ≥ 40 °C hai, ≥ 45 °C par alag callout. Label: "same-day watch, not an official warning".
- **Extreme/High risk wale states.**
- **Rashtriya average temperature.**
- **Quick Picks:** Delhi, Mumbai, Bengaluru, Jaipur, Chennai, Kolkata — ek click mein dashboard.

### 5.4 Daayan panel — state select hai

- State ka naam aur risk badge.
- **Smart Mitigation Planner** button (sirf authority) — §6.6 dekhein.
- Rang ka niyam shabdon mein: "Map colour = the most common category among N cities".
- Tiles: median temperature, NDVI baseline, NDBI baseline, AQI. NDVI/NDBI tiles illustrative state baselines hain aur tooltip mein yahi likha hai.
- **City list:** search ke saath; har row mein live temperature (15 minute se naya ho to hara dot) ya "NO LIVE DATA". Sheher chunein, phir **🔥 Analyze {city}** dashboard kholta hai.
- Hottest Cities list, heat legend, aur Recent Sign-ins.

### 5.5 Command Center (authority, laptop)

File: [src/components/CommandCenterHud.jsx](src/components/CommandCenterHud.jsx). Map-centric layout, page scroll bilkul nahi: India ka map poori screen bharta hai aur teen paardarshi (translucent) docks uske upar tairte hain.

- **Top bar:** sheher aur uska rank/risk badge, data ki taazgi (LIVE / CACHED, kitna purana), IST clock, Citizen/Authority toggle, "Classic map", "Full dashboard →", Logout.
- **Baayan dock:** layer toggles — *Air temperature* (1,932 shehron ki live Open-Meteo readings), *Surface temperature* (1,912 shehron ka NASA MODIS ka taaza clear-sky pass), *Built-up share* (ESA WorldCover, 171 sheher); city search (default Sri Ganganagar); alert triage badge (temperature, activation level, feels-like, wajah); 10×10 thermal grid apne "illustrative pattern" note ke saath.
- **Daayan dock:** AI Heat Response Co-Pilot (§6.8) aur Heatwave Action Checklist.
- **Neeche scrubber:** *Historical* 2016–2026 ko scrub karta hai aur har saal ka April–June ka average surface temperature un 166 shehron ke liye dikhata hai jinka multi-year MODIS record hai (`public/data/modis-lst/yearly-peaks.json`, jise [scripts/buildModisYearlyPeaks.mjs](scripts/buildModisYearlyPeaks.mjs) banata hai); *Live Pass* chune gaye state ke roz ke satellite passes scrub karta hai (jaise Rajasthan, 11 April 2026: 76 mein se 74 sheher clear-sky), baayin chhor par poore desh ka taaza pass; *Forecast* chune gaye sheher ka 7-din ka forecast scrub karta hai jabki map par poore desh ke aaj ke forecast highs dikhte hain.
- **State ke rang scrubber ke saath badalte hain:** live air temperature ko chhodkar har mode mein har state ko screen par maujood readings se dobara rang diya jaata hai (wahi most-common-bucket niyam; grey = us layer mein koi reading nahi), aur tooltip batata hai ki rang ke peeche kaunsi layer, kaunsa saal/date aur kitne sheher hain. City dots default mein band hain ("Show city dots" toggle).
- Har overlay point ek asli reading hai jo asli coordinate se judi hai; baadal wale din gaps hain, estimates nahi. Lite mode mein point overlays band rehte hain.
- **Pahadi states ke baare mein note (Surface/Historical modes):** MODIS *zameen* ko naapta hai, hawa ko nahi, subah ~10:30 baje. Oonchai par nangi zameen hawa se kahin zyada garam ho jaati hai (Leh: 2018 ke Apr–Jun mein 33 °C surface average aur 44 °C ka sabse garam din, jabki hawa aksar 20 °C se neeche rehti hai), aur J&K ke lambe record wale sheher sab Jammu ki taraf ke hain. Isliye laal pahad data ke hisaab se sahi hain; woh surface readings hain.

---

## 6. City dashboard

Header: ← Back to Map, sheher aur state, audience toggle, layout toggle, bhasha, Sign Out.

| Audience | Tabs |
|---|---|
| Citizen | Overview · What to do · Compare |
| Authority | Overview · Prediction · Analysis · Compare · Interventions · AI + Export |

### 6.1 Overview (dono ke liye)

| Panel | Kya dikhata hai | Source |
|---|---|---|
| **Share** (citizen) | "Share with family" WhatsApp link jismein temperature, risk, air quality aur ek tip pehle se bhari hai | Live readings |
| **Safe hours today** (citizen) | 24-ghante ki bar: hara < 35 °C feels-like, peela 35–39, laal ≥ 40 | Open-Meteo hourly |
| **Weather Conditions** | Temperature, feels-like, max/min, humidity, hawa, pressure, visibility, UV, baadal, sunrise/sunset, AQI with PM2.5/PM10/NO₂/O₃, 7-din forecast, agle 12 ghante | Open-Meteo, live |
| **7-Day Heatwave Outlook** | Forecast maxima ki saat bars, ilaake ke IMD threshold ke mukable | Open-Meteo + IMD thresholds |
| **30-Day Temperature Trend** | Site ke apne daily archive se line chart | `/api/weather-history` |
| **Today's High vs Low** | Do bars | Open-Meteo daily |
| **Satellite Indices** | Surface temperature (modelled), vegetation/built-up/water %, elevation | Open-Meteo, ESA WorldCover, SRTM |
| **Heat Risk Gauge** | 15–50 °C ke dial par sui | City live temp → state median → estimate |
| **Active Alerts** | Hataye ja sakne wale alerts: state heat > 45 °C, AQI > 300, aur kuch aur | Mila-jula (§13 dekhein) |
| **How dangerous is the heat?** | "Feels like X °C" ek seedhe danger shabd ke saath (Safe / Take care / Be very careful / Dangerous / Extremely dangerous), bahar kaam karne walon ko kya karna chahiye, aur din ka sabse bura samay. "Show the science (for experts)" Heat Index, wet-bulb, WBGT aur har formula dikhata hai. Citizens ko wahi headline bina button ke dikhti hai. | Live temperature + humidity par formulas, §11.12 |
| **AI Heat Response Co-Pilot** (authority) | AI ka likha Heat Action Protocol (Gemini; agar instance configured ho to Agent37), simulated actions, Executive Brief | §6.8 |
| **Heatwave Action Checklist** (authority) | Severity ke hisaab se badalne wali tick-list | Niyam, neeche |
| **Health & Safety Precautions** | Niyam-aadharit salah ki list | Temperature aur AQI ke niyam |
| **Global Climate Systems** | ENSO, IOD, MJO, PDO, NAO, Polar Vortex | Fixed text |

**Heatwave Action Checklist** ([src/components/HeatActionChecklist.jsx](src/components/HeatActionChecklist.jsx)) — NDMA guidelines aur Ahmedabad Heat Action Plan par aadharit:

| Sthiti | Kaunsi list |
|---|---|
| Risk Extreme ya High | 5 kadam: cooling centres, health department alert, public advisory, paani ke tanker, cool-roof/green upayon ki samiksha |
| Risk Medium | 3 taiyari ke kadam |
| 10 °C se neeche | 4 thand ke kadam (rain basere, cold advisory, hypothermia alert, jaanwar) |
| Baaki | "Routine monitoring", koi list nahi |

Ticks par samay lagta hai aur woh browser mein har sheher ke liye save hote hain. Panel kehta hai ki yeh "an operational aid, not an official record" hai.

### 6.2 What to do (citizen)

Overview ki cheezein, aur saath mein:

- **How you can help your neighbourhood** — severity ke saath badalne wali static list.
- **Ask AGNI — is it safe today?** — AI chat, aasaan bhasha mein.

### 6.3 Prediction (authority)

District Magistrate ke liye "District Brief" ([src/components/PredictionBrief.jsx](src/components/PredictionBrief.jsx)):

1. **Teen header cards:** *When* (heatwave spell ki tareekhein), *How bad today* (100 mein se composite risk), *If you act* (risk pehle → baad).
2. **7-day outlook** "kuch na karein" vs "plan ke saath".
3. **This week — get the team on it:** checklist ke kadam table mein, har ek ka owner (Municipal Commissioner, CMHO, District Information Officer, PHED/Jal Board, Town Planner, DDMA control room) aur deadline.
4. **Where the budget goes:** quick budget buttons (₹25 L / ₹50 L / ₹1 Cr / ₹5 Cr) aur bantwara.
5. **The heat map if you act:** do 10×10 grids, aaj vs plan ke saath.

### 6.4 Analysis (authority)

- **Temperature Heatmap Grid:** sheher ke asli base temperature ke aas-paas 10×10 cells. ±2 °C ka cell-to-cell pattern illustrative label ke saath.
- **Data Pipeline panel:** chhah data sources ki static list.
- **Satellite Surface Temperature (NASA MODIS):** taaza clear-sky din aur raat, is season ki sabse garam surface, season ke average, weekly chart (jahan baadal ne satellite rok diya wahan dotted), aur jahan uplabdh ho wahan 2016 tak ka saal-dar-saal peak-season chart.
- **Random Forest Model:** ek research model ka imaandaar scorecard (§11.7). Panel saaf kehta hai ki app ka koi number isse nahi aata.
- **Land Use / Land Cover:** built-up, vegetation, paani, nangi mitti ki stacked bar.
- **Urban Morphology:** OpenStreetMap se 1 km ke andar live building count.

### 6.5 Compare (dono ke liye)

4 tak sheher radar chart mein jodein, chhah axes: LST, NDVI, NDBI, AQI, Wind, NDWI. Temperature, AQI aur hawa live hain; NDVI/NDBI/NDWI illustrative baselines hain aur panel yeh batata hai.

### 6.6 Interventions (authority)

- **Recommended plan for the city:** tree cover ko 30% target (3-30-300 rule) se compare karta hai aur ped aur cool-roof ke level sujhaata hai. "Apply recommended plan →" sliders set karta hai.
- **UHI Interventions sliders:** Urban Greening (0–30%), Cool Roofs (0–20%), Water Bodies (0–10%), before/after mini-grid aur "Preview on a 40 °C day" toggle ke saath.
- **Cool Roof ROI Calculator:** chhat ka area daalein, lime-wash ya premium coating chunein; cost range, temperature mein kami, AC ki bachat aur payback period milta hai.
- **Physics of UHI Interventions:** greening, cool roofs aur water bodies ke formula wale teen static cards.
- **Mitigation Planner** — mukhya planning tool:

| Mode | Aap kya daalte hain | Kya milta hai |
|---|---|---|
| **I have a budget** | ₹ rakam (presets ₹25 L se ₹5 Cr, slider ₹10 Cr tak) | Shehron aur intervention types mein optimised bantwara |
| **I want to estimate a cost** | Ek intervention aur matra | Cost, cooling, risk pehle → baad, hisaab ki lines |
| **I have a target** | Risk mein chahi gayi kami (2–30%) | Zaroori nivesh |

  Output: risk pehle/baad, allocation bars, "Why this plan?" points, sheher-wise breakdown. Buttons: View on Map, Apply Plan to Sliders, Save as Plan A (do budgets compare karein), Export Report (.txt), CSV, Cost Assumptions & Method.

  Planner do star par kaam karta hai: **state** (map panel se khulta hai; budget shehron mein baant-ta hai) aur **city** (is tab par; ek sheher ke andar baant-ta hai).

- **Wind & Atmosphere:** live hawa ki disha, gati, jhonka, pressure.

### 6.7 AI + Export (authority)

- **AGNI chat** (§7).
- **Points & Badges:** har analyse kiye sheher par +10 points; badges First Analysis, Tree Hugger, City Explorer, AI Explorer. Sirf session tak rehte hain.
- **Glossary:** LST, NDVI, NDBI, NDWI, UHI, ENSO, IOD, MJO.
- **Export & Share:** Copy Summary, WhatsApp Share, CSV Download, PDF Report (printable page aur browser ka print dialog khulta hai).
- **Progress tracker** aur **Team & Methodology:** static text.

### 6.8 AI Heat Response Co-Pilot (authority, Overview tab aur Command Center)

Files: [src/components/HeatCoPilot.jsx](src/components/HeatCoPilot.jsx), [api/_lib/heatAgent.js](api/_lib/heatAgent.js), [src/utils/heatActionProtocol.js](src/utils/heatActionProtocol.js), [src/utils/executiveBrief.js](src/utils/executiveBrief.js).

1. **Status line:** load par panel `GET /api/heat-agent` ko ping karta hai, jo batata hai kaunsa AI engine uplabdh hai: Agent37 instance (agar `AGENT37_API_KEY` aur `AGENT37_INSTANCE_ID` set hon) ya Google Gemini (wahi server-side key jo AGNI use karta hai). Abhi project Gemini par chalta hai; Agent37 ka raasta bana hua hai par soya hua, kyunki koi instance nahi banaya gaya.
2. **Rule-based pre-assessment:** neeche ke thresholds se activation level, wajahon ke saath.
3. **Run AI Co-Pilot:** sheher ka temperature, humidity, heat stress, 7-din ka IMD-threshold outlook, land cover aur risk score `POST /api/heat-agent` ko bhejta hai. Server pehle Agent37 try karta hai (agar configured ho), phir Gemini JSON mode mein (har model ke liye 25 s tak, AGNI wali hi model chain), aur Heat Action Protocol maangta hai (actions owner, deadline aur priority ke saath; labour order; English aur Hindi SMS; SDMA incident; assumptions). Jawab page tak pahunchne se pehle validate aur clamp hota hai.
4. **Kabhi atakta nahi:** AI kaam kar raha ho tab "Use offline protocol now" dikhta hai. Agar koi engine configured na ho, dono time out ya fail ho jaayein, ya valid JSON na aaye, to rule-based protocol dikhta hai, amber banner mein wajah ke saath. AI output par hara banner engine, model, samay aur tokens batata hai, aur Executive Brief ka footer bhi wahi kehta hai.
5. **Simulated actions:** "Dispatch ward advisory", "Simulate SMS broadcast" (characters aur SMS segments ginta hai), "Log incident to SDMA". Har ek browser mein rakhe action log mein samay aur reference number (jaise `SDMA-RJ-…`) ke saath entry likhta hai. Kahin kuch bheja nahi jaata, aur log yeh saaf kehta hai.
6. **Export Executive Heat Action Brief:** District Magistrate ke liye ek page ka printable brief (sthiti, heat-stress numbers, 7-din forecast, actions table, labour order, SMS text, SDMA incident, action log, assumptions, data sources aur plan kisne banaya).

| Activation level | Trigger (koi ek) |
|---|---|
| CRITICAL | hawa ka temperature (abhi ya aaj ka high) ≥ 45 °C · Heat Index "Extreme Danger" · WBGT black flag · IMD-threshold outlook mein heatwave/severe |
| ALERT | ≥ 42 °C · Heat Index "Danger" · WBGT red flag · IMD threshold se upar ek din |
| WATCH | ≥ 37 °C · Heat Index "Extreme Caution" · WBGT yellow flag |
| COLD | abhi ka temperature < 10 °C |
| ROUTINE | inmein se kuch nahi |

AI ko kaha gaya hai ki sirf diye gaye numbers use kare aur ward ke naam, aabadi ya facilities ki ginti kabhi na banaye, kyunki project ke paas yeh data nahi hai; testing mein Gemini ne andaza lagane ke bajay "assumptions" mein likha ki kya missing tha.

---

## 7. AGNI, AI assistant

AGNI = Analytical Ground-level heat iNtelligence Interface.

- **Kahan:** map aur dashboard ke neeche-daayein floating button, AI + Export tab, aur citizen "What to do" tab. Teenon ek hi conversation share karte hain.
- **Suggestion chips** input bhar dete hain (authority: 4 analytical sawaal; citizen: 3 safety sawaal).
- **Jawab kaise aata hai:** browser sawaal site ke apne server route `POST /api/ask-ai` ko bhejta hai, jo Google Gemini ko call karta hai. API key server par rehti hai, browser tak kabhi nahi pahunchti.
- **Use kya bataya jaata hai:** chune gaye sheher ka live temperature, land-cover percentages aur AQI; sawaal mein aaye doosre shehron/states ki readings; "sabse garam/sabse saaf" sawaalon ke liye India-wide ranking block; ek NASA MODIS line; jawab ki pasandida bhasha.
- **Uske niyam:** sirf diye gaye numbers use karo, warna "no data" bolo, baaki sab par "(estimated)" lagao; sirf heat, climate, air quality aur planning par raho; sirf India; code kabhi mat likho; jis bhasha mein user likhe usi mein jawab do.
- **Seemayein:** sawaal ≤ 2,000 characters; har visitor ke liye 10 requests per minute; sawaalon ke beech 4 second ka gap; busy hone par ek automatic retry.
- **Agar AI na mile:** Retry ke saath error bubble. "hot" ya "heat" wale sawaalon par screen ke live data se bana templated jawab aata hai, saaf "[Offline fallback answer…]" label ke saath.

---

## 8. Profile aur admin screens

**Profile:** avatar, naam, email, switch button ke saath current view, points, First Analysis badge, recent sign-ins.

**Admin Analytics:** chaar stat cards (users, login events, analyse kiye sheher, success rate), hourly logins, 30-din login trend aur top 10 cities ke charts, aur recent-activity table. Sab browser `localStorage` se padhta hai, isliye sirf ek device ka hai.

Admin screen interface se pahunch nahi sakte: kisi account ko kabhi admin role nahi milta, isliye "Admin Panel" menu item kabhi dikhta nahi.

---

## 9. Modes, bhashayein aur URL parameters

**Bhashayein (11):** English, Hindi, Bengali, Marathi, Telugu, Tamil, Gujarati, Urdu, Kannada, Odia, Punjabi. Dropdown se haath se chuni jaati hai aur yaad rehti hai. Lagbhag 305 strings translate hain; kuch text (map tooltips, ticker labels, legend bucket ke naam) sirf English mein hai.

**Lite mode:** dheeme phones ke liye. Globe, district layer aur animations hata deta hai. Sirf Save-Data ya 2G par apne aap on hota hai.

**Layout:** pehli baar 768 px se neeche Mobile, warna Laptop; dono force kiye ja sakte hain.

**URL parameters**

| Parameter | Asar |
|---|---|
| `?view=citizen` ya `?view=authority` | Audience set karta hai |
| `?demoTemp=46` | Jo bhi sheher chuna ho use 46 °C maanta hai |
| `?demo=Leh:-8,Sri Ganganagar:46` | Sheher-wise overrides; baaki sheher asli rehte hain |
| `?relative=0` | Demo link par rank-wala rang band karta hai |

Demo ka bartaav:

- Values seedhe numbers hone chahiye (46, -8, 45.5) aur −25…60 °C mein clamp hote hain. "46abc", "1e9", khaali values aur toote pairs ignore hote hain; ek toota pair baakiyon ko nahi girata. Jis link mein koi valid value na ho woh normal live mode mein rehta hai (na banner, na demo rang).
- Force kiye temperature ke liye humidity dobara nikaali jaati hai, din ki asli nami (dew point) rakhte hue — hawa garam karne se uski relative humidity ghat-ti hai. Iske bina 46 °C aur shaam ki 60% humidity ek asambhav Heat Index deti.
- `npm run dev` par toote `%` escape wala URL HTTP 500 dene ke bajay sudhaar kar redirect hota hai (production yeh pehle se sambhalta hai).
- Dashboard par banner aata hai: "🧪 DEMO — {city} forced to N°C … (this browser only, not real data)".
- Override chune gaye sheher ka dashboard badalta hai (checklist, gauge, precautions, forecast). Map ke temperature asli rehte hain.
- Demo links par map states ko **aaj ki readings mein rank** se rang deta hai (hottest 10%, hotter 25%, …). Legend aur tooltip kehte hain ki rang ek rank hai, IMD danger level nahi.

---

## 10. Data kahan se aata hai

| Data | Source | Coverage | Taazgi |
|---|---|---|---|
| Sheher ka temperature, forecast, humidity, hawa, UV | Open-Meteo forecast API (free, bina key) | 1,932 sheher | Chune sheher ke liye live; map ke liye bulk cache |
| Air quality (US AQI, PM2.5, PM10, NO₂, O₃) | Open-Meteo air-quality API (CAMS) | Wahi | Wahi |
| Satellite surface temperature | NASA MODIS MOD11A1.061 (Terra, 1 km) via AppEEARS | 1 Mar 2026 se 1,912 sheher; 167 sheher 2016 se | Static, 2 Sep 2026 tak |
| Land cover | ESA WorldCover 10 m (2021) | 171 sheher, har ek ~5 km box | Static |
| Elevation | SRTM 30 m, Open-Meteo ke zariye | Sab located sheher | Static |
| Building density | OpenStreetMap via Overpass (do mirrors) | Chuna sheher, 1 km radius | Live |
| Schools aur hospitals | OpenStreetMap | Sirf 6 sheher, 3 km radius | Static, 8 Sep 2026 |
| Map boundaries | Local GeoJSON | 36 states/UTs, 594 districts | Static |
| Daily archive | Site ke apne snapshots | 86 din, 22 Jun – 27 Sep 2026, gaps ke saath | Har refresh par ek |

**Live weather pipeline**

1. Ek refresh script sab 1,932 sheher Open-Meteo se batches mein laata hai aur `public/live-weather-cache.json` plus `public/data/history/` ke neeche tareekh wala snapshot likhta hai.
2. Yeh GitHub Actions par chalta hai (din mein har ghante, raat mein har teen ghante) aur result commit karta hai, jisse site redeploy hoti hai. Vercel cron 14:30 IST aur retry 16:00 IST backup hain.
3. Agar koi batch fail ho, to un shehron ki purani values rehti hain aur "carried forward" flag lagta hai.
4. Browser mein: cache shuru mein aur har 15 minute load hota hai. Agar 45 minute se purana ho, to map har state ke lagbhag 8 shehron ka live sample laata hai. State kholne par uske sab sheher live refresh hote hain. Sheher chunne par uska poora live weather aata hai (8 minute rakha jaata hai).
5. Agar live fetch fail ho, to sheher apni last saved reading ya cache value dikhata hai, cached label ke saath.

**Refresh status:** GitHub Actions ka refresh chal raha hai (13 October 2026 ko check kiya: din mein kai baar safal runs). Local checkout ko naya data sirf `git pull` par milta hai, isliye laptop se demo se pehle `git pull --rebase` chalayein, warna app CACHED dikhayegi.

---

## 11. Har formula aur threshold

### 11.1 State ka temperature aur rang
State ke shehron ke hawa ke temperature ka median; rang = jis bucket mein sabse zyada sheher (§5.2). 45 minute se nayi readings akeli use hoti hain jab state mein kam se kam min(5, n) aisi hon.

### 11.2 "Feels like"
Weather card Open-Meteo ka `apparent_temperature` dikhata hai. "How dangerous is the heat?" panel aur Co-Pilot site ke apne Heat Index, wet-bulb aur WBGT use karte hain (§11.12).

### 11.3 Urban Heat Island gap
`UHI = sheher ka temperature − 0.35° uttar aur 0.10° poorv (~40 km door) ke point ka temperature`

| Gap | Label |
|---|---|
| ≤ 0 | No heat island / parity |
| ≤ 1.5 °C | Mild |
| ≤ 3.5 °C | Moderate |
| > 3.5 °C | Severe |

### 11.4 Heatwave outlook (IMD thresholds)

| Ilaaka | Threshold |
|---|---|
| Maidan (plains) | 40 °C |
| Tat (coast) | 37 °C |
| Pahad (elevation ≥ 900 m) | 30 °C |

Din ka level: ≥ 47 severe · ≥ 45 heatwave · ≥ threshold watch · ≥ threshold − 3 warm · warna normal. Spell = lagataar do ya zyada din watch ya usse bure. IMD ka departure-from-normal niyam laagu nahi hota kyunki site ke paas climatological normals nahi hain; panel yeh batata hai aur mausam.imd.gov.in ki taraf ishara karta hai.

### 11.5 Air quality (US AQI)
≤ 50 Good · ≤ 100 Moderate · ≤ 150 Unhealthy for Sensitive Groups · ≤ 200 Unhealthy · ≤ 300 Very Unhealthy · > 300 Hazardous.

### 11.6 Precautions
Garmi ki list ≥ 38 °C par (≥ 45 par EXTREME; AQI > 200 ho to do extra items) · thand ki list 15 °C se neeche · warna aam salah.

### 11.7 Machine-learning model
- scikit-learn Random Forest, 100 trees. Features: NDVI, NDBI, elevation. Target: MODIS din ka surface temperature.
- 20 global megacities ki 341 rows par trained (Data in Brief, DOI 10.1016/j.dib.2019.103803). Koi Indian sheher nahi.
- Random 80/20 split: **R² 0.95, MAE 0.906 °C**.
- Paanch poore sheher alag rakhne par: **R² −0.389, MAE 5.541 °C** — yeh andekhe shehron par kaam nahi karta, aur panel yeh dikhata hai.
- Feature importance: elevation 0.505, NDBI 0.389, NDVI 0.106.
- Sirf metrics ship hote hain. App mein model koi prediction nahi karta.

### 11.8 Intervention cooling model (illustrative)
`cooling (°C) = tree fraction × 18 + cool-roof fraction × 14 + water fraction × 12`

Slider ki seemayein 0.30, 0.20 aur 0.10 hain. Yahi coefficients heatmap grid, recommended plan aur planner chalate hain.

### 11.9 Composite risk score (0–100), planner use karta hai

```
t          = forecast high aur live temperature mein se bada
tempPts    = 10 (<25) · 30 (<30) · 50 (<35) · 70 (<40) · 85 (<45) · 95 (≥45)
surfacePts = clamp(MODIS season peak − 35, 0, 10)
builtPts   = built-up % × 0.2
canopy     = clamp(tree cover % / 30, 0, 1) × 10
risk       = clamp(round(tempPts + surfacePts + builtPts − canopy), 0, 100)
```

Labels: ≥ 80 CRITICAL · ≥ 65 HIGH · ≥ 45 MODERATE · warna LOW. Confidence (high/medium/low) batata hai sheher ke paas kitna asli data hai.

### 11.10 Planner ki cost assumptions

| Cheez | Value |
|---|---|
| Cool roof | ₹1.25 per sq ft (lime-wash midpoint, Ahmedabad pilot 2017) + ₹1,250 labour → ₹2,500 per 1,000 sq ft chhat |
| Ped | ₹350 3 saal ki dekhbhaal sahit; 400 per hectare → ₹1.40 L per hectare |
| Cooling centre | ₹5 L |
| Water station | ₹50,000 |
| Reflective pavement | ₹150 per m² → ₹15 L per hectare |
| School/hospital retrofit | ₹1.5 L |
| Priority core | 1 km radius (~314 ha) |
| Har °C cooling par risk points | 4 |
| Ghat-ta asar (diminishing returns) | Usi sheher mein har ₹25 L kharch ke baad ×0.9 |
| Relief kharch ki seema (centres + paani) | Budget ka 40% |

**Optimiser:** greedy aur deterministic. Baar-baar woh package kharidta hai jo har rupaye par sabse zyada risk points de, sheher ke risk aur built-up share se weighted, jab tak budget khatam na ho. Batayi gayi kami par ±20% ka band hai. Aabadi model nahi hoti kyunki koi verified per-city table nahi hai; planner yeh kehta hai.

### 11.11 Cool Roof ROI calculator

| Coating | Cost | Umar | Temperature mein kami |
|---|---|---|---|
| Basic lime-wash | ₹0.5–2 per sq ft | 1 saal | 1.4 °C |
| Premium reflective | ₹15–30 per sq ft | 5 saal | 2.8 °C |

AC ki bachat = area × 0.09 kWh per sq ft per month × ₹7 per kWh, 8 cooling mahine. Payback = average coating cost ÷ saal ki bachat.

### 11.12 Heat stress ([src/utils/heatStress.js](src/utils/heatStress.js))

| Quantity | Tareeka |
|---|---|
| Heat Index | US NWS: 80 °F se neeche Steadman simple form, warna NWS ke low- aur high-humidity adjustments ke saath Rothfusz regression. 135 °F (57 °C) ke upar NWS chart khatam ho jaata hai, isliye panel "> 57 °C" dikhata hai. |
| Wet-bulb | Stull (2011): `Tw = T·atan(0.151977·√(RH+8.313659)) + atan(T+RH) − atan(RH−1.676331) + 0.00391838·RH^1.5·atan(0.023101·RH) − 4.686035` |
| WBGT (chhaon ka estimate) | ISO 7243: `WBGT = 0.7·Tnw + 0.3·Tg`, natural wet-bulb ≈ Stull wet-bulb, globe ≈ chhaon mein hawa ka temperature. Koi API globe temperature nahi deti, isliye dhoop mein asli value zyada hogi. |

| Heat Index | Band |
|---|---|
| ≥ 51.7 °C | Extreme Danger |
| 39.4–51.7 °C | Danger |
| 32.2–39.4 °C | Extreme Caution |
| 26.7–32.2 °C | Caution |

| WBGT | Category (TB MED 507) | Moderate kaam / aaram per ghanta |
|---|---|---|
| ≥ 32.2 °C | 5 Black | 20 / 40 min |
| 31.1–32.2 °C | 4 Red | 30 / 30 min |
| 29.4–31.1 °C | 3 Yellow | 40 / 20 min |
| 27.8–29.4 °C | 2 Green | 50 / 10 min |
| 25.6–27.8 °C | 1 White | koi seema nahi |

Australian BoM ka WBGT shortcut test karke hataya gaya: garam-sookhi hawa mein woh lagbhag 5 °C zyada padhta hai.

---

## 12. Backend, deployment aur environment

**Server routes** ([api/](api/) mein Vercel functions)

| Route | Method | Kaam |
|---|---|---|
| `/api/ask-ai` | POST | AGNI: input validate karta hai, rate-limit lagata hai, paanch-model fallback chain ke saath Gemini call karta hai |
| `/api/heat-agent` | GET / POST | GET: kaunsa AI engine uplabdh hai (Agent37 / Gemini). POST: Co-Pilot chalata hai (har visitor 6 runs per minute); hamesha ek plan deta hai, `agent37`, `gemini` ya `fallback` label ke saath |
| `/api/weather-history` | GET | `?city=&state=&days=` sheher ki archive series deta hai; `?runs=1` refresh runs list karta hai |
| `/api/refresh-weather-cache` | GET (cron) | Poora cache refresh, GitHub par commit |
| `/api/refresh-weather-cache-retry` | GET (cron) | Sirf fail hue sheher dobara laata hai |

Local development mein Vite dev server khud `/api/ask-ai`, `/api/heat-agent` aur `/api/weather-history` serve karta hai, isliye `npm run dev` kaafi hai.

**Environment variables** (sirf server-side; [.env.example](.env.example) dekhein)

| Variable | Kis liye |
|---|---|
| `GEMINI_API_KEY` | AGNI aur AI Co-Pilot |
| `GEMINI_MODELS` | Model chain ka optional override |
| `CRON_SECRET` | Cron routes ki suraksha |
| `GITHUB_TOKEN` | Cron ko refreshed cache commit karne dena |
| `DATABASE_URL` | Archive ka optional Postgres mirror |
| `AGENT37_API_KEY`, `AGENT37_INSTANCE_ID` | Optional: Co-Pilot ke liye Gemini se pehle Agent37 instance. Production mein set nahi |

**Deployment:** Vercel (mukhya). Netlify config hai par sirf `/api/ask-ai` wire karti hai.

**Browser storage:** accounts, login history, bhasha, audience, layout, Lite mode, checklist ticks aur last-known weather sab `localStorage` mein. Users ke baare mein kuch bhi server par nahi jaata. Page analytics Vercel Analytics se.

**Error handling:** ek error boundary poori app ko aur map ko alag se lapet-ta hai. Crash par "Something went wrong" aur Try again / Reload dikhta hai, safed screen nahi.

**Purana code:** [app.py](app.py), [templates/](templates/) aur [static/](static/) ek purana Flask prototype hain. React site inhe use nahi karti.

---

## 13. Real vs estimated vs hardcoded

**Naapa hua ya live**
- Sheher ka temperature, forecast, humidity, hawa, AQI aur pollutants (Open-Meteo).
- State medians, map ke rang, weather badges, hottest-cities list aur inse bane ticker values.
- NASA MODIS surface temperature (quality-checked; baadal wale din gaps, kuch interpolate nahi).
- 171 shehron ka ESA WorldCover land cover.
- OpenStreetMap building counts.
- ML model metrics.

**Estimated, aur screen par aisa likha hua**
- Jis state mein koi live sheher nahi (baseline value, "(estimated)").
- 171 ke bahar ke sheher ka land cover (sabse paas ka classified sheher, "est. from X (~N km)").
- Overview ka "Surface Temp (live)" — Open-Meteo se modelled, label kehta hai satellite reading nahi.
- Heatmap grid ka cell-to-cell pattern, intervention sliders aur planner ka har result ("model-based estimates").
- Demo-link ke temperature (banner).

**Hardcoded, bina "static" label ke**
- Global Climate Systems panel (ENSO "El Niño", IOD, MJO, PDO, NAO, Polar Vortex).
- Ticker items "El Niño Active", "Sat Pass: Next 16:45 IST", "SAT ACTIVE".
- Nav pills HEAT HIGH / CLIMATE EL NIÑO / SYSTEM OPS aur "AGENT ONLINE" badge.
- "Marine heatwave active" alert, Gujarat, Maharashtra, Kerala aur Tamil Nadu ke liye hamesha dikhta hai.
- "MODERATE urban heat" alert, ek baseline NDBI value se.
- Progress tracker (8 mein se 7, 87.5%).

---

## 14. Internet ke bina kya chalta hai

`npm run dev` se local chalayein, bina connection ke:

| Chalta hai | Nahi chalta |
|---|---|
| Sign-in, map, cached file se rang aur medians | Chune sheher ka live weather (cached par gir jaata hai, label ke saath) |
| MODIS, land cover, ML scorecard, planner, calculators, heat stress | AGNI (error bubble; heat sawaalon par templated fallback) |
| Co-Pilot ka offline protocol, simulated actions, Executive Brief | AI Co-Pilot khud (offline protocol par gir jaata hai, label ke saath) |
| 30-din trend (local snapshot files padhta hai) | Building density ("unavailable") |
| Checklist, exports, bhasha switch | Rural baseline / UHI gap |
| | Google Fonts (system fonts use hote hain) |

---

## 15. Jaani-pehchaani kamiyan

Jo ek dhyan se dekhne wala reviewer pakad sakta hai. Inmein se koi site ko rokti nahi.

**Bartaav**
- **Logout ke baad dobara login kuch bhi maan leta hai.** Andar wali sign-in screen koi bhi non-empty email aur password le leti hai; sirf launch screen credentials check karti hai.
- **Admin screen tak pahunch nahi** (§8).
- **30-din trend kabhi carried-forward din nahi dikhata.** Panel `carried` naam ka field padhta hai; API `isCarriedForward` bhejti hai.
- **PDF report elevation N/A chhaap sakti hai.** Value galat jagah se padhti hai.
- **Demo ke sheher naam** city list se check nahi hote; anjaan naam bas kabhi match nahi hota.
- **Compare tab** jode gaye sheher ka state sirf naam se dhoondhta hai, isliye ek naam ke do sheher gadbada sakte hain.
- **Floating AGNI drawer** state ka naam nahi bhejta, isliye shayad usmein MODIS line nahi hoti jo tab version bhejta hai.
- **Clock IST kehti hai** par device ka local time dikhati hai.
- **Chhupa hua native cursor:** site har jagah mouse pointer ko custom cursor se badal deti hai.

**Text jo ab data se mel nahi khaata**
- Data Pipeline panel aur CSV export mein land cover "36 representative cities" likha hai; file mein 171 hain.
- AGNI ke instructions rural-baseline source NASA POWER batate hain; code Open-Meteo use karta hai.
- Exports par "BAH 2026 | CCSU IMS Ghaziabad" aur "Delhi NCR" chhapa hai.
- Legend ki row "Active heatwave (major states)" ke peeche map par kuch nahi.
- Ticker ka "Peak City" abhi ke temperature se doosra sabse garam sheher hai.
- ML data file saal ki range 2000–2017 aur 2000–2018 dono batati hai.
- Physics panel ki cost ranges planner ki unit costs se alag hain.

**Data**
- Schools-aur-hospitals data sirf 6 shehron ka hai.
- 24 chhoti jagahon ke coordinates nahi hain, woh live geocoding par nirbhar hain.
- ISRO INSAT-3D data maanga gaya hai par product mein nahi; parser script kabhi chali nahi.

**Product mein bilkul nahi**
- Ward-level ya aabadi ka data nahi.
- Asli SMS, alerting ya incident-logging integration nahi — Co-Pilot ke actions simulated aur labelled hain.
- Server-side user accounts nahi.

---

## 16. File map

| Path | Kya hai |
|---|---|
| [index.html](index.html), [src/main.jsx](src/main.jsx), [src/App3D.jsx](src/App3D.jsx) | Entry point, launch → app switch |
| [src/App.jsx](src/App.jsx) | Map, navbar, dashboard, sab tabs, state data table |
| [src/components/](src/components/) | Har panel ki ek file (planner, checklist, MODIS, weather card, AGNI, …) |
| [src/hooks/useWeather.js](src/hooks/useWeather.js) | Har sheher ka live weather, caching, demo overrides |
| [src/utils/weatherAPI.js](src/utils/weatherAPI.js) | Open-Meteo calls, AQI categories |
| [src/utils/mitigationPlanner.js](src/utils/mitigationPlanner.js) | Risk score, cost model, optimiser |
| [src/utils/heatwaveOutlook.js](src/utils/heatwaveOutlook.js) | IMD threshold classification |
| [src/utils/stateLiveRefresh.js](src/utils/stateLiveRefresh.js) | Har state ka batched live refresh |
| [src/utils/agniLocationContext.js](src/utils/agniLocationContext.js) | AGNI ko bheje jaane wale extra city/state facts |
| [src/utils/exportUtils.js](src/utils/exportUtils.js) | CSV, WhatsApp, printable report |
| [src/utils/heatStress.js](src/utils/heatStress.js) | Heat Index, wet-bulb, WBGT, work/rest categories |
| [src/utils/heatActionProtocol.js](src/utils/heatActionProtocol.js) | Activation levels, rule-based protocol, plan validation |
| [src/components/HeatCoPilot.jsx](src/components/HeatCoPilot.jsx), [api/_lib/heatAgent.js](api/_lib/heatAgent.js) | AI Co-Pilot (browser panel; server tiers Agent37 → Gemini → rule-based) |
| [src/components/CommandCenterHud.jsx](src/components/CommandCenterHud.jsx), [src/utils/hudOverlay.js](src/utils/hudOverlay.js) | Command Center HUD (full-screen map, docks, timeline scrubber, asli-reading overlays) |
| [src/i18n/](src/i18n/) | 11 bhashaon ki files |
| [api/](api/) | Serverless routes aur unka shared code |
| [scripts/](scripts/) | Data builders: weather refresh, MODIS, land cover, geocoding, ML training |
| [public/live-weather-cache.json](public/live-weather-cache.json) | Bulk weather cache |
| [public/data/](public/data/) | GeoJSON, MODIS, land cover, ML metrics, coordinates, daily history |
| [vite.config.js](vite.config.js), [vercel.json](vercel.json) | Dev middleware, build, crons |
