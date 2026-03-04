import { useEffect, useMemo, useState } from 'react'
import type { BuildingLevel } from '../../api/levels.js'
import type { VerticalConnection, VerticalConnectionKind } from '../../api/verticalConnections.js'
import styles from './StairsPanel.module.css'

interface Props {
  enabled: boolean
  levels: BuildingLevel[]
  connections: VerticalConnection[]
  activeLevelId: string | null
  selectedRoomId: string | null
  onCreate: (payload: {
    from_level_id: string
    to_level_id: string
    kind: VerticalConnectionKind
    stair_json: Record<string, unknown>
  }) => Promise<void>
  onUpdate: (id: string, payload: {
    from_level_id: string
    to_level_id: string
    kind: VerticalConnectionKind
    stair_json: Record<string, unknown>
  }) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

const KIND_OPTIONS: Array<{ value: VerticalConnectionKind; label: string }> = [
  { value: 'straight_stair', label: 'Gerade Treppe' },
  { value: 'l_stair', label: 'L-Treppe' },
  { value: 'u_stair', label: 'U-Treppe' },
  { value: 'spiral_stair', label: 'Spindeltreppe' },
  { value: 'void', label: 'Auge / Void' },
]

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  return null
}

function levelName(levelById: Map<string, BuildingLevel>, id: string): string {
  return levelById.get(id)?.name ?? 'Unbekannt'
}

export function StairsPanel({
  enabled,
  levels,
  connections,
  activeLevelId,
  selectedRoomId,
  onCreate,
  onUpdate,
  onDelete,
}: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [fromLevelId, setFromLevelId] = useState<string>('')
  const [toLevelId, setToLevelId] = useState<string>('')
  const [kind, setKind] = useState<VerticalConnectionKind>('straight_stair')
  const [widthMm, setWidthMm] = useState<string>('1000')
  const [treadMm, setTreadMm] = useState<string>('270')
  const [openingMarginMm, setOpeningMarginMm] = useState<string>('0')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const levelById = useMemo(() => new Map(levels.map((entry) => [entry.id, entry])), [levels])

  const visibleConnections = useMemo(() => {
    const relevant = activeLevelId
      ? connections.filter((entry) => entry.from_level_id === activeLevelId || entry.to_level_id === activeLevelId)
      : connections

    return [...relevant].sort((left, right) => left.created_at.localeCompare(right.created_at))
  }, [connections, activeLevelId])

  const selectedConnection = useMemo(
    () => connections.find((entry) => entry.id === selectedId) ?? null,
    [connections, selectedId],
  )

  useEffect(() => {
    if (!selectedConnection) return

    setFromLevelId(selectedConnection.from_level_id)
    setToLevelId(selectedConnection.to_level_id)
    setKind(selectedConnection.kind)

    const width = toNumber(selectedConnection.stair_json?.width_mm)
    const tread = toNumber(selectedConnection.stair_json?.tread_mm)
    const margin = toNumber(selectedConnection.stair_json?.opening_margin_mm)

    setWidthMm(String(width ?? 1000))
    setTreadMm(String(tread ?? 270))
    setOpeningMarginMm(String(margin ?? 0))
  }, [selectedConnection])

  useEffect(() => {
    if (levels.length === 0) {
      setFromLevelId('')
      setToLevelId('')
      return
    }

    if (!fromLevelId || !levels.some((entry) => entry.id === fromLevelId)) {
      const fallback = activeLevelId && levels.some((entry) => entry.id === activeLevelId)
        ? activeLevelId
        : levels[0].id
      setFromLevelId(fallback)
    }

    if (!toLevelId || !levels.some((entry) => entry.id === toLevelId) || toLevelId === fromLevelId) {
      const source = fromLevelId && levels.some((entry) => entry.id === fromLevelId)
        ? fromLevelId
        : activeLevelId && levels.some((entry) => entry.id === activeLevelId)
          ? activeLevelId
          : levels[0].id
      const fallback = levels.find((entry) => entry.id !== source)?.id ?? levels[0].id
      setToLevelId(fallback)
    }
  }, [levels, activeLevelId, fromLevelId, toLevelId])

  function resetForCreate() {
    setSelectedId(null)
    setError(null)
    setKind('straight_stair')
    setWidthMm('1000')
    setTreadMm('270')
    setOpeningMarginMm('0')

    const source = activeLevelId && levels.some((entry) => entry.id === activeLevelId)
      ? activeLevelId
      : levels[0]?.id ?? ''
    const target = levels.find((entry) => entry.id !== source)?.id ?? source

    setFromLevelId(source)
    setToLevelId(target)
  }

  function buildStairJson(): Record<string, unknown> {
    const width = Number(widthMm)
    const tread = Number(treadMm)
    const margin = Number(openingMarginMm)

    return {
      ...(Number.isFinite(width) && width > 0 ? { width_mm: width } : {}),
      ...(Number.isFinite(tread) && tread > 0 ? { tread_mm: tread } : {}),
      ...(Number.isFinite(margin) && margin >= 0 ? { opening_margin_mm: margin } : {}),
    }
  }

  async function handleCreate() {
    if (!enabled || busy) return
    setError(null)

    if (!selectedRoomId) {
      setError('Bitte zuerst einen Raum auswählen.')
      return
    }

    if (!fromLevelId || !toLevelId) {
      setError('Bitte Start- und Zielebene auswählen.')
      return
    }

    if (fromLevelId === toLevelId) {
      setError('Start- und Zielebene müssen unterschiedlich sein.')
      return
    }

    setBusy(true)
    try {
      await onCreate({
        from_level_id: fromLevelId,
        to_level_id: toLevelId,
        kind,
        stair_json: buildStairJson(),
      })
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Treppe konnte nicht angelegt werden.')
    } finally {
      setBusy(false)
    }
  }

  async function handleSave() {
    if (!enabled || busy || !selectedId) return
    setError(null)

    if (!fromLevelId || !toLevelId) {
      setError('Bitte Start- und Zielebene auswählen.')
      return
    }

    if (fromLevelId === toLevelId) {
      setError('Start- und Zielebene müssen unterschiedlich sein.')
      return
    }

    setBusy(true)
    try {
      await onUpdate(selectedId, {
        from_level_id: fromLevelId,
        to_level_id: toLevelId,
        kind,
        stair_json: buildStairJson(),
      })
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Treppe konnte nicht gespeichert werden.')
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete() {
    if (!enabled || busy || !selectedId) return
    setError(null)
    setBusy(true)
    try {
      await onDelete(selectedId)
      resetForCreate()
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Treppe konnte nicht gelöscht werden.')
    } finally {
      setBusy(false)
    }
  }

  if (!enabled) {
    return (
      <section className={styles.section}>
        <h3 className={styles.title}>Treppen</h3>
        <p className={styles.hint}>Plugin deaktiviert</p>
      </section>
    )
  }

  return (
    <section className={styles.section}>
      <div className={styles.header}>
        <h3 className={styles.title}>Treppen</h3>
        <button type="button" className={styles.newButton} onClick={resetForCreate} disabled={busy}>
          Neu anlegen
        </button>
      </div>

      {visibleConnections.length === 0 ? (
        <p className={styles.hint}>Keine vertikalen Verbindungen auf dieser Ebene.</p>
      ) : (
        <ul className={styles.list}>
          {visibleConnections.map((entry) => {
            const active = entry.id === selectedId
            const fromName = levelName(levelById, entry.from_level_id)
            const toName = levelName(levelById, entry.to_level_id)
            return (
              <li key={entry.id}>
                <button
                  type="button"
                  className={`${styles.rowButton} ${active ? styles.rowButtonActive : ''}`}
                  onClick={() => {
                    setSelectedId(entry.id)
                    setError(null)
                  }}
                >
                  <span className={styles.rowKind}>{entry.kind}</span>
                  <span className={styles.rowMeta}>{fromName} → {toName}</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <div className={styles.form}>
        <label className={styles.label} htmlFor="stairs-kind">Typ</label>
        <select
          id="stairs-kind"
          className={styles.input}
          value={kind}
          onChange={(event) => setKind(event.target.value as VerticalConnectionKind)}
          disabled={busy}
        >
          {KIND_OPTIONS.map((entry) => (
            <option key={entry.value} value={entry.value}>{entry.label}</option>
          ))}
        </select>

        <label className={styles.label} htmlFor="stairs-from-level">Von Ebene</label>
        <select
          id="stairs-from-level"
          className={styles.input}
          value={fromLevelId}
          onChange={(event) => setFromLevelId(event.target.value)}
          disabled={busy || levels.length === 0}
        >
          {levels.map((entry) => (
            <option key={entry.id} value={entry.id}>{entry.name}</option>
          ))}
        </select>

        <label className={styles.label} htmlFor="stairs-to-level">Zu Ebene</label>
        <select
          id="stairs-to-level"
          className={styles.input}
          value={toLevelId}
          onChange={(event) => setToLevelId(event.target.value)}
          disabled={busy || levels.length === 0}
        >
          {levels.map((entry) => (
            <option key={entry.id} value={entry.id}>{entry.name}</option>
          ))}
        </select>

        <label className={styles.label} htmlFor="stairs-width">Breite (mm)</label>
        <input
          id="stairs-width"
          className={styles.input}
          type="number"
          min={1}
          value={widthMm}
          onChange={(event) => setWidthMm(event.target.value)}
          disabled={busy}
        />

        <label className={styles.label} htmlFor="stairs-tread">Auftritt (mm)</label>
        <input
          id="stairs-tread"
          className={styles.input}
          type="number"
          min={1}
          value={treadMm}
          onChange={(event) => setTreadMm(event.target.value)}
          disabled={busy}
        />

        <label className={styles.label} htmlFor="stairs-margin">Aussparungsrand (mm)</label>
        <input
          id="stairs-margin"
          className={styles.input}
          type="number"
          min={0}
          value={openingMarginMm}
          onChange={(event) => setOpeningMarginMm(event.target.value)}
          disabled={busy}
        />
      </div>

      {!selectedRoomId && <p className={styles.warn}>Zum Anlegen muss ein Raum ausgewählt sein.</p>}
      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.primaryButton}
          onClick={() => {
            void handleCreate()
          }}
          disabled={busy || !selectedRoomId || levels.length < 2}
        >
          {busy ? 'Arbeite…' : 'Anlegen'}
        </button>
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={() => {
            void handleSave()
          }}
          disabled={busy || !selectedId}
        >
          Speichern
        </button>
        <button
          type="button"
          className={styles.deleteButton}
          onClick={() => {
            void handleDelete()
          }}
          disabled={busy || !selectedId}
        >
          Löschen
        </button>
      </div>
    </section>
  )
}
