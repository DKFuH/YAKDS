import type { Point2D, Vertex } from '@shared/types'
import { polygonArea, projectPointOntoSegment, withoutDuplicateClosure } from '@shared/geometry/geometryUtils'
import { validatePolygon } from '@shared/geometry/validatePolygon'
import type { Opening } from '../api/openings.js'
import type { Placement } from '../api/placements.js'
import type { RoomBoundaryPayload } from '../api/rooms.js'

const TOPOLOGY_EPSILON_MM = 1

export interface BoundaryAutofixResult {
  vertices: Vertex[]
  fixes: string[]
  validationErrors: string[]
  changed: boolean
}

export interface TopologyRebindResult {
  openings: Opening[]
  placements: Placement[]
  changedOpenings: number
  changedPlacements: number
}

export interface DimensionAssistSegment {
  id: string
  from_mm: number
  to_mm: number
  length_mm: number
  from_label: string
  to_label: string
}

interface WallGeometry {
  id: string
  start: Point2D
  end: Point2D
  length_mm: number
}

interface WallHostedItem {
  id: string
  wall_id: string
  offset_mm: number
  width_mm: number
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min
  if (value > max) return max
  return value
}

function arePointsNear(a: Point2D, b: Point2D, epsilonMm = TOPOLOGY_EPSILON_MM): boolean {
  return Math.hypot(a.x_mm - b.x_mm, a.y_mm - b.y_mm) <= epsilonMm
}

function isFinitePoint(vertex: Vertex): boolean {
  return Number.isFinite(vertex.x_mm) && Number.isFinite(vertex.y_mm)
}

function normalizeVertexRing(vertices: Vertex[]): Vertex[] {
  return withoutDuplicateClosure(vertices)
    .filter(isFinitePoint)
    .map((vertex) => ({ ...vertex }))
}

function removeConsecutiveDuplicates(vertices: Vertex[], fixes: string[]): Vertex[] {
  const next: Vertex[] = []
  for (const vertex of vertices) {
    const previous = next.at(-1)
    if (previous && arePointsNear(previous, vertex)) {
      fixes.push(`duplicate-vertex:${vertex.id}`)
      continue
    }
    next.push(vertex)
  }

  if (next.length > 2 && arePointsNear(next[0], next[next.length - 1])) {
    fixes.push('duplicate-closure-vertex')
    next.pop()
  }

  return next
}

function removeNullEdges(vertices: Vertex[], fixes: string[]): Vertex[] {
  const next = [...vertices]
  let changed = true

  while (changed && next.length > 3) {
    changed = false
    for (let index = 0; index < next.length; index += 1) {
      const current = next[index]
      const afterIndex = (index + 1) % next.length
      const after = next[afterIndex]
      if (!current || !after) continue

      const edgeLength = Math.hypot(after.x_mm - current.x_mm, after.y_mm - current.y_mm)
      if (edgeLength > TOPOLOGY_EPSILON_MM) {
        continue
      }

      fixes.push(`null-edge:${current.id}->${after.id}`)
      next.splice(afterIndex, 1)
      changed = true
      break
    }
  }

  return next
}

function reindexVertices(vertices: Vertex[]): Vertex[] {
  return vertices.map((vertex, index) => ({ ...vertex, index }))
}

function signature(vertices: Vertex[]): string {
  return vertices.map((vertex) => `${vertex.id}:${vertex.x_mm.toFixed(3)}:${vertex.y_mm.toFixed(3)}`).join('|')
}

function sanitizeLength(lengthMm: number, fallback: number): number {
  if (!Number.isFinite(lengthMm) || lengthMm <= 0) {
    return fallback
  }
  return lengthMm
}

function readWallGeometry(boundary: RoomBoundaryPayload | null | undefined): WallGeometry[] {
  if (!boundary || !Array.isArray(boundary.vertices) || boundary.vertices.length < 2) {
    return []
  }

  const vertices = boundary.vertices
  const byVertexId = new Map(vertices.map((vertex) => [vertex.id, vertex]))
  const segments = Array.isArray(boundary.wall_segments) ? boundary.wall_segments : []

  if (segments.length === 0) {
    return vertices.map((start, index) => {
      const end = vertices[(index + 1) % vertices.length]
      const length = Math.hypot(end.x_mm - start.x_mm, end.y_mm - start.y_mm)
      return {
        id: `wall-${index + 1}`,
        start: { x_mm: start.x_mm, y_mm: start.y_mm },
        end: { x_mm: end.x_mm, y_mm: end.y_mm },
        length_mm: length,
      }
    })
  }

  return segments.flatMap((segment, index) => {
    const fallbackStart = vertices[index]
    const fallbackEnd = vertices[(index + 1) % vertices.length]
    const start = (segment.start_vertex_id ? byVertexId.get(segment.start_vertex_id) : null) ?? fallbackStart
    const end = (segment.end_vertex_id ? byVertexId.get(segment.end_vertex_id) : null) ?? fallbackEnd

    if (!start || !end || !segment.id) {
      return []
    }

    const geometricLength = Math.hypot(end.x_mm - start.x_mm, end.y_mm - start.y_mm)
    return [{
      id: segment.id,
      start: { x_mm: start.x_mm, y_mm: start.y_mm },
      end: { x_mm: end.x_mm, y_mm: end.y_mm },
      length_mm: sanitizeLength(segment.length_mm, geometricLength),
    }]
  })
}

function pointOnWallAtOffset(wall: WallGeometry, offsetMm: number): Point2D {
  if (wall.length_mm <= 0) {
    return { ...wall.start }
  }

  const ratio = clamp(offsetMm / wall.length_mm, 0, 1)
  return {
    x_mm: wall.start.x_mm + (wall.end.x_mm - wall.start.x_mm) * ratio,
    y_mm: wall.start.y_mm + (wall.end.y_mm - wall.start.y_mm) * ratio,
  }
}

function isLikelyReversed(previous: WallGeometry, next: WallGeometry): boolean {
  const directDistance = Math.hypot(previous.start.x_mm - next.start.x_mm, previous.start.y_mm - next.start.y_mm)
    + Math.hypot(previous.end.x_mm - next.end.x_mm, previous.end.y_mm - next.end.y_mm)

  const reversedDistance = Math.hypot(previous.start.x_mm - next.end.x_mm, previous.start.y_mm - next.end.y_mm)
    + Math.hypot(previous.end.x_mm - next.start.x_mm, previous.end.y_mm - next.start.y_mm)

  return reversedDistance + 0.5 < directDistance
}

function clampHostedItem<T extends WallHostedItem>(item: T, wallLengthMm: number): T {
  const width = Math.max(1, Number.isFinite(item.width_mm) ? item.width_mm : 1)
  const maxOffset = Math.max(0, wallLengthMm - width)
  const offset = clamp(Number.isFinite(item.offset_mm) ? item.offset_mm : 0, 0, maxOffset)
  const adjustedWidth = Math.min(width, Math.max(1, wallLengthMm - offset))

  return {
    ...item,
    offset_mm: offset,
    width_mm: adjustedWidth,
  }
}

function rebindHostedItems<T extends WallHostedItem>(
  previousWalls: WallGeometry[],
  nextWalls: WallGeometry[],
  items: T[],
): { items: T[]; changed: number } {
  if (nextWalls.length === 0) {
    return { items: [...items], changed: 0 }
  }

  const previousById = new Map(previousWalls.map((wall) => [wall.id, wall]))
  const nextById = new Map(nextWalls.map((wall) => [wall.id, wall]))

  let changed = 0

  const rebound = items.map((item) => {
    const currentWall = nextById.get(item.wall_id)
    if (currentWall) {
      const previousWall = previousById.get(item.wall_id)
      const mirroredOffset = previousWall && isLikelyReversed(previousWall, currentWall)
        ? Math.max(0, currentWall.length_mm - (item.offset_mm + item.width_mm))
        : item.offset_mm

      const adjusted = clampHostedItem({ ...item, offset_mm: mirroredOffset }, currentWall.length_mm)
      if (
        adjusted.wall_id !== item.wall_id
        || Math.abs(adjusted.offset_mm - item.offset_mm) > 0.5
        || Math.abs(adjusted.width_mm - item.width_mm) > 0.5
      ) {
        changed += 1
      }
      return adjusted
    }

    const previousWall = previousById.get(item.wall_id)
    if (!previousWall) {
      const fallback = clampHostedItem({ ...item, wall_id: nextWalls[0].id }, nextWalls[0].length_mm)
      if (
        fallback.wall_id !== item.wall_id
        || Math.abs(fallback.offset_mm - item.offset_mm) > 0.5
        || Math.abs(fallback.width_mm - item.width_mm) > 0.5
      ) {
        changed += 1
      }
      return fallback
    }

    const anchorPoint = pointOnWallAtOffset(previousWall, item.offset_mm + item.width_mm / 2)

    let bestWall: WallGeometry | null = null
    let bestOffsetCenter = 0
    let bestDistance = Number.POSITIVE_INFINITY

    for (const candidate of nextWalls) {
      const projection = projectPointOntoSegment(anchorPoint, candidate.start, candidate.end)
      if (projection.distance_mm < bestDistance) {
        bestDistance = projection.distance_mm
        bestWall = candidate
        bestOffsetCenter = projection.t * candidate.length_mm
      }
    }

    if (!bestWall) {
      return item
    }

    const offset = Math.max(0, bestOffsetCenter - item.width_mm / 2)
    const rebounded = clampHostedItem({ ...item, wall_id: bestWall.id, offset_mm: offset }, bestWall.length_mm)

    if (
      rebounded.wall_id !== item.wall_id
      || Math.abs(rebounded.offset_mm - item.offset_mm) > 0.5
      || Math.abs(rebounded.width_mm - item.width_mm) > 0.5
    ) {
      changed += 1
    }

    return rebounded
  })

  return { items: rebound, changed }
}

export function autofixBoundaryVertices(vertices: Vertex[], minEdgeLengthMm = 100): BoundaryAutofixResult {
  const beforeSignature = signature(vertices)
  const fixes: string[] = []

  let next = normalizeVertexRing(vertices)
  next = removeConsecutiveDuplicates(next, fixes)
  next = removeNullEdges(next, fixes)

  if (next.length >= 3 && polygonArea(next) < 0) {
    next = [...next].reverse()
    fixes.push('orientation:clockwise-to-ccw')
  }

  next = reindexVertices(next)

  const validation = validatePolygon(next, minEdgeLengthMm)
  const afterSignature = signature(next)

  return {
    vertices: next,
    fixes,
    validationErrors: validation.errors,
    changed: beforeSignature !== afterSignature,
  }
}

export function buildBoundaryFromVertices(vertices: Vertex[], wallIds: string[]): { boundary: RoomBoundaryPayload; wallIds: string[] } {
  const normalizedVertices = reindexVertices(vertices)

  const normalizedWallIds = normalizedVertices.map((_, index) => {
    const candidate = wallIds[index]
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate
    }
    return `wall-${index + 1}`
  })

  const wallSegments = normalizedVertices.map((vertex, index) => {
    const next = normalizedVertices[(index + 1) % normalizedVertices.length]
    return {
      id: normalizedWallIds[index],
      index,
      start_vertex_id: vertex.id,
      end_vertex_id: next.id,
      length_mm: Math.hypot(next.x_mm - vertex.x_mm, next.y_mm - vertex.y_mm),
    }
  })

  return {
    boundary: {
      vertices: normalizedVertices,
      wall_segments: wallSegments,
    },
    wallIds: normalizedWallIds,
  }
}

export function rebindOpeningsAndPlacements(
  previousBoundary: RoomBoundaryPayload | null | undefined,
  nextBoundary: RoomBoundaryPayload,
  openings: Opening[],
  placements: Placement[],
): TopologyRebindResult {
  const previousWalls = readWallGeometry(previousBoundary)
  const nextWalls = readWallGeometry(nextBoundary)

  const reboundOpenings = rebindHostedItems(previousWalls, nextWalls, openings)
  const reboundPlacements = rebindHostedItems(previousWalls, nextWalls, placements)

  return {
    openings: reboundOpenings.items,
    placements: reboundPlacements.items,
    changedOpenings: reboundOpenings.changed,
    changedPlacements: reboundPlacements.changed,
  }
}

export function buildDimensionAssistSegments(
  wallId: string,
  wallLengthMm: number,
  openings: Opening[],
  placements: Placement[],
): DimensionAssistSegment[] {
  if (!Number.isFinite(wallLengthMm) || wallLengthMm <= 0) {
    return []
  }

  const points: Array<{ mm: number; label: string }> = [{ mm: 0, label: 'Wandstart' }]

  openings
    .filter((opening) => opening.wall_id === wallId)
    .forEach((opening) => {
      points.push({ mm: opening.offset_mm, label: 'Oeffnung Start' })
      points.push({ mm: opening.offset_mm + opening.width_mm, label: 'Oeffnung Ende' })
    })

  placements
    .filter((placement) => placement.wall_id === wallId)
    .forEach((placement) => {
      points.push({ mm: placement.offset_mm, label: 'Objekt Start' })
      points.push({ mm: placement.offset_mm + placement.width_mm, label: 'Objekt Ende' })
    })

  points.push({ mm: wallLengthMm, label: 'Wandende' })

  const sorted = points
    .map((entry) => ({ ...entry, mm: clamp(entry.mm, 0, wallLengthMm) }))
    .sort((left, right) => left.mm - right.mm)
    .filter((entry, index, source) => index === 0 || Math.abs(entry.mm - source[index - 1].mm) >= 5)

  const segments: DimensionAssistSegment[] = []
  for (let index = 0; index < sorted.length - 1; index += 1) {
    const from = sorted[index]
    const to = sorted[index + 1]
    const length = to.mm - from.mm
    if (length < 1) {
      continue
    }

    segments.push({
      id: `assist-${index}`,
      from_mm: from.mm,
      to_mm: to.mm,
      length_mm: length,
      from_label: from.label,
      to_label: to.label,
    })
  }

  return segments.slice(0, 16)
}

function normalizePositiveInt(value: number | undefined, fallback: number): number {
  if (!Number.isFinite(value) || (value ?? 0) <= 0) {
    return fallback
  }
  return Math.round(value as number)
}

export function normalizeOpeningForMultiview(opening: Opening): Opening {
  const normalizedType = opening.type ?? 'door'
  const normalizedWidth = normalizePositiveInt(opening.width_mm, 900)
  const normalizedOffset = Math.max(0, Math.round(Number.isFinite(opening.offset_mm) ? opening.offset_mm : 0))

  const normalizedHeight = normalizePositiveInt(
    opening.height_mm,
    normalizedType === 'window' ? 1200 : 2100,
  )

  const rawSill = opening.sill_height_mm
  const windowSill = typeof rawSill === 'number' && Number.isFinite(rawSill) ? rawSill : 900
  const normalizedSill = normalizedType === 'window'
    ? Math.max(0, Math.round(windowSill))
    : 0

  return {
    ...opening,
    type: normalizedType,
    offset_mm: normalizedOffset,
    width_mm: normalizedWidth,
    height_mm: normalizedHeight,
    sill_height_mm: normalizedSill,
  }
}
