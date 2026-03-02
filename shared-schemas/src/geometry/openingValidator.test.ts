import { describe, expect, it } from 'vitest';
import type { CadEntity, Opening, WallSegment } from '../types';
import { detectOpeningsFromCad, validateOpening } from './openingValidator';

const wall: WallSegment = {
  id: 'wall-1',
  length_mm: 4000
};

describe('openingValidator', () => {
  it('validates an opening inside wall bounds', () => {
    const opening: Opening = { id: 'opening-1', wall_id: 'wall-1', offset_mm: 500, width_mm: 1000 };

    expect(validateOpening(wall, opening, [])).toEqual({ valid: true, errors: [] });
  });

  it('rejects overlapping openings', () => {
    const opening: Opening = { id: 'opening-1', wall_id: 'wall-1', offset_mm: 500, width_mm: 1000 };
    const existing: Opening[] = [{ id: 'opening-2', wall_id: 'wall-1', offset_mm: 1200, width_mm: 900 }];

    const result = validateOpening(wall, opening, existing);

    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.includes('overlaps'))).toBe(true);
  });

  it('rejects openings outside the wall', () => {
    const opening: Opening = { id: 'opening-1', wall_id: 'wall-1', offset_mm: 3500, width_mm: 700 };

    const result = validateOpening(wall, opening, []);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Opening exceeds wall length.');
  });

  it('detects gaps between CAD segments as opening candidates', () => {
    const entities: CadEntity[] = [
      {
        id: 'line-1',
        layer_id: 'layer-1',
        type: 'line',
        geometry: {
          type: 'line',
          start: { x_mm: 0, y_mm: 0 },
          end: { x_mm: 1000, y_mm: 0 }
        }
      },
      {
        id: 'line-2',
        layer_id: 'layer-1',
        type: 'line',
        geometry: {
          type: 'line',
          start: { x_mm: 1800, y_mm: 0 },
          end: { x_mm: 4000, y_mm: 0 }
        }
      }
    ];

    expect(detectOpeningsFromCad(entities, 4000)).toEqual([
      {
        offset_mm: 1000,
        width_mm: 800,
        confidence: 'high'
      }
    ]);
  });

  it('clamps out-of-range CAD segments to wall boundaries', () => {
    const entities: CadEntity[] = [
      {
        id: 'line-out-1',
        layer_id: 'layer-1',
        type: 'line',
        geometry: {
          type: 'line',
          start: { x_mm: -500, y_mm: 0 },
          end: { x_mm: 500, y_mm: 0 }
        }
      },
      {
        id: 'line-out-2',
        layer_id: 'layer-1',
        type: 'line',
        geometry: {
          type: 'line',
          start: { x_mm: 2500, y_mm: 0 },
          end: { x_mm: 4500, y_mm: 0 }
        }
      }
    ];

    expect(detectOpeningsFromCad(entities, 3000)).toEqual([
      {
        offset_mm: 500,
        width_mm: 2000,
        confidence: 'high'
      }
    ]);
  });

  it('accepts a window opening with recess within wall thickness', () => {
    const thickWall: WallSegment = { id: 'wall-1', length_mm: 4000, thickness_mm: 300 };
    const opening: Opening = { id: 'opening-1', wall_id: 'wall-1', type: 'window', offset_mm: 500, width_mm: 1000, recess_mm: 150 };

    expect(validateOpening(thickWall, opening, [])).toEqual({ valid: true, errors: [] });
  });

  it('rejects a window opening with recess exceeding wall thickness', () => {
    const thickWall: WallSegment = { id: 'wall-1', length_mm: 4000, thickness_mm: 200 };
    const opening: Opening = { id: 'opening-1', wall_id: 'wall-1', type: 'window', offset_mm: 500, width_mm: 1000, recess_mm: 250 };

    const result = validateOpening(thickWall, opening, []);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Opening recess exceeds wall thickness.');
  });

  it('rejects a window opening with negative recess', () => {
    const opening: Opening = { id: 'opening-1', wall_id: 'wall-1', type: 'window', offset_mm: 500, width_mm: 1000, recess_mm: -10 };

    const result = validateOpening(wall, opening, []);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Opening recess must be at least 0 mm.');
  });

  it('allows recess without wall thickness defined', () => {
    const opening: Opening = { id: 'opening-1', wall_id: 'wall-1', type: 'window', offset_mm: 500, width_mm: 1000, recess_mm: 150 };

    expect(validateOpening(wall, opening, [])).toEqual({ valid: true, errors: [] });
  });
});
