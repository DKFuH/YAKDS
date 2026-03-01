import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { BlockDefinition, BOMLine, GlobalDiscountSettings, PriceSummary } from '@yakds/shared-schemas'

import { sendBadRequest } from '../errors.js'
import { evaluateBlock, findBestBlock } from '../services/blockEvaluator.js'
import { calculatePriceSummary } from '../services/priceCalculator.js'

const BomLineSchema = z.object({
  id: z.string().min(1),
  project_id: z.string().min(1),
  type: z.enum(['cabinet', 'appliance', 'accessory', 'surcharge', 'assembly', 'freight', 'extra']),
  catalog_item_id: z.string().nullable(),
  description: z.string(),
  qty: z.number().positive(),
  unit: z.enum(['stk', 'm', 'm2', 'pauschal']),
  list_price_net: z.number(),
  dealer_price_net: z.number().optional(),
  variant_surcharge: z.number(),
  object_surcharges: z.number(),
  position_discount_pct: z.number().min(0).max(100),
  pricing_group_discount_pct: z.number().min(0).max(100),
  line_net_after_discounts: z.number(),
  tax_group_id: z.string().min(1),
  tax_rate: z.number().min(0),
})

const GlobalDiscountSettingsSchema = z.object({
  project_id: z.string().min(1),
  global_discount_pct: z.number().min(0).max(100),
  extra_costs: z.array(
    z.object({
      id: z.string().min(1),
      label: z.string().min(1),
      amount_net: z.number(),
      tax_group_id: z.string().min(1),
      type: z.enum(['freight', 'assembly', 'other']),
    }),
  ),
})

const PricingPreviewRequestSchema = z.object({
  bom_lines: z.array(BomLineSchema),
  settings: GlobalDiscountSettingsSchema,
})

const BlockDefinitionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  basis: z.enum(['purchase_price', 'sell_price', 'points']),
  tiers: z.array(
    z.object({
      min_value: z.number(),
      discount_pct: z.number().min(0).max(100),
    }),
  ).min(1),
})

const BlockPricingSummarySchema = z.object({
  dealer_price_net: z.number(),
  subtotal_net: z.number(),
  total_purchase_price_net: z.number().optional(),
  total_sell_price_net: z.number().optional(),
  total_points: z.number().optional(),
})

const BlockPreviewRequestSchema = z.object({
  price_summary: BlockPricingSummarySchema,
  blocks: z.array(BlockDefinitionSchema).min(1),
})

function calculatePricingPreview(lines: BOMLine[], settings: GlobalDiscountSettings) {
  return calculatePriceSummary(lines, settings)
}

function calculateBlockPreview(priceSummary: PriceSummary, blocks: BlockDefinition[]) {
  return {
    evaluations: blocks.map((block) => evaluateBlock(priceSummary, block)),
    best_block: findBestBlock(priceSummary, blocks),
  }
}

export async function pricingRoutes(app: FastifyInstance) {
  const handler = async (request: { body: unknown }, reply: { send: (payload: unknown) => unknown }) => {
    const parsed = PricingPreviewRequestSchema.safeParse(request.body)
    if (!parsed.success) {
      return sendBadRequest(reply as never, parsed.error.errors[0].message)
    }

    return reply.send(
      calculatePricingPreview(parsed.data.bom_lines as BOMLine[], parsed.data.settings as GlobalDiscountSettings),
    )
  }

  const blockHandler = async (request: { body: unknown }, reply: { send: (payload: unknown) => unknown }) => {
    const parsed = BlockPreviewRequestSchema.safeParse(request.body)
    if (!parsed.success) {
      return sendBadRequest(reply as never, parsed.error.errors[0].message)
    }

    return reply.send(
      calculateBlockPreview(
        parsed.data.price_summary as PriceSummary,
        parsed.data.blocks as BlockDefinition[],
      ),
    )
  }

  app.post('/pricing/preview', handler)
  app.post('/pricing/block-preview', blockHandler)
  app.post('/projects/:projectId/calculate-pricing', handler)
}
