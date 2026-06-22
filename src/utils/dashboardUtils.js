// SECTION 4 & 5 - MAP AND DASHBOARD UTILITIES

// SECTION 4 - FIX 1: State name normalization
const STATE_NAME_FIXES = {
  "Chhattisgarh":   "Chhattisgarh",
  "Chattisgarh":    "Chhattisgarh",
  "Chhatisgarh":    "Chhattisgarh",
  "Orissa":         "Odisha",
  "Uttaranchal":    "Uttarakhand",
  "Pondicherry":    "Puducherry",
  "NCT of Delhi":   "Delhi",
  "NCT Of Delhi":   "Delhi",
  "Jammu & Kashmir":"Jammu and Kashmir",
  "J&K":            "Jammu and Kashmir",
  "The Dadra And Nagar Haveli And Daman And Diu":
    "Dadra and Nagar Haveli and Daman and Diu",
  "Andaman & Nicobar Islands":
    "Andaman and Nicobar Islands",
  "Andaman and Nicobar":
    "Andaman and Nicobar Islands",
  "Telangana":      "Telangana",
  "Telengana":      "Telangana",
}

export function normalizeStateName(raw) {
  if(!raw) return ""
  const trimmed = raw.trim()
  return STATE_NAME_FIXES[trimmed] || trimmed
}

// SECTION 5 - FIX 1: Heatmap cell temperature calculation
export function getCellTemp(baseTemp, row, col,
  treeSlider, roofSlider, waterSlider) {
  
  const treeCooling   = treeSlider  * 18
  const roofCooling   = roofSlider  * 14
  const waterCooling  = waterSlider * 12
  const totalCooling  = treeCooling + 
                        roofCooling + 
                        waterCooling

  // Each cell gets slight variation
  const cellSeed = (row * 10 + col)
  const variation = ((cellSeed % 20)/20)*4 - 2
  
  return parseFloat(
    (baseTemp + variation - totalCooling)
    .toFixed(1)
  )
}

// SECTION 5 - FIX 2: City-specific historical trend
export function getHistoricalData(cityName, cityData) {
  const baseLST = cityData.lst
  const seed = cityName.split('')
    .reduce((a,c)=>a+c.charCodeAt(0),0)%100
  const trend = 0.3 + (seed/100)*0.4

  return [
    { year:2015, urban:baseLST-trend*5,
      rural:baseLST-trend*5-4.2 },
    { year:2017, urban:baseLST-trend*4,
      rural:baseLST-trend*4-4.8 },
    { year:2019, urban:baseLST-trend*3,
      rural:baseLST-trend*3-5.4 },
    { year:2021, urban:baseLST-trend*2,
      rural:baseLST-trend*2-5.9 },
    { year:2023, urban:baseLST-trend,
      rural:baseLST-trend-6.4 },
    { year:2025, urban:baseLST,
      rural:baseLST-6.8 },
  ].map(d => ({
    ...d,
    urban: parseFloat(d.urban.toFixed(1)),
    rural: parseFloat(d.rural.toFixed(1))
  }))
}

// SECTION 5 - FIX 3: City-specific Day vs Night
export function getDayNightData(cityData, cityName) {
  const seed = cityName.split('')
    .reduce((a,c)=>a+c.charCodeAt(0),0)%100
  const uhiIntensity = 3 + (seed/100)*4

  const months = [
    "Jan","Feb","Mar","Apr","May","Jun",
    "Jul","Aug","Sep","Oct","Nov","Dec"
  ]
  const baseTemps = [
    -8,-5,-1,3,8,7,3,2,1,-1,-5,-8
  ]

  return months.map((month,i) => ({
    month,
    day:   parseFloat(
      (cityData.lst + baseTemps[i]).toFixed(1)
    ),
    night: parseFloat(
      (cityData.lst + baseTemps[i] 
       - uhiIntensity).toFixed(1)
    )
  }))
}

// SECTION 5 - FIX 4: Historical heatwave timeline, derived from the same seeded
// 10-year urban LST trend used elsewhere (getHistoricalData) — no new data source.
// Years where the trend's yearly urban LST crosses a heatwave threshold (40C) are
// surfaced as discrete events with a deterministic (seeded, not random-per-render)
// peak date/duration so the same city always shows the same timeline.
export function getHeatwaveEvents(cityName, cityData) {
  const trend = getHistoricalData(cityName, cityData)
  const seedBase = cityName.split('')
    .reduce((a,c)=>a+c.charCodeAt(0),0)

  return trend
    .filter(d => d.urban >= 40)
    .map(d => {
      const seed = (seedBase + d.year) % 100
      const peakOffset = 1.5 + (seed/100)*2.5
      const duration = 3 + Math.round((seed/100)*7)
      const peakDay = 1 + (seed % 28)
      const peakMonth = (seed % 2 === 0) ? 'May' : 'Jun'
      return {
        year: d.year,
        date: `${peakDay} ${peakMonth} ${d.year}`,
        peakTemp: parseFloat((d.urban + peakOffset).toFixed(1)),
        durationDays: duration
      }
    })
    .sort((a,b) => b.year - a.year)
}

// SECTION 5 - FIX 5: Year-over-year comparison stat. Derives an estimated
// "same date last year" temperature from the annual rate of change in the
// existing 10-year urban LST trend (2023→2025 slope), applied one year back
// from today's live temperature. Falls back to null if live temp unavailable.
export function getYoYComparison(cityName, cityData, currentTemp) {
  if (typeof currentTemp !== 'number') return null
  const trend = getHistoricalData(cityName, cityData)
  const recent = trend[trend.length - 1]
  const prior = trend[trend.length - 2]
  if (!recent || !prior) return null
  const annualSlope = (recent.urban - prior.urban) / (recent.year - prior.year)
  const lastYearTemp = parseFloat((currentTemp - annualSlope).toFixed(1))
  const delta = parseFloat((currentTemp - lastYearTemp).toFixed(1))
  return { lastYearTemp, delta }
}

// SECTION 7 - AUTH FLOW UTILITIES

// Get stored users from localStorage
export function getUsers() {
  try {
    const users = JSON.parse(localStorage.getItem('heatops_users') || '[]')
    return users
  } catch(e) {
    return []
  }
}

// Get login history
export function getLoginHistory() {
  try {
    const history = JSON.parse(localStorage.getItem('heatops_login_history') || '[]')
    return history
  } catch(e) {
    return []
  }
}

// Save login history entry
export function saveLoginHistory(entry) {
  const history = getLoginHistory()
  history.push(entry)
  localStorage.setItem('heatops_login_history', JSON.stringify(history))
}

// Get analytics data for admin
export function getAnalyticsData() {
  const history = getLoginHistory()
  const users = getUsers()

  // Real city data from login history
  const cityCount = {}
  history.forEach(h => {
    h.citiesViewed?.forEach(city => {
      cityCount[city] = 
        (cityCount[city] || 0) + 1
    })
  })

  // Real hourly login data
  const hourlyLogins = Array(24).fill(0)
  history.forEach(h => {
    if(h.status === "success") {
      const hour = new Date(h.loginTime)
        .getHours()
      hourlyLogins[hour]++
    }
  })

  // Real daily logins last 30 days
  const dailyLogins = {}
  const thirtyDaysAgo = Date.now() - 
    30 * 24 * 60 * 60 * 1000
  history.filter(h => 
    new Date(h.loginTime).getTime() > 
    thirtyDaysAgo
  ).forEach(h => {
    const day = h.loginTime.split("T")[0]
    if(!dailyLogins[day]) 
      dailyLogins[day] = 
        {success:0, failed:0}
    if(h.status==="success") 
      dailyLogins[day].success++
    else dailyLogins[day].failed++
  })

  return { cityCount, hourlyLogins, 
           dailyLogins, users, history }
}

// Calculate time spent in app
export function getTimeSpent(userId) {
  const history = getLoginHistory()
  
  let totalMs = 0
  history.filter(h => 
    h.userId === userId && h.duration
  ).forEach(h => {
    const parts = h.duration
      .match(/(\d+)h\s*(\d+)m|(\d+)m/)
    if(parts) {
      if(parts[1]) {
        totalMs += 
          parseInt(parts[1])*60*60*1000 +
          parseInt(parts[2])*60*1000
      } else if(parts[3]) {
        totalMs += 
          parseInt(parts[3])*60*1000
      }
    }
  })

  const totalHours = Math.floor(
    totalMs/3600000
  )
  const totalMins = Math.floor(
    (totalMs%3600000)/60000
  )
  return totalHours > 0
    ? `${totalHours}h ${totalMins}m`
    : `${totalMins}m`
}
