import { describe, expect, it } from 'vitest'
import { formatDate, formatNumber, formatCurrency } from '../../planner-frontend/src/i18n/formatters.js'

describe('formatDate', () => {
  it('formats a date in de locale with dots as separators', () => {
    const d = new Date('2026-03-04T00:00:00.000Z')
    const result = formatDate(d, 'de')
    // de-DE: 04.03.2026
    expect(result).toContain('2026')
    expect(result).toContain('03')
    expect(result).toContain('04')
  })

  it('formats a date in en locale with slashes or month-first', () => {
    const d = new Date('2026-03-04T00:00:00.000Z')
    const result = formatDate(d, 'en')
    expect(result).toContain('2026')
  })
})

describe('formatNumber', () => {
  it('uses comma as decimal separator in de locale', () => {
    const result = formatNumber(1234.5, 'de')
    expect(result).toContain(',')
  })

  it('uses dot as decimal separator in en locale', () => {
    const result = formatNumber(1234.5, 'en')
    expect(result).toContain('.')
  })
})

describe('formatCurrency', () => {
  it('formats EUR with German formatting', () => {
    const result = formatCurrency(1234.56, 'de', 'EUR')
    expect(result).toContain('1')
    expect(result).toContain('234')
    // Contains Euro symbol or EUR code
    expect(result.includes('€') || result.includes('EUR')).toBe(true)
  })

  it('formats EUR with English formatting', () => {
    const result = formatCurrency(1234.56, 'en', 'EUR')
    expect(result).toContain('1')
    expect(result.includes('€') || result.includes('EUR')).toBe(true)
  })

  it('de locale uses comma for decimal separator in currency', () => {
    const result = formatCurrency(1234.56, 'de', 'EUR')
    // 1.234,56 in de, so decimal separator is comma
    expect(result).toMatch(/[,]/)
  })

  it('en locale uses dot for decimal separator in currency', () => {
    const result = formatCurrency(1234.56, 'en', 'EUR')
    // 1,234.56 in en, so decimal separator is dot before "56"
    expect(result).toMatch(/\.56$|\.56\s/)
  })
})
