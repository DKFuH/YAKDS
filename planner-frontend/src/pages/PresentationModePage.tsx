import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  Body1,
  Body1Strong,
  Button,
  Card,
  CardHeader,
  Checkbox,
  Field,
  MessageBar,
  MessageBarBody,
  Option,
  Select,
  Spinner,
  Title2,
  makeStyles,
  tokens,
} from '@fluentui/react-components'
import { projectsApi, type ProjectDetail } from '../api/projects.js'
import { presentationApi, type PresentationSession } from '../api/presentation.js'
import { mediaCaptureApi, type ScreenshotFormat } from '../api/mediaCapture.js'
import { projectEnvironmentApi } from '../api/projectEnvironment.js'
import { renderEnvironmentApi } from '../api/renderEnvironment.js'
import { cameraPresetsApi, type CameraPreset } from '../api/cameraPresets.js'
import { getTenantPlugins } from '../api/tenantSettings.js'
import { Preview3D } from '../components/editor/Preview3D.js'
import { clampPresetFov, presetToCameraState, type SyncedCameraState } from '../components/editor/cameraPresetState.js'
import { defaultsForNavigationProfile } from '../components/editor/navigationSettings.js'
import { DaylightPanel } from '../components/editor/DaylightPanel.js'
import { RenderEnvironmentPanel } from '../components/editor/RenderEnvironmentPanel.js'
import type { RoomPayload } from '../api/rooms.js'
import {
  RENDER_PRESET_OPTIONS,
  type PresentationSource,
  type RenderPreset,
} from '../plugins/presentation/index.js'
import type { ProjectEnvironment, SunPreview } from '../plugins/daylight/index.js'
import {
  DEFAULT_RENDER_ENVIRONMENT_SETTINGS,
  RENDER_ENVIRONMENT_PRESETS,
  normalizeRenderEnvironmentSettings,
  type RenderEnvironmentPreset,
  type RenderEnvironmentSettings,
} from '../components/editor/renderEnvironmentState.js'
import {
  DEFAULT_SCREENSHOT_OPTIONS,
  captureScreenshotFromRoot,
  normalizeScreenshotOptions,
  type ScreenshotOptions,
} from '../components/editor/screenshotCapture.js'

function delay(ms: number) {
  return new Promise((resolve) => { setTimeout(resolve, ms) })
}

function parseOptionalInt(value: string): number | null {
  if (!value.trim()) return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return null
  return Math.round(parsed)
}

function sourceLabel(source: PresentationSource, session: PresentationSession | null): string {
  if (source.kind === 'split-view') return 'Split-View'
  if (source.kind === 'manual-camera') return 'Freie Kamera'
  const match = session?.panorama_tours.find((tour) => tour.id === source.panorama_tour_id)
  return match ? `Panorama: ${match.name}` : 'Panorama'
}

const useStyles = makeStyles({
  page: { display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalM },
  topRow: {
    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
    gap: tokens.spacingHorizontalM, flexWrap: 'wrap',
  },
  actionRow: { display: 'flex', gap: tokens.spacingHorizontalS, flexWrap: 'wrap', alignItems: 'center' },
  controlsGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: tokens.spacingHorizontalM, alignItems: 'start',
  },
  presetRow: { display: 'flex', gap: tokens.spacingHorizontalXS, flexWrap: 'wrap' },
  presetBtn: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalM}`,
    border: `1px solid ${tokens.colorNeutralStroke1}`, borderRadius: tokens.borderRadiusMedium,
    background: tokens.colorNeutralBackground1, cursor: 'pointer', fontSize: tokens.fontSizeBase300,
  },
  presetBtnActive: {
    border: `1px solid ${tokens.colorBrandStroke1}`, background: tokens.colorBrandBackground2,
    color: tokens.colorBrandForeground1,
  },
  captureGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
    gap: tokens.spacingHorizontalM, alignItems: 'start',
  },
  brandingRow: { display: 'flex', gap: tokens.spacingHorizontalM, alignItems: 'center' },
  logo: { maxWidth: '80px', maxHeight: '40px', objectFit: 'contain' },
  previewWrap: { minHeight: '400px', borderRadius: tokens.borderRadiusMedium, overflow: 'hidden' },
  renderImage: { maxWidth: '100%', borderRadius: tokens.borderRadiusMedium },
  rangeField: { display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalXXS },
  fieldLabel: { fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground2 },
})

export function PresentationModePage() {
  const presentationNavigation = defaultsForNavigationProfile('cad')
  const navigate = useNavigate()
  const styles = useStyles()
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()

  const [project, setProject] = useState<ProjectDetail | null>(null)
  const [session, setSession] = useState<PresentationSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [preset, setPreset] = useState<RenderPreset>('balanced')
  const [source, setSource] = useState<PresentationSource>({ kind: 'split-view' })
  const [showBranding, setShowBranding] = useState(true)
  const [daylightEnabled, setDaylightEnabled] = useState(false)
  const [projectEnvironment, setProjectEnvironment] = useState<ProjectEnvironment | null>(null)
  const [sunPreview, setSunPreview] = useState<SunPreview | null>(null)
  const [daylightSaving, setDaylightSaving] = useState(false)
  const [sunPreviewLoading, setSunPreviewLoading] = useState(false)
  const [cameraPresets, setCameraPresets] = useState<CameraPreset[]>([])
  const [activeCameraPresetId, setActiveCameraPresetId] = useState<string | null>(null)
  const [cameraState, setCameraState] = useState<SyncedCameraState>({
    x_mm: 0, y_mm: 0, yaw_rad: 0, pitch_rad: -0.12, camera_height_mm: 1650,
  })
  const [cameraFovDeg, setCameraFovDeg] = useState(55)
  const [renderEnvironmentPresets, setRenderEnvironmentPresets] = useState<RenderEnvironmentPreset[]>(RENDER_ENVIRONMENT_PRESETS)
  const [renderEnvironmentSettings, setRenderEnvironmentSettings] = useState<RenderEnvironmentSettings>(DEFAULT_RENDER_ENVIRONMENT_SETTINGS)
  const [renderEnvironmentSaving, setRenderEnvironmentSaving] = useState(false)
  const [screenshotOptions, setScreenshotOptions] = useState<ScreenshotOptions>(DEFAULT_SCREENSHOT_OPTIONS)
  const [screenshotBusy, setScreenshotBusy] = useState(false)
  const [screenshotMessage, setScreenshotMessage] = useState<string | null>(null)
  const [screenshotError, setScreenshotError] = useState(false)
  const [export360Busy, setExport360Busy] = useState(false)
  const [export360Status, setExport360Status] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [renderStatus, setRenderStatus] = useState<string | null>(null)
  const [renderImageUrl, setRenderImageUrl] = useState<string | null>(null)
  const captureRootRef = useRef<HTMLDivElement | null>(null)

  const activeRoom = useMemo(() => project?.rooms[0] ?? null, [project])

  function applyPresetLocally(p: CameraPreset) {
    setCameraState(presetToCameraState(p))
    setCameraFovDeg(clampPresetFov(p.fov))
  }

  async function refreshSunPreview(projectId: string, environment: ProjectEnvironment | null) {
    if (!environment) return
    setSunPreviewLoading(true)
    try {
      const preview = await projectEnvironmentApi.sunPreview(projectId, {
        ...(environment.default_datetime ? { datetime: environment.default_datetime } : {}),
        ...(environment.latitude != null ? { latitude: environment.latitude } : {}),
        ...(environment.longitude != null ? { longitude: environment.longitude } : {}),
        north_angle_deg: environment.north_angle_deg,
      })
      setSunPreview(preview)
    } catch { setSunPreview(null) }
    finally { setSunPreviewLoading(false) }
  }

  useEffect(() => {
    if (!id) { setError('Projekt-ID fehlt'); setLoading(false); return }
    const sourceQuery = searchParams.get('source')
    const tourIdQuery = searchParams.get('tourId')
    let requestedEntry: 'auto' | 'split-view' | 'panorama-tour' = 'auto'
    if (sourceQuery === 'split-view') requestedEntry = 'split-view'
    if (sourceQuery === 'panorama-tour' || tourIdQuery) requestedEntry = 'panorama-tour'
    setLoading(true); setError(null)
    Promise.all([
      projectsApi.get(id),
      presentationApi.createSession(id, { entry: requestedEntry, ...(tourIdQuery ? { panorama_tour_id: tourIdQuery } : {}) }),
    ]).then(([projectData, sessionData]) => {
      setProject(projectData); setSession(sessionData)
      setShowBranding(sessionData.presentation_mode.show_branding)
      if (sessionData.preferred_entry.kind === 'panorama-tour') {
        setSource({ kind: 'panorama-tour', panorama_tour_id: sessionData.preferred_entry.panorama_tour_id })
      } else { setSource({ kind: 'split-view' }) }
    }).catch((err: Error) => setError(err.message)).finally(() => setLoading(false))
  }, [id, searchParams])

  useEffect(() => {
    if (!id) return
    let active = true
    getTenantPlugins().then(async (plugins) => {
      if (!active) return
      const enabled = plugins.enabled.includes('daylight')
      setDaylightEnabled(enabled)
      if (!enabled) { setProjectEnvironment(null); setSunPreview(null); return }
      const environment = await projectEnvironmentApi.get(id)
      if (!active) return
      const normalized: ProjectEnvironment = { ...environment, config_json: environment.config_json ?? {} }
      setProjectEnvironment(normalized)
      await refreshSunPreview(id, normalized)
    }).catch(() => {
      if (!active) return
      setDaylightEnabled(false); setProjectEnvironment(null); setSunPreview(null)
    })
    return () => { active = false }
  }, [id])

  useEffect(() => {
    if (!id) { setRenderEnvironmentPresets(RENDER_ENVIRONMENT_PRESETS); setRenderEnvironmentSettings(DEFAULT_RENDER_ENVIRONMENT_SETTINGS); return }
    let active = true
    renderEnvironmentApi.get(id).then((result) => {
      if (!active) return
      setRenderEnvironmentPresets(result.presets.length > 0 ? result.presets : RENDER_ENVIRONMENT_PRESETS)
      setRenderEnvironmentSettings(normalizeRenderEnvironmentSettings(result.active))
    }).catch(() => {
      if (!active) return
      setRenderEnvironmentPresets(RENDER_ENVIRONMENT_PRESETS); setRenderEnvironmentSettings(DEFAULT_RENDER_ENVIRONMENT_SETTINGS)
    })
    return () => { active = false }
  }, [id])

  useEffect(() => {
    if (!id) { setCameraPresets([]); setActiveCameraPresetId(null); return }
    let active = true
    cameraPresetsApi.list(id).then((result) => {
      if (!active) return
      setCameraPresets(result.presets); setActiveCameraPresetId(result.active_preset_id)
      const preferred = result.active_preset_id
        ? result.presets.find((e) => e.id === result.active_preset_id)
        : result.presets.find((e) => e.is_default)
      if (preferred) { applyPresetLocally(preferred); setActiveCameraPresetId(preferred.id) }
    }).catch(() => { if (!active) return; setCameraPresets([]); setActiveCameraPresetId(null) })
    return () => { active = false }
  }, [id])

  function handleDaylightPatch(patch: Partial<ProjectEnvironment>) {
    setProjectEnvironment((prev) => prev ? { ...prev, ...patch } : prev)
  }

  function handleRenderEnvironmentChange(next: RenderEnvironmentSettings) {
    setRenderEnvironmentSettings(normalizeRenderEnvironmentSettings(next))
  }

  async function handleSaveRenderEnvironment() {
    if (!id) return
    setRenderEnvironmentSaving(true)
    try {
      const updated = await renderEnvironmentApi.update(id, renderEnvironmentSettings)
      setRenderEnvironmentPresets(updated.presets.length > 0 ? updated.presets : RENDER_ENVIRONMENT_PRESETS)
      setRenderEnvironmentSettings(normalizeRenderEnvironmentSettings(updated.active))
    } catch (saveError) { setError(`Render-Umgebung konnte nicht gespeichert werden: ${String(saveError)}`) }
    finally { setRenderEnvironmentSaving(false) }
  }

  async function handleSaveDaylightEnvironment() {
    if (!id || !projectEnvironment) return
    setDaylightSaving(true)
    try {
      const updated = await projectEnvironmentApi.update(id, {
        north_angle_deg: projectEnvironment.north_angle_deg,
        latitude: projectEnvironment.latitude,
        longitude: projectEnvironment.longitude,
        timezone: projectEnvironment.timezone,
        default_datetime: projectEnvironment.default_datetime,
        daylight_enabled: projectEnvironment.daylight_enabled,
      })
      const normalized: ProjectEnvironment = { ...updated, config_json: updated.config_json ?? {} }
      setProjectEnvironment(normalized)
      await refreshSunPreview(id, normalized)
    } catch (saveError) { setError(`Tageslicht konnte nicht gespeichert werden: ${String(saveError)}`) }
    finally { setDaylightSaving(false) }
  }

  async function handleRefreshDaylightPreview() {
    if (!id || !projectEnvironment) return
    await refreshSunPreview(id, projectEnvironment)
  }

  async function handleRenderExport() {
    if (!id || !session) return
    setExporting(true); setRenderImageUrl(null); setError(null)
    setRenderStatus('Renderjob wird gestartet\u2026')
    try {
      const created = await presentationApi.createRenderJob(id, {
        preset, source, environment: renderEnvironmentSettings,
        scene_payload: { presentation_mode: true, source, project_name: session.project_name },
      })
      for (let attempt = 0; attempt < 36; attempt += 1) {
        const current = await presentationApi.getRenderJob(created.id)
        setRenderStatus(`Renderstatus: ${current.status}`)
        if (current.status === 'done') {
          const imageUrl = current.result?.image_url ?? null
          if (imageUrl) { setRenderImageUrl(imageUrl); setRenderStatus('Rendering abgeschlossen') }
          else { setRenderStatus('Rendering abgeschlossen (kein Bildlink verfuegbar)') }
          return
        }
        if (current.status === 'failed') throw new Error(current.error_message ?? 'Renderjob fehlgeschlagen')
        await delay(1000)
      }
      throw new Error('Renderjob laeuft noch. Bitte spaeter erneut pruefen.')
    } catch (err) { setError(err instanceof Error ? err.message : 'Export fehlgeschlagen'); setRenderStatus(null) }
    finally { setExporting(false) }
  }

  async function handleCaptureScreenshot() {
    if (!id) return
    const captureRoot = captureRootRef.current
    if (!captureRoot) { setScreenshotError(true); setScreenshotMessage('Screenshot fehlgeschlagen: keine aktive Vorschau gefunden'); return }
    setScreenshotBusy(true); setScreenshotError(false); setScreenshotMessage(null)
    try {
      const normalizedOptions = normalizeScreenshotOptions(screenshotOptions)
      const capture = captureScreenshotFromRoot(captureRoot, 'presentation', normalizedOptions)
      const extension = normalizedOptions.format === 'jpeg' ? 'jpg' : 'png'
      const result = await mediaCaptureApi.uploadScreenshot(id, {
        ...capture, filename: `presentation-screenshot-${Date.now()}.${extension}`,
        view_mode: 'presentation', transparent_background: normalizedOptions.transparent_background,
        uploaded_by: 'presentation-mode',
      })
      setScreenshotMessage(`Screenshot gespeichert: ${result.filename}`)
      if (result.preview_url) window.open(result.preview_url, '_blank', 'noopener,noreferrer')
    } catch (captureError) {
      setScreenshotError(true); setScreenshotMessage(`Screenshot fehlgeschlagen: ${String(captureError)}`)
    } finally { setScreenshotBusy(false) }
  }

  async function handleStartExport360() {
    if (!id) return
    setExport360Busy(true); setScreenshotError(false); setExport360Status('360-Export wird gestartet...')
    try {
      const normalizedOptions = normalizeScreenshotOptions(screenshotOptions)
      const request = await mediaCaptureApi.createExport360(id, {
        preset, format: normalizedOptions.format, quality: normalizedOptions.quality,
        width_px: normalizedOptions.width_px ?? 4096, height_px: normalizedOptions.height_px ?? 2048,
        environment: renderEnvironmentSettings,
      })
      for (let attempt = 0; attempt < 45; attempt += 1) {
        const status = await mediaCaptureApi.getExport360Status(id, request.job_id)
        setExport360Status(`360-Status: ${status.status}`)
        if (status.status === 'done') {
          if (status.download_url) { window.open(status.download_url, '_blank', 'noopener,noreferrer'); setScreenshotMessage('360-Export abgeschlossen und geoeffnet') }
          else { setScreenshotMessage('360-Export abgeschlossen (kein Download-Link)') }
          return
        }
        if (status.status === 'failed') throw new Error(status.error_message ?? '360-Export fehlgeschlagen')
        await delay(1000)
      }
      throw new Error('360-Export laeuft noch.')
    } catch (exportError) {
      setScreenshotError(true); setScreenshotMessage(`360-Export fehlgeschlagen: ${String(exportError)}`)
    } finally { setExport360Busy(false) }
  }

  function handleOpenPanorama() {
    if (!session || source.kind !== 'panorama-tour') return
    const tour = session.panorama_tours.find((entry) => entry.id === source.panorama_tour_id)
    if (!tour?.share_url) return
    window.open(`${window.location.origin}${tour.share_url}`, '_blank', 'noopener,noreferrer')
  }

  if (loading) return <Spinner label='Lade Praesentationsmodus...' />
  if (error) return <MessageBar intent='error'><MessageBarBody>{error}</MessageBarBody></MessageBar>
  if (!project || !session) return null

  return (
    <div className={styles.page}>
      <div className={styles.topRow}>
        <div>
          <Title2>{session.project_name}</Title2>
          <Body1>Reduzierter Kundenmodus mit klaren Render-Presets.</Body1>
        </div>
        <div className={styles.actionRow}>
          <Button appearance='subtle' onClick={() => navigate(`/projects/${project.id}/panorama-tours`)}>Panorama-Touren</Button>
          <Button appearance='subtle' onClick={() => navigate(`/projects/${project.id}`)}>Zurueck zum Editor</Button>
        </div>
      </div>

      <Card>
        <CardHeader header={<Body1Strong>Einstellungen</Body1Strong>} />
        <div className={styles.controlsGrid}>
          <div>
            <span className={styles.fieldLabel}>Render-Preset</span>
            <div className={styles.presetRow}>
              {RENDER_PRESET_OPTIONS.map((option) => (
                <button key={option.value} type='button'
                  className={`${styles.presetBtn} ${preset === option.value ? styles.presetBtnActive : ''}`}
                  onClick={() => setPreset(option.value)}>
                  <strong>{option.label}</strong>
                  <small>{option.hint}</small>
                </button>
              ))}
            </div>
          </div>

          <Field label='Einstieg'>
            <Select
              value={source.kind === 'panorama-tour' ? `panorama:${source.panorama_tour_id}` : source.kind}
              onChange={(_e, d) => {
                const value = d.value
                if (value === 'split-view') { setSource({ kind: 'split-view' }); return }
                if (value === 'manual-camera') { setSource({ kind: 'manual-camera' }); return }
                const [, tourId] = value.split(':')
                if (tourId) setSource({ kind: 'panorama-tour', panorama_tour_id: tourId })
              }}>
              <Option value='split-view'>Split-View</Option>
              <Option value='manual-camera'>Freie Kamera</Option>
              {session.panorama_tours.map((tour) => (
                <Option key={tour.id} value={`panorama:${tour.id}`} text={`Panorama: ${tour.name}`}>Panorama: {tour.name}</Option>
              ))}
            </Select>
          </Field>

          <Field label='Kamera-Preset'>
            <Select value={activeCameraPresetId ?? ''}
              onChange={(_e, d) => {
                const presetId = d.value
                if (!presetId || !id) { setActiveCameraPresetId(null); return }
                const localPreset = cameraPresets.find((entry) => entry.id === presetId)
                if (localPreset) applyPresetLocally(localPreset)
                void cameraPresetsApi.apply(id, presetId)
                  .then((result) => { setActiveCameraPresetId(result.active_preset_id); applyPresetLocally(result.preset) })
                  .catch(() => {})
              }}>
              <Option value=''>Kein Preset</Option>
              {cameraPresets.map((p) => <Option key={p.id} value={p.id}>{p.name}</Option>)}
            </Select>
          </Field>

          <div className={styles.rangeField}>
            <label className={styles.fieldLabel}>FOV ({cameraFovDeg})</label>
            <input type='range' min={20} max={110} step={1} value={cameraFovDeg}
              onChange={(e) => setCameraFovDeg(clampPresetFov(Number(e.target.value)))} />
          </div>

          <Checkbox checked={showBranding} onChange={(_e, d) => setShowBranding(Boolean(d.checked))} label='Branding anzeigen' />
        </div>

        <div className={styles.actionRow} style={{ marginTop: tokens.spacingVerticalS }}>
          <Button appearance='primary' onClick={() => void handleRenderExport()} disabled={exporting}
            icon={exporting ? <Spinner size='tiny' /> : undefined}>
            {exporting ? 'Export laeuft...' : 'Bild exportieren'}
          </Button>
          {source.kind === 'panorama-tour' && (
            <Button appearance='subtle' onClick={handleOpenPanorama}>Panorama oeffnen</Button>
          )}
          <Body1 style={{ color: tokens.colorNeutralForeground3 }}>
            {renderStatus ?? `Aktiver Einstieg: ${sourceLabel(source, session)}`}
          </Body1>
        </div>
      </Card>

      <Card>
        <CardHeader header={<Body1Strong>Screenshot und 360-Export</Body1Strong>} />
        <div className={styles.captureGrid}>
          <Field label='Format'>
            <Select value={screenshotOptions.format}
              onChange={(_e, d) => setScreenshotOptions((cur) => ({ ...cur, format: d.value === 'jpeg' ? 'jpeg' : 'png' as ScreenshotFormat }))}>
              <Option value='png'>PNG</Option>
              <Option value='jpeg'>JPEG</Option>
            </Select>
          </Field>
          <Field label='Breite (px)'>
            <input type='number' min={256} max={8192} value={screenshotOptions.width_px ?? ''}
              style={{ width: '100%', padding: '4px 8px', border: `1px solid ${tokens.colorNeutralStroke1}`, borderRadius: tokens.borderRadiusMedium }}
              onChange={(e) => setScreenshotOptions((cur) => ({ ...cur, width_px: parseOptionalInt(e.target.value) }))} />
          </Field>
          <Field label='Hoehe (px)'>
            <input type='number' min={256} max={8192} value={screenshotOptions.height_px ?? ''}
              style={{ width: '100%', padding: '4px 8px', border: `1px solid ${tokens.colorNeutralStroke1}`, borderRadius: tokens.borderRadiusMedium }}
              onChange={(e) => setScreenshotOptions((cur) => ({ ...cur, height_px: parseOptionalInt(e.target.value) }))} />
          </Field>
          <div className={styles.rangeField}>
            <label className={styles.fieldLabel}>Qualitaet ({Math.round(screenshotOptions.quality * 100)}%)</label>
            <input type='range' min={10} max={100} step={1} value={Math.round(screenshotOptions.quality * 100)}
              onChange={(e) => {
                const q = Number(e.target.value)
                setScreenshotOptions((cur) => ({ ...cur, quality: Number.isFinite(q) ? q / 100 : cur.quality }))
              }} />
          </div>
          <Checkbox checked={screenshotOptions.transparent_background}
            onChange={(_e, d) => setScreenshotOptions((cur) => ({ ...cur, transparent_background: Boolean(d.checked) }))}
            label='Transparenter Hintergrund' />
        </div>
        <div className={styles.actionRow} style={{ marginTop: tokens.spacingVerticalS }}>
          <Button appearance='subtle' onClick={() => void handleCaptureScreenshot()} disabled={screenshotBusy}
            icon={screenshotBusy ? <Spinner size='tiny' /> : undefined}>
            {screenshotBusy ? 'Screenshot...' : 'Screenshot speichern'}
          </Button>
          <Button appearance='subtle' onClick={() => void handleStartExport360()} disabled={export360Busy}
            icon={export360Busy ? <Spinner size='tiny' /> : undefined}>
            {export360Busy ? '360...' : '360 Export'}
          </Button>
          {export360Status && <Body1 style={{ color: tokens.colorNeutralForeground3 }}>{export360Status}</Body1>}
        </div>
        {screenshotMessage && (
          <MessageBar intent={screenshotError ? 'error' : 'success'}>
            <MessageBarBody>{screenshotMessage}</MessageBarBody>
          </MessageBar>
        )}
      </Card>

      {daylightEnabled && projectEnvironment && (
        <Card>
          <DaylightPanel
            environment={projectEnvironment}
            preview={sunPreview}
            loadingPreview={sunPreviewLoading}
            savingEnvironment={daylightSaving}
            onChange={handleDaylightPatch}
            onSave={() => void handleSaveDaylightEnvironment()}
            onRefreshPreview={() => void handleRefreshDaylightPreview()}
          />
        </Card>
      )}

      <Card>
        <RenderEnvironmentPanel
          presets={renderEnvironmentPresets}
          environment={renderEnvironmentSettings}
          saving={renderEnvironmentSaving}
          onChange={handleRenderEnvironmentChange}
          onSave={() => void handleSaveRenderEnvironment()}
        />
      </Card>

      {showBranding && (
        <Card>
          <CardHeader header={<Body1Strong>Branding</Body1Strong>} />
          <div className={styles.brandingRow}>
            {session.branding.logo_url && (
              <img className={styles.logo} src={session.branding.logo_url} alt='Firmenlogo' />
            )}
            <div>
              <Body1Strong>{session.branding.company_name ?? 'Ihr Unternehmen'}</Body1Strong>
              <Body1 style={{ display: 'block', color: tokens.colorNeutralForeground3 }}>
                {[session.branding.company_city, session.branding.company_web].filter(Boolean).join(' · ') || 'Kein Branding hinterlegt'}
              </Body1>
            </div>
          </div>
        </Card>
      )}

      <Card>
        <CardHeader header={<Body1Strong>3D-Ansicht</Body1Strong>} />
        <div ref={captureRootRef} className={styles.previewWrap}>
          <Preview3D
            room={activeRoom as unknown as RoomPayload | null}
            cameraState={cameraState}
            sunlight={daylightEnabled ? sunPreview : null}
            navigationSettings={presentationNavigation}
            renderEnvironment={renderEnvironmentSettings}
            fovDeg={cameraFovDeg}
          />
        </div>
      </Card>

      {renderImageUrl && (
        <Card>
          <CardHeader header={<Body1Strong>Letztes Rendering</Body1Strong>} />
          <img className={styles.renderImage} src={renderImageUrl} alt='Exportiertes Rendering' />
        </Card>
      )}
    </div>
  )
}
