import { api } from './client.js'
import { getCatalogItem as getDemoCatalogItem, listCatalog as listDemoCatalog } from './demoBackend.js'
import { shouldUseDemoFallback } from './client.js'

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

export interface Manufacturer {
  id: string
  name: string
  code: string
  _count?: { articles: number }
}

export interface ArticleOption {
  id: string
  article_id: string
  option_key: string
  option_type: 'enum' | 'dimension' | 'boolean' | 'text'
  constraints_json: any
}

export interface ArticleVariant {
  id: string
  article_id: string
  variant_key: string
  variant_values_json: any
  dims_override_json: any
}

export interface CatalogArticle {
  id: string
  manufacturer_id: string
  sku: string
  name: string
  article_type: CatalogItemType | 'plinth'
  base_dims_json: {
    width_mm: number
    height_mm: number
    depth_mm: number
  }
  options?: ArticleOption[]
  variants?: ArticleVariant[]
}

export type UnifiedCatalogItem = CatalogItem | CatalogArticle

export const catalogApi = {
  list: async (params?: {
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
    try {
      return await api.get<CatalogItem[]>(`/catalog/items${qs ? `?${qs}` : ''}`)
    } catch (error) {
      if (shouldUseDemoFallback(error)) return listDemoCatalog(params)
      throw error
    }
  },

  getById: async (id: string): Promise<CatalogItem> => {
    try {
      return await api.get<CatalogItem>(`/catalog/items/${id}`)
    } catch (error) {
      if (shouldUseDemoFallback(error)) return getDemoCatalogItem(id)
      throw error
    }
  },

  listManufacturers: (): Promise<Manufacturer[]> =>
    api.get<Manufacturer[]>('/manufacturers'),

  getManufacturerArticles: (id: string): Promise<CatalogArticle[]> =>
    api.get<CatalogArticle[]>(`/manufacturers/${id}/articles`),

  getArticleById: (id: string): Promise<CatalogArticle> => {
    void id
    // Note: The backend route is /manufacturers/:id/articles (for list)
    // but individual article fetch is usually provided in REST. 
    // Checking manufacturers.ts again... it has GET /manufacturers/:id which includes articles.
    // There isn't a direct GET /catalog-articles/:id in manufacturers.ts, 
    // but there is usually one expected. 
    // Let's assume for now we fetch it via the manufacturer list or add it if needed.
    // Actually, I'll stick to what's in manufacturers.ts.
    return Promise.reject(new Error('Not implemented: use listManufacturerArticles'))
  },
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
