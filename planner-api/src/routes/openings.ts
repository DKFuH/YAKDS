import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { sendBadRequest } from '../errors.js'

const OpeningSchema = z.object({
  id: z.string().uuid(),
  wall_id: z.string().uuid(),
  type: z.enum(['door', 'window', 'pass-through']).optional(),
  offset_mm: z.number().min(0),
  width_mm: z.number().positive(),
  height_mm: z.number().positive().optional(),
  sill_height_mm: z.number().min(0).optional(),
})

const UpsertOpeningsSchema = z.object({
  room_id: z.string().uuid(),
  openings: z.array(OpeningSchema).max(200),
})

export async function openingRoutes(app: FastifyInstance) {
  app.put('/openings', async (request, reply) => {
    const parsed = UpsertOpeningsSchema.safeParse(request.body)
    if (!parsed.success) {
      return sendBadRequest(reply, parsed.error.errors[0].message)
    }

    return reply.status(501).send({
      error: 'NOT_IMPLEMENTED',
      message: 'Openings route stub is not implemented yet.',
      input: parsed.data,
    })
  })
}
