import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { ProjectSnapshot } from '@yakds/shared-schemas'
import { sendBadRequest } from '../errors.js'
import { calculateBOM, sumBOMLines } from '../services/bomCalculator.js'

const FlagsSchema = z.object({
  requires_customization: z.boolean(),
  height_variant: z.string().nullable(),
  labor_surcharge: z.boolean(),
  special_trim_needed: z.boolean(),
  variant_surcharge: z.number().optional(),
  object_surcharges: z.number().optional(),
})

const PlacementBaseSchema = z.object({
  id: z.string().min(1),
  catalog_item_id: z.string().min(1),
  description: z.string().optional(),
  qty: z.number().positive().optional(),
  tax_group_id: z.string().min(1),
  pricing_group_discount_pct: z.number().min(0).max(100).optional(),
  position_discount_pct: z.number().min(0).max(100).optional(),
  flags: FlagsSchema,
})

const ProjectSnapshotSchema = z.object({
  id: z.string().min(1),
  cabinets: z.array(PlacementBaseSchema),
  appliances: z.array(PlacementBaseSchema),
  accessories: z.array(PlacementBaseSchema).optional(),
  priceListItems: z.array(
    z.object({
      catalog_item_id: z.string().min(1),
      list_price_net: z.number(),
      dealer_price_net: z.number(),
    }),
  ),
  taxGroups: z.array(
    z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      tax_rate: z.number().min(0),
    }),
  ),
  quoteSettings: z.object({
    freight_flat_rate: z.number().min(0),
    assembly_rate_per_item: z.number().min(0),
  }),
})

const BomPreviewRequestSchema = z.object({
  project: ProjectSnapshotSchema,
  options: z.object({
    specialTrimSurchargeNet: z.number().min(0).optional(),
  }).optional(),
})

function calculateBomPreview(project: ProjectSnapshot, specialTrimSurchargeNet?: number) {
  const lines = calculateBOM(project, { specialTrimSurchargeNet })
  const totals = sumBOMLines(lines)
  return { lines, totals }
}

export async function bomRoutes(app: FastifyInstance) {
  const handler = async (request: { body: unknown }, reply: { send: (payload: unknown) => unknown }) => {
    const parsed = BomPreviewRequestSchema.safeParse(request.body)
    if (!parsed.success) {
      return sendBadRequest(reply as never, parsed.error.errors[0].message)
    }

    return reply.send(
      calculateBomPreview(parsed.data.project as ProjectSnapshot, parsed.data.options?.specialTrimSurchargeNet),
    )
  }

  app.post('/bom/preview', handler)
  app.post('/projects/:projectId/calculate-bom', handler)
}
