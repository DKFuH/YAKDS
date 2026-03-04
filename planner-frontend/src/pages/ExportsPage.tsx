import { useMemo, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { exportHtmlViewer, exportLayoutSheetSvg, exportPlanSvg } from '../api/viewerExports.js'
import {
  VIEWER_EXPORT_ARTIFACTS,
  type ViewerExportArtifactKind,
} from '../plugins/viewerExport/index.js'
import styles from './ExportsPage.module.css'

function sanitizeFilePart(value: string): string {
  return value
    .trim()
    .replace(/[^a-z0-9-_]+/gi, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase() || 'export'
}

function triggerDownload(blob: Blob, filename: string): void {
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = filename
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(objectUrl)
}

export function ExportsPage() {
  const navigate = useNavigate()
  const { id: projectId } = useParams<{ id: string }>()
  const [sheetId, setSheetId] = useState('')
  const [loadingKind, setLoadingKind] = useState<ViewerExportArtifactKind | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const labelByKind = useMemo(() => {
    return new Map(VIEWER_EXPORT_ARTIFACTS.map((artifact) => [artifact.kind, artifact.label]))
  }, [])

  if (!projectId) {
    return <Navigate to="/" replace />
  }

  const requiredProjectId = projectId
  const projectSlug = sanitizeFilePart(requiredProjectId)
  const sheetSlug = sanitizeFilePart(sheetId || 'sheet')

  async function runExport(kind: ViewerExportArtifactKind) {
    setLoadingKind(kind)
    setError(null)
    setSuccess(null)

    try {
      if (kind === 'html-viewer') {
        const blob = await exportHtmlViewer(requiredProjectId)
        triggerDownload(blob, `project-${projectSlug}-viewer.html`)
      } else if (kind === 'plan-svg') {
        const blob = await exportPlanSvg(requiredProjectId)
        triggerDownload(blob, `project-${projectSlug}-grundriss.svg`)
      } else {
        const normalizedSheetId = sheetId.trim()
        if (!normalizedSheetId) {
          throw new Error('Bitte eine Layout-Sheet-ID eingeben')
        }
        const blob = await exportLayoutSheetSvg(normalizedSheetId)
        triggerDownload(blob, `layout-sheet-${sheetSlug}.svg`)
      }

      setSuccess(`${labelByKind.get(kind) ?? 'Export'} erfolgreich heruntergeladen`)
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : 'Export fehlgeschlagen'
      setError(message)
    } finally {
      setLoadingKind(null)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <header className={styles.header}>
          <div>
            <p className={styles.kicker}>Projekt</p>
            <h1 className={styles.title}>Viewer-Exports</h1>
          </div>
          <button
            type="button"
            className={styles.btnSecondary}
            onClick={() => navigate(`/projects/${requiredProjectId}`)}
          >
            {'\u2190 Zur\u00fcck zum Editor'}
          </button>
        </header>

        <section className={styles.panel}>
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.btnPrimary}
              disabled={loadingKind !== null}
              onClick={() => void runExport('html-viewer')}
            >
              {loadingKind === 'html-viewer' ? 'Exportiere\u2026' : 'HTML Viewer'}
            </button>
            <button
              type="button"
              className={styles.btnPrimary}
              disabled={loadingKind !== null}
              onClick={() => void runExport('plan-svg')}
            >
              {loadingKind === 'plan-svg' ? 'Exportiere\u2026' : 'SVG Grundriss'}
            </button>
          </div>

          <div className={styles.sheetRow}>
            <label className={styles.field}>
              <span>Layout-Sheet-ID (optional)</span>
              <input
                value={sheetId}
                onChange={(event) => setSheetId(event.target.value)}
                placeholder="sheet-id"
              />
            </label>
            <button
              type="button"
              className={styles.btnSecondary}
              disabled={loadingKind !== null}
              onClick={() => void runExport('layout-sheet-svg')}
            >
              {loadingKind === 'layout-sheet-svg' ? 'Exportiere\u2026' : 'SVG Sheet'}
            </button>
          </div>

          {loadingKind && (
            <div className={styles.statusInfo}>
              Export l\u00e4uft: {labelByKind.get(loadingKind) ?? loadingKind}
            </div>
          )}
          {error && <div className={styles.statusError}>{error}</div>}
          {success && <div className={styles.statusSuccess}>{success}</div>}
        </section>
      </div>
    </div>
  )
}
