import { randomUUID } from 'node:crypto'
import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../db.js'
import { sendNotFound, sendBadRequest } from '../errors.js'

const MAX_LIGHTS_PER_PROFILE = 50

type RoomJson = Record<string, unknown>

const Point3DSchema = z.object({ x_mm: z.number(), y_mm: z.number(), z_mm: z.number() })

const LightSourceSchema = z.object({
  id: z.string().uuid().default(() => randomUUID()),
  type: z.enum(['general', 'spotlights', 'ambient', 'task']),
  position: Point3DSchema,
  intensity: z.number().min(0).max(100000),
  color_temp_k: z.number().min(1000).max(10000).optional(),
})

const LightingProfileSchema = z.object({
  id: z.string().uuid().default(() => randomUUID()),
  name: z.string().min(1).max(200),
  lights: z.array(LightSourceSchema).max(MAX_LIGHTS_PER_PROFILE),
})

export async function lightingRoutes(app: FastifyInstance) {
  // GET /rooms/:id/lighting-profiles
  app.get<{ Params: { id: string } }>('/rooms/:id/lighting-profiles', async (request, reply) => {
    const room = await prisma.room.findUnique({ where: { id: request.params.id } })
    if (!room) return sendNotFound(reply, 'Room not found')
    return reply.send(((room as unknown as RoomJson).lighting_profiles as unknown[]) ?? [])
  })

  // POST /rooms/:id/lighting-profiles
  app.post<{ Params: { id: string } }>('/rooms/:id/lighting-profiles', async (request, reply) => {
    const parsed = LightingProfileSchema.safeParse(request.body)
    if (!parsed.success) return sendBadRequest(reply, parsed.error.errors[0].message)
    const room = await prisma.room.findUnique({ where: { id: request.params.id } })
    if (!room) return sendNotFound(reply, 'Room not found')
    const existing = ((room as unknown as RoomJson).lighting_profiles as unknown[]) ?? []
    const newProfile = { ...parsed.data, room_id: request.params.id, created_at: new Date().toISOString() }
    await prisma.room.update({ where: { id: request.params.id }, data: { lighting_profiles: [...existing, newProfile] } as any })
    return reply.status(201).send(newProfile)
  })

  // DELETE /rooms/:id/lighting-profiles/:profileId
  app.delete<{ Params: { id: string; profileId: string } }>(
    '/rooms/:id/lighting-profiles/:profileId',
    async (request, reply) => {
      const room = await prisma.room.findUnique({ where: { id: request.params.id } })
      if (!room) return sendNotFound(reply, 'Room not found')
      const existing = ((room as unknown as RoomJson).lighting_profiles as Array<{ id: string }>) ?? []
      await prisma.room.update({ where: { id: request.params.id }, data: { lighting_profiles: existing.filter(p => p.id !== request.params.profileId) } as any })
      return reply.status(204).send()
    },
  )
}
