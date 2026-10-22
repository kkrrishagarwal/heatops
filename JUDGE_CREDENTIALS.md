# BhaskarOps — Judge Login Guide

**Live app:** https://heatops.vercel.app
**Team B26-0322 · Hackyard Build 2026 Grand Finale, IIT Guwahati**

## Login credentials

| Role | Email | Password | Lands on |
|---|---|---|---|
| Central Admin (All-India) | `central@gmail.com` | `admin2026` | National overview, every state |
| Uttar Pradesh State Admin | `up@gmail.com` | `up2026` | Uttar Pradesh, Lucknow |
| Rajasthan State Admin | `rj@gmail.com` | `rj2026` | Rajasthan, Jaipur |
| Delhi NCR State Admin | `delhi@gmail.com` | `delhi2026` | Delhi, New Delhi |
| Assam State Admin (IIT Guwahati host) | `assam@gmail.com` | `assam2026` | Assam, Guwahati |
| Ladakh State Admin (cold-mode demo) | `leh@gmail.com` | `leh2026` | Ladakh, Leh |

**Quickest way in:** on the login page, click any row in the **Demo credentials** box. It fills the email and password and signs you in.

**Other logins that work:**

- Master password `bhaskar2026` works for every admin email below. Demo accounts also accept any password of 4 or more characters.
- Central Command: `india@gmail.com`, `admin@gmail.com`, `admin@ndma.gov.in`.
- Any state code or state name, with `@gmail.com` or `@bhaskarops.gov.in`.

| Code | State | Code | State | Code | State |
|---|---|---|---|---|---|
| `up` | Uttar Pradesh | `mh` | Maharashtra | `ka` | Karnataka |
| `rj` | Rajasthan | `gj` | Gujarat | `tn` | Tamil Nadu |
| `dl` / `delhi` | Delhi | `wb` | West Bengal | `ts` | Telangana |
| `as` / `assam` | Assam | `br` | Bihar | `kl` | Kerala |
| `ld` / `leh` | Ladakh | `mp` | Madhya Pradesh | `pb` | Punjab |
| `jk` | Jammu and Kashmir | `hp` | Himachal Pradesh | `od` | Odisha |

## What each login shows

### Central Admin

- Opens on the **All-India National Overview** with no state selected.
- Header badge: **🇮🇳 CENTRAL COMMAND // ALL-INDIA JURISDICTION**.
- Can select any state, drill into any district and compare any cities across India.

### State Admin

- The map flies to the state, and the state's main city is selected.
- A **State Executive Summary** shows average air temperature, cities at or above 40 °C today, the hottest forecast, and cities below 10 °C, all from live readings.
- Header badge: **🏛️ STATE ADMIN: \<STATE\> // INTRA-STATE TRANSPARENCY ACTIVE**.
- City search lists the state's own cities first.
- **Compare** allows up to three cities inside the state, plus **one** external benchmark city marked **🔒 Read-Only Benchmark — Outside State Jurisdiction**.

## Things to try

1. **Switch modes** in the header: **🏛️ Disaster Command** or **⚡ Power Grid & Load**. Power mode opens the Heat + Power workspace and draws the city's power grid on the map.
2. **📢 Push CAP SMS Alert** drafts a Common Alerting Protocol (CAP) alert, the format NDMA's SACHET system uses, plus the SMS text. It is marked as an exercise and is not sent.
3. **Full dashboard →** opens seven workspaces: Overview, Prediction, Analysis, Compare, Interventions, AI + Export, Heat + Power.
4. **Heat + Power** for Jaipur or Lucknow shows substations, power lines and industrial land, a grid simulator, and solar generation against cooling demand.
5. **Ladakh login** shows the cold-weather mode.

## Data honesty

| Label | Meaning |
|---|---|
| LIVE | Current Open-Meteo reading |
| FORECAST | Open-Meteo forecast, including the 31-run ensemble |
| SATELLITE | NASA MODIS surface temperature, ESA WorldCover land cover, OpenStreetMap grid |
| ESTIMATE / RULE-BASED | Model output with its method shown on screen |
| DEMO | Example network figures until an officer enters real ones |
| UNAVAILABLE | No source connected; nothing is invented |

The following show **UNAVAILABLE** because no feed is connected:

- live electricity demand
- substation loading
- SDRF budget
- population exposure

Grid-map geometry is pre-loaded for Jaipur and Lucknow.

> **Note:** These demo logins are for evaluation only. A real deployment would use government single sign-on with server-side role checks.
