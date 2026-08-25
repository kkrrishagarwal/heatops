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
The application uses a dark mission-control palette with:
- deep navy / charcoal backgrounds
- bright cyan and green accents
- warm orange/red risk signals for severity spikes
- subtle glow and highlight effects for emphasis

### Aesthetic intent
The look is meant to suggest climate intelligence, monitoring, and operational planning. The design balances premium dashboard aesthetics with practical data scanning.

## 3. Interaction Model
### Map-first exploration
The first major user action is geographic discovery: the user sees the India map and chooses a location or city of interest.

### Drill-down flow
1. National map overview
2. State selection
3. City selection
4. Dashboard context and action panels

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
Where data is incomplete or estimated, the product does not hide it behind false precision. The design reinforces trust by showing caveats and labels clearly.

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
### Risk color scale
- Low: cool/blue-green tones
- Moderate: yellow to amber
- High: orange
- Extreme: red / magenta

### Typography
- Use a modern dashboard style with emphasis on numeric clarity
- Keep labels concise and readable on dark backgrounds

### Motion
- Use subtle motion to reinforce status changes and user actions
- Avoid distracting animation that reduces data legibility

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
