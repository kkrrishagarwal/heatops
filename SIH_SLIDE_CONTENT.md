# BhaskarOps — SIH 2026 slide content, ready to copy

Everything below is written to be **pasted straight into the official SIH template**.
Text first, then the picture to drop beside it. Nothing here is a paragraph — SIH asks for
points, diagrams and pictures, so it is all bullets and short lines.

**Two folders you already have:**
- `docs/diagrams/` — 9 ready-made diagram images (in `BhaskarOps_diagrams.zip`)
- `docs/screenshots/` — 23 real app screenshots (in `BhaskarOps_screenshots.zip`)

Rules to keep in mind: **6 slides maximum**, delete SIH's "Important Instructions" slide,
and **upload as PDF** (File → Save As / Export → PDF).

---

# SLIDE 1 — TITLE PAGE

Fill the template's own fields:

```
Problem Statement ID   – [from the portal]
Problem Statement Title– [from the portal]
Theme                  – [from the portal]
PS Category            – Software
Team ID                – [from the portal]
Team Name              – [as registered on the portal]
```

**Add this one line under the fields:**

```
BhaskarOps — India's Urban Heat Island monitoring and intervention platform, with AGNI,
an AI heat analyst grounded in real data. Live now: heatops.vercel.app
```

**Optional stat strip** (six small boxes, or one line):

```
1,956 cities  ·  28 states and 8 UTs  ·  11 Indian languages
1,912 cities with NASA MODIS  ·  72-day daily archive  ·  ₹0 / month
```

**Pictures:** `diagrams/01-the-five-step-loop.png` and `screenshots/02-map-national.png`

---

# SLIDE 2 — IDEA TITLE

### Pointer 1 · Detailed explanation of the proposed solution

```
• Live India map — 1,956 cities, 28 states and 8 UTs, drill-down to 594 districts
• Five-tab city dashboard: live weather & AQI · satellite analysis · compare · interventions · AGNI + export
• Two views, one product — Citizen (plain risk badge, safe hours, WhatsApp share) and
  Authority (full dashboard + Heat Action Plan checklist)
• 11 Indian languages; Lite mode for low-end phones, works at 375 px
```

### Pointer 2 · How it addresses the problem

```
• The data exists but sits in silos — we fuse Open-Meteo, ESA WorldCover and NASA MODIS into one tool
• Closes the loop: monitor → explain → compare → simulate → act
• Reaches the people who act: residents, ward officers, planners
```

### Pointer 3 · Innovation and uniqueness of the solution

```
• Honesty enforced in code — unreachable cities say "NO LIVE DATA", stale readings are
  flagged "carried forward", the ML model prints its weak score beside its good one
• AGNI is India-only — refuses global claims, answers rankings from the real 1,932-city cache
• A simulator, not a viewer — tree canopy vs the 30 % target of the 3-30-300 rule, with cost
• Self-refreshing — re-fetches every city hourly, commits to git, redeploys itself
```

**Pictures:** `diagrams/02-how-we-compare-imd-bhrigu.png` · `diagrams/03-honesty-evidence-strip.png`
`screenshots/09-citizen.png` · `screenshots/04-checklist.png`

---

# SLIDE 3 — TECHNICAL APPROACH

### Pointer 1 · Technologies to be used

```
• Frontend  — React 18 + Vite · react-simple-maps + d3-geo · Recharts · Three.js · i18next (11 languages)
• Backend   — Node.js serverless on Vercel · Gemini proxy (API key server-side) · weather-history API
• AI        — Google Gemini as AGNI · 5-model fallback chain · grounding and India-only scope
              enforced in the system prompt
• Data / ML — Open-Meteo · ESA WorldCover 10 m · NASA MODIS MOD11A1 via AppEEARS ·
              OpenStreetMap Overpass · scikit-learn Random Forest, trained offline
• Hosting   — Vercel + GitHub Actions · verified with Playwright browser tests · no hardware
```

### Pointer 2 · Methodology and process for implementation

```
1. FETCH     — all 1,932 cities from Open-Meteo in paced batches, with connection retries
2. FLAG      — any city not refreshed is marked "carried forward", never shown as fresh
3. SNAPSHOT  — the day's readings are written to the 72-day daily archive
4. COMMIT    — cache, snapshot and index pushed to GitHub in one commit
5. REDEPLOY  — the commit triggers a Vercel rebuild carrying the new live data

Runs hourly through the Indian day, 3-hourly overnight, unattended.
Last run: 1,932 cities fetched, 0 carried forward.
```

**One line worth adding** (a juror will ask why it isn't a simple cron):

```
Vercel's cron caps a function at 60 seconds, but Open-Meteo weights a request by its location
count — a 1,932-city refresh needs minutes of pacing. GitHub Actions runs it unconstrained.
```

**Pictures:** `diagrams/04-self-refreshing-data-engine.png` · `diagrams/05-measured-before-after.png`
`screenshots/06-analysis-modis.png` · `screenshots/10-agni.png`

---

# SLIDE 4 — FEASIBILITY AND VIABILITY

### Pointer 1 · Analysis of the feasibility of the idea

```
• Already built and deployed — every feature is live and verified with automated browser tests
• ₹0 per month — free tiers of Open-Meteo, ESA, OSM, NASA Earthdata, Gemini, Vercel, GitHub
• 72 days of real daily data archived; the pipeline has run unattended since 22 June 2026
• Scales by configuration — adding a city is one line plus validated geocoding
```

### Pointer 2 · Potential challenges and risks

```
• API rate limits — Open-Meteo weights by location count; Gemini free tier ≈ 20 requests/day
• Data gaps — 24 hamlet names cannot be geocoded
• Model limits — the Random Forest is trained on 20 non-Indian cities
• Low-end phones and slow networks
```

### Pointer 3 · Strategies for overcoming these challenges

```
• Paced batches with retries and a halves pass; cron fallback; a 5-model AI chain;
  ranking answers computed from our own cache
• Validated geocoding fixed 469 wrong or missing cities; the remaining 24 stay honestly blank
• Both scores printed on screen — R² 0.95 validation and R² −0.39 unseen-city;
  roadmap is to retrain on Indian data
• Simplified map geometry, chunked rendering, opt-in Lite mode, works at 375 px
```

**Scale path and cost** (one line + the cost image):

```
NOW: live and free for 1,956 cities, no onboarding →
PILOT: one municipal corporation adopts the HAP checklist for a summer →
SCALE: state deployment at ~₹8,000–85,000 / month
```

**Pictures:** `diagrams/06-roadmap-now-pilot-scale.png` · `diagrams/07-scale-cost-estimate.png`
`screenshots/08-interventions.png`

---

# SLIDE 5 — IMPACT AND BENEFITS

### Pointer 1 · Potential impact on the target audience

```
CITIZENS
• Today's risk in their own language, 11 to choose from
• Safe hours today, from the day's feels-like curve
• A help card that changes with the weather — elderly checks first when extreme

MUNICIPAL OFFICIALS
• A severity-adaptive Heat Action Plan checklist
• Modelled on the Ahmedabad HAP and NDMA guidelines
• Ticks saved per city with timestamps as a local record

PLANNERS AND POLICY
• Compare cities on live heat, air quality and canopy
• Simulate canopy, cool roofs and water bodies before spending
• Ask AGNI "why is this city hot?" — answered from the same numbers the map shows
```

### Pointer 2 · Benefits of the solution

```
• SOCIAL        — heat-health awareness for the most exposed: elderly and outdoor workers;
                  11 languages; citizen and authority on one shared picture
• ECONOMIC      — target cooling budgets where projected °C reduction is highest;
                  cool-roof ROI from Ahmedabad and Telangana pilot coefficients
• ENVIRONMENTAL — promotes tree canopy, reflective roofs and water bodies against a
                  measurable 30 % target; tracks air quality alongside heat
• GOVERNANCE    — transparent, auditable data: every daily snapshot sits in public git history;
                  an operational aid across all 28 states and 8 UTs
```

**Pictures:** `diagrams/09-three-audiences.png` · `diagrams/08-severity-adaptive-tiers.png`
`screenshots/26-cold-checklist.png`

---

# SLIDE 6 — RESEARCH AND REFERENCES

```
• Open-Meteo — live weather, air quality (CAMS), elevation, geocoding
  open-meteo.com/en/docs
• NASA MODIS MOD11A1 v6.1 (Terra) — daily 1 km land-surface temperature via Earthdata / AppEEARS;
  in the app for 1,912 cities since 1 March 2026
  lpdaac.usgs.gov/products/mod11a1v061
• ESA WorldCover 10 m (2021) — satellite land-cover classification; tree canopy as class 10
  esa-worldcover.org
• OpenStreetMap — Overpass API (building density), Nominatim (validated coordinates)
• MODIS land-surface-temperature dataset, Data in Brief (Elsevier) — training data for our model
  doi.org/10.1016/j.dib.2019.103803
• 3-30-300 rule — Konijnendijk (2023), Journal of Forestry Research 34(3) — source of the 30 % target
  doi.org/10.1007/s11676-022-01523-z
• Canopy-deficit audit — Nature Communications (2024)
  doi.org/10.1038/s41467-024-53402-2
• NDMA — Guidelines for Preparation of Action Plan: Prevention and Management of Heat Wave
  ndma.gov.in/Natural-Hazards/Heat-Wave
• Ahmedabad Heat Action Plan (AMC / NRDC / IIPH-Gandhinagar) — basis of our action checklist
• Telangana Cool Roof Policy 2023–28 — cool-roof cost and benefit coefficients
• URDPFI Guidelines 2014 (MoHUA) — open-space norm, 10–12 m² per person
• India Meteorological Department — official heatwave criteria — mausam.imd.gov.in
• BHRIGU (CSTEP) — closest government-backed platform, our comparison baseline
• ISRO MOSDAC / INSAT-3D — planned next data source; pipeline written, access requested

Live prototype: heatops.vercel.app
Source and every daily snapshot since 22 June 2026: github.com/kkrrishagarwal/heatops
```

---

# If you still want AI-generated diagrams

**Read this first.** Image generators cannot spell reliably inside diagrams. The Gemini deck
produced *"Requests Open-Meteo perpicual motion engine"* in the middle of its best diagram, and
that text cannot be edited once it is an image. On a deck whose whole argument is that your
numbers survive checking, a visible typo inside your flagship graphic is expensive.

**Two safer routes, in order:**

1. **Use the PNGs in `docs/diagrams/`.** Real numbers, correct spelling, already made.
2. **Build it in PowerPoint** — Insert → SmartArt → *Process* (for the 5-step loop) or *Cycle*
   (for the data engine). Type the text yourself. It stays sharp at any zoom, editable, and matches
   your template's fonts.

**If you still want to try an image model**, prompt for the *shape only* and add text in
PowerPoint on top:

```
A clean, minimal 5-step circular process diagram. Five numbered circles evenly spaced around
a thin ring, connected by arrows flowing clockwise. Flat vector style, white background,
single burnt-orange accent colour (#B45309) with dark navy details. No text, no labels,
no words anywhere in the image. Plenty of empty space around each circle for captions to be
added later. Professional government-report style, not futuristic, no glow, no 3D.
```

```
A minimal ascending staircase diagram with three flat platforms rising left to right,
connected by a single thin line with a small marker on each platform. Flat vector style,
white background, burnt-orange line, dark navy platforms. No text or labels of any kind.
Space above and beside each platform for captions to be added later.
```

The instruction **"no text, no labels, no words anywhere"** is the important part — it is what
stops the model from inventing garbled words.

---

# Final checklist before uploading

```
[ ] Exactly 6 slides — SIH's "Important Instructions" slide deleted
[ ] Team name filled in the oval on every slide
[ ] All six title-page fields filled
[ ] Saved as PDF (portal rejects .pptx and .docx)
[ ] Opened the PDF on a second device to check fonts and images survived
```
