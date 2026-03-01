import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { biApi, type BISummary, type BIProductsResponse } from '../api/bi.js'
import styles from './BIDashboard.module.css'

function formatEur(value: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(value)
}

export function BIDashboard() {
  const navigate = useNavigate()
  const [tenantId, setTenantId] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [summary, setSummary] = useState<BISummary | null>(null)
  const [products, setProducts] = useState<BIProductsResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleLoad = useCallback(async () => {
    if (!tenantId.trim()) {
      setError('Bitte Tenant-ID eingeben.')
      return
    }
    setLoading(true)
    setError(null)
    const range = {
      from: fromDate || undefined,
      to: toDate || undefined,
    }
    try {
      const [s, p] = await Promise.all([
        biApi.summary(tenantId.trim(), range),
        biApi.products(tenantId.trim(), range),
      ])
      setSummary(s)
      setProducts(p)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'BI-Daten konnten nicht geladen werden.')
    } finally {
      setLoading(false)
    }
  }, [tenantId, fromDate, toDate])

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>BI Dashboard</h1>
        <button type="button" className={styles.backBtn} onClick={() => navigate('/')}>
          ← Zur Übersicht
        </button>
      </header>

      <div className={styles.filterBar}>
        <label className={styles.filterField}>
          <span>Tenant-ID</span>
          <input
            type="text"
            className={styles.input}
            placeholder="UUID des Mandanten"
            value={tenantId}
            onChange={e => setTenantId(e.target.value)}
          />
        </label>
        <label className={styles.filterField}>
          <span>Von</span>
          <input
            type="date"
            className={styles.input}
            value={fromDate}
            onChange={e => setFromDate(e.target.value)}
          />
        </label>
        <label className={styles.filterField}>
          <span>Bis</span>
          <input
            type="date"
            className={styles.input}
            value={toDate}
            onChange={e => setToDate(e.target.value)}
          />
        </label>
        <button
          type="button"
          className={styles.loadBtn}
          onClick={handleLoad}
          disabled={loading}
        >
          {loading ? 'Lade…' : 'KPIs laden'}
        </button>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      {summary && (
        <>
          <div className={styles.kpiGrid}>
            <div className={styles.kpiCard}>
              <span className={styles.kpiLabel}>Projekte gesamt</span>
              <span className={styles.kpiValue}>{summary.projects.total}</span>
            </div>
            <div className={styles.kpiCard}>
              <span className={styles.kpiLabel}>Gewonnen</span>
              <span className={`${styles.kpiValue} ${styles.won}`}>{summary.projects.won}</span>
            </div>
            <div className={styles.kpiCard}>
              <span className={styles.kpiLabel}>Verloren</span>
              <span className={`${styles.kpiValue} ${styles.lost}`}>{summary.projects.lost}</span>
            </div>
            <div className={styles.kpiCard}>
              <span className={styles.kpiLabel}>Conversion</span>
              <span className={styles.kpiValue}>{summary.projects.conversion_rate} %</span>
            </div>
            <div className={styles.kpiCard}>
              <span className={styles.kpiLabel}>Angebote gesamt</span>
              <span className={styles.kpiValue}>{summary.quotes.total}</span>
            </div>
            <div className={styles.kpiCard}>
              <span className={styles.kpiLabel}>Gesamtwert netto</span>
              <span className={styles.kpiValue}>{formatEur(summary.value.total_net)}</span>
            </div>
            <div className={styles.kpiCard}>
              <span className={styles.kpiLabel}>Ø Angebotswert</span>
              <span className={styles.kpiValue}>{formatEur(summary.value.avg_net)}</span>
            </div>
          </div>

          {products && products.by_type.length > 0 && (
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Top Warengruppen</h2>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Typ</th>
                    <th>Positionen</th>
                    <th>Umsatz netto</th>
                  </tr>
                </thead>
                <tbody>
                  {products.by_type.map(row => (
                    <tr key={row.type}>
                      <td>{row.type}</td>
                      <td>{row.count}</td>
                      <td>{formatEur(row.revenue_net)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
        </>
      )}

      {!summary && !loading && !error && (
        <p className={styles.empty}>Tenant-ID eingeben und KPIs laden.</p>
      )}
    </div>
  )
}
