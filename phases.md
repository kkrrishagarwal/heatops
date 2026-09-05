# BhaskarOps Phases

## Phase 0: Problem Framing and Product Direction
### Goal
Define the idea and product promise clearly around India-wide urban heat risk monitoring and intervention planning.

### Deliverables
- Product narrative
- Problem definition
- Use-case mapping
- Initial system concept

### Outcome
A clear mission: make Indian heat risk understandable, comparable, and actionable.

---

## Phase 1: Foundation and Data Integration
### Goal
Create the baseline dashboard with actual Indian map coverage and operational weather data.

### Included work
- Map rendering with states and city layers
- Weather and AQI display
- Geo and city data integration
- Baseline dashboard panels
- Initial data caching and refresh strategy

### Outcome
Users can identify a city, view its live heat context, and navigate the map confidently.

---

## Phase 2: Intelligence and Analysis
### Goal
Add the analytical core: satellite indices, land-cover understanding, analysis logic, and comparison features.

### Included work
- LST, NDVI, NDBI, NDWI analysis
- City-level comparison charts
- Land-cover and urban morphology data
- Historical comparisons and heat risk views
- Model-driven contextual analysis

### Outcome
The product becomes more than a map; it becomes a heat-analysis workspace.

---

## Phase 3: Action and Decision Support
### Goal
Turn inspection into planning by letting users test interventions and estimate impact.

### Included work
- Intervention simulation sliders
- Temperature reduction calculations
- City planning narratives
- Policy-oriented recommendation logic

### Outcome
Users can move from diagnosis to action and investment decisions.

---

## Phase 4: AI and Conversational Intelligence
### Goal
Expose the intelligence through a plain-language conversational layer.

### Included work
- AGNI AI assistant
- Secure server-side Gemini integration
- Structured answer templates
- Multilingual support
- Clear estimation labels and data disclaimers

### Outcome
Users can ask natural questions and receive understandable city-level guidance.

---

## Phase 5: Scale, Trust, and Freshness
### Goal
Prepare the app for public use and releasable live operations.

### Included work
- Automated refresh and data update jobs
- Cache management and freshness indicators
- Production-quality deployment setup
- Performance tuning
- UX polish and reliability testing

### Outcome
The platform remains credible, fresh, and production-like in a public deployment environment.

### Status (1 Sept 2026) — delivered
- Automated refresh (GitHub Actions 3-hourly written; Vercel Cron 14:30 IST + 16:00 IST retry live), daily history snapshots (65+ days), history viewer + CSV, carried-forward flagging
- Validated geocoding for 1,932 cities; "NO LIVE DATA" instead of fabricated numbers; state colour by the plurality risk category of live cities (ties → more severe), median as detail; live refresh of the opened state
- Citizen / Authority views with Safe hours, WhatsApp share, neighbourhood help card, Heatwave Action Checklist; Compare for citizens
- Analysis grid on live temperature; Recommended plan (tree canopy vs the 3-30-300 rule's 30 %)
- AGNI: India-only scope, national ranking answers, conversation memory, markdown, 5-model fallback chain
- Map: weather badges, fit-to-card projection, zoom floor; Lite mode for low-end devices; cache auto-retry
- Verified with Playwright screenshots on production after every change

---

## Phase 6: Product Maturity and Expansion
### Goal
Extend the product beyond the first release while keeping the focus on heat-risk actionability.

### Possible next steps
- Compare radar on live values instead of seeded indices; wire or drop the PDF/CSV export claim
- 30-day trend chart on the city Overview from the history archive; IMD-rule heat alerts
- ISRO INSAT-3D LST via MOSDAC (pipeline written, pending approval); retrain the ML model on Indian cities
- Expand to more geographies and more local datasets
- Add more intervention models and forecast scenarios
- Improve decision dashboards for municipal workflows
- Add deeper exportability and reporting tools
- Expand AI-driven summarization and planning support

### Outcome
BhaskarOps evolves from a strong proof of concept into a core public-interest climate operations platform.
