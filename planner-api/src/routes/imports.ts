import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { parseDxf } from '@yakds/dxf-import'
import { parseSkp } from '@yakds/skp-import'
import { sendBadRequest } from '../errors.js'

const CreateImportJobSchema = z.object({
  project_id: z.string().uuid(),
  source_format: z.enum(['dxf', 'dwg', 'skp']),
  source_filename: z.string().min(1).max(255),
})

const DxfPreviewSchema = z.object({
  source_filename: z.string().min(1).max(255),
  dxf: z.string().min(1),
})

const SkpPreviewSchema = z.object({
  source_filename: z.string().min(1).max(255),
  file_base64: z.string().min(1).regex(/^[A-Za-z0-9+/=]+$/),
})

function decodeBase64(value: string): Buffer {
  return Buffer.from(value, 'base64')
}

export async function importRoutes(app: FastifyInstance) {
  app.post('/imports/preview/dxf', async (request, reply) => {
    const parsed = DxfPreviewSchema.safeParse(request.body)
    if (!parsed.success) {
      return sendBadRequest(reply, parsed.error.errors[0].message)
    }

    return reply.send(parseDxf(parsed.data.dxf, parsed.data.source_filename))
  })

  app.post('/imports/preview/skp', async (request, reply) => {
    const parsed = SkpPreviewSchema.safeParse(request.body)
    if (!parsed.success) {
      return sendBadRequest(reply, parsed.error.errors[0].message)
    }

    return reply.send(parseSkp(decodeBase64(parsed.data.file_base64), parsed.data.source_filename))
  })

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
