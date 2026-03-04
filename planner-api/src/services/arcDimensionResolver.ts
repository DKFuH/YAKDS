export function resolveArcRadiusLabel(radiusMm: number): string {
  return `R ${Math.round(radiusMm)} mm`
}

export function resolveArcLengthLabel(lengthMm: number): string {
  return `Bogenlänge ${Math.round(lengthMm)} mm`
}

function normalizeAngle(value: number): number {
  const twoPi = Math.PI * 2
  let angle = value % twoPi
  if (angle < 0) angle += twoPi
  return angle
}

export function resolveArcAngleDeg(startRad: number, endRad: number, clockwise: boolean): number {
  const start = normalizeAngle(startRad)
  const end = normalizeAngle(endRad)

  let delta = 0
  if (clockwise) {
    delta = start >= end ? start - end : start + Math.PI * 2 - end
  } else {
    delta = end >= start ? end - start : end + Math.PI * 2 - start
  }

  return Number(((delta * 180) / Math.PI).toFixed(3))
}

export function buildArcDimensionGeometry(input: {
  center: { x_mm: number; y_mm: number }
  radius_mm: number
  mid_angle_rad: number
  leader_length_mm?: number
}): {
  leader_points: Array<{ x_mm: number; y_mm: number }>
  label_point: { x_mm: number; y_mm: number }
} {
  const leaderLength = input.leader_length_mm ?? Math.max(150, input.radius_mm * 0.2)
  const base = {
    x_mm: input.center.x_mm + Math.cos(input.mid_angle_rad) * input.radius_mm,
    y_mm: input.center.y_mm + Math.sin(input.mid_angle_rad) * input.radius_mm,
  }
  const label = {
    x_mm: input.center.x_mm + Math.cos(input.mid_angle_rad) * (input.radius_mm + leaderLength),
    y_mm: input.center.y_mm + Math.sin(input.mid_angle_rad) * (input.radius_mm + leaderLength),
  }

  return {
    leader_points: [base, label],
    label_point: label,
  }
}
