import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
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
  Title2,
  makeStyles,
  tokens,
} from '@fluentui/react-components'
import { cutlistApi } from '../api/projectFeatures.js'
import { nestingApi, type NestingJob, type NestingResult } from '../api/nesting.js'

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

const useStyles = makeStyles({
  page: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
  },
  topRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.spacingHorizontalM,
    flexWrap: 'wrap',
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: tokens.spacingHorizontalM,
    alignItems: 'end',
  },
  kpis: {
    display: 'flex',
    gap: tokens.spacingHorizontalM,
    flexWrap: 'wrap',
    alignItems: 'center',
    marginBottom: tokens.spacingVerticalS,
  },
  kpiCard: {
    background: tokens.colorNeutralBackground2,
    borderRadius: tokens.borderRadiusMedium,
    padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalM}`,
    fontSize: tokens.fontSizeBase300,
  },
  sheetGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: tokens.spacingHorizontalM,
  },
  sheetSvg: {
    width: '100%',
    height: 'auto',
    border: `1px solid ${tokens.colorNeutralStroke1}`,
    borderRadius: tokens.borderRadiusSmall,
    color: tokens.colorNeutralForeground1,
    background: tokens.colorNeutralBackground3,
  },
  jobList: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
  },
  jobItem: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
  },
})

export function NestingPage() {
  const { id: projectId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const styles = useStyles()

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
  const [computing, setComputing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const activeJob = useMemo(() => jobs.find((job) => job.id === activeJobId) ?? null, [jobs, activeJobId])
  const result = getResult(activeJob)

  useEffect(() => {
    if (!projectId) return
    setLoading(true)
    setError(null)
    Promise.all([
      cutlistApi.list(projectId) as Promise<CutlistRecord[]>,
      nestingApi.listNestingJobs(projectId),
    ]).then(([cutlistRows, jobRows]) => {
      setCutlists(cutlistRows)
      setJobs(jobRows)
      setSelectedCutlistId((prev) => prev || cutlistRows[0]?.id || '')
      setActiveJobId((prev) => prev ?? jobRows[0]?.id ?? null)
    }).catch((e) => {
      setError(e instanceof Error ? e.message : 'Fehler beim Laden')
    }).finally(() => setLoading(false))
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
    setComputing(true)
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
      setComputing(false)
    }
  }

  async function onDeleteJob(jobId: string) {
    if (!confirm('Nesting-Job loeschen?')) return
    setError(null)
    try {
      await nestingApi.deleteNestingJob(jobId)
      setJobs((prev) => {
        const next = prev.filter((job) => job.id !== jobId)
        if (activeJobId === jobId) { setActiveJobId(next[0]?.id ?? null) }
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

  if (!projectId) return <div>Projekt-ID fehlt.</div>

  return (
    <div className={styles.page}>
      <div className={styles.topRow}>
        <Title2>Nesting</Title2>
        <div style={{ display: 'flex', gap: tokens.spacingHorizontalS }}>
          <Button appearance='subtle' onClick={() => navigate(`/projects/${projectId}`)}>Zurueck</Button>
          <Button
            appearance='primary'
            onClick={() => void onCreateJob()}
            disabled={computing || !selectedCutlistId}
            icon={computing ? <Spinner size='tiny' /> : undefined}
          >
            Nesting berechnen
          </Button>
        </div>
      </div>

      {error && <MessageBar intent='error'><MessageBarBody>{error}</MessageBarBody></MessageBar>}

      <Card>
        <CardHeader header={<Body1Strong>Konfiguration</Body1Strong>} />
        <div className={styles.formGrid}>
          <Field label='Cutlist'>
            <Select value={selectedCutlistId} onChange={(_e, d) => setSelectedCutlistId(d.value)}>
              <Option text='Bitte waehlen' value=''>Bitte waehlen</Option>
              {cutlists.map((cutlist) => (
                <Option key={cutlist.id} value={cutlist.id} text={new Date(cutlist.generated_at).toLocaleString('de-DE') + ' (' + (cutlist.summary?.total_parts ?? 0) + ' Teile)'}>
                  {new Date(cutlist.generated_at).toLocaleString('de-DE')} ({cutlist.summary?.total_parts ?? 0} Teile)
                </Option>
              ))}
            </Select>
          </Field>
          <Field label='Rohplattenformat'>
            <Select value={selectedPreset} onChange={(_e, d) => applyPreset(d.value)}>
              {presets.map((preset) => <Option key={preset.label} value={preset.label}>{preset.label}</Option>)}
            </Select>
          </Field>
          <Field label='Breite (mm)'>
            <Input
              type='number'
              value={String(sheetWidth)}
              disabled={selectedPreset !== 'Frei definieren'}
              onChange={(_e, d) => setSheetWidth(Number(d.value) || 0)}
            />
          </Field>
          <Field label='Hoehe (mm)'>
            <Input
              type='number'
              value={String(sheetHeight)}
              disabled={selectedPreset !== 'Frei definieren'}
              onChange={(_e, d) => setSheetHeight(Number(d.value) || 0)}
            />
          </Field>
          <Field label='Kerf (mm)'>
            <Input type='number' value={String(kerf)} onChange={(_e, d) => setKerf(Number(d.value) || 0)} />
          </Field>
          <Checkbox
            checked={allowRotate}
            onChange={(_e, d) => setAllowRotate(Boolean(d.checked))}
            label='Rotation erlauben'
          />
        </div>
      </Card>

      <Card>
        <CardHeader header={<Body1Strong>Jobs</Body1Strong>} />
        {loading && jobs.length === 0 ? (
          <Spinner label='Lade...' />
        ) : (
          <div className={styles.jobList}>
            {jobs.map((job) => (
              <div key={job.id} className={styles.jobItem}>
                <Button
                  appearance={activeJobId === job.id ? 'primary' : 'subtle'}
                  size='small'
                  onClick={() => setActiveJobId(job.id)}
                >
                  {new Date(job.created_at).toLocaleString('de-DE')}
                </Button>
                <Badge appearance='tint'>{job.status}</Badge>
                <Button appearance='subtle' size='small' onClick={() => void onDeleteJob(job.id)}>Loeschen</Button>
              </div>
            ))}
            {jobs.length === 0 && <Body1>Noch keine Jobs.</Body1>}
          </div>
        )}
      </Card>

      {activeJob && (
        <Card>
          <CardHeader header={<Body1Strong>Ergebnis</Body1Strong>} />
          <div className={styles.kpis}>
            <div className={styles.kpiCard}>Platten: <strong>{result.sheets.length}</strong></div>
            <div className={styles.kpiCard}>Verschnitt: <strong>{result.waste_pct.toFixed(2)}%</strong></div>
            <div className={styles.kpiCard}>Teile: <strong>{result.placed_parts} / {result.total_parts}</strong></div>
            <Button appearance='primary' size='small' onClick={() => void onExportDxf()}>DXF exportieren</Button>
          </div>

          <div className={styles.sheetGrid}>
            {result.sheets.map((sheet) => (
              <article key={sheet.index}>
                <Caption1>Platte {sheet.index}</Caption1>
                <svg
                  className={styles.sheetSvg}
                  viewBox={`0 0 ${sheet.width_mm} ${sheet.height_mm}`}
                >
                  <rect x='0' y='0' width={sheet.width_mm} height={sheet.height_mm} fill='none' stroke='currentColor' strokeWidth='8' />
                  {sheet.placements.map((placement, index) => (
                    <g key={`${placement.part_id}-${index}`}>
                      <rect
                        x={placement.x_mm}
                        y={placement.y_mm}
                        width={placement.width_mm}
                        height={placement.height_mm}
                        fill='none'
                        stroke='currentColor'
                        strokeWidth='4'
                      />
                      <text x={placement.x_mm + 8} y={placement.y_mm + 28} fontSize='24' fill='currentColor'>
                        {placement.part_id}
                      </text>
                    </g>
                  ))}
                </svg>
              </article>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
