import { api, shouldUseDemoFallback } from './client.js'
import { getDashboardConfig as getDemoDashboardConfig, getDemoSalesChart, saveDashboardConfig as saveDemoDashboardConfig } from './demoBackend.js'

export type DashboardWidgetId =
  | 'sales_chart'
  | 'current_projects'
  | 'current_contacts'
  | 'kpi_cards'
  | 'project_pipeline'

export interface DashboardWidgetConfig {
  id: DashboardWidgetId
  title?: string
  config?: Record<string, unknown>
}

export interface DashboardLayoutItem {
  widget_id: DashboardWidgetId
  x: number
  y: number
  w: number
  h: number
}

export interface DashboardLayout {
  columns: number
  items: DashboardLayoutItem[]
}

export interface DashboardConfigResponse {
  id: string | null
  user_id: string
  tenant_id: string
  widgets: DashboardWidgetConfig[]
  layout: DashboardLayout
  created_at?: string
  updated_at?: string
}

export interface SalesChartPoint {
  date: string
  value_net: number
  quotes: number
}

export interface SalesChartResponse {
  tenant_id: string
  period: 'month' | 'last_month' | 'year'
  from: string
  to: string
  points: SalesChartPoint[]
  total_net: number
}

function tenantHeaders(tenantId: string) {
  return { 'X-Tenant-Id': tenantId }
}

export const dashboardsApi = {
  getDashboard: async (userId: string, tenantId: string): Promise<DashboardConfigResponse> => {
    try {
      return await api.get<DashboardConfigResponse>(`/dashboards/${userId}`, tenantHeaders(tenantId))
    } catch (error) {
      if (shouldUseDemoFallback(error)) {
        return getDemoDashboardConfig(userId, tenantId) as DashboardConfigResponse
      }
      throw error
    }
  },

  saveDashboard: (
    userId: string,
    tenantId: string,
    payload: { widgets: DashboardWidgetConfig[]; layout: DashboardLayout },
  ): Promise<DashboardConfigResponse> =>
    api.put<DashboardConfigResponse>(`/dashboards/${userId}`, payload, tenantHeaders(tenantId)).catch((error) => {
      if (shouldUseDemoFallback(error)) {
        return saveDemoDashboardConfig(userId, tenantId, payload) as DashboardConfigResponse
      }
      throw error
    }),

  getSalesChart: (
    tenantId: string,
    period: 'month' | 'last_month' | 'year' = 'month',
  ): Promise<SalesChartResponse> =>
    api.get<SalesChartResponse>(`/kpis/sales-chart?period=${period}`, tenantHeaders(tenantId)).catch((error) => {
      if (shouldUseDemoFallback(error)) {
        return getDemoSalesChart(period)
      }
      throw error
    }),
}
