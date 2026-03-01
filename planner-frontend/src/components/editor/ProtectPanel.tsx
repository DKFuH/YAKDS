import { useState } from 'react'
import {
  validateV2Api,
  categoryFromKey,
  type ValidateV2Result,
  type ValidateV2Violation,
  type RuleCategory,
  type RuleSeverity,
} from '../../api/validateV2.js'
import type { Placement } from '../../api/placements.js'
import styles from './ProtectPanel.module.css'

type CategoryFilter = 'all' | RuleCategory
type SeverityFilter = 'all' | RuleSeverity

const CATEGORY_LABELS: Record<RuleCategory, string> = {
  collision: 'Kollision',
  clearance: 'Abstand',
  ergonomics: 'Ergonomie',
  completeness: 'Vollständigkeit',
  accessory: 'Zubehör',
}

const SEVERITY_LABELS: Record<RuleSeverity, string> = {
  error: 'Fehler',
  warning: 'Warnung',
  hint: 'Hinweis',
}

interface Props {
  projectId: string
  roomId: string | null
  placements: Placement[]
  ceilingHeightMm: number
}

export function ProtectPanel({ projectId, roomId, placements, ceilingHeightMm }: Props) {
  const [tenantId, setTenantId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ValidateV2Result | null>(null)
  const [finalResult, setFinalResult] = useState<'ok' | 'fail' | null>(null)
  const [finalLoading, setFinalLoading] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all')
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all')

  async function runCheck() {
    if (!tenantId.trim()) { setError('Tenant-ID fehlt.'); return }
    if (!roomId) { setError('Kein Raum ausgewählt.'); return }
    setLoading(true)
    setError(null)
    try {
      const res = await validateV2Api.run(projectId, tenantId.trim(), {
        room_id: roomId,
        placements: placements.map(p => ({
          id: p.id,
          wall_id: p.wall_id,
          offset_mm: p.offset_mm,
          width_mm: p.width_mm,
          depth_mm: p.depth_mm,
          height_mm: p.height_mm,
          type: 'base' as const,
        })),
        ceiling_height_mm: ceilingHeightMm,
      })
      setResult(res)
      setFinalResult(null)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Prüfung fehlgeschlagen.')
    } finally {
      setLoading(false)
    }
  }

  async function runFinal() {
    if (!tenantId.trim()) { setError('Tenant-ID fehlt.'); return }
    setFinalLoading(true)
    setError(null)
    try {
      const history = await validateV2Api.history(projectId, tenantId.trim())
      const last = history[0]
      setFinalResult(!last || last.summary_json.errors > 0 ? 'fail' : 'ok')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Finalprüfung fehlgeschlagen.')
    } finally {
      setFinalLoading(false)
    }
  }

  const filtered: ValidateV2Violation[] = result
    ? result.violations.filter(v => {
        if (severityFilter !== 'all' && v.severity !== severityFilter) return false
        if (categoryFilter !== 'all' && categoryFromKey(v.rule_key) !== categoryFilter) return false
        return true
      })
    : []

  return (
    <div className={styles.panel}>
      <h3 className={styles.title}>Protect-Prüfung</h3>

      <input
        type="text"
        className={styles.tenantInput}
        placeholder="Tenant-ID"
        value={tenantId}
        onChange={e => setTenantId(e.target.value)}
      />

      <div className={styles.btnRow}>
        <button
          type="button"
          className={styles.runBtn}
          onClick={() => { void runCheck() }}
          disabled={loading || !roomId}
        >
          {loading ? 'Prüfe…' : 'Jetzt prüfen'}
        </button>
        <button
          type="button"
          className={styles.finalBtn}
          onClick={() => { void runFinal() }}
          disabled={finalLoading}
        >
          {finalLoading ? '…' : 'Finalprüfung'}
        </button>
      </div>

      {finalResult && (
        <p className={finalResult === 'ok' ? styles.finalOk : styles.finalFail}>
          {finalResult === 'ok' ? '✓ Letzte Prüfung: keine Fehler' : '✗ Letzte Prüfung: Fehler vorhanden'}
        </p>
      )}

      {error && <p className={styles.error}>{error}</p>}

      {result && (
        <>
          <div className={styles.summary}>
            <span className={styles.sumError}>{result.summary.errors} Fehler</span>
            <span className={styles.sumWarn}>{result.summary.warnings} Warn.</span>
            <span className={styles.sumHint}>{result.summary.hints} Hinw.</span>
          </div>

          <div className={styles.filters}>
            <div className={styles.filterRow}>
              {(['all', 'collision', 'clearance', 'ergonomics', 'completeness', 'accessory'] as const).map(cat => (
                <button
                  key={cat}
                  type="button"
                  className={`${styles.chip} ${categoryFilter === cat ? styles.chipActive : ''}`}
                  onClick={() => setCategoryFilter(cat)}
                >
                  {cat === 'all' ? 'Alle' : CATEGORY_LABELS[cat]}
                </button>
              ))}
            </div>
            <div className={styles.filterRow}>
              {(['all', 'error', 'warning', 'hint'] as const).map(sev => (
                <button
                  key={sev}
                  type="button"
                  className={`${styles.chip} ${styles[`sev_${sev}`] ?? ''} ${severityFilter === sev ? styles.chipActive : ''}`}
                  onClick={() => setSeverityFilter(sev)}
                >
                  {sev === 'all' ? 'Alle' : SEVERITY_LABELS[sev]}
                </button>
              ))}
            </div>
          </div>

          {filtered.length === 0 ? (
            <p className={styles.empty}>Keine Einträge für diesen Filter.</p>
          ) : (
            <ul className={styles.list}>
              {filtered.map(v => (
                <li
                  key={v.id}
                  className={`${styles.item} ${v.severity === 'error' ? styles.itemError : v.severity === 'warning' ? styles.itemWarning : styles.itemHint}`}
                >
                  <div className={styles.itemHeader}>
                    <span className={styles.ruleKey}>{v.rule_key}</span>
                    <span className={styles.sevLabel}>{SEVERITY_LABELS[v.severity]}</span>
                  </div>
                  <p className={styles.itemMsg}>{v.message}</p>
                  {v.hint && <p className={styles.itemHintText}>→ {v.hint}</p>}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}
