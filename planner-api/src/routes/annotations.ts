import { randomUUID } from 'node:crypto'
import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../db.js'
import { sendNotFound, sendBadRequest } from '../errors.js'

const MAX_TEXT_LENGTH = 2000

type RoomJson = Record<string, unknown>

const PointSchema = z.object({ x_mm: z.number(), y_mm: z.number() })

const MeasureLineSchema = z.object({
  id: z.string().uuid().default(() => randomUUID()),
  points: z.array(PointSchema).min(2),
  label: z.string().optional(),
  is_chain: z.boolean().default(false),
})

const SectionLineSchema = z.object({
  id: z.string().uuid().default(() => randomUUID()),
  start: PointSchema,
  end: PointSchema,
  label: z.string().optional(),
})

const CommentSchema = z.object({
  id: z.string().uuid().default(() => randomUUID()),
  position: PointSchema,
  text: z.string().min(1).max(MAX_TEXT_LENGTH),
  image_url: z.string().url().regex(/^https:\/\//).optional(),
  font_size: z.number().positive().optional(),
  background_color: z.string().optional(),
  show_in_plan: z.boolean().default(true),
  show_in_perspective: z.boolean().default(false),
  arrow_target: PointSchema.optional(),
})

export async function annotationRoutes(app: FastifyInstance) {
  // GET /rooms/:id/measure-lines
  app.get<{ Params: { id: string } }>('/rooms/:id/measure-lines', async (request, reply) => {
    const room = await prisma.room.findUnique({ where: { id: request.params.id } })
    if (!room) return sendNotFound(reply, 'Room not found')
    return reply.send(((room as unknown as RoomJson).measure_lines as unknown[]) ?? [])
  })

  // POST /rooms/:id/measure-lines
  app.post<{ Params: { id: string } }>('/rooms/:id/measure-lines', async (request, reply) => {
    const parsed = MeasureLineSchema.safeParse(request.body)
    if (!parsed.success) return sendBadRequest(reply, parsed.error.errors[0].message)
    const room = await prisma.room.findUnique({ where: { id: request.params.id } })
    if (!room) return sendNotFound(reply, 'Room not found')
    const existing = ((room as unknown as RoomJson).measure_lines as unknown[]) ?? []
    const newItem = { ...parsed.data, room_id: request.params.id }
    await prisma.room.update({ where: { id: request.params.id }, data: { measure_lines: [...existing, newItem] } as any })
    return reply.status(201).send(newItem)
  })

  // DELETE /rooms/:id/measure-lines/:lineId
  app.delete<{ Params: { id: string; lineId: string } }>(
    '/rooms/:id/measure-lines/:lineId',
    async (request, reply) => {
      const room = await prisma.room.findUnique({ where: { id: request.params.id } })
      if (!room) return sendNotFound(reply, 'Room not found')
      const existing = ((room as unknown as RoomJson).measure_lines as Array<{ id: string }>) ?? []
      await prisma.room.update({ where: { id: request.params.id }, data: { measure_lines: existing.filter(l => l.id !== request.params.lineId) } as any })
      return reply.status(204).send()
    },
  )

  // GET /rooms/:id/comments
  app.get<{ Params: { id: string } }>('/rooms/:id/comments', async (request, reply) => {
    const room = await prisma.room.findUnique({ where: { id: request.params.id } })
    if (!room) return sendNotFound(reply, 'Room not found')
    return reply.send(((room as unknown as RoomJson).comments as unknown[]) ?? [])
  })

  // POST /rooms/:id/comments
  app.post<{ Params: { id: string } }>('/rooms/:id/comments', async (request, reply) => {
    const parsed = CommentSchema.safeParse(request.body)
    if (!parsed.success) return sendBadRequest(reply, parsed.error.errors[0].message)
    const room = await prisma.room.findUnique({ where: { id: request.params.id } })
    if (!room) return sendNotFound(reply, 'Room not found')
    const existing = ((room as unknown as RoomJson).comments as unknown[]) ?? []
    const newComment = { ...parsed.data, room_id: request.params.id }
    await prisma.room.update({ where: { id: request.params.id }, data: { comments: [...existing, newComment] } as any })
    return reply.status(201).send(newComment)
  })

  // DELETE /rooms/:id/comments/:commentId
  app.delete<{ Params: { id: string; commentId: string } }>(
    '/rooms/:id/comments/:commentId',
    async (request, reply) => {
      const room = await prisma.room.findUnique({ where: { id: request.params.id } })
      if (!room) return sendNotFound(reply, 'Room not found')
      const existing = ((room as unknown as RoomJson).comments as Array<{ id: string }>) ?? []
      await prisma.room.update({ where: { id: request.params.id }, data: { comments: existing.filter(c => c.id !== request.params.commentId) } as any })
      return reply.status(204).send()
    },
  )

  // GET /rooms/:id/section-lines
  app.get<{ Params: { id: string } }>('/rooms/:id/section-lines', async (request, reply) => {
    const room = await prisma.room.findUnique({ where: { id: request.params.id } })
    if (!room) return sendNotFound(reply, 'Room not found')
    return reply.send(((room as unknown as RoomJson).section_lines as unknown[]) ?? [])
  })

  // POST /rooms/:id/section-lines
  app.post<{ Params: { id: string } }>('/rooms/:id/section-lines', async (request, reply) => {
    const parsed = SectionLineSchema.safeParse(request.body)
    if (!parsed.success) return sendBadRequest(reply, parsed.error.errors[0].message)
    const room = await prisma.room.findUnique({ where: { id: request.params.id } })
    if (!room) return sendNotFound(reply, 'Room not found')
    const existing = ((room as unknown as RoomJson).section_lines as unknown[]) ?? []
    const newLine = { ...parsed.data, room_id: request.params.id }
    await prisma.room.update({ where: { id: request.params.id }, data: { section_lines: [...existing, newLine] } as any })
    return reply.status(201).send(newLine)
  })
}
