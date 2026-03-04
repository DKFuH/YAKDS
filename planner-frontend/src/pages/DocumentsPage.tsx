import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  documentsApi,
  type DocumentSourceKind,
  type DocumentType,
  type DocumentVersionCheckResult,
  type ProjectDocument,
} from '../api/documents.js'
import { projectsApi, type Project } from '../api/projects.js'
import styles from './DocumentsPage.module.css'

const TYPE_LABELS: Record<DocumentType, string> = {
  quote_pdf: 'Angebot / PDF',
  order_pdf: 'Auftrags-PDF',
  spec_package: 'Spezifikationspaket',
  manual_upload: 'Manueller Upload',
  render_image: 'Rendering',
  cad_import: 'CAD / SKP',
  email: 'E-Mail',
  contract: 'Vertrag',
  conflict_entry: 'Konfliktversion',
  other: 'Sonstiges',
}

const SOURCE_LABELS: Record<DocumentSourceKind, string> = {
  manual_upload: 'Manuell',
  quote_export: 'Angebot-Export',
  order_export: 'Auftrags-Export',
  spec_export: 'Spezifikations-Export',
  render_job: 'Rendering-Job',
  import_job: 'Import-Job',
  archive_version: 'Archiv-Version',
  offline_sync: 'Offline-Sync',
  conflict_local: 'Lokaler Konflikt',
}

const VERSION_STATUS_LABELS: Record<DocumentVersionCheckResult['status'], string> = {
  up_to_date: 'Synchron',
  local_newer: 'Lokal neuer',
  server_newer: 'Server neuer',
  conflict: 'Konflikt',
  missing_on_server: 'Keine Serverversion',
}

function formatFileSize(sizeBytes: number): string {
  if (sizeBytes < 1024) {
    return `${sizeBytes} B`
  }
  if (sizeBytes < 1024 * 1024) {
    return `${(sizeBytes / 1024).toFixed(1)} KB`
  }
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`
}

function buildPreviewUrl(document: ProjectDocument): string | null {
  if (document.preview_url) {
    return document.preview_url
  }

  if (document.mime_type.startsWith('image/') || document.mime_type === 'application/pdf') {
    return document.download_url
  }

  return null
}

export function DocumentsPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [projects, setProjects] = useState<Project[]>([])
  const [documents, setDocuments] = useState<ProjectDocument[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState(searchParams.get('project') ?? '')
  const [typeFilter, setTypeFilter] = useState<'all' | DocumentType>('all')
  const [tagFilter, setTagFilter] = useState('')
  const [sourceFilter, setSourceFilter] = useState<'all' | DocumentSourceKind>('all')
  const [createdFrom, setCreatedFrom] = useState('')
  const [createdTo, setCreatedTo] = useState('')
  const [includeConflicts, setIncludeConflicts] = useState(false)
  const [search, setSearch] = useState('')
  const [uploadType, setUploadType] = useState<DocumentType>('manual_upload')
  const [uploadTags, setUploadTags] = useState('')
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null)
  const [localChecksum, setLocalChecksum] = useState('')
  const [localUpdatedAt, setLocalUpdatedAt] = useState('')
  const [versionCheckResult, setVersionCheckResult] = useState<DocumentVersionCheckResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [archiving, setArchiving] = useState(false)
  const [checkingVersion, setCheckingVersion] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function loadProjectsAndMaybeDocuments(projectIdFromQuery?: string) {
    setLoading(true)
    setError(null)
    try {
      const projectList = await projectsApi.list()
      const activeProjects = projectList.filter((project) => project.status === 'active')
      setProjects(activeProjects)

      const preferredProjectId =
        projectIdFromQuery ||
        selectedProjectId ||
        activeProjects[0]?.id ||
        ''

      if (!preferredProjectId) {
        setDocuments([])
        setActiveDocumentId(null)
        return
      }

      setSelectedProjectId(preferredProjectId)
      const loadedDocuments = await documentsApi.list(preferredProjectId, {
        type: typeFilter === 'all' ? undefined : typeFilter,
        tag: tagFilter.trim() || undefined,
        source_kind: sourceFilter === 'all' ? undefined : sourceFilter,
        created_from: createdFrom || undefined,
        created_to: createdTo || undefined,
        include_conflicts: includeConflicts,
      })
      setDocuments(loadedDocuments)
      setActiveDocumentId((current) => current ?? loadedDocuments[0]?.id ?? null)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Dokumente konnten nicht geladen werden')
    } finally {
      setLoading(false)
    }
  }

  async function loadDocuments(
    projectId: string,
    nextType = typeFilter,
    nextTag = tagFilter,
    nextSource = sourceFilter,
    nextCreatedFrom = createdFrom,
    nextCreatedTo = createdTo,
    nextIncludeConflicts = includeConflicts,
  ) {
    setLoading(true)
    setError(null)
    try {
      const loadedDocuments = await documentsApi.list(projectId, {
        type: nextType === 'all' ? undefined : nextType,
        tag: nextTag.trim() || undefined,
        source_kind: nextSource === 'all' ? undefined : nextSource,
        created_from: nextCreatedFrom || undefined,
        created_to: nextCreatedTo || undefined,
        include_conflicts: nextIncludeConflicts,
      })
      setDocuments(loadedDocuments)
      setActiveDocumentId((current) => (
        loadedDocuments.some((document) => document.id === current)
          ? current
          : (loadedDocuments[0]?.id ?? null)
      ))
      return loadedDocuments
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Dokumente konnten nicht geladen werden')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const projectFromQuery = searchParams.get('project') ?? undefined
    void loadProjectsAndMaybeDocuments(projectFromQuery)
  }, [])

  const filteredDocuments = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) {
      return documents
    }

    return documents.filter((document) => {
      const haystack = [
        document.filename,
        document.original_filename,
        document.type,
        ...document.tags,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      return haystack.includes(query)
    })
  }, [documents, search])

  const activeDocument = filteredDocuments.find((document) => document.id === activeDocumentId) ?? filteredDocuments[0] ?? null

  const versionHistory = useMemo(() => {
    if (!activeDocument) {
      return []
    }

    return documents
      .filter((document) => (
        activeDocument.source_id
          ? (document.source_kind === activeDocument.source_kind && document.source_id === activeDocument.source_id)
          : (document.filename === activeDocument.filename && document.source_id === null)
      ))
      .sort((left, right) => {
        if (left.version_no !== right.version_no) {
          return right.version_no - left.version_no
        }
        return right.uploaded_at.localeCompare(left.uploaded_at)
      })
  }, [activeDocument, documents])

  useEffect(() => {
    setVersionCheckResult(null)
  }, [activeDocumentId])

  async function handleProjectChange(nextProjectId: string) {
    setSelectedProjectId(nextProjectId)
    setSearchParams(nextProjectId ? { project: nextProjectId } : {})
    if (!nextProjectId) {
      setDocuments([])
      setActiveDocumentId(null)
      return
    }
    await loadDocuments(nextProjectId, typeFilter, tagFilter)
  }

  async function handleApplyFilters() {
    if (!selectedProjectId) {
      return
    }
    await loadDocuments(
      selectedProjectId,
      typeFilter,
      tagFilter,
      sourceFilter,
      createdFrom,
      createdTo,
      includeConflicts,
    )
  }

  async function handleUpload(event: React.FormEvent) {
    event.preventDefault()
    if (!selectedProjectId || selectedFiles.length === 0) {
      return
    }

    setUploading(true)
    setError(null)
    try {
      await documentsApi.uploadMany(selectedProjectId, selectedFiles, {
        type: uploadType,
        tags: uploadTags.split(',').map((entry) => entry.trim()).filter(Boolean),
      })
      setSelectedFiles([])
      setUploadTags('')
      await loadDocuments(
        selectedProjectId,
        typeFilter,
        tagFilter,
        sourceFilter,
        createdFrom,
        createdTo,
        includeConflicts,
      )
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Upload fehlgeschlagen')
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete(documentId: string) {
    if (!selectedProjectId) {
      return
    }
    if (!window.confirm('Dokument wirklich löschen?')) {
      return
    }

    try {
      await documentsApi.remove(selectedProjectId, documentId)
      await loadDocuments(
        selectedProjectId,
        typeFilter,
        tagFilter,
        sourceFilter,
        createdFrom,
        createdTo,
        includeConflicts,
      )
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Dokument konnte nicht gelöscht werden')
    }
  }

  async function handleArchiveVersion() {
    if (!selectedProjectId || !activeDocument) {
      return
    }

    setArchiving(true)
    setError(null)
    try {
      const archived = await documentsApi.archiveVersion(selectedProjectId, activeDocument.id, {
        uploaded_by: 'planner-frontend',
        source_kind: activeDocument.source_kind,
        source_id: activeDocument.source_id,
      })
      await loadDocuments(
        selectedProjectId,
        typeFilter,
        tagFilter,
        sourceFilter,
        createdFrom,
        createdTo,
        includeConflicts,
      )
      setActiveDocumentId(archived.id)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Version konnte nicht archiviert werden')
    } finally {
      setArchiving(false)
    }
  }

  async function handleVersionCheck() {
    if (!selectedProjectId || !activeDocument) {
      return
    }

    setCheckingVersion(true)
    setError(null)
    try {
      const result = await documentsApi.versionCheck(selectedProjectId, {
        source_kind: activeDocument.source_kind,
        source_id: activeDocument.source_id ?? undefined,
        filename: activeDocument.filename,
        local_checksum: localChecksum.trim() || undefined,
        local_updated_at: localUpdatedAt || undefined,
      })
      setVersionCheckResult(result)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Versionscheck fehlgeschlagen')
    } finally {
      setCheckingVersion(false)
    }
  }

  if (loading && projects.length === 0) {
    return <div className={styles.center}>Lade Dokumente…</div>
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>Phase 14 · Sprint 91</p>
          <h1>Dokumentenmanagement</h1>
          <p className={styles.subtitle}>Projektweite Dokumente mit Versionierung, Archivständen und Sync-Prüfung in einer gemeinsamen Ansicht.</p>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.btnSecondary} onClick={() => navigate('/')}>Projektboard</button>
          <button className={styles.btnSecondary} onClick={() => navigate('/contacts')}>Kontakte</button>
        </div>
      </header>

      {error && <div className={styles.error}>{error}</div>}

      <section className={styles.controls}>
        <label className={styles.field}>
          <span>Projekt</span>
          <select value={selectedProjectId} onChange={(event) => void handleProjectChange(event.target.value)}>
            <option value="">Projekt auswählen…</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>{project.name}</option>
            ))}
          </select>
        </label>

        <label className={styles.field}>
          <span>Typfilter</span>
          <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as 'all' | DocumentType)}>
            <option value="all">Alle Typen</option>
            {Object.entries(TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>

        <label className={styles.field}>
          <span>Tagfilter</span>
          <input type="text" placeholder="z. B. quote" value={tagFilter} onChange={(event) => setTagFilter(event.target.value)} />
        </label>

        <label className={styles.field}>
          <span>Quelle</span>
          <select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value as 'all' | DocumentSourceKind)}>
            <option value="all">Alle Quellen</option>
            {Object.entries(SOURCE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>

        <label className={styles.field}>
          <span>Erstellt ab</span>
          <input type="date" value={createdFrom} onChange={(event) => setCreatedFrom(event.target.value)} />
        </label>

        <label className={styles.field}>
          <span>Erstellt bis</span>
          <input type="date" value={createdTo} onChange={(event) => setCreatedTo(event.target.value)} />
        </label>

        <label className={styles.field}>
          <span>Konflikte</span>
          <select value={includeConflicts ? 'show' : 'hide'} onChange={(event) => setIncludeConflicts(event.target.value === 'show')}>
            <option value="hide">Ausblenden</option>
            <option value="show">Einblenden</option>
          </select>
        </label>

        <label className={styles.field}>
          <span>Suche</span>
          <input type="search" placeholder="Dateiname oder Tag" value={search} onChange={(event) => setSearch(event.target.value)} />
        </label>

        <button className={styles.btnPrimary} onClick={() => void handleApplyFilters()} disabled={!selectedProjectId}>
          Filter anwenden
        </button>
      </section>

      <form className={styles.uploadPanel} onSubmit={handleUpload}>
        <div className={styles.uploadFields}>
          <label className={styles.field}>
            <span>Dokumenttyp</span>
            <select value={uploadType} onChange={(event) => setUploadType(event.target.value as DocumentType)}>
              {Object.entries(TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>

          <label className={styles.field}>
            <span>Tags</span>
            <input type="text" placeholder="quote, kunde, vertrag" value={uploadTags} onChange={(event) => setUploadTags(event.target.value)} />
          </label>

          <label className={styles.filePicker}>
            <span>Dateien</span>
            <input type="file" multiple onChange={(event) => setSelectedFiles(Array.from(event.target.files ?? []))} />
          </label>
        </div>

        <div className={styles.uploadSummary}>
          <span>{selectedFiles.length} Datei(en) ausgewählt</span>
          <button className={styles.btnPrimary} type="submit" disabled={!selectedProjectId || selectedFiles.length === 0 || uploading}>
            {uploading ? 'Lade hoch…' : 'Stapel-Upload starten'}
          </button>
        </div>
      </form>

      <section className={styles.workspace}>
        <div className={styles.listPanel}>
          <div className={styles.panelHeader}>
            <h2>Dokumente</h2>
            <span>{filteredDocuments.length}</span>
          </div>

          {filteredDocuments.length === 0 ? (
            <p className={styles.empty}>Für dieses Projekt wurden noch keine passenden Dokumente gefunden.</p>
          ) : (
            <div className={styles.documentList}>
              {filteredDocuments.map((document) => (
                <article
                  key={document.id}
                  className={`${styles.documentCard} ${activeDocument?.id === document.id ? styles.documentCardActive : ''}`}
                >
                  <button type="button" className={styles.documentSelect} onClick={() => setActiveDocumentId(document.id)}>
                    <strong>{document.filename}</strong>
                    <span>{TYPE_LABELS[document.type]}</span>
                    <span>v{document.version_no} · {SOURCE_LABELS[document.source_kind]}</span>
                    <span>{formatFileSize(document.size_bytes)} · {new Date(document.uploaded_at).toLocaleString('de-DE')}</span>
                    <div className={styles.tagRow}>
                      {document.tags.length === 0 ? <em>Keine Tags</em> : document.tags.map((tag) => <span key={tag}>{tag}</span>)}
                      {document.conflict_marker ? <span>Konflikt</span> : null}
                    </div>
                  </button>

                  <div className={styles.documentActions}>
                    <a className={styles.btnSecondary} href={document.download_url} target="_blank" rel="noreferrer">
                      Download
                    </a>
                    <button type="button" className={styles.btnDanger} onClick={() => void handleDelete(document.id)}>
                      Löschen
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        <div className={styles.previewPanel}>
          <div className={styles.panelHeader}>
            <h2>Vorschau</h2>
            {activeDocument ? <span>{activeDocument.filename} · v{activeDocument.version_no}</span> : <span>Keine Auswahl</span>}
          </div>

          {!activeDocument ? (
            <p className={styles.empty}>Wähle links ein Dokument aus, um eine Vorschau zu sehen.</p>
          ) : (
            <div>
              {buildPreviewUrl(activeDocument) ? (
                activeDocument.mime_type.startsWith('image/') ? (
                  <img className={styles.imagePreview} src={buildPreviewUrl(activeDocument)!} alt={activeDocument.filename} />
                ) : (
                  <iframe className={styles.previewFrame} title={activeDocument.filename} src={buildPreviewUrl(activeDocument)!} />
                )
              ) : (
                <div className={styles.previewFallback}>
                  <strong>Keine Inline-Vorschau verfügbar</strong>
                  <p>{activeDocument.mime_type}</p>
                  <a className={styles.btnPrimary} href={activeDocument.download_url} target="_blank" rel="noreferrer">
                    Datei öffnen
                  </a>
                </div>
              )}

              <div className={styles.previewFallback}>
                <strong>Versionierung & Sync</strong>
                <p>Quelle: {SOURCE_LABELS[activeDocument.source_kind]} · Version: v{activeDocument.version_no}</p>
                <div className={styles.documentActions}>
                  <button type="button" className={styles.btnSecondary} onClick={() => void handleArchiveVersion()} disabled={archiving}>
                    {archiving ? 'Archiviere…' : 'Version archivieren'}
                  </button>
                  <a className={styles.btnSecondary} href={activeDocument.download_url} target="_blank" rel="noreferrer">
                    Download
                  </a>
                </div>

                <div className={styles.uploadFields}>
                  <label className={styles.field}>
                    <span>Lokale Checksumme</span>
                    <input
                      type="text"
                      placeholder="optional"
                      value={localChecksum}
                      onChange={(event) => setLocalChecksum(event.target.value)}
                    />
                  </label>
                  <label className={styles.field}>
                    <span>Lokal geändert am</span>
                    <input
                      type="datetime-local"
                      value={localUpdatedAt}
                      onChange={(event) => setLocalUpdatedAt(event.target.value)}
                    />
                  </label>
                </div>

                <div className={styles.documentActions}>
                  <button type="button" className={styles.btnPrimary} onClick={() => void handleVersionCheck()} disabled={checkingVersion}>
                    {checkingVersion ? 'Prüfe…' : 'Sync prüfen'}
                  </button>
                </div>

                {versionCheckResult ? (
                  <p>
                    <strong>{VERSION_STATUS_LABELS[versionCheckResult.status]}:</strong> {versionCheckResult.hint}
                  </p>
                ) : null}
              </div>

              <div className={styles.previewFallback}>
                <strong>Versionshistorie</strong>
                {versionHistory.length === 0 ? (
                  <p>Keine Versionshistorie vorhanden.</p>
                ) : (
                  <div className={styles.documentList}>
                    {versionHistory.map((entry) => (
                      <button
                        key={entry.id}
                        type="button"
                        className={styles.documentSelect}
                        onClick={() => setActiveDocumentId(entry.id)}
                      >
                        <strong>v{entry.version_no} · {entry.filename}</strong>
                        <span>{new Date(entry.uploaded_at).toLocaleString('de-DE')}</span>
                        <span>{SOURCE_LABELS[entry.source_kind]}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
