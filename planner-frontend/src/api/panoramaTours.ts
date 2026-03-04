import { api } from './client.js'

export interface PanoramaHotspot {
  target_point_id: string
  label?: string
}

export interface PanoramaPoint {
  id: string
  label: string
  camera: {
    x: number
    y: number
    z: number
    yaw: number
    pitch: number
  }
  hotspots: PanoramaHotspot[]
}

export interface PanoramaTour {
  id: string
  tenant_id: string
  project_id: string
  name: string
  points_json: PanoramaPoint[]
  share_token: string | null
  expires_at: string | null
  created_at: string
  updated_at: string
}

export interface PanoramaShareResult {
  id: string
  share_token: string
  expires_at: string | null
  share_url: string
}

export interface PublicPanoramaTour {
  id: string
  project_id: string
  name: string
  points_json: PanoramaPoint[]
  expires_at: string | null
}

export const panoramaToursApi = {
  list: (projectId: string) => api.get<PanoramaTour[]>(`/projects/${projectId}/panorama-tours`),

  create: (projectId: string, payload: { name: string; points_json: PanoramaPoint[] }) =>
    api.post<PanoramaTour>(`/projects/${projectId}/panorama-tours`, payload),

  update: (id: string, payload: { name: string; points_json: PanoramaPoint[] }) =>
    api.put<PanoramaTour>(`/panorama-tours/${id}`, payload),

  remove: (id: string) => api.delete(`/panorama-tours/${id}`),

  share: (id: string, expiresInDays?: number) =>
    api.post<PanoramaShareResult>(`/panorama-tours/${id}/share`, expiresInDays ? { expires_in_days: expiresInDays } : {}),

  getShared: (token: string) => api.get<PublicPanoramaTour>(`/share/panorama/${token}`),
}
