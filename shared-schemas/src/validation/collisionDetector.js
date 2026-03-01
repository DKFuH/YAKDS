function interval(obj) {
    return {
        start: obj.offset_mm,
        end: obj.offset_mm + obj.width_mm
    };
}
function overlaps(a, b) {
    return Math.max(a.start, b.start) < Math.min(a.end, b.end);
}
function pointInPolygon(point, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i].x_mm;
        const yi = polygon[i].y_mm;
        const xj = polygon[j].x_mm;
        const yj = polygon[j].y_mm;
        const intersect = yi > point.y_mm !== yj > point.y_mm &&
            point.x_mm < ((xj - xi) * (point.y_mm - yi)) / (yj - yi + Number.EPSILON) + xi;
        if (intersect) {
            inside = !inside;
        }
    }
    return inside;
}
export function checkObjectOverlap(a, b) {
    if (a.wall_id !== b.wall_id) {
        return null;
    }
    if (!overlaps(interval(a), interval(b))) {
        return null;
    }
    return {
        severity: 'error',
        code: 'OBJECT_OVERLAP',
        message: 'Objects overlap on the same wall.',
        affected_ids: [a.id, b.id]
    };
}
export function checkObjectInRoom(obj, roomPolygon) {
    if (!obj.worldPos || pointInPolygon(obj.worldPos, roomPolygon)) {
        return null;
    }
    return {
        severity: 'error',
        code: 'OBJECT_OUTSIDE_ROOM',
        message: 'Object position is outside room polygon.',
        affected_ids: [obj.id]
    };
}
export function checkObjectVsOpening(obj, openings) {
    const objRange = interval(obj);
    for (const opening of openings) {
        if (opening.wall_id !== obj.wall_id) {
            continue;
        }
        if (overlaps(objRange, interval(opening))) {
            return {
                severity: 'error',
                code: 'OBJECT_BLOCKS_OPENING',
                message: 'Object blocks an opening.',
                affected_ids: [obj.id, opening.id]
            };
        }
    }
    return null;
}
export function checkMinClearance(obj, others, minMm) {
    const objRange = interval(obj);
    for (const other of others) {
        if (other.id === obj.id || other.wall_id !== obj.wall_id) {
            continue;
        }
        const otherRange = interval(other);
        const distance = objRange.end <= otherRange.start
            ? otherRange.start - objRange.end
            : otherRange.end <= objRange.start
                ? objRange.start - otherRange.end
                : 0;
        if (distance < minMm) {
            return {
                severity: 'warning',
                code: 'MIN_CLEARANCE_VIOLATED',
                message: `Minimum clearance of ${minMm} mm is violated.`,
                affected_ids: [obj.id, other.id]
            };
        }
    }
    return null;
}
function wallAngleDeviationFromOrthogonal(wall) {
    const dx = wall.end.x_mm - wall.start.x_mm;
    const dy = wall.end.y_mm - wall.start.y_mm;
    const angleDeg = Math.abs((Math.atan2(dy, dx) * 180) / Math.PI);
    const normalized = angleDeg % 180;
    const candidates = [0, 90, 180];
    return Math.min(...candidates.map((target) => Math.abs(normalized - target)));
}
export function detectCostHints(obj, wall, openings) {
    const hints = [];
    const start = obj.offset_mm;
    const end = obj.offset_mm + obj.width_mm;
    const closeToBoundary = start <= 1 || end >= wall.length_mm - 1;
    const touchesOpeningEdge = openings.some((opening) => {
        if (opening.wall_id !== obj.wall_id) {
            return false;
        }
        const openingStart = opening.offset_mm;
        const openingEnd = opening.offset_mm + opening.width_mm;
        return Math.abs(openingStart - end) <= 1 || Math.abs(openingEnd - start) <= 1;
    });
    if (!closeToBoundary && !touchesOpeningEdge) {
        hints.push({
            severity: 'hint',
            code: 'SPECIAL_TRIM_NEEDED',
            message: 'Object likely needs a special trim panel.',
            affected_ids: [obj.id]
        });
    }
    const deviation = wallAngleDeviationFromOrthogonal(wall);
    if (deviation > 10) {
        hints.push({
            severity: 'hint',
            code: 'LABOR_SURCHARGE',
            message: 'Wall angle suggests increased installation effort.',
            affected_ids: [obj.id]
        });
    }
    return hints;
}
//# sourceMappingURL=collisionDetector.js.map