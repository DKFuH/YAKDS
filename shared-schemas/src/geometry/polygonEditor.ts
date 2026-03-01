import { randomUUID } from 'node:crypto';

import type { Point2D, Vertex } from '../types.js';
import { cloneVertices, distanceBetween, normalizeVector, toVector, withoutDuplicateClosure } from './geometryUtils.js';

function updateVertex(vertices: Vertex[], index: number, nextPoint: Point2D): Vertex[] {
  if (index < 0 || index >= vertices.length) {
    return cloneVertices(vertices);
  }

  return vertices.map((vertex, vertexIndex) =>
    vertexIndex === index
      ? {
          ...vertex,
          x_mm: nextPoint.x_mm,
          y_mm: nextPoint.y_mm
        }
      : { ...vertex }
  );
}

export function moveVertex(vertices: Vertex[], index: number, newPos: Point2D): Vertex[] {
  return updateVertex(vertices, index, newPos);
}

export function setEdgeLength(vertices: Vertex[], edgeIndex: number, newLengthMm: number): Vertex[] {
  if (vertices.length < 2 || edgeIndex < 0 || edgeIndex >= vertices.length || newLengthMm <= 0) {
    return cloneVertices(vertices);
  }

  const start = vertices[edgeIndex];
  const endIndex = (edgeIndex + 1) % vertices.length;
  const end = vertices[endIndex];
  const direction = normalizeVector(toVector(start, end));
  const fallbackDirection = direction.x === 0 && direction.y === 0 ? { x: 1, y: 0 } : direction;

  return updateVertex(vertices, endIndex, {
    x_mm: start.x_mm + fallbackDirection.x * newLengthMm,
    y_mm: start.y_mm + fallbackDirection.y * newLengthMm
  });
}

export function polylineToRoomBoundary(points: Point2D[]): { vertices: Vertex[] } {
  const openPoints = withoutDuplicateClosure(points);

  if (openPoints.length === 0) {
    return { vertices: [] };
  }

  const isClosed = distanceBetween(openPoints[0], openPoints[openPoints.length - 1]) === 0;
  const closedPoints = isClosed ? openPoints : [...openPoints, { ...openPoints[0] }];

  return {
    vertices: closedPoints.map((point, index) => ({
      id: randomUUID(),
      x_mm: point.x_mm,
      y_mm: point.y_mm,
      index
    }))
  };
}
