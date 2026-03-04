/**
 * Pure, framework-free locale-aware formatters.
 * Import directly in non-React code or tests.
 * React components use useLocale() which wraps these.
 */

export function formatDate(d: Date, locale: string): string {
  return d.toLocaleDateString(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

export function formatNumber(n: number, locale: string): string {
  return new Intl.NumberFormat(locale).format(n)
}

export function formatCurrency(n: number, locale: string, currencyCode = 'EUR'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)
}
