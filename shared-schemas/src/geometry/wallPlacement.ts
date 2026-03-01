import type { PlacedItem, Point2D, Vector2D, WallSegment2D } from '../types.js';

function wallLength(wall: WallSegment2D): number {
  const dx = wall.end.x_mm - wall.start.x_mm;
  const dy = wall.end.y_mm - wall.start.y_mm;
  return wall.length_mm > 0 ? wall.length_mm : Math.hypot(dx, dy);
}

function pointInPolygon(point: Point2D, polygon: Point2D[]): boolean {
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x_mm;
    const yi = polygon[i].y_mm;
    const xj = polygon[j].x_mm;
    const yj = polygon[j].y_mm;

    const intersects =
      yi > point.y_mm !== yj > point.y_mm &&
      point.x_mm < ((xj - xi) * (point.y_mm - yi)) / (yj - yi + Number.EPSILON) + xi;

    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
}

export function getWallDirection(wall: WallSegment2D): Vector2D {
  const dx = wall.end.x_mm - wall.start.x_mm;
  const dy = wall.end.y_mm - wall.start.y_mm;
  const length = wallLength(wall);

  if (length === 0) {
    throw new Error('Wall length must be greater than 0.');
  }

  return {
    x: dx / length,
    y: dy / length
  };
}

export function getWallInnerNormal(wall: WallSegment2D, polygon: Point2D[]): Vector2D {
  if (polygon.length < 3) {
    throw new Error('Polygon must contain at least 3 points.');
  }

  const direction = getWallDirection(wall);
  const rightNormal: Vector2D = {
    x: direction.y,
    y: -direction.x
  };
  const leftNormal: Vector2D = {
    x: -direction.y,
    y: direction.x
  };

  const mid: Point2D = {
    x_mm: (wall.start.x_mm + wall.end.x_mm) / 2,
    y_mm: (wall.start.y_mm + wall.end.y_mm) / 2
  };

  const probeDistance = 10;
  const rightProbe: Point2D = {
    x_mm: mid.x_mm + rightNormal.x * probeDistance,
    y_mm: mid.y_mm + rightNormal.y * probeDistance
  };

  if (pointInPolygon(rightProbe, polygon)) {
    return rightNormal;
  }

  return leftNormal;
}

export function getPlacementWorldPos(wall: WallSegment2D, offsetMm: number): Point2D {
  const direction = getWallDirection(wall);
  const clamped = Math.max(0, Math.min(offsetMm, wallLength(wall)));

  return {
    x_mm: wall.start.x_mm + direction.x * clamped,
    y_mm: wall.start.y_mm + direction.y * clamped
  };
}

export function snapToWall(dragWorldPos: Point2D, wall: WallSegment2D): number {
  const dx = wall.end.x_mm - wall.start.x_mm;
  const dy = wall.end.y_mm - wall.start.y_mm;
  const length = wallLength(wall);
  if (length === 0) {
    throw new Error('Wall length must be greater than 0.');
  }

  const unitX = dx / length;
  const unitY = dy / length;
  const vx = dragWorldPos.x_mm - wall.start.x_mm;
  const vy = dragWorldPos.y_mm - wall.start.y_mm;
  const projected = vx * unitX + vy * unitY;

  return Math.max(0, Math.min(length, projected));
}

export function canPlaceOnWall(
  wall: WallSegment2D,
  offsetMm: number,
  widthMm: number,
  existing: PlacedItem[]
): boolean {
  if (widthMm <= 0) {
    return false;
  }

  const length = wallLength(wall);
  const start = offsetMm;
  const end = offsetMm + widthMm;

  if (start < 0 || end > length) {
    return false;
  }

  for (const item of existing) {
    if (item.wall_id !== wall.id) {
      continue;
    }

    const itemStart = item.offset_mm;
    const itemEnd = item.offset_mm + item.width_mm;
    const overlap = Math.max(start, itemStart) < Math.min(end, itemEnd);
    if (overlap) {
      return false;
    }
  }

  return true;
}
