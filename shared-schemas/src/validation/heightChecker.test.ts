import { describe, expect, it } from 'vitest';
import type { CeilingConstraint } from '../types';
import { checkAllObjects, checkObjectHeight, type HeightPlacedObject } from './heightChecker';

const constraints: CeilingConstraint[] = [
  {
    wall_id: 'w1',
    wall_start: { x_mm: 0, y_mm: 0 },
    wall_end: { x_mm: 4000, y_mm: 0 },
    kniestock_height_mm: 900,
    slope_angle_deg: 35,
    depth_into_room_mm: 2200
  }
];

describe('heightChecker', () => {
  it('returns null when object fits available height', () => {
    const obj: HeightPlacedObject = {
      id: 'o1',
      type: 'base',
      height_mm: 800,
      worldPos: { x_mm: 1000, y_mm: 500 }
    };

    const violation = checkObjectHeight(obj, constraints, 2500);
    expect(violation).toBeNull();
  });

  it('returns hanging cabinet collision for wall object type', () => {
    const obj: HeightPlacedObject = {
      id: 'o2',
      type: 'wall',
      height_mm: 1800,
      worldPos: { x_mm: 1000, y_mm: 50 }
    };

    const violation = checkObjectHeight(obj, constraints, 2500);
    expect(violation?.code).toBe('HANGING_CABINET_SLOPE_COLLISION');
    expect(violation?.flags.labor_surcharge).toBe(true);
  });

  it('sets customization flags for exceeded height', () => {
    const obj: HeightPlacedObject = {
      id: 'o3',
      type: 'tall',
      height_mm: 1100,
      worldPos: { x_mm: 1500, y_mm: 100 }
    };

    const violation = checkObjectHeight(obj, constraints, 2500);
    expect(violation?.code).toBe('HEIGHT_EXCEEDED');
    expect(violation?.flags.requires_customization).toBe(true);
    expect(violation?.flags.height_variant).toBe('low_version');
  });

  it('checks all objects and returns only violations', () => {
    const objects: HeightPlacedObject[] = [
      { id: 'ok', type: 'base', height_mm: 700, worldPos: { x_mm: 1000, y_mm: 1200 } },
      { id: 'bad', type: 'tall', height_mm: 1700, worldPos: { x_mm: 1000, y_mm: 10 } }
    ];

    const violations = checkAllObjects(objects, constraints, 2500);
    expect(violations).toHaveLength(1);
    expect(violations[0].affected_ids).toContain('bad');
  });

  it('does not set labor_surcharge for small non-wall exceedance', () => {
    const obj: HeightPlacedObject = {
      id: 'o4',
      type: 'base',
      height_mm: 2520,
      worldPos: { x_mm: 0, y_mm: 0 }
    };

    const violation = checkObjectHeight(obj, [], 2500);
    expect(violation?.flags.requires_customization).toBe(false);
    expect(violation?.flags.height_variant).toBe('low_version');
    expect(violation?.flags.labor_surcharge).toBe(false);
  });

  it('keeps labor_surcharge false exactly at customization threshold for non-wall objects', () => {
    const obj: HeightPlacedObject = {
      id: 'o5',
      type: 'tall',
      height_mm: 2550,
      worldPos: { x_mm: 0, y_mm: 0 }
    };

    const violation = checkObjectHeight(obj, [], 2500);
    expect(violation?.flags.requires_customization).toBe(false);
    expect(violation?.flags.labor_surcharge).toBe(false);
  });

  it('sets labor_surcharge above customization threshold for non-wall objects', () => {
    const obj: HeightPlacedObject = {
      id: 'o6',
      type: 'appliance',
      height_mm: 2551,
      worldPos: { x_mm: 0, y_mm: 0 }
    };

    const violation = checkObjectHeight(obj, [], 2500);
    expect(violation?.flags.requires_customization).toBe(true);
    expect(violation?.flags.labor_surcharge).toBe(true);
  });

  it('sets labor_surcharge for wall objects even on small exceedance', () => {
    const obj: HeightPlacedObject = {
      id: 'o7',
      type: 'wall',
      height_mm: 2510,
      worldPos: { x_mm: 0, y_mm: 0 }
    };

    const violation = checkObjectHeight(obj, [], 2500);
    expect(violation?.code).toBe('HANGING_CABINET_SLOPE_COLLISION');
    expect(violation?.flags.requires_customization).toBe(false);
    expect(violation?.flags.labor_surcharge).toBe(true);
  });
});
