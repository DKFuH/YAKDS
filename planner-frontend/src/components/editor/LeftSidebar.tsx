import { useEffect, useRef, useState } from 'react'
import type { Room } from '../../api/projects.js'
import { catalogApi, type CatalogItem, type CatalogItemType, CATALOG_TYPE_LABELS } from '../../api/catalog.js'
import styles from './LeftSidebar.module.css'

interface Props {
  rooms: Room[]
  selectedRoomId: string | null
  onSelectRoom: (id: string) => void
  onAddRoom: () => void
}

const TYPE_OPTIONS: Array<{ value: '' | CatalogItemType; label: string }> = [
  { value: '', label: 'Alle' },
  { value: 'base_cabinet', label: 'Unterschrank' },
  { value: 'wall_cabinet', label: 'Hängeschrank' },
  { value: 'tall_cabinet', label: 'Hochschrank' },
  { value: 'worktop', label: 'Arbeitsplatte' },
  { value: 'appliance', label: 'Gerät' },
  { value: 'accessory', label: 'Zubehör' },
]

export function LeftSidebar({ rooms, selectedRoomId, onSelectRoom, onAddRoom }: Props) {
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<'' | CatalogItemType>('')
  const [items, setItems] = useState<CatalogItem[]>([])
  const [catalogLoading, setCatalogLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setCatalogLoading(true)
      catalogApi
        .list({
          q: query.trim() || undefined,
          type: typeFilter || undefined,
          limit: 50,
        })
        .then(setItems)
        .catch(() => setItems([]))
        .finally(() => setCatalogLoading(false))
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, typeFilter])

  return (
    <aside className={styles.sidebar}>
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Räume</h3>
        {rooms.length === 0 ? (
          <p className={styles.empty}>Noch kein Raum</p>
        ) : (
          <ul className={styles.list}>
            {rooms.map(r => (
              <li
                key={r.id}
                className={`${styles.item} ${r.id === selectedRoomId ? styles.active : ''}`}
                onClick={() => onSelectRoom(r.id)}
              >
                {r.name}
              </li>
            ))}
          </ul>
        )}
        <button type="button" className={styles.addBtn} onClick={onAddRoom}>+ Raum hinzufügen</button>
      </div>

      <div className={styles.catalogSection}>
        <h3 className={styles.sectionTitle}>Katalog</h3>

        <input
          type="search"
          aria-label="Katalog durchsuchen"
          className={styles.searchInput}
          placeholder="Suchen…"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />

        <select
          aria-label="Kategorie filtern"
          className={styles.typeSelect}
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value as '' | CatalogItemType)}
        >
          {TYPE_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        {catalogLoading ? (
          <p className={styles.empty}>Lade…</p>
        ) : items.length === 0 ? (
          <p className={styles.empty}>Keine Artikel gefunden</p>
        ) : (
          <ul className={styles.catalogList}>
            {items.map(item => (
              <li key={item.id} className={styles.catalogItem} title={`${item.sku} · ${item.width_mm}×${item.depth_mm}×${item.height_mm} mm`}>
                <span className={styles.catalogName}>{item.name}</span>
                <span className={styles.catalogBadge}>{CATALOG_TYPE_LABELS[item.type]}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  )
}
