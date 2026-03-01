import { describe, expect, it } from 'vitest'

import type { Opening, Placement, WallSegment } from '../types.js'
import { validatePlacement } from './placementValidator.js'

function wall(length_mm = 4000): WallSegment {
  return { id: 'wall-1', length_mm }
}

function placement(overrides: Partial<Placement> = {}): Placement {
  return {
    id: 'placement-1',
    catalog_item_id: 'catalog-1',
    wall_id: 'wall-1',
    offset_mm: 500,
    width_mm: 800,
    depth_mm: 600,
    height_mm: 720,
    ...overrides,
  }
}

describe('validatePlacement', () => {
  it('accepts valid placements within wall bounds', () => {
    const result = validatePlacement(wall(), placement(), [], [])

    expect(result).toEqual({ valid: true, errors: [] })
  })

  it('rejects placements that exceed wall bounds', () => {
    const result = validatePlacement(wall(), placement({ offset_mm: 3500, width_mm: 700 }), [], [])

    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Placement exceeds wall length.')
  })

  it('rejects placements that overlap siblings on the same wall', () => {
    const existing = [placement({ id: 'placement-2', offset_mm: 1100, width_mm: 700 })]

    const result = validatePlacement(wall(), placement(), existing, [])

    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Placement overlaps with existing placement placement-2.')
  })

  it('rejects placements that overlap openings on the same wall', () => {
    const openings: Opening[] = [{ id: 'opening-1', wall_id: 'wall-1', offset_mm: 900, width_mm: 900 }]

    const result = validatePlacement(wall(), placement(), [], openings)

    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Placement overlaps with opening opening-1.')
  })
})
