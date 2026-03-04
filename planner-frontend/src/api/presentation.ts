import { api } from './client.js'
import type { PresentationSource, RenderPreset } from '../plugins/presentation/index.js'

export interface PresentationSession {
  project_id: string
  project_name: string
  branding: {
    company_name: string | null
    company_city: string | null
    company_web: string | null
    logo_url: string | null
  }
  presentation_mode: {
    hide_editor_panels: boolean
    show_branding: boolean
    loop_tour: boolean
  }
  preferred_entry:
    | { kind: 'split-view' }
    | { kind: 'panorama-tour'; panorama_tour_id: string }
  panorama_tours: Array<{
    id: string
    name: string
    share_token: string | null
    share_url: string | null
    updated_at: string
  }>
}

export interface RenderJobResponse {
  id: string
  status: 'queued' | 'assigned' | 'running' | 'done' | 'failed'
  error_message?: string | null
  scene_payload?: unknown
  result?: {
    image_url: string
    width_px: number
    height_px: number
    render_time_ms: number
  } | null
}

export const presentationApi = {
  createSession: (
    projectId: string,
    payload?: {
      entry?: 'auto' | 'split-view' | 'panorama-tour'
      panorama_tour_id?: string
    },
  ) => api.post<PresentationSession>(`/projects/${projectId}/presentation-sessions`, payload ?? {}),

  createRenderJob: (
    projectId: string,
    payload: {
      preset: RenderPreset
      source: PresentationSource
      scene_payload?: unknown
    },
  ) => api.post<RenderJobResponse>(`/projects/${projectId}/render-jobs`, payload),

  getRenderJob: (jobId: string) => api.get<RenderJobResponse>(`/render-jobs/${jobId}`),
}
