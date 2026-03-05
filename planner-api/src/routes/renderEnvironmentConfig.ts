export type RenderEnvironmentPresetId = 'studio' | 'daylight' | 'interior'

export type RenderEnvironmentPreset = {
  id: RenderEnvironmentPresetId
  label: string
  description: string
}

export type RenderEnvironmentSettings = {
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

const PRESET_IDS = new Set<RenderEnvironmentPresetId>(['studio', 'daylight', 'interior'])

const DEFAULT_GROUND_TINT: Record<RenderEnvironmentPresetId, string> = {
  studio: '#CBD5E1',
  daylight: '#9AB77C',
  interior: '#8E7967',
}

export const DEFAULT_RENDER_ENVIRONMENT_SETTINGS: RenderEnvironmentSettings = {
  preset_id: 'daylight',
  intensity: 1,
  rotation_deg: 0,
  ground_tint: DEFAULT_GROUND_TINT.daylight,
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  return value as Record<string, unknown>
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function normalizeRotation(value: number): number {
  const wrapped = ((value % 360) + 360) % 360
  return Math.round(wrapped * 100) / 100
}

function normalizeGroundTint(value: unknown, presetId: RenderEnvironmentPresetId): string {
  if (typeof value !== 'string') {
    return DEFAULT_GROUND_TINT[presetId]
  }

  const cleaned = value.trim().replace(/^#/, '')
  if (!/^[0-9a-fA-F]{6}$/.test(cleaned)) {
    return DEFAULT_GROUND_TINT[presetId]
  }

  return `#${cleaned.toUpperCase()}`
}

export function normalizeRenderEnvironmentSettings(value: unknown): RenderEnvironmentSettings {
  const candidate = asRecord(value)

  const presetId =
    typeof candidate?.preset_id === 'string' && PRESET_IDS.has(candidate.preset_id as RenderEnvironmentPresetId)
      ? (candidate.preset_id as RenderEnvironmentPresetId)
      : DEFAULT_RENDER_ENVIRONMENT_SETTINGS.preset_id

  const intensity =
    typeof candidate?.intensity === 'number' && Number.isFinite(candidate.intensity)
      ? clamp(candidate.intensity, 0.2, 2)
      : DEFAULT_RENDER_ENVIRONMENT_SETTINGS.intensity

  const rotationDeg =
    typeof candidate?.rotation_deg === 'number' && Number.isFinite(candidate.rotation_deg)
      ? normalizeRotation(candidate.rotation_deg)
      : DEFAULT_RENDER_ENVIRONMENT_SETTINGS.rotation_deg

  return {
    preset_id: presetId,
    intensity,
    rotation_deg: rotationDeg,
    ground_tint: normalizeGroundTint(candidate?.ground_tint, presetId),
  }
}

export function extractRenderEnvironmentFromConfig(configJson: unknown): RenderEnvironmentSettings {
  const config = asRecord(configJson)
  return normalizeRenderEnvironmentSettings(config?.render_environment)
}

export function mergeConfigWithRenderEnvironment(
  configJson: unknown,
  settings: RenderEnvironmentSettings,
): Record<string, unknown> {
  const current = asRecord(configJson) ?? {}
  return {
    ...current,
    render_environment: settings,
  }
}
