import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SUPPORTED_LOCALES, isSupportedLocale, resolveLocale } from '../../planner-frontend/src/i18n/resolveLocale.js'

describe('isSupportedLocale', () => {
  it('returns true for supported locales', () => {
    expect(isSupportedLocale('de')).toBe(true)
    expect(isSupportedLocale('en')).toBe(true)
  })

  it('returns false for unsupported locales', () => {
    expect(isSupportedLocale('fr')).toBe(false)
    expect(isSupportedLocale('zh')).toBe(false)
    expect(isSupportedLocale('')).toBe(false)
  })
})

describe('resolveLocale', () => {
  beforeEach(() => {
    // Force unsupported browser locale so fallback assertions remain deterministic.
    vi.stubGlobal('navigator', { language: 'ja' })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('falls back to de when no inputs are provided', () => {
    expect(resolveLocale()).toBe('de')
  })

  it('uses tenant locale when it is supported', () => {
    expect(resolveLocale('en')).toBe('en')
  })

  it('ignores unsupported tenant locale and falls back to de', () => {
    expect(resolveLocale('fr')).toBe('de')
    expect(resolveLocale('zh')).toBe('de')
  })

  it('SUPPORTED_LOCALES contains de and en but not fr or nl', () => {
    expect(SUPPORTED_LOCALES).toContain('de')
    expect(SUPPORTED_LOCALES).toContain('en')
    expect((SUPPORTED_LOCALES as readonly string[]).includes('fr')).toBe(false)
    expect((SUPPORTED_LOCALES as readonly string[]).includes('nl')).toBe(false)
  })
})
