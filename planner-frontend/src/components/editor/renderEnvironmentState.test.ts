import { describe, expect, it } from 'vitest'
import {
  applyRenderEnvironmentPreset,
  clampEnvironmentIntensity,
  DEFAULT_RENDER_ENVIRONMENT_SETTINGS,
  normalizeEnvironmentRotation,
  normalizeGroundTint,
  normalizeRenderEnvironmentSettings,
  resolveRenderEnvironmentVisual,
} from './renderEnvironmentState.js'

describe('renderEnvironmentState', () => {
  it('returns defaults when settings are missing', () => {
    expect(normalizeRenderEnvironmentSettings(null)).toEqual(DEFAULT_RENDER_ENVIRONMENT_SETTINGS)
  })

  it('clamps intensity to supported range', () => {
    expect(clampEnvironmentIntensity(0.01)).toBe(0.2)
    expect(clampEnvironmentIntensity(1.25)).toBe(1.25)
    expect(clampEnvironmentIntensity(9)).toBe(2)
  })

  it('normalizes rotation into 0..360 degrees', () => {
    expect(normalizeEnvironmentRotation(370)).toBe(10)
    expect(normalizeEnvironmentRotation(-45)).toBe(315)
    expect(normalizeEnvironmentRotation(0)).toBe(0)
  })

  it('normalizes ground tint and falls back by preset', () => {
    expect(normalizeGroundTint('ccddee', 'studio')).toBe('#CCDDEE')
    expect(normalizeGroundTint('#invalid', 'interior')).toBe('#8E7967')
  })

  it('falls back to daylight preset on invalid preset ids', () => {
    const normalized = normalizeRenderEnvironmentSettings({
      preset_id: 'custom',
      intensity: 0.8,
      rotation_deg: 22,
      ground_tint: '#445566',
    })

    expect(normalized.preset_id).toBe('daylight')
  })

  it('applies preset with default ground tint', () => {
    const next = applyRenderEnvironmentPreset(
      {
        preset_id: 'daylight',
        intensity: 1.2,
        rotation_deg: 15,
        ground_tint: '#99CCAA',
      },
      'studio',
    )

    expect(next.preset_id).toBe('studio')
    expect(next.ground_tint).toBe('#CBD5E1')
    expect(next.intensity).toBe(1.2)
  })

  it('builds visual payload with valid colors and intensities', () => {
    const visual = resolveRenderEnvironmentVisual({
      preset_id: 'interior',
      intensity: 1.4,
      rotation_deg: 180,
      ground_tint: '#7f6655',
    })

    expect(visual.sky_hex).toMatch(/^#[0-9A-F]{6}$/)
    expect(visual.horizon_hex).toMatch(/^#[0-9A-F]{6}$/)
    expect(visual.ground_hex).toBe('#7F6655')
    expect(visual.ambient_intensity).toBeGreaterThan(0)
    expect(visual.directional_intensity).toBeGreaterThan(0)
    expect(visual.rotation_rad).toBeCloseTo(Math.PI)
  })
})
