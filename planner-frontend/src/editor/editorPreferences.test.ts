import { describe, expect, it } from 'vitest'
import { loadEditorSettings, saveEditorSettings } from './editorPreferences.js'

function createMemoryStorage(seed: Record<string, string> = {}) {
  const store = new Map(Object.entries(seed))

  return {
    getItem(key: string): string | null {
      return store.has(key) ? (store.get(key) as string) : null
    },
    setItem(key: string, value: string): void {
      store.set(key, value)
    },
    read(key: string): string | null {
      return store.has(key) ? (store.get(key) as string) : null
    },
  }
}

describe('editorPreferences', () => {
  it('loads persisted v1 settings', () => {
    const storage = createMemoryStorage({
      'okp.polygonEditor.settings.v1': JSON.stringify({
        gridSizeMm: 125,
        angleSnap: false,
        angleStepDeg: 30,
        magnetismEnabled: true,
      }),
    })

    const loaded = loadEditorSettings(storage)

    expect(loaded.gridSizeMm).toBe(125)
    expect(loaded.angleSnap).toBe(false)
    expect(loaded.angleStepDeg).toBe(30)
    expect(loaded.magnetismEnabled).toBe(true)
  })

  it('migrates legacy YAKDS v1 key into new OKP v1 key', () => {
    const storage = createMemoryStorage({
      'yakds.polygonEditor.settings.v1': JSON.stringify({
        gridSizeMm: 90,
        lengthSnapStepMm: 25,
      }),
    })

    const loaded = loadEditorSettings(storage)

    expect(loaded.gridSizeMm).toBe(90)
    expect(loaded.lengthSnapStepMm).toBe(25)
    expect(storage.read('okp.polygonEditor.settings.v1')).toBe(JSON.stringify(loaded))
  })

  it('migrates oldest legacy YAKDS key into new OKP v1 key', () => {
    const storage = createMemoryStorage({
      'yakds.polygonEditor.settings': JSON.stringify({
        gridSizeMm: 90,
        lengthSnapStepMm: 25,
      }),
    })

    const loaded = loadEditorSettings(storage)

    expect(loaded.gridSizeMm).toBe(90)
    expect(loaded.lengthSnapStepMm).toBe(25)
    expect(storage.read('okp.polygonEditor.settings.v1')).toBe(JSON.stringify(loaded))
  })

  it('returns empty settings for malformed payloads', () => {
    const storage = createMemoryStorage({
      'okp.polygonEditor.settings.v1': '{bad-json}',
    })

    expect(loadEditorSettings(storage)).toEqual({})
  })

  it('writes normalized settings to v1 key', () => {
    const storage = createMemoryStorage()

    saveEditorSettings(
      {
        gridSizeMm: 100,
        magnetismToleranceMm: 120,
        lengthSnapStepMm: 50,
      },
      storage,
    )

    const raw = storage.read('okp.polygonEditor.settings.v1')
    expect(raw).not.toBeNull()
    expect(raw).toContain('"gridSizeMm":100')
    expect(raw).toContain('"lengthSnapStepMm":50')
  })
})
