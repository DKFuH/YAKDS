import { describe, expect, it } from 'vitest';

import type { ExportPayload } from '@shared/types';
import { CAD_EXPORT_LAYER_NAMES, exportToDxf } from './dxfExporter';

function createPayload(includeFurniture = true): ExportPayload {
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
        id: 'furniture-1',
        footprintRect: {
          min: { x_mm: 500, y_mm: 500 },
          max: { x_mm: 1100, y_mm: 1100 }
        }
      }
    ],
    includeFurniture
  };
}

describe('dxfExporter', () => {
  it('exports DXF strings with the required layers', () => {
    const output = exportToDxf(createPayload());

    CAD_EXPORT_LAYER_NAMES.forEach((layerName) => {
      expect(output).toContain(layerName);
    });
  });

  it('writes millimeter units into the DXF header', () => {
    const output = exportToDxf(createPayload());

    expect(output).toContain('$INSUNITS');
    expect(output).toContain('\n70\n4\n');
  });

  it('omits furniture geometry when requested', () => {
    const output = exportToDxf(createPayload(false));

    expect(output).toContain('OKP_FURNITURE');
    expect(output).not.toContain('500\n 20\n500');
  });
});
