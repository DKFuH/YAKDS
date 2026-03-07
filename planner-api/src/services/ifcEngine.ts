import path from 'path'
import { pathToFileURL } from 'url'
import * as WebIFC from 'web-ifc'
import { flattenWallsToLineSegments } from './arcInterop.js'

type IfcEntityWithValue = { value?: unknown }
type IfcPointLike = Array<IfcEntityWithValue | number>

let ifcApi: WebIFC.IfcAPI | null = null

function getWasmPath(): string {
  const wasmFsPath = path.join(process.cwd(), 'node_modules', 'web-ifc')
  return `${pathToFileURL(wasmFsPath).toString()}/`
}

async function getApi(): Promise<WebIFC.IfcAPI> {
  if (ifcApi) {
    return ifcApi
  }

  const api = new WebIFC.IfcAPI()
  api.SetWasmPath(getWasmPath())
  await api.Init()
  ifcApi = api
  return api
}

export interface IfcWallSegment {
  kind?: 'line' | 'arc'
  id?: string
  x0_mm: number
  y0_mm: number
  x1_mm: number
  y1_mm: number
  start?: { x_mm: number; y_mm: number }
  end?: { x_mm: number; y_mm: number }
  center?: { x_mm: number; y_mm: number }
  radius_mm?: number
  clockwise?: boolean
  thickness_mm?: number
}

export interface IfcRoom {
  name: string
  wall_segments: IfcWallSegment[]
  ceiling_height_mm: number
}

type IfcIndexedCollection = {
  size: () => number
  get: (index: number) => number
}

function readIfcNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'object' && value !== null && 'value' in value) {
    const raw = (value as IfcEntityWithValue).value
    if (typeof raw === 'number' && Number.isFinite(raw)) {
      return raw
    }
  }

  return null
}

function toMm(value: unknown): number | null {
  const parsed = readIfcNumber(value)
  if (parsed === null) {
    return null
  }
  return Math.round(parsed * 1000)
}

function getCoordinatesFromWallLine(wallLine: unknown): IfcPointLike | null {
  if (!wallLine || typeof wallLine !== 'object') {
    return null
  }

  const line = wallLine as {
    ObjectPlacement?: {
      RelativePlacement?: {
        Location?: {
          Coordinates?: IfcPointLike
        }
      }
    }
  }

  const coordinates = line.ObjectPlacement?.RelativePlacement?.Location?.Coordinates
  if (!Array.isArray(coordinates) || coordinates.length < 2) {
    return null
  }

  return coordinates
}

function segmentTag(segment: IfcWallSegment): string {
  return [
    'WALL',
    Math.round(segment.x0_mm),
    Math.round(segment.y0_mm),
    Math.round(segment.x1_mm),
    Math.round(segment.y1_mm),
  ].join('|')
}

function parseSegmentTag(rawName: unknown): IfcWallSegment | null {
  if (typeof rawName !== 'string') {
    return null
  }

  const match = /^WALL\|(-?\d+)\|(-?\d+)\|(-?\d+)\|(-?\d+)$/.exec(rawName.trim())
  if (!match) {
    return null
  }

  const x0 = Number.parseInt(match[1] ?? '', 10)
  const y0 = Number.parseInt(match[2] ?? '', 10)
  const x1 = Number.parseInt(match[3] ?? '', 10)
  const y1 = Number.parseInt(match[4] ?? '', 10)

  if (!Number.isFinite(x0) || !Number.isFinite(y0) || !Number.isFinite(x1) || !Number.isFinite(y1)) {
    return null
  }

  return {
    x0_mm: x0,
    y0_mm: y0,
    x1_mm: x1,
    y1_mm: y1,
  }
}

function buildStepHeader(projectName: string): string[] {
  return [
    'ISO-10303-21;',
    'HEADER;',
    "FILE_DESCRIPTION(('ViewDefinition [CoordinationView_V2.0]'),'2;1');",
    `FILE_NAME('${projectName}','${new Date().toISOString()}',('OKP'),('OKP'),'OKP IFC Engine','OKP','');`,
    "FILE_SCHEMA(('IFC4'));",
    'ENDSEC;',
    'DATA;',
  ]
}

function sanitizeIfcText(value: string): string {
  return value.replace(/'/g, '')
}

function buildStepEntities(options: IfcExportOptions): string[] {
  const entities: string[] = []
  let lineNo = 1

  const next = (payload: string) => {
    entities.push(`#${lineNo}=${payload};`)
    lineNo += 1
  }

  next(`IFCPROJECT('0','$','${sanitizeIfcText(options.projectName)}',$,$,$,$,$,$)`)

  for (const room of options.rooms) {
    next(`IFCSPACE('0','$','${sanitizeIfcText(room.name)}',$,$,$,$,$,$,$)`)

    const boundaryWalls = room.boundary?.wall_segments ?? []
    const approximatedWalls = flattenWallsToLineSegments(boundaryWalls)
    for (const wall of approximatedWalls) {
      next(`IFCWALL('0','$','${segmentTag(wall)}',$,$,$,$,$)`)
    }

    for (const placement of room.placements) {
      const itemName = sanitizeIfcText(placement.article_name)
      next(`IFCFURNISHINGELEMENT('0','$','${itemName}',$,$,$,$,$)`)
    }
  }

  return entities
}

export async function parseIfcRooms(buffer: Buffer): Promise<IfcRoom[]> {
  const api = await getApi()
  const modelId = api.OpenModel(new Uint8Array(buffer))
  const rooms: IfcRoom[] = []

  try {
    const spaces = api.GetLineIDsWithType(modelId, WebIFC.IFCSPACE) as unknown as IfcIndexedCollection

    for (let index = 0; index < spaces.size(); index += 1) {
      const lineId = spaces.get(index)
      const space = api.GetLine(modelId, lineId) as { Name?: IfcEntityWithValue } | null
      const name =
        typeof space?.Name?.value === 'string' && space.Name.value.trim().length > 0
          ? space.Name.value
          : `Raum ${index + 1}`

      rooms.push({
        name,
        wall_segments: [],
        ceiling_height_mm: 2600,
      })
    }

    const walls = api.GetLineIDsWithType(modelId, WebIFC.IFCWALL) as unknown as IfcIndexedCollection

    for (let index = 0; index < walls.size(); index += 1) {
      const lineId = walls.get(index)
      const wallLine = api.GetLine(modelId, lineId, true)
      const coordinates = getCoordinatesFromWallLine(wallLine)

      let segmentFromName: IfcWallSegment | null = null
      if (!coordinates && wallLine && typeof wallLine === 'object') {
        const named = wallLine as { Name?: IfcEntityWithValue }
        segmentFromName = parseSegmentTag(named.Name?.value)
      }

      const x = coordinates ? toMm(coordinates[0]) : null
      const y = coordinates ? toMm(coordinates[1]) : null

      if (!segmentFromName && (x === null || y === null)) {
        continue
      }

      if (rooms.length === 0) {
        rooms.push({
          name: 'Raum 1',
          wall_segments: [],
          ceiling_height_mm: 2600,
        })
      }

      if (segmentFromName) {
        rooms[0].wall_segments.push(segmentFromName)
        continue
      }

      if (x !== null && y !== null) {
        rooms[0].wall_segments.push({
          x0_mm: x,
          y0_mm: y,
          x1_mm: x + 1000,
          y1_mm: y,
        })
      }
    }
  } finally {
    api.CloseModel(modelId)
  }

  return rooms
}

export interface IfcExportPlacement {
  id: string
  width_mm: number
  depth_mm: number
  height_mm: number
  article_name: string
  offset_mm: number
}

export interface IfcExportRoom {
  id: string
  name: string
  placements: IfcExportPlacement[]
  boundary: { wall_segments?: IfcWallSegment[] } | null
}

export interface IfcExportOptions {
  projectName: string
  rooms: IfcExportRoom[]
  metadata?: {
    level_id: string | null
    level_name: string | null
    section_line: {
      id: string
      label: string | null
      direction: string | null
      depth_mm: number | null
      level_scope: string | null
      level_id: string | null
      sheet_visibility: string | null
      start: { x_mm: number; y_mm: number }
      end: { x_mm: number; y_mm: number }
    } | null
  }
}

function sanitizeIfcComment(value: string): string {
  return value
    .replace(/[\r\n]+/g, ' ')
    .replace(/\*\//g, '* /')
    .trim()
}

export async function buildIfcBuffer(options: IfcExportOptions): Promise<Buffer> {
  const header = buildStepHeader(options.projectName)
  const entities = buildStepEntities(options)
  const metadataComment = options.metadata
    ? `/* ${sanitizeIfcComment(`OKP_METADATA ${JSON.stringify(options.metadata)}`)} */`
    : null
  const fileBody = [
    ...header,
    ...(metadataComment ? [metadataComment] : []),
    ...entities,
    'ENDSEC;',
    'END-ISO-10303-21;',
    '',
  ].join('\n')

  return Buffer.from(fileBody, 'utf8')
}
