import { randomUUID } from 'node:crypto'
import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../db.js'
import { sendNotFound, sendBadRequest } from '../errors.js'

type RoomJson = Record<string, unknown>

const PointSchema = z.object({ x_mm: z.number(), y_mm: z.number() })

const RoomSurfaceColorSchema = z.object({
  surface: z.enum(['floor', 'ceiling', 'wall_north', 'wall_south', 'wall_east', 'wall_west']),
  color_hex: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  material_id: z.string().optional(),
  texture_url: z.string().url().optional(),
})

const RoomColoringSchema = z.object({
  surfaces: z.array(RoomSurfaceColorSchema),
})

const DecoObjectSchema = z.object({
  id: z.string().uuid().default(() => randomUUID()),
  catalog_item_id: z.string().min(1),
  position: PointSchema,
  rotation_deg: z.number().min(0).max(360),
  width_mm: z.number().positive().optional(),
  height_mm: z.number().positive().optional(),
  depth_mm: z.number().positive().optional(),
})

export async function roomDecorationRoutes(app: FastifyInstance) {
  // GET /rooms/:id/coloring
  app.get<{ Params: { id: string } }>('/rooms/:id/coloring', async (request, reply) => {
    const room = await prisma.room.findUnique({ where: { id: request.params.id } })
    if (!room) return sendNotFound(reply, 'Room not found')
    return reply.send(((room as unknown as RoomJson).coloring as object) ?? { surfaces: [] })
  })

  // PUT /rooms/:id/coloring
  app.put<{ Params: { id: string } }>('/rooms/:id/coloring', async (request, reply) => {
    const parsed = RoomColoringSchema.safeParse(request.body)
    if (!parsed.success) return sendBadRequest(reply, parsed.error.errors[0].message)
    const room = await prisma.room.findUnique({ where: { id: request.params.id } })
    if (!room) return sendNotFound(reply, 'Room not found')
    await prisma.room.update({ where: { id: request.params.id }, data: { coloring: parsed.data } as any })
    return reply.send(parsed.data)
  })

  // GET /rooms/:id/deco-objects
  app.get<{ Params: { id: string } }>('/rooms/:id/deco-objects', async (request, reply) => {
    const room = await prisma.room.findUnique({ where: { id: request.params.id } })
    if (!room) return sendNotFound(reply, 'Room not found')
    return reply.send(((room as unknown as RoomJson).deco_objects as unknown[]) ?? [])
  })

  // POST /rooms/:id/deco-objects
  app.post<{ Params: { id: string } }>('/rooms/:id/deco-objects', async (request, reply) => {
    const parsed = DecoObjectSchema.safeParse(request.body)
    if (!parsed.success) return sendBadRequest(reply, parsed.error.errors[0].message)
    const room = await prisma.room.findUnique({ where: { id: request.params.id } })
    if (!room) return sendNotFound(reply, 'Room not found')
    const existing = ((room as unknown as RoomJson).deco_objects as unknown[]) ?? []
    const newObj = { ...parsed.data, room_id: request.params.id }
    await prisma.room.update({ where: { id: request.params.id }, data: { deco_objects: [...existing, newObj] } as any })
    return reply.status(201).send(newObj)
  })

  // DELETE /rooms/:id/deco-objects/:decoId
  app.delete<{ Params: { id: string; decoId: string } }>(
    '/rooms/:id/deco-objects/:decoId',
    async (request, reply) => {
      const room = await prisma.room.findUnique({ where: { id: request.params.id } })
      if (!room) return sendNotFound(reply, 'Room not found')
      const existing = ((room as unknown as RoomJson).deco_objects as Array<{ id: string }>) ?? []
      await prisma.room.update({ where: { id: request.params.id }, data: { deco_objects: existing.filter(o => o.id !== request.params.decoId) } as any })
      return reply.status(204).send()
    },
  )
}
