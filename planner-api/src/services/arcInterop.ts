import { resolveArcAngleDeg } from './arcDimensionResolver.js'

export interface InteropLineWallSegment {
  id?: string
  x0_mm: number
  y0_mm: number
  x1_mm: number
  y1_mm: number
}

export interface InteropArcWallSegment {
  id?: string
  kind?: 'arc'
  start: { x_mm: number; y_mm: number }
  end: { x_mm: number; y_mm: number }
  center: { x_mm: number; y_mm: number }
  radius_mm: number
  clockwise: boolean
  thickness_mm?: number
}

export type InteropWallSegment = InteropLineWallSegment | InteropArcWallSegment

export interface DxfArcEntity {
  center_x_mm: number
  center_y_mm: number
  radius_mm: number
  start_angle_deg: number
  end_angle_deg: number
}

function normalizeDeg(angle: number): number {
  let next = angle % 360
  if (next < 0) {
    next += 360
  }
  return next
}

function degToRad(angleDeg: number): number {
  return (angleDeg * Math.PI) / 180
}

function radToDeg(angleRad: number): number {
  return (angleRad * 180) / Math.PI
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

export function isArcWallSegment(wall: unknown): wall is InteropArcWallSegment {
  if (!wall || typeof wall !== 'object') {
    return false
  }

  const candidate = wall as Record<string, unknown>
  const start = candidate.start as Record<string, unknown> | undefined
  const end = candidate.end as Record<string, unknown> | undefined
  const center = candidate.center as Record<string, unknown> | undefined

  return Boolean(
    start &&
      end &&
      center &&
      isFiniteNumber(start.x_mm) &&
      isFiniteNumber(start.y_mm) &&
      isFiniteNumber(end.x_mm) &&
      isFiniteNumber(end.y_mm) &&
      isFiniteNumber(center.x_mm) &&
      isFiniteNumber(center.y_mm) &&
      isFiniteNumber(candidate.radius_mm) &&
      typeof candidate.clockwise === 'boolean',
  )
}

export function isLineWallSegment(wall: unknown): wall is InteropLineWallSegment {
  if (!wall || typeof wall !== 'object') {
    return false
  }

  const candidate = wall as Record<string, unknown>
  return (
    isFiniteNumber(candidate.x0_mm) &&
    isFiniteNumber(candidate.y0_mm) &&
    isFiniteNumber(candidate.x1_mm) &&
    isFiniteNumber(candidate.y1_mm)
  )
}

export function arcToLineSegments(
  wall: InteropArcWallSegment,
  maxSegmentAngleDeg = 10,
): InteropLineWallSegment[] {
  const startAngle = Math.atan2(wall.start.y_mm - wall.center.y_mm, wall.start.x_mm - wall.center.x_mm)
  const endAngle = Math.atan2(wall.end.y_mm - wall.center.y_mm, wall.end.x_mm - wall.center.x_mm)
  const sweepDeg = resolveArcAngleDeg(startAngle, endAngle, wall.clockwise)

  const segmentCount = Math.max(1, Math.ceil(sweepDeg / Math.max(1, maxSegmentAngleDeg)))
  const lineSegments: InteropLineWallSegment[] = []

  for (let index = 0; index < segmentCount; index += 1) {
    const t0 = index / segmentCount
    const t1 = (index + 1) / segmentCount

    const angle0 = wall.clockwise
      ? startAngle - ((sweepDeg * Math.PI) / 180) * t0
      : startAngle + ((sweepDeg * Math.PI) / 180) * t0

    const angle1 = wall.clockwise
      ? startAngle - ((sweepDeg * Math.PI) / 180) * t1
      : startAngle + ((sweepDeg * Math.PI) / 180) * t1

    lineSegments.push({
      x0_mm: Math.round(wall.center.x_mm + Math.cos(angle0) * wall.radius_mm),
      y0_mm: Math.round(wall.center.y_mm + Math.sin(angle0) * wall.radius_mm),
      x1_mm: Math.round(wall.center.x_mm + Math.cos(angle1) * wall.radius_mm),
      y1_mm: Math.round(wall.center.y_mm + Math.sin(angle1) * wall.radius_mm),
    })
  }

  return lineSegments
}

export function flattenWallsToLineSegments(
  walls: InteropWallSegment[],
  maxSegmentAngleDeg = 10,
): InteropLineWallSegment[] {
  const segments: InteropLineWallSegment[] = []

  for (const wall of walls) {
    if (isArcWallSegment(wall)) {
      segments.push(...arcToLineSegments(wall, maxSegmentAngleDeg))
      continue
    }

    if (isLineWallSegment(wall)) {
      segments.push({
        x0_mm: Math.round(wall.x0_mm),
        y0_mm: Math.round(wall.y0_mm),
        x1_mm: Math.round(wall.x1_mm),
        y1_mm: Math.round(wall.y1_mm),
      })
    }
  }

  return segments
}

export function toDxfArcEntity(wall: InteropArcWallSegment): DxfArcEntity {
  const startAngle = normalizeDeg(radToDeg(Math.atan2(wall.start.y_mm - wall.center.y_mm, wall.start.x_mm - wall.center.x_mm)))
  const endAngle = normalizeDeg(radToDeg(Math.atan2(wall.end.y_mm - wall.center.y_mm, wall.end.x_mm - wall.center.x_mm)))

  if (wall.clockwise) {
    return {
      center_x_mm: wall.center.x_mm,
      center_y_mm: wall.center.y_mm,
      radius_mm: wall.radius_mm,
      start_angle_deg: endAngle,
      end_angle_deg: startAngle,
    }
  }

  return {
    center_x_mm: wall.center.x_mm,
    center_y_mm: wall.center.y_mm,
    radius_mm: wall.radius_mm,
    start_angle_deg: startAngle,
    end_angle_deg: endAngle,
  }
}

export function fromDxfArcEntity(entity: DxfArcEntity): InteropArcWallSegment {
  const startAngle = normalizeDeg(entity.start_angle_deg)
  const endAngleRaw = normalizeDeg(entity.end_angle_deg)
  const endAngle = endAngleRaw <= startAngle ? endAngleRaw + 360 : endAngleRaw

  const startRad = degToRad(startAngle)
  const endRad = degToRad(endAngle)

  return {
    kind: 'arc',
    start: {
      x_mm: Math.round(entity.center_x_mm + Math.cos(startRad) * entity.radius_mm),
      y_mm: Math.round(entity.center_y_mm + Math.sin(startRad) * entity.radius_mm),
    },
    end: {
      x_mm: Math.round(entity.center_x_mm + Math.cos(endRad) * entity.radius_mm),
      y_mm: Math.round(entity.center_y_mm + Math.sin(endRad) * entity.radius_mm),
    },
    center: {
      x_mm: Math.round(entity.center_x_mm),
      y_mm: Math.round(entity.center_y_mm),
    },
    radius_mm: Math.round(entity.radius_mm),
    clockwise: false,
  }
}
