import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import type { SectionLine, Vertex } from '@shared/types'
import { projectsApi, type ProjectDetail, type ProjectLockState } from '../api/projects.js'
import {
  type CatalogArticle,
  type UnifiedCatalogItem,
} from '../api/catalog.js'
import { placementsApi, type Placement } from '../api/placements.js'
import { dimensionsApi, type Dimension } from '../api/dimensions.js'
import { centerlinesApi, type Centerline } from '../api/centerlines.js'
import {
  drawingGroupsApi,
  type DrawingGroup,
  type DrawingGroupConfigPatch,
  type DrawingGroupMember,
} from '../api/drawingGroups.js'
import {
  annotationsApi,
  roomsApi,
  type ProjectElevationEntry,
  type ReferenceImagePayload,
  type RoomBoundaryPayload,
  type RoomPayload,
  type SectionViewConfig,
  type SectionViewResponse,
} from '../api/rooms.js'
import { areasApi } from '../api/areas.js'
import { openingsApi, type Opening } from '../api/openings.js'
import { validateApi, type ValidateResponse } from '../api/validate.js'
import { autoCompletionApi, type AutoCompleteResult } from '../api/autoCompletion.js'
import { acousticsApi, type AcousticGridMeta, type GeoJsonGrid } from '../api/acoustics.js'
import {
  getTenantPlugins,
  getTenantSettings,
  updateTenantSettings,
  type TenantPluginsResponse,
} from '../api/tenantSettings.js'
import { projectEnvironmentApi } from '../api/projectEnvironment.js'
import { renderEnvironmentApi } from '../api/renderEnvironment.js'
import { mediaCaptureApi } from '../api/mediaCapture.js'
import { levelsApi, type BuildingLevel } from '../api/levels.js'
import { cameraPresetsApi, type CameraPreset } from '../api/cameraPresets.js'
import { visibilityApi, type AutoDollhousePatch, type AutoDollhouseSettings } from '../api/visibility.js'
import { verticalConnectionsApi, type VerticalConnection, type VerticalConnectionKind } from '../api/verticalConnections.js'
import { usePolygonEditor, edgeLengthMm, type EditorState } from '../editor/usePolygonEditor.js'
import { useEditorModeStore } from '../editor/editorModeStore.js'
import {
  resolvePolygonShortcutStates,
  resolveEditorActionStates,
  resolveViewModeShortcut,
  type EditorActionContext,
} from '../editor/actionStateResolver.js'
import {
  buildDimensionAssistSegments,
  normalizeOpeningForMultiview,
} from '../editor/roomTopology.js'
import { getEditorModeForWorkflowStep, useWorkflowStateStore } from '../editor/workflowStateStore.js'
import { CanvasArea } from '../components/editor/CanvasArea.js'
import { PopoutWindow } from '../components/editor/PopoutWindow.js'
import { Preview3D } from '../components/editor/Preview3D.js'
import { CameraPresetPanel } from '../components/editor/CameraPresetPanel.js'
import { NavigationSettingsPanel } from '../components/editor/NavigationSettingsPanel.js'
import { DaylightPanel } from '../components/editor/DaylightPanel.js'
import { RenderEnvironmentPanel } from '../components/editor/RenderEnvironmentPanel.js'
import { MaterialPanel } from '../components/editor/MaterialPanel.js'
import { LeftSidebar } from '../components/editor/LeftSidebar.js'
import { CadToolbox } from '../components/editor/CadToolbox.js'
import { LevelsPanel } from '../components/editor/LevelsPanel.js'
import { StairsPanel } from '../components/editor/StairsPanel.js'
import { SectionPanel } from '../components/editor/SectionPanel.js'
import { RightSidebar, type CeilingConstraint, type ConfiguredDimensions } from '../components/editor/RightSidebar.js'
import { StatusBar } from '../components/editor/StatusBar.js'
import { AreasPanel } from '../components/editor/AreasPanel.js'
import { LayoutSheetTabs } from '../components/editor/LayoutSheetTabs.js'
import { useAppShellEditorBridge } from '../components/layout/AppShellEditorBridge.js'
import { resolvePluginSlotEntries } from '../plugins/pluginSlotRegistry.js'
import type { ProjectEnvironment, SunPreview } from '../plugins/daylight/index.js'
import styles from './Editor.module.css'
import {
  defaultsForNavigationProfile,
  resolveNavigationSettings,
  type NavigationSettings,
} from '../components/editor/navigationSettings.js'
import {
  clampNumber,
  loadPlannerViewSettings,
  savePlannerViewSettings,
  type PlannerViewMode,
} from './plannerViewSettings.js'
import {
  cameraStateToPresetPayload,
  clampPresetFov,
  presetToCameraState,
  type SyncedCameraState,
} from '../components/editor/cameraPresetState.js'
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
  type ScreenshotViewMode,
} from '../components/editor/screenshotCapture.js'

function resolveArticleVariantId(article: CatalogArticle, chosenOptions: Record<string, string>): string | undefined {
  if (!article.variants || article.variants.length === 0) {
    return undefined
  }

  for (const variant of article.variants) {
    const values = (variant.variant_values_json ?? {}) as Record<string, unknown>
    const keys = Object.keys(values)
    if (keys.length === 0) {
      continue
    }

    const matches = keys.every((key) => {
      const selected = chosenOptions[key]
      if (selected == null || selected.trim() === '') {
        return false
      }
      return String(values[key]) === selected
    })

    if (matches) {
      return variant.id
    }
  }

  return undefined
}

function resolveArticlePriceForVariant(article: CatalogArticle, variantId?: string) {
  const prices = article.prices ?? []
  if (prices.length === 0) {
    return undefined
  }

  if (variantId) {
    const variantPrice = prices.find((price) => price.article_variant_id === variantId)
    if (variantPrice) {
      return variantPrice
    }
  }

  const defaultPrice = prices.find((price) => !price.article_variant_id)
  return defaultPrice ?? prices[0]
}

function parseReferenceImage(raw: unknown): NonNullable<EditorState['referenceImage']> | null {
  if (!raw || typeof raw !== 'object') return null
  const candidate = raw as Partial<ReferenceImagePayload>
  if (typeof candidate.url !== 'string' || candidate.url.length === 0) return null

  return {
    url: candidate.url,
    x: typeof candidate.x === 'number' ? candidate.x : 50,
    y: typeof candidate.y === 'number' ? candidate.y : 50,
    rotation: typeof candidate.rotation === 'number' ? candidate.rotation : 0,
    scale: typeof candidate.scale === 'number' ? candidate.scale : 1,
    opacity: typeof candidate.opacity === 'number' ? candidate.opacity : 0.5,
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null
  }

  return value as Record<string, unknown>
}

function extractRoomVertices(boundary: unknown): Array<{ x_mm: number; y_mm: number }> {
  const candidate = asRecord(boundary)
  if (!candidate) return []
  if (!Array.isArray(candidate.vertices)) return []

  const vertices: Array<{ x_mm: number; y_mm: number }> = []
  for (const entry of candidate.vertices) {
    const vertex = asRecord(entry)
    if (!vertex) continue
    if (typeof vertex.x_mm !== 'number' || !Number.isFinite(vertex.x_mm)) continue
    if (typeof vertex.y_mm !== 'number' || !Number.isFinite(vertex.y_mm)) continue
    vertices.push({ x_mm: vertex.x_mm, y_mm: vertex.y_mm })
  }

  return vertices
}

type WallSegmentFlags = {
  id: string
  visible?: boolean
  is_hidden?: boolean
  locked?: boolean
  lock_scope?: string | null
  [key: string]: unknown
}

function extractBoundaryWallSegments(boundary: unknown): WallSegmentFlags[] {
  const candidate = asRecord(boundary)
  if (!candidate || !Array.isArray(candidate.wall_segments)) {
    return []
  }

  const segments: WallSegmentFlags[] = []
  for (const entry of candidate.wall_segments) {
    const wall = asRecord(entry)
    if (!wall || typeof wall.id !== 'string' || wall.id.trim().length === 0) {
      continue
    }
    segments.push(wall as WallSegmentFlags)
  }
  return segments
}

function updateBoundaryWallSegment(boundary: unknown, wallId: string, patch: Partial<WallSegmentFlags>): unknown {
  const candidate = asRecord(boundary)
  if (!candidate || !Array.isArray(candidate.wall_segments)) {
    return boundary
  }

  let changed = false
  const nextSegments = candidate.wall_segments.map((entry) => {
    const wall = asRecord(entry)
    if (!wall || wall.id !== wallId) {
      return entry
    }
    changed = true
    return { ...wall, ...patch }
  })

  if (!changed) {
    return boundary
  }

  return {
    ...candidate,
    wall_segments: nextSegments,
  }
}

function resolveWallVisible(segment: WallSegmentFlags | null): boolean {
  if (!segment) return true
  if (typeof segment.visible === 'boolean') return segment.visible
  if (typeof segment.is_hidden === 'boolean') return !segment.is_hidden
  return true
}

function buildFootprintFromRoom(room: RoomPayload): Record<string, unknown> {
  const vertices = extractRoomVertices(room.boundary)

  if (vertices.length === 0) {
    return {
      room_id: room.id,
      rect: {
        x_mm: 0,
        y_mm: 0,
        width_mm: 1,
        depth_mm: 1,
      },
    }
  }

  const xs = vertices.map((vertex) => vertex.x_mm)
  const ys = vertices.map((vertex) => vertex.y_mm)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)

  return {
    room_id: room.id,
    rect: {
      x_mm: minX,
      y_mm: minY,
      width_mm: Math.max(1, maxX - minX),
      depth_mm: Math.max(1, maxY - minY),
    },
    ...(vertices.length >= 3 ? { vertices } : {}),
  }
}

function extractVerticalConnectionRoomId(connection: VerticalConnection): string | null {
  const footprint = asRecord(connection.footprint_json)
  if (!footprint) return null

  const roomId = footprint.room_id
  if (typeof roomId !== 'string') return null

  const normalized = roomId.trim()
  return normalized.length > 0 ? normalized : null
}

function buildDefaultSectionLine(room: RoomPayload) {
  const vertices = extractRoomVertices(room.boundary)

  if (vertices.length < 2) {
    return {
      start: { x_mm: 0, y_mm: 0 },
      end: { x_mm: 2000, y_mm: 0 },
    }
  }

  const xs = vertices.map((vertex) => vertex.x_mm)
  const ys = vertices.map((vertex) => vertex.y_mm)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const centerY = (minY + maxY) * 0.5

  return {
    start: { x_mm: minX, y_mm: centerY },
    end: { x_mm: maxX, y_mm: centerY },
  }
}

function delay(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function parseOptionalInt(value: string): number | null {
  if (!value.trim()) {
    return null
  }

  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    return null
  }

  return Math.round(parsed)
}

export function Editor() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const appShellBridge = useAppShellEditorBridge()
  const [project, setProject] = useState<ProjectDetail | null>(null)
  const [projectLockState, setProjectLockState] = useState<ProjectLockState | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [bulkDeliveredLoading, setBulkDeliveredLoading] = useState(false)
  const [bulkDeliveredMessage, setBulkDeliveredMessage] = useState<string | null>(null)
  const [bulkDeliveredError, setBulkDeliveredError] = useState(false)
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null)
  const [levels, setLevels] = useState<BuildingLevel[]>([])
  const [activeLevelId, setActiveLevelId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<PlannerViewMode>('2d')
  const [splitRatio, setSplitRatio] = useState(58)
  const [splitDragging, setSplitDragging] = useState(false)
  const [showVirtualVisitor, setShowVirtualVisitor] = useState(true)
  const [cameraHeightMm, setCameraHeightMm] = useState(1650)
  const [cameraFovDeg, setCameraFovDeg] = useState(55)
  const [navigationSettings, setNavigationSettings] = useState<NavigationSettings>(defaultsForNavigationProfile('cad'))
  const [navigationPanelOpen, setNavigationPanelOpen] = useState(false)
  const [cameraPresetPanelOpen, setCameraPresetPanelOpen] = useState(false)
  const [sectionMenuOpen, setSectionMenuOpen] = useState(false)
  const [toolboxMenuOpen, setToolboxMenuOpen] = useState(false)
  const [cameraState, setCameraState] = useState<SyncedCameraState>({
    x_mm: 0,
    y_mm: 0,
    yaw_rad: 0,
    pitch_rad: -0.12,
    camera_height_mm: 1650,
  })
  const [compactLayout, setCompactLayout] = useState(() => (typeof window !== 'undefined' ? window.innerWidth < 1180 : false))
  const [openings, setOpenings] = useState<Opening[]>([])
  const [selectedOpeningId, setSelectedOpeningId] = useState<string | null>(null)
  const [placements, setPlacements] = useState<Placement[]>([])
  const [dimensions, setDimensions] = useState<Dimension[]>([])
  const [centerlines, setCenterlines] = useState<Centerline[]>([])
  const [drawingGroups, setDrawingGroups] = useState<DrawingGroup[]>([])
  const [selectedDrawingGroupId, setSelectedDrawingGroupId] = useState<string | null>(null)
  const [selectedPlacementId, setSelectedPlacementId] = useState<string | null>(null)
  const [selectedCatalogItem, setSelectedCatalogItem] = useState<UnifiedCatalogItem | null>(null)
  const [configuredDimensions, setConfiguredDimensions] = useState<ConfiguredDimensions | null>(null)
  const [chosenOptions, setChosenOptions] = useState<Record<string, string>>({})
  const [validationResult, setValidationResult] = useState<ValidateResponse | null>(null)
  const [validationLoading, setValidationLoading] = useState(false)
  const [autoCompleteLoading, setAutoCompleteLoading] = useState(false)
  const [autoCompleteResult, setAutoCompleteResult] = useState<AutoCompleteResult | null>(null)
  const [isPreviewPopoutOpen, setIsPreviewPopoutOpen] = useState(false)
  const [showAreasPanel, setShowAreasPanel] = useState(false)
  const [leftSidebarVisible, setLeftSidebarVisible] = useState(true)
  const [rightSidebarVisible, setRightSidebarVisible] = useState(true)
  const [statusBarVisible, setStatusBarVisible] = useState(true)
  const [selectedAlternativeId, setSelectedAlternativeId] = useState<string | null>(null)
  const [gltfExportLoading, setGltfExportLoading] = useState(false)
  const [safeEditMode, setSafeEditMode] = useState(false)
  const [cameraPresets, setCameraPresets] = useState<CameraPreset[]>([])
  const [activeCameraPresetId, setActiveCameraPresetId] = useState<string | null>(null)
  const [cameraPresetLoading, setCameraPresetLoading] = useState(false)
  const [cameraPresetSaving, setCameraPresetSaving] = useState(false)
  const [autoDollhouseSettings, setAutoDollhouseSettings] = useState<AutoDollhouseSettings | null>(null)
  const [autoDollhouseSaving, setAutoDollhouseSaving] = useState(false)
  const [acousticEnabled, setAcousticEnabled] = useState(false)
  const [acousticOpacityPct, setAcousticOpacityPct] = useState(50)
  const [acousticVariable, setAcousticVariable] = useState<'spl_db' | 'spl_dba' | 't20_s' | 'sti'>('spl_db')
  const [acousticGrids, setAcousticGrids] = useState<AcousticGridMeta[]>([])
  const [activeAcousticGridId, setActiveAcousticGridId] = useState<string | null>(null)
  const [acousticGrid, setAcousticGrid] = useState<GeoJsonGrid | null>(null)
  const [acousticBusy, setAcousticBusy] = useState(false)
  const [acousticMin, setAcousticMin] = useState<number | null>(null)
  const [acousticMax, setAcousticMax] = useState<number | null>(null)
  const [activeLayoutSheetId, setActiveLayoutSheetId] = useState<string | null>(null)
  const [moreMenuOpen, setMoreMenuOpen] = useState(false)
  const [shortcutFeedback, setShortcutFeedback] = useState<string | null>(null)
  const [presentationEnabled, setPresentationEnabled] = useState(false)
  const [tenantPlugins, setTenantPlugins] = useState<TenantPluginsResponse | null>(null)
  const [daylightEnabled, setDaylightEnabled] = useState(false)
  const [daylightPanelOpen, setDaylightPanelOpen] = useState(false)
  const [renderEnvironmentPanelOpen, setRenderEnvironmentPanelOpen] = useState(false)
  const [renderEnvironmentSettings, setRenderEnvironmentSettings] = useState<RenderEnvironmentSettings>(
    DEFAULT_RENDER_ENVIRONMENT_SETTINGS,
  )
  const [renderEnvironmentPresets, setRenderEnvironmentPresets] = useState<RenderEnvironmentPreset[]>(
    RENDER_ENVIRONMENT_PRESETS,
  )
  const [renderEnvironmentSaving, setRenderEnvironmentSaving] = useState(false)
  const [screenshotPanelOpen, setScreenshotPanelOpen] = useState(false)
  const [screenshotOptions, setScreenshotOptions] = useState<ScreenshotOptions>(DEFAULT_SCREENSHOT_OPTIONS)
  const [screenshotBusy, setScreenshotBusy] = useState(false)
  const [screenshotMessage, setScreenshotMessage] = useState<string | null>(null)
  const [screenshotError, setScreenshotError] = useState(false)
  const [export360Busy, setExport360Busy] = useState(false)
  const [export360Status, setExport360Status] = useState<string | null>(null)
  const [materialsEnabled, setMaterialsEnabled] = useState(false)
  const [materialPanelOpen, setMaterialPanelOpen] = useState(false)
  const [stairsEnabled, setStairsEnabled] = useState(false)
  const [multilevelDocsEnabled, setMultilevelDocsEnabled] = useState(false)
  const [verticalConnections, setVerticalConnections] = useState<VerticalConnection[]>([])
  const [sectionLines, setSectionLines] = useState<SectionLine[]>([])
  const [selectedSectionLineId, setSelectedSectionLineId] = useState<string | null>(null)
  const [projectElevations, setProjectElevations] = useState<ProjectElevationEntry[]>([])
  const [selectedElevationWallIndex, setSelectedElevationWallIndex] = useState<number>(0)
  const [elevationSvg, setElevationSvg] = useState<string>('')
  const [elevationLoading, setElevationLoading] = useState(false)
  const [sectionView, setSectionView] = useState<SectionViewResponse | null>(null)
  const [sectionViewLoading, setSectionViewLoading] = useState(false)
  const [sectionViewError, setSectionViewError] = useState<string | null>(null)
  const [sectionViewConfigDraft, setSectionViewConfigDraft] = useState<SectionViewConfig | null>(null)
  const [sectionViewSaving, setSectionViewSaving] = useState(false)
  const [projectEnvironment, setProjectEnvironment] = useState<ProjectEnvironment | null>(null)
  const [sunPreview, setSunPreview] = useState<SunPreview | null>(null)
  const [daylightSaving, setDaylightSaving] = useState(false)
  const [sunPreviewLoading, setSunPreviewLoading] = useState(false)
  const moreMenuRef = useRef<HTMLDivElement | null>(null)
  const sectionMenuRef = useRef<HTMLDivElement | null>(null)
  const toolboxMenuRef = useRef<HTMLDivElement | null>(null)
  const navigationPanelRef = useRef<HTMLDivElement | null>(null)
  const cameraPresetPanelRef = useRef<HTMLDivElement | null>(null)
  const screenshotPanelRef = useRef<HTMLDivElement | null>(null)
  const captureRootRef = useRef<HTMLDivElement | null>(null)
  const cameraPresetAutoAppliedRef = useRef(false)
  const splitContainerRef = useRef<HTMLDivElement | null>(null)
  const centeredVisitorRoomIdRef = useRef<string | null>(null)

  // Editor-State nach oben gehoben, damit RightSidebar darauf zugreifen kann
  const editor = usePolygonEditor()
  const editorMode = useEditorModeStore({ currentTool: editor.state.tool, setEditorTool: editor.setTool })
  const workflow = useWorkflowStateStore({ initialStep: 'walls' })
  const { resetToSelection } = editorMode
  const editorWithMode = useMemo(() => ({
    ...editor,
    setTool: editorMode.setTool,
  }), [editor, editorMode.setTool])
  const [edgeLengthPreviewMm, setEdgeLengthPreviewMm] = useState<number | null>(null)

  useEffect(() => {
    editorMode.setMode(getEditorModeForWorkflowStep(workflow.step))
  }, [editorMode.setMode, workflow.step])

  // Stabiler Ref auf selectedRoom/openings (kein stale closure in Callbacks)
  const selectedRoomRef = useRef<RoomPayload | null>(null)
  const openingsRef = useRef<Opening[]>(openings)
  const placementsRef = useRef<Placement[]>(placements)
  openingsRef.current = openings
  placementsRef.current = placements

  useEffect(() => {
    if (!id) return
    Promise.all([
      projectsApi.get(id),
      projectsApi.lockState(id).catch(() => ({
        project_id: id,
        locked: false,
        alternative_id: null,
        locked_by_user: null,
        locked_by_host: null,
        locked_at: null,
      })),
    ])
      .then(([p, lockState]) => {
        setProject(p)
        setProjectLockState(lockState)
        setSelectedRoomId(p.rooms[0]?.id ?? null)
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    if (!id) return

    let active = true
    levelsApi.list(id)
      .then((projectLevels) => {
        if (!active) return
        const orderedLevels = [...projectLevels].sort((left, right) => left.order_index - right.order_index)
        setLevels(orderedLevels)
        setActiveLevelId((previous) => {
          if (previous && orderedLevels.some((level) => level.id === previous)) {
            return previous
          }
          return orderedLevels[0]?.id ?? null
        })
      })
      .catch(() => {
        if (!active) return
        setLevels([])
        setActiveLevelId(null)
      })

    return () => {
      active = false
    }
  }, [id])

  useEffect(() => {
    if (!project) {
      return
    }

    const roomsOnLevel = activeLevelId
      ? project.rooms.filter((room) => room.level_id === activeLevelId)
      : project.rooms

    if (roomsOnLevel.length === 0) {
      setSelectedRoomId(null)
      return
    }

    if (!selectedRoomId || !roomsOnLevel.some((room) => room.id === selectedRoomId)) {
      setSelectedRoomId(roomsOnLevel[0]?.id ?? null)
    }
  }, [project, activeLevelId, selectedRoomId])

  useEffect(() => {
    let active = true

    getTenantPlugins()
      .then((result) => {
        if (!active) return
        setTenantPlugins(result)
        setPresentationEnabled(result.enabled.includes('presentation'))
        setDaylightEnabled(result.enabled.includes('daylight'))
        setMaterialsEnabled(result.enabled.includes('materials'))
        setStairsEnabled(result.enabled.includes('stairs'))
        setMultilevelDocsEnabled(result.enabled.includes('multilevel-docs'))
      })
      .catch(() => {
        if (!active) return
        setTenantPlugins(null)
        setPresentationEnabled(false)
        setDaylightEnabled(false)
        setMaterialsEnabled(false)
        setStairsEnabled(false)
        setMultilevelDocsEnabled(false)
      })

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!id || !stairsEnabled) {
      setVerticalConnections([])
      return
    }

    let active = true
    verticalConnectionsApi.list(id)
      .then((items) => {
        if (!active) return
        setVerticalConnections(items)
      })
      .catch(() => {
        if (!active) return
        setVerticalConnections([])
      })

    return () => {
      active = false
    }
  }, [id, stairsEnabled])

  useEffect(() => {
    if (!id) {
      setAutoDollhouseSettings(null)
      return
    }

    let active = true
    visibilityApi.getAutoDollhouse(id)
      .then((settings) => {
        if (!active) return
        setAutoDollhouseSettings(settings)
      })
      .catch(() => {
        if (!active) return
        setAutoDollhouseSettings({
          project_id: id,
          enabled: false,
          alpha_front_walls: 0.32,
          distance_threshold: 2400,
          angle_threshold_deg: 35,
        })
      })

    return () => {
      active = false
    }
  }, [id])

  useEffect(() => {
    if (!id) {
      setRenderEnvironmentPanelOpen(false)
      setRenderEnvironmentSettings(DEFAULT_RENDER_ENVIRONMENT_SETTINGS)
      setRenderEnvironmentPresets(RENDER_ENVIRONMENT_PRESETS)
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
    if (!selectedRoomId || !multilevelDocsEnabled) {
      setSectionLines([])
      setSelectedSectionLineId(null)
      return
    }

    let active = true
    annotationsApi.listSections(selectedRoomId)
      .then((items) => {
        if (!active) return
        setSectionLines(items)
        setSelectedSectionLineId((previous) => (
          previous && items.some((entry) => entry.id === previous)
            ? previous
            : null
        ))
      })
      .catch(() => {
        if (!active) return
        setSectionLines([])
        setSelectedSectionLineId(null)
      })

    return () => {
      active = false
    }
  }, [selectedRoomId, multilevelDocsEnabled])

  const refreshSunPreview = useCallback(async (projectId: string, env: ProjectEnvironment | null) => {
    if (!env) return

    setSunPreviewLoading(true)
    try {
      const preview = await projectEnvironmentApi.sunPreview(projectId, {
        ...(env.default_datetime ? { datetime: env.default_datetime } : {}),
        ...(env.latitude != null ? { latitude: env.latitude } : {}),
        ...(env.longitude != null ? { longitude: env.longitude } : {}),
        north_angle_deg: env.north_angle_deg,
      })
      setSunPreview(preview)
    } catch {
      setSunPreview(null)
    } finally {
      setSunPreviewLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!id || !daylightEnabled) {
      setProjectEnvironment(null)
      setSunPreview(null)
      setDaylightPanelOpen(false)
      return
    }

    let active = true

    projectEnvironmentApi.get(id)
      .then(async (environment) => {
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
        setProjectEnvironment(null)
        setSunPreview(null)
      })

    return () => {
      active = false
    }
  }, [daylightEnabled, id, refreshSunPreview])

  useEffect(() => {
    if (!materialsEnabled) {
      setMaterialPanelOpen(false)
    }
  }, [materialsEnabled])

  const handleDaylightPatch = useCallback((patch: Partial<ProjectEnvironment>) => {
    setProjectEnvironment((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        ...patch,
      }
    })
  }, [])

  const handleRenderEnvironmentChange = useCallback((next: RenderEnvironmentSettings) => {
    setRenderEnvironmentSettings(normalizeRenderEnvironmentSettings(next))
  }, [])

  const handleSaveRenderEnvironment = useCallback(() => {
    if (!id) {
      return
    }

    setRenderEnvironmentSaving(true)
    void renderEnvironmentApi.update(id, renderEnvironmentSettings)
      .then((result) => {
        setRenderEnvironmentPresets(result.presets.length > 0 ? result.presets : RENDER_ENVIRONMENT_PRESETS)
        setRenderEnvironmentSettings(normalizeRenderEnvironmentSettings(result.active))
      })
      .catch((saveError: Error) => {
        console.error('S107: Render-Umgebung konnte nicht gespeichert werden:', saveError)
      })
      .finally(() => {
        setRenderEnvironmentSaving(false)
      })
  }, [id, renderEnvironmentSettings])

  const resolveScreenshotViewMode = useCallback((): ScreenshotViewMode => {
    const effective = compactLayout && viewMode === 'split' ? '2d' : viewMode
    if (effective === '3d') {
      return '3d'
    }
    if (effective === 'split') {
      return 'split'
    }
    return '2d'
  }, [compactLayout, viewMode])

  const handleCaptureScreenshot = useCallback(async () => {
    if (!id) {
      return
    }

    const captureRoot = captureRootRef.current
    if (!captureRoot) {
      setScreenshotError(true)
      setScreenshotMessage('Screenshot fehlgeschlagen: kein aktiver Viewport gefunden')
      return
    }

    setScreenshotBusy(true)
    setScreenshotError(false)
    setScreenshotMessage(null)

    try {
      const mode = resolveScreenshotViewMode()
      const normalizedOptions = normalizeScreenshotOptions(screenshotOptions)
      const capture = captureScreenshotFromRoot(captureRoot, mode, normalizedOptions)
      const extension = normalizedOptions.format === 'jpeg' ? 'jpg' : 'png'

      const result = await mediaCaptureApi.uploadScreenshot(id, {
        ...capture,
        filename: `screenshot-${Date.now()}.${extension}`,
        view_mode: mode,
        transparent_background: normalizedOptions.transparent_background,
        uploaded_by: 'planner-frontend',
      })

      setScreenshotMessage(`Screenshot gespeichert: ${result.filename}`)
      if (result.preview_url) {
        window.open(result.preview_url, '_blank', 'noopener,noreferrer')
      }
    } catch (captureError) {
      setScreenshotError(true)
      setScreenshotMessage(`Screenshot fehlgeschlagen: ${String(captureError)}`)
    } finally {
      setScreenshotBusy(false)
    }
  }, [id, resolveScreenshotViewMode, screenshotOptions])

  const handleStartExport360 = useCallback(async () => {
    if (!id) {
      return
    }

    setExport360Busy(true)
    setScreenshotError(false)
    setExport360Status('360-Export wird gestartet...')

    try {
      const normalizedOptions = normalizeScreenshotOptions(screenshotOptions)
      const request = await mediaCaptureApi.createExport360(id, {
        format: normalizedOptions.format,
        quality: normalizedOptions.quality,
        width_px: normalizedOptions.width_px ?? 4096,
        height_px: normalizedOptions.height_px ?? 2048,
        environment: renderEnvironmentSettings,
      })

      for (let attempt = 0; attempt < 45; attempt += 1) {
        const status = await mediaCaptureApi.getExport360Status(id, request.job_id)
        setExport360Status(`360-Status: ${status.status}`)

        if (status.status === 'done') {
          if (status.download_url) {
            window.open(status.download_url, '_blank', 'noopener,noreferrer')
            setScreenshotMessage('360-Export abgeschlossen und geoeffnet')
          } else {
            setScreenshotMessage('360-Export abgeschlossen (kein Download-Link)')
          }
          return
        }

        if (status.status === 'failed') {
          throw new Error(status.error_message ?? '360-Export fehlgeschlagen')
        }

        await delay(1000)
      }

      throw new Error('360-Export laeuft noch. Bitte spaeter erneut pruefen.')
    } catch (exportError) {
      setScreenshotError(true)
      setScreenshotMessage(`360-Export fehlgeschlagen: ${String(exportError)}`)
    } finally {
      setExport360Busy(false)
    }
  }, [id, renderEnvironmentSettings, screenshotOptions])

  const handleMaterialRoomPatch = useCallback((roomId: string, patch: { coloring: unknown; placements: Placement[] }) => {
    setProject((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        rooms: prev.rooms.map((room) => (
          room.id === roomId
            ? {
                ...room,
                coloring: patch.coloring,
                placements: patch.placements,
              }
            : room
        )),
      }
    })

    if (selectedRoomId === roomId) {
      setPlacements(patch.placements)
    }
  }, [selectedRoomId])

  const handleSaveDaylightEnvironment = useCallback(async () => {
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
      alert(`Tageslicht-Einstellungen konnten nicht gespeichert werden: ${String(saveError)}`)
    } finally {
      setDaylightSaving(false)
    }
  }, [id, projectEnvironment, refreshSunPreview])

  const handleRefreshSunPreview = useCallback(async () => {
    if (!id || !projectEnvironment) return
    await refreshSunPreview(id, projectEnvironment)
  }, [id, projectEnvironment, refreshSunPreview])

  const refreshAcousticGrids = useCallback(async () => {
    if (!id) {
      return
    }

    const grids = await acousticsApi.listGrids(id)
    setAcousticGrids(grids)

    setActiveAcousticGridId((current) => {
      if (current && grids.some((grid) => grid.id === current)) {
        return current
      }

      const variableMatch = grids.find((grid) => grid.variable === acousticVariable)
      return variableMatch?.id ?? grids[0]?.id ?? null
    })
  }, [id, acousticVariable])

  useEffect(() => {
    if (!id) {
      return
    }

    refreshAcousticGrids().catch((error: unknown) => {
      console.error('Akustik-Grids laden fehlgeschlagen:', error)
    })
  }, [id, refreshAcousticGrids])

  useEffect(() => {
    const match = acousticGrids.find((grid) => grid.id === activeAcousticGridId)
    if (!match) {
      return
    }

    setAcousticVariable(match.variable)
  }, [activeAcousticGridId, acousticGrids])

  useEffect(() => {
    if (!activeAcousticGridId || !acousticEnabled) {
      setAcousticGrid(null)
      setAcousticMin(null)
      setAcousticMax(null)
      return
    }

    acousticsApi.getTiles(activeAcousticGridId)
      .then((grid) => {
        setAcousticGrid(grid)
        setAcousticMin(grid.min)
        setAcousticMax(grid.max)
      })
      .catch((error: unknown) => {
        console.error('Akustik-Kacheln laden fehlgeschlagen:', error)
        setAcousticGrid(null)
        setAcousticMin(null)
        setAcousticMax(null)
      })
  }, [activeAcousticGridId, acousticEnabled])

  const handleAcousticUpload = useCallback(async (file: File) => {
    if (!id) {
      return
    }

    setAcousticBusy(true)
    try {
      const result = await acousticsApi.importCnivg(id, file)
      await refreshAcousticGrids()
      setActiveAcousticGridId(result.grid_id)
      setAcousticEnabled(true)
    } catch (error) {
      alert(`Akustik-Import fehlgeschlagen: ${String(error)}`)
    } finally {
      setAcousticBusy(false)
    }
  }, [id, refreshAcousticGrids])

  const handleDeleteAcousticGrid = useCallback(async (gridId: string) => {
    if (!id) {
      return
    }

    setAcousticBusy(true)
    try {
      await acousticsApi.deleteGrid(gridId)
      if (activeAcousticGridId === gridId) {
        setActiveAcousticGridId(null)
      }
      await refreshAcousticGrids()
    } catch (error) {
      alert(`Akustik-Grid löschen fehlgeschlagen: ${String(error)}`)
    } finally {
      setAcousticBusy(false)
    }
  }, [id, activeAcousticGridId, refreshAcousticGrids])

  const handleSetAcousticVariable = useCallback((variable: 'spl_db' | 'spl_dba' | 't20_s' | 'sti') => {
    setAcousticVariable(variable)
    const match = acousticGrids.find((grid) => grid.variable === variable)
    if (match) {
      setActiveAcousticGridId(match.id)
    }
  }, [acousticGrids])

  // Close "Mehr" flyout on outside click
  useEffect(() => {
    if (!moreMenuOpen) return
    function handleOutsideClick(e: MouseEvent) {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setMoreMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [moreMenuOpen])

  useEffect(() => {
    if (!sectionMenuOpen) return
    function handleOutsideClick(e: MouseEvent) {
      if (sectionMenuRef.current && !sectionMenuRef.current.contains(e.target as Node)) {
        setSectionMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [sectionMenuOpen])

  useEffect(() => {
    if (!toolboxMenuOpen) return
    function handleOutsideClick(e: MouseEvent) {
      if (toolboxMenuRef.current && !toolboxMenuRef.current.contains(e.target as Node)) {
        setToolboxMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [toolboxMenuOpen])

  useEffect(() => {
    if (!navigationPanelOpen) return
    function handleOutsideClick(event: MouseEvent) {
      if (navigationPanelRef.current && !navigationPanelRef.current.contains(event.target as Node)) {
        setNavigationPanelOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [navigationPanelOpen])

  useEffect(() => {
    if (!cameraPresetPanelOpen) return
    function handleOutsideClick(event: MouseEvent) {
      if (cameraPresetPanelRef.current && !cameraPresetPanelRef.current.contains(event.target as Node)) {
        setCameraPresetPanelOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [cameraPresetPanelOpen])

  useEffect(() => {
    if (!screenshotPanelOpen) return
    function handleOutsideClick(event: MouseEvent) {
      if (screenshotPanelRef.current && !screenshotPanelRef.current.contains(event.target as Node)) {
        setScreenshotPanelOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [screenshotPanelOpen])

  useEffect(() => {
    const onResize = () => {
      setCompactLayout(window.innerWidth < 1180)
    }
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    if (!id) {
      return
    }

    const saved = loadPlannerViewSettings(id)
    if (!saved) {
      return
    }

    setViewMode(saved.mode)
    setSplitRatio(saved.split_ratio)
    setShowVirtualVisitor(saved.visitor_visible)
    setCameraHeightMm(saved.camera_height_mm)
    setNavigationSettings(resolveNavigationSettings(saved))
    setCameraState((prev) => ({
      ...prev,
      camera_height_mm: saved.camera_height_mm,
    }))
  }, [id])

  useEffect(() => {
    if (!id) {
      return
    }

    savePlannerViewSettings(id, {
      mode: viewMode,
      split_ratio: splitRatio,
      visitor_visible: showVirtualVisitor,
      camera_height_mm: cameraHeightMm,
      ...navigationSettings,
    })
  }, [id, viewMode, splitRatio, showVirtualVisitor, cameraHeightMm, navigationSettings])

  useEffect(() => {
    let active = true
    getTenantSettings()
      .then((settings) => {
        if (!active) return
        setNavigationSettings((current) => resolveNavigationSettings({
          ...(current ?? {}),
          ...settings,
        }))
      })
      .catch(() => {
        // optional
      })

    return () => {
      active = false
    }
  }, [])

  const handleNavigationSettingsChange = useCallback((next: NavigationSettings) => {
    setNavigationSettings(next)
    void updateTenantSettings({
      navigation_profile: next.navigation_profile,
      invert_y_axis: next.invert_y_axis,
      middle_mouse_pan: next.middle_mouse_pan,
      touchpad_mode: next.touchpad_mode,
      zoom_direction: next.zoom_direction,
    }).catch(() => {
      // keep local persistence as fallback
    })
  }, [])

  const actionContext = useMemo<EditorActionContext>(() => ({
    hasProjectId: Boolean(id),
    compactLayout,
    hasSelectedRoom: Boolean(selectedRoomId),
    hasSelectedSectionLine: Boolean(selectedSectionLineId),
    hasSelectedAlternative: Boolean(selectedAlternativeId),
    presentationEnabled,
    daylightEnabled,
    hasProjectEnvironment: Boolean(projectEnvironment),
    materialsEnabled,
    autoCompleteLoading,
    previewPopoutOpen: isPreviewPopoutOpen,
    gltfExportLoading,
    bulkDeliveredLoading,
    screenshotBusy,
    export360Busy,
  }), [
    autoCompleteLoading,
    bulkDeliveredLoading,
    compactLayout,
    daylightEnabled,
    export360Busy,
    gltfExportLoading,
    id,
    isPreviewPopoutOpen,
    materialsEnabled,
    presentationEnabled,
    projectEnvironment,
    screenshotBusy,
    selectedAlternativeId,
    selectedRoomId,
    selectedSectionLineId,
  ])

  const actionStates = useMemo(() => resolveEditorActionStates(actionContext), [actionContext])

  const sidebarPluginSlots = useMemo(() => {
    if (!tenantPlugins) {
      return []
    }

    return resolvePluginSlotEntries({
      slot: 'sidebar',
      projectId: id ?? null,
      availablePlugins: tenantPlugins.available,
      enabledPluginIds: tenantPlugins.enabled,
    })
  }, [id, tenantPlugins])

  useEffect(() => {
    if (!shortcutFeedback) {
      return
    }

    const timer = window.setTimeout(() => {
      setShortcutFeedback(null)
    }, 2200)

    return () => {
      window.clearTimeout(timer)
    }
  }, [shortcutFeedback])

  useEffect(() => {
    function handleViewModeShortcuts(event: globalThis.KeyboardEvent) {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement) {
        return
      }
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
        return
      }

      const reasonByShortcut: Partial<Record<'2' | '4' | '5', string | undefined>> = {
        '2': actionStates.viewSplit.reasonIfDisabled,
        '4': actionStates.viewElevation.reasonIfDisabled,
        '5': actionStates.viewSection.reasonIfDisabled,
      }

      if ((event.key === '2' || event.key === '4' || event.key === '5') && reasonByShortcut[event.key as '2' | '4' | '5']) {
        setShortcutFeedback(reasonByShortcut[event.key as '2' | '4' | '5'] ?? null)
      }

      const nextMode = resolveViewModeShortcut(event.key, actionStates)
      if (!nextMode) {
        return
      }

      event.preventDefault()
      setShortcutFeedback(null)
      setViewMode(nextMode)
    }

    window.addEventListener('keydown', handleViewModeShortcuts)
    return () => window.removeEventListener('keydown', handleViewModeShortcuts)
  }, [actionStates])

  useEffect(() => {
    if (!appShellBridge) {
      return
    }

    appShellBridge.setEditorBridgeState({
      workflowStep: workflow.step,
      modeLabel: editorMode.modeLabel,
      canGoNext: workflow.canGoNext,
      canGoPrevious: workflow.canGoPrevious,
      goToNextStep: workflow.goToNextStep,
      goToPreviousStep: workflow.goToPreviousStep,
      actionStates,
      tenantPlugins,
    })
  }, [
    actionStates,
    appShellBridge,
    editorMode.modeLabel,
    tenantPlugins,
    workflow.canGoNext,
    workflow.canGoPrevious,
    workflow.goToNextStep,
    workflow.goToPreviousStep,
    workflow.step,
  ])

  useEffect(() => {
    return () => {
      appShellBridge?.setEditorBridgeState(null)
    }
  }, [appShellBridge])

  useEffect(() => {
    setCameraState((prev) => ({
      ...prev,
      camera_height_mm: cameraHeightMm,
    }))
  }, [cameraHeightMm])

  useEffect(() => {
    if (!splitDragging) {
      return
    }

    const handlePointerMove = (event: MouseEvent) => {
      const host = splitContainerRef.current
      if (!host) {
        return
      }
      const rect = host.getBoundingClientRect()
      const ratio = ((event.clientX - rect.left) / rect.width) * 100
      setSplitRatio(clampNumber(ratio, 25, 75))
    }

    const handlePointerUp = () => {
      setSplitDragging(false)
    }

    window.addEventListener('mousemove', handlePointerMove)
    window.addEventListener('mouseup', handlePointerUp)
    return () => {
      window.removeEventListener('mousemove', handlePointerMove)
      window.removeEventListener('mouseup', handlePointerUp)
    }
  }, [splitDragging])

  useEffect(() => {
    if (!splitContainerRef.current) {
      return
    }
    splitContainerRef.current.style.setProperty('--split-left', `${splitRatio}%`)
  }, [splitRatio, viewMode])

  useEffect(() => {
    if (!id) return
    areasApi.list(id)
      .then((areas) => {
        const allAlternatives = areas.flatMap((area) => area.alternatives)
        const preferred = allAlternatives.find((alternative) => alternative.is_active) ?? allAlternatives[0] ?? null
        setSelectedAlternativeId(preferred?.id ?? null)
      })
      .catch(() => {
        setSelectedAlternativeId(null)
      })
  }, [id])

  useEffect(() => {
    setBulkDeliveredMessage(null)
    setBulkDeliveredError(false)
  }, [selectedAlternativeId])

  useEffect(() => {
    if (!id) {
      setDrawingGroups([])
      setSelectedDrawingGroupId(null)
      return
    }

    let active = true
    drawingGroupsApi.list(id)
      .then((groups) => {
        if (!active) {
          return
        }
        setDrawingGroups(groups)
        setSelectedDrawingGroupId((previous) => (
          previous && groups.some((group) => group.id === previous) ? previous : null
        ))
      })
      .catch(() => {
        if (!active) {
          return
        }
        setDrawingGroups([])
        setSelectedDrawingGroupId(null)
      })

    return () => {
      active = false
    }
  }, [id])

  // Editor-Vertices + Öffnungen neu laden wenn Raum wechselt
  useEffect(() => {
    setSelectedOpeningId(null)
    setSelectedPlacementId(null)
    if (!project || !selectedRoomId) {
      editor.reset()
      setOpenings([])
      setPlacements([])
      setDimensions([])
      setCenterlines([])
      return
    }
    const room = project.rooms.find(r => r.id === selectedRoomId)
    const boundary = (room?.boundary as RoomBoundaryPayload | undefined)
    const verts = (boundary?.vertices ?? []) as Vertex[]
    const wallIds = (boundary?.wall_segments ?? []).map((segment) => segment.id)
    if (verts.length >= 3) {
      editor.loadBoundary(verts, wallIds.length === verts.length ? wallIds : undefined)
    } else {
      editor.reset()
    }
    editor.setReferenceImage(parseReferenceImage((room as unknown as RoomPayload | undefined)?.reference_image))
    // Öffnungen aus room.openings laden (JSONB, bereits im room-Objekt)
    setOpenings((room?.openings as unknown as Opening[]) ?? [])
    setPlacements((room?.placements as unknown as Placement[]) ?? [])

    let cancelled = false
    dimensionsApi.list(selectedRoomId)
      .then((items) => {
        if (!cancelled) setDimensions(items)
      })
      .catch(() => {
        if (!cancelled) setDimensions([])
      })

    centerlinesApi.list(selectedRoomId)
      .then((items) => {
        if (!cancelled) setCenterlines(items)
      })
      .catch(() => {
        if (!cancelled) setCenterlines([])
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRoomId])

  const handleCreateLevel = useCallback(async (payload: { name: string; elevation_mm: number }) => {
    if (!id) {
      return
    }

    const created = await levelsApi.create(id, payload)
    setLevels((previous) => [...previous, created].sort((left, right) => left.order_index - right.order_index))
    setActiveLevelId(created.id)
  }, [id])

  const handleToggleLevelVisibility = useCallback((level: BuildingLevel) => {
    levelsApi.update(level.id, { visible: !level.visible })
      .then((updated) => {
        setLevels((previous) => {
          const next = previous.map((entry) => (entry.id === updated.id ? updated : entry))
          return next.sort((left, right) => left.order_index - right.order_index)
        })

        if (!updated.visible && activeLevelId === updated.id) {
          setActiveLevelId((previousLevelId) => {
            if (previousLevelId !== updated.id) {
              return previousLevelId
            }
            const fallback = levels.find((entry) => entry.id !== updated.id && entry.visible)
            return fallback?.id ?? null
          })
        }
      })
      .catch((toggleError: Error) => {
        console.error('Ebene-Sichtbarkeit konnte nicht gespeichert werden:', toggleError)
      })
  }, [activeLevelId, levels])

  const handleSetActiveLevelVisibility = useCallback((next: boolean) => {
    if (!id || !activeLevelId) {
      return
    }

    void visibilityApi.applyVisibility(id, {
      levels: [{ level_id: activeLevelId, visible: next }],
    })
      .then(() => {
        setLevels((previous) => {
          const updated = previous
            .map((entry) => (entry.id === activeLevelId ? { ...entry, visible: next } : entry))
            .sort((left, right) => left.order_index - right.order_index)

          if (!next) {
            const fallback = updated.find((entry) => entry.id !== activeLevelId && entry.visible)
            setActiveLevelId((current) => (current === activeLevelId ? (fallback?.id ?? null) : current))
          }

          return updated
        })
      })
      .catch((visibilityError: Error) => {
        console.error('S88: Ebene-Sichtbarkeit konnte nicht angewendet werden:', visibilityError)
      })
  }, [activeLevelId, id])

  const handleSetDimensionsVisible = useCallback((next: boolean) => {
    if (!id || dimensions.length === 0) {
      return
    }

    void visibilityApi.applyVisibility(id, {
      dimensions: dimensions.map((dimension) => ({
        dimension_id: dimension.id,
        visible: next,
      })),
    })
      .then(() => {
        setDimensions((previous) => previous.map((dimension) => ({ ...dimension, visible: next })))
      })
      .catch((visibilityError: Error) => {
        console.error('S88: Dimensions-Sichtbarkeit konnte nicht angewendet werden:', visibilityError)
      })
  }, [dimensions, id])

  const handleSetPlacementsVisible = useCallback((next: boolean) => {
    if (!id || !selectedRoomId || placements.length === 0) {
      return
    }

    void visibilityApi.applyVisibility(id, {
      placements: placements.map((placement) => ({
        room_id: selectedRoomId,
        placement_id: placement.id,
        visible: next,
      })),
    })
      .then(() => {
        setPlacements((previous) => previous.map((placement) => ({ ...placement, visible: next })))
      })
      .catch((visibilityError: Error) => {
        console.error('S88: Placement-Sichtbarkeit konnte nicht angewendet werden:', visibilityError)
      })
  }, [id, placements, selectedRoomId])

  const handleSetActiveLevelLocked = useCallback((next: boolean) => {
    if (!id || !activeLevelId) {
      return
    }

    void visibilityApi.applyLocks(id, {
      levels: [{
        level_id: activeLevelId,
        locked: next,
        lock_scope: next ? 'manual' : undefined,
      }],
    })
      .then(() => {
        setLevels((previous) => previous.map((entry) => (
          entry.id === activeLevelId
            ? { ...entry, locked: next, lock_scope: next ? 'manual' : null }
            : entry
        )))
      })
      .catch((lockError: Error) => {
        console.error('S88: Level-Lock konnte nicht gesetzt werden:', lockError)
      })
  }, [activeLevelId, id])

  const handleSetDimensionsLocked = useCallback((next: boolean) => {
    if (!id || dimensions.length === 0) {
      return
    }

    void visibilityApi.applyLocks(id, {
      dimensions: dimensions.map((dimension) => ({
        dimension_id: dimension.id,
        locked: next,
        lock_scope: next ? 'manual' : undefined,
      })),
    })
      .then(() => {
        setDimensions((previous) => previous.map((dimension) => ({
          ...dimension,
          locked: next,
          lock_scope: next ? 'manual' : null,
        })))
      })
      .catch((lockError: Error) => {
        console.error('S88: Dimensions-Lock konnte nicht gesetzt werden:', lockError)
      })
  }, [dimensions, id])

  const handleCreateVerticalConnection = useCallback(async (payload: {
    from_level_id: string
    to_level_id: string
    kind: VerticalConnectionKind
    stair_json: Record<string, unknown>
  }) => {
    if (!id) {
      throw new Error('Projektkontext fehlt')
    }

    if (!selectedRoomId || !project) {
      throw new Error('Bitte zuerst einen Raum auswählen')
    }

    const room = project.rooms.find((entry) => entry.id === selectedRoomId)
    if (!room) {
      throw new Error('Ausgewählter Raum nicht gefunden')
    }

    const created = await verticalConnectionsApi.create(id, {
      from_level_id: payload.from_level_id,
      to_level_id: payload.to_level_id,
      kind: payload.kind,
      stair_json: payload.stair_json,
      footprint_json: buildFootprintFromRoom(room as unknown as RoomPayload),
    })

    setVerticalConnections((previous) => [...previous, created].sort((left, right) => left.created_at.localeCompare(right.created_at)))
  }, [id, project, selectedRoomId])

  const handleUpdateVerticalConnection = useCallback(async (connectionId: string, payload: {
    from_level_id: string
    to_level_id: string
    kind: VerticalConnectionKind
    stair_json: Record<string, unknown>
  }) => {
    const updated = await verticalConnectionsApi.update(connectionId, payload)
    setVerticalConnections((previous) => previous.map((entry) => (entry.id === updated.id ? updated : entry)))
  }, [])

  const handleDeleteVerticalConnection = useCallback(async (connectionId: string) => {
    await verticalConnectionsApi.remove(connectionId)
    setVerticalConnections((previous) => previous.filter((entry) => entry.id !== connectionId))
  }, [])

  const handleCreateSectionLine = useCallback(async (payload: {
    label?: string
    depth_mm?: number
    direction: 'left' | 'right' | 'both'
    level_scope: 'room_level' | 'single_level' | 'range' | 'all_levels'
    sheet_visibility: 'all' | 'sheet_only' | 'hidden'
  }) => {
    if (!selectedRoomId || !project) {
      throw new Error('Bitte zuerst einen Raum auswählen')
    }

    const room = project.rooms.find((entry) => entry.id === selectedRoomId)
    if (!room) {
      throw new Error('Ausgewählter Raum nicht gefunden')
    }

    const line = buildDefaultSectionLine(room as unknown as RoomPayload)
    const requestPayload: Record<string, unknown> = {
      ...line,
      ...(payload.label ? { label: payload.label } : {}),
      ...(typeof payload.depth_mm === 'number' ? { depth_mm: payload.depth_mm } : {}),
      direction: payload.direction,
      level_scope: payload.level_scope,
      sheet_visibility: payload.sheet_visibility,
    }

    if (payload.level_scope === 'single_level') {
      if (!activeLevelId) {
        throw new Error('Aktive Ebene fehlt für single_level')
      }
      requestPayload.level_id = activeLevelId
    }

    if (payload.level_scope === 'range') {
      const ordered = [...levels].sort((left, right) => left.order_index - right.order_index)
      const from = ordered[0]?.id
      const to = ordered[ordered.length - 1]?.id
      if (!from || !to || from === to) {
        throw new Error('Für level_scope=range sind mindestens zwei Ebenen erforderlich')
      }
      requestPayload.from_level_id = from
      requestPayload.to_level_id = to
    }

    const created = await annotationsApi.createSection(selectedRoomId, requestPayload as Omit<SectionLine, 'id' | 'room_id'>)
    setSectionLines((previous) => [...previous, created])
    setSelectedSectionLineId(created.id)
  }, [activeLevelId, levels, project, selectedRoomId])

  const handleUpdateSectionLine = useCallback(async (sectionId: string, patch: {
    label?: string
    depth_mm?: number
    direction: 'left' | 'right' | 'both'
    level_scope: 'room_level' | 'single_level' | 'range' | 'all_levels'
    sheet_visibility: 'all' | 'sheet_only' | 'hidden'
  }) => {
    if (!selectedRoomId) {
      throw new Error('Bitte zuerst einen Raum auswählen')
    }

    const requestPatch: Record<string, unknown> = {
      ...(patch.label ? { label: patch.label } : { label: '' }),
      ...(typeof patch.depth_mm === 'number' ? { depth_mm: patch.depth_mm } : {}),
      direction: patch.direction,
      level_scope: patch.level_scope,
      sheet_visibility: patch.sheet_visibility,
      level_id: null,
      from_level_id: null,
      to_level_id: null,
    }

    if (patch.level_scope === 'single_level') {
      if (!activeLevelId) {
        throw new Error('Aktive Ebene fehlt für single_level')
      }
      requestPatch.level_id = activeLevelId
    }

    if (patch.level_scope === 'range') {
      const ordered = [...levels].sort((left, right) => left.order_index - right.order_index)
      const from = ordered[0]?.id
      const to = ordered[ordered.length - 1]?.id
      if (!from || !to || from === to) {
        throw new Error('Für level_scope=range sind mindestens zwei Ebenen erforderlich')
      }
      requestPatch.from_level_id = from
      requestPatch.to_level_id = to
    }

    const updated = await annotationsApi.updateSection(selectedRoomId, sectionId, requestPatch as Partial<Omit<SectionLine, 'id' | 'room_id'>>)
    setSectionLines((previous) => previous.map((entry) => (entry.id === updated.id ? updated : entry)))
  }, [activeLevelId, levels, selectedRoomId])

  const handleSaveSectionViewConfig = useCallback(async () => {
    if (!selectedRoomId || !selectedSectionLineId || !sectionViewConfigDraft) {
      return
    }

    setSectionViewSaving(true)
    try {
      const updated = await annotationsApi.updateSection(selectedRoomId, selectedSectionLineId, {
        view_config: sectionViewConfigDraft,
      } as Partial<Omit<SectionLine, 'id' | 'room_id'>>)

      setSectionLines((previous) => previous.map((entry) => (entry.id === updated.id ? updated : entry)))
      setSectionView((previous) => (previous
        ? {
            ...previous,
            section: updated,
            view_config: sectionViewConfigDraft,
          }
        : previous))
    } finally {
      setSectionViewSaving(false)
    }
  }, [selectedRoomId, selectedSectionLineId, sectionViewConfigDraft])

  const handleDeleteSectionLine = useCallback(async (sectionId: string) => {
    if (!selectedRoomId) {
      throw new Error('Bitte zuerst einen Raum auswählen')
    }

    await annotationsApi.deleteSectionLine(selectedRoomId, sectionId)
    setSectionLines((previous) => previous.filter((entry) => entry.id !== sectionId))
    setSelectedSectionLineId((previous) => (previous === sectionId ? null : previous))
  }, [selectedRoomId])

  // Raum anlegen (Name kommt aus dem Inline-Formular der LeftSidebar)
  const handleAddRoom = useCallback(async (name: string) => {
    if (!project) return
    const targetLevelId = activeLevelId ?? levels[0]?.id ?? undefined
    const newRoom = await roomsApi.create({
      project_id: project.id,
      ...(targetLevelId ? { level_id: targetLevelId } : {}),
      name,
      boundary: { vertices: [], wall_segments: [] },
    })
    setProject(prev => prev ? { ...prev, rooms: [...prev.rooms, newRoom as unknown as ProjectDetail['rooms'][0]] } : prev)
    setSelectedRoomId(newRoom.id)
    resetToSelection()
  }, [project, activeLevelId, levels, resetToSelection])

  // Raum nach Boundary-Update aktualisieren
  const handleRoomUpdated = useCallback((updated: RoomPayload) => {
    selectedRoomRef.current = updated
    setProject(prev => {
      if (!prev) return prev
      return {
        ...prev,
        rooms: prev.rooms.map(r => r.id === updated.id ? updated as unknown as typeof r : r),
      }
    })
  }, [])

  // Öffnungen speichern
  const handleSaveOpenings = useCallback(async (newOpenings: Opening[]) => {
    if (!selectedRoomRef.current) return
    try {
      const saved = await openingsApi.save(selectedRoomRef.current.id, newOpenings)
      setOpenings(saved)
    } catch (e) {
      console.error('Öffnungen speichern fehlgeschlagen:', e)
    }
  }, [])

  // Öffnung hinzufügen (wird vom Canvas aufgerufen wenn Wand ausgewählt)
  const handleAddOpening = useCallback((wallId: string, wallLengthMm: number) => {
    const defaultWidth = Math.min(900, wallLengthMm)
    const offset = Math.max(0, Math.round((wallLengthMm - defaultWidth) / 2))
    const newOpening = normalizeOpeningForMultiview({
      id: crypto.randomUUID(),
      wall_id: wallId,
      type: 'door',
      offset_mm: offset,
      width_mm: defaultWidth,
      height_mm: 2100,
      sill_height_mm: 0,
      source: 'manual',
    })
    const updated = [...openingsRef.current, newOpening]
    setOpenings(updated)
    setSelectedOpeningId(newOpening.id)
    handleSaveOpenings(updated)
    resetToSelection()
  }, [handleSaveOpenings, resetToSelection])

  // Öffnung aktualisieren
  const handleUpdateOpening = useCallback((updated: Opening) => {
    const normalized = normalizeOpeningForMultiview(updated)
    const newOpenings = openingsRef.current.map(o => o.id === normalized.id ? normalized : o)
    setOpenings(newOpenings)
    handleSaveOpenings(newOpenings)
  }, [handleSaveOpenings])

  // Öffnung löschen
  const handleDeleteOpening = useCallback((openingId: string) => {
    const newOpenings = openingsRef.current.filter(o => o.id !== openingId)
    setOpenings(newOpenings)
    setSelectedOpeningId(prev => prev === openingId ? null : prev)
    handleSaveOpenings(newOpenings)
  }, [handleSaveOpenings])

  const handleSavePlacements = useCallback(async (newPlacements: Placement[]) => {
    if (!selectedRoomRef.current) return
    try {
      const saved = await placementsApi.save(selectedRoomRef.current.id, newPlacements)
      setPlacements(saved)
    } catch (e) {
      console.error('Platzierungen speichern fehlgeschlagen:', e)
    }
  }, [])

  const handleBoundaryTopologyRebind = useCallback((payload: {
    openings: Opening[]
    placements: Placement[]
    changedOpenings: number
    changedPlacements: number
  }) => {
    if (payload.changedOpenings > 0) {
      setOpenings(payload.openings)
      setSelectedOpeningId((previous) => (
        previous && !payload.openings.some((opening) => opening.id === previous)
          ? null
          : previous
      ))
      void handleSaveOpenings(payload.openings)
    }

    if (payload.changedPlacements > 0) {
      setPlacements(payload.placements)
      setSelectedPlacementId((previous) => (
        previous && !payload.placements.some((placement) => placement.id === previous)
          ? null
          : previous
      ))
      void handleSavePlacements(payload.placements)
    }
  }, [handleSaveOpenings, handleSavePlacements])

  // Reset configuredDimensions whenever the selected catalog item changes
  useEffect(() => {
    if (selectedCatalogItem) {
      if ('base_dims_json' in selectedCatalogItem) {
        // CatalogArticle
        setConfiguredDimensions({
          width_mm: selectedCatalogItem.base_dims_json.width_mm,
          height_mm: selectedCatalogItem.base_dims_json.height_mm,
          depth_mm: selectedCatalogItem.base_dims_json.depth_mm,
        })
        setChosenOptions({})
      } else {
        // Legacy CatalogItem
        setConfiguredDimensions({
          width_mm: selectedCatalogItem.width_mm,
          height_mm: selectedCatalogItem.height_mm,
          depth_mm: selectedCatalogItem.depth_mm,
        })
        setChosenOptions({})
      }
    } else {
      setConfiguredDimensions(null)
      setChosenOptions({})
    }
  }, [selectedCatalogItem])

  const handleAddPlacement = useCallback((wallId: string, wallLengthMm: number) => {
    if (!selectedCatalogItem) {
      console.warn('Kein Katalogartikel ausgewählt')
      return
    }

    const isArticle = 'base_dims_json' in selectedCatalogItem
    const article = isArticle ? (selectedCatalogItem as CatalogArticle) : null

    const itemWidth = isArticle ? selectedCatalogItem.base_dims_json.width_mm : selectedCatalogItem.width_mm
    const itemHeight = isArticle ? selectedCatalogItem.base_dims_json.height_mm : selectedCatalogItem.height_mm
    const itemDepth = isArticle ? selectedCatalogItem.base_dims_json.depth_mm : selectedCatalogItem.depth_mm

    const dims = configuredDimensions ?? {
      width_mm: itemWidth,
      height_mm: itemHeight,
      depth_mm: itemDepth,
    }

    const cleanedChosenOptions = Object.fromEntries(
      Object.entries(chosenOptions).filter(([, value]) => value.trim() !== ''),
    )
    const resolvedVariantId = article ? resolveArticleVariantId(article, cleanedChosenOptions) : undefined
    const resolvedArticlePrice = article ? resolveArticlePriceForVariant(article, resolvedVariantId) : undefined

    const placementWidth = Math.max(1, dims.width_mm)
    const offset = Math.max(0, Math.round((wallLengthMm - placementWidth) / 2))
    const newPlacement: Placement = {
      id: crypto.randomUUID(),
      catalog_item_id: selectedCatalogItem.id,
      ...(isArticle ? { catalog_article_id: selectedCatalogItem.id } : {}),
      ...(resolvedVariantId ? { article_variant_id: resolvedVariantId } : {}),
      description: selectedCatalogItem.name,
      ...(isArticle && Object.keys(cleanedChosenOptions).length > 0
        ? { chosen_options: cleanedChosenOptions }
        : {}),
      ...(isArticle && resolvedArticlePrice
        ? {
            list_price_net: resolvedArticlePrice.list_net,
            dealer_price_net: resolvedArticlePrice.dealer_net,
            ...(resolvedArticlePrice.tax_group_id ? { tax_group_id: resolvedArticlePrice.tax_group_id } : {}),
          }
        : {}),
      ...(!isArticle ? { list_price_net: selectedCatalogItem.list_price_net } : {}),
      ...(!isArticle && selectedCatalogItem.dealer_price_net != null
        ? { dealer_price_net: selectedCatalogItem.dealer_price_net }
        : {}),
      wall_id: wallId,
      offset_mm: offset,
      width_mm: placementWidth,
      depth_mm: Math.max(1, dims.depth_mm),
      height_mm: Math.max(1, dims.height_mm),
    }

    const updated = [...placementsRef.current, newPlacement]
    setPlacements(updated)
    setSelectedPlacementId(newPlacement.id)
    handleSavePlacements(updated)
    resetToSelection()
  }, [handleSavePlacements, selectedCatalogItem, configuredDimensions, chosenOptions, resetToSelection])

  const handleUpdatePlacement = useCallback((updated: Placement) => {
    const nextPlacements = placementsRef.current.map((placement) => (
      placement.id === updated.id ? updated : placement
    ))
    setPlacements(nextPlacements)
    handleSavePlacements(nextPlacements)
  }, [handleSavePlacements])

  const handleDeletePlacement = useCallback((placementId: string) => {
    const nextPlacements = placementsRef.current.filter((placement) => placement.id !== placementId)
    setPlacements(nextPlacements)
    setSelectedPlacementId((current) => (current === placementId ? null : current))
    handleSavePlacements(nextPlacements)
  }, [handleSavePlacements])

  // Auto-Vervollständigung (Langteile, Sockel, Wangen)
  const handleAutoComplete = useCallback(async () => {
    if (!id || !selectedRoomRef.current) return
    setAutoCompleteLoading(true)
    try {
      const result = await autoCompletionApi.run(id, selectedRoomRef.current.id)
      setAutoCompleteResult(result)
    } catch (e) {
      console.error('Auto-Vervollständigung fehlgeschlagen:', e)
    } finally {
      setAutoCompleteLoading(false)
    }
  }, [id])

  const handleGltfExport = useCallback(async () => {
    if (!selectedAlternativeId) {
      alert('Keine Alternative ausgewählt')
      return
    }

    setGltfExportLoading(true)
    try {
      const response = await fetch(`/api/v1/alternatives/${selectedAlternativeId}/export/gltf`, {
        method: 'POST',
        headers: { 'X-Tenant-Id': '00000000-0000-0000-0000-000000000001' },
      })

      if (!response.ok) {
        alert('Export fehlgeschlagen')
        return
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `planung-${selectedAlternativeId}.glb`
      link.click()
      URL.revokeObjectURL(url)
    } catch {
      alert('Export fehlgeschlagen')
    } finally {
      setGltfExportLoading(false)
    }
  }, [selectedAlternativeId])

  const handleMarkAllDelivered = useCallback(async () => {
    if (!selectedAlternativeId) {
      alert('Keine Alternative ausgewählt')
      return
    }

    setBulkDeliveredLoading(true)
    setBulkDeliveredMessage(null)
    setBulkDeliveredError(false)
    try {
      const result = await projectsApi.markAlternativeOrdersDelivered(selectedAlternativeId)
      const plural = result.updated_count === 1 ? '' : 'en'
      setBulkDeliveredMessage(`${result.updated_count} Bestellung${plural} als geliefert markiert`)
    } catch (e) {
      setBulkDeliveredError(true)
      setBulkDeliveredMessage(e instanceof Error ? e.message : 'Bestellstatus konnte nicht aktualisiert werden')
    } finally {
      setBulkDeliveredLoading(false)
    }
  }, [selectedAlternativeId])

  // Geometrieprüfung ausführen
  const handleRunValidation = useCallback(async () => {
    if (!selectedRoomRef.current || !id) return
    const room = selectedRoomRef.current
    const boundary = room.boundary as { vertices?: Array<{ id: string; x_mm: number; y_mm: number }>; wall_segments?: Array<{ id: string; start_vertex_id?: string; end_vertex_id?: string; length_mm?: number }> }
    const vertices = boundary.vertices ?? []
    const wallSegments = boundary.wall_segments ?? []
    const roomPolygon = vertices.map(v => ({ x_mm: v.x_mm, y_mm: v.y_mm }))
    if (roomPolygon.length < 3) return

    const vertexById = new Map(vertices.map(v => [v.id, v]))
    const walls = wallSegments.flatMap(w => {
      const s = vertexById.get(w.start_vertex_id ?? '')
      const e = vertexById.get(w.end_vertex_id ?? '')
      if (!s || !e) return []
      const len = w.length_mm ?? Math.hypot(e.x_mm - s.x_mm, e.y_mm - s.y_mm)
      return [{ id: w.id, start: { x_mm: s.x_mm, y_mm: s.y_mm }, end: { x_mm: e.x_mm, y_mm: e.y_mm }, length_mm: len }]
    })

    const objects = placementsRef.current.map(p => ({
      id: p.id, type: 'base' as const,
      wall_id: p.wall_id, offset_mm: p.offset_mm,
      width_mm: p.width_mm, depth_mm: p.depth_mm, height_mm: p.height_mm,
    }))
    const openingsMapped = openingsRef.current.map(o => ({
      id: o.id, wall_id: o.wall_id, offset_mm: o.offset_mm, width_mm: o.width_mm,
    }))
    const constraints = (room.ceiling_constraints as CeilingConstraint[] | undefined) ?? []

    setValidationLoading(true)
    try {
      const result = await validateApi.run(id, {
        user_id: 'anonymous',
        roomPolygon,
        objects,
        openings: openingsMapped,
        walls,
        ceilingConstraints: constraints,
        nominalCeilingMm: room.ceiling_height_mm,
      })
      setValidationResult(result)
    } catch (e) {
      console.error('Validierung fehlgeschlagen:', e)
    } finally {
      setValidationLoading(false)
    }
  }, [id])

  // Dachschrägen speichern
  const handleSaveCeilingConstraints = useCallback((constraints: CeilingConstraint[]) => {
    if (!selectedRoomRef.current) return
    roomsApi.update(selectedRoomRef.current.id, {
      ceiling_constraints: constraints as unknown[],
    }).then(updated => {
      handleRoomUpdated(updated)
    }).catch((e: Error) => console.error('Dachschrägen speichern fehlgeschlagen:', e))
  }, [handleRoomUpdated])

  const handleReferenceImageUpdate = useCallback((img: NonNullable<EditorState['referenceImage']>) => {
    editor.setReferenceImage(img)
    if (!selectedRoomRef.current) return

    roomsApi.updateReferenceImage(selectedRoomRef.current.id, img)
      .then((updated) => {
        handleRoomUpdated(updated)
      })
      .catch((e: Error) => {
        console.error('Referenzbild speichern fehlgeschlagen:', e)
      })
  }, [editor, handleRoomUpdated])

  const roomsOnActiveLevel = useMemo(() => {
    if (!project) {
      return []
    }

    if (!activeLevelId) {
      return project.rooms
    }

    return project.rooms.filter((room) => room.level_id === activeLevelId)
  }, [project, activeLevelId])

  useEffect(() => {
    if (!id) {
      setProjectElevations([])
      return
    }

    let active = true
    roomsApi.listElevations(id)
      .then((payload) => {
        if (!active) return
        setProjectElevations(payload.elevations)
      })
      .catch(() => {
        if (!active) return
        setProjectElevations([])
      })

    return () => {
      active = false
    }
  }, [id])

  const verticalConnectionsForSelectedRoom = useMemo(() => {
    if (!selectedRoomId) {
      return []
    }

    return verticalConnections.filter((entry) => extractVerticalConnectionRoomId(entry) === selectedRoomId)
  }, [verticalConnections, selectedRoomId])

  const selectedRoom = roomsOnActiveLevel.find(r => r.id === selectedRoomId) ?? null
  selectedRoomRef.current = selectedRoom as unknown as RoomPayload | null

  const lockStateLabel = projectLockState?.locked
    ? `🔒 ${projectLockState.locked_by_user ?? 'Unbekannt'}${projectLockState.locked_by_host ? ` @ ${projectLockState.locked_by_host}` : ''}${projectLockState.locked_at ? ` · ${new Date(projectLockState.locked_at).toLocaleString()}` : ''}`
    : null

  const effectiveViewMode: PlannerViewMode = compactLayout && (viewMode === 'split' || viewMode === 'split3') ? '2d' : viewMode
  const elevationsForSelectedRoom = useMemo(
    () => projectElevations.filter((entry) => entry.room_id === selectedRoomId),
    [projectElevations, selectedRoomId],
  )

  useEffect(() => {
    if (elevationsForSelectedRoom.length === 0) {
      setSelectedElevationWallIndex(0)
      return
    }

    setSelectedElevationWallIndex((previous) => {
      if (elevationsForSelectedRoom.some((entry) => entry.wall_index === previous)) {
        return previous
      }
      return elevationsForSelectedRoom[0].wall_index
    })
  }, [elevationsForSelectedRoom])

  useEffect(() => {
    if (effectiveViewMode !== 'elevation' || !selectedRoomId) {
      setElevationSvg('')
      setElevationLoading(false)
      return
    }

    let active = true
    setElevationLoading(true)
    dimensionsApi.getElevation(selectedRoomId, selectedElevationWallIndex)
      .then((svg) => {
        if (!active) return
        setElevationSvg(svg)
      })
      .catch(() => {
        if (!active) return
        setElevationSvg('')
      })
      .finally(() => {
        if (!active) return
        setElevationLoading(false)
      })

    return () => {
      active = false
    }
  }, [effectiveViewMode, selectedRoomId, selectedElevationWallIndex])

  useEffect(() => {
    if (effectiveViewMode !== 'section' || !selectedRoomId || !selectedSectionLineId) {
      setSectionView(null)
      setSectionViewError(null)
      setSectionViewLoading(false)
      setSectionViewConfigDraft(null)
      return
    }

    let active = true
    setSectionViewLoading(true)
    setSectionViewError(null)
    annotationsApi.getSectionView(selectedRoomId, selectedSectionLineId)
      .then((payload) => {
        if (!active) return
        setSectionView(payload)
        setSectionViewConfigDraft(payload.view_config)
      })
      .catch((loadError) => {
        if (!active) return
        setSectionView(null)
        setSectionViewError(loadError instanceof Error ? loadError.message : 'Section-View konnte nicht geladen werden')
      })
      .finally(() => {
        if (!active) return
        setSectionViewLoading(false)
      })

    return () => {
      active = false
    }
  }, [effectiveViewMode, selectedRoomId, selectedSectionLineId])

  useEffect(() => {
    if (!selectedRoom) {
      return
    }

    if (centeredVisitorRoomIdRef.current === selectedRoom.id) {
      return
    }
    centeredVisitorRoomIdRef.current = selectedRoom.id

    const boundary = selectedRoom.boundary as RoomBoundaryPayload | undefined
    const vertices = (boundary?.vertices ?? []) as Vertex[]
    if (vertices.length < 1) {
      return
    }

    const sum = vertices.reduce(
      (acc, vertex) => ({
        x_mm: acc.x_mm + vertex.x_mm,
        y_mm: acc.y_mm + vertex.y_mm,
      }),
      { x_mm: 0, y_mm: 0 },
    )
    const centerX = Math.round(sum.x_mm / vertices.length)
    const centerY = Math.round(sum.y_mm / vertices.length)

    setCameraState((prev) => ({
      ...prev,
      x_mm: centerX,
      y_mm: centerY,
      camera_height_mm: cameraHeightMm,
    }))
  }, [selectedRoom, cameraHeightMm])

  const handleRepositionVisitor = useCallback((point: { x_mm: number; y_mm: number }) => {
    setCameraState((prev) => ({
      ...prev,
      x_mm: point.x_mm,
      y_mm: point.y_mm,
    }))
  }, [])

  const handleCameraStateChange = useCallback((next: SyncedCameraState) => {
    setCameraState((prev) => {
      const stable =
        Math.abs(prev.x_mm - next.x_mm) < 1 &&
        Math.abs(prev.y_mm - next.y_mm) < 1 &&
        Math.abs(prev.camera_height_mm - next.camera_height_mm) < 1 &&
        Math.abs(prev.yaw_rad - next.yaw_rad) < 0.0005 &&
        Math.abs(prev.pitch_rad - next.pitch_rad) < 0.0005
      return stable ? prev : next
    })
    setCameraHeightMm(clampNumber(Math.round(next.camera_height_mm), 900, 2400))
  }, [])

  const applyCameraPresetLocally = useCallback((preset: CameraPreset) => {
    const nextState = presetToCameraState(preset)
    setCameraState(nextState)
    setCameraHeightMm(clampNumber(Math.round(nextState.camera_height_mm), 900, 2400))
    setCameraFovDeg(clampPresetFov(preset.fov))
    if (preset.mode === 'visitor') {
      setShowVirtualVisitor(true)
    }
  }, [])

  const handleSaveCurrentCameraPreset = useCallback((payload: { name: string; mode: 'orbit' | 'visitor'; isDefault: boolean }) => {
    if (!id) {
      return
    }

    setCameraPresetSaving(true)
    void cameraPresetsApi.create(id, cameraStateToPresetPayload({
      name: payload.name,
      state: cameraState,
      fovDeg: cameraFovDeg,
      mode: payload.mode,
      isDefault: payload.isDefault,
    }))
      .then((result) => {
        setCameraPresets(result.presets)
        setActiveCameraPresetId(result.active_preset_id)
        cameraPresetAutoAppliedRef.current = true
      })
      .catch((presetError: Error) => {
        console.error('S106: Kamera-Preset konnte nicht gespeichert werden:', presetError)
      })
      .finally(() => {
        setCameraPresetSaving(false)
      })
  }, [id, cameraState, cameraFovDeg])

  const handleApplyCameraPreset = useCallback((presetId: string) => {
    if (!id) {
      return
    }

    setCameraPresetSaving(true)
    void cameraPresetsApi.apply(id, presetId)
      .then((result) => {
        setActiveCameraPresetId(result.active_preset_id)
        applyCameraPresetLocally(result.preset)
        cameraPresetAutoAppliedRef.current = true
      })
      .catch((presetError: Error) => {
        console.error('S106: Kamera-Preset konnte nicht angewendet werden:', presetError)
      })
      .finally(() => {
        setCameraPresetSaving(false)
      })
  }, [id, applyCameraPresetLocally])

  const handleDeleteCameraPreset = useCallback((presetId: string) => {
    if (!id) {
      return
    }

    setCameraPresetSaving(true)
    void cameraPresetsApi.remove(id, presetId)
      .then(() => {
        setCameraPresets((previous) => previous.filter((entry) => entry.id !== presetId))
        setActiveCameraPresetId((current) => (current === presetId ? null : current))
      })
      .catch((presetError: Error) => {
        console.error('S106: Kamera-Preset konnte nicht gelöscht werden:', presetError)
      })
      .finally(() => {
        setCameraPresetSaving(false)
      })
  }, [id])

  const handleSetDefaultCameraPreset = useCallback((presetId: string) => {
    if (!id) {
      return
    }

    setCameraPresetSaving(true)
    void cameraPresetsApi.update(id, presetId, { is_default: true })
      .then((result) => {
        setCameraPresets(result.presets)
      })
      .catch((presetError: Error) => {
        console.error('S106: Default-Kamera-Preset konnte nicht gesetzt werden:', presetError)
      })
      .finally(() => {
        setCameraPresetSaving(false)
      })
  }, [id])

  useEffect(() => {
    if (!id) {
      setCameraPresets([])
      setActiveCameraPresetId(null)
      setCameraPresetPanelOpen(false)
      cameraPresetAutoAppliedRef.current = false
      return
    }

    cameraPresetAutoAppliedRef.current = false
    let active = true
    setCameraPresetLoading(true)

    cameraPresetsApi.list(id)
      .then((result) => {
        if (!active) {
          return
        }

        setCameraPresets(result.presets)
        setActiveCameraPresetId(result.active_preset_id)

        if (cameraPresetAutoAppliedRef.current) {
          return
        }

        const preferred = result.active_preset_id
          ? result.presets.find((entry) => entry.id === result.active_preset_id)
          : result.presets.find((entry) => entry.is_default)

        if (preferred) {
          applyCameraPresetLocally(preferred)
          setActiveCameraPresetId(preferred.id)
          cameraPresetAutoAppliedRef.current = true
        }
      })
      .catch((presetError: Error) => {
        if (!active) {
          return
        }
        console.error('S106: Kamera-Presets konnten nicht geladen werden:', presetError)
        setCameraPresets([])
        setActiveCameraPresetId(null)
      })
      .finally(() => {
        if (!active) {
          return
        }
        setCameraPresetLoading(false)
      })

    return () => {
      active = false
    }
  }, [id, applyCameraPresetLocally])

  useEffect(() => {
    if (!selectedRoom) {
      setIsPreviewPopoutOpen(false)
    }
  }, [selectedRoom])

  // Auswahl-Info für RightSidebar – muss VOR den Early-Returns stehen (Rules of Hooks)
  const { state } = editor
  const selectedVertex = state.selectedIndex !== null ? (state.vertices[state.selectedIndex] ?? null) : null
  const selEdgeLen = state.selectedEdgeIndex !== null
    ? edgeLengthMm(state.vertices, state.selectedEdgeIndex)
    : null

  useEffect(() => {
    setEdgeLengthPreviewMm(null)
  }, [state.selectedEdgeIndex, selEdgeLen])

  const selectedOpening = openings.find(o => o.id === selectedOpeningId) ?? null
  const selectedPlacement = placements.find(p => p.id === selectedPlacementId) ?? null
  const selectedDrawingGroup = useMemo(
    () => drawingGroups.find((group) => group.id === selectedDrawingGroupId) ?? null,
    [drawingGroups, selectedDrawingGroupId],
  )
  const currentSelectionMembers = useMemo(() => {
    const members: DrawingGroupMember[] = []
    if (selectedRoomId && selectedPlacementId) {
      members.push({ entity_type: 'placement', entity_id: selectedPlacementId, room_id: selectedRoomId })
    }
    if (selectedRoomId && selectedOpeningId) {
      members.push({ entity_type: 'opening', entity_id: selectedOpeningId, room_id: selectedRoomId })
    }
    return members
  }, [selectedOpeningId, selectedPlacementId, selectedRoomId])
  const highlightedOpeningIds = useMemo(() => {
    if (!selectedDrawingGroup) {
      return []
    }
    return selectedDrawingGroup.members_json
      .filter((member) => member.entity_type === 'opening')
      .filter((member) => !member.room_id || member.room_id === selectedRoomId)
      .map((member) => member.entity_id)
  }, [selectedDrawingGroup, selectedRoomId])
  const highlightedPlacementIds = useMemo(() => {
    if (!selectedDrawingGroup) {
      return []
    }
    return selectedDrawingGroup.members_json
      .filter((member) => member.entity_type === 'placement')
      .filter((member) => !member.room_id || member.room_id === selectedRoomId)
      .map((member) => member.entity_id)
  }, [selectedDrawingGroup, selectedRoomId])
  const selectedRoomWallSegments = useMemo(() => extractBoundaryWallSegments(selectedRoom?.boundary), [selectedRoom?.boundary])
  const selectedWallSegment = useMemo(() => {
    const index = state.selectedEdgeIndex
    if (index === null) {
      return null
    }
    return selectedRoomWallSegments[index] ?? null
  }, [selectedRoomWallSegments, state.selectedEdgeIndex])
  const selectedWallId = state.selectedEdgeIndex !== null
    ? (selectedWallSegment?.id ?? state.wallIds[state.selectedEdgeIndex] ?? null)
    : null
  const dimensionAssistSegments = useMemo(() => {
    if (!selectedWallId || selEdgeLen == null) {
      return []
    }
    return buildDimensionAssistSegments(selectedWallId, selEdgeLen, openings, placements)
  }, [openings, placements, selEdgeLen, selectedWallId])
  const selectedWallVisible = selectedWallSegment ? resolveWallVisible(selectedWallSegment) : null
  const selectedWallLocked = selectedWallSegment ? Boolean(selectedWallSegment.locked) : null

  const selectedVertexLocked = useMemo(() => {
    if (state.selectedIndex === null || state.vertices.length < 2) {
      return false
    }

    const previousEdgeIndex = (state.selectedIndex - 1 + state.vertices.length) % state.vertices.length
    const currentWallLocked = Boolean(selectedRoomWallSegments[state.selectedIndex]?.locked)
    const previousWallLocked = Boolean(selectedRoomWallSegments[previousEdgeIndex]?.locked)
    return currentWallLocked || previousWallLocked
  }, [selectedRoomWallSegments, state.selectedIndex, state.vertices.length])

  const polygonShortcutStates = useMemo(() => resolvePolygonShortcutStates({
    safeEditMode,
    selectedVertexIndex: state.selectedIndex,
    selectedEdgeIndex: state.selectedEdgeIndex,
    selectedVertexLocked,
  }), [safeEditMode, selectedVertexLocked, state.selectedEdgeIndex, state.selectedIndex])

  const handleDeleteSelectedVertex = useCallback(() => {
    if (state.selectedIndex === null || !polygonShortcutStates.deleteVertex.enabled) {
      if (!polygonShortcutStates.deleteVertex.enabled) {
        setShortcutFeedback(polygonShortcutStates.deleteVertex.reasonIfDisabled ?? 'Punkt kann nicht geloescht werden')
      }
      return
    }

    editor.deleteVertex(state.selectedIndex)
  }, [editor, polygonShortcutStates.deleteVertex.enabled, polygonShortcutStates.deleteVertex.reasonIfDisabled, state.selectedIndex])

  const handleAddOpeningForSelectedEdge = useCallback(() => {
    const selectedEdgeIndex = state.selectedEdgeIndex
    if (selectedEdgeIndex === null) {
      setShortcutFeedback('Wandkante auswaehlen, um eine Oeffnung hinzuzufuegen')
      return
    }

    const wallId = state.wallIds[selectedEdgeIndex]
    const start = state.vertices[selectedEdgeIndex]
    const end = state.vertices[(selectedEdgeIndex + 1) % state.vertices.length]
    if (!wallId || !start || !end) {
      return
    }

    handleAddOpening(wallId, Math.hypot(end.x_mm - start.x_mm, end.y_mm - start.y_mm))
  }, [handleAddOpening, state.selectedEdgeIndex, state.vertices, state.wallIds])

  const handleAddPlacementForSelectedEdge = useCallback(() => {
    const selectedEdgeIndex = state.selectedEdgeIndex
    if (selectedEdgeIndex === null) {
      setShortcutFeedback('Wandkante auswaehlen, um ein Objekt zu platzieren')
      return
    }

    if (!selectedCatalogItem) {
      setShortcutFeedback('Katalogobjekt auswaehlen, bevor platziert werden kann')
      return
    }

    const wallId = state.wallIds[selectedEdgeIndex]
    const start = state.vertices[selectedEdgeIndex]
    const end = state.vertices[(selectedEdgeIndex + 1) % state.vertices.length]
    if (!wallId || !start || !end) {
      return
    }

    handleAddPlacement(wallId, Math.hypot(end.x_mm - start.x_mm, end.y_mm - start.y_mm))
  }, [handleAddPlacement, selectedCatalogItem, state.selectedEdgeIndex, state.vertices, state.wallIds])

  const reloadDrawingGroups = useCallback(async () => {
    if (!id) {
      setDrawingGroups([])
      setSelectedDrawingGroupId(null)
      return
    }

    const groups = await drawingGroupsApi.list(id)
    setDrawingGroups(groups)
    setSelectedDrawingGroupId((previous) => (
      previous && groups.some((group) => group.id === previous) ? previous : null
    ))
  }, [id])

  const refreshSelectedRoomCollections = useCallback(async () => {
    if (!id || !selectedRoomId) {
      return
    }

    const [rooms, nextDimensions, nextCenterlines] = await Promise.all([
      roomsApi.list(id),
      dimensionsApi.list(selectedRoomId),
      centerlinesApi.list(selectedRoomId),
    ])

    setProject((previous) => {
      if (!previous) {
        return previous
      }
      return {
        ...previous,
        rooms: rooms as typeof previous.rooms,
      }
    })

    const room = rooms.find((entry) => entry.id === selectedRoomId)
    setOpenings((room?.openings as unknown as Opening[]) ?? [])
    setPlacements((room?.placements as unknown as Placement[]) ?? [])
    setDimensions(nextDimensions)
    setCenterlines(nextCenterlines)
  }, [id, selectedRoomId])

  const handleSelectDrawingGroup = useCallback((groupId: string | null) => {
    setSelectedDrawingGroupId(groupId)

    if (!groupId) {
      return
    }

    const group = drawingGroups.find((entry) => entry.id === groupId)
    if (!group) {
      return
    }

    const placementMember = group.members_json.find(
      (member) => member.entity_type === 'placement' && (!member.room_id || member.room_id === selectedRoomId),
    )
    const openingMember = group.members_json.find(
      (member) => member.entity_type === 'opening' && (!member.room_id || member.room_id === selectedRoomId),
    )

    setSelectedPlacementId(placementMember?.entity_id ?? null)
    setSelectedOpeningId(openingMember?.entity_id ?? null)
  }, [drawingGroups, selectedRoomId])

  const handleCreateDrawingGroup = useCallback((payload: {
    name: string
    kind: DrawingGroup['kind']
    members_json: DrawingGroupMember[]
  }) => {
    if (!id) {
      return
    }

    void drawingGroupsApi.create(id, payload)
      .then((created) => {
        setDrawingGroups((previous) => [created, ...previous])
        setSelectedDrawingGroupId(created.id)
      })
      .catch((groupError: Error) => {
        console.error('S90: Gruppe konnte nicht erstellt werden:', groupError)
      })
  }, [id])

  const handleDeleteDrawingGroup = useCallback((groupId: string) => {
    void drawingGroupsApi.remove(groupId)
      .then(() => {
        setDrawingGroups((previous) => previous.filter((group) => group.id !== groupId))
        setSelectedDrawingGroupId((previous) => (previous === groupId ? null : previous))
      })
      .catch((groupError: Error) => {
        console.error('S90: Gruppe konnte nicht gelöscht werden:', groupError)
      })
  }, [])

  const handleApplyDrawingGroupTransform = useCallback((groupId: string, payload: {
    translate?: { x_mm: number; y_mm: number }
    rotation_deg?: number
  }) => {
    void drawingGroupsApi.applyTransform(groupId, payload)
      .then(() => Promise.all([refreshSelectedRoomCollections(), reloadDrawingGroups()]))
      .catch((groupError: Error) => {
        console.error('S90: Gruppen-Transform fehlgeschlagen:', groupError)
      })
  }, [refreshSelectedRoomCollections, reloadDrawingGroups])

  const handleSyncDrawingGroupConfig = useCallback((groupId: string, config: DrawingGroupConfigPatch) => {
    void drawingGroupsApi.update(groupId, {
      config_json: config as Record<string, unknown>,
      sync_members: true,
    })
      .then(() => Promise.all([refreshSelectedRoomCollections(), reloadDrawingGroups()]))
      .catch((groupError: Error) => {
        console.error('S90: Gruppen-Lock/Visibility Sync fehlgeschlagen:', groupError)
      })
  }, [refreshSelectedRoomCollections, reloadDrawingGroups])

  const patchSelectedRoomWallSegment = useCallback((roomId: string, wallId: string, patch: Partial<WallSegmentFlags>) => {
    setProject((previous) => {
      if (!previous) return previous

      return {
        ...previous,
        rooms: previous.rooms.map((room) => {
          if (room.id !== roomId) {
            return room
          }

          const nextBoundary = updateBoundaryWallSegment(room.boundary, wallId, patch)
          if (nextBoundary === room.boundary) {
            return room
          }

          return {
            ...room,
            boundary: nextBoundary,
          }
        }),
      }
    })
  }, [])

  const handleSetSelectedPlacementLocked = useCallback((next: boolean) => {
    if (!id || !selectedRoomId || !selectedPlacementId) {
      return
    }

    void visibilityApi.applyLocks(id, {
      placements: [{
        room_id: selectedRoomId,
        placement_id: selectedPlacementId,
        locked: next,
        lock_scope: next ? 'manual' : undefined,
      }],
    })
      .then(() => {
        setPlacements((previous) => previous.map((placement) => (
          placement.id === selectedPlacementId
            ? {
                ...placement,
                locked: next,
                lock_scope: next ? 'manual' : null,
              }
            : placement
        )))
      })
      .catch((lockError: Error) => {
        console.error('S88: Placement-Lock konnte nicht gesetzt werden:', lockError)
      })
  }, [id, selectedPlacementId, selectedRoomId])

  const handleSetSelectedWallVisible = useCallback((next: boolean) => {
    if (!id || !selectedRoomId || !selectedWallId) {
      return
    }

    void visibilityApi.applyVisibility(id, {
      walls: [{
        room_id: selectedRoomId,
        wall_id: selectedWallId,
        visible: next,
      }],
    })
      .then(() => {
        patchSelectedRoomWallSegment(selectedRoomId, selectedWallId, {
          visible: next,
          is_hidden: !next,
        })
      })
      .catch((visibilityError: Error) => {
        console.error('S88: Wand-Sichtbarkeit konnte nicht angewendet werden:', visibilityError)
      })
  }, [id, patchSelectedRoomWallSegment, selectedRoomId, selectedWallId])

  const handleSetSelectedWallLocked = useCallback((next: boolean) => {
    if (!id || !selectedRoomId || !selectedWallId) {
      return
    }

    void visibilityApi.applyLocks(id, {
      walls: [{
        room_id: selectedRoomId,
        wall_id: selectedWallId,
        locked: next,
        lock_scope: next ? 'manual' : undefined,
      }],
    })
      .then(() => {
        patchSelectedRoomWallSegment(selectedRoomId, selectedWallId, {
          locked: next,
          lock_scope: next ? 'manual' : null,
        })
      })
      .catch((lockError: Error) => {
        console.error('S88: Wand-Lock konnte nicht gesetzt werden:', lockError)
      })
  }, [id, patchSelectedRoomWallSegment, selectedRoomId, selectedWallId])

  const handleSaveAutoDollhouse = useCallback((patch: AutoDollhousePatch) => {
    if (!id) {
      return
    }

    setAutoDollhouseSaving(true)
    void visibilityApi.updateAutoDollhouse(id, patch)
      .then((settings) => {
        setAutoDollhouseSettings(settings)
      })
      .catch((settingsError: Error) => {
        console.error('S105: Auto-Dollhouse Einstellungen konnten nicht gespeichert werden:', settingsError)
      })
      .finally(() => {
        setAutoDollhouseSaving(false)
      })
  }, [id])

  // Wandgeometrie für Dachschrägen-Panel
  const selectedWallGeom = useMemo(() => {
    const i = state.selectedEdgeIndex
    if (i === null) return null
    const v0 = state.vertices[i]
    const v1 = state.vertices[(i + 1) % state.vertices.length]
    if (!v0 || !v1) return null
    const wallId = selectedWallId ?? state.wallIds[i]
    if (!wallId) return null
    return { id: wallId, start: { x_mm: v0.x_mm, y_mm: v0.y_mm }, end: { x_mm: v1.x_mm, y_mm: v1.y_mm } }
  }, [selectedWallId, state.selectedEdgeIndex, state.vertices, state.wallIds])

  const ceilingConstraints = ((selectedRoom as unknown as RoomPayload | null)?.ceiling_constraints as CeilingConstraint[] | undefined) ?? []

  const canvasPanel = (
    <CanvasArea
      room={selectedRoom as unknown as RoomPayload | null}
      onRoomUpdated={handleRoomUpdated}
      editor={editorWithMode}
      verticalConnections={verticalConnectionsForSelectedRoom}
      openings={openings}
      selectedOpeningId={selectedOpeningId}
      onSelectOpening={setSelectedOpeningId}
      onAddOpening={handleAddOpening}
      placements={placements}
      dimensions={dimensions}
      centerlines={centerlines}
      selectedPlacementId={selectedPlacementId}
      onSelectPlacement={setSelectedPlacementId}
      highlightedOpeningIds={highlightedOpeningIds}
      highlightedPlacementIds={highlightedPlacementIds}
      canAddPlacement={selectedCatalogItem !== null}
      onAddPlacement={handleAddPlacement}
      acousticGrid={acousticGrid}
      acousticVisible={acousticEnabled}
      acousticOpacity={acousticOpacityPct / 100}
      edgeLengthPreviewMm={edgeLengthPreviewMm}
      onReferenceImageUpdate={handleReferenceImageUpdate}
      navigationSettings={navigationSettings}
      safeEditMode={safeEditMode}
      showCompass={daylightEnabled}
      northAngleDeg={projectEnvironment?.north_angle_deg ?? 0}
      virtualVisitor={{
        x_mm: cameraState.x_mm,
        y_mm: cameraState.y_mm,
        yaw_rad: cameraState.yaw_rad,
        visible: showVirtualVisitor,
      }}
      onRepositionVisitor={showVirtualVisitor ? handleRepositionVisitor : undefined}
      onBoundaryTopologyRebind={handleBoundaryTopologyRebind}
      onShortcutBlocked={setShortcutFeedback}
    />
  )

  const previewPanel = (
    <Preview3D
      room={selectedRoom as unknown as RoomPayload | null}
      verticalConnections={verticalConnectionsForSelectedRoom}
      cameraState={cameraState}
      onCameraStateChange={handleCameraStateChange}
      sunlight={daylightEnabled ? sunPreview : null}
      navigationSettings={navigationSettings}
      autoDollhouseSettings={autoDollhouseSettings}
      renderEnvironment={renderEnvironmentSettings}
      fovDeg={cameraFovDeg}
    />
  )

  const elevationPanel = (
    <section className={styles.projectionPanel}>
      <div className={styles.projectionHeader}>
        <h3 className={styles.projectionTitle}>Elevation View</h3>
        <label className={styles.projectionField}>
          Wand
          <select
            value={selectedElevationWallIndex}
            onChange={(event) => setSelectedElevationWallIndex(Number(event.target.value))}
            disabled={elevationsForSelectedRoom.length === 0}
          >
            {elevationsForSelectedRoom.map((entry) => (
              <option key={entry.wall_id} value={entry.wall_index}>
                {entry.room_name} · Wand {entry.wall_index + 1} ({Math.round(entry.wall_length_mm)} mm)
              </option>
            ))}
          </select>
        </label>
      </div>

      {!selectedRoomId && <p className={styles.projectionHint}>Bitte zuerst einen Raum auswählen.</p>}
      {selectedRoomId && elevationsForSelectedRoom.length === 0 && (
        <p className={styles.projectionHint}>Keine Wanddaten für Elevation verfügbar.</p>
      )}
      {selectedRoomId && elevationLoading && <p className={styles.projectionHint}>Elevation wird geladen…</p>}
      {selectedRoomId && !elevationLoading && elevationSvg.length > 0 && (
        <div className={styles.svgViewport} dangerouslySetInnerHTML={{ __html: elevationSvg }} />
      )}
    </section>
  )

  const sectionProjectionPanel = (
    <section className={styles.projectionPanel}>
      <div className={styles.projectionHeader}>
        <h3 className={styles.projectionTitle}>Section View</h3>
        <button
          type="button"
          className={styles.btnSecondary}
          onClick={() => {
            void handleSaveSectionViewConfig()
          }}
          disabled={!sectionViewConfigDraft || sectionViewSaving || !selectedSectionLineId}
        >
          {sectionViewSaving ? 'Speichere…' : 'Ansicht speichern'}
        </button>
      </div>

      {!selectedSectionLineId && <p className={styles.projectionHint}>Bitte eine Sektion auswählen.</p>}
      {selectedSectionLineId && sectionViewLoading && <p className={styles.projectionHint}>Section-Projektion wird geladen…</p>}
      {sectionViewError && <p className={styles.projectionError}>{sectionViewError}</p>}

      {sectionView && sectionViewConfigDraft && (
        <>
          <div className={styles.projectionConfigGrid}>
            <label className={styles.projectionField}>
              Scale
              <input
                type="number"
                step={0.05}
                min={0.25}
                max={4}
                value={sectionViewConfigDraft.scale}
                onChange={(event) => setSectionViewConfigDraft((previous) => (previous
                  ? { ...previous, scale: Number(event.target.value) }
                  : previous))}
              />
            </label>
            <label className={styles.projectionField}>
              Offset X (mm)
              <input
                type="number"
                value={sectionViewConfigDraft.offset_x_mm}
                onChange={(event) => setSectionViewConfigDraft((previous) => (previous
                  ? { ...previous, offset_x_mm: Number(event.target.value) }
                  : previous))}
              />
            </label>
            <label className={styles.projectionField}>
              Offset Y (mm)
              <input
                type="number"
                value={sectionViewConfigDraft.offset_y_mm}
                onChange={(event) => setSectionViewConfigDraft((previous) => (previous
                  ? { ...previous, offset_y_mm: Number(event.target.value) }
                  : previous))}
              />
            </label>
          </div>

          <div className={styles.projectionToggles}>
            <label>
              <input
                type="checkbox"
                checked={sectionViewConfigDraft.show_measurements}
                onChange={(event) => setSectionViewConfigDraft((previous) => (previous
                  ? { ...previous, show_measurements: event.target.checked }
                  : previous))}
              />
              Maße
            </label>
            <label>
              <input
                type="checkbox"
                checked={sectionViewConfigDraft.show_openings}
                onChange={(event) => setSectionViewConfigDraft((previous) => (previous
                  ? { ...previous, show_openings: event.target.checked }
                  : previous))}
              />
              Öffnungen
            </label>
            <label>
              <input
                type="checkbox"
                checked={sectionViewConfigDraft.show_placements}
                onChange={(event) => setSectionViewConfigDraft((previous) => (previous
                  ? { ...previous, show_placements: event.target.checked }
                  : previous))}
              />
              Placements
            </label>
          </div>

          <div className={styles.projectionMeta}>
            <span>Länge: {Math.round(sectionView.bounds.length_mm)} mm</span>
            <span>Höhe: {Math.round(sectionView.bounds.height_mm)} mm</span>
            <span>Snaps: {sectionView.snap_points.length}</span>
          </div>

          <div className={styles.projectionColumns}>
            <div>
              <h4>Öffnungen</h4>
              <ul className={styles.projectionList}>
                {sectionView.openings.map((entry) => (
                  <li key={entry.id}>
                    <button type="button" onClick={() => setSelectedOpeningId(entry.id)}>
                      {entry.id.slice(0, 8)} · {Math.round(entry.width_mm)}x{Math.round(entry.height_mm)}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4>Placements</h4>
              <ul className={styles.projectionList}>
                {sectionView.placements.map((entry) => (
                  <li key={entry.id}>
                    <button type="button" onClick={() => setSelectedPlacementId(entry.id)}>
                      {entry.id.slice(0, 8)} · {Math.round(entry.width_mm)}x{Math.round(entry.height_mm)}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4>Bemaßung</h4>
              <ul className={styles.projectionList}>
                {sectionView.dimensions.map((entry) => (
                  <li key={entry.id}>{entry.label ?? `${entry.type} (${entry.projected_points.length} pts)`}</li>
                ))}
              </ul>
            </div>
          </div>
        </>
      )}
    </section>
  )

  if (loading) return <div className={styles.center}>Lade Projekt…</div>
  if (error) return <div className={styles.center}>{error}</div>
  if (!project) return null

  const materialDockClassName = `${styles.materialDock} ${
    renderEnvironmentPanelOpen && daylightEnabled && daylightPanelOpen
      ? styles.materialDockShiftedDouble
      : renderEnvironmentPanelOpen || (daylightEnabled && daylightPanelOpen)
        ? styles.materialDockShifted
        : ''
  }`

  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <button type="button" className={styles.backBtn} onClick={() => navigate('/')}>← Projekte</button>
        <div className={styles.headerMenuWrapper} ref={sectionMenuRef}>
          <button
            type="button"
            className={styles.btnSecondary}
            onClick={() => setSectionMenuOpen((prev) => !prev)}
          >
            Bereiche
          </button>
          {sectionMenuOpen && (
            <div className={`${styles.moreMenu} ${styles.headerMenu}`} aria-label="Bereiche-Menü">
              <button type="button" className={styles.moreMenuItem} onClick={() => { setSectionMenuOpen(false); navigate('/') }}>Projektindex</button>
              {id && <button type="button" className={styles.moreMenuItem} onClick={() => { setSectionMenuOpen(false); navigate(`/projects/${id}/presentation`) }}>Präsentation</button>}
              {id && <button type="button" className={styles.moreMenuItem} onClick={() => { setSectionMenuOpen(false); navigate(`/projects/${id}/exports`) }}>Exporte</button>}
              {id && <button type="button" className={styles.moreMenuItem} onClick={() => { setSectionMenuOpen(false); navigate(`/projects/${id}/specification-packages`) }}>Werkstattpakete</button>}
              {id && <button type="button" className={styles.moreMenuItem} onClick={() => { setSectionMenuOpen(false); navigate(`/projects/${id}/quote-lines`) }}>Angebot</button>}
            </div>
          )}
        </div>
        <span className={styles.projectName}>{project.name}</span>
        <div className={styles.topbarActions}>
          {lockStateLabel && (
            <span className={styles.lockBadge} title={lockStateLabel}>
              {lockStateLabel}
            </span>
          )}
          {autoCompleteResult && (
            <span className={styles.autoCompleteHint}>
              ✓ {autoCompleteResult.created} Langteile generiert
            </span>
          )}
          <div className={styles.modeSwitch} aria-label="Ansichtsmodus">
            <button
              type="button"
              className={`${styles.modeBtn} ${viewMode === '2d' ? styles.modeBtnActive : ''}`}
              onClick={() => setViewMode('2d')}
            >
              2D
            </button>
            <button
              type="button"
              className={`${styles.modeBtn} ${viewMode === 'split' ? styles.modeBtnActive : ''}`}
              onClick={() => setViewMode('split')}
              title={actionStates.viewSplit.enabled ? '2D und 3D parallel' : actionStates.viewSplit.reasonIfDisabled}
              disabled={!actionStates.viewSplit.enabled}
            >
              Split
            </button>
            <button
              type="button"
              className={`${styles.modeBtn} ${viewMode === 'split3' ? styles.modeBtnActive : ''}`}
              onClick={() => setViewMode('split3')}
              title={actionStates.viewSplit.enabled ? '2D + 3D + Elevation' : actionStates.viewSplit.reasonIfDisabled}
              disabled={!actionStates.viewSplit.enabled}
            >
              3-Pan
            </button>
            <button
              type="button"
              className={`${styles.modeBtn} ${viewMode === '3d' ? styles.modeBtnActive : ''}`}
              onClick={() => setViewMode('3d')}
            >
              3D
            </button>
            <button
              type="button"
              className={`${styles.modeBtn} ${viewMode === 'elevation' ? styles.modeBtnActive : ''}`}
              onClick={() => setViewMode('elevation')}
              disabled={!actionStates.viewElevation.enabled}
              title={actionStates.viewElevation.enabled ? 'Elevation bearbeiten' : actionStates.viewElevation.reasonIfDisabled}
            >
              ELV
            </button>
            <button
              type="button"
              className={`${styles.modeBtn} ${viewMode === 'section' ? styles.modeBtnActive : ''}`}
              onClick={() => setViewMode('section')}
              disabled={!actionStates.viewSection.enabled}
              title={actionStates.viewSection.enabled ? 'Section bearbeiten' : actionStates.viewSection.reasonIfDisabled}
            >
              SEC
            </button>
          </div>
          <span className={styles.editorModeBadge} title="Zentraler Editor-Modus">
            Modus: {editorMode.modeLabel}
          </span>
          <label className={styles.visitorToggle}>
            <input
              type="checkbox"
              checked={showVirtualVisitor}
              onChange={(event) => setShowVirtualVisitor(event.target.checked)}
            />
            Besucher
          </label>
          <label className={styles.heightControl}>
            Höhe {cameraHeightMm} mm
            <input
              type="range"
              min={900}
              max={2400}
              step={10}
              value={cameraHeightMm}
              onChange={(event) => setCameraHeightMm(Number(event.target.value))}
            />
          </label>
          <div className={styles.navigationWrapper} ref={navigationPanelRef}>
            <button
              type='button'
              className={styles.btnSecondary}
              onClick={() => setNavigationPanelOpen((prev) => !prev)}
              disabled={!actionStates.panelNavigation.enabled}
              title={actionStates.panelNavigation.reasonIfDisabled}
            >
              Navigation
            </button>
            {navigationPanelOpen && (
              <NavigationSettingsPanel
                settings={navigationSettings}
                onChange={handleNavigationSettingsChange}
              />
            )}
          </div>
          <div className={styles.headerMenuWrapper} ref={toolboxMenuRef}>
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={() => setToolboxMenuOpen((prev) => !prev)}
            >
              Toolboxen
            </button>
            {toolboxMenuOpen && (
              <div className={`${styles.moreMenu} ${styles.headerMenu}`} aria-label="Toolbox-Menü">
                <label className={styles.toolboxItem}><input type="checkbox" checked={leftSidebarVisible} onChange={(event) => setLeftSidebarVisible(event.target.checked)} /> Links</label>
                <label className={styles.toolboxItem}><input type="checkbox" checked={rightSidebarVisible} onChange={(event) => setRightSidebarVisible(event.target.checked)} /> Rechts</label>
                <label className={styles.toolboxItem}><input type="checkbox" checked={statusBarVisible} onChange={(event) => setStatusBarVisible(event.target.checked)} /> Statusleiste</label>
                <label className={styles.toolboxItem}><input type="checkbox" checked={showAreasPanel} onChange={(event) => setShowAreasPanel(event.target.checked)} disabled={!actionStates.toggleAreasPanel.enabled} title={actionStates.toggleAreasPanel.reasonIfDisabled} /> Bereiche-Panel</label>
                <label className={styles.toolboxItem}><input type="checkbox" checked={navigationPanelOpen} onChange={(event) => setNavigationPanelOpen(event.target.checked)} disabled={!actionStates.panelNavigation.enabled} title={actionStates.panelNavigation.reasonIfDisabled} /> Navigation</label>
                <label className={styles.toolboxItem}><input type="checkbox" checked={cameraPresetPanelOpen} onChange={(event) => setCameraPresetPanelOpen(event.target.checked)} disabled={!actionStates.panelCamera.enabled} title={actionStates.panelCamera.reasonIfDisabled} /> Kamera</label>
                <label className={styles.toolboxItem}><input type="checkbox" checked={screenshotPanelOpen} onChange={(event) => setScreenshotPanelOpen(event.target.checked)} disabled={!actionStates.panelCapture.enabled} title={actionStates.panelCapture.reasonIfDisabled} /> Capture</label>
                <label className={styles.toolboxItem}><input type="checkbox" checked={renderEnvironmentPanelOpen} onChange={(event) => setRenderEnvironmentPanelOpen(event.target.checked)} disabled={!actionStates.panelRenderEnvironment.enabled} title={actionStates.panelRenderEnvironment.reasonIfDisabled} /> Render-Umgebung</label>
                {actionStates.panelDaylight.visible !== false && <label className={styles.toolboxItem}><input type="checkbox" checked={daylightPanelOpen} onChange={(event) => setDaylightPanelOpen(event.target.checked)} disabled={!actionStates.panelDaylight.enabled} title={actionStates.panelDaylight.reasonIfDisabled} /> Tageslicht</label>}
                {actionStates.panelMaterial.visible !== false && <label className={styles.toolboxItem}><input type="checkbox" checked={materialPanelOpen} onChange={(event) => setMaterialPanelOpen(event.target.checked)} disabled={!actionStates.panelMaterial.enabled} title={actionStates.panelMaterial.reasonIfDisabled} /> Materialien</label>}
              </div>
            )}
          </div>
          <div className={styles.cameraPresetWrapper} ref={cameraPresetPanelRef}>
            <button
              type='button'
              className={styles.btnSecondary}
              onClick={() => setCameraPresetPanelOpen((prev) => !prev)}
              disabled={!actionStates.panelCamera.enabled}
              title={actionStates.panelCamera.reasonIfDisabled}
            >
              Kamera
            </button>
            {cameraPresetPanelOpen && (
              <CameraPresetPanel
                presets={cameraPresets}
                activePresetId={activeCameraPresetId}
                loading={cameraPresetLoading}
                saving={cameraPresetSaving}
                cameraFovDeg={cameraFovDeg}
                onSetCameraFovDeg={(next) => setCameraFovDeg(clampPresetFov(next))}
                onSaveCurrentPreset={handleSaveCurrentCameraPreset}
                onApplyPreset={handleApplyCameraPreset}
                onDeletePreset={handleDeleteCameraPreset}
                onSetDefaultPreset={handleSetDefaultCameraPreset}
              />
            )}
          </div>
          <div className={styles.screenshotWrapper} ref={screenshotPanelRef}>
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={() => setScreenshotPanelOpen((prev) => !prev)}
              disabled={!actionStates.panelCapture.enabled}
              title={actionStates.panelCapture.reasonIfDisabled}
            >
              Capture
            </button>
            {screenshotPanelOpen && (
              <div className={styles.screenshotPanel}>
                <label className={styles.screenshotField}>
                  Format
                  <select
                    value={screenshotOptions.format}
                    onChange={(event) => setScreenshotOptions(normalizeScreenshotOptions({
                      ...screenshotOptions,
                      format: event.target.value === 'jpeg' ? 'jpeg' : 'png',
                    }))}
                  >
                    <option value="png">PNG</option>
                    <option value="jpeg">JPEG</option>
                  </select>
                </label>

                <label className={styles.screenshotField}>
                  Breite (px)
                  <input
                    type="number"
                    min={256}
                    max={8192}
                    value={screenshotOptions.width_px ?? ''}
                    onChange={(event) => setScreenshotOptions(normalizeScreenshotOptions({
                      ...screenshotOptions,
                      width_px: parseOptionalInt(event.target.value),
                    }))}
                    placeholder="auto"
                  />
                </label>

                <label className={styles.screenshotField}>
                  Hoehe (px)
                  <input
                    type="number"
                    min={256}
                    max={8192}
                    value={screenshotOptions.height_px ?? ''}
                    onChange={(event) => setScreenshotOptions(normalizeScreenshotOptions({
                      ...screenshotOptions,
                      height_px: parseOptionalInt(event.target.value),
                    }))}
                    placeholder="auto"
                  />
                </label>

                <label className={`${styles.screenshotField} ${styles.screenshotFieldFull}`}>
                  Qualitaet: {Math.round(screenshotOptions.quality * 100)}%
                  <input
                    type="range"
                    min={0.1}
                    max={1}
                    step={0.01}
                    value={screenshotOptions.quality}
                    onChange={(event) => setScreenshotOptions(normalizeScreenshotOptions({
                      ...screenshotOptions,
                      quality: Number(event.target.value),
                    }))}
                  />
                </label>

                <label className={`${styles.screenshotField} ${styles.screenshotFieldFull}`}>
                  <span>
                    <input
                      type="checkbox"
                      checked={screenshotOptions.transparent_background}
                      onChange={(event) => setScreenshotOptions(normalizeScreenshotOptions({
                        ...screenshotOptions,
                        transparent_background: event.target.checked,
                      }))}
                    />
                    {' '}Transparenter Hintergrund
                  </span>
                </label>

                <div className={styles.screenshotActions}>
                  <button
                    type="button"
                    className={styles.btnPrimary}
                    onClick={() => {
                      void handleCaptureScreenshot()
                    }}
                    disabled={!actionStates.captureScreenshot.enabled}
                    title={actionStates.captureScreenshot.reasonIfDisabled}
                  >
                    {screenshotBusy ? 'Screenshot...' : 'Screenshot'}
                  </button>
                  <button
                    type="button"
                    className={styles.btnSecondary}
                    onClick={() => {
                      void handleStartExport360()
                    }}
                    disabled={!actionStates.capture360.enabled}
                    title={actionStates.capture360.reasonIfDisabled}
                  >
                    {export360Busy ? '360...' : '360 Export'}
                  </button>
                </div>
                {export360Status && <div className={styles.screenshotMeta}>{export360Status}</div>}
              </div>
            )}
          </div>
          <div className={styles.moreMenuWrapper} ref={moreMenuRef}>
            <button
              type="button"
              className={styles.btnSecondary}
              aria-haspopup="true"
              onClick={() => setMoreMenuOpen((prev) => !prev)}
            >
              Mehr ▾
            </button>
            {moreMenuOpen && (
              <div className={styles.moreMenu} role="menu">
                <button
                  role="menuitem"
                  type="button"
                  className={styles.moreMenuItem}
                  onClick={() => { setMoreMenuOpen(false); void handleAutoComplete() }}
                  disabled={!actionStates.autoComplete.enabled}
                  title={actionStates.autoComplete.enabled
                    ? 'Arbeitsplatten, Sockel und Wangen automatisch generieren'
                    : actionStates.autoComplete.reasonIfDisabled}
                >
                  {autoCompleteLoading ? 'Generiere…' : 'Auto vervollständigen'}
                </button>
                <button
                  role="menuitem"
                  type="button"
                  className={styles.moreMenuItem}
                  onClick={() => { setMoreMenuOpen(false); setIsPreviewPopoutOpen((prev) => !prev) }}
                  disabled={!actionStates.previewPopout.enabled}
                  title={actionStates.previewPopout.enabled
                    ? '3D-Ansicht in separatem Fenster öffnen'
                    : actionStates.previewPopout.reasonIfDisabled}
                >
                  {isPreviewPopoutOpen ? '3D-Fenster schließen' : '3D in Fenster'}
                </button>
                <button
                  role="menuitem"
                  type="button"
                  className={styles.moreMenuItem}
                  onClick={() => { setMoreMenuOpen(false); navigate(`/projects/${id}/quote-lines`) }}
                  disabled={!actionStates.navQuoteLines.enabled}
                  title={actionStates.navQuoteLines.enabled ? 'Angebotspositionen oeffnen' : actionStates.navQuoteLines.reasonIfDisabled}
                >
                  Angebotspositionen
                </button>
                <button
                  role="menuitem"
                  type="button"
                  className={styles.moreMenuItem}
                  onClick={() => { setMoreMenuOpen(false); navigate(`/projects/${id}/panorama-tours`) }}
                  disabled={!actionStates.navPanoramaTours.enabled}
                  title={actionStates.navPanoramaTours.enabled ? 'Panorama-Touren oeffnen' : actionStates.navPanoramaTours.reasonIfDisabled}
                >
                  Panorama-Touren
                </button>
                {actionStates.presentationMode.visible !== false && (
                  <button
                    role="menuitem"
                    type="button"
                    className={styles.moreMenuItem}
                    onClick={() => { setMoreMenuOpen(false); navigate(`/projects/${id}/presentation?source=split-view`) }}
                    disabled={!actionStates.presentationMode.enabled}
                    title={actionStates.presentationMode.reasonIfDisabled}
                  >
                    Präsentationsmodus
                  </button>
                )}
                {actionStates.panelDaylight.visible !== false && (
                  <button
                    role="menuitem"
                    type="button"
                    className={styles.moreMenuItem}
                    onClick={() => { setMoreMenuOpen(false); setDaylightPanelOpen((prev) => !prev) }}
                    disabled={!actionStates.panelDaylight.enabled}
                    title={actionStates.panelDaylight.reasonIfDisabled}
                  >
                    {daylightPanelOpen ? 'Tageslichtpanel schließen' : 'Tageslichtpanel'}
                  </button>
                )}
                <button
                  role="menuitem"
                  type="button"
                  className={styles.moreMenuItem}
                  onClick={() => { setMoreMenuOpen(false); setRenderEnvironmentPanelOpen((prev) => !prev) }}
                  disabled={!actionStates.panelRenderEnvironment.enabled}
                  title={actionStates.panelRenderEnvironment.reasonIfDisabled}
                >
                  {renderEnvironmentPanelOpen ? 'Render-Umgebung schließen' : 'Render-Umgebung'}
                </button>
                {actionStates.panelMaterial.visible !== false && (
                  <button
                    role="menuitem"
                    type="button"
                    className={styles.moreMenuItem}
                    onClick={() => { setMoreMenuOpen(false); setMaterialPanelOpen((prev) => !prev) }}
                    disabled={!actionStates.panelMaterial.enabled}
                    title={actionStates.panelMaterial.reasonIfDisabled}
                  >
                    {materialPanelOpen ? 'Materialpanel schließen' : 'Materialpanel'}
                  </button>
                )}
                <button
                  role="menuitem"
                  type="button"
                  className={styles.moreMenuItem}
                  onClick={() => { setMoreMenuOpen(false); navigate(`/projects/${id}/specification-packages`) }}
                  disabled={!actionStates.navSpecificationPackages.enabled}
                  title={actionStates.navSpecificationPackages.enabled ? 'Werkstattpakete oeffnen' : actionStates.navSpecificationPackages.reasonIfDisabled}
                >
                  Werkstattpakete
                </button>
                <button
                  role="menuitem"
                  type="button"
                  className={styles.moreMenuItem}
                  onClick={() => { setMoreMenuOpen(false); navigate(`/projects/${id}/exports`) }}
                  disabled={!actionStates.navViewerExports.enabled}
                  title={actionStates.navViewerExports.enabled ? 'Viewer-Exports oeffnen' : actionStates.navViewerExports.reasonIfDisabled}
                >
                  Viewer-Exports
                </button>
                <button
                  role="menuitem"
                  type="button"
                  className={styles.moreMenuItem}
                  onClick={() => { setMoreMenuOpen(false); void handleGltfExport() }}
                  disabled={!actionStates.gltfExport.enabled}
                  title={actionStates.gltfExport.enabled ? 'Aktive Alternative als GLB exportieren' : actionStates.gltfExport.reasonIfDisabled}
                >
                  {gltfExportLoading ? 'GLB exportiere…' : 'GLB exportieren'}
                </button>
                <button
                  role="menuitem"
                  type="button"
                  className={styles.moreMenuItem}
                  onClick={() => { setMoreMenuOpen(false); void handleMarkAllDelivered() }}
                  disabled={!actionStates.markAllDelivered.enabled}
                  title={actionStates.markAllDelivered.enabled ? 'Alle Positionen als geliefert markieren' : actionStates.markAllDelivered.reasonIfDisabled}
                >
                  {bulkDeliveredLoading ? 'Markiere geliefert…' : 'Alles geliefert'}
                </button>
                <button
                  role="menuitem"
                  type="button"
                  className={styles.moreMenuItem}
                  onClick={() => { setMoreMenuOpen(false); setShowAreasPanel((prev) => !prev) }}
                  disabled={!actionStates.toggleAreasPanel.enabled}
                  title={actionStates.toggleAreasPanel.enabled ? 'Bereiche-Panel ein- oder ausblenden' : actionStates.toggleAreasPanel.reasonIfDisabled}
                >
                  {showAreasPanel ? 'Bereiche ausblenden' : 'Bereiche / Alternativen'}
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <CadToolbox
        mode={editorMode.mode}
        onSetMode={editorMode.setMode}
        workflowStep={workflow.step}
        onSetWorkflowStep={workflow.setStep}
        deleteVertexAction={polygonShortcutStates.deleteVertex}
        selectedVertexIndex={state.selectedIndex}
        selectedEdgeIndex={state.selectedEdgeIndex}
        canAddPlacement={selectedCatalogItem !== null}
        onAddOpeningForSelectedEdge={handleAddOpeningForSelectedEdge}
        onAddPlacementForSelectedEdge={handleAddPlacementForSelectedEdge}
        onDeleteSelectedVertex={handleDeleteSelectedVertex}
        safeEditMode={safeEditMode}
        onSetSafeEditMode={setSafeEditMode}
        editorSettings={{
          magnetismEnabled: state.settings.magnetismEnabled,
          axisMagnetismEnabled: state.settings.axisMagnetismEnabled,
          angleSnap: state.settings.angleSnap,
        }}
        onUpdateEditorSettings={editor.updateSettings}
        showAreasPanel={showAreasPanel}
        onSetShowAreasPanel={setShowAreasPanel}
        actionStates={actionStates}
      />

      {bulkDeliveredMessage && (
        <div className={bulkDeliveredError ? styles.bulkDeliveredError : styles.bulkDeliveredSuccess}>
          {bulkDeliveredMessage}
        </div>
      )}

      {screenshotMessage && (
        <div className={screenshotError ? styles.bulkDeliveredError : styles.bulkDeliveredSuccess}>
          {screenshotMessage}
        </div>
      )}

      {shortcutFeedback && (
        <div className={styles.shortcutFeedback}>{shortcutFeedback}</div>
      )}

      {id && (
        <LayoutSheetTabs
          projectId={id}
          activeLevelId={activeLevelId}
          activeSheetId={activeLayoutSheetId}
          onSheetChange={setActiveLayoutSheetId}
          showDaylightOptions={daylightEnabled}
        />
      )}

      {renderEnvironmentPanelOpen && (
        <div className={styles.renderEnvironmentDock}>
          <RenderEnvironmentPanel
            presets={renderEnvironmentPresets}
            environment={renderEnvironmentSettings}
            saving={renderEnvironmentSaving}
            onChange={handleRenderEnvironmentChange}
            onSave={handleSaveRenderEnvironment}
          />
        </div>
      )}

      {daylightEnabled && daylightPanelOpen && projectEnvironment && (
        <div className={`${styles.daylightDock} ${renderEnvironmentPanelOpen ? styles.daylightDockShifted : ''}`}>
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
              void handleRefreshSunPreview()
            }}
          />
        </div>
      )}

      {materialsEnabled && materialPanelOpen && id && (
        <div className={materialDockClassName}>
          <MaterialPanel
            projectId={id}
            room={selectedRoom as unknown as RoomPayload | null}
            onApplied={handleMaterialRoomPatch}
          />
        </div>
      )}

      <div className={styles.workspace}>
        {showAreasPanel && id && (
          <AreasPanel projectId={id} onOpenAlternative={setSelectedAlternativeId} />
        )}
        {leftSidebarVisible && <LeftSidebar
          levelsPanel={(
            <LevelsPanel
              levels={levels}
              activeLevelId={activeLevelId}
              onSelectLevel={setActiveLevelId}
              onToggleVisibility={handleToggleLevelVisibility}
              onCreateLevel={handleCreateLevel}
            />
          )}
          stairsPanel={(
            <StairsPanel
              enabled={stairsEnabled}
              levels={levels}
              connections={verticalConnections}
              activeLevelId={activeLevelId}
              selectedRoomId={selectedRoomId}
              onCreate={handleCreateVerticalConnection}
              onUpdate={handleUpdateVerticalConnection}
              onDelete={handleDeleteVerticalConnection}
            />
          )}
          sectionsPanel={(
            <SectionPanel
              enabled={multilevelDocsEnabled}
              hasSelectedRoom={Boolean(selectedRoomId)}
              activeLevelId={activeLevelId}
              levels={levels}
              sections={sectionLines}
              selectedSectionId={selectedSectionLineId}
              onSelect={setSelectedSectionLineId}
              onCreate={handleCreateSectionLine}
              onUpdate={handleUpdateSectionLine}
              onDelete={handleDeleteSectionLine}
            />
          )}
          rooms={roomsOnActiveLevel}
          selectedRoomId={selectedRoomId}
          onSelectRoom={setSelectedRoomId}
          onAddRoom={handleAddRoom}
          selectedCatalogItem={selectedCatalogItem}
          onSelectCatalogItem={setSelectedCatalogItem}
          workflowStep={workflow.step}
          projectId={id ?? null}
          pluginSlotEntries={sidebarPluginSlots}
          onNavigateToPath={navigate}
        />}

        <div className={styles.editorViewport} ref={captureRootRef}>
          {effectiveViewMode === '2d' && canvasPanel}

          {effectiveViewMode === '3d' && previewPanel}

          {effectiveViewMode === 'elevation' && elevationPanel}

          {effectiveViewMode === 'section' && sectionProjectionPanel}

          {effectiveViewMode === 'split' && (
            <div className={styles.splitLayout} ref={splitContainerRef}>
              <div className={`${styles.splitPane} ${styles.splitPanePrimary}`}>
                {canvasPanel}
              </div>
              <div
                className={styles.splitDivider}
                role="separator"
                aria-orientation="vertical"
                aria-label="Split-Ansicht verschieben"
                onMouseDown={() => setSplitDragging(true)}
              />
              <div className={`${styles.splitPane} ${styles.splitPaneSecondary}`}>
                {previewPanel}
              </div>
            </div>
          )}

          {effectiveViewMode === 'split3' && (
            <div className={styles.split3Layout}>
              <div className={styles.split3Left}>
                {canvasPanel}
              </div>
              <div className={styles.split3TopRight}>
                {previewPanel}
              </div>
              <div className={styles.split3BottomRight}>
                {elevationPanel ?? sectionProjectionPanel ?? previewPanel}
              </div>
            </div>
          )}
        </div>

        {rightSidebarVisible && <RightSidebar
          projectId={id ?? ''}
          room={selectedRoom}
          levels={levels}
          activeLevelId={activeLevelId}
          selectedVertexIndex={state.selectedIndex}
          selectedVertex={selectedVertex}
          selectedEdgeIndex={state.selectedEdgeIndex}
          dimensions={dimensions}
          edgeLengthMm={selEdgeLen}
          dimensionAssistSegments={dimensionAssistSegments}
          selectedOpening={selectedOpening}
          selectedPlacement={selectedPlacement}
          selectedCatalogItem={selectedCatalogItem}
          configuredDimensions={configuredDimensions}
          onConfigureDimensions={setConfiguredDimensions}
          chosenOptions={chosenOptions}
          onSetChosenOptions={setChosenOptions}
          ceilingConstraints={ceilingConstraints}
          selectedWallGeom={selectedWallGeom}
          selectedWallVisible={selectedWallVisible}
          selectedWallLocked={selectedWallLocked}
          onMoveVertex={editor.moveVertex}
          onSetEdgeLength={editor.setEdgeLength}
          onEdgeLengthDraftChange={setEdgeLengthPreviewMm}
          onUpdateOpening={handleUpdateOpening}
          onDeleteOpening={handleDeleteOpening}
          onUpdatePlacement={handleUpdatePlacement}
          onDeletePlacement={handleDeletePlacement}
          onSaveCeilingConstraints={handleSaveCeilingConstraints}
          validationResult={validationResult}
          validationLoading={validationLoading}
          onRunValidation={handleRunValidation}
          placements={placements}
          selectedRoomId={selectedRoomId}
          acousticEnabled={acousticEnabled}
          acousticOpacityPct={acousticOpacityPct}
          acousticVariable={acousticVariable}
          acousticGrids={acousticGrids}
          activeAcousticGridId={activeAcousticGridId}
          acousticMin={acousticMin}
          acousticMax={acousticMax}
          acousticBusy={acousticBusy}
          onToggleAcoustics={setAcousticEnabled}
          onSetAcousticOpacityPct={setAcousticOpacityPct}
          onSetAcousticVariable={handleSetAcousticVariable}
          onAcousticUpload={handleAcousticUpload}
          onSelectAcousticGrid={setActiveAcousticGridId}
          onDeleteAcousticGrid={handleDeleteAcousticGrid}
          safeEditMode={safeEditMode}
          onToggleSafeEditMode={setSafeEditMode}
          onToggleActiveLevelVisibility={handleSetActiveLevelVisibility}
          onSetDimensionsVisible={handleSetDimensionsVisible}
          onSetPlacementsVisible={handleSetPlacementsVisible}
          onSetSelectedWallVisible={handleSetSelectedWallVisible}
          autoDollhouse={autoDollhouseSettings}
          autoDollhouseSaving={autoDollhouseSaving}
          onSaveAutoDollhouse={handleSaveAutoDollhouse}
          onSetActiveLevelLocked={handleSetActiveLevelLocked}
          onSetDimensionsLocked={handleSetDimensionsLocked}
          onSetSelectedPlacementLocked={handleSetSelectedPlacementLocked}
          onSetSelectedWallLocked={handleSetSelectedWallLocked}
          drawingGroups={drawingGroups}
          selectedDrawingGroupId={selectedDrawingGroupId}
          currentSelectionMembers={currentSelectionMembers}
          onSelectDrawingGroup={handleSelectDrawingGroup}
          onCreateDrawingGroup={handleCreateDrawingGroup}
          onDeleteDrawingGroup={handleDeleteDrawingGroup}
          onApplyDrawingGroupTransform={handleApplyDrawingGroupTransform}
          onSyncDrawingGroupConfig={handleSyncDrawingGroupConfig}
        />}
      </div>

      {statusBarVisible && <StatusBar project={project} selectedRoom={selectedRoom} />}

      {isPreviewPopoutOpen && (
        <PopoutWindow
          title={`${project.name} - 3D Preview`}
          name={`okp-preview-${project.id}`}
          onClose={() => setIsPreviewPopoutOpen(false)}
        >
          <Preview3D
            room={selectedRoom as unknown as RoomPayload | null}
            verticalConnections={verticalConnectionsForSelectedRoom}
            cameraState={cameraState}
            onCameraStateChange={handleCameraStateChange}
            sunlight={daylightEnabled ? sunPreview : null}
            navigationSettings={navigationSettings}
            autoDollhouseSettings={autoDollhouseSettings}
            renderEnvironment={renderEnvironmentSettings}
            fovDeg={cameraFovDeg}
          />
        </PopoutWindow>
      )}
    </div>
  )
}
