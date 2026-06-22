// i18n setup — manual language toggle only. Deliberately NOT using
// i18next-browser-languagedetector: we don't auto-switch based on browser locale,
// IP geolocation, or selected state/city. Default is always English; the user's last
// manual choice is remembered in localStorage purely so it persists across reloads.
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import en from './locales/en.json'
import hi from './locales/hi.json'
import bn from './locales/bn.json'
import mr from './locales/mr.json'
import te from './locales/te.json'
import ta from './locales/ta.json'
import gu from './locales/gu.json'
import ur from './locales/ur.json'
import kn from './locales/kn.json'
import or_ from './locales/or.json'
import pa from './locales/pa.json'

// Language names only (no flags) — many of these languages are spoken across
// multiple states, so a single national flag per language would be misleading.
export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिंदी (Hindi)' },
  { code: 'bn', label: 'বাংলা (Bengali)' },
  { code: 'mr', label: 'मराठी (Marathi)' },
  { code: 'te', label: 'తెలుగు (Telugu)' },
  { code: 'ta', label: 'தமிழ் (Tamil)' },
  { code: 'gu', label: 'ગુજરાતી (Gujarati)' },
  { code: 'ur', label: 'اردو (Urdu)' },
  { code: 'kn', label: 'ಕನ್ನಡ (Kannada)' },
  { code: 'or', label: 'ଓଡ଼ିଆ (Odia)' },
  { code: 'pa', label: 'ਪੰਜਾਬੀ (Punjabi)' }
]

const STORAGE_KEY = 'heatops_language'
const savedLanguage = (() => {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    return SUPPORTED_LANGUAGES.some(l => l.code === saved) ? saved : 'en'
  } catch {
    return 'en'
  }
})()

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    hi: { translation: hi },
    bn: { translation: bn },
    mr: { translation: mr },
    te: { translation: te },
    ta: { translation: ta },
    gu: { translation: gu },
    ur: { translation: ur },
    kn: { translation: kn },
    or: { translation: or_ },
    pa: { translation: pa }
  },
  lng: savedLanguage,
  fallbackLng: 'en',
  interpolation: { escapeValue: false }
})

export function changeLanguage(code) {
  i18n.changeLanguage(code)
  try { window.localStorage.setItem(STORAGE_KEY, code) } catch {}
}

export default i18n
