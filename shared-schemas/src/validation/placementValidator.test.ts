import { describe, expect, it } from 'vitest'

import type { Opening, Placement, WallSegment } from '../types.js'
import { validatePlacement } from './placementValidator.js'

function wall(length_mm = 4000, thickness_mm?: number): WallSegment {
  return { id: 'wall-1', length_mm, ...(thickness_mm !== undefined && { thickness_mm }) }
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

  it('allows a base cabinet placed under a window when height is below sill', () => {
    const openings: Opening[] = [
      {
        id: 'window-1',
        wall_id: 'wall-1',
        type: 'window',
        offset_mm: 500,
        width_mm: 800,
        sill_height_mm: 900,
      },
    ]

    const result = validatePlacement(wall(), placement({ height_mm: 720 }), [], openings)

    expect(result).toEqual({ valid: true, errors: [] })
  })

  it('rejects a tall cabinet that overlaps a window above sill height', () => {
    const openings: Opening[] = [
      {
        id: 'window-1',
        wall_id: 'wall-1',
        type: 'window',
        offset_mm: 500,
        width_mm: 800,
        sill_height_mm: 900,
      },
    ]

    const result = validatePlacement(wall(), placement({ height_mm: 1800 }), [], openings)

    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Placement overlaps with opening window-1.')
  })

  it('rejects a cabinet under a window when depth exceeds window recess', () => {
    const openings: Opening[] = [
      {
        id: 'window-1',
        wall_id: 'wall-1',
        type: 'window',
        offset_mm: 500,
        width_mm: 800,
        sill_height_mm: 900,
        recess_mm: 200,
      },
    ]

    const result = validatePlacement(wall(), placement({ height_mm: 720, depth_mm: 600 }), [], openings)

    expect(result.valid).toBe(false)
    expect(result.errors[0]).toContain('window reveal depth of 200 mm')
  })

  it('accepts a cabinet under a window when depth fits within window recess', () => {
    const openings: Opening[] = [
      {
        id: 'window-1',
        wall_id: 'wall-1',
        type: 'window',
        offset_mm: 500,
        width_mm: 800,
        sill_height_mm: 900,
        recess_mm: 650,
      },
    ]

    const result = validatePlacement(wall(), placement({ height_mm: 720, depth_mm: 600 }), [], openings)

    expect(result).toEqual({ valid: true, errors: [] })
  })
})
