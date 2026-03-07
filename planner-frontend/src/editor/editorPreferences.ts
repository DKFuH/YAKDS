type StorageLike = Pick<Storage, 'getItem' | 'setItem'>

export interface PersistedEditorSettings {
  gridSizeMm?: number
  angleSnap?: boolean
  angleStepDeg?: number
  magnetismEnabled?: boolean
  axisMagnetismEnabled?: boolean
  magnetismToleranceMm?: number
  lengthSnapStepMm?: number
  minEdgeLengthMm?: number
}

const SETTINGS_STORAGE_KEY_V1 = 'okp.polygonEditor.settings.v1'
const SETTINGS_STORAGE_KEY_LEGACY_YAKDS_V1 = 'yakds.polygonEditor.settings.v1'
const SETTINGS_STORAGE_KEY_LEGACY_YAKDS = 'yakds.polygonEditor.settings'

function resolveStorage(storage?: StorageLike): StorageLike | null {
  if (storage) {
    return storage
  }

  if (typeof window === 'undefined') {
    return null
  }

  return window.localStorage
}

function parseEditorSettings(raw: string): PersistedEditorSettings {
  const parsed = JSON.parse(raw) as PersistedEditorSettings
  const settings: PersistedEditorSettings = {}

  if (typeof parsed.gridSizeMm === 'number' && Number.isFinite(parsed.gridSizeMm) && parsed.gridSizeMm >= 0) settings.gridSizeMm = Math.round(parsed.gridSizeMm)
  if (typeof parsed.angleSnap === 'boolean') settings.angleSnap = parsed.angleSnap
  if (typeof parsed.angleStepDeg === 'number' && Number.isFinite(parsed.angleStepDeg) && parsed.angleStepDeg > 0) settings.angleStepDeg = Math.round(parsed.angleStepDeg)
  if (typeof parsed.magnetismEnabled === 'boolean') settings.magnetismEnabled = parsed.magnetismEnabled
  if (typeof parsed.axisMagnetismEnabled === 'boolean') settings.axisMagnetismEnabled = parsed.axisMagnetismEnabled
  if (typeof parsed.magnetismToleranceMm === 'number' && Number.isFinite(parsed.magnetismToleranceMm) && parsed.magnetismToleranceMm >= 0) settings.magnetismToleranceMm = Math.round(parsed.magnetismToleranceMm)
  if (typeof parsed.lengthSnapStepMm === 'number' && Number.isFinite(parsed.lengthSnapStepMm) && parsed.lengthSnapStepMm >= 0) settings.lengthSnapStepMm = Math.round(parsed.lengthSnapStepMm)
  if (typeof parsed.minEdgeLengthMm === 'number' && Number.isFinite(parsed.minEdgeLengthMm) && parsed.minEdgeLengthMm >= 0) settings.minEdgeLengthMm = Math.round(parsed.minEdgeLengthMm)

  return settings
}

export function loadEditorSettings(storage?: StorageLike): PersistedEditorSettings {
  const resolvedStorage = resolveStorage(storage)
  if (!resolvedStorage) {
    return {}
  }

  try {
    const v1Raw = resolvedStorage.getItem(SETTINGS_STORAGE_KEY_V1)
    if (v1Raw) {
      return parseEditorSettings(v1Raw)
    }

    const legacyRaw = resolvedStorage.getItem(SETTINGS_STORAGE_KEY_LEGACY_YAKDS_V1)
    if (legacyRaw) {
      const parsedLegacy = parseEditorSettings(legacyRaw)
      resolvedStorage.setItem(SETTINGS_STORAGE_KEY_V1, JSON.stringify(parsedLegacy))
      return parsedLegacy
    }

    const oldestLegacyRaw = resolvedStorage.getItem(SETTINGS_STORAGE_KEY_LEGACY_YAKDS)
    if (!oldestLegacyRaw) {
      return {}
    }

    const parsedOldest = parseEditorSettings(oldestLegacyRaw)
    resolvedStorage.setItem(SETTINGS_STORAGE_KEY_V1, JSON.stringify(parsedOldest))
    return parsedOldest
  } catch {
    return {}
  }
}

export function saveEditorSettings(settings: PersistedEditorSettings, storage?: StorageLike): void {
  const resolvedStorage = resolveStorage(storage)
  if (!resolvedStorage) {
    return
  }

  try {
    resolvedStorage.setItem(SETTINGS_STORAGE_KEY_V1, JSON.stringify(settings))
  } catch {
    // Ignore persistence failures (private mode / blocked storage).
  }
}
