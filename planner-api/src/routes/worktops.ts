import { randomUUID } from 'node:crypto'
import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../db.js'
import { sendNotFound, sendBadRequest } from '../errors.js'

const PointSchema = z.object({ x_mm: z.number(), y_mm: z.number() })
const EdgeSchema = z.object({
  edge_index: z.number().int().min(0),
  type: z.enum(['none', 'straight', 'rounded', 'profiled']).default('none'),
  article_number: z.string().optional(),
})

const WorktopSchemaInputSchema = z.object({
  polygon: z.array(PointSchema).min(3),
  edges: z.array(EdgeSchema).default([]),
  article_number: z.string().optional(),
  thickness_mm: z.number().positive().optional(),
  overhang_mm: z.number().min(0).optional(),
  generated: z.boolean().default(false),
})

type RoomJson = Record<string, unknown>

export async function worktopRoutes(app: FastifyInstance) {
  // GET /rooms/:id/worktop-schemas
  app.get<{ Params: { id: string } }>('/rooms/:id/worktop-schemas', async (request, reply) => {
    const room = await prisma.room.findUnique({ where: { id: request.params.id } })
    if (!room) return sendNotFound(reply, 'Room not found')
    const schemas = ((room as unknown as RoomJson).worktop_schemas as unknown[]) ?? []
    return reply.send(schemas)
  })

  // POST /rooms/:id/worktop-schemas
  app.post<{ Params: { id: string } }>('/rooms/:id/worktop-schemas', async (request, reply) => {
    const parsed = WorktopSchemaInputSchema.safeParse(request.body)
    if (!parsed.success) return sendBadRequest(reply, parsed.error.errors[0].message)

    const room = await prisma.room.findUnique({ where: { id: request.params.id } })
    if (!room) return sendNotFound(reply, 'Room not found')

    const newSchema = { id: randomUUID(), ...parsed.data, room_id: request.params.id, created_at: new Date().toISOString() }
    const existing = ((room as unknown as RoomJson).worktop_schemas as unknown[]) ?? []
    await prisma.room.update({
      where: { id: request.params.id },
      data: { worktop_schemas: [...existing, newSchema] } as any,
    })
    return reply.status(201).send(newSchema)
  })

  // DELETE /rooms/:id/worktop-schemas/:schemaId
  app.delete<{ Params: { id: string; schemaId: string } }>(
    '/rooms/:id/worktop-schemas/:schemaId',
    async (request, reply) => {
      const room = await prisma.room.findUnique({ where: { id: request.params.id } })
      if (!room) return sendNotFound(reply, 'Room not found')
      const existing = ((room as unknown as RoomJson).worktop_schemas as Array<{ id: string }>) ?? []
      await prisma.room.update({
        where: { id: request.params.id },
        data: { worktop_schemas: existing.filter(s => s.id !== request.params.schemaId) } as any,
      })
      return reply.status(204).send()
    },
  )
}
