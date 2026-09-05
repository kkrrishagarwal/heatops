# BhaskarOps Design

## 1. Design Goals
BhaskarOps is designed to look authoritative, technical, and actionable without becoming unreadable. The interface should communicate urgency and precision while remaining approachable for non-specialists.

### Core design principles
- Real data first
- Clean decision support flow
- Mission-control visual language
- High contrast readability
- Multi-language usability
- Trust through transparency

## 2. Visual Language
### Theme
The application uses a dark civic-tech palette (redesigned 28 Aug 2026 away from the earlier neon green/cyan look):
- deep slate backgrounds (`#0f172a` / `#1e293b`)
- a single amber accent (`#d97706`) for actions and emphasis
- desaturated risk colours for the six heat tiers (Extreme `#b91c1c`, Very High `#c2410c`, High `#b45309`, Moderate `#ca8a04`, Low-Moderate `#4d7c0f`, Low `#15803d`)
- a heat-reactive theme: the dashboard's accent/glow follows the selected city's live temperature in four tiers (≥ 45 red · 35–44 orange · 25–34 yellow · < 25 green); the Heat Risk Gauge uses the same tiers
- glow and blur effects are optional — Lite mode removes them for low-end devices

### Aesthetic intent
The look is meant to suggest climate intelligence, monitoring, and operational planning. The design balances premium dashboard aesthetics with practical data scanning.

## 3. Interaction Model
### Map-first exploration
The first major user action is geographic discovery: the user sees the India map and chooses a location or city of interest.

### Drill-down flow
1. One-time "Who are you?" — Citizen or Government / Planner (changeable later from the profile menu; independent of the Mobile / Laptop layout toggle)
2. National map overview — each state coloured by the risk category most of its cities are in (plurality; ties → more severe); a single 🌫️ / 🌧️ / ☁️ badge where a weather condition crosses its threshold
3. State selection — its cities refresh live in one call; the side panel shows the per-category city counts behind the colour and the live median, not a seed
4. City selection
5. Dashboard: Citizen = Overview · What to do · Compare; Authority = Overview · Analysis · Compare · Interventions · AI + Export (+ Heatwave Action Checklist)

### Information density
The experience is optimized to surface the most important signals first:
- current conditions
- heat severity
- local drivers
- comparison context
- intervention outcomes

## 4. Layout Philosophy
### Dashboard structure
The interface uses modular panels for:
- weather and AQI
- city summary and risk
- land cover and urban morphology
- comparison analysis
- intervention planning
- AI analyst
- export and communication

### Readability rules
- Headings remain short and scannable
- Metrics are highlighted with strong contrast
- Charts supplement, not replace, explanation
- Average-risk and extreme-risk states are clearly differentiated

## 5. UX Patterns
### Quick access
Users can jump directly to major cities using quick-pick controls instead of searching every time.

### Status context
The interface communicates data freshness, risk levels, and source quality so users understand whether the information is live, cached, or estimated.

### Honesty states
Where data is incomplete or estimated, the product does not hide it behind false precision. Concretely: "NO LIVE DATA" badges instead of guessed temperatures, "carried forward" flags on stale readings, a base-temperature line under the Analysis grid, "baseline" labels on illustrative indices, "(estimated)" tags in AGNI answers, and a green dot on rows refreshed in the last few minutes.

### Citizen essentials
The citizen top strip carries only: city, temperature, a plain-language risk badge, the air-quality category, the weather condition and one tip. "What to do" adds Safe hours today (one bar, "Right now" status), Share with family (WhatsApp) and a "How you can help your neighbourhood" card; the Interventions tab shows a Recommended plan (tree canopy vs the 3-30-300 rule's 30 %) with one-click apply.

## 6. Component Design
### Map component
- Uses real state and district geography
- Supports active heat-state coloring
- Highlights selected cities and states
- Prioritizes responsiveness and minimal lag

### Weather card
- Compact, glanceable summary
- Includes live environmental indicators and freshness signal
- Presents forecast and AQI in an operational style

### Analysis panels
- Use charts and scores to compare metrics
- Keep labels close to each metric for fast reading
- Maintain consistent risk color mapping across panels

### AI panel
- Conversational but structured
- Visually distinct from core dashboards
- Includes clear answer boundaries and estimated-value labeling

## 7. Accessibility and Inclusion
- Multi-language support across major Indian languages
- Clear contrast for status and risk categories
- Avoid heavy reliance on color alone for meaning
- Simplify complex charts with textual context

## 8. Design System Notes
### Risk color scale (map, six tiers)
- Low < 25 °C: green · Low-Moderate 25–30: olive · Moderate 30–35: yellow · High 35–40: amber-brown · Very High 40–45: orange · Extreme 45+: red
- Semantic colours never double as the accent; the amber accent is reserved for actions

### Typography (4 Sept 2026)
- Panel titles are small tracked overlines in muted slate; the icon carries the accent
- Archivo for display-size numbers, Inter + Indic fallbacks for body, IBM Plex Mono for the AGNI terminal; `tabular-nums` everywhere digits line up
- Keep labels concise and readable on dark backgrounds

### Icons
- One lucide stroke-icon set (`PanelIcon`) for every heading and button — no emoji as chrome; emoji only where they are content (weather words, checklist pictograms)

### Motion
- Use subtle motion to reinforce status changes and user actions
- Avoid distracting animation that reduces data legibility
- Respect `prefers-reduced-motion`; Lite mode disables animations, blur and shadows entirely (framer-motion is installed for future transitions, unused so far)

## 9. User Experience Outcomes
The design should help users achieve the following outcomes quickly:
- Understand where heat risk is highest
- Identify local heat drivers
- Compare city conditions with confidence
- Simulate mitigation actions
- Ask and understand AI-generated explanations

## 10. Success Criteria for Design
- The UI feels premium and credible without being difficult to use
- Users can navigate from map to insight without friction
- Data storytelling remains clear even in dense panels
- The product remains consistent across languages and scales
