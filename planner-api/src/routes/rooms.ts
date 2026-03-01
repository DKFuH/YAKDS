import { randomUUID } from 'node:crypto'
import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../db.js'
import { sendNotFound, sendBadRequest } from '../errors.js'

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
  vertices: z.array(VertexSchema).min(3).max(64),
  wall_segments: z.array(WallSegmentSchema),
})

const CreateRoomSchema = z.object({
  project_id: z.string().uuid(),
  name: z.string().min(1).max(200),
  ceiling_height_mm: z.number().int().min(1000).max(10000).default(2500),
  boundary: BoundarySchema,
})

const UpdateRoomSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  ceiling_height_mm: z.number().int().min(1000).max(10000).optional(),
  boundary: BoundarySchema.optional(),
  ceiling_constraints: z.array(z.unknown()).optional(),
  openings: z.array(z.unknown()).optional(),
  placements: z.array(z.unknown()).optional(),
})

export async function roomRoutes(app: FastifyInstance) {
  // GET /projects/:projectId/rooms
  app.get<{ Params: { projectId: string } }>(
    '/projects/:projectId/rooms',
    async (request, reply) => {
      const { projectId } = request.params

      const project = await prisma.project.findUnique({ where: { id: projectId } })
      if (!project) return sendNotFound(reply, 'Project not found')

      const rooms = await prisma.room.findMany({
        where: { project_id: projectId },
        orderBy: { created_at: 'asc' },
      })

      return reply.send(rooms)
    },
  )

  // POST /rooms
  app.post('/rooms', async (request, reply) => {
    const parsed = CreateRoomSchema.safeParse(request.body)
    if (!parsed.success) return sendBadRequest(reply, parsed.error.errors[0].message)

    const { project_id, name, ceiling_height_mm, boundary } = parsed.data

    const project = await prisma.project.findUnique({ where: { id: project_id } })
    if (!project) return sendNotFound(reply, 'Project not found')

    const room = await prisma.room.create({
      data: { project_id, name, ceiling_height_mm, boundary: boundary as object },
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

  // DELETE /rooms/:id
  app.delete<{ Params: { id: string } }>('/rooms/:id', async (request, reply) => {
    const existing = await prisma.room.findUnique({ where: { id: request.params.id } })
    if (!existing) return sendNotFound(reply, 'Room not found')

    await prisma.room.delete({ where: { id: request.params.id } })
    return reply.status(204).send()
  })
}
