import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { sendBadRequest } from '../errors.js'

const CreateImportJobSchema = z.object({
  project_id: z.string().uuid(),
  source_format: z.enum(['dxf', 'dwg', 'skp']),
  source_filename: z.string().min(1).max(255),
})

export async function importRoutes(app: FastifyInstance) {
  app.post('/imports', async (request, reply) => {
    const parsed = CreateImportJobSchema.safeParse(request.body)
    if (!parsed.success) {
      return sendBadRequest(reply, parsed.error.errors[0].message)
    }

    return reply.status(501).send({
      error: 'NOT_IMPLEMENTED',
      message: 'Import route stub is not implemented yet.',
      input: parsed.data,
    })
  })
}
