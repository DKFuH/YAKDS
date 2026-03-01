import { describe, expect, it } from 'vitest';

import type { ExportPayload, Point2D } from '@shared/types';
import { exportToDxf } from '@dxf-export/dxfExporter';
import { parseDxf } from '@dxf-import/dxfParser';

function createPayload(): ExportPayload {
  return {
    room: {
      boundary: [
        { id: 'v1', x_mm: 0, y_mm: 0, index: 0 },
        { id: 'v2', x_mm: 4000, y_mm: 0, index: 1 },
        { id: 'v3', x_mm: 4000, y_mm: 3000, index: 2 },
        { id: 'v4', x_mm: 0, y_mm: 3000, index: 3 }
      ]
    },
    wallSegments: [
      {
        id: 'wall-1',
        start: { x_mm: 0, y_mm: 0 },
        end: { x_mm: 4000, y_mm: 0 },
        length_mm: 4000
      },
      {
        id: 'wall-2',
        start: { x_mm: 4000, y_mm: 0 },
        end: { x_mm: 4000, y_mm: 3000 },
        length_mm: 3000
      }
    ],
    openings: [
      {
        id: 'opening-1',
        wall_id: 'wall-1',
        offset_mm: 800,
        width_mm: 900
      }
    ],
    furniture: [
      {
        id: 'item-1',
        footprintRect: {
          min: { x_mm: 300, y_mm: 400 },
          max: { x_mm: 900, y_mm: 1000 }
        }
      }
    ],
    includeFurniture: true
  };
}

function pointMatches(points: Point2D[], target: Point2D, toleranceMm = 1): boolean {
  return points.some(
    (point) =>
      Math.abs(point.x_mm - target.x_mm) <= toleranceMm && Math.abs(point.y_mm - target.y_mm) <= toleranceMm
  );
}

describe('cad roundtrip', () => {
  it('roundtrips room vertices through DXF export and import', () => {
    const payload = createPayload();
    const dxf = exportToDxf(payload);
    const asset = parseDxf(dxf, 'roundtrip.dxf');
    const roomLayer = asset.layers.find((layer) => layer.name === 'YAKDS_ROOM');
    const roomEntity =
      roomLayer &&
      asset.entities.find(
        (entity) => entity.layer_id === roomLayer.id && entity.geometry.type === 'polyline'
      );

    expect(roomEntity).toBeTruthy();

    const importedPoints =
      roomEntity?.geometry.type === 'polyline' ? roomEntity.geometry.points : [];

    payload.room.boundary.forEach((vertex) => {
      expect(pointMatches(importedPoints, vertex)).toBe(true);
    });
  });

  it('converts inch-based DXF input to millimeters', () => {
    const dxf = [
      '0',
      'SECTION',
      '2',
      'HEADER',
      '9',
      '$INSUNITS',
      '70',
      '1',
      '0',
      'ENDSEC',
      '0',
      'SECTION',
      '2',
      'ENTITIES',
      '0',
      'LINE',
      '5',
      'A1',
      '8',
      '0',
      '10',
      '1',
      '20',
      '0',
      '11',
      '2',
      '21',
      '0',
      '0',
      'ENDSEC',
      '0',
      'EOF'
    ].join('\n');

    const asset = parseDxf(dxf, 'inches-roundtrip.dxf');

    expect(asset.entities[0]).toMatchObject({
      geometry: {
        start: { x_mm: 25.4, y_mm: 0 },
        end: { x_mm: 50.8, y_mm: 0 }
      }
    });
  });

  it('keeps all expected YAKDS layer names in exported DXF output', () => {
    const dxf = exportToDxf(createPayload());

    expect(dxf).toContain('YAKDS_ROOM');
    expect(dxf).toContain('YAKDS_WALLS');
    expect(dxf).toContain('YAKDS_OPENINGS');
    expect(dxf).toContain('YAKDS_FURNITURE');
  });

  it('returns an empty asset for an empty DXF string', () => {
    const asset = parseDxf('', 'empty.dxf');

    expect(asset.entities).toEqual([]);
    expect(asset.layers).toEqual([]);
  });

  it('imports known entities and ignores unknown ones', () => {
    const dxf = [
      '0',
      'SECTION',
      '2',
      'ENTITIES',
      '0',
      'LINE',
      '5',
      'A1',
      '8',
      '0',
      '10',
      '0',
      '20',
      '0',
      '11',
      '1000',
      '21',
      '0',
      '0',
      'ELLIPSE',
      '8',
      '0',
      '10',
      '0',
      '20',
      '0',
      '11',
      '10',
      '21',
      '0',
      '40',
      '0.5',
      '41',
      '0',
      '42',
      '6.283185',
      '0',
      'ENDSEC',
      '0',
      'EOF'
    ].join('\n');

    const asset = parseDxf(dxf, 'mixed.dxf');

    expect(asset.entities).toHaveLength(1);
    expect(asset.protocol.some((entry) => entry.status === 'ignored')).toBe(true);
  });
});
