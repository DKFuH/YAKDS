import { describe, expect, it } from 'vitest'
import {
  buildArcDimensionGeometry,
  resolveArcAngleDeg,
  resolveArcLengthLabel,
  resolveArcRadiusLabel,
} from './arcDimensionResolver.js'

describe('arcDimensionResolver', () => {
  it('builds readable labels for radius and arc length', () => {
    expect(resolveArcRadiusLabel(1249.8)).toBe('R 1250 mm')
    expect(resolveArcLengthLabel(3120.4)).toBe('Bogenlänge 3120 mm')
  })

  it('computes clockwise and counter-clockwise angles', () => {
    expect(resolveArcAngleDeg(0, Math.PI / 2, false)).toBeCloseTo(90, 3)
    expect(resolveArcAngleDeg(Math.PI / 2, 0, true)).toBeCloseTo(90, 3)
  })

  it('builds leader geometry and label point', () => {
    const geometry = buildArcDimensionGeometry({
      center: { x_mm: 0, y_mm: 0 },
      radius_mm: 1000,
      mid_angle_rad: Math.PI / 4,
    })

    expect(geometry.leader_points).toHaveLength(2)
    expect(geometry.label_point.x_mm).toBeGreaterThan(geometry.leader_points[0]!.x_mm)
  })
})
