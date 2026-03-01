import { api } from './client.js'

export type RuleCategory = 'collision' | 'clearance' | 'ergonomics' | 'completeness' | 'accessory'
export type RuleSeverity = 'error' | 'warning' | 'hint'

export interface ValidateV2Violation {
  id: string
  rule_key: string
  severity: RuleSeverity
  entity_refs_json: string[]
  message: string
  hint?: string | null
  auto_fix_possible: boolean
}

export interface ValidateV2Summary {
  total: number
  errors: number
  warnings: number
  hints: number
}

export interface ValidateV2Result {
  run_id: string
  project_id: string
  run_at: string
  summary: ValidateV2Summary
  valid: boolean
  violations: ValidateV2Violation[]
}

export interface ValidateV2Placement {
  id: string
  wall_id: string
  offset_mm: number
  width_mm: number
  depth_mm: number
  height_mm: number
  type: 'base' | 'wall' | 'tall' | 'appliance'
  door_swing?: 'left' | 'right' | 'none'
  has_handle_boring?: boolean
}

export interface ValidateV2Payload {
  room_id: string
  placements: ValidateV2Placement[]
  ceiling_height_mm?: number
  min_clearance_mm?: number
}

export interface RuleRunHistory {
  id: string
  project_id: string
  run_at: string
  summary_json: ValidateV2Summary
  violations: ValidateV2Violation[]
}

export function categoryFromKey(key: string): RuleCategory {
  if (key.startsWith('COLL')) return 'collision'
  if (key.startsWith('CLEAR')) return 'clearance'
  if (key.startsWith('ERG')) return 'ergonomics'
  if (key.startsWith('COMP')) return 'completeness'
  return 'accessory'
}

export const validateV2Api = {
  run: (projectId: string, tenantId: string, payload: ValidateV2Payload): Promise<ValidateV2Result> =>
    api.post<ValidateV2Result>(`/projects/${projectId}/validate-v2`, payload, { 'X-Tenant-Id': tenantId }),

  history: (projectId: string, tenantId: string): Promise<RuleRunHistory[]> =>
    api.get<RuleRunHistory[]>(`/projects/${projectId}/validate-v2/history`, { 'X-Tenant-Id': tenantId }),
}
