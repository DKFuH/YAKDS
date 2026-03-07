import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import {
  Badge,
  Body1,
  Body1Strong,
  Button,
  Caption1,
  Card,
  CardHeader,
  Checkbox,
  Field,
  Input,
  MessageBar,
  MessageBarBody,
  Option,
  Select,
  Spinner,
  Tab,
  TabList,
  Textarea,
  Title2,
  makeStyles,
  tokens,
} from '@fluentui/react-components'
import { checklistsApi, siteSurveysApi, type InstallationChecklist, type SiteSurvey } from '../api/siteSurveys.js'
import { projectsApi, type Project } from '../api/projects.js'
import { roomsApi, type MeasurementImportSegmentPayload, type RoomPayload } from '../api/rooms.js'
import { importRaumaufmass, listRaumaufmassJobs, validateRaumaufmass, type ImportJob, type RaumaufmassValidationResult } from '../api/imports.js'
import { getTenantPlugins } from '../api/tenantSettings.js'
import { importEgiToRoom, parseEgi, type EgiParseResult } from '../plugins/surveyImport/egi.js'
import { getMeasurementSegmentsFromMeasurements, getRoomsFromMeasurements } from '../plugins/surveyImport/index.js'

type Tab = 'surveys' | 'checklists'

function formatDate(value: string | null | undefined): string {
  if (!value) return '–'
  return new Date(value).toLocaleString('de-DE')
}

const useStyles = makeStyles({
  shell: { display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalM },
  layout: {
    display: 'grid',
    gridTemplateColumns: '260px 1fr',
    gap: tokens.spacingHorizontalM,
    alignItems: 'start',
    '@media (max-width: 768px)': { gridTemplateColumns: '1fr' },
  },
  sidebar: { display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalXS },
  list: { display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalXXS },
  listItem: {
    display: 'flex', flexDirection: 'column', gap: 0,
    padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalS}`,
    borderRadius: tokens.borderRadiusMedium,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    background: 'transparent', cursor: 'pointer', textAlign: 'left', width: '100%',
    fontSize: tokens.fontSizeBase300,
  },
  listItemActive: { background: tokens.colorBrandBackground2, border: `1px solid ${tokens.colorBrandStroke1}` },
  actionRow: { display: 'flex', gap: tokens.spacingHorizontalS, flexWrap: 'wrap', alignItems: 'center' },
  photoGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
    gap: tokens.spacingHorizontalS,
  },
  photoCard: { display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalXXS },
  photo: { width: '100%', height: '90px', objectFit: 'cover', borderRadius: tokens.borderRadiusSmall },
  tableWrap: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: tokens.fontSizeBase300 },
  th: {
    textAlign: 'left',
    padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalS}`,
    borderBottom: `2px solid ${tokens.colorNeutralStroke1}`,
    fontWeight: tokens.fontWeightSemibold,
  },
  td: { padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalS}`, borderBottom: `1px solid ${tokens.colorNeutralStroke2}` },
  jsonBlock: {
    background: tokens.colorNeutralBackground3,
    borderRadius: tokens.borderRadiusMedium,
    padding: tokens.spacingHorizontalM,
    fontSize: tokens.fontSizeBase200,
    fontFamily: 'monospace',
    overflowX: 'auto',
    maxHeight: '200px',
  },
  validationBlock: {
    background: tokens.colorNeutralBackground2,
    borderRadius: tokens.borderRadiusMedium,
    padding: tokens.spacingHorizontalM,
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
  },
  jobList: { display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalXXS },
  jobItem: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: `${tokens.spacingVerticalXXS} ${tokens.spacingHorizontalS}`,
    background: tokens.colorNeutralBackground2, borderRadius: tokens.borderRadiusSmall,
    fontSize: tokens.fontSizeBase200,
  },
  checklistItems: { display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalS },
  checklistItem: { display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalXXS },
  fileInput: {
    padding: `${tokens.spacingVerticalXS} 0`,
    fontSize: tokens.fontSizeBase300,
  },
})

export function SiteSurveyPage() {
  const styles = useStyles()
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
  const [raumaufmassFileName, setRaumaufmassFileName] = useState('')
  const [raumaufmassPayload, setRaumaufmassPayload] = useState<unknown | null>(null)
  const [raumaufmassValidation, setRaumaufmassValidation] = useState<RaumaufmassValidationResult | null>(null)
  const [raumaufmassJobs, setRaumaufmassJobs] = useState<ImportJob[]>([])
  const [raumaufmassBusy, setRaumaufmassBusy] = useState(false)
  const [raumaufmassImportBusy, setRaumaufmassImportBusy] = useState(false)
  const [raumaufmassStatus, setRaumaufmassStatus] = useState<string | null>(null)
  const [egiFileName, setEgiFileName] = useState('')
  const [egiContent, setEgiContent] = useState<string | null>(null)
  const [, setEgiValidation] = useState<EgiParseResult | null>(null)
  const [egiBusy, setEgiBusy] = useState(false)
  const [egiImportBusy, setEgiImportBusy] = useState(false)
  const [egiStatus, setEgiStatus] = useState<string | null>(null)
  const [createdBy, setCreatedBy] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    projectsApi.list().then(setProjects).catch(() => {})
    getTenantPlugins().then((r) => setSurveyImportEnabled(r.enabled.includes('survey-import'))).catch(() => setSurveyImportEnabled(false))
  }, [])

  useEffect(() => {
    if (!surveyImportEnabled || !selectedProjectId) { setRooms([]); setTargetRoomId(''); return }
    roomsApi.list(selectedProjectId).then((projectRooms) => {
      setRooms(projectRooms)
      setTargetRoomId((prev) => prev && projectRooms.some((r) => r.id === prev) ? prev : (projectRooms[0]?.id ?? ''))
    }).catch(() => { setRooms([]); setTargetRoomId('') })
  }, [selectedProjectId, surveyImportEnabled])

  useEffect(() => {
    if (!surveyImportEnabled || !selectedProjectId) { setRaumaufmassJobs([]); return }
    listRaumaufmassJobs(selectedProjectId).then(setRaumaufmassJobs).catch(() => setRaumaufmassJobs([]))
  }, [selectedProjectId, surveyImportEnabled])

  useEffect(() => {
    if (!selectedProjectId) { setSurveys([]); setChecklists([]); setSelectedSurveyId(null); setSelectedChecklistId(null); return }
    setBusy(true); setError(null)
    Promise.all([siteSurveysApi.list(selectedProjectId), checklistsApi.list(selectedProjectId)])
      .then(([surveyData, checklistData]) => {
        setSurveys(surveyData); setChecklists(checklistData)
        setSelectedSurveyId(surveyData[0]?.id ?? null)
        setSelectedChecklistId(checklistData[0]?.id ?? null)
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setBusy(false))
  }, [selectedProjectId])

  const selectedSurvey = useMemo(() => surveys.find((s) => s.id === selectedSurveyId) ?? null, [surveys, selectedSurveyId])
  const selectedChecklist = useMemo(() => checklists.find((c) => c.id === selectedChecklistId) ?? null, [checklists, selectedChecklistId])
  const measurementSegments = useMemo(() => selectedSurvey ? getMeasurementSegmentsFromMeasurements(selectedSurvey.measurements) : [], [selectedSurvey])
  const firstPhotoUrl = useMemo(() => selectedSurvey?.photos.find((p) => typeof p.url === 'string' && p.url.length > 0)?.url ?? null, [selectedSurvey])
  const checklistDoneCount = selectedChecklist?.items.filter((item) => item.checked).length ?? 0
  const checklistTotalCount = selectedChecklist?.items.length ?? 0

  async function handleCreateSurvey(event: FormEvent) {
    event.preventDefault()
    if (!selectedProjectId || !createdBy.trim()) return
    setBusy(true); setError(null)
    try {
      const created = await siteSurveysApi.create(selectedProjectId, { created_by: createdBy.trim(), notes: notes.trim() || null })
      setSurveys((prev) => [created, ...prev]); setSelectedSurveyId(created.id)
      setCreatedBy(''); setNotes('')
    } catch (e) { setError(e instanceof Error ? e.message : 'Fehler beim Anlegen') }
    finally { setBusy(false) }
  }

  async function handleChecklistItemToggle(checklistId: string, itemId: string, checked: boolean) {
    try {
      const updated = await checklistsApi.updateItem(checklistId, itemId, { checked })
      setChecklists((prev) => prev.map((cl) => cl.id === checklistId
        ? { ...cl, items: cl.items.map((item) => item.id === itemId ? { ...item, checked: updated.checked } : item) }
        : cl))
    } catch (e) { setError(e instanceof Error ? e.message : 'Fehler') }
  }

  async function handleChecklistItemNote(checklistId: string, itemId: string, noteValue: string) {
    try {
      const updated = await checklistsApi.updateItem(checklistId, itemId, { note: noteValue })
      setChecklists((prev) => prev.map((cl) => cl.id === checklistId
        ? { ...cl, items: cl.items.map((item) => item.id === itemId ? { ...item, note: updated.note } : item) }
        : cl))
    } catch (e) { setError(e instanceof Error ? e.message : 'Fehler') }
  }

  async function handleMeasurementImport() {
    if (!selectedSurvey || !targetRoomId) return
    if (measurementSegments.length === 0) { setError('Keine verwertbaren Messsegmente im Aufmasz gefunden.'); return }
    setImportBusy(true); setImportStatus(null); setError(null)
    try {
      const payload: {
        segments: MeasurementImportSegmentPayload[]
        reference_image?: { url: string; x: number; y: number; rotation: number; scale: number; opacity: number }
      } = { segments: measurementSegments }
      if (includeReferencePhoto && firstPhotoUrl) {
        payload.reference_image = { url: firstPhotoUrl, x: 50, y: 50, rotation: 0, scale: 1, opacity: 0.55 }
      }
      const response = await roomsApi.measurementImport(targetRoomId, payload)
      setImportStatus(`${response.imported_segments} Segmente in den Raum importiert.`)
    } catch (importError) { setError(importError instanceof Error ? importError.message : 'Import fehlgeschlagen') }
    finally { setImportBusy(false) }
  }

  async function handleRaumaufmassFileSelect(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    setError(null); setRaumaufmassStatus(null); setRaumaufmassValidation(null)
    try {
      const text = await file.text()
      setRaumaufmassPayload(JSON.parse(text) as unknown)
      setRaumaufmassFileName(file.name)
    } catch { setRaumaufmassPayload(null); setRaumaufmassFileName(file.name); setError('Die Datei enthaelt kein gueltiges JSON.') }
  }

  async function handleValidateRaumaufmass() {
    if (!selectedProjectId || !raumaufmassPayload) return
    setRaumaufmassBusy(true); setError(null); setRaumaufmassStatus(null)
    try {
      const result = await validateRaumaufmass(selectedProjectId, raumaufmassPayload, raumaufmassFileName || undefined)
      setRaumaufmassValidation(result)
      if (result.valid) setRaumaufmassStatus('Validierung erfolgreich. Daten koennen importiert werden.')
    } catch (e) { setError(e instanceof Error ? e.message : 'Validierung fehlgeschlagen') }
    finally { setRaumaufmassBusy(false) }
  }

  async function handleImportRaumaufmass() {
    if (!selectedProjectId || !raumaufmassPayload) return
    setRaumaufmassImportBusy(true); setError(null); setRaumaufmassStatus(null)
    try {
      const result = await importRaumaufmass(selectedProjectId, raumaufmassPayload, raumaufmassFileName || undefined)
      setRaumaufmassStatus(`${result.imported_rooms} Raum/Raeume erfolgreich importiert.`)
      const [projectRooms, jobs] = await Promise.all([
        roomsApi.list(selectedProjectId).catch(() => rooms),
        listRaumaufmassJobs(selectedProjectId).catch(() => raumaufmassJobs),
      ])
      setRooms(projectRooms); setRaumaufmassJobs(jobs); setRaumaufmassValidation(null)
    } catch (e) { setError(e instanceof Error ? e.message : 'Raumaufmasz-Import fehlgeschlagen') }
    finally { setRaumaufmassImportBusy(false) }
  }

  async function handleEgiFileSelect(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    setError(null); setEgiStatus(null); setEgiValidation(null); setEgiFileName(file.name)
    try { setEgiContent(await file.text()) }
    catch { setEgiContent(null); setError('Die EGI-Datei konnte nicht gelesen werden.') }
  }

  async function handleParseEgi() {
    if (!egiContent) return
    setEgiBusy(true); setError(null); setEgiStatus(null)
    try { setEgiValidation(await parseEgi(egiContent, egiFileName || undefined)); setEgiStatus('EGI-Datei erfolgreich analysiert.') }
    catch (e) { setError(e instanceof Error ? e.message : 'EGI-Analyse fehlgeschlagen') }
    finally { setEgiBusy(false) }
  }

  async function handleImportEgi() {
    if (!egiContent || !targetRoomId) return
    setEgiImportBusy(true); setError(null); setEgiStatus(null)
    try {
      const imported = await importEgiToRoom(targetRoomId, egiContent, egiFileName || undefined)
      setEgiStatus([
        `EGI importiert: ${imported.imported.walls} Waende, ${imported.imported.openings} Oeffnungen, ${imported.imported.placements} Objekte.`,
        `Import-Job: ${imported.job_id}`,
      ].join(' '))
      setEgiValidation(imported)
      setRooms(await roomsApi.list(selectedProjectId).catch(() => rooms))
    } catch (e) { setError(e instanceof Error ? e.message : 'EGI-Import fehlgeschlagen') }
    finally { setEgiImportBusy(false) }
  }

  const surveyRooms = selectedSurvey ? getRoomsFromMeasurements(selectedSurvey.measurements) : []

  return (
    <div className={styles.shell}>
      <Title2>Mobile Aufmasze und Baustellenprotokoll</Title2>

      {error && <MessageBar intent='error'><MessageBarBody>{error}</MessageBarBody></MessageBar>}

      <div className={styles.layout}>
        <aside className={styles.sidebar}>
          <Field label='Projekt'>
            <Select value={selectedProjectId} onChange={(_e, d) => setSelectedProjectId(d.value)}>
              <Option value=''>Projekt auswaehlen...</Option>
              {projects.map((p) => <Option key={p.id} value={p.id}>{p.name}</Option>)}
            </Select>
          </Field>

          <TabList selectedValue={tab} onTabSelect={(_e, d) => setTab(d.value as Tab)}>
            <Tab value='surveys'>Aufmasze</Tab>
            <Tab value='checklists'>Checklisten</Tab>
          </TabList>

          {tab === 'surveys' && (
            <div className={styles.list}>
              {surveys.map((survey) => (
                <button key={survey.id} type='button'
                  className={`${styles.listItem} ${selectedSurveyId === survey.id ? styles.listItemActive : ''}`}
                  onClick={() => setSelectedSurveyId(survey.id)}>
                  <span>{survey.created_by}</span>
                  <Caption1>{formatDate(survey.created_at)}</Caption1>
                </button>
              ))}
              {!busy && surveys.length === 0 && selectedProjectId && <Caption1>Keine Aufmasze vorhanden.</Caption1>}
            </div>
          )}

          {tab === 'checklists' && (
            <div className={styles.list}>
              {checklists.map((checklist) => (
                <button key={checklist.id} type='button'
                  className={`${styles.listItem} ${selectedChecklistId === checklist.id ? styles.listItemActive : ''}`}
                  onClick={() => setSelectedChecklistId(checklist.id)}>
                  <span>{checklist.title}</span>
                  <Caption1>{checklist.items.filter((item) => item.checked).length}/{checklist.items.length} erledigt</Caption1>
                </button>
              ))}
              {!busy && checklists.length === 0 && selectedProjectId && <Caption1>Keine Checklisten vorhanden.</Caption1>}
            </div>
          )}
        </aside>

        <main>
          {busy && <Spinner label='Laden...' />}
          {!selectedProjectId && <Body1>Bitte Projekt auswaehlen.</Body1>}

          {selectedProjectId && tab === 'surveys' && (
            <>
              <Card style={{ marginBottom: tokens.spacingVerticalM }}>
                <CardHeader header={<Body1Strong>Neues Aufmasz</Body1Strong>} />
                <form onSubmit={handleCreateSurvey}>
                  <Field label='Erfasst von' required>
                    <Input value={createdBy} onChange={(_e, d) => setCreatedBy(d.value)} />
                  </Field>
                  <Field label='Notizen'>
                    <Textarea value={notes} onChange={(_e, d) => setNotes(d.value)} />
                  </Field>
                  <Button type='submit' appearance='primary' disabled={busy || !createdBy.trim()}
                    icon={busy ? <Spinner size='tiny' /> : undefined}>
                    Aufmasz anlegen
                  </Button>
                </form>
              </Card>

              <Card>
                <CardHeader header={<Body1Strong>Detailansicht</Body1Strong>} />
                {!selectedSurvey && <Body1>Aufmasz auswaehlen.</Body1>}
                {selectedSurvey && (
                  <>
                    <Caption1>Erfasst von: {selectedSurvey.created_by} · {formatDate(selectedSurvey.created_at)}</Caption1>

                    <Body1Strong style={{ display: 'block', marginTop: tokens.spacingVerticalS }}>Messungen</Body1Strong>
                    {surveyRooms.length > 0 ? (
                      <div className={styles.tableWrap}>
                        <table className={styles.table}>
                          <thead><tr>
                            <th className={styles.th}>Raum</th>
                            <th className={styles.th}>Breite (mm)</th>
                            <th className={styles.th}>Tiefe (mm)</th>
                            <th className={styles.th}>Hoehe (mm)</th>
                          </tr></thead>
                          <tbody>
                            {surveyRooms.map((room, index) => (
                              <tr key={`${room.name}-${index}`}>
                                <td className={styles.td}>{room.name}</td>
                                <td className={styles.td}>{room.width_mm}</td>
                                <td className={styles.td}>{room.depth_mm}</td>
                                <td className={styles.td}>{room.height_mm ?? '–'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <pre className={styles.jsonBlock}>{JSON.stringify(selectedSurvey.measurements, null, 2)}</pre>
                    )}

                    {surveyImportEnabled && (
                      <>
                        <Body1Strong style={{ display: 'block', marginTop: tokens.spacingVerticalS }}>Aufmasz-Import</Body1Strong>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalXS }}>
                          <Field label='Zielraum'>
                            <Select value={targetRoomId} onChange={(_e, d) => setTargetRoomId(d.value)}>
                              {rooms.length === 0 && <Option value=''>Kein Raum verfuegbar</Option>}
                              {rooms.map((room) => <Option key={room.id} value={room.id}>{room.name}</Option>)}
                            </Select>
                          </Field>
                          <Checkbox checked={includeReferencePhoto} disabled={!firstPhotoUrl}
                            onChange={(_e, d) => setIncludeReferencePhoto(Boolean(d.checked))}
                            label='Erstes Foto als Referenzbild uebernehmen' />
                          <Caption1>Importierbare Segmente: {measurementSegments.length}</Caption1>
                          <Button appearance='primary' size='small'
                            disabled={importBusy || !targetRoomId || measurementSegments.length === 0}
                            onClick={() => void handleMeasurementImport()}
                            icon={importBusy ? <Spinner size='tiny' /> : undefined}>
                            {importBusy ? 'Importiere...' : 'In Raum importieren'}
                          </Button>
                          {importStatus && <MessageBar intent='success'><MessageBarBody>{importStatus}</MessageBarBody></MessageBar>}
                        </div>

                        <Body1Strong style={{ display: 'block', marginTop: tokens.spacingVerticalS }}>Raumaufmasz JSON-Import</Body1Strong>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalXS }}>
                          <label>
                            <Caption1>JSON-Datei</Caption1>
                            <input type='file' accept='application/json,.json' className={styles.fileInput}
                              onChange={(event) => void handleRaumaufmassFileSelect(event)} />
                          </label>
                          <Caption1>{raumaufmassFileName ? `Datei: ${raumaufmassFileName}` : 'Keine Datei.'}</Caption1>
                          <div className={styles.actionRow}>
                            <Button size='small' disabled={raumaufmassBusy || !raumaufmassPayload}
                              onClick={() => void handleValidateRaumaufmass()}
                              icon={raumaufmassBusy ? <Spinner size='tiny' /> : undefined}>
                              {raumaufmassBusy ? 'Validiere...' : 'JSON pruefen'}
                            </Button>
                            <Button size='small' appearance='primary'
                              disabled={raumaufmassImportBusy || !raumaufmassPayload || !raumaufmassValidation?.valid}
                              onClick={() => void handleImportRaumaufmass()}
                              icon={raumaufmassImportBusy ? <Spinner size='tiny' /> : undefined}>
                              {raumaufmassImportBusy ? 'Importiere...' : 'JSON importieren'}
                            </Button>
                          </div>
                          {raumaufmassStatus && <MessageBar intent='success'><MessageBarBody>{raumaufmassStatus}</MessageBarBody></MessageBar>}
                          {raumaufmassValidation && (
                            <div className={styles.validationBlock}>
                              <Caption1>Valid: {raumaufmassValidation.valid ? 'Ja' : 'Nein'} · Raeume: {raumaufmassValidation.preview.summary.room_count}</Caption1>
                            </div>
                          )}
                          <div className={styles.jobList}>
                            {raumaufmassJobs.map((job) => (
                              <div key={job.id} className={styles.jobItem}>
                                <span>{job.source_filename}</span>
                                <Caption1>{job.status} · {formatDate(job.created_at)}</Caption1>
                              </div>
                            ))}
                          </div>
                        </div>

                        <Body1Strong style={{ display: 'block', marginTop: tokens.spacingVerticalS }}>POS-Aufmaszservice (.egi)</Body1Strong>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalXS }}>
                          <label>
                            <Caption1>EGI-Datei</Caption1>
                            <input type='file' accept='.egi,text/plain' className={styles.fileInput}
                              onChange={(event) => void handleEgiFileSelect(event)} />
                          </label>
                          <Caption1>{egiFileName ? `Datei: ${egiFileName}` : 'Keine Datei.'}</Caption1>
                          <div className={styles.actionRow}>
                            <Button size='small' disabled={egiBusy || !egiContent}
                              onClick={() => void handleParseEgi()}
                              icon={egiBusy ? <Spinner size='tiny' /> : undefined}>
                              {egiBusy ? 'Analysiere...' : 'EGI pruefen'}
                            </Button>
                            <Button size='small' appearance='primary'
                              disabled={egiImportBusy || !egiContent || !targetRoomId}
                              onClick={() => void handleImportEgi()}
                              icon={egiImportBusy ? <Spinner size='tiny' /> : undefined}>
                              {egiImportBusy ? 'Importiere...' : 'In Zielraum importieren'}
                            </Button>
                          </div>
                          {egiStatus && <MessageBar intent='success'><MessageBarBody>{egiStatus}</MessageBarBody></MessageBar>}
                        </div>
                      </>
                    )}

                    <Body1Strong style={{ display: 'block', marginTop: tokens.spacingVerticalS }}>Fotos</Body1Strong>
                    <div className={styles.photoGrid}>
                      {selectedSurvey.photos.length === 0 && <Caption1>Keine Fotos.</Caption1>}
                      {selectedSurvey.photos.map((photo, index) => (
                        <div key={`${photo.url}-${index}`} className={styles.photoCard}>
                          <img src={photo.url} alt={photo.caption ?? 'Foto'} className={styles.photo} />
                          <Caption1>{photo.caption ?? 'Ohne Beschriftung'}</Caption1>
                        </div>
                      ))}
                    </div>

                    <Body1Strong style={{ display: 'block', marginTop: tokens.spacingVerticalS }}>Notizen</Body1Strong>
                    <Body1>{selectedSurvey.notes ?? '–'}</Body1>
                  </>
                )}
              </Card>
            </>
          )}

          {selectedProjectId && tab === 'checklists' && (
            <Card>
              <CardHeader header={<Body1Strong>Checkliste</Body1Strong>}
                action={selectedChecklist && <Badge appearance='tint'>{checklistDoneCount}/{checklistTotalCount} erledigt</Badge>}
              />
              {!selectedChecklist && <Body1>Checkliste auswaehlen.</Body1>}
              {selectedChecklist && (
                <div className={styles.checklistItems}>
                  {selectedChecklist.items.map((item) => (
                    <div key={item.id} className={styles.checklistItem}>
                      <Checkbox
                        checked={item.checked}
                        onChange={(_e, d) => void handleChecklistItemToggle(selectedChecklist.id, item.id, Boolean(d.checked))}
                        label={item.label}
                      />
                      <input
                        style={{ padding: '4px 8px', border: `1px solid ${tokens.colorNeutralStroke1}`, borderRadius: tokens.borderRadiusMedium, fontSize: tokens.fontSizeBase300 }}
                        placeholder='Notiz'
                        onBlur={(e) => { if ((item.note ?? '') !== e.target.value) void handleChecklistItemNote(selectedChecklist.id, item.id, e.target.value) }}
                        defaultValue={item.note ?? ''}
                      />
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}
        </main>
      </div>
    </div>
  )
}
