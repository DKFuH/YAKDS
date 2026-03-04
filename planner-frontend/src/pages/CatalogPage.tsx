import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { catalogApi } from '../api/catalog.js'
import { catalogIndicesApi, type CatalogIndexRecord } from '../api/catalogIndices.js'
import { projectsApi, type Project } from '../api/projects.js'
import { getTenantPlugins } from '../api/tenantSettings.js'
import { CatalogBrowser } from '../components/catalog/CatalogBrowser.js'
import { MaterialBrowser } from '../components/catalog/MaterialBrowser.js'
import styles from './CatalogPage.module.css'

const TENANT_ID_PLACEHOLDER = '00000000-0000-0000-0000-000000000001'

interface BatchRow {
  id: string
  catalog_id: string
  purchase_index: string
  sales_index: string
}

interface CatalogOption {
  id: string
  sku: string
  label: string
  type: string
}

function uid() {
  return Math.random().toString(36).slice(2, 10)
}

function createBatchRow(overrides?: Partial<BatchRow>): BatchRow {
  return {
    id: uid(),
    catalog_id: '',
    purchase_index: '1.00',
    sales_index: '1.00',
    ...overrides,
  }
}

function createSuggestedRows(options: CatalogOption[]): BatchRow[] {
  const baseCabinet = options.find((option) => option.type === 'base_cabinet')
  const worktop = options.find((option) => option.type === 'worktop')

  return [
    createBatchRow({ catalog_id: baseCabinet?.id ?? '' }),
    createBatchRow({ catalog_id: worktop?.id ?? '' }),
  ]
}

export function CatalogPage() {
  const navigate = useNavigate()
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [catalogOptions, setCatalogOptions] = useState<CatalogOption[]>([])
  const [existingIndices, setExistingIndices] = useState<CatalogIndexRecord[]>([])
  const [batchRows, setBatchRows] = useState<BatchRow[]>([createBatchRow(), createBatchRow()])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [materialsEnabled, setMaterialsEnabled] = useState(false)

  const catalogOptionMap = useMemo(
    () => Object.fromEntries(catalogOptions.map((option) => [option.id, option])),
    [catalogOptions],
  )

  async function loadCatalogIndexWorkspace(projectId?: string) {
    setLoading(true)
    setError(null)

    try {
      const [projectList, catalogItems] = await Promise.all([
        projectsApi.list(),
        catalogApi.list({ limit: 200, offset: 0 }),
      ])

      const activeProjects = projectList.filter((project) => project.status === 'active')
      const nextCatalogOptions = catalogItems.map((item) => ({
        id: item.id,
        sku: item.sku,
        label: `${item.sku} - ${item.name}`,
        type: item.type,
      }))

      setProjects(activeProjects)
      setCatalogOptions(nextCatalogOptions)
      setBatchRows((current) => (
        current.every((row) => row.catalog_id === '')
          ? createSuggestedRows(nextCatalogOptions)
          : current
      ))

      const nextProjectId = projectId || selectedProjectId || activeProjects[0]?.id || ''
      setSelectedProjectId(nextProjectId)

      if (nextProjectId) {
        const indices = await catalogIndicesApi.list(nextProjectId, TENANT_ID_PLACEHOLDER)
        setExistingIndices(indices)
      } else {
        setExistingIndices([])
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Katalogindex-Daten konnten nicht geladen werden.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadCatalogIndexWorkspace()
  }, [])

  useEffect(() => {
    let active = true

    getTenantPlugins()
      .then((result) => {
        if (!active) return
        setMaterialsEnabled(result.enabled.includes('materials'))
      })
      .catch(() => {
        if (!active) return
        setMaterialsEnabled(false)
      })

    return () => {
      active = false
    }
  }, [])

  async function handleProjectChange(projectId: string) {
    setSelectedProjectId(projectId)
    if (!projectId) {
      setExistingIndices([])
      return
    }
    await loadCatalogIndexWorkspace(projectId)
  }

  function updateRow(rowId: string, patch: Partial<BatchRow>) {
    setBatchRows((current) => current.map((row) => (row.id === rowId ? { ...row, ...patch } : row)))
  }

  function addRow() {
    setBatchRows((current) => [...current, createBatchRow()])
  }

  function removeRow(rowId: string) {
    setBatchRows((current) => (current.length > 1 ? current.filter((row) => row.id !== rowId) : current))
  }

  async function handleApplyBatch(event: FormEvent) {
    event.preventDefault()
    if (!selectedProjectId) {
      setError('Bitte zuerst ein Projekt auswaehlen.')
      return
    }

    const rows = batchRows
      .map((row) => ({
        catalog_id: row.catalog_id.trim(),
        purchase_index: Number(row.purchase_index),
        sales_index: Number(row.sales_index),
      }))
      .filter((row) => row.catalog_id !== '')

    if (rows.length === 0) {
      setError('Mindestens eine Katalogzeile mit Artikel-ID ist erforderlich.')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      for (const row of rows) {
        await catalogIndicesApi.create(selectedProjectId, TENANT_ID_PLACEHOLDER, {
          ...row,
          applied_by: 'catalog-index-ui',
        })
      }

      await loadCatalogIndexWorkspace(selectedProjectId)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Massen-Indexierung fehlgeschlagen.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>Phase 3 · Sprint 29</p>
          <h1 className={styles.title}>Katalog & Massen-Indexierung</h1>
          <p className={styles.description}>Katalogbrowser plus projektbezogene EK-/VK-Indizes fuer mehrere Katalogartikel in einem Durchlauf.</p>
        </div>
        <button type="button" className={styles.backBtn} onClick={() => navigate('/')}>
          Zur Projekte-Uebersicht
        </button>
      </header>

      {error && <div className={styles.error}>{error}</div>}

      <section className={styles.indexPanel}>
        <div className={styles.indexHeader}>
          <h2>Projektbezogene Katalogindexe</h2>
          <span>{existingIndices.length} Eintraege</span>
        </div>

        <div className={styles.indexToolbar}>
          <label className={styles.field}>
            <span>Projekt</span>
            <select value={selectedProjectId} onChange={(event) => void handleProjectChange(event.target.value)}>
              <option value="">Projekt auswaehlen...</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>{project.name}</option>
              ))}
            </select>
          </label>
          <p className={styles.indexHint}>Indizes werden gegen die `catalog_item_id` der BOM-Linien angewendet.</p>
        </div>

        <form className={styles.batchForm} onSubmit={handleApplyBatch}>
          <div className={styles.batchRows}>
            {batchRows.map((row) => (
              <div key={row.id} className={styles.batchRow}>
                <label className={styles.field}>
                  <span>Katalogartikel</span>
                  <select value={row.catalog_id} onChange={(event) => updateRow(row.id, { catalog_id: event.target.value })}>
                    <option value="">Artikel auswaehlen...</option>
                    {catalogOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={styles.field}>
                  <span>EK-Index</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max="10"
                    value={row.purchase_index}
                    onChange={(event) => updateRow(row.id, { purchase_index: event.target.value })}
                  />
                </label>
                <label className={styles.field}>
                  <span>VK-Index</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max="10"
                    value={row.sales_index}
                    onChange={(event) => updateRow(row.id, { sales_index: event.target.value })}
                  />
                </label>
                <button type="button" className={styles.btnGhost} onClick={() => removeRow(row.id)}>
                  Entfernen
                </button>
                <div className={styles.rowMeta}>
                  {row.catalog_id
                    ? `${catalogOptionMap[row.catalog_id]?.label ?? row.catalog_id} · ID ${row.catalog_id}`
                    : 'Noch kein Katalogartikel ausgewaehlt.'}
                </div>
              </div>
            ))}
          </div>

          <div className={styles.batchActions}>
            <button type="button" className={styles.btnSecondary} onClick={addRow}>Zeile hinzufuegen</button>
            <button type="submit" className={styles.btnPrimary} disabled={!selectedProjectId || submitting}>
              {submitting ? 'Wird angewendet...' : 'Batch anwenden'}
            </button>
          </div>
        </form>

        <div className={styles.historyPanel}>
          <h3>Verlauf</h3>
          {loading ? (
            <p className={styles.empty}>Lade Indexhistorie...</p>
          ) : existingIndices.length === 0 ? (
            <p className={styles.empty}>Fuer dieses Projekt wurden noch keine Katalogindexe angelegt.</p>
          ) : (
            <div className={styles.historyList}>
              {existingIndices.map((record) => (
                <article key={record.id} className={styles.historyCard}>
                  <strong>{catalogOptionMap[record.catalog_id]?.label ?? record.catalog_id}</strong>
                  <span>ID {record.catalog_id}</span>
                  <span>EK {record.purchase_index.toFixed(2)} · VK {record.sales_index.toFixed(2)}</span>
                  <span>{new Date(record.applied_at).toLocaleString()} · {record.applied_by}</span>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      <CatalogBrowser />
      {materialsEnabled && <MaterialBrowser />}
    </div>
  )
}
