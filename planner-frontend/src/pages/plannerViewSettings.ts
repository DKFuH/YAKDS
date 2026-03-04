export type PlannerViewMode = '2d' | 'split' | '3d'

export interface PlannerViewSettings {
  mode: PlannerViewMode
  split_ratio: number
  visitor_visible: boolean
  camera_height_mm: number
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>

function settingsKey(projectId: string): string {
  return `yakds:planner-view:${projectId}`
}

export function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function parsePlannerViewSettings(raw: string): PlannerViewSettings {
  const parsed = JSON.parse(raw) as Partial<PlannerViewSettings>
  const mode = parsed.mode === '2d' || parsed.mode === 'split' || parsed.mode === '3d'
    ? parsed.mode
    : '2d'

  return {
    mode,
    split_ratio: typeof parsed.split_ratio === 'number' ? clampNumber(parsed.split_ratio, 25, 75) : 58,
    visitor_visible: parsed.visitor_visible !== false,
    camera_height_mm: typeof parsed.camera_height_mm === 'number'
      ? clampNumber(Math.round(parsed.camera_height_mm), 900, 2400)
      : 1650,
  }
}

function resolveStorage(storage?: StorageLike): StorageLike | null {
  if (storage) {
    return storage
  }
  if (typeof window === 'undefined') {
    return null
  }
  return window.localStorage
}

export function loadPlannerViewSettings(projectId: string, storage?: StorageLike): PlannerViewSettings | null {
  const resolvedStorage = resolveStorage(storage)
  if (!resolvedStorage) {
    return null
  }

  try {
    const raw = resolvedStorage.getItem(settingsKey(projectId))
    if (!raw) {
      return null
    }
    return parsePlannerViewSettings(raw)
  } catch {
    return null
  }
}

export function savePlannerViewSettings(projectId: string, settings: PlannerViewSettings, storage?: StorageLike): void {
  const resolvedStorage = resolveStorage(storage)
  if (!resolvedStorage) {
    return
  }

  try {
    resolvedStorage.setItem(settingsKey(projectId), JSON.stringify(settings))
  } catch {
    // ignore persistence failures in browser privacy mode
  }
}
