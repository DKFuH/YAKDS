import { describe, expect, it } from 'vitest'
import { arcToLineSegments, fromDxfArcEntity, toDxfArcEntity } from './arcInterop.js'

describe('arcInterop', () => {
  it('converts DXF arc to internal arc and segmented walls', () => {
    const arc = fromDxfArcEntity({
      center_x_mm: 0,
      center_y_mm: 0,
      radius_mm: 1000,
      start_angle_deg: 0,
      end_angle_deg: 90,
    })

    const segments = arcToLineSegments(arc, 15)
    expect(segments.length).toBe(6)
    expect(segments[0]?.x0_mm).toBe(1000)
    expect(segments[segments.length - 1]?.y1_mm).toBe(1000)
  })

  it('maps clockwise arc wall to DXF-compatible CCW angles', () => {
    const entity = toDxfArcEntity({
      kind: 'arc',
      start: { x_mm: 1000, y_mm: 0 },
      end: { x_mm: 0, y_mm: 1000 },
      center: { x_mm: 0, y_mm: 0 },
      radius_mm: 1000,
      clockwise: true,
    })

    expect(entity.start_angle_deg).toBe(90)
    expect(entity.end_angle_deg).toBe(0)
  })
})
