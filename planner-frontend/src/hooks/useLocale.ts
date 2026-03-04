import { useTranslation } from 'react-i18next'
import { formatDate, formatCurrency, formatNumber } from '../i18n/formatters.js'

/**
 * React hook for i18n. Returns translation function and locale-bound format helpers.
 * Pure formatters are also exported from i18n/formatters.ts for non-React use.
 */
export function useLocale() {
  const { t, i18n } = useTranslation()
  const locale = i18n.language

  return {
    t,
    locale,
    formatDate: (d: Date) => formatDate(d, locale),
    formatNumber: (n: number) => formatNumber(n, locale),
    formatCurrency: (n: number, currencyCode = 'EUR') => formatCurrency(n, locale, currencyCode),
  }
}
