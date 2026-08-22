# HeatOps PRD

## 1. Product Summary
HeatOps is an India-wide urban heat intelligence and intervention planning platform. It helps citizens, planners, and policy teams understand where heat risk is high, why it is happening, and what actions can reduce exposure and cooling demand.

The product combines live weather, AQI, satellite-derived land cover metrics, urban morphology data, and AI-based interpretation into a single decision-support dashboard. It is built for the Indian context, with state and district coverage, multi-language access, and actionable planning tools.

## 2. Problem Statement
Indian cities are experiencing rising Urban Heat Island (UHI) intensity due to dense built-up areas, loss of vegetation, limited water bodies, and high exposure to heat stress. The challenge is not a lack of data but a lack of integrated, accessible, and actionable insight.

Current users face these issues:
- Citizens cannot see the real drivers of heat risk in their city.
- Municipal planners lack a single comparison tool to benchmark cities and interventions.
- Decision makers need recommendations without technical complexity.
- Most climate tools are English-only or static dashboards with unclear numbers.

## 3. Target Users
### 3.1 Citizens
Need to know:
- Is my city unusually hot?
- Why is it hotter than nearby areas?
- What should I do during heat risk conditions?

### 3.2 Urban Planners and Municipal Staff
Need to know:
- Which city or district is most heat vulnerable?
- What land-cover or infrastructure factors drive the risk?
- Which interventions are most effective for local conditions?

### 3.3 Policy and Research Stakeholders
Need to know:
- Where heat risk is concentrated and rising.
- Which interventions have the biggest system-level impact.
- How AI-based interpretation can support public discussion and decision making.

## 4. Product Goals
### Primary Goals
- Provide real-time heat severity context for Indian cities.
- Combine weather, AQI, land cover, and morphology data in one interface.
- Improve planning decisions with intervention simulations.
- Deliver multi-language, accessible information.
- Maintain trust by showing data sources and honest limitations.

### Secondary Goals
- Make the platform usable for non-technical audiences.
- Support comparison across cities and states.
- Present AI-generated insights in plain language with explicit labels for estimated values.
- Keep data fresh through automated refresh workflows.

## 5. Non-Goals
- Full climate forecasting for all applications and sectors.
- Real-time disaster response operations.
- Building a general-purpose GIS platform beyond heat-risk analysis.
- Claiming certainty where data is missing or model confidence is weak.

## 6. Core Use Cases
### Use Case 1: Explore heat risk by geography
A user opens the India map, selects a state, and drills into cities to view temperature, AQI, and heat-risk context.

### Use Case 2: Investigate city conditions
A user clicks a city and reviews live weather, satellite indices, and explanatory risk signals.

### Use Case 3: Compare cities
A planner compares up to several cities on heat, vegetation, built-up intensity, wind, and water-related indicators.

### Use Case 4: Simulate interventions
A planner changes green cover, reflective roof, or water-body assumptions and sees projected temperature reduction.

### Use Case 5: Ask the AI analyst
A user asks the AGNI assistant questions like “Why is my city hot?” or “Which intervention is most effective?” and receives structured explanations grounded in available data.

## 7. Functional Requirements
### 7.1 Map and Discovery
- Show a national India heat map with state and district-level geographic structure.
- Allow drill-down from state to city level.
- Use color-coded heat severity categories.
- Support quick-pick city navigation.

### 7.2 City Dashboard
- Display live weather data including temperature, humidity, wind, pressure, and AQI.
- Show forecast and recent trend context.
- Present satellite-derived index values such as LST, NDVI, NDBI, and NDWI.
- Show city comparison and historical context.

### 7.3 Decision Support
- Provide city-to-city comparisons.
- Simulate cooling interventions.
- Estimate how changes may reduce heat exposure.

### 7.4 AI Analyst
- Support natural-language questions about city heat conditions.
- Return structured explanations for heatwave risk, vulnerability, intervention impact, and multi-city comparisons.
- Clearly label estimated or missing values instead of presenting them as exact measurements.

### 7.5 Localization
- Support 11 Indian languages in the UI.
- Maintain the same product behavior across languages.

## 8. Non-Functional Requirements
- The interface should feel responsive and interactive on standard desktop browsers.
- The map rendering should remain smooth even when large geographic datasets are loaded.
- Data sources and limitations should be visible to users.
- The app should remain understandable to a non-technical audience.
- Daily refresh mechanisms should minimize stale information.

## 9. Success Metrics
- Users can discover a city and view relevant heat data within seconds.
- At least one comparison or intervention workflow is completed by most users.
- The live dashboard stays fresh with near-daily refresh cycles.
- The AI assistant provides clearly grounded responses with transparent caveats.
- The platform is used across multiple Indian-language experiences.

## 10. Risks and Constraints
- External API availability and rate limits.
- Incomplete or inconsistent geo data for some local areas.
- Model uncertainty for unseen cities or sparse contexts.
- Need to balance simplicity with technical transparency.

## 11. Release Scope
This project is scoped as a decision-support dashboard and AI assistant for heat-risk analysis, not as a fully integrated climate operations command center.

## 12. Product Positioning
HeatOps is positioned as an actionable, real-data, India-first heat intelligence platform that blends monitoring, comparison, planning, and plain-language AI explanation into one experience.
