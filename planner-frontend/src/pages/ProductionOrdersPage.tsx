import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Badge,
  Body1,
  Body1Strong,
  Button,
  Caption1,
  Card,
  MessageBar,
  MessageBarBody,
  Option,
  Select,
  Spinner,
  Title2,
  makeStyles,
  tokens,
} from '@fluentui/react-components'
import { productionOrdersApi, type ProductionOrder, type ProductionOrderStatus } from '../api/productionOrders.js'
import { projectsApi, type Project } from '../api/projects.js'

const STATUS_LABELS: Record<ProductionOrderStatus, string> = {
  draft: 'Entwurf',
  confirmed: 'Bestaetigt',
  in_production: 'In Produktion',
  ready: 'Fertig',
  delivered: 'Geliefert',
  installed: 'Montiert',
}

const STATUS_NEXT: Partial<Record<ProductionOrderStatus, ProductionOrderStatus>> = {
  draft: 'confirmed',
  confirmed: 'in_production',
  in_production: 'ready',
  ready: 'delivered',
  delivered: 'installed',
}

const STATUS_INTENT: Record<ProductionOrderStatus, 'informative' | 'warning' | 'success' | 'error'> = {
  draft: 'informative',
  confirmed: 'informative',
  in_production: 'warning',
  ready: 'success',
  delivered: 'success',
  installed: 'success',
}

function formatDate(iso: string | null): string {
  if (!iso) return '–'
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

const useStyles = makeStyles({
  shell: {
    display: 'grid',
    gridTemplateRows: 'auto 1fr',
    gap: tokens.spacingVerticalM,
    minHeight: '70vh',
  },
  body: {
    display: 'grid',
    gridTemplateColumns: '280px 1fr',
    gap: tokens.spacingHorizontalM,
    alignItems: 'start',
    '@media (max-width: 768px)': {
      gridTemplateColumns: '1fr',
    },
  },
  sidebar: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
  },
  orderList: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
  },
  orderItem: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalS}`,
    borderRadius: tokens.borderRadiusMedium,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    background: 'transparent',
    cursor: 'pointer',
    textAlign: 'left',
    width: '100%',
    fontSize: tokens.fontSizeBase300,
  },
  orderItemActive: {
    background: tokens.colorBrandBackground2,
    border: `1px solid ${tokens.colorBrandStroke1}`,
  },
  statusDot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    flexShrink: 0,
  },
  workflowBar: {
    display: 'flex',
    gap: tokens.spacingHorizontalXS,
    flexWrap: 'wrap',
    marginBottom: tokens.spacingVerticalM,
  },
  workflowStep: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXS,
    padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalS}`,
    borderRadius: tokens.borderRadiusMedium,
    background: tokens.colorNeutralBackground3,
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
  },
  workflowDone: {
    background: tokens.colorPaletteGreenBackground2,
    color: tokens.colorPaletteGreenForeground2,
  },
  workflowCurrent: {
    background: tokens.colorBrandBackground,
    color: tokens.colorNeutralForegroundInverted,
    fontWeight: tokens.fontWeightSemibold,
  },
  metaGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
    gap: tokens.spacingHorizontalM,
    marginBottom: tokens.spacingVerticalM,
  },
  metaItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXXS,
  },
  freezeNotice: {
    background: tokens.colorPaletteLightTealBackground2,
    border: `1px solid ${tokens.colorPaletteLightGreenBorder1}`,
    borderRadius: tokens.borderRadiusMedium,
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    marginBottom: tokens.spacingVerticalM,
    fontSize: tokens.fontSizeBase300,
  },
  tableWrap: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: tokens.fontSizeBase300 },
  th: {
    textAlign: 'left',
    padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalS}`,
    borderBottom: `2px solid ${tokens.colorNeutralStroke1}`,
    fontWeight: tokens.fontWeightSemibold,
  },
  td: {
    padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalS}`,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  eventList: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
  },
  eventItem: {
    display: 'flex',
    gap: tokens.spacingHorizontalS,
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground2,
  },
  placeholder: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '200px',
    color: tokens.colorNeutralForeground3,
    textAlign: 'center',
  },
})

export function ProductionOrdersPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const styles = useStyles()

  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string>(searchParams.get('projectId') ?? '')
  const [orders, setOrders] = useState<ProductionOrder[]>([])
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<ProductionOrderStatus | 'all'>('all')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [transitioning, setTransitioning] = useState(false)

  useEffect(() => {
    projectsApi.list().then(setProjects).catch(() => {})
  }, [])

  useEffect(() => {
    if (!selectedProjectId) { setOrders([]); return }
    setLoading(true)
    setError(null)
    productionOrdersApi
      .list(selectedProjectId)
      .then(setOrders)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [selectedProjectId])

  function handleProjectChange(id: string) {
    setSelectedProjectId(id)
    setSelectedOrderId(null)
    setSearchParams(id ? { projectId: id } : {})
  }

  async function handleStatusTransition(order: ProductionOrder) {
    const next = STATUS_NEXT[order.status]
    if (!next) return
    setTransitioning(true)
    try {
      const updated = await productionOrdersApi.updateStatus(order.id, next)
      setOrders(prev => prev.map(o => (o.id === updated.id ? updated : o)))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler')
    } finally {
      setTransitioning(false)
    }
  }

  async function handleDelete(order: ProductionOrder) {
    if (!confirm('Produktionsauftrag loeschen?')) return
    try {
      await productionOrdersApi.delete(order.id)
      setOrders(prev => prev.filter(o => o.id !== order.id))
      if (selectedOrderId === order.id) setSelectedOrderId(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler')
    }
  }

  const filtered = statusFilter === 'all' ? orders : orders.filter(o => o.status === statusFilter)
  const selectedOrder = selectedOrderId ? orders.find(o => o.id === selectedOrderId) ?? null : null

  const STATUS_DOT_COLOR: Record<ProductionOrderStatus, string> = {
    draft: tokens.colorNeutralForeground3,
    confirmed: tokens.colorPaletteBlueForeground2,
    in_production: tokens.colorPaletteMarigoldForeground2,
    ready: tokens.colorPaletteGreenForeground2,
    delivered: tokens.colorBrandForeground1,
    installed: tokens.colorPaletteGreenForeground2,
  }

  return (
    <div className={styles.shell}>
      <Title2>Produktionsauftraege</Title2>

      {error && <MessageBar intent='error'><MessageBarBody>{error}</MessageBarBody></MessageBar>}

      <div className={styles.body}>
        <aside className={styles.sidebar}>
          <Card>
            <Body1Strong>Projekt</Body1Strong>
            <Select value={selectedProjectId} onChange={(_e, d) => handleProjectChange(d.value)}>
              <Option value=''>Projekt auswaehlen …</Option>
              {projects.map(p => <Option key={p.id} value={p.id}>{p.name}</Option>)}
            </Select>
            <Body1Strong>Status-Filter</Body1Strong>
            <Select value={statusFilter} onChange={(_e, d) => setStatusFilter(d.value as ProductionOrderStatus | 'all')}>
              <Option value='all'>Alle</Option>
              {(Object.keys(STATUS_LABELS) as ProductionOrderStatus[]).map(s => (
                <Option key={s} value={s}>{STATUS_LABELS[s]}</Option>
              ))}
            </Select>
          </Card>

          <div className={styles.orderList}>
            {loading && <Spinner size='tiny' label='Laden...' />}
            {!loading && !selectedProjectId && <Caption1>Bitte Projekt auswaehlen.</Caption1>}
            {!loading && selectedProjectId && filtered.length === 0 && <Caption1>Keine Auftraege gefunden.</Caption1>}
            {filtered.map(order => (
              <button
                key={order.id}
                type='button'
                className={`${styles.orderItem} ${selectedOrderId === order.id ? styles.orderItemActive : ''}`}
                onClick={() => setSelectedOrderId(selectedOrderId === order.id ? null : order.id)}
              >
                <span className={styles.statusDot} style={{ background: STATUS_DOT_COLOR[order.status] }} />
                <span style={{ flex: 1 }}>
                  <div style={{ fontSize: tokens.fontSizeBase300, fontWeight: tokens.fontWeightSemibold }}>
                    {STATUS_LABELS[order.status]}
                  </div>
                  {order.due_date && <div style={{ fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground3 }}>Faellig: {formatDate(order.due_date)}</div>}
                </span>
                {order.frozen_at && <span title='Eingefroren'>❄</span>}
              </button>
            ))}
          </div>
        </aside>

        <main>
          {!selectedOrder && (
            <div className={styles.placeholder}>
              <Body1>Produktionsauftrag auswaehlen</Body1>
              <Caption1>Wähle links einen Auftrag fuer Details und Status-Workflow.</Caption1>
            </div>
          )}

          {selectedOrder && (
            <Card>
              <div className={styles.workflowBar}>
                {(Object.keys(STATUS_LABELS) as ProductionOrderStatus[]).map((s, idx, arr) => {
                  const statusIdx = arr.indexOf(selectedOrder.status)
                  const isDone = idx < statusIdx
                  const isCurrent = idx === statusIdx
                  return (
                    <div key={s} className={`${styles.workflowStep} ${isDone ? styles.workflowDone : ''} ${isCurrent ? styles.workflowCurrent : ''}`}>
                      {STATUS_LABELS[s]}
                    </div>
                  )
                })}
              </div>

              <div className={styles.metaGrid}>
                <div className={styles.metaItem}>
                  <Caption1>Status</Caption1>
                  <Badge appearance='tint' color={STATUS_INTENT[selectedOrder.status] === 'success' ? 'success' : STATUS_INTENT[selectedOrder.status] === 'warning' ? 'warning' : 'informative'}>
                    {STATUS_LABELS[selectedOrder.status]}
                  </Badge>
                </div>
                <div className={styles.metaItem}>
                  <Caption1>Angelegt von</Caption1>
                  <Body1>{selectedOrder.created_by}</Body1>
                </div>
                <div className={styles.metaItem}>
                  <Caption1>Erstellt</Caption1>
                  <Body1>{formatDate(selectedOrder.created_at)}</Body1>
                </div>
                <div className={styles.metaItem}>
                  <Caption1>Faellig</Caption1>
                  <Body1>{formatDate(selectedOrder.due_date)}</Body1>
                </div>
                {selectedOrder.frozen_at && (
                  <div className={styles.metaItem}>
                    <Caption1>Eingefroren</Caption1>
                    <Body1>{formatDate(selectedOrder.frozen_at)}</Body1>
                  </div>
                )}
              </div>

              {selectedOrder.frozen_at && (
                <div className={styles.freezeNotice}>
                  ❄ Planung eingefroren – Aenderungen an BOM und Planung sind gesperrt.
                </div>
              )}

              {selectedOrder.notes && (
                <div style={{ marginBottom: tokens.spacingVerticalM }}>
                  <Caption1>Notizen</Caption1>
                  <Body1>{selectedOrder.notes}</Body1>
                </div>
              )}

              {selectedOrder.purchase_orders.length > 0 && (
                <div style={{ marginBottom: tokens.spacingVerticalM }}>
                  <Body1Strong>Verknuepfte Bestellungen</Body1Strong>
                  <div className={styles.tableWrap}>
                    <table className={styles.table}>
                      <thead><tr><th className={styles.th}>Lieferant</th><th className={styles.th}>Status</th></tr></thead>
                      <tbody>
                        {selectedOrder.purchase_orders.map(po => (
                          <tr key={po.id}>
                            <td className={styles.td}>{po.supplier_name}</td>
                            <td className={styles.td}>{po.status}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {selectedOrder.events.length > 0 && (
                <div style={{ marginBottom: tokens.spacingVerticalM }}>
                  <Body1Strong>Status-Verlauf</Body1Strong>
                  <ul className={styles.eventList}>
                    {selectedOrder.events.map(ev => (
                      <li key={ev.id} className={styles.eventItem}>
                        <span>{formatDate(ev.created_at)}</span>
                        <span>{ev.from_status ? `${ev.from_status} → ` : ''}{ev.to_status}</span>
                        {ev.note && <span>{ev.note}</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div style={{ display: 'flex', gap: tokens.spacingHorizontalS }}>
                {STATUS_NEXT[selectedOrder.status] && (
                  <Button
                    appearance='primary'
                    disabled={transitioning}
                    onClick={() => void handleStatusTransition(selectedOrder)}
                    icon={transitioning ? <Spinner size='tiny' /> : undefined}
                  >
                    → {STATUS_LABELS[STATUS_NEXT[selectedOrder.status]!]}
                  </Button>
                )}
                {selectedOrder.status === 'draft' && (
                  <Button appearance='subtle' onClick={() => void handleDelete(selectedOrder)}>Loeschen</Button>
                )}
              </div>
            </Card>
          )}
        </main>
      </div>
    </div>
  )
}
