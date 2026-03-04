import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { contactsApi, type Contact } from '../api/contacts.js'
import {
  dashboardsApi,
  type DashboardConfigResponse,
  type DashboardLayout,
  type DashboardLayoutItem,
  type DashboardWidgetConfig,
  type DashboardWidgetId,
  type SalesChartResponse,
} from '../api/dashboards.js'
import { projectsApi, type Project } from '../api/projects.js'
import { useLocale } from '../hooks/useLocale.js'
import styles from './BIDashboard.module.css'

const TENANT_ID_PLACEHOLDER = '00000000-0000-0000-0000-000000000001'
const USER_ID_PLACEHOLDER = '11111111-1111-1111-1111-111111111111'

const DEFAULT_WIDGETS: DashboardWidgetConfig[] = [
  { id: 'sales_chart', title: 'Umsatzverlauf' },
  { id: 'kpi_cards', title: 'KPI Karten' },
  { id: 'current_projects', title: 'Aktuelle Projekte' },
  { id: 'current_contacts', title: 'Kontakte / Leads' },
  { id: 'project_pipeline', title: 'Projektpipeline' },
]

const DEFAULT_LAYOUT: DashboardLayout = {
  columns: 12,
  items: [
    { widget_id: 'sales_chart', x: 0, y: 0, w: 8, h: 4 },
    { widget_id: 'kpi_cards', x: 8, y: 0, w: 4, h: 4 },
    { widget_id: 'current_projects', x: 0, y: 4, w: 6, h: 4 },
    { widget_id: 'current_contacts', x: 6, y: 4, w: 6, h: 4 },
    { widget_id: 'project_pipeline', x: 0, y: 8, w: 12, h: 4 },
  ],
}

const WIDGET_LABELS: Record<DashboardWidgetId, string> = {
  sales_chart: 'Umsatzverlauf',
  current_projects: 'Aktuelle Projekte',
  current_contacts: 'Kontakte / Leads',
  kpi_cards: 'KPI Karten',
  project_pipeline: 'Projektpipeline',
}

type WidgetWidth = 4 | 6 | 8 | 12

function formatEur(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

function sortLayoutItems(items: DashboardLayoutItem[]) {
  return [...items].sort((left, right) => {
    if (left.y !== right.y) {
      return left.y - right.y
    }
    return left.x - right.x
  })
}

function packLayout(widgetIds: DashboardWidgetId[], widthByWidget: Partial<Record<DashboardWidgetId, WidgetWidth>>): DashboardLayout {
  let x = 0
  let y = 0
  let rowHeight = 4

  const items = widgetIds.map((widgetId) => {
    const w = widthByWidget[widgetId] ?? 6
    if (x + w > 12) {
      x = 0
      y += rowHeight
    }

    const item = { widget_id: widgetId, x, y, w, h: 4 }
    x += w
    rowHeight = Math.max(rowHeight, item.h)

    if (x >= 12) {
      x = 0
      y += rowHeight
      rowHeight = 4
    }

    return item
  })

  return {
    columns: 12,
    items,
  }
}

function buildDefaultConfig(userId: string, tenantId: string): DashboardConfigResponse {
  return {
    id: null,
    user_id: userId,
    tenant_id: tenantId,
    widgets: DEFAULT_WIDGETS,
    layout: DEFAULT_LAYOUT,
  }
}

function getWidgetOrder(config: DashboardConfigResponse): DashboardWidgetId[] {
  const layoutOrder = sortLayoutItems(config.layout.items).map((item) => item.widget_id)
  const fallback = config.widgets.map((widget) => widget.id)
  return Array.from(new Set([...layoutOrder, ...fallback])) as DashboardWidgetId[]
}

function getWidthMap(layout: DashboardLayout): Partial<Record<DashboardWidgetId, WidgetWidth>> {
  return layout.items.reduce((acc, item) => {
    acc[item.widget_id] = item.w as WidgetWidth
    return acc
  }, {} as Partial<Record<DashboardWidgetId, WidgetWidth>>)
}

function getWidgetConfigMap(config: DashboardConfigResponse): Record<DashboardWidgetId, DashboardWidgetConfig> {
  return config.widgets.reduce((acc, widget) => {
    acc[widget.id] = widget
    return acc
  }, {} as Record<DashboardWidgetId, DashboardWidgetConfig>)
}

export function BIDashboard() {
  const navigate = useNavigate()
  const { locale } = useLocale()
  const [tenantId, setTenantId] = useState(TENANT_ID_PLACEHOLDER)
  const [userId, setUserId] = useState(USER_ID_PLACEHOLDER)
  const [period, setPeriod] = useState<'month' | 'last_month' | 'year'>('month')
  const [dashboardConfig, setDashboardConfig] = useState<DashboardConfigResponse | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [salesChart, setSalesChart] = useState<SalesChartResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function loadDashboard() {
    if (!tenantId.trim() || !userId.trim()) {
      setError('Tenant-ID und User-ID sind erforderlich.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const [config, chart, board, contactList] = await Promise.all([
        dashboardsApi.getDashboard(userId.trim(), tenantId.trim()),
        dashboardsApi.getSalesChart(tenantId.trim(), period),
        projectsApi.board({ user_id: userId.trim() }),
        contactsApi.list(),
      ])

      setDashboardConfig(config)
      setSalesChart(chart)
      setProjects(board)
      setContacts(contactList)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Dashboard-Daten konnten nicht geladen werden.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadDashboard()
  }, [tenantId, userId, period])

  const workingConfig = dashboardConfig ?? buildDefaultConfig(userId, tenantId)
  const widgetOrder = getWidgetOrder(workingConfig)
  const widthMap = getWidthMap(workingConfig.layout)
  const widgetConfigMap = getWidgetConfigMap(workingConfig)

  const projectPipeline = useMemo(() => {
    const counts = new Map<Project['project_status'], number>()
    for (const project of projects) {
      counts.set(project.project_status, (counts.get(project.project_status) ?? 0) + 1)
    }
    return counts
  }, [projects])

  const kpis = useMemo(() => {
    const activeProjects = projects.length
    const leadProjects = projects.filter((project) => project.project_status === 'lead').length
    const totalQuoteValue = projects.reduce((sum, project) => sum + (project.quote_value ?? 0), 0)
    const avgQuoteValue = activeProjects > 0 ? totalQuoteValue / activeProjects : 0

    return [
      { label: 'Aktive Projekte', value: String(activeProjects) },
      { label: 'Leads', value: String(leadProjects) },
      { label: 'Kontakte', value: String(contacts.length) },
      { label: 'Ø Projektwert', value: formatEur(avgQuoteValue, locale) },
    ]
  }, [projects, contacts, locale])

  const salesBars = useMemo(() => {
    const points = salesChart?.points ?? []
    const maxValue = Math.max(...points.map((point) => point.value_net), 1)
    return points.map((point) => ({
      ...point,
      pct: Math.max(8, Math.round((point.value_net / maxValue) * 100)),
    }))
  }, [salesChart])

  function updateLayout(nextOrder: DashboardWidgetId[], nextWidths: Partial<Record<DashboardWidgetId, WidgetWidth>>) {
    const visibleWidgetSet = new Set(nextOrder)
    const widgets = nextOrder
      .filter((widgetId) => visibleWidgetSet.has(widgetId))
      .map((widgetId) => widgetConfigMap[widgetId] ?? DEFAULT_WIDGETS.find((widget) => widget.id === widgetId)!)
    const layout = packLayout(nextOrder, nextWidths)

    setDashboardConfig((current) => ({
      ...(current ?? buildDefaultConfig(userId, tenantId)),
      user_id: userId,
      tenant_id: tenantId,
      widgets,
      layout,
    }))
  }

  function moveWidget(widgetId: DashboardWidgetId, direction: -1 | 1) {
    const currentOrder = [...widgetOrder]
    const index = currentOrder.indexOf(widgetId)
    const nextIndex = index + direction
    if (index < 0 || nextIndex < 0 || nextIndex >= currentOrder.length) {
      return
    }

    const swapped = [...currentOrder]
    ;[swapped[index], swapped[nextIndex]] = [swapped[nextIndex], swapped[index]]
    updateLayout(swapped, widthMap)
  }

  function setWidgetWidth(widgetId: DashboardWidgetId, width: WidgetWidth) {
    updateLayout(widgetOrder, {
      ...widthMap,
      [widgetId]: width,
    })
  }

  function toggleWidget(widgetId: DashboardWidgetId, checked: boolean) {
    if (checked) {
      if (widgetOrder.includes(widgetId)) {
        return
      }
      updateLayout([...widgetOrder, widgetId], widthMap)
      return
    }

    updateLayout(widgetOrder.filter((id) => id !== widgetId), widthMap)
  }

  async function handleSave() {
    if (!dashboardConfig) {
      return
    }

    setSaving(true)
    setError(null)
    try {
      const saved = await dashboardsApi.saveDashboard(userId.trim(), tenantId.trim(), {
        widgets: dashboardConfig.widgets,
        layout: dashboardConfig.layout,
      })
      setDashboardConfig(saved)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Dashboard-Konfiguration konnte nicht gespeichert werden.')
    } finally {
      setSaving(false)
    }
  }

  function handleReset() {
    setDashboardConfig(buildDefaultConfig(userId.trim(), tenantId.trim()))
  }

  function renderWidget(widgetId: DashboardWidgetId) {
    if (widgetId === 'sales_chart') {
      return (
        <div className={styles.chartWidget}>
          <div className={styles.widgetMetaRow}>
            <strong>{formatEur(salesChart?.total_net ?? 0, locale)}</strong>
            <span>{salesChart?.period ?? period}</span>
          </div>
          <div className={styles.chartBars}>
            {salesBars.length === 0 ? (
              <p className={styles.emptyInline}>Noch keine Umsatzdaten im Zeitraum.</p>
            ) : (
              salesBars.map((bar) => (
                <div key={bar.date} className={styles.chartBarCol}>
                  <div className={styles.chartBarTrack}>
                    <div className={styles.chartBarFill} style={{ height: `${bar.pct}%` }} />
                  </div>
                  <span>{bar.date}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )
    }

    if (widgetId === 'kpi_cards') {
      return (
        <div className={styles.kpiGrid}>
          {kpis.map((kpi) => (
            <div key={kpi.label} className={styles.kpiCard}>
              <span>{kpi.label}</span>
              <strong>{kpi.value}</strong>
            </div>
          ))}
        </div>
      )
    }

    if (widgetId === 'current_projects') {
      const topProjects = [...projects]
        .sort((left, right) => (right.updated_at ?? '').localeCompare(left.updated_at ?? ''))
        .slice(0, 5)

      return (
        <div className={styles.listWidget}>
          {topProjects.length === 0 ? (
            <p className={styles.emptyInline}>Keine Projekte gefunden.</p>
          ) : (
            topProjects.map((project) => (
              <button key={project.id} type="button" className={styles.listItem} onClick={() => navigate(`/projects/${project.id}`)}>
                <strong>{project.name}</strong>
                <span>{project.project_status} · {project.deadline ? new Date(project.deadline).toLocaleDateString(locale) : 'ohne Frist'}</span>
              </button>
            ))
          )}
        </div>
      )
    }

    if (widgetId === 'current_contacts') {
      const topContacts = [...contacts]
        .sort((left, right) => (right.updated_at ?? '').localeCompare(left.updated_at ?? ''))
        .slice(0, 5)

      return (
        <div className={styles.listWidget}>
          {topContacts.length === 0 ? (
            <p className={styles.emptyInline}>Keine Kontakte gefunden.</p>
          ) : (
            topContacts.map((contact) => (
              <button key={contact.id} type="button" className={styles.listItem} onClick={() => navigate('/contacts')}>
                <strong>{[contact.first_name, contact.last_name].filter(Boolean).join(' ') || contact.last_name}</strong>
                <span>{contact.project_count} Projekte · {contact.lead_source}</span>
              </button>
            ))
          )}
        </div>
      )
    }

    return (
      <div className={styles.pipelineGrid}>
        {Array.from(projectPipeline.entries()).map(([status, count]) => (
          <div key={status} className={styles.pipelineCard}>
            <span>{status}</span>
            <strong>{count}</strong>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>Phase 3 · Sprint 28</p>
          <h1 className={styles.title}>Personalisierte Dashboards / KPIs</h1>
          <p className={styles.subtitle}>Widget-Layout, Nutzerkonfiguration und KPI-Ansichten mit gespeichertem DashboardConfig-Stand.</p>
        </div>
        <div className={styles.headerActions}>
          <button type="button" className={styles.btnSecondary} onClick={() => navigate('/')}>
            Projektboard
          </button>
          <button type="button" className={styles.btnSecondary} onClick={handleReset}>
            Layout zurücksetzen
          </button>
          <button type="button" className={styles.btnPrimary} onClick={() => void handleSave()} disabled={saving || !dashboardConfig}>
            {saving ? 'Speichere…' : 'Layout speichern'}
          </button>
        </div>
      </header>

      <section className={styles.controlBar}>
        <label className={styles.field}>
          <span>Tenant-ID</span>
          <input value={tenantId} onChange={(event) => setTenantId(event.target.value)} />
        </label>
        <label className={styles.field}>
          <span>User-ID</span>
          <input value={userId} onChange={(event) => setUserId(event.target.value)} />
        </label>
        <label className={styles.field}>
          <span>Zeitraum</span>
          <select value={period} onChange={(event) => setPeriod(event.target.value as 'month' | 'last_month' | 'year')}>
            <option value="month">Aktueller Monat</option>
            <option value="last_month">Letzter Monat</option>
            <option value="year">Aktuelles Jahr</option>
          </select>
        </label>
        <button type="button" className={styles.btnSecondary} onClick={() => void loadDashboard()}>
          Neu laden
        </button>
      </section>

      {error && <div className={styles.error}>{error}</div>}

      <section className={styles.workspace}>
        <aside className={styles.sidebar}>
          <div className={styles.sidebarHeader}>
            <h2>Widget-Konfiguration</h2>
            <span>{widgetOrder.length} aktiv</span>
          </div>

          <div className={styles.configList}>
            {DEFAULT_WIDGETS.map((widget) => {
              const active = widgetOrder.includes(widget.id)
              const widgetConfig = widgetConfigMap[widget.id]
              return (
                <article key={widget.id} className={styles.configCard}>
                  <label className={styles.checkboxRow}>
                    <input
                      type="checkbox"
                      checked={active}
                      onChange={(event) => toggleWidget(widget.id, event.target.checked)}
                    />
                    <span>{widgetConfig?.title ?? widget.title ?? WIDGET_LABELS[widget.id]}</span>
                  </label>

                  {active && (
                    <div className={styles.configActions}>
                      <div className={styles.miniButtonRow}>
                        <button type="button" className={styles.btnGhost} onClick={() => moveWidget(widget.id, -1)}>Nach oben</button>
                        <button type="button" className={styles.btnGhost} onClick={() => moveWidget(widget.id, 1)}>Nach unten</button>
                      </div>
                      <label className={styles.fieldCompact}>
                        <span>Breite</span>
                        <select value={widthMap[widget.id] ?? 6} onChange={(event) => setWidgetWidth(widget.id, Number(event.target.value) as WidgetWidth)}>
                          <option value="4">Kompakt</option>
                          <option value="6">Halb</option>
                          <option value="8">Breit</option>
                          <option value="12">Voll</option>
                        </select>
                      </label>
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        </aside>

        <main className={styles.dashboard}>
          {loading ? (
            <div className={styles.emptyState}>Dashboard wird geladen…</div>
          ) : widgetOrder.length === 0 ? (
            <div className={styles.emptyState}>Keine Widgets aktiv. Wähle links mindestens ein Widget aus.</div>
          ) : (
            <div className={styles.widgetGrid}>
              {sortLayoutItems(workingConfig.layout.items).map((item) => (
                <section
                  key={item.widget_id}
                  className={styles.widgetPanel}
                  style={{ gridColumn: `span ${item.w}` }}
                >
                  <header className={styles.widgetHeader}>
                    <h3>{widgetConfigMap[item.widget_id]?.title ?? WIDGET_LABELS[item.widget_id]}</h3>
                    <span>{item.w}/12</span>
                  </header>
                  {renderWidget(item.widget_id)}
                </section>
              ))}
            </div>
          )}
        </main>
      </section>
    </div>
  )
}
