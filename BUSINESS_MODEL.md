# BhaskarOps — Cost, Funding Ask, and How It Earns

*For the feasibility / business-model question. All figures are estimates in INR for 2026 and are marked as such; list prices of third-party services must be re-checked before any proposal is signed. Nothing here is a claimed revenue.*

---

## 1. What it costs today

**₹0 per month.** The prototype runs entirely on free tiers: Vercel Hobby hosting, GitHub Actions for the data refresh, Open-Meteo's free API, NASA and ESA open data, OpenStreetMap, and Gemini's free tier for AGNI. No servers, no database, no paid licences. That is a fact about the deployed system, not an estimate.

---

## 2. What it costs to run properly for governments (estimates)

The moment real officers depend on it, three things must change: paid tiers so nothing rate-limits during a heatwave, a small team to keep it honest and current, and support. Estimated annual running cost for **one state**:

| Item | Why | Estimate / year |
|---|---|---|
| Hosting (Vercel Pro or equivalent, CDN, uptime) | SLA, no free-tier limits | ₹60,000 – ₹1,20,000 |
| Weather API commercial licence (Open-Meteo or IMD data feed) | Free tier forbids commercial use; hourly refresh for 1,932 cities | ₹1,50,000 – ₹4,00,000 |
| AI (Gemini paid tier) | ~500 officer questions/day at peak | ₹1,00,000 – ₹3,00,000 |
| Satellite data pipeline (NASA/ISRO ingestion, monthly reprocessing) | Compute + storage, still open data | ₹50,000 – ₹1,00,000 |
| Database + backups (when accounts, audit logs and checklist history move off the browser) | Managed Postgres | ₹60,000 – ₹1,50,000 |
| Security audit, accessibility audit (GIGW compliance) | Required for a government deployment | ₹2,00,000 – ₹4,00,000 (one-time) |
| **Team** — 2 engineers, 1 data/GIS analyst, 1 domain liaison with the SDMA, part-time | The product is only as honest as the people checking it | ₹36,00,000 – ₹60,00,000 |
| Training and support for district officers (workshops, helpline) | Adoption is the hard part | ₹3,00,000 – ₹6,00,000 |
| **Total, first year, one state** | | **≈ ₹45 lakh – ₹80 lakh** |
| **Each additional state** (shared team and pipeline) | | **≈ ₹8 lakh – ₹15 lakh** |

The marginal cost per state is low because the data pipeline is national already: adding a state is officer accounts, training and support, not new infrastructure.

---

## 3. What to ask the government for

**Ask for a 12-month pilot, not a purchase.** Governments fund pilots readily and buy after evidence.

| Ask | Amount (estimate) | What they get |
|---|---|---|
| **Pilot grant, one state, 12 months** | **₹75 lakh – ₹1 crore** | Deployment for every district in the state, officer training, the Smart Mitigation Planner calibrated to the state's schedule of rates, an evaluation report against the season's heat-action outcomes |
| Add-on: ISRO INSAT-3D / IMD data integration | ₹15 – ₹25 lakh | Official Indian sources alongside NASA, which the state will want for procurement decisions |
| Add-on: population and ward layer (Census / SECC integration) | ₹10 – ₹20 lakh | Turns "roofs and hectares" into "people benefited", which the planner deliberately does not claim today |

Where the money comes from, realistically: **State Disaster Mitigation Fund** (NDMA guidelines allow heat-action expenditure), **Smart Cities Mission** balances, **NHM climate and health cells**, **AMRUT 2.0** urban planning components, and CSR (Schedule VII, disaster management and environment). The pitch to each: *"you already spend on heat-action plans; this is the tool that decides where that spend goes."*

Under the grant the code stays open-source; the state pays for deployment, calibration, training and support, not for a licence. That is what makes it fundable and what keeps the honesty rules auditable.

---

## 4. Where BhaskarOps earns (after the pilot)

| Stream | Model | Estimate |
|---|---|---|
| **State subscription (SaaS)** | Per state per year: hosting, data, support, updates | ₹15 – ₹30 lakh / state / year. 10 states ≈ ₹1.5 – ₹3 crore / year |
| **Municipal corporation tier** | Large ULBs that want ward-level planning and their own officer accounts | ₹2 – ₹5 lakh / city / year |
| **Mitigation planning as a service** | A costed, explained plan for a DDMA meeting or a cool-roof tender — the planner's export, done with the state's own rates | ₹50,000 – ₹2 lakh / report |
| **Training and certification** | District officer workshops on heat-action planning with the tool | ₹1 – ₹2 lakh / batch |
| **Data and API access** | Insurers, real-estate, utilities wanting the city heat index and satellite series | ₹5 – ₹20 lakh / year / client |
| **CSR partnerships** | Corporates funding cool-roof or plantation programmes chosen by the planner, with BhaskarOps as the monitoring layer | Project-based |

**Break-even, rough:** the running cost in section 2 for ten states is about ₹1.5 crore a year (one team, ten deployments). Ten state subscriptions at the low end cover it; anything above that, and every city tier, report or data client, is margin. This is a small, sustainable public-infrastructure business, not a venture-scale one — say that plainly; judges trust it more.

---

## 5. What we will not do

- Sell citizen data. The Citizen view has no accounts and no tracking.
- Charge citizens. The public map stays free.
- Claim outcomes the model cannot back. Every number in a paid report carries the same "estimated / assumption / source" labels as the free app.

---

## 6. The one-minute answer for a judge

> "It costs us nothing today, because it runs on open data and free tiers. To run it for a state properly costs about ₹45 to 80 lakh in the first year, mostly people, and about ₹10 lakh for each further state. We would ask a state for a ₹75 lakh to ₹1 crore twelve-month pilot from its disaster mitigation fund, keep the code open, and earn afterwards through state subscriptions of ₹15 to 30 lakh a year, city tiers, costed mitigation reports, officer training and data access. Ten states cover the team; everything above that is margin. The map stays free for citizens."
