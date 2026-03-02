import type { Opening, Placement, ValidationResult, WallSegment } from '../types.js'

function intervalsOverlap(startA: number, endA: number, startB: number, endB: number): boolean {
  return startA < endB && startB < endA
}

export function validatePlacement(
  wall: WallSegment,
  placement: Placement,
  existingPlacements: Placement[],
  openings: Opening[],
): ValidationResult {
  const errors: string[] = []

  if (placement.offset_mm < 0) {
    errors.push('Placement offset must be at least 0 mm.')
  }

  if (placement.width_mm <= 0) {
    errors.push('Placement width must be greater than 0 mm.')
  }

  if (placement.depth_mm <= 0) {
    errors.push('Placement depth must be greater than 0 mm.')
  }

  if (placement.height_mm <= 0) {
    errors.push('Placement height must be greater than 0 mm.')
  }

  if (placement.offset_mm + placement.width_mm > wall.length_mm) {
    errors.push('Placement exceeds wall length.')
  }

  existingPlacements
    .filter((candidate) => candidate.id !== placement.id && candidate.wall_id === placement.wall_id)
    .forEach((candidate) => {
      if (
        intervalsOverlap(
          placement.offset_mm,
          placement.offset_mm + placement.width_mm,
          candidate.offset_mm,
          candidate.offset_mm + candidate.width_mm,
        )
      ) {
        errors.push(`Placement overlaps with existing placement ${candidate.id}.`)
      }
    })

  openings
    .filter((opening) => opening.wall_id === placement.wall_id)
    .forEach((opening) => {
      if (
        !intervalsOverlap(
          placement.offset_mm,
          placement.offset_mm + placement.width_mm,
          opening.offset_mm,
          opening.offset_mm + opening.width_mm,
        )
      ) {
        return
      }

      const sillHeight = opening.sill_height_mm ?? 0
      const isUnderWindow =
        opening.type === 'window' && placement.height_mm <= sillHeight

      if (isUnderWindow) {
        if (opening.recess_mm !== undefined && placement.depth_mm > opening.recess_mm) {
          errors.push(
            `Placement depth exceeds window reveal depth of ${opening.recess_mm} mm at opening ${opening.id}.`,
          )
        }
      } else {
        errors.push(`Placement overlaps with opening ${opening.id}.`)
      }
    })

  return {
    valid: errors.length === 0,
    errors,
  }
}
