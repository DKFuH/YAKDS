import { describe, expect, it } from 'vitest'
import { nestCutlistParts, OversizedPartError, type NestingPart } from './nestingService.js'

function createPart(overrides: Partial<NestingPart> = {}): NestingPart {
  return {
    id: 'p-1',
    label: 'Teil 1',
    width_mm: 500,
    height_mm: 300,
    material_key: 'SPAN-19',
    quantity: 1,
    ...overrides,
  }
}

describe('nestCutlistParts', () => {
  it('places a single part on one sheet', () => {
    const result = nestCutlistParts(
      [createPart()],
      { sheet_width_mm: 2800, sheet_height_mm: 2070, kerf_mm: 4, allow_rotate: true },
    )

    expect(result.total_parts).toBe(1)
    expect(result.placed_parts).toBe(1)
    expect(result.sheets).toHaveLength(1)
    expect(result.sheets[0].placements[0]).toMatchObject({ x_mm: 0, y_mm: 0, rotated: false })
  })

  it('expands quantity into multiple placements', () => {
    const result = nestCutlistParts(
      [createPart({ quantity: 3 })],
      { sheet_width_mm: 2000, sheet_height_mm: 1000, kerf_mm: 0, allow_rotate: true },
    )

    expect(result.total_parts).toBe(3)
    expect(result.placed_parts).toBe(3)
  })

  it('separates materials into different sheet groups', () => {
    const result = nestCutlistParts(
      [
        createPart({ id: 'a', material_key: 'MDF', width_mm: 1900, height_mm: 900 }),
        createPart({ id: 'b', material_key: 'SPAN', width_mm: 1900, height_mm: 900 }),
      ],
      { sheet_width_mm: 2000, sheet_height_mm: 1000, kerf_mm: 4, allow_rotate: true },
    )

    expect(result.sheets).toHaveLength(2)
    expect(result.sheets.every((sheet) => sheet.placements).toString()).toBeTruthy()
  })

  it('sorts by largest area first within a material group', () => {
    const result = nestCutlistParts(
      [
        createPart({ id: 'small', width_mm: 400, height_mm: 300 }),
        createPart({ id: 'large', width_mm: 1000, height_mm: 800 }),
      ],
      { sheet_width_mm: 2000, sheet_height_mm: 1000, kerf_mm: 0, allow_rotate: true },
    )

    expect(result.sheets[0].placements[0].part_id).toBe('large')
  })

  it('uses rotation when enabled', () => {
    const result = nestCutlistParts(
      [createPart({ id: 'r', width_mm: 1200, height_mm: 800 })],
      { sheet_width_mm: 1000, sheet_height_mm: 1300, kerf_mm: 0, allow_rotate: true },
    )

    expect(result.sheets[0].placements[0]).toMatchObject({ width_mm: 800, height_mm: 1200, rotated: true })
  })

  it('does not rotate when disabled', () => {
    expect(() => nestCutlistParts(
      [createPart({ id: 'r', width_mm: 1200, height_mm: 800 })],
      { sheet_width_mm: 1000, sheet_height_mm: 1300, kerf_mm: 0, allow_rotate: false },
    )).toThrow(OversizedPartError)
  })

  it('respects kerf spacing between parts', () => {
    const result = nestCutlistParts(
      [
        createPart({ id: 'a', width_mm: 500, height_mm: 500 }),
        createPart({ id: 'b', width_mm: 500, height_mm: 500 }),
      ],
      { sheet_width_mm: 1200, sheet_height_mm: 600, kerf_mm: 20, allow_rotate: true },
    )

    const [first, second] = result.sheets[0].placements
    expect(second.x_mm - (first.x_mm + first.width_mm)).toBeGreaterThanOrEqual(20)
  })

  it('creates a new sheet when current sheet is full', () => {
    const result = nestCutlistParts(
      [
        createPart({ id: 'a', width_mm: 1000, height_mm: 1000 }),
        createPart({ id: 'b', width_mm: 1000, height_mm: 1000 }),
      ],
      { sheet_width_mm: 1000, sheet_height_mm: 1000, kerf_mm: 0, allow_rotate: true },
    )

    expect(result.sheets).toHaveLength(2)
  })

  it('throws a hard validation error when part exceeds sheet', () => {
    expect(() => nestCutlistParts(
      [createPart({ id: 'too-big', width_mm: 3000, height_mm: 500 })],
      { sheet_width_mm: 2800, sheet_height_mm: 2070, kerf_mm: 4, allow_rotate: true },
    )).toThrow(OversizedPartError)
  })

  it('calculates waste percentage', () => {
    const result = nestCutlistParts(
      [createPart({ width_mm: 1000, height_mm: 1000 })],
      { sheet_width_mm: 2000, sheet_height_mm: 1000, kerf_mm: 0, allow_rotate: true },
    )

    expect(result.waste_pct).toBe(50)
  })
})
