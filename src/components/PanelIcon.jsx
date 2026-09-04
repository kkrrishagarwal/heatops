// One consistent SVG icon language for panel headings and buttons (lucide, stroke style)
// — replaces the emoji-as-icon look. Icons inherit the heat-reactive accent by default
// (falls back to amber outside the themed container); pass color="currentColor" inside
// buttons so they follow the button's own text colour. aria-hidden: the heading text
// carries the meaning, the icon is decoration.
import React from 'react'
import {
  Flame, Bot, Star, Siren, Clock, Share2, BookOpen, ClipboardList, BarChart3, TrendingUp,
  Wind, Users, Building2, Target, SlidersHorizontal, Leaf, Thermometer, Globe, Stethoscope,
  Snowflake, HeartHandshake, FileText, MessageCircle, Copy, Download, Gauge, Satellite,
  SunMoon, Zap, Palette, History, Droplets, Eye, Sunrise, Sunset, Cloud, Calendar, Activity, MapPin, CloudRain, Sun, Moon
} from 'lucide-react'

const ICONS = {
  flame: Flame, bot: Bot, star: Star, siren: Siren, clock: Clock, share: Share2,
  'book-open': BookOpen, 'clipboard-list': ClipboardList, 'bar-chart': BarChart3,
  'trending-up': TrendingUp, wind: Wind, users: Users, building: Building2, target: Target,
  sliders: SlidersHorizontal, leaf: Leaf, thermometer: Thermometer, globe: Globe,
  stethoscope: Stethoscope, snowflake: Snowflake, 'heart-handshake': HeartHandshake,
  'file-text': FileText, 'message-circle': MessageCircle, copy: Copy, download: Download,
  gauge: Gauge, satellite: Satellite, 'sun-moon': SunMoon, zap: Zap, palette: Palette,
  history: History, droplets: Droplets, eye: Eye, sunrise: Sunrise, sunset: Sunset,
  cloud: Cloud, calendar: Calendar, activity: Activity, 'map-pin': MapPin,
  'cloud-rain': CloudRain, sun: Sun, moon: Moon
}

export default function PanelIcon({ name, size = 13, color, style }) {
  const C = ICONS[name]
  if (!C) return null
  return (
    <C
      size={size}
      strokeWidth={2}
      aria-hidden="true"
      style={{
        display: 'inline-block', verticalAlign: '-2px', marginRight: 8, flexShrink: 0,
        color: color || 'var(--theme-accent, #d97706)', ...style
      }}
    />
  )
}
