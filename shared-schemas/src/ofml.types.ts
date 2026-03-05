/**
 * ofml.types.ts – OFML OCD/OEX Zod schemas
 *
 * Shared validation schemas for OFML Commercial Data (OCD) and
 * OFML Business Data Exchange (OEX) integration.
 * Used by planner-api routes and can be imported by any consuming package.
 */
import { z } from 'zod'

// ─── Shared primitives ────────────────────────────────────────────

/**
 * CompositeID: a colon-separated compound identifier used in OFML data,
 * e.g. "MANUFACTURER:SERIES:ARTICLE".
 */
export const CompositeIDSchema = z
  .string()
  .min(1)
  .max(500)
  .regex(/^[^:]+:[^:]+/, 'CompositeID must contain at least two colon-separated segments')

export type CompositeID = z.infer<typeof CompositeIDSchema>

/**
 * TaxType: OFML-defined tax categories aligned with OCD specification.
 */
export const TaxTypeSchema = z.enum(['standard', 'reduced', 'zero', 'exempt'])

export type TaxType = z.infer<typeof TaxTypeSchema>

// ─── OCD (OFML Commercial Data) ──────────────────────────────────

export const OcdPriceSchema = z.object({
  article_id: z.string().min(1).max(255),
  composite_id: CompositeIDSchema.optional(),
  price_value: z.number().min(0),
  currency: z.string().length(3).default('EUR'),
  tax_type: TaxTypeSchema.default('standard'),
  valid_from: z.string().datetime().optional(),
  valid_until: z.string().datetime().optional(),
})

export type OcdPrice = z.infer<typeof OcdPriceSchema>

export const OcdArticleSchema = z.object({
  article_id: z.string().min(1).max(255),
  composite_id: CompositeIDSchema.optional(),
  description: z.string().max(1000).optional(),
  manufacturer_code: z.string().max(100).optional(),
  series_code: z.string().max(100).optional(),
  prices: z.array(OcdPriceSchema).default([]),
})

export type OcdArticle = z.infer<typeof OcdArticleSchema>

export const OcdImportResultSchema = z.object({
  articles: z.array(OcdArticleSchema),
  prices: z.array(OcdPriceSchema),
  parsed_at: z.string().datetime(),
})

export type OcdImportResult = z.infer<typeof OcdImportResultSchema>

// ─── OEX (OFML Business Data Exchange) ───────────────────────────

export const OexOrderLineSchema = z.object({
  position: z.number().int().min(1),
  article_id: z.string().min(1).max(255),
  composite_id: CompositeIDSchema.optional(),
  description: z.string().max(1000).optional(),
  qty: z.number().positive(),
  unit: z.string().min(1).max(50).default('stk'),
  unit_price_net: z.number().min(0).optional(),
  line_net: z.number().min(0).optional(),
  tax_type: TaxTypeSchema.default('standard'),
})

export type OexOrderLine = z.infer<typeof OexOrderLineSchema>

export const OexOrderSchema = z.object({
  order_ref: z.string().min(1).max(200),
  supplier_code: z.string().min(1).max(100),
  order_date: z.string().datetime().optional(),
  delivery_date: z.string().datetime().optional(),
  currency: z.string().length(3).default('EUR'),
  lines: z.array(OexOrderLineSchema).min(1),
  notes: z.string().max(2000).optional(),
})

export type OexOrder = z.infer<typeof OexOrderSchema>

export const OexImportResultSchema = z.object({
  orders: z.array(OexOrderSchema),
  parsed_at: z.string().datetime(),
  source_format: z.literal('oex'),
})

export type OexImportResult = z.infer<typeof OexImportResultSchema>
