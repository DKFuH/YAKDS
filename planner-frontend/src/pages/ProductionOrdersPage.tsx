import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { productionOrdersApi, type ProductionOrder, type ProductionOrderStatus } from '../api/productionOrders.js'
import { projectsApi, type Project } from '../api/projects.js'
import styles from './ProductionOrdersPage.module.css'

const STATUS_LABELS: Record<ProductionOrderStatus, string> = {
  draft: 'Entwurf',
  confirmed: 'Bestätigt',
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

const STATUS_COLOR: Record<ProductionOrderStatus, string> = {
  draft: 'var(--text-muted)',
  confirmed: 'var(--status-info)',
  in_production: 'var(--status-warning)',
  ready: 'var(--status-success)',
  delivered: 'var(--primary-color)',
  installed: 'var(--status-success)',
}

function formatDate(iso: string | null): string {
  if (!iso) return '–'
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function ProductionOrdersPage() {
  const [searchParams, setSearchParams] = useSearchParams()

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
    if (!confirm(`Produktionsauftrag löschen?`)) return
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

  return (
    <div className={styles.shell}>
      {/* ── Header ── */}
      <div className={styles.header}>
        <h1 className={styles.title}>Produktionsaufträge</h1>
      </div>

      <div className={styles.body}>
        {/* ── Sidebar ── */}
        <aside className={styles.sidebar}>
          {/* Projekt-Auswahl */}
          <div className={styles.sidebarSection}>
            <label className={styles.label}>Projekt</label>
            <select
              className={styles.select}
              value={selectedProjectId}
              onChange={e => handleProjectChange(e.target.value)}
            >
              <option value="">Projekt auswählen …</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* Status-Filter */}
          <div className={styles.sidebarSection}>
            <label className={styles.label}>Status-Filter</label>
            <select
              className={styles.select}
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as ProductionOrderStatus | 'all')}
            >
              <option value="all">Alle</option>
              {(Object.keys(STATUS_LABELS) as ProductionOrderStatus[]).map(s => (
                <option key={s} value={s}>{STATUS_LABELS[s]}</option>
              ))}
            </select>
          </div>

          {/* Auftrags-Liste */}
          <div className={styles.orderList}>
            {loading && <p className={styles.hint}>Laden …</p>}
            {!loading && filtered.length === 0 && selectedProjectId && (
              <p className={styles.hint}>Keine Aufträge gefunden.</p>
            )}
            {!loading && !selectedProjectId && (
              <p className={styles.hint}>Bitte Projekt auswählen.</p>
            )}
            {filtered.map(order => (
              <button
                key={order.id}
                type="button"
                className={`${styles.orderItem} ${selectedOrderId === order.id ? styles.orderItemActive : ''}`}
                onClick={() => setSelectedOrderId(selectedOrderId === order.id ? null : order.id)}
              >
                <span
                  className={styles.statusDot}
                  style={{ background: STATUS_COLOR[order.status] }}
                />
                <span className={styles.orderLabel}>
                  <span className={styles.orderStatus}>{STATUS_LABELS[order.status]}</span>
                  {order.due_date && (
                    <span className={styles.orderDue}>Fällig: {formatDate(order.due_date)}</span>
                  )}
                </span>
                {order.frozen_at && <span className={styles.frozenBadge} title="Eingefroren">❄</span>}
              </button>
            ))}
          </div>
        </aside>

        {/* ── Detailansicht ── */}
        <main className={styles.main}>
          {error && <div className={styles.error}>{error}</div>}

          {!selectedOrder && (
            <div className={styles.placeholder}>
              <p>Produktionsauftrag auswählen</p>
              <p className={styles.hint}>Wähle links einen Auftrag für Details und Status-Workflow.</p>
            </div>
          )}

          {selectedOrder && (
            <div className={styles.detail}>
              {/* Status-Workflow ── */}
              <div className={styles.workflowBar}>
                {(Object.keys(STATUS_LABELS) as ProductionOrderStatus[]).map((s, idx, arr) => {
                  const statusIdx = arr.indexOf(selectedOrder.status)
                  const isDone = idx < statusIdx
                  const isCurrent = idx === statusIdx
                  return (
                    <div
                      key={s}
                      className={`${styles.workflowStep} ${isDone ? styles.workflowDone : ''} ${isCurrent ? styles.workflowCurrent : ''}`}
                    >
                      <span className={styles.workflowDot} />
                      <span className={styles.workflowLabel}>{STATUS_LABELS[s]}</span>
                    </div>
                  )
                })}
              </div>

              {/* Metadaten ── */}
              <div className={styles.metaGrid}>
                <div className={styles.metaItem}>
                  <span className={styles.metaKey}>Status</span>
                  <span className={styles.metaValue} style={{ color: STATUS_COLOR[selectedOrder.status] }}>
                    {STATUS_LABELS[selectedOrder.status]}
                  </span>
                </div>
                <div className={styles.metaItem}>
                  <span className={styles.metaKey}>Angelegt von</span>
                  <span className={styles.metaValue}>{selectedOrder.created_by}</span>
                </div>
                <div className={styles.metaItem}>
                  <span className={styles.metaKey}>Erstellt</span>
                  <span className={styles.metaValue}>{formatDate(selectedOrder.created_at)}</span>
                </div>
                <div className={styles.metaItem}>
                  <span className={styles.metaKey}>Fällig</span>
                  <span className={styles.metaValue}>{formatDate(selectedOrder.due_date)}</span>
                </div>
                {selectedOrder.frozen_at && (
                  <div className={styles.metaItem}>
                    <span className={styles.metaKey}>Eingefroren</span>
                    <span className={styles.metaValue}>{formatDate(selectedOrder.frozen_at)}</span>
                  </div>
                )}
              </div>

              {/* Freeze-Hinweis ── */}
              {selectedOrder.frozen_at && (
                <div className={styles.freezeNotice}>
                  ❄ Planung eingefroren – Änderungen an BOM und Planung sind gesperrt.
                  Für Korrekturen neue Alternative anlegen.
                </div>
              )}

              {/* Notizen ── */}
              {selectedOrder.notes && (
                <div className={styles.notes}>
                  <span className={styles.metaKey}>Notizen</span>
                  <p>{selectedOrder.notes}</p>
                </div>
              )}

              {/* Verknüpfte Bestellungen ── */}
              {selectedOrder.purchase_orders.length > 0 && (
                <div className={styles.section}>
                  <h3 className={styles.sectionTitle}>Verknüpfte Bestellungen</h3>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Lieferant</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedOrder.purchase_orders.map(po => (
                        <tr key={po.id}>
                          <td>{po.supplier_name}</td>
                          <td>{po.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Audit-Log ── */}
              {selectedOrder.events.length > 0 && (
                <div className={styles.section}>
                  <h3 className={styles.sectionTitle}>Status-Verlauf</h3>
                  <ul className={styles.eventList}>
                    {selectedOrder.events.map(ev => (
                      <li key={ev.id} className={styles.eventItem}>
                        <span className={styles.eventTime}>{formatDate(ev.created_at)}</span>
                        <span className={styles.eventTransition}>
                          {ev.from_status ? `${ev.from_status} → ` : ''}{ev.to_status}
                        </span>
                        {ev.note && <span className={styles.eventNote}>{ev.note}</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Aktionen ── */}
              <div className={styles.actions}>
                {STATUS_NEXT[selectedOrder.status] && (
                  <button
                    type="button"
                    className={styles.btnPrimary}
                    disabled={transitioning}
                    onClick={() => handleStatusTransition(selectedOrder)}
                  >
                    → {STATUS_LABELS[STATUS_NEXT[selectedOrder.status]!]}
                  </button>
                )}
                {selectedOrder.status === 'draft' && (
                  <button
                    type="button"
                    className={styles.btnDanger}
                    onClick={() => handleDelete(selectedOrder)}
                  >
                    Löschen
                  </button>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
