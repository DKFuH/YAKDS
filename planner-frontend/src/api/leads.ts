import { api } from './client.js'

export interface LeadContact {
  name: string
  email: string
  phone?: string
  address?: string
}

export interface LeadConsent {
  marketing: boolean
  data_processing: boolean
  timestamp?: string
}

export interface LeadRoom {
  width_mm: number
  depth_mm: number
  ceiling_height_mm: number
  shape: 'rectangle' | 'l_shape' | 'u_shape'
}

export interface SimpleCabinet {
  id: string
  type: 'base' | 'wall' | 'tall' | 'appliance'
  width_mm: number
  height_mm: number
  depth_mm: number
  label?: string
}

export interface LeadCreatePayload {
  contact: LeadContact
  consent: LeadConsent
  room: LeadRoom
  cabinets?: SimpleCabinet[]
}

export interface Lead {
  id: string
  tenant_id: string
  status: string
  contact_json: LeadContact
  room_json: LeadRoom
  promoted_to_project_id: string | null
  created_at: string
}

export interface LeadPromoteResult {
  lead_id: string
  project_id: string
  project_name: string
  placements_count: number
}

export const leadsApi = {
  create: (tenantId: string, payload: LeadCreatePayload): Promise<Lead> =>
    api.post<Lead>('/leads/create', payload, { 'X-Tenant-Id': tenantId }),

  promote: (
    tenantId: string,
    leadId: string,
    userId: string,
    projectName?: string,
  ): Promise<LeadPromoteResult> =>
    api.post<LeadPromoteResult>(
      `/leads/${leadId}/promote`,
      { user_id: userId, project_name: projectName },
      { 'X-Tenant-Id': tenantId },
    ),
}
