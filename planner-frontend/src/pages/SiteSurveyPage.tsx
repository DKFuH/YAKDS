import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { checklistsApi, siteSurveysApi, type InstallationChecklist, type SiteSurvey } from '../api/siteSurveys.js'
import { projectsApi, type Project } from '../api/projects.js'
import { roomsApi, type MeasurementImportSegmentPayload, type RoomPayload } from '../api/rooms.js'
import { importRaumaufmass, listRaumaufmassJobs, validateRaumaufmass, type ImportJob, type RaumaufmassValidationResult } from '../api/imports.js'
import { getTenantPlugins } from '../api/tenantSettings.js'
import { importEgiToRoom, parseEgi, type EgiParseResult } from '../plugins/surveyImport/egi.js'
import { getMeasurementSegmentsFromMeasurements, getRoomsFromMeasurements } from '../plugins/surveyImport/index.js'
import styles from './SiteSurveyPage.module.css'

type Tab = 'surveys' | 'checklists'

function formatDate(value: string | null | undefined): string {
  if (!value) return '–'
  return new Date(value).toLocaleString('de-DE')
}

export function SiteSurveyPage() {
  const navigate = useNavigate()

  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [surveys, setSurveys] = useState<SiteSurvey[]>([])
  const [checklists, setChecklists] = useState<InstallationChecklist[]>([])
  const [selectedSurveyId, setSelectedSurveyId] = useState<string | null>(null)
  const [selectedChecklistId, setSelectedChecklistId] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('surveys')
  const [surveyImportEnabled, setSurveyImportEnabled] = useState(false)
  const [rooms, setRooms] = useState<RoomPayload[]>([])
  const [targetRoomId, setTargetRoomId] = useState('')
  const [includeReferencePhoto, setIncludeReferencePhoto] = useState(false)
  const [importBusy, setImportBusy] = useState(false)
  const [importStatus, setImportStatus] = useState<string | null>(null)
  const [raumaufmassFileName, setRaumaufmassFileName] = useState<string>('')
  const [raumaufmassPayload, setRaumaufmassPayload] = useState<unknown | null>(null)
  const [raumaufmassValidation, setRaumaufmassValidation] = useState<RaumaufmassValidationResult | null>(null)
  const [raumaufmassJobs, setRaumaufmassJobs] = useState<ImportJob[]>([])
  const [raumaufmassBusy, setRaumaufmassBusy] = useState(false)
  const [raumaufmassImportBusy, setRaumaufmassImportBusy] = useState(false)
  const [raumaufmassStatus, setRaumaufmassStatus] = useState<string | null>(null)
  const [egiFileName, setEgiFileName] = useState('')
  const [egiContent, setEgiContent] = useState<string | null>(null)
  const [egiValidation, setEgiValidation] = useState<EgiParseResult | null>(null)
  const [egiBusy, setEgiBusy] = useState(false)
  const [egiImportBusy, setEgiImportBusy] = useState(false)
  const [egiStatus, setEgiStatus] = useState<string | null>(null)
  const [createdBy, setCreatedBy] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    projectsApi.list().then(setProjects).catch(() => {})
    getTenantPlugins()
      .then((result) => {
        setSurveyImportEnabled(result.enabled.includes('survey-import'))
      })
      .catch(() => {
        setSurveyImportEnabled(false)
      })
  }, [])

  useEffect(() => {
    if (!surveyImportEnabled || !selectedProjectId) {
      setRooms([])
      setTargetRoomId('')
      return
    }

    roomsApi.list(selectedProjectId)
      .then((projectRooms) => {
        setRooms(projectRooms)
        setTargetRoomId((previous) => {
          if (previous && projectRooms.some((room) => room.id === previous)) {
            return previous
          }
          return projectRooms[0]?.id ?? ''
        })
      })
      .catch(() => {
        setRooms([])
        setTargetRoomId('')
      })
  }, [selectedProjectId, surveyImportEnabled])

  useEffect(() => {
    if (!surveyImportEnabled || !selectedProjectId) {
      setRaumaufmassJobs([])
      return
    }

    listRaumaufmassJobs(selectedProjectId)
      .then(setRaumaufmassJobs)
      .catch(() => setRaumaufmassJobs([]))
  }, [selectedProjectId, surveyImportEnabled])

  useEffect(() => {
    if (!selectedProjectId) {
      setSurveys([])
      setChecklists([])
      setSelectedSurveyId(null)
      setSelectedChecklistId(null)
      return
    }

    setBusy(true)
    setError(null)

    Promise.all([
      siteSurveysApi.list(selectedProjectId),
      checklistsApi.list(selectedProjectId),
    ])
      .then(([surveyData, checklistData]) => {
        setSurveys(surveyData)
        setChecklists(checklistData)
        setSelectedSurveyId(surveyData[0]?.id ?? null)
        setSelectedChecklistId(checklistData[0]?.id ?? null)
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setBusy(false))
  }, [selectedProjectId])

  const selectedSurvey = useMemo(
    () => surveys.find((survey) => survey.id === selectedSurveyId) ?? null,
    [surveys, selectedSurveyId],
  )

  const selectedChecklist = useMemo(
    () => checklists.find((checklist) => checklist.id === selectedChecklistId) ?? null,
    [checklists, selectedChecklistId],
  )

  const measurementSegments = useMemo(
    () => (selectedSurvey ? getMeasurementSegmentsFromMeasurements(selectedSurvey.measurements) : []),
    [selectedSurvey],
  )

  const firstPhotoUrl = useMemo(
    () => selectedSurvey?.photos.find((photo) => typeof photo.url === 'string' && photo.url.length > 0)?.url ?? null,
    [selectedSurvey],
  )

  const checklistDoneCount = selectedChecklist?.items.filter((item) => item.checked).length ?? 0
  const checklistTotalCount = selectedChecklist?.items.length ?? 0

  async function handleCreateSurvey(event: FormEvent) {
    event.preventDefault()
    if (!selectedProjectId || !createdBy.trim()) return

    setBusy(true)
    setError(null)

    try {
      const created = await siteSurveysApi.create(selectedProjectId, {
        created_by: createdBy.trim(),
        notes: notes.trim() || null,
      })
      setSurveys((prev) => [created, ...prev])
      setSelectedSurveyId(created.id)
      setCreatedBy('')
      setNotes('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler beim Anlegen')
    } finally {
      setBusy(false)
    }
  }

  async function handleChecklistItemToggle(checklistId: string, itemId: string, checked: boolean) {
    try {
      const updated = await checklistsApi.updateItem(checklistId, itemId, { checked })
      setChecklists((prev) => prev.map((checklist) => (
        checklist.id === checklistId
          ? {
              ...checklist,
              items: checklist.items.map((item) => (item.id === itemId ? { ...item, checked: updated.checked } : item)),
            }
          : checklist
      )))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler beim Aktualisieren')
    }
  }

  async function handleChecklistItemNote(checklistId: string, itemId: string, noteValue: string) {
    try {
      const updated = await checklistsApi.updateItem(checklistId, itemId, { note: noteValue })
      setChecklists((prev) => prev.map((checklist) => (
        checklist.id === checklistId
          ? {
              ...checklist,
              items: checklist.items.map((item) => (item.id === itemId ? { ...item, note: updated.note } : item)),
            }
          : checklist
      )))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler beim Aktualisieren')
    }
  }

  async function handleMeasurementImport() {
    if (!selectedSurvey || !targetRoomId) {
      return
    }

    if (measurementSegments.length === 0) {
      setError('Keine verwertbaren Messsegmente im Aufmaß gefunden.')
      return
    }

    setImportBusy(true)
    setImportStatus(null)
    setError(null)

    try {
      const payload: {
        segments: MeasurementImportSegmentPayload[]
        reference_image?: {
          url: string
          x: number
          y: number
          rotation: number
          scale: number
          opacity: number
        }
      } = {
        segments: measurementSegments,
      }

      if (includeReferencePhoto && firstPhotoUrl) {
        payload.reference_image = {
          url: firstPhotoUrl,
          x: 50,
          y: 50,
          rotation: 0,
          scale: 1,
          opacity: 0.55,
        }
      }

      const response = await roomsApi.measurementImport(targetRoomId, payload)
      setImportStatus(`${response.imported_segments} Segmente in den Raum importiert.`)
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : 'Import fehlgeschlagen')
    } finally {
      setImportBusy(false)
    }
  }

  async function handleRaumaufmassFileSelect(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    setError(null)
    setRaumaufmassStatus(null)
    setRaumaufmassValidation(null)

    try {
      const text = await file.text()
      const parsed = JSON.parse(text) as unknown
      setRaumaufmassPayload(parsed)
      setRaumaufmassFileName(file.name)
    } catch {
      setRaumaufmassPayload(null)
      setRaumaufmassFileName(file.name)
      setError('Die Datei enthält kein gültiges JSON.')
    }
  }

  async function handleValidateRaumaufmass() {
    if (!selectedProjectId || !raumaufmassPayload) {
      return
    }

    setRaumaufmassBusy(true)
    setError(null)
    setRaumaufmassStatus(null)
    try {
      const result = await validateRaumaufmass(selectedProjectId, raumaufmassPayload, raumaufmassFileName || undefined)
      setRaumaufmassValidation(result)
      if (result.valid) {
        setRaumaufmassStatus('Validierung erfolgreich. Daten können importiert werden.')
      }
    } catch (validationError) {
      setError(validationError instanceof Error ? validationError.message : 'Validierung fehlgeschlagen')
    } finally {
      setRaumaufmassBusy(false)
    }
  }

  async function handleImportRaumaufmass() {
    if (!selectedProjectId || !raumaufmassPayload) {
      return
    }

    setRaumaufmassImportBusy(true)
    setError(null)
    setRaumaufmassStatus(null)

    try {
      const result = await importRaumaufmass(selectedProjectId, raumaufmassPayload, raumaufmassFileName || undefined)
      setRaumaufmassStatus(`${result.imported_rooms} Raum/Räume erfolgreich importiert.`)
      const [projectRooms, jobs] = await Promise.all([
        roomsApi.list(selectedProjectId).catch(() => rooms),
        listRaumaufmassJobs(selectedProjectId).catch(() => raumaufmassJobs),
      ])
      setRooms(projectRooms)
      setRaumaufmassJobs(jobs)
      setRaumaufmassValidation(null)
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : 'Raumaufmaß-Import fehlgeschlagen')
    } finally {
      setRaumaufmassImportBusy(false)
    }
  }

  async function handleEgiFileSelect(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    setError(null)
    setEgiStatus(null)
    setEgiValidation(null)
    setEgiFileName(file.name)

    try {
      const text = await file.text()
      setEgiContent(text)
    } catch {
      setEgiContent(null)
      setError('Die EGI-Datei konnte nicht gelesen werden.')
    }
  }

  async function handleParseEgi() {
    if (!egiContent) {
      return
    }

    setEgiBusy(true)
    setError(null)
    setEgiStatus(null)

    try {
      const parsed = await parseEgi(egiContent, egiFileName || undefined)
      setEgiValidation(parsed)
      setEgiStatus('EGI-Datei erfolgreich analysiert.')
    } catch (parseError) {
      setError(parseError instanceof Error ? parseError.message : 'EGI-Analyse fehlgeschlagen')
    } finally {
      setEgiBusy(false)
    }
  }

  async function handleImportEgi() {
    if (!egiContent || !targetRoomId) {
      return
    }

    setEgiImportBusy(true)
    setError(null)
    setEgiStatus(null)

    try {
      const imported = await importEgiToRoom(targetRoomId, egiContent, egiFileName || undefined)
      setEgiStatus(
        [
          `EGI importiert: ${imported.imported.walls} Wände, ${imported.imported.openings} Öffnungen, ${imported.imported.placements} Objekte.`,
          `Import-Job: ${imported.job_id}`,
        ].join(' '),
      )
      setEgiValidation(imported)
      const projectRooms = await roomsApi.list(selectedProjectId).catch(() => rooms)
      setRooms(projectRooms)
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : 'EGI-Import fehlgeschlagen')
    } finally {
      setEgiImportBusy(false)
    }
  }

  const surveyRooms = selectedSurvey ? getRoomsFromMeasurements(selectedSurvey.measurements) : []

  return (
    <div className={styles.shell}>
      <div className={styles.header}>
        <button type="button" className={styles.backBtn} onClick={() => navigate('/')}>← Projekte</button>
        <h1 className={styles.title}>Mobile Aufmaße & Baustellenprotokoll</h1>
      </div>

      <div className={styles.layout}>
        <aside className={styles.sidebar}>
          <label className={styles.label} htmlFor="site-survey-project-select">Projekt</label>
          <select
            id="site-survey-project-select"
            className={styles.select}
            value={selectedProjectId}
            onChange={(event) => setSelectedProjectId(event.target.value)}
          >
            <option value="">Projekt auswählen …</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>{project.name}</option>
            ))}
          </select>

          <div className={styles.tabs}>
            <button
              type="button"
              className={`${styles.tabBtn} ${tab === 'surveys' ? styles.tabBtnActive : ''}`}
              onClick={() => setTab('surveys')}
            >
              Aufmaße
            </button>
            <button
              type="button"
              className={`${styles.tabBtn} ${tab === 'checklists' ? styles.tabBtnActive : ''}`}
              onClick={() => setTab('checklists')}
            >
              Checklisten
            </button>
          </div>

          {tab === 'surveys' && (
            <div className={styles.list}>
              {surveys.map((survey) => (
                <button
                  key={survey.id}
                  type="button"
                  className={`${styles.listItem} ${selectedSurveyId === survey.id ? styles.listItemActive : ''}`}
                  onClick={() => setSelectedSurveyId(survey.id)}
                >
                  <span>{survey.created_by}</span>
                  <small>{formatDate(survey.created_at)}</small>
                </button>
              ))}
              {!busy && surveys.length === 0 && selectedProjectId && <p className={styles.hint}>Keine Aufmaße vorhanden.</p>}
            </div>
          )}

          {tab === 'checklists' && (
            <div className={styles.list}>
              {checklists.map((checklist) => (
                <button
                  key={checklist.id}
                  type="button"
                  className={`${styles.listItem} ${selectedChecklistId === checklist.id ? styles.listItemActive : ''}`}
                  onClick={() => setSelectedChecklistId(checklist.id)}
                >
                  <span>{checklist.title}</span>
                  <small>{checklist.items.filter((item) => item.checked).length}/{checklist.items.length} erledigt</small>
                </button>
              ))}
              {!busy && checklists.length === 0 && selectedProjectId && <p className={styles.hint}>Keine Checklisten vorhanden.</p>}
            </div>
          )}
        </aside>

        <main className={styles.content}>
          {error && <div className={styles.error}>{error}</div>}
          {busy && <p className={styles.hint}>Laden …</p>}

          {!selectedProjectId && <p className={styles.hint}>Bitte Projekt auswählen.</p>}

          {selectedProjectId && tab === 'surveys' && (
            <>
              <section className={styles.card}>
                <h2>Neues Aufmaß</h2>
                <form className={styles.form} onSubmit={handleCreateSurvey}>
                  <input
                    className={styles.input}
                    placeholder="Erfasst von"
                    value={createdBy}
                    onChange={(event) => setCreatedBy(event.target.value)}
                  />
                  <textarea
                    className={styles.textarea}
                    placeholder="Notizen"
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                  />
                  <button type="submit" className={styles.primaryBtn} disabled={busy || !createdBy.trim()}>Aufmaß anlegen</button>
                </form>
              </section>

              <section className={styles.card}>
                <h2>Detailansicht</h2>
                {!selectedSurvey && <p className={styles.hint}>Aufmaß auswählen.</p>}
                {selectedSurvey && (
                  <>
                    <p className={styles.meta}>Erfasst von: {selectedSurvey.created_by} · {formatDate(selectedSurvey.created_at)}</p>

                    <h3>Messungen</h3>
                    {surveyRooms.length > 0 ? (
                      <table className={styles.table}>
                        <thead>
                          <tr>
                            <th>Raum</th>
                            <th>Breite (mm)</th>
                            <th>Tiefe (mm)</th>
                            <th>Höhe (mm)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {surveyRooms.map((room, index) => (
                            <tr key={`${room.name}-${index}`}>
                              <td>{room.name}</td>
                              <td>{room.width_mm}</td>
                              <td>{room.depth_mm}</td>
                              <td>{room.height_mm ?? '–'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <pre className={styles.jsonBlock}>{JSON.stringify(selectedSurvey.measurements, null, 2)}</pre>
                    )}

                    {surveyImportEnabled && (
                      <>
                        <h3>Aufmaß-Import</h3>
                        <div className={styles.form}>
                          <label className={styles.label}>Zielraum</label>
                          <select
                            className={styles.select}
                            aria-label="Zielraum für Aufmaß-Import"
                            value={targetRoomId}
                            onChange={(event) => setTargetRoomId(event.target.value)}
                          >
                            {rooms.length === 0 && <option value="">Kein Raum verfügbar</option>}
                            {rooms.map((room) => (
                              <option key={room.id} value={room.id}>{room.name}</option>
                            ))}
                          </select>

                          <label className={styles.checkLabel}>
                            <input
                              type="checkbox"
                              checked={includeReferencePhoto}
                              disabled={!firstPhotoUrl}
                              onChange={(event) => setIncludeReferencePhoto(event.target.checked)}
                            />
                            <span>Erstes Foto als Referenzbild übernehmen</span>
                          </label>

                          <p className={styles.hint}>Importierbare Segmente: {measurementSegments.length}</p>

                          <button
                            type="button"
                            className={styles.primaryBtn}
                            disabled={importBusy || !targetRoomId || measurementSegments.length === 0}
                            onClick={() => { void handleMeasurementImport() }}
                          >
                            {importBusy ? 'Importiere …' : 'In Raum importieren'}
                          </button>

                          {importStatus && <p className={styles.success}>{importStatus}</p>}
                        </div>
                      </>
                    )}

                    {surveyImportEnabled && (
                      <>
                        <h3>Raumaufmaß JSON-Import</h3>
                        <div className={styles.form}>
                          <label className={styles.label} htmlFor="raumaufmass-json-file">JSON-Datei</label>
                          <input
                            id="raumaufmass-json-file"
                            type="file"
                            accept="application/json,.json"
                            className={styles.input}
                            onChange={(event) => { void handleRaumaufmassFileSelect(event) }}
                          />
                          <p className={styles.hint}>{raumaufmassFileName ? `Datei: ${raumaufmassFileName}` : 'Keine Datei ausgewählt.'}</p>

                          <div className={styles.actionRow}>
                            <button
                              type="button"
                              className={styles.primaryBtn}
                              disabled={raumaufmassBusy || !raumaufmassPayload}
                              onClick={() => { void handleValidateRaumaufmass() }}
                            >
                              {raumaufmassBusy ? 'Validiere …' : 'JSON prüfen'}
                            </button>
                            <button
                              type="button"
                              className={styles.primaryBtn}
                              disabled={raumaufmassImportBusy || !raumaufmassPayload || !raumaufmassValidation?.valid}
                              onClick={() => { void handleImportRaumaufmass() }}
                            >
                              {raumaufmassImportBusy ? 'Importiere …' : 'JSON importieren'}
                            </button>
                          </div>

                          {raumaufmassStatus && <p className={styles.success}>{raumaufmassStatus}</p>}

                          {raumaufmassValidation && (
                            <div className={styles.validationBlock}>
                              <p className={styles.meta}>
                                Valid: {raumaufmassValidation.valid ? 'Ja' : 'Nein'} · Räume: {raumaufmassValidation.preview.summary.room_count} · Öffnungen: {raumaufmassValidation.preview.summary.opening_count}
                              </p>
                              <p className={styles.meta}>
                                Warnungen: {raumaufmassValidation.preview.summary.warning_count} · Fehler: {raumaufmassValidation.preview.summary.error_count}
                              </p>

                              {raumaufmassValidation.preview.rooms.length > 0 && (
                                <table className={styles.table}>
                                  <thead>
                                    <tr>
                                      <th>Raum</th>
                                      <th>Höhe</th>
                                      <th>Ecken</th>
                                      <th>Wände</th>
                                      <th>Öffnungen</th>
                                      <th>Warnungen</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {raumaufmassValidation.preview.rooms.map((room) => (
                                      <tr key={`${room.index}-${room.name}`}>
                                        <td>{room.name}</td>
                                        <td>{room.height_mm}</td>
                                        <td>{room.boundary_vertices}</td>
                                        <td>{room.wall_segments}</td>
                                        <td>{room.openings_count}</td>
                                        <td>{room.warning_count}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              )}

                              {raumaufmassValidation.diagnostics.warnings.length > 0 && (
                                <div className={styles.warningList}>
                                  <strong>Warnungen</strong>
                                  <ul>
                                    {raumaufmassValidation.diagnostics.warnings.map((warning, index) => (
                                      <li key={`${warning.code}-${index}`}>
                                        {warning.path}: {warning.message}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {raumaufmassValidation.diagnostics.errors.length > 0 && (
                                <div className={styles.errorList}>
                                  <strong>Fehler</strong>
                                  <ul>
                                    {raumaufmassValidation.diagnostics.errors.map((diagError, index) => (
                                      <li key={`${diagError.code}-${index}`}>
                                        {diagError.path}: {diagError.message}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          )}

                          <div className={styles.jobList}>
                            <strong>Importdiagnostik (Jobs)</strong>
                            {raumaufmassJobs.length === 0 && <p className={styles.hint}>Noch keine Raumaufmaß-Jobs.</p>}
                            {raumaufmassJobs.map((job) => (
                              <div key={job.id} className={styles.jobItem}>
                                <span>{job.source_filename}</span>
                                <small>{job.status} · {formatDate(job.created_at)}</small>
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    )}

                    {surveyImportEnabled && (
                      <>
                        <h3>POS-Aufmaßservice (.egi)</h3>
                        <div className={styles.form}>
                          <label className={styles.label} htmlFor="egi-file-input">EGI-Datei</label>
                          <input
                            id="egi-file-input"
                            type="file"
                            accept=".egi,text/plain"
                            className={styles.input}
                            onChange={(event) => { void handleEgiFileSelect(event) }}
                          />
                          <p className={styles.hint}>{egiFileName ? `Datei: ${egiFileName}` : 'Keine Datei ausgewählt.'}</p>

                          <div className={styles.actionRow}>
                            <button
                              type="button"
                              className={styles.primaryBtn}
                              disabled={egiBusy || !egiContent}
                              onClick={() => { void handleParseEgi() }}
                            >
                              {egiBusy ? 'Analysiere …' : 'EGI prüfen'}
                            </button>
                            <button
                              type="button"
                              className={styles.primaryBtn}
                              disabled={egiImportBusy || !egiContent || !targetRoomId}
                              onClick={() => { void handleImportEgi() }}
                            >
                              {egiImportBusy ? 'Importiere …' : 'In Zielraum importieren'}
                            </button>
                          </div>

                          {egiStatus && <p className={styles.success}>{egiStatus}</p>}

                          {egiValidation && (
                            <div className={styles.validationBlock}>
                              <p className={styles.meta}>
                                Wände: {egiValidation.summary.walls} · Dächer: {egiValidation.summary.roofs} · Fenster: {egiValidation.summary.windows} · Türen: {egiValidation.summary.doors}
                              </p>
                              <p className={styles.meta}>
                                Hindernisse: {egiValidation.summary.hindrances} · Installationen: {egiValidation.summary.installations} · Raumhöhe: {egiValidation.preview.room_height_mm} mm
                              </p>

                              {egiValidation.warnings.length > 0 && (
                                <div className={styles.warningList}>
                                  <strong>Warnungen</strong>
                                  <ul>
                                    {egiValidation.warnings.map((warning, index) => (
                                      <li key={`${warning}-${index}`}>{warning}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </>
                    )}

                    <h3>Fotos</h3>
                    <div className={styles.photoGrid}>
                      {selectedSurvey.photos.length === 0 && <p className={styles.hint}>Keine Fotos.</p>}
                      {selectedSurvey.photos.map((photo, index) => (
                        <div key={`${photo.url}-${index}`} className={styles.photoCard}>
                          <img src={photo.url} alt={photo.caption ?? 'Foto'} className={styles.photo} />
                          <small>{photo.caption ?? 'Ohne Beschriftung'}</small>
                        </div>
                      ))}
                    </div>

                    <h3>Notizen</h3>
                    <p>{selectedSurvey.notes ?? '–'}</p>
                  </>
                )}
              </section>
            </>
          )}

          {selectedProjectId && tab === 'checklists' && (
            <section className={styles.card}>
              <h2>Checklisten-Tab</h2>
              {!selectedChecklist && <p className={styles.hint}>Checkliste auswählen.</p>}
              {selectedChecklist && (
                <>
                  <p className={styles.meta}>
                    Fortschritt: {checklistDoneCount}/{checklistTotalCount} erledigt
                  </p>
                  <div className={styles.checklistItems}>
                    {selectedChecklist.items.map((item) => (
                      <div key={item.id} className={styles.checklistItem}>
                        <label className={styles.checkLabel}>
                          <input
                            type="checkbox"
                            checked={item.checked}
                            onChange={(event) => {
                              void handleChecklistItemToggle(selectedChecklist.id, item.id, event.target.checked)
                            }}
                          />
                          <span>{item.label}</span>
                        </label>
                        <input
                          className={styles.input}
                          placeholder="Notiz"
                          onBlur={(event) => {
                            if ((item.note ?? '') !== event.target.value) {
                              void handleChecklistItemNote(selectedChecklist.id, item.id, event.target.value)
                            }
                          }}
                          defaultValue={item.note ?? ''}
                        />
                      </div>
                    ))}
                  </div>
                </>
              )}
            </section>
          )}
        </main>
      </div>
    </div>
  )
}
