import { api } from './client.js'
import type { QuoteLine, PricingGroup, Macro } from '@shared/types'

// Quote lines (Sprint 40)
export const quoteLinesApi = {
  list: (projectId: string) =>
    api.get<QuoteLine[]>(`/projects/${projectId}/quote-lines`),

  create: (projectId: string, line: Omit<QuoteLine, 'id' | 'project_id'>) =>
    api.post<QuoteLine>(`/projects/${projectId}/quote-lines`, line),

  update: (projectId: string, lineId: string, data: Partial<Omit<QuoteLine, 'id' | 'project_id'>>) =>
    api.patch<QuoteLine>(`/projects/${projectId}/quote-lines/${lineId}`, data),

  delete: (projectId: string, lineId: string) =>
    api.delete(`/projects/${projectId}/quote-lines/${lineId}`),
}

// Pricing groups (Sprint 40)
export const pricingGroupsApi = {
  list: (projectId: string) =>
    api.get<PricingGroup[]>(`/projects/${projectId}/pricing-groups`),

  create: (projectId: string, group: Omit<PricingGroup, 'id' | 'project_id'>) =>
    api.post<PricingGroup>(`/projects/${projectId}/pricing-groups`, group),
}

// Macros (Sprint 35)
export const macrosApi = {
  list: (projectId: string) =>
    api.get<Macro[]>(`/projects/${projectId}/macros`),

  create: (projectId: string, macro: Omit<Macro, 'id' | 'created_at'>) =>
    api.post<Macro>(`/projects/${projectId}/macros`, macro),

  delete: (projectId: string, macroId: string) =>
    api.delete(`/projects/${projectId}/macros/${macroId}`),
}
