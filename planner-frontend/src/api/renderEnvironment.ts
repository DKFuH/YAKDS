import { api } from './client.js'
import type {
  RenderEnvironmentPreset,
  RenderEnvironmentSettings,
} from '../components/editor/renderEnvironmentState.js'

const TENANT_ID_PLACEHOLDER = '00000000-0000-0000-0000-000000000001'

export interface RenderEnvironmentResponse {
  project_id: string
  presets: RenderEnvironmentPreset[]
  active: RenderEnvironmentSettings
}

export interface RenderEnvironmentPatchPayload {
  preset_id?: RenderEnvironmentSettings['preset_id']
  intensity?: number
  rotation_deg?: number
  ground_tint?: string
}

export const renderEnvironmentApi = {
  get(projectId: string) {
    return api.get<RenderEnvironmentResponse>(
      `/projects/${projectId}/render-environments`,
      { 'X-Tenant-Id': TENANT_ID_PLACEHOLDER },
    )
  },

  update(projectId: string, payload: RenderEnvironmentPatchPayload) {
    return api.patch<RenderEnvironmentResponse>(
      `/projects/${projectId}/render-environment`,
      payload,
      { 'X-Tenant-Id': TENANT_ID_PLACEHOLDER },
    )
  },
}
