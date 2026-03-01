import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { sendBadRequest } from '../errors.js'

const PointSchema = z.object({
  x_mm: z.number(),
  y_mm: z.number(),
})

const PlacementSchema = z.object({
  id: z.string().uuid(),
  wall_id: z.string().uuid(),
  offset_mm: z.number(),
  width_mm: z.number().positive(),
  depth_mm: z.number().positive(),
  height_mm: z.number().positive(),
  worldPos: PointSchema.optional(),
})

const SavePlacementsSchema = z.object({
  room_id: z.string().uuid(),
  placements: z.array(PlacementSchema).max(500),
})

export async function placementRoutes(app: FastifyInstance) {
  app.put('/placements', async (request, reply) => {
    const parsed = SavePlacementsSchema.safeParse(request.body)
    if (!parsed.success) {
      return sendBadRequest(reply, parsed.error.errors[0].message)
    }

    return reply.status(501).send({
      error: 'NOT_IMPLEMENTED',
      message: 'Placements route stub is not implemented yet.',
      input: parsed.data,
    })
  })
}
