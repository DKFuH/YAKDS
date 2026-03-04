import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { QuoteLine, PricingGroup } from '@shared/types'
import { quoteLinesApi, pricingGroupsApi } from '../api/projectFeatures.js'
import { projectsApi } from '../api/projects.js'
import { resequenceQuoteLines } from '../api/quotes.js'
import styles from './QuoteLinesPage.module.css'

// ─── Hilfsfunktionen ─────────────────────────────────────────────────────────

function formatEur(value: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(value)
}

const UNIT_LABELS: Record<QuoteLine['unit'], string> = {
  stk: 'Stk.',
  m: 'lfm',
  m2: 'm²',
  pauschal: 'pauschal',
}

const TYPE_LABELS: Record<QuoteLine['type'], string> = {
  standard: 'Standard',
  custom: 'Individuell',
  text: 'Textzeile',
}

// ─── Hauptkomponente ─────────────────────────────────────────────────────────

export function QuoteLinesPage() {
  const { id: projectId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [lines, setLines] = useState<QuoteLine[]>([])
  const [pricingGroups, setPricingGroups] = useState<PricingGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [resequenceMessage, setResequenceMessage] = useState<string | null>(null)
  const [latestQuoteId, setLatestQuoteId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)

  useEffect(() => {
    if (!projectId) return
    setLoading(true)
    Promise.all([
      quoteLinesApi.list(projectId),
      pricingGroupsApi.list(projectId),
      projectsApi.get(projectId),
    ])
      .then(([ql, pg, project]) => {
        setLines(ql)
        setPricingGroups(pg)
        const latestQuote = [...project.quotes].sort((left, right) => right.version - left.version)[0] ?? null
        setLatestQuoteId(latestQuote?.id ?? null)
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [projectId])

  async function handleResequenceFromPosition() {
    if (!latestQuoteId) {
      setError('Keine Angebotsversion vorhanden. Erstelle zuerst ein Angebot.')
      return
    }

    const rawStart = window.prompt('Neue Start-Positionsnummer:', '1')
    if (rawStart == null) {
      return
    }

    const startPosition = Number.parseInt(rawStart, 10)
    if (!Number.isFinite(startPosition) || startPosition < 1) {
      setError('Bitte eine gültige Start-Positionsnummer (>= 1) eingeben.')
      return
    }

    setError(null)
    setResequenceMessage(null)

    try {
      const result = await resequenceQuoteLines(latestQuoteId, startPosition)
      setResequenceMessage(`Positionen neu nummeriert: ${result.updated_count} Zeilen, Start bei ${result.start_position}.`)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Positionsnummern konnten nicht neu gesetzt werden.')
    }
  }

  // Neue Zeile anlegen
  async function handleAddLine(type: QuoteLine['type']) {
    if (!projectId) return
    setError(null)
    try {
      const newLine = await quoteLinesApi.create(projectId, {
        type,
        description: type === 'text' ? 'Überschrift' : 'Neue Position',
        qty: 1,
        unit: 'stk',
        list_price_net: 0,
        position_discount_pct: 0,
        sort_order: lines.length,
      })
      setLines((prev) => [...prev, newLine])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Fehler beim Anlegen')
    }
  }

  // Zeile aktualisieren
  async function handleUpdateLine(lineId: string, data: Partial<Omit<QuoteLine, 'id' | 'project_id'>>) {
    if (!projectId) return
    setError(null)
    try {
      const updated = await quoteLinesApi.update(projectId, lineId, data)
      setLines((prev) => prev.map((l) => (l.id === lineId ? updated : l)))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Fehler beim Speichern')
    }
  }

  // Zeile löschen
  async function handleDeleteLine(lineId: string) {
    if (!projectId || !confirm('Position wirklich löschen?')) return
    setError(null)
    try {
      await quoteLinesApi.delete(projectId, lineId)
      setLines((prev) => prev.filter((l) => l.id !== lineId))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Fehler beim Löschen')
    }
  }

  // Preisgruppe anlegen
  async function handleAddPricingGroup() {
    if (!projectId) return
    const name = window.prompt('Name der Preisgruppe:', 'Preisgruppe')
    if (!name?.trim()) return
    const discountStr = window.prompt('Rabatt in % (z.B. 10):', '0')
    const discount = parseFloat(discountStr ?? '0')
    if (!Number.isFinite(discount)) return
    setError(null)
    try {
      const group = await pricingGroupsApi.create(projectId, {
        name: name.trim(),
        discount_pct: discount,
      })
      setPricingGroups((prev) => [...prev, group])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Fehler beim Anlegen')
    }
  }

  // ─── Summen ────────────────────────────────────────────────────────────────

  const activeLines = lines.filter((l) => l.type !== 'text' && !l.exclude_from_quote)
  const totalListNet = activeLines.reduce((sum, l) => sum + l.list_price_net * l.qty, 0)
  const totalAfterDiscount = activeLines.reduce((sum, l) => {
    const group = pricingGroups.find((g) => g.id === l.pricing_group_id)
    const groupDiscount = group?.discount_pct ?? 0
    const totalDiscount = Math.min(100, l.position_discount_pct + groupDiscount)
    return sum + l.list_price_net * l.qty * (1 - totalDiscount / 100)
  }, 0)

  if (loading) {
    return <div className={styles.center}>Lade Angebotspositionen…</div>
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>Phase 3 · Sprint 40</p>
          <h1>Angebotspositionen</h1>
          <p className={styles.subtitle}>
            Manuelle Angebotszeilen, Preisgruppen und Zeilenstruktur für Projekt {projectId?.slice(0, 8)}…
          </p>
        </div>
        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.btnSecondary}
            onClick={() => navigate(projectId ? `/projects/${projectId}` : '/')}
          >
            ← Zurück zum Editor
          </button>
          <button
            type="button"
            className={styles.btnSecondary}
            onClick={() => void handleResequenceFromPosition()}
            disabled={!latestQuoteId}
            title={latestQuoteId ? 'Positionsnummern ab Startwert neu setzen' : 'Erfordert eine bestehende Angebotsversion'}
          >
            Pos.-Nr. neu ab…
          </button>
          <button type="button" className={styles.btnSecondary} onClick={() => void handleAddLine('text')}>
            + Textzeile
          </button>
          <button type="button" className={styles.btnSecondary} onClick={() => void handleAddLine('custom')}>
            + Individuelle Position
          </button>
          <button type="button" className={styles.btnPrimary} onClick={() => void handleAddLine('standard')}>
            + Standard-Position
          </button>
        </div>
      </header>

      {error && <div className={styles.error}>{error}</div>}
  {resequenceMessage && <div className={styles.success}>{resequenceMessage}</div>}

      {/* Preisgruppen */}
      <section className={styles.groupSection}>
        <div className={styles.groupHeader}>
          <h2>Preisgruppen</h2>
          <button type="button" className={styles.btnSmall} onClick={() => void handleAddPricingGroup()}>
            + Preisgruppe
          </button>
        </div>
        {pricingGroups.length === 0 ? (
          <p className={styles.empty}>Keine Preisgruppen angelegt.</p>
        ) : (
          <div className={styles.groupList}>
            {pricingGroups.map((group) => (
              <div key={group.id} className={styles.groupChip}>
                <strong>{group.name}</strong>
                <span>{group.discount_pct}% Rabatt</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Zeilen-Tabelle */}
      <section className={styles.tableSection}>
        {lines.length === 0 ? (
          <div className={styles.emptyState}>
            <p>Noch keine Angebotspositionen. Lege die erste Position über die Buttons oben an.</p>
          </div>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Typ</th>
                  <th>Beschreibung</th>
                  <th className={styles.numCol}>Menge</th>
                  <th>Einheit</th>
                  <th className={styles.numCol}>Einzelpreis netto</th>
                  <th className={styles.numCol}>Pos.-Rabatt</th>
                  <th>Preisgruppe</th>
                  <th className={styles.numCol}>Gesamt netto</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {lines
                  .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
                  .map((line) => (
                    <QuoteLineRow
                      key={line.id}
                      line={line}
                      pricingGroups={pricingGroups}
                      isEditing={editingId === line.id}
                      onStartEdit={() => setEditingId(line.id)}
                      onEndEdit={() => setEditingId(null)}
                      onUpdate={(data) => void handleUpdateLine(line.id, data)}
                      onDelete={() => void handleDeleteLine(line.id)}
                    />
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Summen-Zeile */}
      {activeLines.length > 0 && (
        <section className={styles.summary}>
          <div className={styles.summaryGrid}>
            <div className={styles.summaryItem}>
              <span>Listenpreis gesamt (netto)</span>
              <strong>{formatEur(totalListNet)}</strong>
            </div>
            <div className={styles.summaryItem}>
              <span>Nach Rabatten (netto)</span>
              <strong>{formatEur(totalAfterDiscount)}</strong>
            </div>
            <div className={styles.summaryItem}>
              <span>Ersparnis</span>
              <strong className={styles.savings}>{formatEur(totalListNet - totalAfterDiscount)}</strong>
            </div>
            <div className={styles.summaryItem}>
              <span>MwSt. 19%</span>
              <strong>{formatEur(totalAfterDiscount * 0.19)}</strong>
            </div>
            <div className={`${styles.summaryItem} ${styles.summaryTotal}`}>
              <span>Gesamtbetrag (brutto)</span>
              <strong>{formatEur(totalAfterDiscount * 1.19)}</strong>
            </div>
          </div>
        </section>
      )}
    </div>
  )
}

// ─── QuoteLineRow ─────────────────────────────────────────────────────────────

interface QuoteLineRowProps {
  line: QuoteLine
  pricingGroups: PricingGroup[]
  isEditing: boolean
  onStartEdit: () => void
  onEndEdit: () => void
  onUpdate: (data: Partial<Omit<QuoteLine, 'id' | 'project_id'>>) => void
  onDelete: () => void
}

function QuoteLineRow({ line, pricingGroups, isEditing, onStartEdit, onEndEdit, onUpdate, onDelete }: QuoteLineRowProps) {
  const [desc, setDesc] = useState(line.description)
  const [qty, setQty] = useState(String(line.qty))
  const [price, setPrice] = useState(String(line.list_price_net))
  const [discount, setDiscount] = useState(String(line.position_discount_pct))

  useEffect(() => {
    setDesc(line.description)
    setQty(String(line.qty))
    setPrice(String(line.list_price_net))
    setDiscount(String(line.position_discount_pct))
  }, [line.id])

  function commitAll() {
    const nextQty = parseFloat(qty)
    const nextPrice = parseFloat(price)
    const nextDiscount = parseFloat(discount)
    onUpdate({
      description: desc.trim() || line.description,
      qty: Number.isFinite(nextQty) && nextQty > 0 ? nextQty : line.qty,
      list_price_net: Number.isFinite(nextPrice) && nextPrice >= 0 ? nextPrice : line.list_price_net,
      position_discount_pct: Number.isFinite(nextDiscount) && nextDiscount >= 0 ? nextDiscount : line.position_discount_pct,
    })
    onEndEdit()
  }

  const group = pricingGroups.find((g) => g.id === line.pricing_group_id)
  const groupDiscount = group?.discount_pct ?? 0
  const totalDiscount = Math.min(100, line.position_discount_pct + groupDiscount)
  const lineTotal = line.type !== 'text'
    ? line.list_price_net * line.qty * (1 - totalDiscount / 100)
    : null

  const isTextLine = line.type === 'text'

  if (!isEditing) {
    return (
      <tr
        className={`${styles.tr} ${isTextLine ? styles.trText : ''} ${line.exclude_from_quote ? styles.trExcluded : ''}`}
        onDoubleClick={onStartEdit}
      >
        <td><span className={styles.typeBadge}>{TYPE_LABELS[line.type]}</span></td>
        <td className={styles.descCell}>{line.description}</td>
        <td className={styles.numCol}>{isTextLine ? '–' : line.qty}</td>
        <td>{isTextLine ? '–' : UNIT_LABELS[line.unit]}</td>
        <td className={styles.numCol}>{isTextLine ? '–' : formatEur(line.list_price_net)}</td>
        <td className={styles.numCol}>{isTextLine ? '–' : `${line.position_discount_pct}%`}</td>
        <td>{group?.name ?? '–'}</td>
        <td className={styles.numCol}>{lineTotal != null ? formatEur(lineTotal) : '–'}</td>
        <td>
          <div className={styles.rowActions}>
            <button type="button" className={styles.btnEdit} onClick={onStartEdit} title="Bearbeiten">✎</button>
            <button type="button" className={styles.btnDelete} onClick={onDelete} title="Löschen">×</button>
          </div>
        </td>
      </tr>
    )
  }

  return (
    <tr className={`${styles.tr} ${styles.trEditing}`}>
      <td><span className={styles.typeBadge}>{TYPE_LABELS[line.type]}</span></td>
      <td>
        <input
          className={styles.cellInput}
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          autoFocus
        />
      </td>
      <td>
        {!isTextLine && (
          <input
            className={`${styles.cellInput} ${styles.numInput}`}
            type="number"
            min={0.001}
            step={0.001}
            value={qty}
            onChange={(e) => setQty(e.target.value)}
          />
        )}
      </td>
      <td>
        {!isTextLine && (
          <select
            className={styles.cellSelect}
            value={line.unit}
            onChange={(e) => onUpdate({ unit: e.target.value as QuoteLine['unit'] })}
          >
            {Object.entries(UNIT_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        )}
      </td>
      <td>
        {!isTextLine && (
          <input
            className={`${styles.cellInput} ${styles.numInput}`}
            type="number"
            min={0}
            step={0.01}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        )}
      </td>
      <td>
        {!isTextLine && (
          <input
            className={`${styles.cellInput} ${styles.numInput}`}
            type="number"
            min={0}
            max={100}
            step={0.1}
            value={discount}
            onChange={(e) => setDiscount(e.target.value)}
          />
        )}
      </td>
      <td>
        {!isTextLine && (
          <select
            className={styles.cellSelect}
            value={line.pricing_group_id ?? ''}
            onChange={(e) => onUpdate({ pricing_group_id: e.target.value || undefined })}
          >
            <option value="">Keine</option>
            {pricingGroups.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        )}
      </td>
      <td></td>
      <td>
        <div className={styles.rowActions}>
          <button type="button" className={styles.btnSave} onClick={commitAll}>✓</button>
          <button type="button" className={styles.btnCancel} onClick={onEndEdit}>✕</button>
        </div>
      </td>
    </tr>
  )
}
