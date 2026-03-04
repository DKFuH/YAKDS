import { api } from './client.js'

const TENANT_ID_PLACEHOLDER = '00000000-0000-0000-0000-000000000001'

export type VerticalConnectionKind = 'straight_stair' | 'l_stair' | 'u_stair' | 'spiral_stair' | 'void'

export interface VerticalConnection {
  id: string
  tenant_id: string
  project_id: string
  from_level_id: string
  to_level_id: string
  kind: VerticalConnectionKind
  footprint_json: Record<string, unknown>
  stair_json: Record<string, unknown>
  opening_json: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface CreateVerticalConnectionPayload {
  from_level_id: string
  to_level_id: string
  kind: VerticalConnectionKind
  footprint_json: Record<string, unknown>
  stair_json?: Record<string, unknown>
}

export interface UpdateVerticalConnectionPayload {
  from_level_id?: string
  to_level_id?: string
  kind?: VerticalConnectionKind
  footprint_json?: Record<string, unknown>
  stair_json?: Record<string, unknown>
}

export const verticalConnectionsApi = {
  list: (projectId: string) =>
    api.get<VerticalConnection[]>(`/projects/${projectId}/vertical-connections`, { 'X-Tenant-Id': TENANT_ID_PLACEHOLDER }),

  create: (projectId: string, payload: CreateVerticalConnectionPayload) =>
    api.post<VerticalConnection>(`/projects/${projectId}/vertical-connections`, payload, { 'X-Tenant-Id': TENANT_ID_PLACEHOLDER }),

  update: (id: string, payload: UpdateVerticalConnectionPayload) =>
    api.patch<VerticalConnection>(`/vertical-connections/${id}`, payload, { 'X-Tenant-Id': TENANT_ID_PLACEHOLDER }),

  remove: (id: string) =>
    api.delete(`/vertical-connections/${id}`, { 'X-Tenant-Id': TENANT_ID_PLACEHOLDER }),
}
