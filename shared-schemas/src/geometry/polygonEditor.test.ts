import { describe, expect, it } from 'vitest';
import type { Vertex } from '../types';
import { moveVertex, polylineToRoomBoundary, setEdgeLength } from './polygonEditor';

function vertex(id: string, x_mm: number, y_mm: number, index: number): Vertex {
  return { id, x_mm, y_mm, index };
}

describe('polygonEditor', () => {
  it('moves a single vertex immutably', () => {
    const vertices = [vertex('v1', 0, 0, 0), vertex('v2', 1000, 0, 1), vertex('v3', 1000, 1000, 2)];

    const updated = moveVertex(vertices, 1, { x_mm: 1200, y_mm: 200 });

    expect(updated).toEqual([vertex('v1', 0, 0, 0), vertex('v2', 1200, 200, 1), vertex('v3', 1000, 1000, 2)]);
    expect(updated).not.toBe(vertices);
  });

  it('changes an edge length by moving the end vertex', () => {
    const vertices = [vertex('v1', 0, 0, 0), vertex('v2', 1000, 0, 1), vertex('v3', 1000, 1000, 2)];

    const updated = setEdgeLength(vertices, 0, 1500);

    expect(updated[1]).toMatchObject({ x_mm: 1500, y_mm: 0 });
    expect(updated[0]).toEqual(vertices[0]);
    expect(updated[2]).toEqual(vertices[2]);
  });

  it('keeps vertices unchanged for non-positive edge length', () => {
    const vertices = [vertex('v1', 0, 0, 0), vertex('v2', 1000, 0, 1), vertex('v3', 1000, 1000, 2)];

    const zeroLength = setEdgeLength(vertices, 0, 0);
    const negativeLength = setEdgeLength(vertices, 0, -50);

    expect(zeroLength).toEqual(vertices);
    expect(negativeLength).toEqual(vertices);
    expect(zeroLength).not.toBe(vertices);
    expect(negativeLength).not.toBe(vertices);
  });

  it('wraps the last edge to the first vertex', () => {
    const vertices = [vertex('v1', 0, 0, 0), vertex('v2', 1000, 0, 1), vertex('v3', 1000, 1000, 2)];

    const updated = setEdgeLength(vertices, 2, 500);

    expect(updated[0]).toMatchObject({ x_mm: 646.4466094067263, y_mm: 646.4466094067263 });
  });

  it('converts an open polyline into a closed room boundary', () => {
    const boundary = polylineToRoomBoundary([
      { x_mm: 0, y_mm: 0 },
      { x_mm: 1000, y_mm: 0 },
      { x_mm: 1000, y_mm: 1000 }
    ]);

    expect(boundary.vertices).toHaveLength(4);
    expect(boundary.vertices[0]).toMatchObject({ x_mm: 0, y_mm: 0, index: 0 });
    expect(boundary.vertices[3]).toMatchObject({ x_mm: 0, y_mm: 0, index: 3 });
    expect(new Set(boundary.vertices.map((item) => item.id)).size).toBe(4);
  });
});
