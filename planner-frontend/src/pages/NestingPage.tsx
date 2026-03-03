import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { cutlistApi } from '../api/projectFeatures.js'
import { nestingApi, type NestingJob, type NestingResult } from '../api/nesting.js'
import styles from './NestingPage.module.css'

type CutlistRecord = {
  id: string
  generated_at: string
  summary?: { total_parts?: number }
}

const presets = [
  { label: '2800 x 2070', width_mm: 2800, height_mm: 2070 },
  { label: '4100 x 1300', width_mm: 4100, height_mm: 1300 },
  { label: 'Frei definieren', width_mm: 2800, height_mm: 2070 },
]

function getResult(job: NestingJob | null): NestingResult {
  if (!job || typeof job.result_json !== 'object' || !job.result_json) {
    return { sheets: [], total_parts: 0, placed_parts: 0, waste_pct: 0 }
  }
  return job.result_json
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export function NestingPage() {
  const { id: projectId } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [cutlists, setCutlists] = useState<CutlistRecord[]>([])
  const [jobs, setJobs] = useState<NestingJob[]>([])
  const [selectedCutlistId, setSelectedCutlistId] = useState('')
  const [selectedPreset, setSelectedPreset] = useState('2800 x 2070')
  const [sheetWidth, setSheetWidth] = useState(2800)
  const [sheetHeight, setSheetHeight] = useState(2070)
  const [kerf, setKerf] = useState(4)
  const [allowRotate, setAllowRotate] = useState(true)
  const [activeJobId, setActiveJobId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const activeJob = useMemo(() => jobs.find((job) => job.id === activeJobId) ?? null, [jobs, activeJobId])
  const result = getResult(activeJob)

  async function load() {
    if (!projectId) return
    setLoading(true)
    setError(null)
    try {
      const [cutlistRows, jobRows] = await Promise.all([
        cutlistApi.list(projectId) as Promise<CutlistRecord[]>,
        nestingApi.listNestingJobs(projectId),
      ])
      setCutlists(cutlistRows)
      setJobs(jobRows)
      setSelectedCutlistId((prev) => prev || cutlistRows[0]?.id || '')
      setActiveJobId((prev) => prev ?? jobRows[0]?.id ?? null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler beim Laden')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [projectId])

  function applyPreset(label: string) {
    setSelectedPreset(label)
    const preset = presets.find((entry) => entry.label === label)
    if (!preset) return
    if (label !== 'Frei definieren') {
      setSheetWidth(preset.width_mm)
      setSheetHeight(preset.height_mm)
    }
  }

  async function onCreateJob() {
    if (!projectId || !selectedCutlistId) return
    setLoading(true)
    setError(null)
    try {
      const created = await nestingApi.createNestingJob(projectId, {
        source_cutlist_id: selectedCutlistId,
        sheet_width_mm: sheetWidth,
        sheet_height_mm: sheetHeight,
        kerf_mm: kerf,
        allow_rotate: allowRotate,
      })
      setJobs((prev) => [created, ...prev])
      setActiveJobId(created.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Nesting fehlgeschlagen')
    } finally {
      setLoading(false)
    }
  }

  async function onDeleteJob(jobId: string) {
    if (!confirm('Nesting-Job loeschen?')) return
    setError(null)
    try {
      await nestingApi.deleteNestingJob(jobId)
      setJobs((prev) => {
        const next = prev.filter((job) => job.id !== jobId)
        if (activeJobId === jobId) {
          setActiveJobId(next[0]?.id ?? null)
        }
        return next
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Loeschen fehlgeschlagen')
    }
  }

  async function onExportDxf() {
    if (!activeJob) return
    setError(null)
    try {
      const blob = await nestingApi.downloadNestingDxf(activeJob.id)
      triggerDownload(blob, `nesting-${activeJob.id}.dxf`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export fehlgeschlagen')
    }
  }

  if (!projectId) {
    return <div className={styles.page}>Projekt-ID fehlt.</div>
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1>Nesting</h1>
        <div className={styles.actions}>
          <button className={styles.btnSecondary} onClick={() => navigate(`/projects/${projectId}`)}>Zurueck</button>
          <button className={styles.btnPrimary} onClick={() => void onCreateJob()} disabled={loading || !selectedCutlistId}>
            Nesting berechnen
          </button>
        </div>
      </header>

      {error && <div className={styles.error}>{error}</div>}

      <section className={styles.section}>
        <div className={styles.formGrid}>
          <label>
            Cutlist
            <select value={selectedCutlistId} onChange={(e) => setSelectedCutlistId(e.target.value)}>
              <option value="">Bitte waehlen</option>
              {cutlists.map((cutlist) => (
                <option key={cutlist.id} value={cutlist.id}>
                  {new Date(cutlist.generated_at).toLocaleString('de-DE')} ({cutlist.summary?.total_parts ?? 0} Teile)
                </option>
              ))}
            </select>
          </label>

          <label>
            Rohplattenformat
            <select value={selectedPreset} onChange={(e) => applyPreset(e.target.value)}>
              {presets.map((preset) => (
                <option key={preset.label} value={preset.label}>{preset.label}</option>
              ))}
            </select>
          </label>

          <label>
            Breite (mm)
            <input
              type="number"
              value={sheetWidth}
              disabled={selectedPreset !== 'Frei definieren'}
              onChange={(e) => setSheetWidth(Number(e.target.value) || 0)}
            />
          </label>

          <label>
            Hoehe (mm)
            <input
              type="number"
              value={sheetHeight}
              disabled={selectedPreset !== 'Frei definieren'}
              onChange={(e) => setSheetHeight(Number(e.target.value) || 0)}
            />
          </label>

          <label>
            Kerf (mm)
            <input type="number" value={kerf} onChange={(e) => setKerf(Number(e.target.value) || 0)} />
          </label>

          <label>
            <input type="checkbox" checked={allowRotate} onChange={(e) => setAllowRotate(e.target.checked)} />
            Rotation erlauben
          </label>
        </div>
      </section>

      <section className={styles.section}>
        <h2>Jobs</h2>
        {loading && jobs.length === 0 ? <p>Lade...</p> : (
          <ul>
            {jobs.map((job) => (
              <li key={job.id}>
                <button className={styles.btnSecondary} onClick={() => setActiveJobId(job.id)}>
                  {new Date(job.created_at).toLocaleString('de-DE')} · {job.status}
                </button>
                {' '}
                <button className={styles.btnDanger} onClick={() => void onDeleteJob(job.id)}>Loeschen</button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {activeJob && (
        <section className={styles.section}>
          <h2>Ergebnis</h2>
          <div className={styles.kpis}>
            <div className={styles.kpiCard}>Platten: <strong>{result.sheets.length}</strong></div>
            <div className={styles.kpiCard}>Verschnitt: <strong>{result.waste_pct.toFixed(2)}%</strong></div>
            <div className={styles.kpiCard}>Teile: <strong>{result.placed_parts} / {result.total_parts}</strong></div>
            <button className={styles.btnPrimary} onClick={() => void onExportDxf()}>DXF exportieren</button>
          </div>

          <div className={styles.previewList}>
            {result.sheets.map((sheet) => (
              <article key={sheet.index} className={styles.sheetPreview}>
                <h3>Platte {sheet.index}</h3>
                <svg className={styles.sheetSvg} viewBox={`0 0 ${sheet.width_mm} ${sheet.height_mm}`}>
                  <rect x="0" y="0" width={sheet.width_mm} height={sheet.height_mm} fill="none" stroke="currentColor" strokeWidth="8" />
                  {sheet.placements.map((placement, index) => (
                    <g key={`${placement.part_id}-${index}`}>
                      <rect
                        x={placement.x_mm}
                        y={placement.y_mm}
                        width={placement.width_mm}
                        height={placement.height_mm}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <text x={placement.x_mm + 8} y={placement.y_mm + 28} fontSize="24" fill="currentColor">
                        {placement.part_id}
                      </text>
                    </g>
                  ))}
                </svg>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

