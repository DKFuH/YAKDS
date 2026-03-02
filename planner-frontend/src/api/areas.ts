import { api } from './client.js'

export interface ModelSettings {
  id?: string
  alternative_id?: string
  manufacturer_name: string | null
  model_name: string | null
  handle_name: string | null
  worktop_model: string | null
  worktop_color: string | null
  plinth_height_mm: number | null
  cover_panel_enabled: boolean
  room_height_mm: number | null
  wall_thickness_mm: number | null
  extra_json: Record<string, unknown>
}

export interface Alternative {
  id: string
  area_id: string
  name: string
  is_active: boolean
  sort_order: number
  model_settings: ModelSettings | null
  created_at: string
  updated_at: string
}

export interface Area {
  id: string
  project_id: string
  name: string
  sort_order: number
  alternatives: Alternative[]
  created_at: string
  updated_at: string
}

const TENANT_ID_PLACEHOLDER = '00000000-0000-0000-0000-000000000001'

export const areasApi = {
  list: async (projectId: string) => {
    return api.get<Area[]>(`/projects/${projectId}/areas`, { 'X-Tenant-Id': TENANT_ID_PLACEHOLDER })
  },
  createArea: async (projectId: string, data: { name: string; sort_order?: number }) => {
    return api.post<Area>(`/projects/${projectId}/areas`, data, { 'X-Tenant-Id': TENANT_ID_PLACEHOLDER })
  },
  updateArea: async (projectId: string, areaId: string, data: { name?: string; sort_order?: number }) => {
    return api.put<Area>(`/projects/${projectId}/areas/${areaId}`, data, { 'X-Tenant-Id': TENANT_ID_PLACEHOLDER })
  },
  deleteArea: async (projectId: string, areaId: string) => {
    return api.delete(`/projects/${projectId}/areas/${areaId}`, { 'X-Tenant-Id': TENANT_ID_PLACEHOLDER })
  },
  createAlternative: async (projectId: string, areaId: string, data: { name: string; is_active?: boolean; sort_order?: number }) => {
    return api.post<Alternative>(`/projects/${projectId}/areas/${areaId}/alternatives`, data, { 'X-Tenant-Id': TENANT_ID_PLACEHOLDER })
  },
  updateAlternative: async (projectId: string, areaId: string, alternativeId: string, data: { name?: string; is_active?: boolean; sort_order?: number }) => {
    return api.put<Alternative>(`/projects/${projectId}/areas/${areaId}/alternatives/${alternativeId}`, data, { 'X-Tenant-Id': TENANT_ID_PLACEHOLDER })
  },
  deleteAlternative: async (projectId: string, areaId: string, alternativeId: string) => {
    return api.delete(`/projects/${projectId}/areas/${areaId}/alternatives/${alternativeId}`, { 'X-Tenant-Id': TENANT_ID_PLACEHOLDER })
  },
  getModelSettings: async (alternativeId: string) => {
    return api.get<ModelSettings>(`/alternatives/${alternativeId}/model-settings`, { 'X-Tenant-Id': TENANT_ID_PLACEHOLDER })
  },
  saveModelSettings: async (alternativeId: string, data: Partial<ModelSettings>) => {
    return api.put<ModelSettings>(`/alternatives/${alternativeId}/model-settings`, data, { 'X-Tenant-Id': TENANT_ID_PLACEHOLDER })
  },
}
