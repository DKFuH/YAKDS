import { useCallback, useEffect, useState } from 'react'
import { areasApi, type Area, type Alternative, type ModelSettings } from '../../api/areas.js'
import styles from './AreasPanel.module.css'

interface Props {
  projectId: string
  onOpenAlternative?: (alternativeId: string) => void
}

const EMPTY_SETTINGS: ModelSettings = {
  manufacturer_name: null,
  model_name: null,
  handle_name: null,
  worktop_model: null,
  worktop_color: null,
  plinth_height_mm: null,
  cover_panel_enabled: false,
  room_height_mm: null,
  wall_thickness_mm: null,
  extra_json: {},
}

export function AreasPanel({ projectId, onOpenAlternative }: Props) {
  const [areas, setAreas] = useState<Area[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedAreaIds, setExpandedAreaIds] = useState<Set<string>>(new Set())
  const [contextMenu, setContextMenu] = useState<{ type: 'area' | 'alternative'; id: string; areaId?: string; x: number; y: number } | null>(null)
  const [modelSettingsFor, setModelSettingsFor] = useState<{ alternativeId: string; areaId: string } | null>(null)
  const [modelSettings, setModelSettings] = useState<ModelSettings>(EMPTY_SETTINGS)
  const [savingSettings, setSavingSettings] = useState(false)

  const loadAreas = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await areasApi.list(projectId)
      setAreas(result)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Fehler beim Laden')
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    void loadAreas()
  }, [projectId])

  // Close context menu on outside click
  useEffect(() => {
    if (!contextMenu) return
    const handler = () => setContextMenu(null)
    window.addEventListener('click', handler)
    return () => window.removeEventListener('click', handler)
  }, [contextMenu])

  function toggleArea(areaId: string) {
    setExpandedAreaIds((prev) => {
      const next = new Set(prev)
      if (next.has(areaId)) next.delete(areaId)
      else next.add(areaId)
      return next
    })
  }

  async function handleAddArea() {
    const name = prompt('Bereichsname:')
    if (!name?.trim()) return
    try {
      const area = await areasApi.createArea(projectId, { name: name.trim(), sort_order: areas.length })
      setAreas((prev) => [...prev, area])
      setExpandedAreaIds((prev) => new Set([...prev, area.id]))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Fehler beim Anlegen')
    }
  }

  async function handleAddAlternative(areaId: string) {
    const name = prompt('Alternativname:')
    if (!name?.trim()) return
    const area = areas.find((a) => a.id === areaId)
    if (!area) return
    try {
      const alt = await areasApi.createAlternative(projectId, areaId, { name: name.trim(), sort_order: area.alternatives.length })
      setAreas((prev) => prev.map((a) => a.id === areaId ? { ...a, alternatives: [...a.alternatives, alt] } : a))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Fehler beim Anlegen')
    }
  }

  async function handleDeleteArea(areaId: string) {
    if (!confirm('Bereich wirklich löschen?')) return
    try {
      await areasApi.deleteArea(projectId, areaId)
      setAreas((prev) => prev.filter((a) => a.id !== areaId))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Fehler beim Löschen')
    }
  }

  async function handleDeleteAlternative(areaId: string, alternativeId: string) {
    if (!confirm('Alternative wirklich löschen?')) return
    try {
      await areasApi.deleteAlternative(projectId, areaId, alternativeId)
      setAreas((prev) => prev.map((a) => a.id === areaId ? { ...a, alternatives: a.alternatives.filter((alt) => alt.id !== alternativeId) } : a))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Fehler beim Löschen')
    }
  }

  async function handleDuplicateAlternative(areaId: string, alt: Alternative) {
    try {
      const copy = await areasApi.createAlternative(projectId, areaId, { name: `${alt.name} (Kopie)`, sort_order: alt.sort_order + 1 })
      setAreas((prev) => prev.map((a) => a.id === areaId ? { ...a, alternatives: [...a.alternatives, copy] } : a))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Fehler beim Duplizieren')
    }
  }

  async function openModelSettings(alternativeId: string, areaId: string) {
    setModelSettingsFor({ alternativeId, areaId })
    try {
      const settings = await areasApi.getModelSettings(alternativeId)
      setModelSettings(settings && 'alternative_id' in settings ? settings : EMPTY_SETTINGS)
    } catch {
      setModelSettings(EMPTY_SETTINGS)
    }
  }

  async function handleSaveModelSettings() {
    if (!modelSettingsFor) return
    setSavingSettings(true)
    try {
      const saved = await areasApi.saveModelSettings(modelSettingsFor.alternativeId, modelSettings)
      setAreas((prev) => prev.map((a) => ({
        ...a,
        alternatives: a.alternatives.map((alt) => alt.id === modelSettingsFor.alternativeId ? { ...alt, model_settings: saved } : alt),
      })))
      setModelSettingsFor(null)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Fehler beim Speichern')
    } finally {
      setSavingSettings(false)
    }
  }

  if (loading) return <div className={styles.info}>Lade Bereiche…</div>

  return (
    <div className={styles.panel}>
      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.toolbar}>
        <strong className={styles.title}>Bereiche</strong>
        <button className={styles.btnAdd} onClick={() => void handleAddArea()} title="Neuen Bereich anlegen">+ Bereich</button>
      </div>

      <ul className={styles.tree}>
        {areas.map((area) => (
          <li key={area.id} className={styles.areaNode}>
            <div
              className={styles.areaHeader}
              onContextMenu={(e) => {
                e.preventDefault()
                setContextMenu({ type: 'area', id: area.id, x: e.clientX, y: e.clientY })
              }}
              onClick={() => toggleArea(area.id)}
            >
              <span className={styles.treeToggle}>{expandedAreaIds.has(area.id) ? '▾' : '▸'}</span>
              <span className={styles.areaName}>{area.name}</span>
              <button
                className={styles.btnAddAlt}
                onClick={(e) => { e.stopPropagation(); void handleAddAlternative(area.id) }}
                title="Alternative anlegen"
              >+</button>
            </div>

            {expandedAreaIds.has(area.id) && (
              <ul className={styles.altList}>
                {area.alternatives.map((alt) => (
                  <li
                    key={alt.id}
                    className={`${styles.altNode} ${alt.is_active ? styles.altActive : ''}`}
                    onContextMenu={(e) => {
                      e.preventDefault()
                      setContextMenu({ type: 'alternative', id: alt.id, areaId: area.id, x: e.clientX, y: e.clientY })
                    }}
                    onDoubleClick={() => onOpenAlternative?.(alt.id)}
                  >
                    <span className={styles.altName}>{alt.name}</span>
                    <button
                      className={styles.btnSettings}
                      title="Modell-/Indexeinstellungen (F7)"
                      onClick={(e) => { e.stopPropagation(); void openModelSettings(alt.id, area.id) }}
                    >⚙</button>
                  </li>
                ))}
                {area.alternatives.length === 0 && (
                  <li className={styles.emptyAlt}>Keine Alternativen</li>
                )}
              </ul>
            )}
          </li>
        ))}
        {areas.length === 0 && (
          <li className={styles.emptyTree}>Noch keine Bereiche angelegt.</li>
        )}
      </ul>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className={styles.contextMenu}
          style={{ top: contextMenu.y, left: contextMenu.x }}
          role="menu"
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.type === 'area' ? (
            <>
              <button className={styles.ctxItem} onClick={() => { setContextMenu(null); void handleAddAlternative(contextMenu.id) }}>Neue Alternative</button>
              <button className={styles.ctxItemDanger} onClick={() => { setContextMenu(null); void handleDeleteArea(contextMenu.id) }}>Bereich löschen</button>
            </>
          ) : (
            <>
              <button className={styles.ctxItem} onClick={() => { setContextMenu(null); onOpenAlternative?.(contextMenu.id) }}>Öffnen</button>
              <button className={styles.ctxItem} onClick={() => {
                const alt = areas.flatMap((a) => a.alternatives).find((a) => a.id === contextMenu.id)
                if (alt && contextMenu.areaId) {
                  setContextMenu(null)
                  void handleDuplicateAlternative(contextMenu.areaId, alt)
                }
              }}>Duplizieren</button>
              <button className={styles.ctxItem} onClick={() => {
                if (contextMenu.areaId) {
                  void openModelSettings(contextMenu.id, contextMenu.areaId)
                  setContextMenu(null)
                }
              }}>Modell-Einstellungen (F7)</button>
              <button className={styles.ctxItemDanger} onClick={() => {
                if (contextMenu.areaId) {
                  setContextMenu(null)
                  void handleDeleteAlternative(contextMenu.areaId, contextMenu.id)
                }
              }}>Alternative löschen</button>
            </>
          )}
        </div>
      )}

      {/* Model Settings Dialog (F7) */}
      {modelSettingsFor && (
        <div className={styles.dialogOverlay} role="dialog" aria-modal="true">
          <div className={styles.dialog}>
            <h3 className={styles.dialogTitle}>Modell-/Indexeinstellungen</h3>

            <div className={styles.dialogTabs}>
              <section className={styles.dialogSection}>
                <h4>Küchenmodell</h4>
                <label className={styles.field}>
                  <span>Lieferant</span>
                  <input type="text" value={modelSettings.manufacturer_name ?? ''} onChange={(e) => setModelSettings((s) => ({ ...s, manufacturer_name: e.target.value || null }))} />
                </label>
                <label className={styles.field}>
                  <span>Modell</span>
                  <input type="text" value={modelSettings.model_name ?? ''} onChange={(e) => setModelSettings((s) => ({ ...s, model_name: e.target.value || null }))} />
                </label>
                <label className={styles.field}>
                  <span>Griffe</span>
                  <input type="text" value={modelSettings.handle_name ?? ''} onChange={(e) => setModelSettings((s) => ({ ...s, handle_name: e.target.value || null }))} />
                </label>
              </section>

              <section className={styles.dialogSection}>
                <h4>Arbeitsplatte</h4>
                <label className={styles.field}>
                  <span>Modell</span>
                  <input type="text" value={modelSettings.worktop_model ?? ''} onChange={(e) => setModelSettings((s) => ({ ...s, worktop_model: e.target.value || null }))} />
                </label>
                <label className={styles.field}>
                  <span>Farbe</span>
                  <input type="text" value={modelSettings.worktop_color ?? ''} onChange={(e) => setModelSettings((s) => ({ ...s, worktop_color: e.target.value || null }))} />
                </label>
              </section>

              <section className={styles.dialogSection}>
                <h4>Sockel / Abdeckboden</h4>
                <label className={styles.field}>
                  <span>Sockelhöhe (mm)</span>
                  <input type="number" value={modelSettings.plinth_height_mm ?? ''} onChange={(e) => setModelSettings((s) => ({ ...s, plinth_height_mm: e.target.value ? Number(e.target.value) : null }))} />
                </label>
                <label className={`${styles.field} ${styles.fieldCheckbox}`}>
                  <input type="checkbox" checked={modelSettings.cover_panel_enabled} onChange={(e) => setModelSettings((s) => ({ ...s, cover_panel_enabled: e.target.checked }))} />
                  <span>Abdeckboden aktiv</span>
                </label>
              </section>

              <section className={styles.dialogSection}>
                <h4>Raum</h4>
                <label className={styles.field}>
                  <span>Raumhöhe (mm)</span>
                  <input type="number" value={modelSettings.room_height_mm ?? ''} onChange={(e) => setModelSettings((s) => ({ ...s, room_height_mm: e.target.value ? Number(e.target.value) : null }))} />
                </label>
                <label className={styles.field}>
                  <span>Wandstärke (mm)</span>
                  <input type="number" value={modelSettings.wall_thickness_mm ?? ''} onChange={(e) => setModelSettings((s) => ({ ...s, wall_thickness_mm: e.target.value ? Number(e.target.value) : null }))} />
                </label>
              </section>
            </div>

            <div className={styles.dialogActions}>
              <button className={styles.btnPrimary} disabled={savingSettings} onClick={() => void handleSaveModelSettings()}>
                {savingSettings ? 'Speichern…' : 'Übernehmen'}
              </button>
              <button className={styles.btnSecondary} onClick={() => setModelSettingsFor(null)}>Abbrechen</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
