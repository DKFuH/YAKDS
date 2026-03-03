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
}

export interface TenantSettings extends TenantSettingsPayload {
  id?: string
  tenant_id?: string
  created_at?: string
  updated_at?: string
}

export function getTenantSettings(): Promise<TenantSettings> {
  return api.get<TenantSettings>('/tenant/settings')
}

export function updateTenantSettings(payload: TenantSettingsPayload): Promise<TenantSettings> {
  return api.put<TenantSettings>('/tenant/settings', payload)
}
