import type { Opening, PlacedObject, Point2D, RuleViolation, WallSegment2D } from '../types';
export declare function checkObjectOverlap(a: PlacedObject, b: PlacedObject): RuleViolation | null;
export declare function checkObjectInRoom(obj: PlacedObject, roomPolygon: Point2D[]): RuleViolation | null;
export declare function checkObjectVsOpening(obj: PlacedObject, openings: Opening[]): RuleViolation | null;
export declare function checkMinClearance(obj: PlacedObject, others: PlacedObject[], minMm: number): RuleViolation | null;
export declare function detectCostHints(obj: PlacedObject, wall: WallSegment2D, openings: Opening[]): RuleViolation[];
//# sourceMappingURL=collisionDetector.d.ts.map