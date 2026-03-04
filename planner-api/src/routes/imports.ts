import { randomUUID } from 'node:crypto'
import { FastifyInstance } from 'fastify'
import type { Prisma } from '@prisma/client'
import { z } from 'zod'
import { parseDxf } from '@okp/dxf-import'
import { parseSkp } from '@okp/skp-import'
import type { CadLayer } from '@okp/shared-schemas'
import { prisma } from '../db.js'
import { sendBadRequest, sendForbidden, sendNotFound, sendServerError } from '../errors.js'
import { registerProjectDocument } from '../services/documentRegistry.js'

const LegacyImportJobSchema = z.object({
  project_id: z.string().uuid(),
  source_format: z.enum(['dxf', 'dwg', 'skp']),
  source_filename: z.string().min(1).max(255),
})

const Base64Schema = z.string().min(1).regex(/^[A-Za-z0-9+/=]+$/)

const DxfPreviewSchema = z.object({
  source_filename: z.string().min(1).max(255),
  dxf: z.string().min(1),
})

const SkpPreviewSchema = z.object({
  source_filename: z.string().min(1).max(255),
  file_base64: Base64Schema,
})

const LayerMappingSchema = z.object({
  action: z.enum(['imported', 'ignored', 'needs_review']),
  reason: z.string().min(1).max(500).optional(),
})

const ComponentMappingSchema = z.object({
  target_type: z.enum(['cabinet', 'appliance', 'reference_object', 'ignored']),
  catalog_item_id: z.string().min(1).max(255).nullable().optional(),
  label: z.string().min(1).max(255).nullable().optional(),
})

const CadImportSchema = z
  .object({
    project_id: z.string().uuid(),
    source_filename: z.string().min(1).max(255),
    source_format: z.enum(['dxf', 'dwg']).optional(),
    dxf: z.string().min(1).optional(),
    file_base64: Base64Schema.optional(),
    layer_mapping: z.record(LayerMappingSchema).optional(),
  })
  .superRefine((value, ctx) => {
    const format = deriveCadSourceFormat(value.source_filename, value.source_format)

    if (format === 'dxf' && !value.dxf && !value.file_base64) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'DXF imports require either dxf or file_base64 payload data.',
      })
    }

    if (format === 'dwg' && !value.file_base64) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'DWG imports currently require a base64 encoded file payload.',
      })
    }
  })

const SkpImportSchema = z.object({
  project_id: z.string().uuid(),
  source_filename: z.string().min(1).max(255),
  file_base64: Base64Schema,
  component_mapping: z.record(ComponentMappingSchema).optional(),
})

const ImportJobParamsSchema = z.object({
  id: z.string().uuid(),
})

const ProjectParamsSchema = z.object({
  id: z.string().uuid(),
})

const RaumaufmassPointSchema = z.object({
  x_mm: z.number().finite(),
  y_mm: z.number().finite(),
})

const RaumaufmassWallSchema = z
  .object({
    label: z.string().min(1).max(200).optional(),
    start: RaumaufmassPointSchema.optional(),
    end: RaumaufmassPointSchema.optional(),
    length_mm: z.number().positive().optional(),
  })
  .superRefine((value, ctx) => {
    if ((value.start && !value.end) || (!value.start && value.end)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Wall start and end must be provided together.',
      })
    }

    if (!value.length_mm && !(value.start && value.end)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Wall needs either start/end coordinates or length_mm.',
      })
    }
  })

const RaumaufmassOpeningSchema = z.object({
  kind: z.enum(['door', 'window', 'opening']).optional(),
  wall_index: z.number().int().min(0).optional(),
  offset_mm: z.number().min(0).optional(),
  width_mm: z.number().positive(),
  height_mm: z.number().positive().optional(),
  sill_height_mm: z.number().min(0).optional(),
  notes: z.string().max(500).optional(),
})

const RaumaufmassReferenceSchema = z.object({
  image_url: z.string().url().optional(),
  x: z.number().optional(),
  y: z.number().optional(),
  rotation: z.number().min(-360).max(360).optional(),
  scale: z.number().min(0.01).max(100).optional(),
  opacity: z.number().min(0).max(1).optional(),
})

const RaumaufmassRoomSchema = z.object({
  external_id: z.string().min(1).max(255).optional(),
  name: z.string().min(1).max(200).optional(),
  width_mm: z.number().positive().optional(),
  depth_mm: z.number().positive().optional(),
  height_mm: z.number().positive().optional(),
  boundary: z.object({
    vertices: z.array(RaumaufmassPointSchema).min(3).max(128),
  }).optional(),
  walls: z.array(RaumaufmassWallSchema).max(256).optional(),
  openings: z.array(RaumaufmassOpeningSchema).max(256).optional(),
  reference: RaumaufmassReferenceSchema.optional(),
})

const RaumaufmassEnvelopeSchema = z
  .object({
    source_filename: z.string().min(1).max(255).optional(),
    rooms: z.array(RaumaufmassRoomSchema).optional(),
    survey: z.object({
      rooms: z.array(RaumaufmassRoomSchema).default([]),
      metadata: z.record(z.unknown()).optional(),
    }).optional(),
    metadata: z.record(z.unknown()).optional(),
  })
  .superRefine((value, ctx) => {
    const roomCount = value.rooms?.length ?? value.survey?.rooms.length ?? 0
    if (roomCount < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['rooms'],
        message: 'At least one room entry is required.',
      })
    }
  })

type RaumaufmassDiagnosticEntry = {
  code: string
  path: string
  message: string
}

type RaumaufmassDiagnostics = {
  warnings: RaumaufmassDiagnosticEntry[]
  errors: RaumaufmassDiagnosticEntry[]
}

type RaumaufmassPreviewRoom = {
  index: number
  name: string
  height_mm: number
  boundary_vertices: number
  wall_segments: number
  openings_count: number
  warning_count: number
}

type RaumaufmassPreview = {
  rooms: RaumaufmassPreviewRoom[]
  summary: {
    room_count: number
    opening_count: number
    warning_count: number
    error_count: number
  }
}

type RaumaufmassPreparedRoom = {
  name: string
  ceiling_height_mm: number
  boundary: {
    vertices: Array<{ id: string; x_mm: number; y_mm: number; index: number }>
    wall_segments: Array<{ id: string; index: number; start_vertex_id: string; end_vertex_id: string }>
  }
  openings: Array<Record<string, unknown>>
  measure_lines: Array<Record<string, unknown>>
  reference_image: Record<string, unknown> | null
}

type RaumaufmassEvaluation = {
  valid: boolean
  source_filename: string
  diagnostics: RaumaufmassDiagnostics
  preview: RaumaufmassPreview
  prepared_rooms: RaumaufmassPreparedRoom[]
}

function decodeBase64(value: string): Buffer {
  return Buffer.from(value, 'base64')
}

function nowIsoString(): string {
  return new Date().toISOString()
}

function deriveCadSourceFormat(
  sourceFilename: string,
  explicit?: 'dxf' | 'dwg',
): 'dxf' | 'dwg' {
  if (explicit) {
    return explicit
  }

  return sourceFilename.toLowerCase().endsWith('.dwg') ? 'dwg' : 'dxf'
}

function getImportMimeType(sourceFormat: 'dxf' | 'dwg' | 'skp'): string {
  if (sourceFormat === 'dxf') {
    return 'application/dxf'
  }

  if (sourceFormat === 'dwg') {
    return 'application/acad'
  }

  return 'application/octet-stream'
}

function emptyCadImportAsset(
  importJobId: string,
  sourceFilename: string,
  sourceFormat: 'dxf' | 'dwg',
  protocol: Array<{ entity_id: string | null; status: 'imported' | 'ignored' | 'needs_review'; reason: string }>,
  rawUploadBase64?: string,
) {
  return {
    id: randomUUID(),
    import_job_id: importJobId,
    source_format: sourceFormat,
    source_filename: sourceFilename,
    layers: [],
    entities: [],
    bounding_box: {
      min: { x_mm: 0, y_mm: 0 },
      max: { x_mm: 0, y_mm: 0 },
    },
    units: 'mm',
    created_at: nowIsoString(),
    protocol,
    ...(rawUploadBase64 ? { raw_upload_base64: rawUploadBase64 } : {}),
  }
}

function applyCadLayerMapping(
  asset: ReturnType<typeof parseDxf>,
  layerMapping?: Record<string, z.infer<typeof LayerMappingSchema>>,
) {
  if (!layerMapping) {
    return asset
  }

  const ignoredLayerIds = new Set(
    asset.layers
      .filter((layer) => layerMapping[layer.name]?.action === 'ignored')
      .map((layer) => layer.id),
  )

  const entities = asset.entities.filter((entity) => !ignoredLayerIds.has(entity.layer_id))
  const layers = asset.layers.map((layer) => {
    const isIgnored = layerMapping[layer.name]?.action === 'ignored'
    return {
      ...layer,
      visible: isIgnored ? false : layer.visible,
      entity_count: entities.filter((entity) => entity.layer_id === layer.id).length,
    }
  })

  const protocol = [
    ...asset.protocol,
    ...Object.entries(layerMapping).map(([layerName, entry]) => ({
      entity_id: null,
      status: entry.action,
      reason: entry.reason ?? `Layer ${layerName} marked as ${entry.action}.`,
    })),
  ]

  return {
    ...asset,
    layers,
    entities,
    protocol,
    mapping_state: {
      layers: layerMapping,
    },
  }
}

function createCadProtocol(
  asset: ReturnType<typeof applyCadLayerMapping>,
  sourceFilename: string,
) {
  if (asset.protocol.length > 0) {
    return asset.protocol
  }

  return [
    {
      entity_id: null,
      status: 'imported' as const,
      reason: `Parsed ${asset.entities.length} CAD entities from ${sourceFilename}.`,
    },
  ]
}

function applySkpComponentMapping(
  referenceModel: ReturnType<typeof parseSkp>,
  componentMapping?: Record<string, z.infer<typeof ComponentMappingSchema>>,
) {
  if (!componentMapping) {
    return referenceModel
  }

  const components = referenceModel.components.map((component) => {
    const override =
      componentMapping[component.skp_instance_guid] ?? componentMapping[component.skp_component_name]

    if (!override) {
      return component
    }

    return {
      ...component,
      mapping: {
        component_id: component.id,
        target_type: override.target_type,
        catalog_item_id: override.catalog_item_id ?? null,
        label: override.label ?? component.skp_component_name,
      },
    }
  })

  return {
    ...referenceModel,
    components,
    mapping_state: {
      components: componentMapping,
    },
  }
}

function createSkpProtocol(referenceModel: ReturnType<typeof applySkpComponentMapping>) {
  if (referenceModel.components.length === 0) {
    return [
      {
        entity_id: null,
        status: 'needs_review' as const,
        reason: 'No components were parsed from the SKP payload.',
      },
    ]
  }

  return referenceModel.components.map((component) => {
    const targetType = component.mapping?.target_type ?? 'reference_object'

    if (targetType === 'ignored') {
      return {
        entity_id: component.id,
        status: 'ignored' as const,
        reason: `Component ${component.skp_component_name} was ignored.`,
      }
    }

    if (targetType === 'reference_object') {
      return {
        entity_id: component.id,
        status: 'needs_review' as const,
        reason: `Component ${component.skp_component_name} requires manual mapping review.`,
      }
    }

    return {
      entity_id: component.id,
      status: 'imported' as const,
      reason: `Component ${component.skp_component_name} mapped as ${targetType}.`,
    }
  })
}

async function createQueuedImportJob(
  projectId: string,
  sourceFormat: 'dxf' | 'dwg' | 'skp' | 'raumaufmass_json',
  sourceFilename: string,
  fileSizeBytes: number,
) {
  const queuedJob = await prisma.importJob.create({
    data: {
      project_id: projectId,
      status: 'queued',
      source_format: sourceFormat,
      source_filename: sourceFilename,
      file_size_bytes: fileSizeBytes,
      protocol: [] as Prisma.InputJsonValue,
    },
  })

  await prisma.importJob.update({
    where: { id: queuedJob.id },
    data: { status: 'processing' },
  })

  return queuedJob
}

function pathString(parts: Array<string | number>): string {
  if (parts.length === 0) {
    return '$'
  }

  return parts.reduce<string>((acc, part) => {
    if (typeof part === 'number') {
      return `${acc}[${part}]`
    }
    return `${acc}.${part}`
  }, '$')
}

function diagnosticsFromZod(error: z.ZodError): RaumaufmassDiagnostics {
  return {
    warnings: [],
    errors: error.errors.map((issue) => ({
      code: issue.code,
      path: pathString(issue.path),
      message: issue.message,
    })),
  }
}

function createBoundaryFromVertices(vertices: Array<{ x_mm: number; y_mm: number }>) {
  const normalizedVertices = vertices.map((vertex, index) => ({
    id: randomUUID(),
    x_mm: vertex.x_mm,
    y_mm: vertex.y_mm,
    index,
  }))

  const wallSegments = normalizedVertices.map((vertex, index) => ({
    id: randomUUID(),
    index,
    start_vertex_id: vertex.id,
    end_vertex_id: normalizedVertices[(index + 1) % normalizedVertices.length].id,
  }))

  return {
    vertices: normalizedVertices,
    wall_segments: wallSegments,
  }
}

function createBoundaryFromDimensions(widthMm: number, depthMm: number) {
  return createBoundaryFromVertices([
    { x_mm: 0, y_mm: 0 },
    { x_mm: widthMm, y_mm: 0 },
    { x_mm: widthMm, y_mm: depthMm },
    { x_mm: 0, y_mm: depthMm },
  ])
}

function createMeasureLinesFromWalls(walls: z.infer<typeof RaumaufmassWallSchema>[] | undefined) {
  const warnings: RaumaufmassDiagnosticEntry[] = []
  if (!walls || walls.length === 0) {
    return {
      measure_lines: [] as Array<Record<string, unknown>>,
      warnings,
    }
  }

  let fallbackCursorX = 0
  const measureLines = walls.flatMap((wall, wallIndex) => {
    if (wall.start && wall.end) {
      return [{
        id: randomUUID(),
        room_id: null,
        points: [wall.start, wall.end],
        label: wall.label ?? `Wand ${wallIndex + 1}`,
        is_chain: false,
      }]
    }

    if (wall.length_mm) {
      const start = { x_mm: fallbackCursorX, y_mm: 0 }
      const end = { x_mm: fallbackCursorX + wall.length_mm, y_mm: 0 }
      fallbackCursorX += wall.length_mm + 100
      warnings.push({
        code: 'wall_coordinates_missing',
        path: `$.rooms[*].walls[${wallIndex}]`,
        message: 'Wall has no coordinates; generated a synthetic measure line from length_mm.',
      })
      return [{
        id: randomUUID(),
        room_id: null,
        points: [start, end],
        label: wall.label ?? `Wand ${wallIndex + 1}`,
        is_chain: false,
      }]
    }

    return []
  })

  return {
    measure_lines: measureLines,
    warnings,
  }
}

function evaluateRaumaufmassPayload(payload: unknown): RaumaufmassEvaluation {
  const parsed = RaumaufmassEnvelopeSchema.safeParse(payload)
  if (!parsed.success) {
    return {
      valid: false,
      source_filename: 'raumaufmass.json',
      diagnostics: diagnosticsFromZod(parsed.error),
      preview: {
        rooms: [],
        summary: {
          room_count: 0,
          opening_count: 0,
          warning_count: 0,
          error_count: parsed.error.errors.length,
        },
      },
      prepared_rooms: [],
    }
  }

  const rooms = parsed.data.survey?.rooms ?? parsed.data.rooms ?? []
  const warnings: RaumaufmassDiagnosticEntry[] = []
  const errors: RaumaufmassDiagnosticEntry[] = []
  const preparedRooms: RaumaufmassPreparedRoom[] = []
  const previewRooms: RaumaufmassPreviewRoom[] = []
  let openingCount = 0

  rooms.forEach((room, roomIndex) => {
    const roomPath = `$.rooms[${roomIndex}]`
    const roomWarningsStart = warnings.length

    const name = room.name?.trim() || `Raum ${roomIndex + 1}`
    if (!room.name || room.name.trim().length === 0) {
      warnings.push({
        code: 'room_name_fallback',
        path: `${roomPath}.name`,
        message: `Room name missing; fallback '${name}' applied.`,
      })
    }

    const ceilingHeight = room.height_mm ? Math.max(1000, Math.round(room.height_mm)) : 2500
    if (!room.height_mm) {
      warnings.push({
        code: 'height_defaulted',
        path: `${roomPath}.height_mm`,
        message: 'Room height missing; default 2500 mm applied.',
      })
    }

    let boundary: ReturnType<typeof createBoundaryFromVertices> | null = null
    if (room.boundary?.vertices && room.boundary.vertices.length >= 3) {
      boundary = createBoundaryFromVertices(room.boundary.vertices)
    } else if (room.width_mm && room.depth_mm) {
      boundary = createBoundaryFromDimensions(room.width_mm, room.depth_mm)
      warnings.push({
        code: 'boundary_derived_from_dimensions',
        path: `${roomPath}.boundary`,
        message: 'Boundary not provided; rectangular boundary created from width/depth.',
      })
    } else if (room.walls && room.walls.length >= 3) {
      const wallPoints = room.walls.flatMap((wall) => (wall.start && wall.end ? [wall.start, wall.end] : []))
      if (wallPoints.length >= 3) {
        const xs = wallPoints.map((point) => point.x_mm)
        const ys = wallPoints.map((point) => point.y_mm)
        const minX = Math.min(...xs)
        const maxX = Math.max(...xs)
        const minY = Math.min(...ys)
        const maxY = Math.max(...ys)

        if (maxX > minX && maxY > minY) {
          boundary = createBoundaryFromDimensions(maxX - minX, maxY - minY)
          warnings.push({
            code: 'boundary_derived_from_walls',
            path: `${roomPath}.walls`,
            message: 'Boundary derived from wall extents.',
          })
        }
      }
    }

    if (!boundary) {
      errors.push({
        code: 'room_geometry_missing',
        path: roomPath,
        message: 'Room requires boundary vertices, width/depth, or wall coordinates.',
      })
      return
    }

    const openingEntries = (room.openings ?? []).map((opening, openingIndex) => {
      if (
        opening.wall_index !== undefined
        && opening.wall_index >= boundary!.wall_segments.length
      ) {
        warnings.push({
          code: 'opening_wall_out_of_range',
          path: `${roomPath}.openings[${openingIndex}].wall_index`,
          message: 'Opening wall_index exceeds boundary wall segment count.',
        })
      }

      return {
        id: randomUUID(),
        kind: opening.kind ?? 'opening',
        wall_index: opening.wall_index ?? null,
        offset_mm: opening.offset_mm ?? null,
        width_mm: opening.width_mm,
        height_mm: opening.height_mm ?? null,
        sill_height_mm: opening.sill_height_mm ?? null,
        notes: opening.notes ?? null,
      }
    })

    openingCount += openingEntries.length
    const measureLineResult = createMeasureLinesFromWalls(room.walls)
    warnings.push(...measureLineResult.warnings.map((entry) => ({
      ...entry,
      path: entry.path.replace('$.rooms[*]', roomPath),
    })))

    const referenceImage = room.reference?.image_url
      ? {
        url: room.reference.image_url,
        x: room.reference.x ?? 50,
        y: room.reference.y ?? 50,
        rotation: room.reference.rotation ?? 0,
        scale: room.reference.scale ?? 1,
        opacity: room.reference.opacity ?? 0.5,
      }
      : null

    preparedRooms.push({
      name,
      ceiling_height_mm: ceilingHeight,
      boundary,
      openings: openingEntries,
      measure_lines: measureLineResult.measure_lines,
      reference_image: referenceImage,
    })

    previewRooms.push({
      index: roomIndex,
      name,
      height_mm: ceilingHeight,
      boundary_vertices: boundary.vertices.length,
      wall_segments: boundary.wall_segments.length,
      openings_count: openingEntries.length,
      warning_count: warnings.length - roomWarningsStart,
    })
  })

  return {
    valid: errors.length === 0,
    source_filename: parsed.data.source_filename ?? 'raumaufmass.json',
    diagnostics: {
      warnings,
      errors,
    },
    preview: {
      rooms: previewRooms,
      summary: {
        room_count: previewRooms.length,
        opening_count: openingCount,
        warning_count: warnings.length,
        error_count: errors.length,
      },
    },
    prepared_rooms: preparedRooms,
  }
}

async function finalizeImportJob(
  importJobId: string,
  importAsset: unknown,
  protocol: unknown,
) {
  return prisma.importJob.update({
    where: { id: importJobId },
    data: {
      status: 'done',
      import_asset: importAsset as Prisma.InputJsonValue,
      protocol: protocol as Prisma.InputJsonValue,
      completed_at: new Date(),
      error_message: null,
    },
  })
}

async function failImportJob(importJobId: string, error: unknown) {
  const message = error instanceof Error ? error.message : 'Import processing failed.'

  await prisma.importJob.update({
    where: { id: importJobId },
    data: {
      status: 'failed',
      error_message: message,
      completed_at: new Date(),
    },
  })

  return message
}

function getImportAssetLayers(importAsset: unknown): CadLayer[] {
  if (!importAsset || typeof importAsset !== 'object' || !('layers' in importAsset)) {
    return []
  }

  const layers = (importAsset as { layers?: unknown }).layers
  if (!Array.isArray(layers)) {
    return []
  }

  return layers.filter((layer): layer is CadLayer => {
    return (
      typeof layer === 'object' &&
      layer !== null &&
      'id' in layer &&
      'name' in layer &&
      'visible' in layer &&
      'entity_count' in layer
    )
  })
}

function getImportAssetMappingState(importAsset: unknown): Record<string, unknown> {
  if (!importAsset || typeof importAsset !== 'object' || !('mapping_state' in importAsset)) {
    return {}
  }

  const mappingState = (importAsset as { mapping_state?: unknown }).mapping_state
  if (!mappingState || typeof mappingState !== 'object' || Array.isArray(mappingState)) {
    return {}
  }

  return mappingState as Record<string, unknown>
}

function getTenantId(request: unknown): string | null {
  const scopedTenantId = (request as { tenantId?: string | null }).tenantId
  if (scopedTenantId) {
    return scopedTenantId
  }

  const header = (request as { headers?: Record<string, string | string[] | undefined> }).headers?.['x-tenant-id']
  if (!header) {
    return null
  }

  return Array.isArray(header) ? (header[0] ?? null) : header
}

async function findProjectInTenantScope(projectId: string, tenantId: string) {
  return prisma.project.findFirst({
    where: { id: projectId, tenant_id: tenantId },
    select: { id: true, tenant_id: true },
  })
}

async function findImportJobInTenantScope(importJobId: string, tenantId: string) {
  return prisma.importJob.findFirst({
    where: {
      id: importJobId,
      project: {
        tenant_id: tenantId,
      },
    },
  })
}

export async function importRoutes(app: FastifyInstance) {
  app.post('/imports/preview/dxf', async (request, reply) => {
    const parsed = DxfPreviewSchema.safeParse(request.body)
    if (!parsed.success) {
      return sendBadRequest(reply, parsed.error.errors[0].message)
    }

    return reply.send(parseDxf(parsed.data.dxf, parsed.data.source_filename))
  })

  app.post('/imports/preview/skp', async (request, reply) => {
    const parsed = SkpPreviewSchema.safeParse(request.body)
    if (!parsed.success) {
      return sendBadRequest(reply, parsed.error.errors[0].message)
    }

    return reply.send(parseSkp(decodeBase64(parsed.data.file_base64), parsed.data.source_filename))
  })

  app.post('/imports/cad', async (request, reply) => {
    const tenantId = getTenantId(request)
    if (!tenantId) {
      return sendForbidden(reply, 'Tenant scope is required')
    }

    const parsed = CadImportSchema.safeParse(request.body)
    if (!parsed.success) {
      return sendBadRequest(reply, parsed.error.errors[0].message)
    }

    const project = await findProjectInTenantScope(parsed.data.project_id, tenantId)
    if (!project) {
      return sendNotFound(reply, 'Project not found in tenant scope')
    }

    const sourceFormat = deriveCadSourceFormat(parsed.data.source_filename, parsed.data.source_format)
    const sourceBuffer =
      parsed.data.dxf !== undefined
        ? Buffer.from(parsed.data.dxf, 'utf8')
        : decodeBase64(parsed.data.file_base64 ?? '')
    const fileSizeBytes =
      parsed.data.dxf !== undefined
        ? Buffer.byteLength(parsed.data.dxf, 'utf8')
        : decodeBase64(parsed.data.file_base64 ?? '').byteLength
    const importJob = await createQueuedImportJob(
      project.id,
      sourceFormat,
      parsed.data.source_filename,
      fileSizeBytes,
    )

    try {
      let importAsset: unknown
      let protocol: unknown

      if (sourceFormat === 'dwg') {
        const dwgProtocol = [
          {
            entity_id: null,
            status: 'needs_review' as const,
            reason: 'DWG upload stored, but binary DWG parsing is not wired yet.',
          },
          ...Object.entries(parsed.data.layer_mapping ?? {}).map(([layerName, entry]) => ({
            entity_id: null,
            status: entry.action,
            reason: entry.reason ?? `Layer ${layerName} marked as ${entry.action}.`,
          })),
        ]

        importAsset = {
          ...emptyCadImportAsset(
            importJob.id,
            parsed.data.source_filename,
            'dwg',
            dwgProtocol,
            parsed.data.file_base64,
          ),
          ...(parsed.data.layer_mapping
            ? {
              mapping_state: {
                layers: parsed.data.layer_mapping,
              },
            }
            : {}),
        }
        protocol = dwgProtocol
      } else {
        const dxfString =
          parsed.data.dxf ?? decodeBase64(parsed.data.file_base64 ?? '').toString('utf8')
        const parsedAsset = parseDxf(dxfString, parsed.data.source_filename)
        const mappedAsset = applyCadLayerMapping(
          {
            ...parsedAsset,
            import_job_id: importJob.id,
            source_format: sourceFormat,
          },
          parsed.data.layer_mapping,
        )

        protocol = createCadProtocol(mappedAsset, parsed.data.source_filename)
        importAsset = {
          ...mappedAsset,
          protocol,
        }
      }

      const completedJob = await finalizeImportJob(importJob.id, importAsset, protocol)
      await registerProjectDocument({
        projectId: project.id,
        tenantId,
        filename: parsed.data.source_filename,
        originalFilename: parsed.data.source_filename,
        mimeType: getImportMimeType(sourceFormat),
        uploadedBy: 'system:import',
        type: 'cad_import',
        tags: ['import', sourceFormat],
        sourceKind: 'import_job',
        sourceId: importJob.id,
        buffer: sourceBuffer,
      })
      return reply.status(201).send(completedJob)
    } catch (error) {
      const message = await failImportJob(importJob.id, error)
      return sendServerError(reply, message)
    }
  })

  app.post('/imports/skp', async (request, reply) => {
    const tenantId = getTenantId(request)
    if (!tenantId) {
      return sendForbidden(reply, 'Tenant scope is required')
    }

    const parsed = SkpImportSchema.safeParse(request.body)
    if (!parsed.success) {
      return sendBadRequest(reply, parsed.error.errors[0].message)
    }

    const project = await findProjectInTenantScope(parsed.data.project_id, tenantId)
    if (!project) {
      return sendNotFound(reply, 'Project not found in tenant scope')
    }

    const fileBuffer = decodeBase64(parsed.data.file_base64)
    const importJob = await createQueuedImportJob(
      project.id,
      'skp',
      parsed.data.source_filename,
      fileBuffer.byteLength,
    )

    try {
      const parsedModel = parseSkp(fileBuffer, parsed.data.source_filename)
      const mappedModel = applySkpComponentMapping(
        {
          ...parsedModel,
          project_id: project.id,
          import_job_id: importJob.id,
        },
        parsed.data.component_mapping,
      )
      const protocol = createSkpProtocol(mappedModel)
      const completedJob = await finalizeImportJob(importJob.id, mappedModel, protocol)
      await registerProjectDocument({
        projectId: project.id,
        tenantId,
        filename: parsed.data.source_filename,
        originalFilename: parsed.data.source_filename,
        mimeType: getImportMimeType('skp'),
        uploadedBy: 'system:import',
        type: 'cad_import',
        tags: ['import', 'skp'],
        sourceKind: 'import_job',
        sourceId: importJob.id,
        buffer: fileBuffer,
      })

      return reply.status(201).send(completedJob)
    } catch (error) {
      const message = await failImportJob(importJob.id, error)
      return sendServerError(reply, message)
    }
  })

  app.get('/imports/:id', async (request, reply) => {
    const tenantId = getTenantId(request)
    if (!tenantId) {
      return sendForbidden(reply, 'Tenant scope is required')
    }

    const parsed = ImportJobParamsSchema.safeParse(request.params)
    if (!parsed.success) {
      return sendBadRequest(reply, parsed.error.errors[0].message)
    }

    const importJob = await findImportJobInTenantScope(parsed.data.id, tenantId)
    if (!importJob) {
      return sendNotFound(reply, 'Import job not found in tenant scope')
    }

    return reply.send(importJob)
  })

  app.get('/imports/:id/layers', async (request, reply) => {
    const tenantId = getTenantId(request)
    if (!tenantId) {
      return sendForbidden(reply, 'Tenant scope is required')
    }

    const parsed = ImportJobParamsSchema.safeParse(request.params)
    if (!parsed.success) {
      return sendBadRequest(reply, parsed.error.errors[0].message)
    }

    const importJob = await findImportJobInTenantScope(parsed.data.id, tenantId)
    if (!importJob) {
      return sendNotFound(reply, 'Import job not found in tenant scope')
    }

    if (!importJob.import_asset) {
      return reply.status(409).send({
        error: 'IMPORT_ASSET_NOT_READY',
        message: 'Import asset is not available yet.',
      })
    }

    return reply.send(getImportAssetLayers(importJob.import_asset))
  })

  app.get('/imports/:id/mapping-state', async (request, reply) => {
    const tenantId = getTenantId(request)
    if (!tenantId) {
      return sendForbidden(reply, 'Tenant scope is required')
    }

    const parsed = ImportJobParamsSchema.safeParse(request.params)
    if (!parsed.success) {
      return sendBadRequest(reply, parsed.error.errors[0].message)
    }

    const importJob = await findImportJobInTenantScope(parsed.data.id, tenantId)
    if (!importJob) {
      return sendNotFound(reply, 'Import job not found in tenant scope')
    }

    if (!importJob.import_asset) {
      return reply.status(409).send({
        error: 'IMPORT_ASSET_NOT_READY',
        message: 'Import asset is not available yet.',
      })
    }

    return reply.send(getImportAssetMappingState(importJob.import_asset))
  })

  app.post<{ Params: { id: string } }>('/projects/:id/validate/raumaufmass', async (request, reply) => {
    const tenantId = getTenantId(request)
    if (!tenantId) {
      return sendForbidden(reply, 'Tenant scope is required')
    }

    const parsedParams = ProjectParamsSchema.safeParse(request.params)
    if (!parsedParams.success) {
      return sendBadRequest(reply, parsedParams.error.errors[0].message)
    }

    const project = await findProjectInTenantScope(parsedParams.data.id, tenantId)
    if (!project) {
      return sendNotFound(reply, 'Project not found in tenant scope')
    }

    const evaluation = evaluateRaumaufmassPayload(request.body)
    return reply.send(evaluation)
  })

  app.post<{ Params: { id: string } }>('/projects/:id/import/raumaufmass', async (request, reply) => {
    const tenantId = getTenantId(request)
    if (!tenantId) {
      return sendForbidden(reply, 'Tenant scope is required')
    }

    const parsedParams = ProjectParamsSchema.safeParse(request.params)
    if (!parsedParams.success) {
      return sendBadRequest(reply, parsedParams.error.errors[0].message)
    }

    const project = await findProjectInTenantScope(parsedParams.data.id, tenantId)
    if (!project) {
      return sendNotFound(reply, 'Project not found in tenant scope')
    }

    const evaluation = evaluateRaumaufmassPayload(request.body)
    if (!evaluation.valid) {
      return reply.status(400).send(evaluation)
    }

    const sourceBuffer = Buffer.from(JSON.stringify(request.body ?? {}), 'utf8')
    const importJob = await createQueuedImportJob(
      project.id,
      'raumaufmass_json',
      evaluation.source_filename,
      sourceBuffer.byteLength,
    )

    try {
      const createdRooms = [] as Array<{ id: string }>

      for (const preparedRoom of evaluation.prepared_rooms) {
        const room = await prisma.room.create({
          data: {
            project_id: project.id,
            name: preparedRoom.name,
            ceiling_height_mm: preparedRoom.ceiling_height_mm,
            boundary: preparedRoom.boundary as Prisma.InputJsonValue,
            openings: preparedRoom.openings as Prisma.InputJsonValue,
            measure_lines: preparedRoom.measure_lines as Prisma.InputJsonValue,
            ...(preparedRoom.reference_image
              ? { reference_image: preparedRoom.reference_image as Prisma.InputJsonValue }
              : {}),
          },
          select: { id: true },
        })

        createdRooms.push(room)
      }

      const protocol = [
        {
          entity_id: null,
          status: 'imported' as const,
          reason: `Imported ${createdRooms.length} room(s) from ${evaluation.source_filename}.`,
        },
        ...evaluation.diagnostics.warnings.map((warning) => ({
          entity_id: null,
          status: 'needs_review' as const,
          reason: `${warning.path}: ${warning.message}`,
        })),
      ]

      const importAsset = {
        id: randomUUID(),
        import_job_id: importJob.id,
        source_format: 'raumaufmass_json',
        source_filename: evaluation.source_filename,
        created_at: nowIsoString(),
        diagnostics: evaluation.diagnostics,
        preview: evaluation.preview,
        imported_room_ids: createdRooms.map((room) => room.id),
      }

      const completedJob = await finalizeImportJob(importJob.id, importAsset, protocol)

      await registerProjectDocument({
        projectId: project.id,
        tenantId,
        filename: evaluation.source_filename,
        originalFilename: evaluation.source_filename,
        mimeType: 'application/json',
        uploadedBy: 'system:raumaufmass-import',
        type: 'cad_import',
        tags: ['import', 'raumaufmass', 'json'],
        sourceKind: 'import_job',
        sourceId: importJob.id,
        buffer: sourceBuffer,
      })

      return reply.status(201).send({
        job_id: completedJob.id,
        imported_rooms: createdRooms.length,
        room_ids: createdRooms.map((room) => room.id),
        diagnostics: evaluation.diagnostics,
        preview: evaluation.preview,
      })
    } catch (error) {
      const message = await failImportJob(importJob.id, error)
      return sendServerError(reply, message)
    }
  })

  app.get<{ Params: { id: string } }>('/projects/:id/raumaufmass-jobs', async (request, reply) => {
    const tenantId = getTenantId(request)
    if (!tenantId) {
      return sendForbidden(reply, 'Tenant scope is required')
    }

    const parsedParams = ProjectParamsSchema.safeParse(request.params)
    if (!parsedParams.success) {
      return sendBadRequest(reply, parsedParams.error.errors[0].message)
    }

    const project = await findProjectInTenantScope(parsedParams.data.id, tenantId)
    if (!project) {
      return sendNotFound(reply, 'Project not found in tenant scope')
    }

    const jobs = await prisma.importJob.findMany({
      where: {
        project_id: project.id,
        source_format: 'raumaufmass_json',
      },
      orderBy: {
        created_at: 'desc',
      },
    })

    return reply.send(jobs)
  })

  app.post('/imports', async (request, reply) => {
    const parsed = LegacyImportJobSchema.safeParse(request.body)
    if (!parsed.success) {
      return sendBadRequest(reply, parsed.error.errors[0].message)
    }

    return sendBadRequest(
      reply,
      `Use /imports/${parsed.data.source_format === 'skp' ? 'skp' : 'cad'} for concrete import jobs.`,
    )
  })
}
