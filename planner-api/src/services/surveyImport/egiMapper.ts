import { randomUUID } from 'node:crypto'
import type { EgiSection, ParsedEgiFile } from './egiParser.js'
import { parseEgiNumber } from './egiParser.js'

export type EgiWarning = {
  code: string
  section: string
  message: string
}

export type EgiSummary = {
  walls: number
  roofs: number
  windows: number
  doors: number
  hindrances: number
  installations: number
}

export type EgiPreview = {
  room_height_mm: number
}

export type EgiMappedWall = {
  id: string
  section: string
  start: { x_mm: number; y_mm: number; z_mm: number }
  end: { x_mm: number; y_mm: number; z_mm: number }
  thickness_mm: number | null
  angle_deg: number
}

export type EgiMappedOpening = {
  id: string
  kind: 'window' | 'door'
  section: string
  wall_index: number | null
  wall_ref_no: number | null
  width_mm: number
  height_mm: number | null
  offset_mm: number | null
  hinge: string | null
  opening: string | null
}

export type EgiMappedRoof = {
  id: string
  section: string
  kind: 'roof_slope'
  wall_index: number | null
  angle_deg: number | null
  depth_mm: number | null
  height_mm: number | null
}

export type EgiMappedObstacle = {
  id: string
  section: string
  kind: 'hindrance' | 'recess' | 'radiator'
  obstacle_type: string
  x_mm: number | null
  y_mm: number | null
  z_mm: number | null
  width_mm: number | null
  height_mm: number | null
  depth_mm: number | null
  wall_index: number | null
}

export type EgiMappedInstallation = {
  id: string
  section: string
  kind: 'installation'
  type: string
  category: 'water-cold' | 'water-drain' | 'electrical_outlet' | 'custom'
  x_mm: number | null
  y_mm: number | null
  z_mm: number | null
  wall_index: number | null
}

export type EgiMapResult = {
  format: 'egi'
  summary: EgiSummary
  warnings: EgiWarning[]
  preview: EgiPreview
  usable: boolean
  mapped: {
    room_height_mm: number
    walls: EgiMappedWall[]
    boundary_vertices: Array<{ x_mm: number; y_mm: number }>
    openings: EgiMappedOpening[]
    roofs: EgiMappedRoof[]
    obstacles: EgiMappedObstacle[]
    installations: EgiMappedInstallation[]
    measure_lines: Array<{
      id: string
      points: Array<{ x_mm: number; y_mm: number }>
      label: string
      is_chain: false
    }>
  }
}

function findField(section: EgiSection, ...candidates: string[]): string | null {
  const lowered = new Map<string, string>()
  for (const [key, value] of Object.entries(section.fields)) {
    lowered.set(key.toLowerCase(), value)
  }

  for (const candidate of candidates) {
    const found = lowered.get(candidate.toLowerCase())
    if (typeof found === 'string') {
      return found
    }
  }

  return null
}

function fieldNumber(section: EgiSection, ...candidates: string[]): number | null {
  const raw = findField(section, ...candidates)
  return parseEgiNumber(raw)
}

function fieldString(section: EgiSection, ...candidates: string[]): string | null {
  const raw = findField(section, ...candidates)
  if (!raw) return null
  const trimmed = raw.trim()
  return trimmed.length > 0 ? trimmed : null
}

function toWallIndex(wallRefNo: number | null, wallCount: number): number | null {
  if (wallRefNo === null) {
    return null
  }

  const normalized = Math.round(wallRefNo) - 1
  if (normalized < 0 || normalized >= wallCount) {
    return null
  }

  return normalized
}

function createBoundaryVertices(walls: EgiMappedWall[]): Array<{ x_mm: number; y_mm: number }> {
  if (walls.length >= 3) {
    return walls.map((wall) => ({ x_mm: wall.start.x_mm, y_mm: wall.start.y_mm }))
  }

  if (walls.length === 0) {
    return []
  }

  const points = walls.flatMap((wall) => [wall.start, wall.end])
  const xs = points.map((point) => point.x_mm)
  const ys = points.map((point) => point.y_mm)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)

  if (minX === maxX || minY === maxY) {
    return []
  }

  return [
    { x_mm: minX, y_mm: minY },
    { x_mm: maxX, y_mm: minY },
    { x_mm: maxX, y_mm: maxY },
    { x_mm: minX, y_mm: maxY },
  ]
}

function mapInstallationCategory(value: string | null): 'water-cold' | 'water-drain' | 'electrical_outlet' | 'custom' {
  const normalized = (value ?? '').trim().toLowerCase()
  if (normalized === 'water-cold' || normalized === 'watercold' || normalized === 'cold_water') return 'water-cold'
  if (normalized === 'water-drain' || normalized === 'drain' || normalized === 'waste_water') return 'water-drain'
  if (normalized === 'electrical_outlet' || normalized === 'socket' || normalized === 'power') return 'electrical_outlet'
  return 'custom'
}

function buildWalls(parsed: ParsedEgiFile, warnings: EgiWarning[]): EgiMappedWall[] {
  const walls: EgiMappedWall[] = []
  let previousEnd: { x_mm: number; y_mm: number; z_mm: number } | null = null

  for (const section of parsed.grouped.wall) {
    const lengthMm = fieldNumber(section, 'Width', 'Length')
    if (lengthMm === null || lengthMm <= 0) {
      warnings.push({
        code: 'WALL_LENGTH_MISSING',
        section: section.name,
        message: `Wall-Sektion ${section.name} ohne gültige Width/Length ignoriert.`,
      })
      continue
    }

    const x = fieldNumber(section, 'RefPntX')
    const y = fieldNumber(section, 'RefPntY')
    const z = fieldNumber(section, 'RefPntZ') ?? 0
    const start: { x_mm: number; y_mm: number; z_mm: number } | null = (
      x !== null && y !== null
        ? { x_mm: x, y_mm: y, z_mm: z }
        : previousEnd
    )

    if (!start) {
      warnings.push({
        code: 'WALL_START_MISSING',
        section: section.name,
        message: `Wall-Sektion ${section.name} ohne Startpunkt und ohne ableitbaren Vorgänger.`,
      })
      continue
    }

    const angleDeg = fieldNumber(section, 'AngleZ') ?? 0
    const angleRad = (angleDeg * Math.PI) / 180
    const end: { x_mm: number; y_mm: number; z_mm: number } = {
      x_mm: start.x_mm + Math.cos(angleRad) * lengthMm,
      y_mm: start.y_mm + Math.sin(angleRad) * lengthMm,
      z_mm: start.z_mm,
    }

    walls.push({
      id: randomUUID(),
      section: section.name,
      start,
      end,
      thickness_mm: fieldNumber(section, 'Depth'),
      angle_deg: angleDeg,
    })

    previousEnd = end
  }

  return walls
}

function buildOpenings(parsed: ParsedEgiFile, wallCount: number, warnings: EgiWarning[]): EgiMappedOpening[] {
  const openings: EgiMappedOpening[] = []

  const process = (section: EgiSection, kind: 'window' | 'door') => {
    const widthMm = fieldNumber(section, 'Width')
    if (widthMm === null || widthMm <= 0) {
      warnings.push({
        code: 'OPENING_WIDTH_MISSING',
        section: section.name,
        message: `${kind} ${section.name} ohne gültige Width ignoriert.`,
      })
      return
    }

    const wallRefNo = fieldNumber(section, 'WallRefNo')
    const wallIndex = toWallIndex(wallRefNo, wallCount)
    if (wallRefNo !== null && wallIndex === null) {
      warnings.push({
        code: 'OPENING_WALL_REF_INVALID',
        section: section.name,
        message: `${kind} ${section.name} referenziert ungültige WallRefNo ${wallRefNo}.`,
      })
    }

    openings.push({
      id: randomUUID(),
      kind,
      section: section.name,
      wall_index: wallIndex,
      wall_ref_no: wallRefNo,
      width_mm: widthMm,
      height_mm: fieldNumber(section, 'Height'),
      offset_mm: fieldNumber(section, 'Offset', 'RefPntX'),
      hinge: fieldString(section, 'Hinge'),
      opening: fieldString(section, 'Opening'),
    })
  }

  for (const section of parsed.grouped.window) {
    process(section, 'window')
  }

  for (const section of parsed.grouped.door) {
    process(section, 'door')
  }

  return openings
}

function buildRoofs(parsed: ParsedEgiFile, wallCount: number): EgiMappedRoof[] {
  return parsed.grouped.roof.map((section) => {
    const wallRefNo = fieldNumber(section, 'WallRefNo')
    return {
      id: randomUUID(),
      section: section.name,
      kind: 'roof_slope',
      wall_index: toWallIndex(wallRefNo, wallCount),
      angle_deg: fieldNumber(section, 'AngleZ'),
      depth_mm: fieldNumber(section, 'Depth', 'Width'),
      height_mm: fieldNumber(section, 'Height'),
    }
  })
}

function buildObstacles(parsed: ParsedEgiFile, wallCount: number): EgiMappedObstacle[] {
  const mapSection = (
    section: EgiSection,
    kind: 'hindrance' | 'recess' | 'radiator',
  ): EgiMappedObstacle => {
    const wallRefNo = fieldNumber(section, 'WallRefNo')
    return {
      id: randomUUID(),
      section: section.name,
      kind,
      obstacle_type: fieldString(section, 'Type') ?? kind,
      x_mm: fieldNumber(section, 'RefPntX'),
      y_mm: fieldNumber(section, 'RefPntY'),
      z_mm: fieldNumber(section, 'RefPntZ'),
      width_mm: fieldNumber(section, 'Width'),
      height_mm: fieldNumber(section, 'Height'),
      depth_mm: fieldNumber(section, 'Depth'),
      wall_index: toWallIndex(wallRefNo, wallCount),
    }
  }

  return [
    ...parsed.grouped.hindrance.map((section) => mapSection(section, 'hindrance')),
    ...parsed.grouped.recess.map((section) => mapSection(section, 'recess')),
    ...parsed.grouped.radiator.map((section) => mapSection(section, 'radiator')),
  ]
}

function buildInstallations(parsed: ParsedEgiFile, wallCount: number, warnings: EgiWarning[]): EgiMappedInstallation[] {
  return parsed.grouped.cs_installation.map((section) => {
    const rawType = fieldString(section, 'Type')
    const category = mapInstallationCategory(rawType)
    if (category === 'custom') {
      warnings.push({
        code: 'INSTALLATION_TYPE_UNKNOWN',
        section: section.name,
        message: `CS_Installation-Typ ${rawType ?? '(leer)'} wird als custom übernommen.`,
      })
    }

    const wallRefNo = fieldNumber(section, 'WallRefNo')
    return {
      id: randomUUID(),
      section: section.name,
      kind: 'installation',
      type: rawType ?? 'custom',
      category,
      x_mm: fieldNumber(section, 'RefPntX'),
      y_mm: fieldNumber(section, 'RefPntY'),
      z_mm: fieldNumber(section, 'RefPntZ'),
      wall_index: toWallIndex(wallRefNo, wallCount),
    }
  })
}

export function mapEgi(parsed: ParsedEgiFile): EgiMapResult {
  const warnings: EgiWarning[] = parsed.warnings.map((message) => ({
    code: 'PARSER_WARNING',
    section: 'FILE',
    message,
  }))

  const summary: EgiSummary = {
    walls: parsed.grouped.wall.length,
    roofs: parsed.grouped.roof.length,
    windows: parsed.grouped.window.length,
    doors: parsed.grouped.door.length,
    hindrances: parsed.grouped.hindrance.length + parsed.grouped.recess.length + parsed.grouped.radiator.length,
    installations: parsed.grouped.cs_installation.length,
  }

  const roomHeightRaw = parsed.grouped.global[0]
    ? fieldNumber(parsed.grouped.global[0], 'Roomheight')
    : null

  const roomHeight = roomHeightRaw && roomHeightRaw > 0 ? roomHeightRaw : 2500
  if (!roomHeightRaw || roomHeightRaw <= 0) {
    warnings.push({
      code: 'ROOM_HEIGHT_DEFAULTED',
      section: parsed.grouped.global[0]?.name ?? 'GLOBAL',
      message: 'Roomheight fehlt oder ist ungültig; Default 2500 mm wird verwendet.',
    })
  }

  const walls = buildWalls(parsed, warnings)
  const boundaryVertices = createBoundaryVertices(walls)
  if (walls.length > 0 && boundaryVertices.length < 3) {
    warnings.push({
      code: 'BOUNDARY_DERIVATION_FAILED',
      section: 'WALLS',
      message: 'Aus den Wall-Sektionen konnte keine geschlossene Raumgrenze abgeleitet werden.',
    })
  }

  const openings = buildOpenings(parsed, walls.length, warnings)
  const roofs = buildRoofs(parsed, walls.length)
  const obstacles = buildObstacles(parsed, walls.length)
  const installations = buildInstallations(parsed, walls.length, warnings)

  const measureLines = walls.map((wall, index) => ({
    id: randomUUID(),
    points: [
      { x_mm: wall.start.x_mm, y_mm: wall.start.y_mm },
      { x_mm: wall.end.x_mm, y_mm: wall.end.y_mm },
    ],
    label: `Wall ${index + 1}`,
    is_chain: false as const,
  }))

  const usable = (
    summary.walls
    + summary.windows
    + summary.doors
    + summary.roofs
    + summary.hindrances
    + summary.installations
  ) > 0

  return {
    format: 'egi',
    summary,
    warnings,
    preview: {
      room_height_mm: roomHeight,
    },
    usable,
    mapped: {
      room_height_mm: roomHeight,
      walls,
      boundary_vertices: boundaryVertices,
      openings,
      roofs,
      obstacles,
      installations,
      measure_lines: measureLines,
    },
  }
}
