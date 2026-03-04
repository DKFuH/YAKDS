import { describe, expect, it } from 'vitest'
import {
  arcLengthMm,
  nearestPointOnArc,
  offsetArc,
  pointOnArc,
  type ArcWallSegment,
} from './arcWallGeometry.js'

const quarterArc: ArcWallSegment = {
  id: 'arc-1',
  kind: 'arc',
  start: { x_mm: 1000, y_mm: 0 },
  end: { x_mm: 0, y_mm: 1000 },
  center: { x_mm: 0, y_mm: 0 },
  radius_mm: 1000,
  clockwise: false,
}

describe('arcWallGeometry', () => {
  it('computes arc length', () => {
    const length = arcLengthMm(quarterArc)
    expect(length).toBeCloseTo(Math.PI * 500, 3)
  })

  it('resolves points and nearest projection on arc', () => {
    const midpoint = pointOnArc(quarterArc, 0.5)
    expect(midpoint.x_mm).toBeCloseTo(707.1, 1)
    expect(midpoint.y_mm).toBeCloseTo(707.1, 1)

    const nearest = nearestPointOnArc(quarterArc, { x_mm: 800, y_mm: 700 })
    expect(nearest.t).toBeGreaterThan(0)
    expect(nearest.t).toBeLessThan(1)
  })

  it('offsets arc radius and endpoints', () => {
    const widened = offsetArc(quarterArc, 200)
    expect(widened.radius_mm).toBe(1200)
    expect(widened.start.x_mm).toBeCloseTo(1200, 3)
  })
})
