# BhaskarOps Memory

## 1. Project Identity
BhaskarOps is the India-focused urban heat intelligence platform built to monitor, compare, and mitigate heat risk across cities and states.

## 2. Core Product Lens
This project is not simply a weather dashboard. It is a planning and decision-support system that combines:
- live climate and AQI monitoring
- geospatial heat context
- land-cover and urban morphology understanding
- city-to-city comparison
- intervention simulation
- AI explanation and recommendations

## 3. Core Technical Facts
- Frontend: React + Vite
- Data and backend support: Flask app and serverless functions
- Map rendering: react-simple-maps and GeoJSON assets
- Visualization: Recharts, charts, and dashboard components
- Security: AI API key stays server-side
- Languages: English + 10+ Indian languages supported in the UI

## 4. Design and Product Truths
- Real data is more valuable than simulated polish.
- Honest limitations build trust.
- The app must explain heat drivers, not just temperature values.
- Actionability matters more than static storytelling.
- A user should be able to move quickly from geographic selection to decision support.

## 5. Product Lessons Learned
- Users expect a map-first experience, not a raw dataset view.
- Local context and language support matter for usability in India.
- AI is best used as a guide and explainer, not as a black-box authority.
- Freshness and source transparency are critical to credibility.
- Simulated values should be avoided; estimated values must be labeled.

## 6. Operational Notes
- Live refresh jobs keep weather cache content current.
- GeoJSON and cached data files are core project assets.
- The system architecture should be built to handle national coverage without sacrificing responsiveness.

## 7. Strategic Direction
BhaskarOps should continue to evolve toward a stronger public-interest climate operations tool by improving:
- real-time data automation
- high-resolution urban heat mapping
- clear climate adaptation workflows
- policy-relevant intervention simulations

## 8. Final Product North Star
BhaskarOps should remain a platform that helps people understand the why behind urban heat and turn that understanding into practical mitigation decisions.
