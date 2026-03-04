import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../db.js'
import { sendBadRequest, sendNotFound } from '../errors.js'
import { parseDwgBuffer } from '../services/interop/dwgImport.js'
import { buildDwgBuffer } from '../services/interop/dwgExport.js'
import { buildSkpRubyScript } from '../services/interop/skpExport.js'
import { arcToLineSegments, isArcWallSegment } from '../services/arcInterop.js'

const IdParamsSchema = z.object({
  id: z.string().uuid(),
})

const BatchExportQuerySchema = z.object({
  format: z.enum(['dxf', 'dwg', 'gltf', 'ifc', 'skp', 'all']).default('all'),
})

type BoundaryWall = {
  id?: string
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
}

type RoomBoundary = {
  wall_segments?: BoundaryWall[]
}

type RoomPlacement = {
  wall_id?: string
  offset_mm?: number
  width_mm?: number
  depth_mm?: number
  height_mm?: number
}

function ensureBuffer(raw: unknown): Buffer | null {
  if (Buffer.isBuffer(raw)) {
    return raw
  }

  if (raw instanceof Uint8Array) {
    return Buffer.from(raw)
  }

  return null
}

function mapRoomsForCadExport(
  rooms: Array<{ boundary: unknown; placements: unknown; ceiling_height_mm: number }>,
) {
  const wallSegments: Array<{
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
  }> = []
  const skpWallSegments: Array<{ x0_mm: number; y0_mm: number; x1_mm: number; y1_mm: number }> = []
  const dwgPlacements: Array<{ offset_mm: number; width_mm: number; depth_mm: number; wall_id: string }> = []
  const skpPlacements: Array<{ offset_mm: number; width_mm: number; depth_mm: number; height_mm?: number }> = []

  let ceilingHeight = 2600

  for (const room of rooms) {
    ceilingHeight = room.ceiling_height_mm

    const boundary = (room.boundary as RoomBoundary | null) ?? null
    const placements = (room.placements as RoomPlacement[] | null) ?? []

    const localWalls = boundary?.wall_segments ?? []

    localWalls.forEach((wall, index) => {
      const wallId = wall.id ?? `wall-${wallSegments.length + index + 1}`

      if (isArcWallSegment(wall)) {
        wallSegments.push({
          id: wallId,
          kind: 'arc',
          start: wall.start,
          end: wall.end,
          center: wall.center,
          radius_mm: wall.radius_mm,
          clockwise: wall.clockwise,
          thickness_mm: wall.thickness_mm,
        })

        const approximated = arcToLineSegments({
          id: wallId,
          kind: 'arc',
          start: wall.start,
          end: wall.end,
          center: wall.center,
          radius_mm: wall.radius_mm,
          clockwise: wall.clockwise,
          thickness_mm: wall.thickness_mm,
        })
        for (const segment of approximated) {
          skpWallSegments.push(segment)
        }
        return
      }

      if (
        typeof wall.x0_mm !== 'number' ||
        typeof wall.y0_mm !== 'number' ||
        typeof wall.x1_mm !== 'number' ||
        typeof wall.y1_mm !== 'number'
      ) {
        return
      }

      wallSegments.push({
        id: wallId,
        kind: 'line',
        x0_mm: wall.x0_mm,
        y0_mm: wall.y0_mm,
        x1_mm: wall.x1_mm,
        y1_mm: wall.y1_mm,
      })
      skpWallSegments.push({
        x0_mm: wall.x0_mm,
        y0_mm: wall.y0_mm,
        x1_mm: wall.x1_mm,
        y1_mm: wall.y1_mm,
      })
    })

    const defaultWallId = localWalls[0]?.id ?? wallSegments[wallSegments.length - 1]?.id
    for (const placement of placements) {
      dwgPlacements.push({
        wall_id: placement.wall_id ?? defaultWallId ?? '',
        offset_mm: placement.offset_mm ?? 0,
        width_mm: placement.width_mm ?? 600,
        depth_mm: placement.depth_mm ?? 560,
      })

      skpPlacements.push({
        offset_mm: placement.offset_mm ?? 0,
        width_mm: placement.width_mm ?? 600,
        depth_mm: placement.depth_mm ?? 560,
        height_mm: placement.height_mm,
      })
    }
  }

  return {
    wallSegments,
    skpWallSegments,
    dwgPlacements: dwgPlacements.filter((placement) => placement.wall_id.length > 0),
    skpPlacements,
    ceilingHeight,
  }
}

export async function cadInteropRoutes(app: FastifyInstance) {
  app.addContentTypeParser('application/octet-stream', { parseAs: 'buffer' }, (_request, payload, done) => {
    done(null, payload)
  })

  app.post<{ Params: { id: string } }>('/projects/:id/import/dwg', async (request, reply) => {
    const parsedParams = IdParamsSchema.safeParse(request.params)
    if (!parsedParams.success) {
      return sendBadRequest(reply, parsedParams.error.errors[0]?.message ?? 'Invalid project id')
    }

    const project = await prisma.project.findUnique({ where: { id: parsedParams.data.id } })
    if (!project) {
      return sendNotFound(reply, 'Project not found')
    }

    const contentType = request.headers['content-type'] ?? ''
    if (!contentType.includes('application/octet-stream')) {
      return sendBadRequest(reply, 'Expected Content-Type: application/octet-stream')
    }

    const buffer = ensureBuffer(request.body)
    if (!buffer || buffer.length < 6) {
      return sendBadRequest(reply, 'Empty file')
    }

    const filenameHeader = request.headers['x-filename']
    const filename = typeof filenameHeader === 'string' ? filenameHeader : 'upload.dxf'

    let parsedImport
    try {
      parsedImport = await parseDwgBuffer(buffer, filename)
    } catch (error) {
      return sendBadRequest(reply, `Parse error: ${String(error)}`)
    }

    if (parsedImport.wall_segments.length === 0 && !parsedImport.needs_review) {
      return sendBadRequest(reply, 'No wall segments found in file')
    }

    const room = await prisma.room.create({
      data: {
        project_id: parsedParams.data.id,
        name: `Importiert aus ${filename}`,
        ceiling_height_mm: 2600,
        boundary: { wall_segments: parsedImport.wall_segments },
        placements: [],
      },
    })

    return reply.status(201).send({
      room_id: room.id,
      wall_segments_count: parsedImport.wall_segments.length,
      arc_entities_detected: parsedImport.arc_entities_detected,
      needs_review: parsedImport.needs_review,
      warnings: parsedImport.warnings,
    })
  })

  app.post<{ Params: { id: string } }>('/alternatives/:id/export/dxf', async (request, reply) => {
    const parsedParams = IdParamsSchema.safeParse(request.params)
    if (!parsedParams.success) {
      return sendBadRequest(reply, parsedParams.error.errors[0]?.message ?? 'Invalid alternative id')
    }

    const alternative = await prisma.alternative.findUnique({
      where: { id: parsedParams.data.id },
      include: { area: { include: { project: true } } },
    })

    if (!alternative) {
      return sendNotFound(reply, 'Alternative not found')
    }

    const rooms = await prisma.room.findMany({ where: { project_id: alternative.area.project.id } })
    const { wallSegments, dwgPlacements } = mapRoomsForCadExport(rooms)

    const buffer = buildDwgBuffer({
      projectName: alternative.area.project.name,
      wall_segments: wallSegments,
      placements: dwgPlacements,
    })

    reply.header('Content-Type', 'application/dxf')
    reply.header('Content-Disposition', `attachment; filename="alternative-${parsedParams.data.id}.dxf"`)
    return reply.send(buffer)
  })

  app.post<{ Params: { id: string } }>('/alternatives/:id/export/dwg', async (request, reply) => {
    const parsedParams = IdParamsSchema.safeParse(request.params)
    if (!parsedParams.success) {
      return sendBadRequest(reply, parsedParams.error.errors[0]?.message ?? 'Invalid alternative id')
    }

    const alternative = await prisma.alternative.findUnique({
      where: { id: parsedParams.data.id },
      include: { area: { include: { project: true } } },
    })

    if (!alternative) {
      return sendNotFound(reply, 'Alternative not found')
    }

    const rooms = await prisma.room.findMany({ where: { project_id: alternative.area.project.id } })
    const { wallSegments, dwgPlacements } = mapRoomsForCadExport(rooms)

    const buffer = buildDwgBuffer({
      projectName: alternative.area.project.name,
      wall_segments: wallSegments,
      placements: dwgPlacements,
    })

    reply.header('Content-Type', 'application/dxf')
    reply.header('Content-Disposition', `attachment; filename="alternative-${parsedParams.data.id}.dxf"`)
    return reply.send(buffer)
  })

  app.post<{ Params: { id: string } }>('/alternatives/:id/export/skp', async (request, reply) => {
    const parsedParams = IdParamsSchema.safeParse(request.params)
    if (!parsedParams.success) {
      return sendBadRequest(reply, parsedParams.error.errors[0]?.message ?? 'Invalid alternative id')
    }

    const alternative = await prisma.alternative.findUnique({
      where: { id: parsedParams.data.id },
      include: { area: { include: { project: true } } },
    })

    if (!alternative) {
      return sendNotFound(reply, 'Alternative not found')
    }

    const rooms = await prisma.room.findMany({ where: { project_id: alternative.area.project.id } })
    const { skpWallSegments, skpPlacements, ceilingHeight } = mapRoomsForCadExport(rooms)

    const script = buildSkpRubyScript({
      projectName: alternative.area.project.name,
      wall_segments: skpWallSegments,
      placements: skpPlacements,
      ceiling_height_mm: ceilingHeight,
    })

    reply.header('Content-Type', 'application/ruby')
    reply.header('Content-Disposition', `attachment; filename="alternative-${parsedParams.data.id}.rb"`)
    return reply.send(script)
  })

  app.post<{ Params: { id: string }; Querystring: { format?: string } }>(
    '/alternatives/:id/export',
    async (request, reply) => {
      const parsedParams = IdParamsSchema.safeParse(request.params)
      if (!parsedParams.success) {
        return sendBadRequest(reply, parsedParams.error.errors[0]?.message ?? 'Invalid alternative id')
      }

      const parsedQuery = BatchExportQuerySchema.safeParse(request.query)
      if (!parsedQuery.success) {
        return sendBadRequest(reply, 'Invalid format parameter')
      }

      const alternative = await prisma.alternative.findUnique({
        where: { id: parsedParams.data.id },
        include: { area: { include: { project: true } } },
      })
      if (!alternative) {
        return sendNotFound(reply, 'Alternative not found')
      }

      const format = parsedQuery.data.format
      if (format === 'all') {
        return reply.send({
          formats: ['dxf', 'dwg', 'gltf', 'ifc', 'skp'],
          urls: {
            dxf: `/api/v1/alternatives/${parsedParams.data.id}/export/dxf`,
            dwg: `/api/v1/alternatives/${parsedParams.data.id}/export/dwg`,
            gltf: `/api/v1/alternatives/${parsedParams.data.id}/export/gltf`,
            ifc: `/api/v1/alternatives/${parsedParams.data.id}/export/ifc`,
            skp: `/api/v1/alternatives/${parsedParams.data.id}/export/skp`,
          },
        })
      }

      return reply.redirect(`/api/v1/alternatives/${parsedParams.data.id}/export/${format}`, 302)
    },
  )
}
