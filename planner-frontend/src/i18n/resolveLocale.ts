/**
 * Single source of truth for locale priority resolution.
 * Priority: okp_locale (localStorage) → tenantLocale → navigator.language → 'de'
 */

export const SUPPORTED_LOCALES = ['de', 'en'] as const
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number]

export function isSupportedLocale(code: string): code is SupportedLocale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(code)
}

export function resolveLocale(tenantLocale?: string): SupportedLocale {
  // 1. User localStorage preference
  try {
    const stored = localStorage.getItem('okp_locale')
    if (stored && isSupportedLocale(stored)) {
      return stored
    }
  } catch {
    // SSR or storage blocked – continue
  }

  // 2. Tenant preferred locale
  if (tenantLocale && isSupportedLocale(tenantLocale)) {
    return tenantLocale
  }

  // 3. Browser language (strip region code)
  try {
    const browserLang = navigator.language.slice(0, 2).toLowerCase()
    if (isSupportedLocale(browserLang)) {
      return browserLang
    }
  } catch {
    // Non-browser environment – continue
  }

  // 4. Fallback
  return 'de'
}
