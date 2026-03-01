import { api } from './client.js'
import { shouldUseDemoFallback } from './client.js'
import { validateProject as validateDemoProject } from './demoBackend.js'

export interface RuleViolation {
  severity: 'error' | 'warning' | 'hint'
  code: string
  message: string
  affected_ids: string[]
}

export interface ValidateResponse {
  valid: boolean
  violations: RuleViolation[]
  errors: RuleViolation[]
  warnings: RuleViolation[]
  hints: RuleViolation[]
}

export interface ValidatePayload {
  user_id: string
  roomPolygon: Array<{ x_mm: number; y_mm: number }>
  objects: Array<{
    id: string
    type: 'base' | 'wall' | 'tall' | 'appliance'
    wall_id: string
    offset_mm: number
    width_mm: number
    depth_mm: number
    height_mm: number
    worldPos?: { x_mm: number; y_mm: number }
  }>
  openings?: Array<{ id: string; wall_id: string; offset_mm: number; width_mm: number }>
  walls?: Array<{ id: string; start: { x_mm: number; y_mm: number }; end: { x_mm: number; y_mm: number }; length_mm: number }>
  ceilingConstraints?: Array<{
    wall_id: string
    wall_start: { x_mm: number; y_mm: number }
    wall_end: { x_mm: number; y_mm: number }
    kniestock_height_mm: number
    slope_angle_deg: number
    depth_into_room_mm: number
  }>
  nominalCeilingMm?: number
}

export const validateApi = {
  run: async (projectId: string, payload: ValidatePayload): Promise<ValidateResponse> => {
    try {
      return await api.post<ValidateResponse>(`/projects/${projectId}/validate`, payload)
    } catch (error) {
      if (shouldUseDemoFallback(error)) return validateDemoProject(payload)
      throw error
    }
  },
}
