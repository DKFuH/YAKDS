import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Badge,
  Body1,
  Button,
  Caption1,
  Field,
  Input,
  MessageBar,
  MessageBarBody,
  Option,
  Select,
  Spinner,
  Subtitle2,
  Switch,
  Title2,
  makeStyles,
  tokens,
} from '@fluentui/react-components'
import {
  documentsApi,
  type DocumentSourceKind,
  type DocumentType,
  type DocumentVersionCheckResult,
  type ProjectDocument,
} from '../api/documents.js'
import { projectsApi, type Project } from '../api/projects.js'

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
  if (sizeBytes < 1024) return sizeBytes + ' B'
  if (sizeBytes < 1024 * 1024) return (sizeBytes / 1024).toFixed(1) + ' KB'
  return (sizeBytes / (1024 * 1024)).toFixed(1) + ' MB'
}

function buildPreviewUrl(document: ProjectDocument): string | null {
  if (document.preview_url) return document.preview_url
  if (document.mime_type.startsWith('image/') || document.mime_type === 'application/pdf') {
    return document.download_url
  }
  return null
}

const useStyles = makeStyles({
  page: { display: 'grid', rowGap: tokens.spacingVerticalXL },
  pageHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: tokens.spacingHorizontalM,
  },
  controls: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: tokens.spacingHorizontalM,
    alignItems: 'flex-end',
  },
  filterField: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
    minWidth: '140px',
  },
  uploadPanel: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
    padding: tokens.spacingVerticalM,
    backgroundColor: tokens.colorNeutralBackground2,
    borderRadius: tokens.borderRadiusLarge,
  },
  uploadFields: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: tokens.spacingHorizontalM,
    alignItems: 'flex-end',
  },
  workspace: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: tokens.spacingHorizontalL,
    '@media (max-width: 800px)': { gridTemplateColumns: '1fr' },
  },
  panel: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
  },
  panelHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  documentList: { display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalXS },
  documentCard: {
    borderRadius: tokens.borderRadiusMedium,
    border: `1px solid ${tokens.colorNeutralStroke1}`,
    overflow: 'hidden',
    cursor: 'pointer',
    '&:hover': { border: `1px solid ${tokens.colorBrandStroke1}` },
  },
  documentCardActive: { border: `1px solid ${tokens.colorBrandStroke1}`, backgroundColor: tokens.colorBrandBackground2 },
  documentCardContent: { padding: tokens.spacingVerticalS + ' ' + tokens.spacingHorizontalM },
  documentActions: { display: 'flex', gap: tokens.spacingHorizontalS, flexWrap: 'wrap', marginTop: tokens.spacingVerticalXS },
  tagRow: { display: 'flex', flexWrap: 'wrap', gap: tokens.spacingHorizontalXS },
  previewSection: { display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalM },
  imagePreview: { maxWidth: '100%', borderRadius: tokens.borderRadiusMedium },
  previewFrame: {
    width: '100%',
    height: '400px',
    border: 'none',
    borderRadius: tokens.borderRadiusMedium,
  },
  previewFallback: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
    padding: tokens.spacingVerticalM,
    backgroundColor: tokens.colorNeutralBackground2,
    borderRadius: tokens.borderRadiusMedium,
  },
  versionRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
    cursor: 'pointer',
    padding: tokens.spacingVerticalXS,
    borderRadius: tokens.borderRadiusMedium,
    '&:hover': { backgroundColor: tokens.colorNeutralBackground2 },
  },
  empty: { color: tokens.colorNeutralForeground3, fontStyle: 'italic' },
})

export function DocumentsPage() {
  const styles = useStyles()
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
      const activeProjects = projectList.filter((p) => p.status === 'active')
      setProjects(activeProjects)

      const preferredProjectId = projectIdFromQuery || selectedProjectId || activeProjects[0]?.id || ''
      if (!preferredProjectId) { setDocuments([]); setActiveDocumentId(null); return }

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
      setActiveDocumentId((cur) => cur ?? loadedDocuments[0]?.id ?? null)
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
      const loaded = await documentsApi.list(projectId, {
        type: nextType === 'all' ? undefined : nextType,
        tag: nextTag.trim() || undefined,
        source_kind: nextSource === 'all' ? undefined : nextSource,
        created_from: nextCreatedFrom || undefined,
        created_to: nextCreatedTo || undefined,
        include_conflicts: nextIncludeConflicts,
      })
      setDocuments(loaded)
      setActiveDocumentId((cur) => (loaded.some((d) => d.id === cur) ? cur : (loaded[0]?.id ?? null)))
      return loaded
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
    if (!query) return documents
    return documents.filter((d) => {
      const haystack = [d.filename, d.original_filename, d.type, ...d.tags].filter(Boolean).join(' ').toLowerCase()
      return haystack.includes(query)
    })
  }, [documents, search])

  const activeDocument = filteredDocuments.find((d) => d.id === activeDocumentId) ?? filteredDocuments[0] ?? null

  const versionHistory = useMemo(() => {
    if (!activeDocument) return []
    return documents
      .filter((d) => (
        activeDocument.source_id
          ? (d.source_kind === activeDocument.source_kind && d.source_id === activeDocument.source_id)
          : (d.filename === activeDocument.filename && d.source_id === null)
      ))
      .sort((a, b) => a.version_no !== b.version_no ? b.version_no - a.version_no : b.uploaded_at.localeCompare(a.uploaded_at))
  }, [activeDocument, documents])

  useEffect(() => { setVersionCheckResult(null) }, [activeDocumentId])

  async function handleProjectChange(nextProjectId: string) {
    setSelectedProjectId(nextProjectId)
    setSearchParams(nextProjectId ? { project: nextProjectId } : {})
    if (!nextProjectId) { setDocuments([]); setActiveDocumentId(null); return }
    await loadDocuments(nextProjectId, typeFilter, tagFilter)
  }

  async function handleApplyFilters() {
    if (!selectedProjectId) return
    await loadDocuments(selectedProjectId, typeFilter, tagFilter, sourceFilter, createdFrom, createdTo, includeConflicts)
  }

  async function handleUpload(event: React.FormEvent) {
    event.preventDefault()
    if (!selectedProjectId || selectedFiles.length === 0) return
    setUploading(true)
    setError(null)
    try {
      await documentsApi.uploadMany(selectedProjectId, selectedFiles, {
        type: uploadType,
        tags: uploadTags.split(',').map((t) => t.trim()).filter(Boolean),
      })
      setSelectedFiles([])
      setUploadTags('')
      await loadDocuments(selectedProjectId, typeFilter, tagFilter, sourceFilter, createdFrom, createdTo, includeConflicts)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Upload fehlgeschlagen')
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete(documentId: string) {
    if (!selectedProjectId || !window.confirm('Dokument wirklich löschen?')) return
    try {
      await documentsApi.remove(selectedProjectId, documentId)
      await loadDocuments(selectedProjectId, typeFilter, tagFilter, sourceFilter, createdFrom, createdTo, includeConflicts)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Dokument konnte nicht gelöscht werden')
    }
  }

  async function handleArchiveVersion() {
    if (!selectedProjectId || !activeDocument) return
    setArchiving(true)
    setError(null)
    try {
      const archived = await documentsApi.archiveVersion(selectedProjectId, activeDocument.id, {
        uploaded_by: 'planner-frontend',
        source_kind: activeDocument.source_kind,
        source_id: activeDocument.source_id,
      })
      await loadDocuments(selectedProjectId, typeFilter, tagFilter, sourceFilter, createdFrom, createdTo, includeConflicts)
      setActiveDocumentId(archived.id)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Version konnte nicht archiviert werden')
    } finally {
      setArchiving(false)
    }
  }

  async function handleVersionCheck() {
    if (!selectedProjectId || !activeDocument) return
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
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '64px' }}>
        <Spinner label="Lade Dokumente…" />
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <Title2>Dokumentenmanagement</Title2>
          <Body1 style={{ color: tokens.colorNeutralForeground3, display: 'block' }}>
            Projektweite Dokumente mit Versionierung, Archivständen und Sync-Prüfung.
          </Body1>
        </div>
      </div>

      {error && (
        <MessageBar intent="error"><MessageBarBody>{error}</MessageBarBody></MessageBar>
      )}

      <div className={styles.controls}>
        <div className={styles.filterField}>
          <Caption1>Projekt</Caption1>
          <Select value={selectedProjectId} onChange={(_e, d) => void handleProjectChange(d.value)}>
            <Option value="">Projekt auswählen…</Option>
            {projects.map((p) => <Option key={p.id} value={p.id}>{p.name}</Option>)}
          </Select>
        </div>
        <div className={styles.filterField}>
          <Caption1>Typ</Caption1>
          <Select value={typeFilter} onChange={(_e, d) => setTypeFilter(d.value as 'all' | DocumentType)}>
            <Option value="all">Alle Typen</Option>
            {Object.entries(TYPE_LABELS).map(([v, l]) => <Option key={v} value={v}>{l}</Option>)}
          </Select>
        </div>
        <div className={styles.filterField}>
          <Caption1>Tag</Caption1>
          <Input placeholder="z. B. quote" value={tagFilter} onChange={(_e, d) => setTagFilter(d.value)} />
        </div>
        <div className={styles.filterField}>
          <Caption1>Quelle</Caption1>
          <Select value={sourceFilter} onChange={(_e, d) => setSourceFilter(d.value as 'all' | DocumentSourceKind)}>
            <Option value="all">Alle Quellen</Option>
            {Object.entries(SOURCE_LABELS).map(([v, l]) => <Option key={v} value={v}>{l}</Option>)}
          </Select>
        </div>
        <div className={styles.filterField}>
          <Caption1>Von</Caption1>
          <input type="date" value={createdFrom} style={{ borderRadius: tokens.borderRadiusMedium, border: '1px solid ' + tokens.colorNeutralStroke1, padding: '6px', backgroundColor: tokens.colorNeutralBackground1, color: tokens.colorNeutralForeground1 }} onChange={(e) => setCreatedFrom(e.target.value)} />
        </div>
        <div className={styles.filterField}>
          <Caption1>Bis</Caption1>
          <input type="date" value={createdTo} style={{ borderRadius: tokens.borderRadiusMedium, border: '1px solid ' + tokens.colorNeutralStroke1, padding: '6px', backgroundColor: tokens.colorNeutralBackground1, color: tokens.colorNeutralForeground1 }} onChange={(e) => setCreatedTo(e.target.value)} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalS }}>
          <Switch
            checked={includeConflicts}
            onChange={(_e, d) => setIncludeConflicts(d.checked)}
            label="Konflikte"
          />
        </div>
        <div className={styles.filterField} style={{ flex: 1, minWidth: '180px' }}>
          <Caption1>Suche</Caption1>
          <Input type="search" placeholder="Dateiname oder Tag" value={search} onChange={(_e, d) => setSearch(d.value)} />
        </div>
        <Button appearance="primary" onClick={() => void handleApplyFilters()} disabled={!selectedProjectId}>
          Filter anwenden
        </Button>
      </div>

      <form className={styles.uploadPanel} onSubmit={handleUpload}>
        <Subtitle2>Upload</Subtitle2>
        <div className={styles.uploadFields}>
          <div className={styles.filterField}>
            <Caption1>Dokumenttyp</Caption1>
            <Select value={uploadType} onChange={(_e, d) => setUploadType(d.value as DocumentType)}>
              {Object.entries(TYPE_LABELS).map(([v, l]) => <Option key={v} value={v}>{l}</Option>)}
            </Select>
          </div>
          <Field label="Tags" style={{ minWidth: '160px' }}>
            <Input placeholder="quote, kunde, vertrag" value={uploadTags} onChange={(_e, d) => setUploadTags(d.value)} />
          </Field>
          <div>
            <Caption1>Dateien</Caption1>
            <input type="file" multiple style={{ display: 'block', marginTop: '4px' }} onChange={(e) => setSelectedFiles(Array.from(e.target.files ?? []))} />
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalM }}>
          <Caption1>{selectedFiles.length} Datei(en) ausgewählt</Caption1>
          <Button appearance="primary" type="submit" disabled={!selectedProjectId || selectedFiles.length === 0 || uploading}>
            {uploading ? <Spinner size="tiny" /> : 'Stapel-Upload starten'}
          </Button>
        </div>
      </form>

      <div className={styles.workspace}>
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <Subtitle2>Dokumente</Subtitle2>
            <Badge appearance="tint" shape="circular">{filteredDocuments.length}</Badge>
          </div>
          {filteredDocuments.length === 0 ? (
            <Caption1 className={styles.empty}>Für dieses Projekt wurden noch keine passenden Dokumente gefunden.</Caption1>
          ) : (
            <div className={styles.documentList}>
              {filteredDocuments.map((document) => (
                <div
                  key={document.id}
                  className={styles.documentCard + (activeDocument?.id === document.id ? ' ' + styles.documentCardActive : '')}
                  onClick={() => setActiveDocumentId(document.id)}
                >
                  <div className={styles.documentCardContent}>
                    <Body1 style={{ fontWeight: tokens.fontWeightSemibold, display: 'block' }}>{document.filename}</Body1>
                    <Caption1 style={{ color: tokens.colorNeutralForeground3, display: 'block' }}>
                      {TYPE_LABELS[document.type]} · v{document.version_no} · {SOURCE_LABELS[document.source_kind]}
                    </Caption1>
                    <Caption1 style={{ color: tokens.colorNeutralForeground3, display: 'block' }}>
                      {formatFileSize(document.size_bytes)} · {new Date(document.uploaded_at).toLocaleString('de-DE')}
                    </Caption1>
                    <div className={styles.tagRow}>
                      {document.tags.length === 0 ? (
                        <Caption1 style={{ fontStyle: 'italic' }}>Keine Tags</Caption1>
                      ) : (
                        document.tags.map((tag) => <Badge key={tag} appearance="tint" size="small">{tag}</Badge>)
                      )}
                      {document.conflict_marker && <Badge appearance="tint" color="warning" size="small">Konflikt</Badge>}
                    </div>
                    <div className={styles.documentActions}>
                      <Button as="a" appearance="secondary" size="small" href={document.download_url} target="_blank" rel="noreferrer">
                        Download
                      </Button>
                      <Button appearance="subtle" size="small" onClick={(e) => { e.stopPropagation(); void handleDelete(document.id) }}>
                        Löschen
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <Subtitle2>Vorschau</Subtitle2>
            {activeDocument ? (
              <Caption1>{activeDocument.filename} · v{activeDocument.version_no}</Caption1>
            ) : (
              <Caption1>Keine Auswahl</Caption1>
            )}
          </div>

          {!activeDocument ? (
            <Caption1 className={styles.empty}>Wähle links ein Dokument aus, um eine Vorschau zu sehen.</Caption1>
          ) : (
            <div className={styles.previewSection}>
              {buildPreviewUrl(activeDocument) ? (
                activeDocument.mime_type.startsWith('image/') ? (
                  <img className={styles.imagePreview} src={buildPreviewUrl(activeDocument)!} alt={activeDocument.filename} />
                ) : (
                  <iframe className={styles.previewFrame} title={activeDocument.filename} src={buildPreviewUrl(activeDocument)!} />
                )
              ) : (
                <div className={styles.previewFallback}>
                  <Body1 style={{ fontWeight: tokens.fontWeightSemibold }}>Keine Inline-Vorschau verfügbar</Body1>
                  <Caption1>{activeDocument.mime_type}</Caption1>
                  <Button as="a" appearance="primary" href={activeDocument.download_url} target="_blank" rel="noreferrer" style={{ alignSelf: 'flex-start' }}>
                    Datei öffnen
                  </Button>
                </div>
              )}

              <div className={styles.previewFallback}>
                <Body1 style={{ fontWeight: tokens.fontWeightSemibold }}>Versionierung & Sync</Body1>
                <Caption1>Quelle: {SOURCE_LABELS[activeDocument.source_kind]} · Version: v{activeDocument.version_no}</Caption1>
                <div className={styles.documentActions}>
                  <Button appearance="secondary" size="small" onClick={() => void handleArchiveVersion()} disabled={archiving}>
                    {archiving ? <Spinner size="tiny" /> : 'Version archivieren'}
                  </Button>
                  <Button as="a" appearance="secondary" size="small" href={activeDocument.download_url} target="_blank" rel="noreferrer">
                    Download
                  </Button>
                </div>

                <Field label="Lokale Checksumme">
                  <Input placeholder="optional" value={localChecksum} onChange={(_e, d) => setLocalChecksum(d.value)} />
                </Field>
                <Field label="Lokal geändert am">
                  <input
                    type="datetime-local"
                    value={localUpdatedAt}
                    style={{ borderRadius: tokens.borderRadiusMedium, border: '1px solid ' + tokens.colorNeutralStroke1, padding: '6px', backgroundColor: tokens.colorNeutralBackground1, color: tokens.colorNeutralForeground1, width: '100%' }}
                    onChange={(e) => setLocalUpdatedAt(e.target.value)}
                  />
                </Field>

                <Button appearance="primary" size="small" onClick={() => void handleVersionCheck()} disabled={checkingVersion} style={{ alignSelf: 'flex-start' }}>
                  {checkingVersion ? <Spinner size="tiny" /> : 'Sync prüfen'}
                </Button>

                {versionCheckResult && (
                  <Caption1>
                    <strong>{VERSION_STATUS_LABELS[versionCheckResult.status]}:</strong> {versionCheckResult.hint}
                  </Caption1>
                )}
              </div>

              <div className={styles.previewFallback}>
                <Body1 style={{ fontWeight: tokens.fontWeightSemibold }}>Versionshistorie</Body1>
                {versionHistory.length === 0 ? (
                  <Caption1 className={styles.empty}>Keine Versionshistorie vorhanden.</Caption1>
                ) : (
                  <div className={styles.documentList}>
                    {versionHistory.map((entry) => (
                      <div key={entry.id} className={styles.versionRow} onClick={() => setActiveDocumentId(entry.id)}>
                        <Body1 style={{ fontWeight: tokens.fontWeightSemibold }}>v{entry.version_no} · {entry.filename}</Body1>
                        <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>
                          {new Date(entry.uploaded_at).toLocaleString('de-DE')} · {SOURCE_LABELS[entry.source_kind]}
                        </Caption1>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
