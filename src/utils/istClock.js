/**
 * IST (India Standard Time) Clock Utility
 * Provides accurate IST time, date, day with live updates
 * IST = UTC + 5:30
 */

import React from 'react'

export function getISTDateTime() {
  const now = new Date()

  // Format in IST using Intl API (most reliable)
  const istFormatter = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  })

  const parts = istFormatter.formatToParts(now)
  const get = (type) => parts.find((p) => p.type === type)?.value

  const hour = parseInt(get('hour'))
  const isDay = hour >= 6 && hour < 18

  return {
    // Time components
    hour: get('hour'),
    minute: get('minute'),
    second: get('second'),
    dayPeriod: get('dayPeriod'), // AM/PM

    // Date components
    weekday: get('weekday'), // "Monday", "Tuesday" etc.
    day: get('day'), // "19"
    month: get('month'), // "June"
    year: get('year'), // "2026"

    // Formatted strings
    timeString: `${get('hour')}:${get('minute')}:${get('second')} ${get('dayPeriod')} IST`,
    dateString: `${get('weekday')}, ${get('day')} ${get('month')} ${get('year')}`,
    fullDateTime: `${get('weekday')}, ${get('day')} ${get('month')} ${get('year')} | ${get('hour')}:${get('minute')} ${get('dayPeriod')} IST`,

    // Time-based metadata
    hour24: hour,
    isDay,
    timeOfDay: isDay
      ? hour < 12
        ? 'Morning'
        : hour < 16
          ? 'Afternoon'
          : 'Evening'
      : hour < 22
        ? 'Night'
        : 'Late Night',
    timeEmoji: isDay ? '☀️' : '🌙'
  }
}

// React Hook for live IST clock
export function useISTClock() {
  const [time, setTime] = React.useState(() => getISTDateTime())

  React.useEffect(() => {
    // Update every second
    const interval = setInterval(() => {
      setTime(getISTDateTime())
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  return time
}

// Alternative: useISTClock with state (for more control)
export function useISTClockWithControl() {
  const [time, setTime] = React.useState(() => getISTDateTime())
  const intervalRef = React.useRef(null)

  const start = () => {
    if (intervalRef.current) return
    intervalRef.current = setInterval(() => {
      setTime(getISTDateTime())
    }, 1000)
  }

  const stop = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }

  React.useEffect(() => {
    start()
    return () => stop()
  }, [])

  return { time, start, stop }
}
