const MIN_RISE_MM = 120
const MAX_RISE_MM = 220

export const VERTICAL_CONNECTION_KINDS = [
  'straight_stair',
  'l_stair',
  'u_stair',
  'spiral_stair',
  'void',
] as const

export type VerticalConnectionKind = (typeof VERTICAL_CONNECTION_KINDS)[number]

export type StairGeometryInput = {
  kind: string
  from_level_elevation_mm: number
  to_level_elevation_mm: number
  footprint_json: unknown
  stair_json?: unknown
}

export type StairGeometryResult = {
  stair_json: Record<string, unknown>
  opening_json: Record<string, unknown>
}

export class StairGeometryValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'StairGeometryValidationError'
  }
}

type Point2d = { x_mm: number; y_mm: number }

type Box2d = {
  min_x_mm: number
  min_y_mm: number
  max_x_mm: number
  max_y_mm: number
  width_mm: number
  depth_mm: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function roundMm(value: number): number {
  return Math.round(value * 1000) / 1000
}

function readFiniteNumber(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new StairGeometryValidationError(`${path} must be a finite number`)
  }
  return value
}

function readPositiveNumber(value: unknown, path: string): number {
  const next = readFiniteNumber(value, path)
  if (next <= 0) {
    throw new StairGeometryValidationError(`${path} must be greater than 0`)
  }
  return next
}

function readOptionalPositiveNumber(value: unknown, path: string): number | undefined {
  if (value === undefined || value === null) return undefined
  return readPositiveNumber(value, path)
}

function readOptionalNonNegativeNumber(value: unknown, path: string): number | undefined {
  if (value === undefined || value === null) return undefined
  const next = readFiniteNumber(value, path)
  if (next < 0) {
    throw new StairGeometryValidationError(`${path} must be greater than or equal to 0`)
  }
  return next
}

function readOptionalPositiveInt(value: unknown, path: string): number | undefined {
  if (value === undefined || value === null) return undefined
  const next = readPositiveNumber(value, path)
  if (!Number.isInteger(next)) {
    throw new StairGeometryValidationError(`${path} must be an integer`)
  }
  return next
}

function asPoint(candidate: unknown, index: number): Point2d {
  if (!isRecord(candidate)) {
    throw new StairGeometryValidationError(`footprint_json polygon vertex at index ${index} must be an object`)
  }

  return {
    x_mm: readFiniteNumber(candidate.x_mm, `footprint_json polygon vertex[${index}].x_mm`),
    y_mm: readFiniteNumber(candidate.y_mm, `footprint_json polygon vertex[${index}].y_mm`),
  }
}

function extractOutline(footprintJson: Record<string, unknown>): Point2d[] {
  const polygonRaw = Array.isArray(footprintJson.polygon)
    ? footprintJson.polygon
    : Array.isArray(footprintJson.vertices)
      ? footprintJson.vertices
      : null

  if (polygonRaw) {
    if (polygonRaw.length < 3) {
      throw new StairGeometryValidationError('footprint_json polygon must contain at least 3 vertices')
    }
    return polygonRaw.map((entry, index) => asPoint(entry, index))
  }

  const rect = footprintJson.rect
  if (isRecord(rect)) {
    const x = readFiniteNumber(rect.x_mm ?? 0, 'footprint_json.rect.x_mm')
    const y = readFiniteNumber(rect.y_mm ?? 0, 'footprint_json.rect.y_mm')
    const width = readPositiveNumber(rect.width_mm, 'footprint_json.rect.width_mm')
    const depth = readPositiveNumber(rect.depth_mm, 'footprint_json.rect.depth_mm')

    return [
      { x_mm: x, y_mm: y },
      { x_mm: x + width, y_mm: y },
      { x_mm: x + width, y_mm: y + depth },
      { x_mm: x, y_mm: y + depth },
    ]
  }

  throw new StairGeometryValidationError(
    'Invalid footprint_json: provide polygon/vertices or rect with width_mm and depth_mm',
  )
}

function computeBoundingBox(points: Point2d[]): Box2d {
  const xs = points.map((point) => point.x_mm)
  const ys = points.map((point) => point.y_mm)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)

  return {
    min_x_mm: roundMm(minX),
    min_y_mm: roundMm(minY),
    max_x_mm: roundMm(maxX),
    max_y_mm: roundMm(maxY),
    width_mm: roundMm(maxX - minX),
    depth_mm: roundMm(maxY - minY),
  }
}

function ensureRiseInRange(riseMm: number): void {
  if (riseMm < MIN_RISE_MM || riseMm > MAX_RISE_MM) {
    throw new StairGeometryValidationError(
      `Impossible step rise: computed rise ${roundMm(riseMm)} mm must be between ${MIN_RISE_MM} and ${MAX_RISE_MM} mm`,
    )
  }
}

function deriveStepMetrics(floorHeightMm: number, stairJson: Record<string, unknown>) {
  const stepCountInput = readOptionalPositiveInt(stairJson.step_count, 'stair_json.step_count')
  const riseInput = readOptionalPositiveNumber(stairJson.rise_mm, 'stair_json.rise_mm')

  if (stepCountInput && riseInput) {
    const expected = stepCountInput * riseInput
    if (Math.abs(expected - floorHeightMm) > 5) {
      throw new StairGeometryValidationError(
        `Impossible step count/rise: step_count * rise_mm (${roundMm(expected)} mm) does not match floor height ${roundMm(floorHeightMm)} mm`,
      )
    }

    const riseMm = floorHeightMm / stepCountInput
    ensureRiseInRange(riseMm)
    return { step_count: stepCountInput, rise_mm: roundMm(riseMm) }
  }

  if (stepCountInput) {
    const riseMm = floorHeightMm / stepCountInput
    ensureRiseInRange(riseMm)
    return { step_count: stepCountInput, rise_mm: roundMm(riseMm) }
  }

  if (riseInput) {
    const stepCount = Math.max(1, Math.round(floorHeightMm / riseInput))
    const riseMm = floorHeightMm / stepCount
    ensureRiseInRange(riseMm)
    return { step_count: stepCount, rise_mm: roundMm(riseMm) }
  }

  const defaultStepCount = Math.max(1, Math.round(floorHeightMm / 175))
  const defaultRise = floorHeightMm / defaultStepCount
  ensureRiseInRange(defaultRise)

  return { step_count: defaultStepCount, rise_mm: roundMm(defaultRise) }
}

function asKind(value: string): VerticalConnectionKind {
  if ((VERTICAL_CONNECTION_KINDS as readonly string[]).includes(value)) {
    return value as VerticalConnectionKind
  }

  throw new StairGeometryValidationError(
    `Invalid kind "${value}". Allowed values: ${VERTICAL_CONNECTION_KINDS.join(', ')}`,
  )
}

export function extractRoomIdFromFootprint(footprintJson: unknown): string | null {
  if (!isRecord(footprintJson)) return null
  const roomId = footprintJson.room_id
  if (typeof roomId !== 'string') return null

  const normalized = roomId.trim()
  return normalized.length > 0 ? normalized : null
}

export function deriveStairAndOpeningGeometry(input: StairGeometryInput): StairGeometryResult {
  const kind = asKind(input.kind)
  const fromElevation = readFiniteNumber(input.from_level_elevation_mm, 'from_level_elevation_mm')
  const toElevation = readFiniteNumber(input.to_level_elevation_mm, 'to_level_elevation_mm')

  const floorHeightMm = toElevation - fromElevation
  if (floorHeightMm <= 0) {
    throw new StairGeometryValidationError('Invalid level elevations: floor height must be greater than 0 mm')
  }

  if (!isRecord(input.footprint_json)) {
    throw new StairGeometryValidationError('footprint_json must be an object')
  }

  const footprint = input.footprint_json
  const stairSource = isRecord(input.stair_json) ? input.stair_json : {}
  const footprintOutline = extractOutline(footprint)
  const footprintBox = computeBoundingBox(footprintOutline)

  const openingMarginMm = readOptionalNonNegativeNumber(
    stairSource.opening_margin_mm,
    'stair_json.opening_margin_mm',
  ) ?? 0

  const openingOutline: Point2d[] = [
    { x_mm: footprintBox.min_x_mm - openingMarginMm, y_mm: footprintBox.min_y_mm - openingMarginMm },
    { x_mm: footprintBox.max_x_mm + openingMarginMm, y_mm: footprintBox.min_y_mm - openingMarginMm },
    { x_mm: footprintBox.max_x_mm + openingMarginMm, y_mm: footprintBox.max_y_mm + openingMarginMm },
    { x_mm: footprintBox.min_x_mm - openingMarginMm, y_mm: footprintBox.max_y_mm + openingMarginMm },
  ].map((point) => ({ x_mm: roundMm(point.x_mm), y_mm: roundMm(point.y_mm) }))

  const roomId = extractRoomIdFromFootprint(footprint)

  if (kind === 'void') {
    return {
      stair_json: {
        ...stairSource,
        kind,
        floor_height_mm: roundMm(floorHeightMm),
        step_count: 0,
        rise_mm: 0,
        tread_mm: 0,
        run_length_mm: 0,
      },
      opening_json: {
        source_kind: kind,
        floor_height_mm: roundMm(floorHeightMm),
        room_id: roomId,
        footprint_outline: footprintOutline,
        opening_outline: openingOutline,
        opening_margin_mm: openingMarginMm,
        bbox_mm: footprintBox,
      },
    }
  }

  const widthMm = readOptionalPositiveNumber(stairSource.width_mm, 'stair_json.width_mm') ?? footprintBox.width_mm
  const treadMm = readOptionalPositiveNumber(stairSource.tread_mm, 'stair_json.tread_mm') ?? 270

  if (treadMm < 150 || treadMm > 500) {
    throw new StairGeometryValidationError('stair_json.tread_mm must be between 150 and 500')
  }

  const stepMetrics = deriveStepMetrics(floorHeightMm, stairSource)
  const runLengthMm = readOptionalPositiveNumber(stairSource.run_length_mm, 'stair_json.run_length_mm')
    ?? roundMm(stepMetrics.step_count * treadMm)

  if (widthMm <= 0 || runLengthMm <= 0) {
    throw new StairGeometryValidationError('Invalid dimensions: width and run length must be greater than 0')
  }

  return {
    stair_json: {
      ...stairSource,
      kind,
      floor_height_mm: roundMm(floorHeightMm),
      width_mm: roundMm(widthMm),
      tread_mm: roundMm(treadMm),
      run_length_mm: roundMm(runLengthMm),
      step_count: stepMetrics.step_count,
      rise_mm: stepMetrics.rise_mm,
    },
    opening_json: {
      source_kind: kind,
      floor_height_mm: roundMm(floorHeightMm),
      room_id: roomId,
      footprint_outline: footprintOutline,
      opening_outline: openingOutline,
      opening_margin_mm: openingMarginMm,
      bbox_mm: {
        min_x_mm: roundMm(footprintBox.min_x_mm - openingMarginMm),
        min_y_mm: roundMm(footprintBox.min_y_mm - openingMarginMm),
        max_x_mm: roundMm(footprintBox.max_x_mm + openingMarginMm),
        max_y_mm: roundMm(footprintBox.max_y_mm + openingMarginMm),
        width_mm: roundMm(footprintBox.width_mm + openingMarginMm * 2),
        depth_mm: roundMm(footprintBox.depth_mm + openingMarginMm * 2),
      },
    },
  }
}
