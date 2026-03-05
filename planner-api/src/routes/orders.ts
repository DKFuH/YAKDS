import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { parseOCD } from '../services/interop/ocdParser.js'
import { OexOrderSchema } from '@okp/shared-schemas'
import { sendBadRequest } from '../errors.js'

// ─── Request schemas ────────────────────────────────────────────

const OcdImportBodySchema = z.object({
  xml: z.string().min(1),
})

const OexOrdersImportBodySchema = z.object({
  orders: z.array(OexOrderSchema).min(1),
})

// ─── Routes ─────────────────────────────────────────────────────

export async function ofmlImportRoutes(app: FastifyInstance) {
  /**
   * POST /import/ocd
   * Parse an OCD XML document and return the extracted articles and prices.
   */
  app.post('/import/ocd', async (request, reply) => {
    const parsed = OcdImportBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return sendBadRequest(reply, parsed.error.errors[0]?.message ?? 'Invalid payload')
    }

    let result
    try {
      result = parseOCD(parsed.data.xml)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'OCD parse error'
      return sendBadRequest(reply, message)
    }

    return reply.status(200).send(result)
  })

  /**
   * POST /import/oex-orders
   * Accept OEX-format order objects (already parsed from XML by the client
   * or a pre-processor) and return them normalised as OexImportResult.
   */
  app.post('/import/oex-orders', async (request, reply) => {
    const parsed = OexOrdersImportBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return sendBadRequest(reply, parsed.error.errors[0]?.message ?? 'Invalid payload')
    }

    const result = {
      orders: parsed.data.orders,
      parsed_at: new Date().toISOString(),
      source_format: 'oex' as const,
    }

    return reply.status(200).send(result)
  })
}
