import { useEffect, useMemo, useState } from 'react'
import {
  supplierPortalApi,
  type SupplierErpConnector,
  type SupplierPortalOrder,
  type SupplierPortalOrderStatus,
} from '../api/supplierPortal.js'
import styles from './SupplierPortalPage.module.css'

const STATUS_LABELS: Record<SupplierPortalOrderStatus, string> = {
  draft: 'Entwurf',
  sent: 'Gesendet',
  confirmed: 'Bestätigt',
  partially_delivered: 'Teilgeliefert',
  delivered: 'Geliefert',
  cancelled: 'Storniert',
}

const OPEN_STATUSES: SupplierPortalOrderStatus[] = ['draft', 'sent', 'confirmed']

type StatusFilter = 'all' | SupplierPortalOrderStatus

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function SupplierPortalPage() {
  const [orders, setOrders] = useState<SupplierPortalOrder[]>([])
  const [connectors, setConnectors] = useState<SupplierErpConnector[]>([])
  const [selectedConnectorByOrder, setSelectedConnectorByOrder] = useState<Record<string, string>>({})
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [loading, setLoading] = useState(true)
  const [pushingOrderId, setPushingOrderId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)

    Promise.all([supplierPortalApi.listOpenOrders(), supplierPortalApi.listConnectors()])
      .then(([orderData, connectorData]) => {
        setOrders(orderData)
        setConnectors(connectorData.filter((connector) => connector.enabled))
      })
      .catch((cause: Error) => {
        setError(cause.message)
      })
      .finally(() => {
        setLoading(false)
      })
  }, [])

  const filteredOrders = useMemo(() => {
    if (statusFilter === 'all') {
      return orders
    }
    return orders.filter((order) => order.status === statusFilter)
  }, [orders, statusFilter])

  async function handlePushToErp(order: SupplierPortalOrder) {
    const connectorId = selectedConnectorByOrder[order.id]
    if (!connectorId) {
      setError('Bitte zuerst einen ERP-Konnektor auswählen.')
      return
    }

    setPushingOrderId(order.id)
    setError(null)
    setMessage(null)

    try {
      const result = await supplierPortalApi.pushToErp(order.id, connectorId)
      if (!result.success) {
        throw new Error(result.error ?? 'ERP-Übertragung fehlgeschlagen')
      }
      setMessage(`Bestellung ${order.id} wurde ans ERP übertragen${result.erp_order_ref ? ` (Ref: ${result.erp_order_ref})` : ''}.`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'ERP-Übertragung fehlgeschlagen')
    } finally {
      setPushingOrderId(null)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>Lieferantenportal</h1>
      </div>

      <div className={styles.filterRow}>
        <label htmlFor="supplier-status-filter">Statusfilter: </label>
        <select
          id="supplier-status-filter"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
        >
          <option value="all">Alle offenen</option>
          {OPEN_STATUSES.map((status) => (
            <option key={status} value={status}>{STATUS_LABELS[status]}</option>
          ))}
        </select>
      </div>

      {loading && <p>Lade …</p>}
      {error && <p>{error}</p>}
      {message && <p>{message}</p>}

      {!loading && filteredOrders.length === 0 && <p>Keine offenen Bestellungen gefunden.</p>}

      {!loading && filteredOrders.length > 0 && (
        <table className={styles.table}>
          <thead>
            <tr>
              <th align="left">Lieferant</th>
              <th align="left">Referenz</th>
              <th align="left">Positionen</th>
              <th align="left">Status</th>
              <th align="left">Erstellt</th>
              <th align="left">ERP-Konnektor</th>
              <th align="left">Aktion</th>
            </tr>
          </thead>
          <tbody>
            {filteredOrders.map((order) => (
              <tr key={order.id}>
                <td>{order.supplier_name}</td>
                <td>{order.supplier_ref ?? '–'}</td>
                <td>{order.items.length}</td>
                <td>{STATUS_LABELS[order.status]}</td>
                <td>{formatDate(order.created_at)}</td>
                <td>
                  <select
                    aria-label={`ERP-Konnektor für Bestellung ${order.id}`}
                    value={selectedConnectorByOrder[order.id] ?? ''}
                    onChange={(event) => {
                      setSelectedConnectorByOrder((prev) => ({ ...prev, [order.id]: event.target.value }))
                    }}
                  >
                    <option value="">Konnektor wählen …</option>
                    {connectors.map((connector) => (
                      <option key={connector.id} value={connector.id}>{connector.name}</option>
                    ))}
                  </select>
                </td>
                <td>
                  <button
                    type="button"
                    disabled={pushingOrderId === order.id || !selectedConnectorByOrder[order.id]}
                    onClick={() => void handlePushToErp(order)}
                  >
                    ERP-Push
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
