import type { CeilingConstraint, Point2D } from '../types.js';
import { distancePointToSegment } from './geometryUtils.js';

export function getHeightAtPoint(
  constraint: CeilingConstraint,
  point: Point2D,
  nominalCeilingMm: number
): number {
  const distanceToWall = distancePointToSegment(point, constraint.wall_start, constraint.wall_end);

  if (distanceToWall >= constraint.depth_into_room_mm) {
    return nominalCeilingMm;
  }

  const angleRad = (constraint.slope_angle_deg * Math.PI) / 180;
  const constrainedHeight = constraint.kniestock_height_mm + Math.tan(angleRad) * distanceToWall;

  return Math.min(nominalCeilingMm, constrainedHeight);
}

export function getAvailableHeight(
  constraints: CeilingConstraint[],
  point: Point2D,
  nominalCeilingMm: number
): number {
  if (constraints.length === 0) {
    return nominalCeilingMm;
  }

  return constraints.reduce((minimumHeight, constraint) => {
    const availableHeight = getHeightAtPoint(constraint, point, nominalCeilingMm);
    return Math.min(minimumHeight, availableHeight);
  }, nominalCeilingMm);
}
