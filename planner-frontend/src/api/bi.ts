import { api } from './client.js'

export interface DateRange {
  from?: string
  to?: string
}

export interface BIProjects {
  total: number
  won: number
  lost: number
  quoted: number
  conversion_rate: number
}

export interface BIQuotesSummary {
  total: number
  sent: number
}

export interface BIValue {
  total_net: number
  avg_net: number
}

export interface BISummary {
  period: { from: string | null; to: string | null }
  tenant_id: string
  projects: BIProjects
  quotes: BIQuotesSummary
  value: BIValue
}

export interface BIQuoteEntry {
  quote_id: string
  quote_number: string
  status: string
  valid_until: string | null
  created_at: string
  project_id: string
  project_name: string
  lead_status: string
  tenant_id: string
  total_net: number
  total_gross: number
}

export interface BIQuotesResponse {
  count: number
  quotes: BIQuoteEntry[]
}

export interface BIProductEntry {
  type: string
  revenue_net: number
  count: number
}

export interface BIProductsResponse {
  tenant_id: string
  total_items: number
  by_type: BIProductEntry[]
}

function buildParams(range?: DateRange): string {
  const p = new URLSearchParams()
  if (range?.from) p.set('from', range.from)
  if (range?.to) p.set('to', range.to)
  const qs = p.toString()
  return qs ? `?${qs}` : ''
}

export const biApi = {
  summary: (tenantId: string, range?: DateRange): Promise<BISummary> =>
    api.get<BISummary>(`/bi/summary${buildParams(range)}`, { 'X-Tenant-Id': tenantId }),

  quotes: (tenantId: string, range?: DateRange): Promise<BIQuotesResponse> =>
    api.get<BIQuotesResponse>(`/bi/quotes${buildParams(range)}`, { 'X-Tenant-Id': tenantId }),

  products: (tenantId: string, range?: DateRange): Promise<BIProductsResponse> =>
    api.get<BIProductsResponse>(`/bi/products${buildParams(range)}`, { 'X-Tenant-Id': tenantId }),
}
