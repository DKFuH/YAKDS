import { arcLengthMm, pointOnArc } from '../arcWallGeometry.js'
import { isArcWallSegment, toDxfArcEntity } from '../arcInterop.js'

export interface DwgExportOptions {
  projectName: string
  wall_segments: Array<{
    id: string
    kind?: 'line' | 'arc'
    x0_mm?: number
    y0_mm?: number
    x1_mm?: number
    y1_mm?: number
    start?: { x_mm: number; y_mm: number }
    end?: { x_mm: number; y_mm: number }
    center?: { x_mm: number; y_mm: number }
    radius_mm?: number
    clockwise?: boolean
    thickness_mm?: number
  }>
  placements: Array<{ offset_mm: number; width_mm: number; depth_mm: number; wall_id: string }>
}

/**
 * Creates an ASCII DXF payload that can be consumed by CAD tools.
 * Native DWG binary generation is intentionally out of scope.
 */
export function buildDwgBuffer(options: DwgExportOptions): Buffer {
  const lines: string[] = [
    '0\nSECTION',
    '2\nHEADER',
    '9\n$ACADVER',
    '1\nAC1015',
    '9\n$INSUNITS',
    '70\n4',
    '0\nENDSEC',
    '0\nSECTION',
    '2\nENTITIES',
  ]

  for (const segment of options.wall_segments) {
    if (isArcWallSegment(segment)) {
      const arcEntity = toDxfArcEntity({
        id: segment.id,
        kind: 'arc',
        start: segment.start,
        end: segment.end,
        center: segment.center,
        radius_mm: segment.radius_mm,
        clockwise: segment.clockwise,
        thickness_mm: segment.thickness_mm,
      })

      lines.push(
        '0\nARC',
        '8\nWALLS',
        `10\n${arcEntity.center_x_mm}`,
        `20\n${arcEntity.center_y_mm}`,
        '30\n0',
        `40\n${arcEntity.radius_mm}`,
        `50\n${arcEntity.start_angle_deg}`,
        `51\n${arcEntity.end_angle_deg}`,
      )
      continue
    }

    if (
      typeof segment.x0_mm !== 'number' ||
      typeof segment.y0_mm !== 'number' ||
      typeof segment.x1_mm !== 'number' ||
      typeof segment.y1_mm !== 'number'
    ) {
      continue
    }

    lines.push(
      '0\nLINE',
      '8\nWALLS',
      `10\n${segment.x0_mm}`,
      `20\n${segment.y0_mm}`,
      '30\n0',
      `11\n${segment.x1_mm}`,
      `21\n${segment.y1_mm}`,
      '31\n0',
    )
  }

  for (const placement of options.placements) {
    const wall = options.wall_segments.find((segment) => segment.id === placement.wall_id)
    if (!wall) {
      continue
    }

    if (isArcWallSegment(wall)) {
      const arcDef = {
        id: wall.id,
        kind: 'arc' as const,
        start: wall.start,
        end: wall.end,
        center: wall.center,
        radius_mm: wall.radius_mm,
        clockwise: wall.clockwise,
      }
      const arcLength = Math.max(1, arcLengthMm(arcDef))
      const t = Math.max(0, Math.min(1, placement.offset_mm / arcLength))
      const point = pointOnArc(arcDef, t)
      const angle = Math.atan2(point.y_mm - wall.center.y_mm, point.x_mm - wall.center.x_mm)
      const tx = wall.clockwise ? Math.sin(angle) : -Math.sin(angle)
      const ty = wall.clockwise ? -Math.cos(angle) : Math.cos(angle)

      lines.push(
        '0\nSOLID',
        '8\nFURNITURE',
        `10\n${Math.round(point.x_mm)}`,
        `20\n${Math.round(point.y_mm)}`,
        '30\n0',
        `11\n${Math.round(point.x_mm + tx * placement.width_mm)}`,
        `21\n${Math.round(point.y_mm + ty * placement.width_mm)}`,
        '31\n0',
        `12\n${Math.round(point.x_mm + tx * placement.width_mm - ty * placement.depth_mm)}`,
        `22\n${Math.round(point.y_mm + ty * placement.width_mm + tx * placement.depth_mm)}`,
        '32\n0',
        `13\n${Math.round(point.x_mm - ty * placement.depth_mm)}`,
        `23\n${Math.round(point.y_mm + tx * placement.depth_mm)}`,
        '33\n0',
      )
      continue
    }

    if (
      typeof wall.x0_mm !== 'number' ||
      typeof wall.y0_mm !== 'number' ||
      typeof wall.x1_mm !== 'number' ||
      typeof wall.y1_mm !== 'number'
    ) {
      continue
    }

    const dx = wall.x1_mm - wall.x0_mm
    const dy = wall.y1_mm - wall.y0_mm
    const length = Math.hypot(dx, dy)
    if (length === 0) {
      continue
    }

    const nx = dx / length
    const ny = dy / length
    const x = wall.x0_mm + nx * placement.offset_mm
    const y = wall.y0_mm + ny * placement.offset_mm

    lines.push(
      '0\nSOLID',
      '8\nFURNITURE',
      `10\n${Math.round(x)}`,
      `20\n${Math.round(y)}`,
      '30\n0',
      `11\n${Math.round(x + nx * placement.width_mm)}`,
      `21\n${Math.round(y + ny * placement.width_mm)}`,
      '31\n0',
      `12\n${Math.round(x + nx * placement.width_mm - ny * placement.depth_mm)}`,
      `22\n${Math.round(y + ny * placement.width_mm + nx * placement.depth_mm)}`,
      '32\n0',
      `13\n${Math.round(x - ny * placement.depth_mm)}`,
      `23\n${Math.round(y + nx * placement.depth_mm)}`,
      '33\n0',
    )
  }

  lines.push('0\nENDSEC', '0\nEOF')
  return Buffer.from(lines.join('\n'), 'utf-8')
}
