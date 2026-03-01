import type { Point2D, Vector2D, Vertex } from '../types.js';

export const EPSILON = 1e-6;

export function arePointsEqual(a: Point2D, b: Point2D, epsilon = EPSILON): boolean {
  return Math.abs(a.x_mm - b.x_mm) <= epsilon && Math.abs(a.y_mm - b.y_mm) <= epsilon;
}

export function distanceBetween(a: Point2D, b: Point2D): number {
  const dx = b.x_mm - a.x_mm;
  const dy = b.y_mm - a.y_mm;
  return Math.hypot(dx, dy);
}

export function toVector(from: Point2D, to: Point2D): Vector2D {
  return {
    x: to.x_mm - from.x_mm,
    y: to.y_mm - from.y_mm
  };
}

export function vectorLength(vector: Vector2D): number {
  return Math.hypot(vector.x, vector.y);
}

export function normalizeVector(vector: Vector2D): Vector2D {
  const length = vectorLength(vector);

  if (length <= EPSILON) {
    return { x: 0, y: 0 };
  }

  return {
    x: vector.x / length,
    y: vector.y / length
  };
}

export function dotProduct(a: Vector2D, b: Vector2D): number {
  return a.x * b.x + a.y * b.y;
}

export function crossProduct(a: Vector2D, b: Vector2D): number {
  return a.x * b.y - a.y * b.x;
}

export function orientation(a: Point2D, b: Point2D, c: Point2D): number {
  const value = crossProduct(toVector(a, b), toVector(a, c));

  if (Math.abs(value) <= EPSILON) {
    return 0;
  }

  return value > 0 ? 1 : -1;
}

export function isPointOnSegment(point: Point2D, start: Point2D, end: Point2D, epsilon = EPSILON): boolean {
  if (orientation(start, end, point) !== 0) {
    return false;
  }

  const minX = Math.min(start.x_mm, end.x_mm) - epsilon;
  const maxX = Math.max(start.x_mm, end.x_mm) + epsilon;
  const minY = Math.min(start.y_mm, end.y_mm) - epsilon;
  const maxY = Math.max(start.y_mm, end.y_mm) + epsilon;

  return point.x_mm >= minX && point.x_mm <= maxX && point.y_mm >= minY && point.y_mm <= maxY;
}

export function segmentsIntersect(a1: Point2D, a2: Point2D, b1: Point2D, b2: Point2D): boolean {
  const o1 = orientation(a1, a2, b1);
  const o2 = orientation(a1, a2, b2);
  const o3 = orientation(b1, b2, a1);
  const o4 = orientation(b1, b2, a2);

  if (o1 !== o2 && o3 !== o4) {
    return true;
  }

  if (o1 === 0 && isPointOnSegment(b1, a1, a2)) {
    return true;
  }

  if (o2 === 0 && isPointOnSegment(b2, a1, a2)) {
    return true;
  }

  if (o3 === 0 && isPointOnSegment(a1, b1, b2)) {
    return true;
  }

  if (o4 === 0 && isPointOnSegment(a2, b1, b2)) {
    return true;
  }

  return false;
}

export function pointInPolygon(point: Point2D, polygon: Point2D[]): boolean {
  const ring = withoutDuplicateClosure(polygon);

  if (ring.length < 3) {
    return false;
  }

  let inside = false;

  for (let index = 0; index < ring.length; index += 1) {
    const current = ring[index];
    const next = ring[(index + 1) % ring.length];

    if (isPointOnSegment(point, current, next)) {
      return true;
    }

    const crossesHorizontalRay =
      (current.y_mm > point.y_mm) !== (next.y_mm > point.y_mm) &&
      point.x_mm <
        ((next.x_mm - current.x_mm) * (point.y_mm - current.y_mm)) / (next.y_mm - current.y_mm) +
          current.x_mm;

    if (crossesHorizontalRay) {
      inside = !inside;
    }
  }

  return inside;
}

export function distancePointToSegment(point: Point2D, start: Point2D, end: Point2D): number {
  const segmentVector = toVector(start, end);
  const pointVector = toVector(start, point);
  const segmentLengthSquared = segmentVector.x ** 2 + segmentVector.y ** 2;

  if (segmentLengthSquared <= EPSILON) {
    return distanceBetween(point, start);
  }

  const t = Math.max(0, Math.min(1, dotProduct(pointVector, segmentVector) / segmentLengthSquared));

  const projection = {
    x_mm: start.x_mm + segmentVector.x * t,
    y_mm: start.y_mm + segmentVector.y * t
  };

  return distanceBetween(point, projection);
}

export function projectPointOntoSegment(
  point: Point2D,
  start: Point2D,
  end: Point2D
): { point: Point2D; t: number; distance_mm: number } {
  const segmentVector = toVector(start, end);
  const pointVector = toVector(start, point);
  const segmentLengthSquared = segmentVector.x ** 2 + segmentVector.y ** 2;

  if (segmentLengthSquared <= EPSILON) {
    return {
      point: { ...start },
      t: 0,
      distance_mm: distanceBetween(point, start)
    };
  }

  const rawT = dotProduct(pointVector, segmentVector) / segmentLengthSquared;
  const t = Math.max(0, Math.min(1, rawT));
  const projection = {
    x_mm: start.x_mm + segmentVector.x * t,
    y_mm: start.y_mm + segmentVector.y * t
  };

  return {
    point: projection,
    t,
    distance_mm: distanceBetween(point, projection)
  };
}

export function withoutDuplicateClosure<T extends Point2D>(points: T[]): T[] {
  if (points.length <= 1) {
    return [...points];
  }

  const first = points[0];
  const last = points[points.length - 1];

  if (arePointsEqual(first, last)) {
    return points.slice(0, -1);
  }

  return [...points];
}

export function ensureClosedRing<T extends Point2D>(points: T[]): Point2D[] {
  const ring = withoutDuplicateClosure(points);

  if (ring.length === 0) {
    return [];
  }

  return [...ring, { x_mm: ring[0].x_mm, y_mm: ring[0].y_mm }];
}

export function polygonArea(points: Point2D[]): number {
  const ring = withoutDuplicateClosure(points);

  if (ring.length < 3) {
    return 0;
  }

  let area = 0;

  for (let index = 0; index < ring.length; index += 1) {
    const current = ring[index];
    const next = ring[(index + 1) % ring.length];
    area += current.x_mm * next.y_mm - next.x_mm * current.y_mm;
  }

  return area / 2;
}

export function cloneVertices(vertices: Vertex[]): Vertex[] {
  return vertices.map((vertex) => ({ ...vertex }));
}
