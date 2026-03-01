import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { sendBadRequest } from '../errors.js'

const BomRequestSchema = z.object({
  project_id: z.string().uuid(),
})

export async function bomRoutes(app: FastifyInstance) {
  app.post('/bom/preview', async (request, reply) => {
    const parsed = BomRequestSchema.safeParse(request.body)
    if (!parsed.success) {
      return sendBadRequest(reply, parsed.error.errors[0].message)
    }

    return reply.status(501).send({
      error: 'NOT_IMPLEMENTED',
      message: 'BOM route stub is not implemented yet.',
      input: parsed.data,
    })
  })
}
