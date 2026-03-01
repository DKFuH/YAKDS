import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../db.js'
import { sendBadRequest, sendNotFound } from '../errors.js'

const CatalogTypeSchema = z.enum([
  'base_cabinet',
  'wall_cabinet',
  'tall_cabinet',
  'trim',
  'worktop',
  'appliance',
  'accessory',
])

const ListCatalogQuerySchema = z.object({
  type: CatalogTypeSchema.optional(),
  q: z.string().trim().min(1).max(120).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
  offset: z.coerce.number().int().min(0).default(0),
})

const CatalogItemIdParamSchema = z.object({
  id: z.string().uuid(),
})

export async function catalogRoutes(app: FastifyInstance) {
  app.get('/catalog/items', async (request, reply) => {
    const parsed = ListCatalogQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return sendBadRequest(reply, parsed.error.errors[0].message)
    }

    const { type, q, limit, offset } = parsed.data

    const items = await prisma.catalogItem.findMany({
      where: {
        ...(type ? { type } : {}),
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: 'insensitive' } },
                { sku: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: { name: 'asc' },
      take: limit,
      skip: offset,
      select: {
        id: true,
        sku: true,
        name: true,
        type: true,
        width_mm: true,
        height_mm: true,
        depth_mm: true,
        list_price_net: true,
        dealer_price_net: true,
        default_markup_pct: true,
        tax_group_id: true,
        pricing_group_id: true,
      },
    })

    return reply.send(items)
  })

  app.get<{ Params: { id: string } }>('/catalog/items/:id', async (request, reply) => {
    const parsedParams = CatalogItemIdParamSchema.safeParse(request.params)
    if (!parsedParams.success) {
      return sendBadRequest(reply, parsedParams.error.errors[0].message)
    }

    const item = await prisma.catalogItem.findUnique({
      where: { id: parsedParams.data.id },
      select: {
        id: true,
        sku: true,
        name: true,
        type: true,
        width_mm: true,
        height_mm: true,
        depth_mm: true,
        list_price_net: true,
        dealer_price_net: true,
        default_markup_pct: true,
        tax_group_id: true,
        pricing_group_id: true,
        created_at: true,
        updated_at: true,
      },
    })

    if (!item) {
      return sendNotFound(reply, 'Catalog item not found')
    }

    return reply.send(item)
  })

  app.post('/catalog/skp-mapping', async (_request, reply) => {
    return reply.status(501).send({
      error: 'NOT_IMPLEMENTED',
      message: 'SKP mapping endpoint is prepared for Sprint 7.5.',
    })
  })
}
