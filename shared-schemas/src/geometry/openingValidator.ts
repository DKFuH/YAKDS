import type { CadEntity, Opening, OpeningCandidate, ValidationResult, WallSegment } from '../types.js';

function intervalsOverlap(startA: number, endA: number, startB: number, endB: number): boolean {
  return startA < endB && startB < endA;
}

function getEntityIntervals(entities: CadEntity[]): Array<{ start: number; end: number }> {
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  entities.forEach((entity) => {
    const points =
      entity.geometry.type === 'line'
        ? [entity.geometry.start, entity.geometry.end]
        : entity.geometry.type === 'polyline'
          ? entity.geometry.points
          : [];

    points.forEach((point) => {
      minX = Math.min(minX, point.x_mm);
      maxX = Math.max(maxX, point.x_mm);
      minY = Math.min(minY, point.y_mm);
      maxY = Math.max(maxY, point.y_mm);
    });
  });

  if (!Number.isFinite(minX)) {
    return [];
  }

  const useX = maxX - minX >= maxY - minY;

  return entities
    .flatMap((entity) => {
      if (entity.geometry.type === 'line') {
        const values = useX
          ? [entity.geometry.start.x_mm, entity.geometry.end.x_mm]
          : [entity.geometry.start.y_mm, entity.geometry.end.y_mm];

        return [{ start: Math.min(...values), end: Math.max(...values) }];
      }

      if (entity.geometry.type === 'polyline' && entity.geometry.points.length >= 2) {
        return entity.geometry.points.slice(0, -1).map((point, index) => {
          const nextPoint = entity.geometry.points[index + 1];
          const values = useX ? [point.x_mm, nextPoint.x_mm] : [point.y_mm, nextPoint.y_mm];
          return { start: Math.min(...values), end: Math.max(...values) };
        });
      }

      return [];
    })
    .sort((left, right) => left.start - right.start);
}

function clampIntervalToWall(interval: { start: number; end: number }, wallLength_mm: number): { start: number; end: number } {
  return {
    start: Math.max(0, Math.min(interval.start, wallLength_mm)),
    end: Math.max(0, Math.min(interval.end, wallLength_mm))
  };
}

export function validateOpening(
  wall: WallSegment,
  opening: Opening,
  existingOpenings: Opening[]
): ValidationResult {
  const errors: string[] = [];

  if (opening.offset_mm < 0) {
    errors.push('Opening offset must be at least 0 mm.');
  }

  if (opening.width_mm <= 0) {
    errors.push('Opening width must be greater than 0 mm.');
  }

  if (opening.offset_mm + opening.width_mm > wall.length_mm) {
    errors.push('Opening exceeds wall length.');
  }

  existingOpenings
    .filter((candidate) => candidate.id !== opening.id && candidate.wall_id === opening.wall_id)
    .forEach((candidate) => {
      if (
        intervalsOverlap(
          opening.offset_mm,
          opening.offset_mm + opening.width_mm,
          candidate.offset_mm,
          candidate.offset_mm + candidate.width_mm
        )
      ) {
        errors.push(`Opening overlaps with existing opening ${candidate.id}.`);
      }
    });

  return {
    valid: errors.length === 0,
    errors
  };
}

export function detectOpeningsFromCad(entities: CadEntity[], wallLength_mm: number): OpeningCandidate[] {
  if (wallLength_mm <= 0) {
    return [];
  }

  const intervals = getEntityIntervals(entities)
    .map((interval) => clampIntervalToWall(interval, wallLength_mm))
    .filter((interval) => interval.end > interval.start);

  if (intervals.length === 0) {
    return [];
  }

  const merged: Array<{ start: number; end: number }> = [];

  intervals.forEach((interval) => {
    const last = merged[merged.length - 1];

    if (!last || interval.start > last.end) {
      merged.push({ ...interval });
      return;
    }

    last.end = Math.max(last.end, interval.end);
  });

  const candidates: OpeningCandidate[] = [];

  for (let index = 0; index < merged.length - 1; index += 1) {
    const current = merged[index];
    const next = merged[index + 1];
    const gapStart = current.end;
    const gapEnd = next.start;
    const gapWidth = gapEnd - gapStart;

    if (gapWidth >= 500 && gapWidth <= 3000) {
      candidates.push({
        offset_mm: gapStart,
        width_mm: gapWidth,
        confidence: 'high'
      });
    }
  }

  const firstGapWidth = merged[0].start;

  if (firstGapWidth >= 500 && firstGapWidth <= 3000) {
    candidates.unshift({
      offset_mm: 0,
      width_mm: firstGapWidth,
      confidence: 'low'
    });
  }

  const lastInterval = merged[merged.length - 1];
  const tailGapWidth = wallLength_mm - lastInterval.end;

  if (tailGapWidth >= 500 && tailGapWidth <= 3000) {
    candidates.push({
      offset_mm: lastInterval.end,
      width_mm: tailGapWidth,
      confidence: 'low'
    });
  }

  return candidates;
}
