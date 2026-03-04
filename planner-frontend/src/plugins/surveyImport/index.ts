export type RoomMeasurement = {
  name: string
  width_mm: number
  depth_mm: number
  height_mm?: number
}

export type MeasurementPoint = {
  x_mm: number
  y_mm: number
}

export type MeasurementSegment = {
  start: MeasurementPoint
  end: MeasurementPoint
  label?: string
}

export function getRoomsFromMeasurements(measurements: Record<string, unknown>): RoomMeasurement[] {
  const maybeRooms = measurements.rooms
  if (!Array.isArray(maybeRooms)) {
    return []
  }

  return maybeRooms
    .filter((room): room is RoomMeasurement => {
      if (!room || typeof room !== 'object') return false
      const candidate = room as Record<string, unknown>
      return (
        typeof candidate.name === 'string'
        && typeof candidate.width_mm === 'number'
        && typeof candidate.depth_mm === 'number'
        && (candidate.height_mm === undefined || typeof candidate.height_mm === 'number')
      )
    })
}

function isMeasurementPoint(value: unknown): value is MeasurementPoint {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as Record<string, unknown>
  return typeof candidate.x_mm === 'number' && typeof candidate.y_mm === 'number'
}

export function getMeasurementSegmentsFromMeasurements(measurements: Record<string, unknown>): MeasurementSegment[] {
  const maybeSegments = measurements.segments
  if (Array.isArray(maybeSegments)) {
    const parsedSegments = maybeSegments
      .filter((segment): segment is Record<string, unknown> => !!segment && typeof segment === 'object')
      .map((segment) => {
        const start = segment.start
        const end = segment.end
        if (!isMeasurementPoint(start) || !isMeasurementPoint(end)) {
          return null
        }

        const label = typeof segment.label === 'string' ? segment.label : undefined
        return {
          start,
          end,
          ...(label ? { label } : {}),
        }
      })
      .filter((segment): segment is MeasurementSegment => segment !== null)

    if (parsedSegments.length > 0) {
      return parsedSegments
    }
  }

  const roomMeasurements = getRoomsFromMeasurements(measurements)
  const derivedSegments: MeasurementSegment[] = []
  let offsetX = 0

  roomMeasurements.forEach((room, index) => {
    const width = Math.max(1, Math.round(room.width_mm))
    const depth = Math.max(1, Math.round(room.depth_mm))
    const roomLabel = room.name.trim() || `Raum ${index + 1}`

    const p0 = { x_mm: offsetX, y_mm: 0 }
    const p1 = { x_mm: offsetX + width, y_mm: 0 }
    const p2 = { x_mm: offsetX + width, y_mm: depth }
    const p3 = { x_mm: offsetX, y_mm: depth }

    derivedSegments.push(
      { start: p0, end: p1, label: `${roomLabel} · Seite 1` },
      { start: p1, end: p2, label: `${roomLabel} · Seite 2` },
      { start: p2, end: p3, label: `${roomLabel} · Seite 3` },
      { start: p3, end: p0, label: `${roomLabel} · Seite 4` },
    )

    offsetX += width + 1000
  })

  return derivedSegments
}