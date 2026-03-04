export type NavigationProfile = 'cad' | 'presentation' | 'trackpad'

export type TouchpadMode = 'cad' | 'trackpad'

export type ZoomDirection = 'natural' | 'inverted'

export interface NavigationSettings {
  navigation_profile: NavigationProfile
  invert_y_axis: boolean
  middle_mouse_pan: boolean
  touchpad_mode: TouchpadMode
  zoom_direction: ZoomDirection
}

const PROFILE_DEFAULTS: Record<NavigationProfile, NavigationSettings> = {
  cad: {
    navigation_profile: 'cad',
    invert_y_axis: false,
    middle_mouse_pan: true,
    touchpad_mode: 'cad',
    zoom_direction: 'natural',
  },
  presentation: {
    navigation_profile: 'presentation',
    invert_y_axis: false,
    middle_mouse_pan: true,
    touchpad_mode: 'cad',
    zoom_direction: 'natural',
  },
  trackpad: {
    navigation_profile: 'trackpad',
    invert_y_axis: false,
    middle_mouse_pan: false,
    touchpad_mode: 'trackpad',
    zoom_direction: 'inverted',
  },
}

function isNavigationProfile(value: unknown): value is NavigationProfile {
  return value === 'cad' || value === 'presentation' || value === 'trackpad'
}

function isTouchpadMode(value: unknown): value is TouchpadMode {
  return value === 'cad' || value === 'trackpad'
}

function isZoomDirection(value: unknown): value is ZoomDirection {
  return value === 'natural' || value === 'inverted'
}

export function defaultsForNavigationProfile(profile: NavigationProfile): NavigationSettings {
  return { ...PROFILE_DEFAULTS[profile] }
}

export function resolveNavigationSettings(input: Partial<NavigationSettings> | null | undefined): NavigationSettings {
  const profile = isNavigationProfile(input?.navigation_profile) ? input.navigation_profile : 'cad'
  const defaults = PROFILE_DEFAULTS[profile]

  return {
    navigation_profile: profile,
    invert_y_axis: typeof input?.invert_y_axis === 'boolean' ? input.invert_y_axis : defaults.invert_y_axis,
    middle_mouse_pan: typeof input?.middle_mouse_pan === 'boolean' ? input.middle_mouse_pan : defaults.middle_mouse_pan,
    touchpad_mode: isTouchpadMode(input?.touchpad_mode) ? input.touchpad_mode : defaults.touchpad_mode,
    zoom_direction: isZoomDirection(input?.zoom_direction) ? input.zoom_direction : defaults.zoom_direction,
  }
}

export function profileZoomFactor(profile: NavigationProfile): number {
  if (profile === 'cad') return 1
  if (profile === 'presentation') return 0.9
  return 1.25
}
