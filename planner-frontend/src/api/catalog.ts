import { api } from './client.js'

export type CatalogItemType =
  | 'base_cabinet'
  | 'wall_cabinet'
  | 'tall_cabinet'
  | 'trim'
  | 'worktop'
  | 'appliance'
  | 'accessory'

export interface CatalogItem {
  id: string
  sku: string
  name: string
  type: CatalogItemType
  width_mm: number
  height_mm: number
  depth_mm: number
  list_price_net: number
  dealer_price_net: number | null
  default_markup_pct: number | null
  tax_group_id: string | null
  pricing_group_id: string | null
}

export const catalogApi = {
  list: (params?: {
    type?: CatalogItemType
    q?: string
    limit?: number
    offset?: number
  }): Promise<CatalogItem[]> => {
    const search = new URLSearchParams()
    if (params?.type) search.set('type', params.type)
    if (params?.q) search.set('q', params.q)
    if (params?.limit != null) search.set('limit', String(params.limit))
    if (params?.offset != null) search.set('offset', String(params.offset))
    const qs = search.toString()
    return api.get<CatalogItem[]>(`/catalog/items${qs ? `?${qs}` : ''}`)
  },

  getById: (id: string): Promise<CatalogItem> =>
    api.get<CatalogItem>(`/catalog/items/${id}`),
}

export const CATALOG_TYPE_LABELS: Record<CatalogItemType, string> = {
  base_cabinet: 'Unterschrank',
  wall_cabinet: 'Hängeschrank',
  tall_cabinet: 'Hochschrank',
  trim: 'Blende',
  worktop: 'Arbeitsplatte',
  appliance: 'Gerät',
  accessory: 'Zubehör',
}
