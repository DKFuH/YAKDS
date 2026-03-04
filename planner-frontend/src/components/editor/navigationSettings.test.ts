import { describe, expect, it } from 'vitest'
import {
  defaultsForNavigationProfile,
  profileZoomFactor,
  resolveNavigationSettings,
} from './navigationSettings.js'

describe('navigationSettings', () => {
  it('returns cad defaults when no settings are provided', () => {
    expect(resolveNavigationSettings(null)).toEqual({
      navigation_profile: 'cad',
      invert_y_axis: false,
      middle_mouse_pan: true,
      touchpad_mode: 'cad',
      zoom_direction: 'natural',
    })
  })

  it('uses profile defaults for trackpad profile', () => {
    expect(defaultsForNavigationProfile('trackpad')).toEqual({
      navigation_profile: 'trackpad',
      invert_y_axis: false,
      middle_mouse_pan: false,
      touchpad_mode: 'trackpad',
      zoom_direction: 'inverted',
    })
  })

  it('keeps explicit overrides when profile is set', () => {
    expect(resolveNavigationSettings({
      navigation_profile: 'presentation',
      invert_y_axis: true,
      middle_mouse_pan: false,
      touchpad_mode: 'trackpad',
      zoom_direction: 'inverted',
    })).toEqual({
      navigation_profile: 'presentation',
      invert_y_axis: true,
      middle_mouse_pan: false,
      touchpad_mode: 'trackpad',
      zoom_direction: 'inverted',
    })
  })

  it('maps zoom factors by profile', () => {
    expect(profileZoomFactor('cad')).toBe(1)
    expect(profileZoomFactor('presentation')).toBe(0.9)
    expect(profileZoomFactor('trackpad')).toBe(1.25)
  })
})
