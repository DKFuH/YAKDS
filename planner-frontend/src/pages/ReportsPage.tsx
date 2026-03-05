import { useEffect, useMemo, useState } from 'react'
import {
  reportsApi,
  type LeadFunnelResponse,
  type ReportDefinition,
  type ReportRun,
  type RevenueByPeriodResponse,
  type SalesRankingResponse,
} from '../api/reports.js'
import styles from './ReportsPage.module.css'

type TabId = 'builtin' | 'builder' | 'history'

type Loadable<T> = {
  loading: boolean
  error: string | null
  data: T
}

const TENANT_ID = '00000000-0000-0000-0000-000000000001'

const DIMENSIONS = ['period', 'branch', 'sales_rep', 'category'] as const
const METRICS = ['revenue', 'margin', 'conversion'] as const

function formatEur(value: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 2,
  }).format(value)
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function ReportsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('builtin')

  const [revenueState, setRevenueState] = useState<Loadable<RevenueByPeriodResponse>>({
    loading: true,
    error: null,
    data: { rows: [] },
  })
  const [funnelState, setFunnelState] = useState<Loadable<LeadFunnelResponse>>({
    loading: true,
    error: null,
    data: { stages: [] },
  })
  const [rankingState, setRankingState] = useState<Loadable<SalesRankingResponse>>({
    loading: true,
    error: null,
    data: { rows: [] },
  })

  const [reports, setReports] = useState<ReportDefinition[]>([])
  const [reportsLoading, setReportsLoading] = useState(true)
  const [reportsError, setReportsError] = useState<string | null>(null)

  const [runs, setRuns] = useState<ReportRun[]>([])
  const [runsLoading, setRunsLoading] = useState(true)
  const [runsError, setRunsError] = useState<string | null>(null)

  const [isCreateModalOpen, setCreateModalOpen] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createDescription, setCreateDescription] = useState('')
  const [createDimensions, setCreateDimensions] = useState<string[]>(['period'])
  const [createMetrics, setCreateMetrics] = useState<string[]>(['revenue'])
  const [createError, setCreateError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [runningReportId, setRunningReportId] = useState<string | null>(null)

  async function loadBuiltinReports() {
    setRevenueState((current) => ({ ...current, loading: true, error: null }))
    setFunnelState((current) => ({ ...current, loading: true, error: null }))
    setRankingState((current) => ({ ...current, loading: true, error: null }))

    try {
      const data = await reportsApi.revenueByPeriod(TENANT_ID, 'last_30_days')
      setRevenueState({ loading: false, error: null, data })
    } catch (e: unknown) {
      setRevenueState({ loading: false, error: e instanceof Error ? e.message : 'Laden fehlgeschlagen', data: { rows: [] } })
    }

    try {
      const data = await reportsApi.leadFunnel(TENANT_ID)
      setFunnelState({ loading: false, error: null, data })
    } catch (e: unknown) {
      setFunnelState({ loading: false, error: e instanceof Error ? e.message : 'Laden fehlgeschlagen', data: { stages: [] } })
    }

    try {
      const data = await reportsApi.salesRanking(TENANT_ID)
      setRankingState({ loading: false, error: null, data })
    } catch (e: unknown) {
      setRankingState({ loading: false, error: e instanceof Error ? e.message : 'Laden fehlgeschlagen', data: { rows: [] } })
    }
  }

  async function loadReportDefinitions() {
    setReportsLoading(true)
    setReportsError(null)
    try {
      const list = await reportsApi.list(TENANT_ID)
      setReports(list)
    } catch (e: unknown) {
      setReportsError(e instanceof Error ? e.message : 'Reports konnten nicht geladen werden')
    } finally {
      setReportsLoading(false)
    }
  }

  async function loadRuns() {
    setRunsLoading(true)
    setRunsError(null)
    try {
      const list = await reportsApi.listRuns(TENANT_ID)
      setRuns(list)
    } catch (e: unknown) {
      setRunsError(e instanceof Error ? e.message : 'Ausführungshistorie konnte nicht geladen werden')
    } finally {
      setRunsLoading(false)
    }
  }

  useEffect(() => {
    void loadBuiltinReports()
    void loadReportDefinitions()
    void loadRuns()
  }, [])

  const revenueMax = useMemo(() => Math.max(1, ...revenueState.data.rows.map((row) => row.revenue)), [revenueState.data.rows])
  const funnelMax = useMemo(() => Math.max(1, ...funnelState.data.stages.map((stage) => stage.count)), [funnelState.data.stages])

  function toggleInArray(current: string[], value: string): string[] {
    return current.includes(value)
      ? current.filter((item) => item !== value)
      : [...current, value]
  }

  async function handleCreateReport() {
    if (!createName.trim()) {
      setCreateError('Name ist erforderlich.')
      return
    }

    setCreateError(null)
    setCreating(true)
    try {
      await reportsApi.create(TENANT_ID, {
        tenant_id: TENANT_ID,
        name: createName.trim(),
        description: createDescription.trim() ? createDescription.trim() : null,
        dimensions: createDimensions,
        metrics: createMetrics,
        filters: {},
        created_by: 'reports-ui',
      })

      setCreateModalOpen(false)
      setCreateName('')
      setCreateDescription('')
      setCreateDimensions(['period'])
      setCreateMetrics(['revenue'])
      await loadReportDefinitions()
    } catch (e: unknown) {
      setCreateError(e instanceof Error ? e.message : 'Report konnte nicht erstellt werden')
    } finally {
      setCreating(false)
    }
  }

  async function handleRunReport(reportId: string) {
    setRunningReportId(reportId)
    try {
      await reportsApi.run(TENANT_ID, reportId)
      await loadRuns()
    } catch {
      // Fehleranzeige erfolgt über Ausführungshistorie-Ladefehler nicht granular pro Zeile
    } finally {
      setRunningReportId(null)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Reports</h1>
      </div>

      <div className={styles.tabs}>
        <button type="button" className={activeTab === 'builtin' ? styles.tabActive : styles.tab} onClick={() => setActiveTab('builtin')}>
          Standard-Reports
        </button>
        <button type="button" className={activeTab === 'builder' ? styles.tabActive : styles.tab} onClick={() => setActiveTab('builder')}>
          Report-Builder
        </button>
        <button type="button" className={activeTab === 'history' ? styles.tabActive : styles.tab} onClick={() => setActiveTab('history')}>
          Ausführungshistorie
        </button>
      </div>

      {activeTab === 'builtin' && (
        <section className={styles.content}>
          <article className={styles.card}>
            <h2>Umsatz nach Zeitraum</h2>
            {revenueState.loading && <p className={styles.hint}>Laden …</p>}
            {revenueState.error && <p className={styles.error}>{revenueState.error}</p>}
            {!revenueState.loading && !revenueState.error && (
              <>
                {revenueState.data.rows.length === 0 ? (
                  <p className={styles.hint}>Keine Daten vorhanden.</p>
                ) : (
                  <svg viewBox="0 0 420 180" className={styles.chart} role="img" aria-label="Umsatz als Balkendiagramm">
                    {revenueState.data.rows.map((row, index) => {
                      const barWidth = 32
                      const gap = 16
                      const x = 20 + index * (barWidth + gap)
                      const height = Math.max(6, Math.round((row.revenue / revenueMax) * 120))
                      const y = 145 - height
                      return (
                        <g key={row.period}>
                          <rect x={x} y={y} width={barWidth} height={height} rx={4} className={styles.bar} />
                          <text x={x + barWidth / 2} y={165} textAnchor="middle" className={styles.axisText}>{row.period.slice(5)}</text>
                        </g>
                      )
                    })}
                  </svg>
                )}
              </>
            )}
          </article>

          <article className={styles.card}>
            <h2>Lead-Trichter</h2>
            {funnelState.loading && <p className={styles.hint}>Laden …</p>}
            {funnelState.error && <p className={styles.error}>{funnelState.error}</p>}
            {!funnelState.loading && !funnelState.error && (
              <>
                {funnelState.data.stages.length === 0 ? (
                  <p className={styles.hint}>Keine Daten vorhanden.</p>
                ) : (
                  <svg viewBox="0 0 420 220" className={styles.chart} role="img" aria-label="Lead-Trichter als gestapelte Balken">
                    {funnelState.data.stages.map((stage, index) => {
                      const width = Math.max(24, Math.round((stage.count / funnelMax) * 360))
                      const x = 20 + Math.round((360 - width) / 2)
                      const y = 18 + index * 32
                      return (
                        <g key={stage.status}>
                          <rect x={x} y={y} width={width} height={20} rx={8} className={styles.funnelBar} />
                          <text x={25} y={y + 14} className={styles.axisText}>{stage.status}</text>
                          <text x={x + width - 6} y={y + 14} textAnchor="end" className={styles.axisText}>{stage.count}</text>
                        </g>
                      )
                    })}
                  </svg>
                )}
              </>
            )}
          </article>

          <article className={styles.card}>
            <h2>Verkäufer-Ranking</h2>
            {rankingState.loading && <p className={styles.hint}>Laden …</p>}
            {rankingState.error && <p className={styles.error}>{rankingState.error}</p>}
            {!rankingState.loading && !rankingState.error && (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Verkäufer</th>
                    <th>Umsatz</th>
                    <th>Projekte</th>
                  </tr>
                </thead>
                <tbody>
                  {rankingState.data.rows.length === 0 && (
                    <tr><td colSpan={3} className={styles.hint}>Keine Daten vorhanden.</td></tr>
                  )}
                  {rankingState.data.rows.map((row) => (
                    <tr key={row.sales_rep}>
                      <td>{row.sales_rep}</td>
                      <td>{formatEur(row.revenue)}</td>
                      <td>{row.projects}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </article>
        </section>
      )}

      {activeTab === 'builder' && (
        <section className={styles.contentSingle}>
          <div className={styles.toolbar}>
            <h2>Gespeicherte Reports</h2>
            <button type="button" className={styles.primaryBtn} onClick={() => setCreateModalOpen(true)}>
              Neuer Report
            </button>
          </div>

          {reportsLoading && <p className={styles.hint}>Laden …</p>}
          {reportsError && <p className={styles.error}>{reportsError}</p>}

          {!reportsLoading && !reportsError && (
            <ul className={styles.reportList}>
              {reports.length === 0 && <li className={styles.hint}>Noch keine Report-Definitionen vorhanden.</li>}
              {reports.map((report) => (
                <li key={report.id} className={styles.reportItem}>
                  <div>
                    <strong>{report.name}</strong>
                    {report.description && <p className={styles.smallText}>{report.description}</p>}
                    <p className={styles.smallText}>Dimensionen: {report.dimensions.join(', ') || '–'} · Metriken: {report.metrics.join(', ') || '–'}</p>
                  </div>
                  <button
                    type="button"
                    className={styles.secondaryBtn}
                    disabled={runningReportId === report.id}
                    onClick={() => void handleRunReport(report.id)}
                  >
                    {runningReportId === report.id ? 'Läuft …' : 'Ausführen'}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {activeTab === 'history' && (
        <section className={styles.contentSingle}>
          <h2>Ausführungshistorie</h2>
          {runsLoading && <p className={styles.hint}>Laden …</p>}
          {runsError && <p className={styles.error}>{runsError}</p>}
          {!runsLoading && !runsError && (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Report</th>
                  <th>Datum</th>
                  <th>Status</th>
                  <th>Download</th>
                </tr>
              </thead>
              <tbody>
                {runs.length === 0 && <tr><td colSpan={4} className={styles.hint}>Noch keine Runs vorhanden.</td></tr>}
                {runs.map((run) => (
                  <tr key={run.id}>
                    <td>{run.report_name}</td>
                    <td>{formatDateTime(run.generated_at)}</td>
                    <td>{run.status}</td>
                    <td>
                      {run.file_url ? (
                        <a href={run.file_url} target="_blank" rel="noreferrer">Download</a>
                      ) : (
                        <span className={styles.hint}>–</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      {isCreateModalOpen && (
        <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="report-create-title">
          <div className={styles.modal}>
            <h3 id="report-create-title">Neuer Report</h3>

            <label className={styles.label}>
              Name
              <input value={createName} onChange={(event) => setCreateName(event.target.value)} className={styles.input} />
            </label>

            <label className={styles.label}>
              Beschreibung
              <textarea
                value={createDescription}
                onChange={(event) => setCreateDescription(event.target.value)}
                className={styles.textarea}
                rows={3}
              />
            </label>

            <div className={styles.fieldGroup}>
              <p className={styles.fieldTitle}>Dimensionen</p>
              <div className={styles.chipGrid}>
                {DIMENSIONS.map((dimension) => (
                  <label key={dimension} className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={createDimensions.includes(dimension)}
                      onChange={() => setCreateDimensions((current) => toggleInArray(current, dimension))}
                    />
                    {dimension}
                  </label>
                ))}
              </div>
            </div>

            <div className={styles.fieldGroup}>
              <p className={styles.fieldTitle}>Metriken</p>
              <div className={styles.chipGrid}>
                {METRICS.map((metric) => (
                  <label key={metric} className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={createMetrics.includes(metric)}
                      onChange={() => setCreateMetrics((current) => toggleInArray(current, metric))}
                    />
                    {metric}
                  </label>
                ))}
              </div>
            </div>

            {createError && <p className={styles.error}>{createError}</p>}

            <div className={styles.modalActions}>
              <button type="button" className={styles.secondaryBtn} onClick={() => setCreateModalOpen(false)}>
                Abbrechen
              </button>
              <button type="button" className={styles.primaryBtn} onClick={() => void handleCreateReport()} disabled={creating}>
                {creating ? 'Speichern …' : 'Speichern'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
