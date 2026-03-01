import { api, shouldUseDemoFallback } from './client.js'
import { attachContactToProject as attachDemoContactToProject, createContact as createDemoContact, listContacts as listDemoContacts } from './demoBackend.js'

export type ContactType = 'end_customer' | 'architect' | 'contractor'
export type ContactLeadSource = 'web_planner' | 'showroom' | 'referral' | 'other'

export interface ContactProjectSummary {
  id: string
  name: string
  quote_value: number | null
  lead_status: string | null
  project_status: string
  is_primary: boolean
}

export interface Contact {
  id: string
  tenant_id: string
  type: ContactType
  company: string | null
  first_name: string | null
  last_name: string
  email: string | null
  phone: string | null
  address_json: Record<string, unknown>
  lead_source: ContactLeadSource
  budget_estimate: number | null
  notes: string | null
  created_at: string
  updated_at?: string
  project_count: number
  revenue_total: number
  conversion_pct: number
  projects: ContactProjectSummary[]
}

export interface CreateContactPayload {
  type?: ContactType
  company?: string | null
  first_name?: string | null
  last_name: string
  email?: string | null
  phone?: string | null
  address?: {
    street?: string | null
    zip?: string | null
    city?: string | null
    country?: string | null
  }
  lead_source?: ContactLeadSource
  budget_estimate?: number | null
  notes?: string | null
}

const TENANT_ID_PLACEHOLDER = '00000000-0000-0000-0000-000000000001'

export const contactsApi = {
  list: async (search?: string) => {
    const query = new URLSearchParams()
    if (search?.trim()) {
      query.set('search', search.trim())
    }
    const suffix = query.toString() ? `?${query.toString()}` : ''
    try {
      return await api.get<Contact[]>(`/contacts${suffix}`, { 'X-Tenant-Id': TENANT_ID_PLACEHOLDER })
    } catch (error) {
      if (shouldUseDemoFallback(error)) return listDemoContacts(search)
      throw error
    }
  },
  create: async (payload: CreateContactPayload) => {
    try {
      return await api.post<Contact>('/contacts', payload, { 'X-Tenant-Id': TENANT_ID_PLACEHOLDER })
    } catch (error) {
      if (shouldUseDemoFallback(error)) return createDemoContact(TENANT_ID_PLACEHOLDER, payload)
      throw error
    }
  },
  attachToProject: async (projectId: string, contactId: string) => {
    try {
      return await api.post(`/projects/${projectId}/contacts/${contactId}`, {}, { 'X-Tenant-Id': TENANT_ID_PLACEHOLDER })
    } catch (error) {
      if (shouldUseDemoFallback(error)) return attachDemoContactToProject(projectId, contactId)
      throw error
    }
  },
}
