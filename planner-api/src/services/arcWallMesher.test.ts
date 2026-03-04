import { describe, expect, it } from 'vitest'
import { tessellateArcWall } from './arcWallMesher.js'

describe('arcWallMesher', () => {
  it('tessellates arc wall footprint deterministically', () => {
    const result = tessellateArcWall({
      start: { x_mm: 1000, y_mm: 0 },
      end: { x_mm: 0, y_mm: 1000 },
      center: { x_mm: 0, y_mm: 0 },
      radius_mm: 1000,
      clockwise: false,
      thickness_mm: 100,
    }, { wall_height_mm: 2600, max_segment_angle_deg: 15 })

    expect(result.footprint.length).toBeGreaterThan(8)
    expect(result.triangles.length).toBe(result.footprint.length - 2)
  })
})
