import i18next from 'i18next'
import { initReactI18next } from 'react-i18next'
import { de } from './de.js'
import { en } from './en.js'
import { resolveLocale } from './resolveLocale.js'

const initialLocale = resolveLocale()

// Set lang attribute immediately so HTML reflects initial locale
try {
  document.documentElement.lang = initialLocale
} catch {
  // Non-browser environment
}

void i18next.use(initReactI18next).init({
  lng: initialLocale,
  fallbackLng: 'de',
  resources: {
    de: { translation: de },
    en: { translation: en },
  },
  interpolation: {
    escapeValue: false,
  },
  saveMissing: true,
  missingKeyHandler: (lngs, _ns, key) => {
    if (typeof console !== 'undefined') {
      console.warn(`[i18n] Missing translation key: "${key}" for lang: ${lngs.join(', ')}`)
    }
  },
})

export { i18next as i18n }
