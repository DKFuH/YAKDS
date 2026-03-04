import { api } from './client.js'

export interface TenantSettingsPayload {
  company_name?: string
  company_street?: string
  company_zip?: string
  company_city?: string
  company_phone?: string
  company_email?: string
  company_web?: string
  iban?: string
  bic?: string
  bank_name?: string
  vat_id?: string
  tax_number?: string
  quote_footer?: string
  logo_url?: string
  currency_code?: string
  navigation_profile?: 'cad' | 'presentation' | 'trackpad'
  invert_y_axis?: boolean
  middle_mouse_pan?: boolean
  touchpad_mode?: 'cad' | 'trackpad'
  zoom_direction?: 'natural' | 'inverted'
}

export interface TenantSettings extends TenantSettingsPayload {
  id?: string
  tenant_id?: string
  created_at?: string
  updated_at?: string
}

export interface TenantPluginInfo {
  id: string
  name: string
}

export interface TenantPluginsResponse {
  available: TenantPluginInfo[]
  enabled: string[]
}

export interface ProjectDefaults {
  default_advisor: string | null
  default_processor: string | null
  default_area_name: string | null
  default_alternative_name: string | null
}

export function getTenantSettings(): Promise<TenantSettings> {
  return api.get<TenantSettings>('/tenant/settings')
}

export function updateTenantSettings(payload: TenantSettingsPayload): Promise<TenantSettings> {
  return api.put<TenantSettings>('/tenant/settings', payload)
}

export function getTenantPlugins(): Promise<TenantPluginsResponse> {
  return api.get<TenantPluginsResponse>('/tenant/plugins')
}

export function updateTenantPlugins(enabled: string[]): Promise<{ enabled: string[] }> {
  return api.put<{ enabled: string[] }>('/tenant/plugins', { enabled })
}

export function getProjectDefaults(): Promise<ProjectDefaults> {
  return api.get<ProjectDefaults>('/tenant/project-defaults')
}

export function updateProjectDefaults(payload: Partial<ProjectDefaults>): Promise<ProjectDefaults> {
  return api.put<ProjectDefaults>('/tenant/project-defaults', payload)
}
