import type { Point2D } from '@shared/types';

function normalizeAngle(angleDeg: number): number {
  const normalized = angleDeg % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

function shortestAngleDistance(aDeg: number, bDeg: number): number {
  const diff = Math.abs(normalizeAngle(aDeg) - normalizeAngle(bDeg));
  return Math.min(diff, 360 - diff);
}

export function snapToAngle(point: Point2D, origin: Point2D, allowedAngles: number[]): Point2D {
  const dx = point.x_mm - origin.x_mm;
  const dy = point.y_mm - origin.y_mm;
  const radius = Math.hypot(dx, dy);

  if (radius === 0 || allowedAngles.length === 0) {
    return { ...point };
  }

  const currentAngle = normalizeAngle((Math.atan2(dy, dx) * 180) / Math.PI);
  const snappedAngle = allowedAngles.reduce((closestAngle, candidateAngle) => {
    const closestDistance = shortestAngleDistance(currentAngle, closestAngle);
    const candidateDistance = shortestAngleDistance(currentAngle, candidateAngle);
    return candidateDistance < closestDistance ? candidateAngle : closestAngle;
  }, normalizeAngle(allowedAngles[0]));
  const angleRad = (normalizeAngle(snappedAngle) * Math.PI) / 180;

  return {
    x_mm: origin.x_mm + Math.cos(angleRad) * radius,
    y_mm: origin.y_mm + Math.sin(angleRad) * radius
  };
}

export function snapToGrid(point: Point2D, gridSizeMm: number): Point2D {
  if (gridSizeMm <= 0) {
    return { ...point };
  }

  return {
    x_mm: Math.round(point.x_mm / gridSizeMm) * gridSizeMm,
    y_mm: Math.round(point.y_mm / gridSizeMm) * gridSizeMm
  };
}

export function snapPoint(
  point: Point2D,
  origin: Point2D | null,
  gridSizeMm: number,
  angleSnap: boolean
): Point2D {
  const gridSnapped = snapToGrid(point, gridSizeMm);

  if (!angleSnap || origin === null) {
    return gridSnapped;
  }

  return snapToAngle(gridSnapped, origin, [0, 45, 90, 135, 180, 225, 270, 315]);
}
