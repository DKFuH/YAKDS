import { resolveArcAngleDeg } from './arcDimensionResolver.js'

export interface ArcMeshOptions {
  max_segment_angle_deg?: number
  wall_height_mm: number
}

export function tessellateArcWall(
  wall: {
    start: { x_mm: number; y_mm: number }
    end: { x_mm: number; y_mm: number }
    center: { x_mm: number; y_mm: number }
    radius_mm: number
    clockwise: boolean
    thickness_mm: number
  },
  options?: ArcMeshOptions,
): {
  footprint: Array<{ x_mm: number; y_mm: number }>
  triangles: number[][]
} {
  const maxAngleDeg = options?.max_segment_angle_deg ?? 10
  const startAngle = Math.atan2(wall.start.y_mm - wall.center.y_mm, wall.start.x_mm - wall.center.x_mm)
  const endAngle = Math.atan2(wall.end.y_mm - wall.center.y_mm, wall.end.x_mm - wall.center.x_mm)
  const sweepDeg = resolveArcAngleDeg(startAngle, endAngle, wall.clockwise)
  const segmentCount = Math.max(3, Math.ceil(sweepDeg / Math.max(1, maxAngleDeg)))

  const halfThickness = wall.thickness_mm / 2
  const footprint: Array<{ x_mm: number; y_mm: number }> = []

  for (let i = 0; i <= segmentCount; i += 1) {
    const t = i / segmentCount
    const angle = wall.clockwise
      ? startAngle - ((sweepDeg * Math.PI) / 180) * t
      : startAngle + ((sweepDeg * Math.PI) / 180) * t

    const nx = Math.cos(angle)
    const ny = Math.sin(angle)

    footprint.push({
      x_mm: wall.center.x_mm + nx * (wall.radius_mm - halfThickness),
      y_mm: wall.center.y_mm + ny * (wall.radius_mm - halfThickness),
    })
  }

  for (let i = segmentCount; i >= 0; i -= 1) {
    const t = i / segmentCount
    const angle = wall.clockwise
      ? startAngle - ((sweepDeg * Math.PI) / 180) * t
      : startAngle + ((sweepDeg * Math.PI) / 180) * t

    const nx = Math.cos(angle)
    const ny = Math.sin(angle)

    footprint.push({
      x_mm: wall.center.x_mm + nx * (wall.radius_mm + halfThickness),
      y_mm: wall.center.y_mm + ny * (wall.radius_mm + halfThickness),
    })
  }

  const triangles: number[][] = []
  for (let i = 1; i < footprint.length - 1; i += 1) {
    triangles.push([0, i, i + 1])
  }

  return {
    footprint,
    triangles,
  }
}
