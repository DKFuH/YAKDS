export type RenderEnvironmentPresetId = 'studio' | 'daylight' | 'interior'

export interface RenderEnvironmentPreset {
  id: RenderEnvironmentPresetId
  label: string
  description: string
}

export interface RenderEnvironmentSettings {
  preset_id: RenderEnvironmentPresetId
  intensity: number
  rotation_deg: number
  ground_tint: string
}

export const RENDER_ENVIRONMENT_PRESETS: RenderEnvironmentPreset[] = [
  {
    id: 'studio',
    label: 'Studio',
    description: 'Neutrales Studiolicht fuer Produktansichten',
  },
  {
    id: 'daylight',
    label: 'Daylight',
    description: 'Natuerlicher Himmel als Tageslicht-Fallback',
  },
  {
    id: 'interior',
    label: 'Interior',
    description: 'Warme Innenraumstimmung fuer Praesentationen',
  },
]

const PRESET_LOOKUP = new Set<RenderEnvironmentPresetId>(['studio', 'daylight', 'interior'])

const DEFAULT_GROUND_TINT: Record<RenderEnvironmentPresetId, string> = {
  studio: '#CBD5E1',
  daylight: '#9AB77C',
  interior: '#8E7967',
}

const PRESET_VISUAL: Record<RenderEnvironmentPresetId, { sky: string; horizon: string; ambient: number; directional: number }> = {
  studio: {
    sky: '#A8B9D0',
    horizon: '#E7EEF8',
    ambient: 0.3,
    directional: 0.34,
  },
  daylight: {
    sky: '#73B1FF',
    horizon: '#D7ECFF',
    ambient: 0.34,
    directional: 0.4,
  },
  interior: {
    sky: '#575265',
    horizon: '#A88C72',
    ambient: 0.28,
    directional: 0.3,
  },
}

export const DEFAULT_RENDER_ENVIRONMENT_SETTINGS: RenderEnvironmentSettings = {
  preset_id: 'daylight',
  intensity: 1,
  rotation_deg: 0,
  ground_tint: DEFAULT_GROUND_TINT.daylight,
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function parseHex(hex: string): [number, number, number] {
  const cleaned = hex.replace(/^#/, '')
  const intValue = Number.parseInt(cleaned, 16)
  const r = (intValue >> 16) & 255
  const g = (intValue >> 8) & 255
  const b = intValue & 255
  return [r, g, b]
}

function toHex(value: number): string {
  return Math.round(clamp(value, 0, 255)).toString(16).padStart(2, '0').toUpperCase()
}

function mixHexColor(a: string, b: string, ratio: number): string {
  const t = clamp(ratio, 0, 1)
  const [ar, ag, ab] = parseHex(a)
  const [br, bg, bb] = parseHex(b)
  const r = ar + (br - ar) * t
  const g = ag + (bg - ag) * t
  const bl = ab + (bb - ab) * t
  return `#${toHex(r)}${toHex(g)}${toHex(bl)}`
}

export function defaultGroundTintForPreset(presetId: RenderEnvironmentPresetId): string {
  return DEFAULT_GROUND_TINT[presetId]
}

export function normalizeGroundTint(value: unknown, fallbackPreset: RenderEnvironmentPresetId = DEFAULT_RENDER_ENVIRONMENT_SETTINGS.preset_id): string {
  if (typeof value !== 'string') {
    return DEFAULT_GROUND_TINT[fallbackPreset]
  }

  const cleaned = value.trim().replace(/^#/, '')
  if (!/^[0-9a-fA-F]{6}$/.test(cleaned)) {
    return DEFAULT_GROUND_TINT[fallbackPreset]
  }

  return `#${cleaned.toUpperCase()}`
}

export function normalizeEnvironmentRotation(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_RENDER_ENVIRONMENT_SETTINGS.rotation_deg
  }

  const wrapped = ((value % 360) + 360) % 360
  return Math.round(wrapped * 100) / 100
}

export function clampEnvironmentIntensity(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_RENDER_ENVIRONMENT_SETTINGS.intensity
  }

  return Math.round(clamp(value, 0.2, 2) * 100) / 100
}

export function normalizeRenderEnvironmentSettings(value: unknown): RenderEnvironmentSettings {
  const candidate = (value && typeof value === 'object' && !Array.isArray(value))
    ? (value as Record<string, unknown>)
    : null

  const presetId =
    typeof candidate?.preset_id === 'string' && PRESET_LOOKUP.has(candidate.preset_id as RenderEnvironmentPresetId)
      ? (candidate.preset_id as RenderEnvironmentPresetId)
      : DEFAULT_RENDER_ENVIRONMENT_SETTINGS.preset_id

  return {
    preset_id: presetId,
    intensity: clampEnvironmentIntensity(candidate?.intensity),
    rotation_deg: normalizeEnvironmentRotation(candidate?.rotation_deg),
    ground_tint: normalizeGroundTint(candidate?.ground_tint, presetId),
  }
}

export function applyRenderEnvironmentPreset(
  current: RenderEnvironmentSettings,
  presetId: RenderEnvironmentPresetId,
): RenderEnvironmentSettings {
  return {
    ...normalizeRenderEnvironmentSettings(current),
    preset_id: presetId,
    ground_tint: defaultGroundTintForPreset(presetId),
  }
}

export function resolveRenderEnvironmentVisual(settings: RenderEnvironmentSettings) {
  const normalized = normalizeRenderEnvironmentSettings(settings)
  const presetVisual = PRESET_VISUAL[normalized.preset_id]
  const intensityRatio = clamp((normalized.intensity - 0.2) / 1.8, 0, 1)

  return {
    sky_hex: mixHexColor('#1E293B', presetVisual.sky, intensityRatio),
    horizon_hex: mixHexColor('#334155', presetVisual.horizon, intensityRatio),
    ground_hex: normalizeGroundTint(normalized.ground_tint, normalized.preset_id),
    ambient_intensity: 0.1 + presetVisual.ambient * (0.45 + intensityRatio * 0.85),
    directional_intensity: 0.08 + presetVisual.directional * (0.4 + intensityRatio * 0.9),
    rotation_rad: (normalized.rotation_deg * Math.PI) / 180,
  }
}
