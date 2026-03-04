export interface ArcWallSegment {
  id: string
  kind: 'arc'
  start: { x_mm: number; y_mm: number }
  end: { x_mm: number; y_mm: number }
  center: { x_mm: number; y_mm: number }
  radius_mm: number
  clockwise: boolean
  thickness_mm?: number
}

function normalizeAngle(angle: number): number {
  const twoPi = Math.PI * 2
  let next = angle % twoPi
  if (next < 0) next += twoPi
  return next
}

function signedDelta(start: number, end: number, clockwise: boolean): number {
  const a = normalizeAngle(start)
  const b = normalizeAngle(end)

  if (clockwise) {
    if (a >= b) return a - b
    return a + Math.PI * 2 - b
  }

  if (b >= a) return b - a
  return b + Math.PI * 2 - a
}

function angles(wall: ArcWallSegment): { start: number; end: number; delta: number } {
  const start = Math.atan2(wall.start.y_mm - wall.center.y_mm, wall.start.x_mm - wall.center.x_mm)
  const end = Math.atan2(wall.end.y_mm - wall.center.y_mm, wall.end.x_mm - wall.center.x_mm)
  const delta = signedDelta(start, end, wall.clockwise)
  return { start, end, delta }
}

export function arcLengthMm(wall: ArcWallSegment): number {
  const radius = Math.max(0, wall.radius_mm)
  const { delta } = angles(wall)
  return radius * delta
}

export function pointOnArc(wall: ArcWallSegment, t: number): { x_mm: number; y_mm: number } {
  const clampedT = Math.max(0, Math.min(1, t))
  const { start, delta } = angles(wall)
  const nextAngle = wall.clockwise
    ? start - delta * clampedT
    : start + delta * clampedT

  return {
    x_mm: wall.center.x_mm + Math.cos(nextAngle) * wall.radius_mm,
    y_mm: wall.center.y_mm + Math.sin(nextAngle) * wall.radius_mm,
  }
}

export function nearestPointOnArc(
  wall: ArcWallSegment,
  point: { x_mm: number; y_mm: number },
): { x_mm: number; y_mm: number; t: number } {
  const angleToPoint = Math.atan2(point.y_mm - wall.center.y_mm, point.x_mm - wall.center.x_mm)
  const { start, delta } = angles(wall)

  let t = 0
  if (delta > 0) {
    const diff = wall.clockwise
      ? signedDelta(start, angleToPoint, true)
      : signedDelta(start, angleToPoint, false)
    t = Math.max(0, Math.min(1, diff / delta))
  }

  const projected = pointOnArc(wall, t)
  return {
    ...projected,
    t,
  }
}

export function offsetArc(wall: ArcWallSegment, offsetMm: number): ArcWallSegment {
  const radius = Math.max(1, wall.radius_mm + offsetMm)
  const scale = radius / Math.max(1, wall.radius_mm)

  const startVector = {
    x: wall.start.x_mm - wall.center.x_mm,
    y: wall.start.y_mm - wall.center.y_mm,
  }
  const endVector = {
    x: wall.end.x_mm - wall.center.x_mm,
    y: wall.end.y_mm - wall.center.y_mm,
  }

  return {
    ...wall,
    radius_mm: radius,
    start: {
      x_mm: wall.center.x_mm + startVector.x * scale,
      y_mm: wall.center.y_mm + startVector.y * scale,
    },
    end: {
      x_mm: wall.center.x_mm + endVector.x * scale,
      y_mm: wall.center.y_mm + endVector.y * scale,
    },
  }
}
