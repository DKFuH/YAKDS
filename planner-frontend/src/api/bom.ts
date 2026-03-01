import { api } from './client.js'
import type { QuoteBomLinePayload } from './quotes.js'

export interface BomPlacement {
  id: string
  catalog_item_id: string
  catalog_article_id?: string
  description?: string
  chosen_options?: Record<string, string>
  qty?: number
  list_price_net?: number
  dealer_price_net?: number
  tax_group_id: string
  pricing_group_discount_pct?: number
  position_discount_pct?: number
  flags: {
    requires_customization: boolean
    height_variant: string | null
    labor_surcharge: boolean
    special_trim_needed: boolean
    variant_surcharge?: number
    object_surcharges?: number
  }
}

export interface BomPreviewRequest {
  project: {
    id: string
    cabinets: BomPlacement[]
    appliances: BomPlacement[]
    accessories?: BomPlacement[]
    priceListItems: Array<{
      catalog_item_id: string
      list_price_net: number
      dealer_price_net: number
    }>
    taxGroups: Array<{
      id: string
      name: string
      tax_rate: number
    }>
    quoteSettings: {
      freight_flat_rate: number
      assembly_rate_per_item: number
    }
  }
  options?: {
    specialTrimSurchargeNet?: number
  }
}

export interface BomPreviewLine {
  type: string
  description: string
  qty: number
  unit: string
  line_net_after_discounts: number
  tax_rate: number
}

export interface BomPreviewResponse {
  lines: BomPreviewLine[]
  totals: {
    total_list_net: number
    total_net_after_discounts: number
  }
}

export function previewBom(payload: BomPreviewRequest): Promise<BomPreviewResponse> {
  return api.post<BomPreviewResponse>('/bom/preview', payload)
}

export function toQuoteBomLines(lines: BomPreviewLine[]): QuoteBomLinePayload[] {
  return lines.map((line) => ({
    type: line.type,
    description: line.description,
    qty: line.qty,
    unit: line.unit,
    line_net_after_discounts: line.line_net_after_discounts,
    tax_rate: line.tax_rate,
  }))
}
