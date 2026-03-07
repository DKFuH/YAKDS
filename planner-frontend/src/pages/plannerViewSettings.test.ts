import { describe, expect, it } from 'vitest'
import {
  clampNumber,
  loadPlannerViewSettings,
  savePlannerViewSettings,
  type PlannerViewSettings,
} from './plannerViewSettings.js'

class MemoryStorage {
  private readonly map = new Map<string, string>()

  getItem(key: string): string | null {
    return this.map.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.map.set(key, value)
  }
}

describe('plannerViewSettings', () => {
  it('clampNumber returns min when below range', () => {
    expect(clampNumber(10, 25, 75)).toBe(25)
  })

  it('clampNumber returns max when above range', () => {
    expect(clampNumber(90, 25, 75)).toBe(75)
  })

  it('clampNumber keeps in-range values unchanged', () => {
    expect(clampNumber(52, 25, 75)).toBe(52)
  })

  it('returns null when no setting exists', () => {
    const storage = new MemoryStorage()
    expect(loadPlannerViewSettings('p-1', storage)).toBeNull()
  })

  it('loads a full valid setting payload', () => {
    const storage = new MemoryStorage()
    storage.setItem('okp:planner-view:p-2', JSON.stringify({
      mode: 'split',
      split_ratio: 61,
      visitor_visible: false,
      camera_height_mm: 1740,
    }))

    expect(loadPlannerViewSettings('p-2', storage)).toEqual<PlannerViewSettings>({
      mode: 'split',
      split_ratio: 61,
      visitor_visible: false,
      camera_height_mm: 1740,
      navigation_profile: 'cad',
      invert_y_axis: false,
      middle_mouse_pan: true,
      touchpad_mode: 'cad',
      zoom_direction: 'natural',
    })
  })

  it('applies defaults for missing fields', () => {
    const storage = new MemoryStorage()
    storage.setItem('okp:planner-view:p-3', JSON.stringify({ mode: '3d' }))

    expect(loadPlannerViewSettings('p-3', storage)).toEqual<PlannerViewSettings>({
      mode: '3d',
      split_ratio: 58,
      visitor_visible: true,
      camera_height_mm: 1650,
      navigation_profile: 'cad',
      invert_y_axis: false,
      middle_mouse_pan: true,
      touchpad_mode: 'cad',
      zoom_direction: 'natural',
    })
  })

  it('keeps elevation mode when persisted', () => {
    const storage = new MemoryStorage()
    storage.setItem('okp:planner-view:p-7', JSON.stringify({ mode: 'elevation' }))

    expect(loadPlannerViewSettings('p-7', storage)?.mode).toBe('elevation')
  })

  it('keeps section mode when persisted', () => {
    const storage = new MemoryStorage()
    storage.setItem('okp:planner-view:p-8', JSON.stringify({ mode: 'section' }))

    expect(loadPlannerViewSettings('p-8', storage)?.mode).toBe('section')
  })

  it('normalizes invalid mode to 2d', () => {
    const storage = new MemoryStorage()
    storage.setItem('okp:planner-view:p-4', JSON.stringify({ mode: 'viewer3d' }))

    expect(loadPlannerViewSettings('p-4', storage)?.mode).toBe('2d')
  })

  it('clamps split ratio and camera height to safe bounds', () => {
    const storage = new MemoryStorage()
    storage.setItem('okp:planner-view:p-5', JSON.stringify({
      mode: 'split',
      split_ratio: 1,
      camera_height_mm: 4000,
    }))

    expect(loadPlannerViewSettings('p-5', storage)).toEqual<PlannerViewSettings>({
      mode: 'split',
      split_ratio: 25,
      visitor_visible: true,
      camera_height_mm: 2400,
      navigation_profile: 'cad',
      invert_y_axis: false,
      middle_mouse_pan: true,
      touchpad_mode: 'cad',
      zoom_direction: 'natural',
    })
  })

  it('returns null for malformed JSON', () => {
    const storage = new MemoryStorage()
    storage.setItem('okp:planner-view:p-6', '{ broken json')

    expect(loadPlannerViewSettings('p-6', storage)).toBeNull()
  })

  it('writes settings with the project-scoped storage key', () => {
    const storage = new MemoryStorage()
    const settings: PlannerViewSettings = {
      mode: 'split',
      split_ratio: 54,
      visitor_visible: true,
      camera_height_mm: 1700,
      navigation_profile: 'trackpad',
      invert_y_axis: true,
      middle_mouse_pan: false,
      touchpad_mode: 'trackpad',
      zoom_direction: 'inverted',
    }

    savePlannerViewSettings('abc', settings, storage)

    expect(storage.getItem('okp:planner-view:abc')).toBe(JSON.stringify(settings))
  })
})
