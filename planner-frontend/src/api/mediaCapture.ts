import { api } from './client.js'
import { tenantScopedHeaders } from './runtimeContext.js'
import type { RenderEnvironmentSettings } from '../components/editor/renderEnvironmentState.js'

export type ScreenshotFormat = 'png' | 'jpeg'

export interface ScreenshotUploadPayload {
  image_base64: string
  filename?: string
  mime_type?: 'image/png' | 'image/jpeg'
  width_px?: number
  height_px?: number
  view_mode?: '2d' | '3d' | 'split' | 'elevation' | 'section' | 'presentation'
  transparent_background?: boolean
  uploaded_by?: string
}

export interface ScreenshotUploadResponse {
  project_id: string
  document_id: string
  filename: string
  mime_type: string
  download_url: string
  preview_url: string
  width_px: number | null
  height_px: number | null
}

export interface Export360CreatePayload {
  preset?: 'draft' | 'balanced' | 'best'
  width_px?: number
  height_px?: number
  format?: ScreenshotFormat
  quality?: number
  environment?: RenderEnvironmentSettings
}

export interface Export360CreateResponse {
  project_id: string
  job_id: string
  status: 'queued' | 'assigned' | 'running' | 'done' | 'failed'
  status_url: string
}

export interface Export360StatusResponse {
  project_id: string
  job_id: string
  status: 'queued' | 'assigned' | 'running' | 'done' | 'failed'
  error_message: string | null
  preview_url: string | null
  download_url: string | null
  width_px: number | null
  height_px: number | null
  render_time_ms: number | null
}

function withAbsoluteBase(path: string | null): string | null {
  if (!path) {
    return null
  }

  if (path.startsWith('/api/') && typeof window !== 'undefined') {
    return `${window.location.origin}${path}`
  }

  return path
}

export const mediaCaptureApi = {
  uploadScreenshot: async (projectId: string, payload: ScreenshotUploadPayload) => {
    const result = await api.post<ScreenshotUploadResponse>(
      `/projects/${projectId}/screenshot`,
      payload,
      tenantScopedHeaders(),
    )

    return {
      ...result,
      download_url: withAbsoluteBase(result.download_url) ?? result.download_url,
      preview_url: withAbsoluteBase(result.preview_url) ?? result.preview_url,
    }
  },

  createExport360: (projectId: string, payload: Export360CreatePayload) => api.post<Export360CreateResponse>(
    `/projects/${projectId}/export-360`,
    payload,
    tenantScopedHeaders(),
  ),

  getExport360Status: async (projectId: string, jobId: string) => {
    const result = await api.get<Export360StatusResponse>(
      `/projects/${projectId}/export-360/${jobId}`,
      tenantScopedHeaders(),
    )

    return {
      ...result,
      preview_url: withAbsoluteBase(result.preview_url),
      download_url: withAbsoluteBase(result.download_url),
    }
  },
}
