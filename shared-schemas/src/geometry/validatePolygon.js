import { distanceBetween, ensureClosedRing, segmentsIntersect, withoutDuplicateClosure } from './geometryUtils';
function isAdjacentSegment(firstIndex, secondIndex, segmentCount) {
    if (firstIndex === secondIndex) {
        return true;
    }
    if (Math.abs(firstIndex - secondIndex) === 1) {
        return true;
    }
    return (firstIndex === 0 && secondIndex === segmentCount - 1) || (secondIndex === 0 && firstIndex === segmentCount - 1);
}
export function validatePolygon(vertices, minEdgeLengthMm = 100) {
    const errors = [];
    const ring = withoutDuplicateClosure(vertices);
    if (ring.length < 3) {
        errors.push('Polygon must contain at least 3 vertices.');
        return { valid: false, errors };
    }
    const closedRing = ensureClosedRing(ring);
    const segmentCount = ring.length;
    for (let index = 0; index < segmentCount; index += 1) {
        const start = closedRing[index];
        const end = closedRing[index + 1];
        const edgeLength = distanceBetween(start, end);
        if (edgeLength < minEdgeLengthMm) {
            errors.push(`Edge ${index} is shorter than ${minEdgeLengthMm} mm.`);
        }
    }
    for (let firstIndex = 0; firstIndex < segmentCount; firstIndex += 1) {
        const firstStart = closedRing[firstIndex];
        const firstEnd = closedRing[firstIndex + 1];
        for (let secondIndex = firstIndex + 1; secondIndex < segmentCount; secondIndex += 1) {
            if (isAdjacentSegment(firstIndex, secondIndex, segmentCount)) {
                continue;
            }
            const secondStart = closedRing[secondIndex];
            const secondEnd = closedRing[secondIndex + 1];
            if (segmentsIntersect(firstStart, firstEnd, secondStart, secondEnd)) {
                errors.push(`Segments ${firstIndex} and ${secondIndex} intersect.`);
            }
        }
    }
    return {
        valid: errors.length === 0,
        errors
    };
}
