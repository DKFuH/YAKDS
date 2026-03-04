import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import type { Room } from '../../api/projects.js'
import {
  catalogApi,
  type CatalogItem,
  type CatalogItemType,
  CATALOG_TYPE_LABELS,
  type Manufacturer,
  type CatalogArticle,
  type UnifiedCatalogItem
} from '../../api/catalog.js'
import { getTenantPlugins } from '../../api/tenantSettings.js'
import { assetLibraryApi } from '../../api/assetLibrary.js'
import {
  ASSET_CATEGORY_LABELS,
  mapAssetToCatalogItem,
  type AssetCategory,
  type AssetLibraryItem,
} from '../../plugins/assetLibrary/index.js'
import { AssetBrowser } from '../catalog/AssetBrowser.js'
import { AssetImportDialog } from '../catalog/AssetImportDialog.js'
import styles from './LeftSidebar.module.css'

interface Props {
  levelsPanel?: ReactNode
  rooms: Room[]
  selectedRoomId: string | null
  onSelectRoom: (id: string) => void
  onAddRoom: (name: string) => void
  selectedCatalogItem: UnifiedCatalogItem | null
  onSelectCatalogItem: (item: UnifiedCatalogItem | null) => void
  workflowStep: 'walls' | 'openings' | 'furniture'
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

export function LeftSidebar({ levelsPanel, rooms, selectedRoomId, onSelectRoom, onAddRoom, selectedCatalogItem, onSelectCatalogItem, workflowStep }: Props) {
  const [addingRoom, setAddingRoom] = useState(false)
  const [newRoomName, setNewRoomName] = useState('')
  const [catalogMode, setCatalogMode] = useState<'standard' | 'manufacturer' | 'assets'>('standard')
  const [assetPluginEnabled, setAssetPluginEnabled] = useState(false)
  const [assetImportOpen, setAssetImportOpen] = useState(false)
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([])
  const [selectedManufacturerId, setSelectedManufacturerId] = useState<string>('')

  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<'' | CatalogItemType>('')
  const [items, setItems] = useState<CatalogItem[]>([])
  const [articles, setArticles] = useState<CatalogArticle[]>([])
  const [assetItems, setAssetItems] = useState<AssetLibraryItem[]>([])
  const [assetCategoryFilter, setAssetCategoryFilter] = useState<'' | AssetCategory>('')

  const [catalogLoading, setCatalogLoading] = useState(false)
  const [catalogError, setCatalogError] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const requestTokenRef = useRef(0)

  // Load manufacturers once
  useEffect(() => {
    getTenantPlugins()
      .then((plugins) => {
        setAssetPluginEnabled(plugins.enabled.includes('asset-library'))
      })
      .catch(() => {
        setAssetPluginEnabled(false)
      })

    catalogApi.listManufacturers()
      .then(setManufacturers)
      .catch(() => setCatalogError('Hersteller konnten nicht geladen werden'))
  }, [])

  useEffect(() => {
    if (!assetPluginEnabled && catalogMode === 'assets') {
      setCatalogMode('standard')
    }
  }, [assetPluginEnabled, catalogMode])

  // Load legacy items
  useEffect(() => {
    if (catalogMode !== 'standard') return

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      const requestToken = ++requestTokenRef.current
      setCatalogLoading(true)
      setCatalogError(null)
      catalogApi
        .list({
          q: query.trim() || undefined,
          type: typeFilter || undefined,
          limit: 50,
        })
        .then((nextItems) => {
          if (requestToken !== requestTokenRef.current) return
          setItems(nextItems)
        })
        .catch((e: unknown) => {
          if (requestToken !== requestTokenRef.current) return
          setItems([])
          setCatalogError(e instanceof Error ? e.message : 'Katalog konnte nicht geladen werden')
        })
        .finally(() => {
          if (requestToken !== requestTokenRef.current) return
          setCatalogLoading(false)
        })
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      requestTokenRef.current += 1
    }
  }, [query, typeFilter, catalogMode])

  // Load manufacturer articles
  useEffect(() => {
    if (catalogMode !== 'manufacturer' || !selectedManufacturerId) {
      setArticles([])
      return
    }

    setCatalogLoading(true)
    setCatalogError(null)
    catalogApi.getManufacturerArticles(selectedManufacturerId)
      .then(res => {
        setArticles(res)
      })
      .catch(e => {
        setArticles([])
        setCatalogError(e instanceof Error ? e.message : 'Artikel konnten nicht geladen werden')
      })
      .finally(() => setCatalogLoading(false))
  }, [catalogMode, selectedManufacturerId])

  // Load asset library items
  useEffect(() => {
    if (catalogMode !== 'assets' || !assetPluginEnabled) {
      return
    }

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      const requestToken = ++requestTokenRef.current
      setCatalogLoading(true)
      setCatalogError(null)
      assetLibraryApi
        .list({
          q: query.trim() || undefined,
          category: assetCategoryFilter || undefined,
        })
        .then((nextItems) => {
          if (requestToken !== requestTokenRef.current) return
          setAssetItems(nextItems)
        })
        .catch((e: unknown) => {
          if (requestToken !== requestTokenRef.current) return
          setAssetItems([])
          setCatalogError(e instanceof Error ? e.message : 'Asset-Library konnte nicht geladen werden')
        })
        .finally(() => {
          if (requestToken !== requestTokenRef.current) return
          setCatalogLoading(false)
        })
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      requestTokenRef.current += 1
    }
  }, [catalogMode, query, assetCategoryFilter, assetPluginEnabled])

  const filteredArticles = articles.filter(a => {
    if (query && !a.name.toLowerCase().includes(query.toLowerCase()) && !a.sku.toLowerCase().includes(query.toLowerCase())) return false
    if (typeFilter && a.article_type !== typeFilter) return false
    return true
  })

  const selectedAssetId = catalogMode === 'assets' ? selectedCatalogItem?.id ?? null : null

  async function handleDeleteAsset(asset: AssetLibraryItem) {
    try {
      await assetLibraryApi.remove(asset.id)
      setAssetItems((prev) => prev.filter((entry) => entry.id !== asset.id))
      if (selectedCatalogItem?.id === asset.id) {
        onSelectCatalogItem(null)
      }
    } catch (error) {
      setCatalogError(error instanceof Error ? error.message : 'Asset konnte nicht gelöscht werden')
    }
  }

  function handleImportedAsset(asset: AssetLibraryItem) {
    setAssetItems((prev) => [asset, ...prev])
    onSelectCatalogItem(mapAssetToCatalogItem(asset))
  }

  return (
    <aside className={styles.sidebar}>
      {levelsPanel}

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

        {addingRoom ? (
          <form
            className={styles.addRoomForm}
            onSubmit={(e: FormEvent) => {
              e.preventDefault()
              const name = newRoomName.trim()
              if (!name) return
              onAddRoom(name)
              setNewRoomName('')
              setAddingRoom(false)
            }}
          >
            <input
              autoFocus
              type="text"
              className={styles.addRoomInput}
              placeholder="Raumname"
              value={newRoomName}
              onChange={e => setNewRoomName(e.target.value)}
            />
            <div className={styles.addRoomActions}>
              <button type="submit" className={styles.addBtn}>Anlegen</button>
              <button type="button" className={styles.cancelBtn} onClick={() => { setAddingRoom(false); setNewRoomName('') }}>✕</button>
            </div>
          </form>
        ) : (
          <button type="button" className={styles.addBtn} onClick={() => setAddingRoom(true)}>+ Raum hinzufügen</button>
        )}
      </div>

      <div className={styles.catalogSection}>
        {workflowStep !== 'furniture' ? (
          <p className={styles.stepHint}>
            {workflowStep === 'walls'
              ? '💡 Wände zeichnen, dann weiter zu Öffnungen'
              : '💡 Türen & Fenster platzieren, dann weiter zu Möbelierung'}
          </p>
        ) : (
          <>
            <div className={styles.catalogHeader}>
          <h3 className={styles.sectionTitle}>Katalog</h3>
          <div className={styles.modeToggle}>
            <button
              className={`${styles.modeBtn} ${catalogMode === 'standard' ? styles.modeBtnActive : ''}`}
              onClick={() => setCatalogMode('standard')}
            >
              Standard
            </button>
            <button
              className={`${styles.modeBtn} ${catalogMode === 'manufacturer' ? styles.modeBtnActive : ''}`}
              onClick={() => setCatalogMode('manufacturer')}
            >
              Hersteller
            </button>
            {assetPluginEnabled && (
              <button
                className={`${styles.modeBtn} ${catalogMode === 'assets' ? styles.modeBtnActive : ''}`}
                onClick={() => setCatalogMode('assets')}
              >
                Assets
              </button>
            )}
          </div>
        </div>

        {catalogMode === 'manufacturer' && (
          <select
            aria-label="Hersteller wählen"
            className={styles.mfrSelect}
            value={selectedManufacturerId}
            onChange={e => setSelectedManufacturerId(e.target.value)}
          >
            <option value="">-- Hersteller wählen --</option>
            {manufacturers.map(m => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        )}

        <input
          type="search"
          aria-label="Katalog durchsuchen"
          className={styles.searchInput}
          placeholder="Suchen…"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />

        {catalogMode !== 'assets' ? (
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
        ) : (
          <select
            aria-label="Asset-Kategorie filtern"
            className={styles.typeSelect}
            value={assetCategoryFilter}
            onChange={e => setAssetCategoryFilter(e.target.value as '' | AssetCategory)}
          >
            <option value="">Alle</option>
            {Object.entries(ASSET_CATEGORY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        )}

        {catalogMode === 'assets' ? (
          <AssetBrowser
            assets={assetItems}
            selectedAssetId={selectedAssetId}
            loading={catalogLoading}
            error={catalogError}
            onOpenImport={() => setAssetImportOpen(true)}
            onSelectAsset={(asset) => onSelectCatalogItem(mapAssetToCatalogItem(asset))}
            onDeleteAsset={(asset) => { void handleDeleteAsset(asset) }}
          />
        ) : catalogLoading ? (
          <p className={styles.empty}>Lade…</p>
        ) : catalogError ? (
          <p className={styles.error}>{catalogError}</p>
        ) : (catalogMode === 'standard' ? items : filteredArticles).length === 0 ? (
          <p className={styles.empty}>Keine Artikel gefunden</p>
        ) : (
          <ul className={styles.catalogList}>
            {catalogMode === 'standard' ? (
              items.map(item => (
                <li
                  key={item.id}
                  className={`${styles.catalogItem} ${selectedCatalogItem?.id === item.id ? styles.catalogItemActive : ''}`}
                  title={`${item.sku} · ${item.width_mm}×${item.depth_mm}×${item.height_mm} mm`}
                  onClick={() => onSelectCatalogItem(selectedCatalogItem?.id === item.id ? null : item)}
                >
                  <span className={styles.catalogName}>{item.name}</span>
                  <span className={styles.catalogBadge}>{CATALOG_TYPE_LABELS[item.type]}</span>
                </li>
              ))
            ) : (
              filteredArticles.map(art => (
                <li
                  key={art.id}
                  className={`${styles.catalogItem} ${selectedCatalogItem?.id === art.id ? styles.catalogItemActive : ''}`}
                  title={`${art.sku} · ${art.base_dims_json.width_mm}×${art.base_dims_json.depth_mm}×${art.base_dims_json.height_mm} mm`}
                  onClick={() => onSelectCatalogItem(selectedCatalogItem?.id === art.id ? null : art)}
                >
                  <span className={styles.catalogName}>{art.name}</span>
                  <span className={styles.catalogBadge}>
                    {(art.article_type as any) === 'plinth' ? 'Sockel' : CATALOG_TYPE_LABELS[art.article_type as CatalogItemType]}
                  </span>
                </li>
              ))
            )}
          </ul>
        )}

        {assetPluginEnabled && (
          <AssetImportDialog
            isOpen={assetImportOpen}
            onClose={() => setAssetImportOpen(false)}
            onImported={handleImportedAsset}
          />
        )}
          </>
        )}
      </div>
    </aside>
  )
}
