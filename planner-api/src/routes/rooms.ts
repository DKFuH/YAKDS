import { randomUUID } from 'node:crypto'
import { FastifyInstance } from 'fastify'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '../db.js'
import { sendNotFound, sendBadRequest } from '../errors.js'
import { isTenantPluginEnabled } from '../plugins/tenantPluginAccess.js'

const VertexSchema = z.object({
  id: z.string().uuid(),
  x_mm: z.number(),
  y_mm: z.number(),
  index: z.number().int().min(0),
})

const WallSegmentSchema = z.object({
  id: z.string().uuid(),
  index: z.number().int().min(0),
  start_vertex_id: z.string().uuid(),
  end_vertex_id: z.string().uuid(),
})

const BoundarySchema = z.object({
  vertices: z.array(VertexSchema).max(64),
  wall_segments: z.array(WallSegmentSchema),
})

const CreateRoomSchema = z.object({
  project_id: z.string().uuid(),
  level_id: z.string().uuid().optional(),
  name: z.string().min(1).max(200),
  ceiling_height_mm: z.number().int().min(1000).max(10000).default(2500),
  boundary: BoundarySchema.default({ vertices: [], wall_segments: [] }),
})

const RoomListQuerySchema = z.object({
  level_id: z.string().uuid().optional(),
})

const UpdateRoomSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  ceiling_height_mm: z.number().int().min(1000).max(10000).optional(),
  boundary: BoundarySchema.optional(),
  ceiling_constraints: z.array(z.unknown()).optional(),
  openings: z.array(z.unknown()).optional(),
  placements: z.array(z.unknown()).optional(),
})

const ReferenceImageSchema = z.object({
  url: z.string().url(),
  x: z.number().optional(),
  y: z.number().optional(),
  rotation: z.number().min(-360).max(360).optional(),
  scale: z.number().min(0.01).max(100).optional(),
  opacity: z.number().min(0).max(1).optional(),
})

const MeasurementImportPointSchema = z.object({
  x_mm: z.number(),
  y_mm: z.number(),
})

const MeasurementImportSchema = z.object({
  segments: z.array(z.object({
    start: MeasurementImportPointSchema,
    end: MeasurementImportPointSchema,
    label: z.string().max(200).optional(),
  })).default([]),
  reference_image: ReferenceImageSchema.optional(),
})

export async function roomRoutes(app: FastifyInstance) {
  // GET /projects/:projectId/rooms
  app.get<{ Params: { projectId: string }; Querystring: { level_id?: string } }>(
    '/projects/:projectId/rooms',
    async (request, reply) => {
      const { projectId } = request.params
      const parsedQuery = RoomListQuerySchema.safeParse(request.query)
      if (!parsedQuery.success) {
        return sendBadRequest(reply, parsedQuery.error.errors[0]?.message ?? 'Invalid query')
      }

      const project = await prisma.project.findUnique({ where: { id: projectId } })
      if (!project) return sendNotFound(reply, 'Project not found')

      if (parsedQuery.data.level_id) {
        const level = await prisma.buildingLevel.findUnique({ where: { id: parsedQuery.data.level_id } })
        if (!level || level.project_id !== projectId) {
          return sendNotFound(reply, 'Level not found in project scope')
        }
      }

      const rooms = await prisma.room.findMany({
        where: {
          project_id: projectId,
          ...(parsedQuery.data.level_id ? { level_id: parsedQuery.data.level_id } : {}),
        },
        orderBy: { created_at: 'asc' },
      })

      return reply.send(rooms)
    },
  )

  // POST /rooms
  app.post('/rooms', async (request, reply) => {
    const parsed = CreateRoomSchema.safeParse(request.body)
    if (!parsed.success) return sendBadRequest(reply, parsed.error.errors[0].message)

    const { project_id, level_id, name, ceiling_height_mm, boundary } = parsed.data

    const project = await prisma.project.findUnique({ where: { id: project_id } })
    if (!project) return sendNotFound(reply, 'Project not found')

    let resolvedLevelId = level_id
    if (resolvedLevelId) {
      const level = await prisma.buildingLevel.findUnique({ where: { id: resolvedLevelId } })
      if (!level || level.project_id !== project_id) {
        return sendNotFound(reply, 'Level not found in project scope')
      }
    } else {
      const defaultLevel = await prisma.buildingLevel.findFirst({
        where: { project_id },
        orderBy: [{ order_index: 'asc' }, { created_at: 'asc' }],
      })

      if (defaultLevel) {
        resolvedLevelId = defaultLevel.id
      } else {
        const createdLevel = await prisma.buildingLevel.create({
          data: {
            tenant_id: project.tenant_id ?? request.tenantId ?? '00000000-0000-0000-0000-000000000001',
            project_id,
            name: 'EG',
            elevation_mm: 0,
            order_index: 0,
            visible: true,
            config_json: {},
          },
        })
        resolvedLevelId = createdLevel.id
      }
    }

    const room = await prisma.room.create({
      data: { project_id, level_id: resolvedLevelId, name, ceiling_height_mm, boundary: boundary as object },
    })

    return reply.status(201).send(room)
  })

  // GET /rooms/:id
  app.get<{ Params: { id: string } }>('/rooms/:id', async (request, reply) => {
    const room = await prisma.room.findUnique({ where: { id: request.params.id } })
    if (!room) return sendNotFound(reply, 'Room not found')
    return reply.send(room)
  })

  // PUT /rooms/:id
  app.put<{ Params: { id: string } }>('/rooms/:id', async (request, reply) => {
    const { id } = request.params
    const parsed = UpdateRoomSchema.safeParse(request.body)
    if (!parsed.success) return sendBadRequest(reply, parsed.error.errors[0].message)

    const existing = await prisma.room.findUnique({ where: { id } })
    if (!existing) return sendNotFound(reply, 'Room not found')

    const { boundary, ceiling_constraints, openings, placements, ...rest } = parsed.data

    const room = await prisma.room.update({
      where: { id },
      data: {
        ...rest,
        ...(boundary ? { boundary: boundary as object } : {}),
        ...(ceiling_constraints ? { ceiling_constraints: ceiling_constraints as object[] } : {}),
        ...(openings ? { openings: openings as object[] } : {}),
        ...(placements ? { placements: placements as object[] } : {}),
      },
    })

    return reply.send(room)
  })

  // POST /rooms/:id/adopt-cad-boundary
  // Konvertiert eine CAD-Polylinie in eine Raum-Boundary und speichert sie
  app.post<{ Params: { id: string } }>('/rooms/:id/adopt-cad-boundary', async (request, reply) => {
    const { id } = request.params

    const PointSchema = z.object({ x_mm: z.number(), y_mm: z.number() })
    const parsed = z.object({ points: z.array(PointSchema).min(3) }).safeParse(request.body)
    if (!parsed.success) return sendBadRequest(reply, parsed.error.errors[0].message)

    const existing = await prisma.room.findUnique({ where: { id } })
    if (!existing) return sendNotFound(reply, 'Room not found')

    // Doppelten Schlusspunkt entfernen (wenn erster == letzter Punkt)
    let pts = parsed.data.points
    const first = pts[0]
    const last = pts[pts.length - 1]
    if (first.x_mm === last.x_mm && first.y_mm === last.y_mm) {
      pts = pts.slice(0, -1)
    }
    if (pts.length < 3) return sendBadRequest(reply, 'At least 3 distinct points required')

    const vertices = pts.map((p, i) => ({
      id: randomUUID(),
      x_mm: p.x_mm,
      y_mm: p.y_mm,
      index: i,
    }))
    const wall_segments = vertices.map((v, i) => ({
      id: randomUUID(),
      index: i,
      start_vertex_id: v.id,
      end_vertex_id: vertices[(i + 1) % vertices.length].id,
    }))

    const room = await prisma.room.update({
      where: { id },
      data: { boundary: { vertices, wall_segments } as object },
    })

    return reply.send(room)
  })

  // PUT /rooms/:id/reference-image
  app.put<{ Params: { id: string } }>('/rooms/:id/reference-image', async (request, reply) => {
    const parsed = ReferenceImageSchema.safeParse(request.body)
    if (!parsed.success) return sendBadRequest(reply, parsed.error.errors[0]?.message ?? 'Invalid')

    const room = await prisma.room.findUnique({ where: { id: request.params.id } })
    if (!room) return sendNotFound(reply, 'Room not found')

    const updated = await prisma.room.update({
      where: { id: request.params.id },
      data: { reference_image: parsed.data },
    })
    return reply.send(updated)
  })

  // DELETE /rooms/:id/reference-image
  app.delete<{ Params: { id: string } }>('/rooms/:id/reference-image', async (request, reply) => {
    const room = await prisma.room.findUnique({ where: { id: request.params.id } })
    if (!room) return sendNotFound(reply, 'Room not found')

    const updated = await prisma.room.update({
      where: { id: request.params.id },
      data: { reference_image: Prisma.JsonNull },
    })
    return reply.send(updated)
  })

  // POST /rooms/:id/measurement-import
  app.post<{ Params: { id: string } }>('/rooms/:id/measurement-import', async (request, reply) => {
    const tenantId = request.tenantId
    if (!tenantId) {
      return reply.status(403).send({ error: 'FORBIDDEN', message: 'Missing tenant scope' })
    }

    const pluginEnabled = await isTenantPluginEnabled(tenantId, 'survey-import')
    if (!pluginEnabled) {
      return reply.status(403).send({ error: 'PLUGIN_DISABLED', message: 'Plugin survey-import is disabled for this tenant' })
    }

    const parsed = MeasurementImportSchema.safeParse(request.body)
    if (!parsed.success) return sendBadRequest(reply, parsed.error.errors[0]?.message ?? 'Invalid payload')

    const room = await prisma.room.findUnique({ where: { id: request.params.id } })
    if (!room) return sendNotFound(reply, 'Room not found')

    const currentRoom = room as unknown as Record<string, unknown>
    const existingMeasureLines = Array.isArray(currentRoom.measure_lines)
      ? currentRoom.measure_lines as Array<Record<string, unknown>>
      : []

    const importedMeasureLines = parsed.data.segments.map((segment) => ({
      id: randomUUID(),
      room_id: request.params.id,
      points: [segment.start, segment.end],
      label: segment.label,
      is_chain: false,
    }))

    const updated = await prisma.room.update({
      where: { id: request.params.id },
      data: {
        measure_lines: [...existingMeasureLines, ...importedMeasureLines],
        ...(parsed.data.reference_image !== undefined ? { reference_image: parsed.data.reference_image } : {}),
      } as never,
    })

    return reply.status(201).send({
      room: updated,
      imported_segments: importedMeasureLines.length,
    })
  })

  // DELETE /rooms/:id
  app.delete<{ Params: { id: string } }>('/rooms/:id', async (request, reply) => {
    const existing = await prisma.room.findUnique({ where: { id: request.params.id } })
    if (!existing) return sendNotFound(reply, 'Room not found')

    await prisma.room.delete({ where: { id: request.params.id } })
    return reply.status(204).send()
  })
}
