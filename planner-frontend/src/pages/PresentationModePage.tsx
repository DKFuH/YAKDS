import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { projectsApi, type ProjectDetail } from '../api/projects.js'
import { presentationApi, type PresentationSession } from '../api/presentation.js'
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
import styles from './PresentationModePage.module.css'

function delay(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function sourceLabel(source: PresentationSource, session: PresentationSession | null): string {
  if (source.kind === 'split-view') {
    return 'Split-View'
  }

  if (source.kind === 'manual-camera') {
    return 'Freie Kamera'
  }

  const match = session?.panorama_tours.find((tour) => tour.id === source.panorama_tour_id)
  return match ? `Panorama: ${match.name}` : 'Panorama'
}

export function PresentationModePage() {
  const presentationNavigation = defaultsForNavigationProfile('cad')
  const navigate = useNavigate()
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
    x_mm: 0,
    y_mm: 0,
    yaw_rad: 0,
    pitch_rad: -0.12,
    camera_height_mm: 1650,
  })
  const [cameraFovDeg, setCameraFovDeg] = useState(55)
  const [renderEnvironmentPresets, setRenderEnvironmentPresets] = useState<RenderEnvironmentPreset[]>(
    RENDER_ENVIRONMENT_PRESETS,
  )
  const [renderEnvironmentSettings, setRenderEnvironmentSettings] = useState<RenderEnvironmentSettings>(
    DEFAULT_RENDER_ENVIRONMENT_SETTINGS,
  )
  const [renderEnvironmentSaving, setRenderEnvironmentSaving] = useState(false)

  const [exporting, setExporting] = useState(false)
  const [renderStatus, setRenderStatus] = useState<string | null>(null)
  const [renderImageUrl, setRenderImageUrl] = useState<string | null>(null)

  const activeRoom = useMemo(() => project?.rooms[0] ?? null, [project])

  function applyPresetLocally(preset: CameraPreset) {
    const nextState = presetToCameraState(preset)
    setCameraState(nextState)
    setCameraFovDeg(clampPresetFov(preset.fov))
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
    } catch {
      setSunPreview(null)
    } finally {
      setSunPreviewLoading(false)
    }
  }

  useEffect(() => {
    if (!id) {
      setError('Projekt-ID fehlt')
      setLoading(false)
      return
    }

    const sourceQuery = searchParams.get('source')
    const tourIdQuery = searchParams.get('tourId')

    let requestedEntry: 'auto' | 'split-view' | 'panorama-tour' = 'auto'
    if (sourceQuery === 'split-view') {
      requestedEntry = 'split-view'
    }
    if (sourceQuery === 'panorama-tour' || tourIdQuery) {
      requestedEntry = 'panorama-tour'
    }

    setLoading(true)
    setError(null)

    Promise.all([
      projectsApi.get(id),
      presentationApi.createSession(id, {
        entry: requestedEntry,
        ...(tourIdQuery ? { panorama_tour_id: tourIdQuery } : {}),
      }),
    ])
      .then(([projectData, sessionData]) => {
        setProject(projectData)
        setSession(sessionData)
        setShowBranding(sessionData.presentation_mode.show_branding)

        if (sessionData.preferred_entry.kind === 'panorama-tour') {
          setSource({ kind: 'panorama-tour', panorama_tour_id: sessionData.preferred_entry.panorama_tour_id })
        } else {
          setSource({ kind: 'split-view' })
        }
      })
      .catch((err: Error) => {
        setError(err.message)
      })
      .finally(() => {
        setLoading(false)
      })
  }, [id, searchParams])

  useEffect(() => {
    if (!id) return

    let active = true
    getTenantPlugins()
      .then(async (plugins) => {
        if (!active) return
        const enabled = plugins.enabled.includes('daylight')
        setDaylightEnabled(enabled)

        if (!enabled) {
          setProjectEnvironment(null)
          setSunPreview(null)
          return
        }

        const environment = await projectEnvironmentApi.get(id)
        if (!active) return

        const normalized: ProjectEnvironment = {
          ...environment,
          config_json: environment.config_json ?? {},
        }
        setProjectEnvironment(normalized)
        await refreshSunPreview(id, normalized)
      })
      .catch(() => {
        if (!active) return
        setDaylightEnabled(false)
        setProjectEnvironment(null)
        setSunPreview(null)
      })

    return () => {
      active = false
    }
  }, [id])

  useEffect(() => {
    if (!id) {
      setRenderEnvironmentPresets(RENDER_ENVIRONMENT_PRESETS)
      setRenderEnvironmentSettings(DEFAULT_RENDER_ENVIRONMENT_SETTINGS)
      return
    }

    let active = true
    renderEnvironmentApi.get(id)
      .then((result) => {
        if (!active) return
        setRenderEnvironmentPresets(result.presets.length > 0 ? result.presets : RENDER_ENVIRONMENT_PRESETS)
        setRenderEnvironmentSettings(normalizeRenderEnvironmentSettings(result.active))
      })
      .catch(() => {
        if (!active) return
        setRenderEnvironmentPresets(RENDER_ENVIRONMENT_PRESETS)
        setRenderEnvironmentSettings(DEFAULT_RENDER_ENVIRONMENT_SETTINGS)
      })

    return () => {
      active = false
    }
  }, [id])

  useEffect(() => {
    if (!id) {
      setCameraPresets([])
      setActiveCameraPresetId(null)
      return
    }

    let active = true
    cameraPresetsApi.list(id)
      .then((result) => {
        if (!active) return
        setCameraPresets(result.presets)
        setActiveCameraPresetId(result.active_preset_id)

        const preferred = result.active_preset_id
          ? result.presets.find((entry) => entry.id === result.active_preset_id)
          : result.presets.find((entry) => entry.is_default)

        if (preferred) {
          applyPresetLocally(preferred)
          setActiveCameraPresetId(preferred.id)
        }
      })
      .catch(() => {
        if (!active) return
        setCameraPresets([])
        setActiveCameraPresetId(null)
      })

    return () => {
      active = false
    }
  }, [id])

  function handleDaylightPatch(patch: Partial<ProjectEnvironment>) {
    setProjectEnvironment((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        ...patch,
      }
    })
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
    } catch (saveError) {
      setError(`Render-Umgebung konnte nicht gespeichert werden: ${String(saveError)}`)
    } finally {
      setRenderEnvironmentSaving(false)
    }
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

      const normalized: ProjectEnvironment = {
        ...updated,
        config_json: updated.config_json ?? {},
      }
      setProjectEnvironment(normalized)
      await refreshSunPreview(id, normalized)
    } catch (saveError) {
      setError(`Tageslicht konnte nicht gespeichert werden: ${String(saveError)}`)
    } finally {
      setDaylightSaving(false)
    }
  }

  async function handleRefreshDaylightPreview() {
    if (!id || !projectEnvironment) return
    await refreshSunPreview(id, projectEnvironment)
  }

  async function handleRenderExport() {
    if (!id || !session) return

    setExporting(true)
    setRenderImageUrl(null)
    setError(null)
    setRenderStatus('Renderjob wird gestartet\u2026')

    try {
      const created = await presentationApi.createRenderJob(id, {
        preset,
        source,
        environment: renderEnvironmentSettings,
        scene_payload: {
          presentation_mode: true,
          source,
          project_name: session.project_name,
        },
      })

      for (let attempt = 0; attempt < 36; attempt += 1) {
        const current = await presentationApi.getRenderJob(created.id)
        setRenderStatus(`Renderstatus: ${current.status}`)

        if (current.status === 'done') {
          const imageUrl = current.result?.image_url ?? null
          if (imageUrl) {
            setRenderImageUrl(imageUrl)
            setRenderStatus('Rendering abgeschlossen')
          } else {
            setRenderStatus('Rendering abgeschlossen (kein Bildlink verf\u00fcgbar)')
          }
          return
        }

        if (current.status === 'failed') {
          throw new Error(current.error_message ?? 'Renderjob fehlgeschlagen')
        }

        await delay(1000)
      }

      throw new Error('Renderjob l\u00e4uft noch. Bitte sp\u00e4ter erneut pr\u00fcfen.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export fehlgeschlagen')
      setRenderStatus(null)
    } finally {
      setExporting(false)
    }
  }

  function handleOpenPanorama() {
    if (!session || source.kind !== 'panorama-tour') return
    const tour = session.panorama_tours.find((entry) => entry.id === source.panorama_tour_id)
    if (!tour?.share_url) return

    window.open(`${window.location.origin}${tour.share_url}`, '_blank', 'noopener,noreferrer')
  }

  if (loading) {
    return <div className={styles.center}>Lade Pr\u00e4sentationsmodus\u2026</div>
  }

  if (error) {
    return (
      <div className={styles.center}>
        <div className={styles.error}>{error}</div>
      </div>
    )
  }

  if (!project || !session) {
    return null
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>Pr\u00e4sentation</p>
          <h1 className={styles.title}>{session.project_name}</h1>
          <p className={styles.subtitle}>Reduzierter Kundenmodus mit klaren Render-Presets.</p>
        </div>
        <div className={styles.headerActions}>
          <button type="button" className={styles.btnSecondary} onClick={() => navigate(`/projects/${project.id}/panorama-tours`)}>
            Panorama-Touren
          </button>
          <button type="button" className={styles.btnSecondary} onClick={() => navigate(`/projects/${project.id}`)}>
            Zur\u00fcck zum Editor
          </button>
        </div>
      </header>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Einstellungen</h2>
        <div className={styles.controlsGrid}>
          <div className={styles.controlBlock}>
            <span className={styles.controlLabel}>Render-Preset</span>
            <div className={styles.presetRow}>
              {RENDER_PRESET_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`${styles.presetBtn} ${preset === option.value ? styles.presetBtnActive : ''}`}
                  onClick={() => setPreset(option.value)}
                >
                  <strong>{option.label}</strong>
                  <small>{option.hint}</small>
                </button>
              ))}
            </div>
          </div>

          <label className={styles.field}>
            <span>Einstieg</span>
            <select
              value={source.kind === 'panorama-tour' ? `panorama:${source.panorama_tour_id}` : source.kind}
              onChange={(event) => {
                const value = event.target.value
                if (value === 'split-view') {
                  setSource({ kind: 'split-view' })
                  return
                }
                if (value === 'manual-camera') {
                  setSource({ kind: 'manual-camera' })
                  return
                }

                const [, tourId] = value.split(':')
                if (tourId) {
                  setSource({ kind: 'panorama-tour', panorama_tour_id: tourId })
                }
              }}
            >
              <option value="split-view">Split-View</option>
              <option value="manual-camera">Freie Kamera</option>
              {session.panorama_tours.map((tour) => (
                <option key={tour.id} value={`panorama:${tour.id}`}>
                  Panorama: {tour.name}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.field}>
            <span>Kamera-Preset</span>
            <select
              value={activeCameraPresetId ?? ''}
              onChange={(event) => {
                const presetId = event.target.value
                if (!presetId || !id) {
                  setActiveCameraPresetId(null)
                  return
                }

                const localPreset = cameraPresets.find((entry) => entry.id === presetId)
                if (localPreset) {
                  applyPresetLocally(localPreset)
                }

                void cameraPresetsApi.apply(id, presetId)
                  .then((result) => {
                    setActiveCameraPresetId(result.active_preset_id)
                    applyPresetLocally(result.preset)
                  })
                  .catch(() => {
                    // preview keeps local preset if server apply fails
                  })
              }}
            >
              <option value="">Kein Preset</option>
              {cameraPresets.map((presetItem) => (
                <option key={presetItem.id} value={presetItem.id}>
                  {presetItem.name}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.field}>
            <span>FOV ({cameraFovDeg}°)</span>
            <input
              type="range"
              min={20}
              max={110}
              step={1}
              value={cameraFovDeg}
              onChange={(event) => setCameraFovDeg(clampPresetFov(Number(event.target.value)))}
            />
          </label>

          <label className={styles.checkboxRow}>
            <input
              type="checkbox"
              checked={showBranding}
              onChange={(event) => setShowBranding(event.target.checked)}
            />
            <span>Branding anzeigen</span>
          </label>
        </div>

        <div className={styles.actions}>
          <button type="button" className={styles.btnPrimary} onClick={() => void handleRenderExport()} disabled={exporting}>
            {exporting ? 'Export l\u00e4uft\u2026' : 'Bild exportieren'}
          </button>
          {source.kind === 'panorama-tour' && (
            <button type="button" className={styles.btnSecondary} onClick={handleOpenPanorama}>
              Panorama \u00f6ffnen
            </button>
          )}
          <span className={styles.status}>{renderStatus ?? `Aktiver Einstieg: ${sourceLabel(source, session)}`}</span>
        </div>
      </section>

      {daylightEnabled && projectEnvironment && (
        <section className={styles.section}>
          <DaylightPanel
            environment={projectEnvironment}
            preview={sunPreview}
            loadingPreview={sunPreviewLoading}
            savingEnvironment={daylightSaving}
            onChange={handleDaylightPatch}
            onSave={() => {
              void handleSaveDaylightEnvironment()
            }}
            onRefreshPreview={() => {
              void handleRefreshDaylightPreview()
            }}
          />
        </section>
      )}

      <section className={styles.section}>
        <RenderEnvironmentPanel
          presets={renderEnvironmentPresets}
          environment={renderEnvironmentSettings}
          saving={renderEnvironmentSaving}
          onChange={handleRenderEnvironmentChange}
          onSave={() => {
            void handleSaveRenderEnvironment()
          }}
        />
      </section>

      {showBranding && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Branding</h2>
          <div className={styles.brandingRow}>
            {session.branding.logo_url && <img className={styles.logo} src={session.branding.logo_url} alt="Firmenlogo" />}
            <div>
              <div className={styles.brandingTitle}>{session.branding.company_name ?? 'Ihr Unternehmen'}</div>
              <div className={styles.brandingMeta}>
                {[session.branding.company_city, session.branding.company_web].filter(Boolean).join(' \u00b7 ') || 'Kein Branding hinterlegt'}
              </div>
            </div>
          </div>
        </section>
      )}

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>3D-Ansicht</h2>
        <div className={styles.previewWrap}>
          <Preview3D
            room={activeRoom as unknown as RoomPayload | null}
            cameraState={cameraState}
            sunlight={daylightEnabled ? sunPreview : null}
            navigationSettings={presentationNavigation}
            renderEnvironment={renderEnvironmentSettings}
            fovDeg={cameraFovDeg}
          />
        </div>
      </section>

      {renderImageUrl && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Letztes Rendering</h2>
          <img className={styles.renderImage} src={renderImageUrl} alt="Exportiertes Rendering" />
        </section>
      )}
    </div>
  )
}
