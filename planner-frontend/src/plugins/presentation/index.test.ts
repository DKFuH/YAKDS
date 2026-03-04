import { describe, expect, it } from 'vitest'
import { RENDER_PRESET_OPTIONS } from './index.js'

describe('presentation presets', () => {
  it('defines exactly three preset options', () => {
    expect(RENDER_PRESET_OPTIONS.map((item) => item.value)).toEqual(['draft', 'balanced', 'best'])
  })

  it('contains customer-facing labels for each preset', () => {
    const labels = RENDER_PRESET_OPTIONS.map((item) => item.label)
    expect(labels).toContain('Schnell')
    expect(labels).toContain('Ausgewogen')
    expect(labels).toContain('Beste')
  })

  it('provides a hint text for every preset', () => {
    for (const option of RENDER_PRESET_OPTIONS) {
      expect(option.hint.trim().length).toBeGreaterThan(0)
    }
  })
})
