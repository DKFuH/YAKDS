import { z } from 'zod'

export const AlternativeLockRequestSchema = z.object({}).strict()

export const AlternativeBranchResponseSchema = z.object({
  id: z.string().uuid(),
})

export const QuotePositionPurchasePricePatchSchema = z.object({
  purchase_price: z.number().min(0),
})

export const PriceBreakdownEntrySchema = z.object({
  id: z.string().uuid(),
  position: z.number().int().min(0),
  description: z.string().nullable(),
  sell_price: z.number(),
  purchase_price: z.number().nullable(),
  gross_profit: z.number().nullable(),
  contribution_margin: z.number().nullable(),
})

export const PriceBreakdownResponseSchema = z.array(PriceBreakdownEntrySchema)

export type AlternativeLockRequest = z.infer<typeof AlternativeLockRequestSchema>
export type AlternativeBranchResponse = z.infer<typeof AlternativeBranchResponseSchema>
export type QuotePositionPurchasePricePatch = z.infer<typeof QuotePositionPurchasePricePatchSchema>
export type PriceBreakdownEntry = z.infer<typeof PriceBreakdownEntrySchema>
export type PriceBreakdownResponse = z.infer<typeof PriceBreakdownResponseSchema>
