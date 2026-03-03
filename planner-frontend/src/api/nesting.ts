import { api } from './client.js'

export interface NestingJob {
  id: string
  tenant_id: string
  project_id: string
  source_cutlist_id: string
  sheet_width_mm: number
  sheet_height_mm: number
  kerf_mm: number
  allow_rotate: boolean
  status: 'draft' | 'calculated' | 'exported'
  result_json: NestingResult
  created_at: string
  updated_at: string
}

export interface NestingSheetPlacement {
  part_id: string
  x_mm: number
  y_mm: number
  width_mm: number
  height_mm: number
  rotated: boolean
}

export interface NestingSheet {
  index: number
  width_mm: number
  height_mm: number
  used_area_mm2: number
  waste_area_mm2: number
  placements: NestingSheetPlacement[]
}

export interface NestingResult {
  sheets: NestingSheet[]
  total_parts: number
  placed_parts: number
  waste_pct: number
}

export const nestingApi = {
  createNestingJob: (
    projectId: string,
    payload: {
      source_cutlist_id: string
      sheet_width_mm: number
      sheet_height_mm: number
      kerf_mm?: number
      allow_rotate?: boolean
    },
  ) => api.post<NestingJob>(`/projects/${projectId}/nesting-jobs`, payload),

  listNestingJobs: (projectId: string) =>
    api.get<NestingJob[]>(`/projects/${projectId}/nesting-jobs`),

  getNestingJob: (jobId: string) =>
    api.get<NestingJob>(`/nesting-jobs/${jobId}`),

  deleteNestingJob: (jobId: string) =>
    api.delete(`/nesting-jobs/${jobId}`),

  downloadNestingDxf: async (jobId: string) => {
    const response = await fetch(`/api/v1/nesting-jobs/${jobId}/export/dxf`)
    if (!response.ok) {
      const body = await response.json().catch(() => ({ message: response.statusText })) as { message?: string }
      throw new Error(body.message ?? 'DXF Export fehlgeschlagen')
    }
    return response.blob()
  },
}
