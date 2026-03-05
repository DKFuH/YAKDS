import { api } from './client.js'

const TENANT_ID_PLACEHOLDER = '00000000-0000-0000-0000-000000000001'

export type CameraPresetMode = 'orbit' | 'visitor'

export interface CameraVector3 {
  x: number
  y: number
  z: number
}

export interface CameraPreset {
  id: string
  name: string
  position: CameraVector3
  target: CameraVector3
  fov: number
  mode: CameraPresetMode
  is_default: boolean
  created_at: string
  updated_at: string
}

export interface CameraPresetListResponse {
  project_id: string
  presets: CameraPreset[]
  active_preset_id: string | null
}

export interface CameraPresetCreatePayload {
  name: string
  position: CameraVector3
  target: CameraVector3
  fov: number
  mode: CameraPresetMode
  is_default?: boolean
}

export interface CameraPresetPatchPayload {
  name?: string
  position?: CameraVector3
  target?: CameraVector3
  fov?: number
  mode?: CameraPresetMode
  is_default?: boolean
}

export const cameraPresetsApi = {
  list(projectId: string) {
    return api.get<CameraPresetListResponse>(
      `/projects/${projectId}/camera-presets`,
      { 'X-Tenant-Id': TENANT_ID_PLACEHOLDER },
    )
  },

  create(projectId: string, payload: CameraPresetCreatePayload) {
    return api.post<{ project_id: string; preset: CameraPreset; presets: CameraPreset[]; active_preset_id: string | null }>(
      `/projects/${projectId}/camera-presets`,
      payload,
      { 'X-Tenant-Id': TENANT_ID_PLACEHOLDER },
    )
  },

  update(projectId: string, presetId: string, payload: CameraPresetPatchPayload) {
    return api.patch<{ project_id: string; preset: CameraPreset; presets: CameraPreset[]; active_preset_id: string | null }>(
      `/projects/${projectId}/camera-presets/${presetId}`,
      payload,
      { 'X-Tenant-Id': TENANT_ID_PLACEHOLDER },
    )
  },

  remove(projectId: string, presetId: string) {
    return api.delete(
      `/projects/${projectId}/camera-presets/${presetId}`,
      { 'X-Tenant-Id': TENANT_ID_PLACEHOLDER },
    )
  },

  apply(projectId: string, presetId: string) {
    return api.post<{ project_id: string; preset: CameraPreset; active_preset_id: string }>(
      `/projects/${projectId}/camera-presets/${presetId}/apply`,
      {},
      { 'X-Tenant-Id': TENANT_ID_PLACEHOLDER },
    )
  },
}
