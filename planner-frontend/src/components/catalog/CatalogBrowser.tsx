import { useEffect, useMemo, useState } from 'react'
import {
  CATALOG_TYPE_LABELS,
  catalogApi,
  type CatalogItem,
  type CatalogItemType,
} from '../../api/catalog.js'
import styles from './CatalogBrowser.module.css'

interface Props {
  initialType?: CatalogItemType | ''
  initialQuery?: string
  pageSize?: number
}

const TYPE_OPTIONS: Array<{ value: CatalogItemType | ''; label: string }> = [
  { value: '', label: 'Alle Typen' },
  { value: 'base_cabinet', label: CATALOG_TYPE_LABELS.base_cabinet },
  { value: 'wall_cabinet', label: CATALOG_TYPE_LABELS.wall_cabinet },
  { value: 'tall_cabinet', label: CATALOG_TYPE_LABELS.tall_cabinet },
  { value: 'trim', label: CATALOG_TYPE_LABELS.trim },
  { value: 'worktop', label: CATALOG_TYPE_LABELS.worktop },
  { value: 'appliance', label: CATALOG_TYPE_LABELS.appliance },
  { value: 'accessory', label: CATALOG_TYPE_LABELS.accessory },
]

function formatPrice(value: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

export function CatalogBrowser({ initialType = '', initialQuery = '', pageSize = 50 }: Props) {
  const [typeFilter, setTypeFilter] = useState<CatalogItemType | ''>(initialType)
  const [query, setQuery] = useState(initialQuery)

  const [items, setItems] = useState<CatalogItem[]>([])
  const [listLoading, setListLoading] = useState(false)
  const [listError, setListError] = useState<string | null>(null)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedItem, setSelectedItem] = useState<CatalogItem | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)

  const normalizedQuery = useMemo(() => query.trim(), [query])

  useEffect(() => {
    let canceled = false

    const timer = window.setTimeout(() => {
      setListLoading(true)
      setListError(null)

      void catalogApi
        .list({
          type: typeFilter || undefined,
          q: normalizedQuery || undefined,
          limit: pageSize,
          offset: 0,
        })
        .then((result) => {
          if (canceled) {
            return
          }
          setItems(result)

          if (selectedId && !result.some((item) => item.id === selectedId)) {
            setSelectedId(null)
            setSelectedItem(null)
            setDetailError(null)
          }
        })
        .catch((error: unknown) => {
          if (canceled) {
            return
          }
          setItems([])
          setListError(error instanceof Error ? error.message : 'Katalogliste konnte nicht geladen werden.')
        })
        .finally(() => {
          if (canceled) {
            return
          }
          setListLoading(false)
        })
    }, 250)

    return () => {
      canceled = true
      window.clearTimeout(timer)
    }
  }, [typeFilter, normalizedQuery, pageSize, selectedId])

  async function handleSelectItem(id: string) {
    setSelectedId(id)
    setDetailLoading(true)
    setDetailError(null)

    try {
      const item = await catalogApi.getById(id)
      setSelectedItem(item)
    } catch (error: unknown) {
      setSelectedItem(null)
      setDetailError(error instanceof Error ? error.message : 'Detaildaten konnten nicht geladen werden.')
    } finally {
      setDetailLoading(false)
    }
  }

  return (
    <section className={styles.panel}>
      <header className={styles.header}>
        <h3 className={styles.title}>Katalog-Browser</h3>
      </header>

      <div className={styles.filters}>
        <input
          type="search"
          className={styles.searchInput}
          aria-label="Katalog durchsuchen"
          placeholder="Suche nach Name oder SKU"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />

        <select
          className={styles.typeSelect}
          aria-label="Katalogtyp filtern"
          value={typeFilter}
          onChange={(event) => setTypeFilter(event.target.value as CatalogItemType | '')}
        >
          {TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {listError && <p className={styles.error}>{listError}</p>}

      <div className={styles.content}>
        <div className={styles.listWrap}>
          {listLoading ? (
            <p className={styles.muted}>Lade Katalog…</p>
          ) : items.length === 0 ? (
            <p className={styles.muted}>Keine Treffer.</p>
          ) : (
            <ul className={styles.list}>
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className={`${styles.itemBtn} ${selectedId === item.id ? styles.itemBtnActive : ''}`}
                    onClick={() => { void handleSelectItem(item.id) }}
                  >
                    <span className={styles.itemName}>{item.name}</span>
                    <span className={styles.itemMeta}>{item.sku} · {CATALOG_TYPE_LABELS[item.type]}</span>
                    <span className={styles.itemPrice}>{formatPrice(item.list_price_net)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <aside className={styles.details}>
          <h4 className={styles.detailTitle}>Details</h4>

          {detailLoading && <p className={styles.muted}>Lade Detail…</p>}
          {detailError && <p className={styles.error}>{detailError}</p>}

          {!detailLoading && !detailError && !selectedItem && (
            <p className={styles.muted}>Element auswählen, um Details zu sehen.</p>
          )}

          {!detailLoading && !detailError && selectedItem && (
            <dl className={styles.detailGrid}>
              <dt>ID</dt>
              <dd>{selectedItem.id}</dd>

              <dt>Name</dt>
              <dd>{selectedItem.name}</dd>

              <dt>SKU</dt>
              <dd>{selectedItem.sku}</dd>

              <dt>Typ</dt>
              <dd>{CATALOG_TYPE_LABELS[selectedItem.type]}</dd>

              <dt>Maße</dt>
              <dd>{selectedItem.width_mm} × {selectedItem.depth_mm} × {selectedItem.height_mm} mm</dd>

              <dt>Listenpreis (netto)</dt>
              <dd>{formatPrice(selectedItem.list_price_net)}</dd>
            </dl>
          )}
        </aside>
      </div>
    </section>
  )
}
