import { api } from './client.js'

const TENANT_ID_PLACEHOLDER = '00000000-0000-0000-0000-000000000001'

export interface BuildingLevel {
  id: string
  tenant_id: string
  project_id: string
  name: string
  elevation_mm: number
  height_mm: number | null
  order_index: number
  visible: boolean
  config_json: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface CreateBuildingLevelPayload {
  name: string
  elevation_mm?: number
  height_mm?: number | null
  order_index?: number
  visible?: boolean
  config_json?: Record<string, unknown>
}

export interface UpdateBuildingLevelPayload {
  name?: string
  elevation_mm?: number
  height_mm?: number | null
  order_index?: number
  visible?: boolean
  config_json?: Record<string, unknown>
}

export interface BootstrapLevelsResponse {
  default_level_id: string
  created_default_level: boolean
  assigned_rooms: number
  levels: BuildingLevel[]
}

export const levelsApi = {
  list: (projectId: string) =>
    api.get<BuildingLevel[]>(`/projects/${projectId}/levels`, { 'X-Tenant-Id': TENANT_ID_PLACEHOLDER }),

  create: (projectId: string, payload: CreateBuildingLevelPayload) =>
    api.post<BuildingLevel>(`/projects/${projectId}/levels`, payload, { 'X-Tenant-Id': TENANT_ID_PLACEHOLDER }),

  update: (id: string, payload: UpdateBuildingLevelPayload) =>
    api.patch<BuildingLevel>(`/levels/${id}`, payload, { 'X-Tenant-Id': TENANT_ID_PLACEHOLDER }),

  remove: (id: string) =>
    api.delete(`/levels/${id}`, { 'X-Tenant-Id': TENANT_ID_PLACEHOLDER }),

  bootstrap: (projectId: string) =>
    api.post<BootstrapLevelsResponse>(`/projects/${projectId}/levels/bootstrap`, {}, { 'X-Tenant-Id': TENANT_ID_PLACEHOLDER }),
}
