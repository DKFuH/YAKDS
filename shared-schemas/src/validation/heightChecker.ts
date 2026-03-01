import { getAvailableHeight } from '../geometry/ceilingHeight.js';
import type { CeilingConstraint, Point2D, RuleViolation } from '../types.js';

export interface HeightPlacedObject {
  id: string;
  type: 'base' | 'wall' | 'tall' | 'appliance';
  height_mm: number;
  worldPos: Point2D;
}

export interface HeightViolation extends RuleViolation {
  available_mm: number;
  required_mm: number;
  flags: {
    requires_customization: boolean;
    height_variant: string | null;
    labor_surcharge: boolean;
  };
}

export function checkObjectHeight(
  obj: HeightPlacedObject,
  constraints: CeilingConstraint[],
  nominalCeilingMm: number
): HeightViolation | null {
  const available = getAvailableHeight(constraints, obj.worldPos, nominalCeilingMm);
  if (obj.height_mm <= available) {
    return null;
  }

  const exceeded = obj.height_mm - available;
  const requiresCustomization = exceeded > 50;
  const hasLowHeightVariant = exceeded > 0 && exceeded < 200;
  const laborSurcharge = requiresCustomization || obj.type === 'wall';
  const code = obj.type === 'wall' ? 'HANGING_CABINET_SLOPE_COLLISION' : 'HEIGHT_EXCEEDED';

  return {
    severity: 'error',
    code,
    message: `Required height ${obj.height_mm} mm exceeds available ${available.toFixed(2)} mm.`,
    affected_ids: [obj.id],
    available_mm: available,
    required_mm: obj.height_mm,
    flags: {
      requires_customization: requiresCustomization,
      height_variant: hasLowHeightVariant ? 'low_version' : null,
      labor_surcharge: laborSurcharge
    }
  };
}

export function checkAllObjects(
  objects: HeightPlacedObject[],
  constraints: CeilingConstraint[],
  nominalCeilingMm: number
): HeightViolation[] {
  return objects
    .map((obj) => checkObjectHeight(obj, constraints, nominalCeilingMm))
    .filter((violation): violation is HeightViolation => violation !== null);
}
