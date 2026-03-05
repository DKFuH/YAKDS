import { useRef, useCallback, useEffect, useMemo, useState, type MouseEvent as ReactMouseEvent } from 'react'
import { Stage, Layer, Line, Circle, Group, Rect, Text, Image as KonvaImage } from 'react-konva'
import type Konva from 'konva'
import type { Point2D } from '@shared/types'
import type { Opening } from '../api/openings.js'
import type { Placement } from '../api/placements.js'
import type { Dimension } from '../api/dimensions.js'
import type { Centerline } from '../api/centerlines.js'
import type { GeoJsonGrid } from '../api/acoustics.js'
import type { VerticalConnection } from '../api/verticalConnections.js'
import type { EditorSettings, EditorState, EditorTool, SnapOverrideOptions } from './usePolygonEditor.js'
import { constrainOrthogonally, constrainToNearestSegmentAxis, type SnapSegment } from './snapUtils.js'
import { resolvePolygonShortcutStates } from './actionStateResolver.js'
import { CenterlineLayer } from '../components/canvas/CenterlineLayer.js'
import { AcousticOverlay } from '../pages/AcousticOverlay.js'
import { profileZoomFactor, type NavigationSettings } from '../components/editor/navigationSettings.js'
import styles from './PolygonEditor.module.css'

// ─── Koordinaten-Umrechnung ───────────────────────────────────────────────────
// Welt (mm) ↔ Canvas (px): 1px = SCALE mm

const SCALE = 0.15 // 1px = ~6,67mm → 5m Raum = 750px

function worldToCanvas(mm: number): number { return mm * SCALE }
function canvasToWorld(px: number): number { return px / SCALE }
function resolveColor(token: string, fallbackToken?: string): string {
  if (typeof window === 'undefined') return 'transparent'
  const styles = getComputedStyle(document.documentElement)
  const value = styles.getPropertyValue(token).trim()
  if (value) return value
  if (!fallbackToken) return 'transparent'
  return styles.getPropertyValue(fallbackToken).trim() || 'transparent'
}

// ─── Farben ───────────────────────────────────────────────────────────────────

const COLOR = {
  polygon: resolveColor('--primary-color'),
  polygonFill: resolveColor('--primary-light'),
  preview: resolveColor('--text-muted'),
  vertex: resolveColor('--primary-color'),
  vertexHover: resolveColor('--status-danger'),
  vertexSelected: resolveColor('--status-warning'),
  edgeSelected: resolveColor('--status-warning'),
  edgePreviewCommit: resolveColor('--status-success', '--primary-color'),
  edgePreviewDraft: resolveColor('--status-warning', '--primary-color'),
  edgePreviewGhost: resolveColor('--status-info', '--primary-color'),
  error: resolveColor('--status-danger'),
  errorFill: resolveColor('--status-danger-bg'),
  openingDoor: resolveColor('--status-info'),
  openingWindow: resolveColor('--status-info-soft', '--status-info'),
  openingPassThrough: resolveColor('--status-success'),
  openingSelected: resolveColor('--status-warning'),
  openingGroupHighlighted: resolveColor('--status-info', '--primary-color'),
  placementFill: resolveColor('--primary-soft', '--primary-light'),
  placementStroke: resolveColor('--primary-color'),
  placementSelectedFill: resolveColor('--status-warning'),
  placementSelectedStroke: resolveColor('--status-warning-strong', '--status-warning-text'),
  placementGroupHighlightedStroke: resolveColor('--status-info', '--primary-color'),
  centerline: resolveColor('--status-info', '--primary-color'),
  vertexStroke: resolveColor('--text-inverse'),
  verticalConnectionFill: resolveColor('--status-info-soft', '--primary-light'),
  verticalConnectionStroke: resolveColor('--status-info', '--primary-color'),
} as const

function openingColor(type: Opening['type'], selected: boolean) {
  if (selected) return COLOR.openingSelected
  if (type === 'window') return COLOR.openingWindow
  if (type === 'pass-through') return COLOR.openingPassThrough
  if (type === 'radiator') return resolveColor('--status-danger', '#e55')
  if (type === 'socket') return resolveColor('--status-warning', '#fa0')
  if (type === 'switch') return resolveColor('--status-warning', '#fa0')
  if (type === 'niche') return resolveColor('--text-muted', '#888')
  if (type === 'pipe') return resolveColor('--status-info', '#06f')
  return COLOR.openingDoor
}

type OutlinePoint = { x_mm: number; y_mm: number }
type WallSegmentMeta = {
  id?: string
  visible?: boolean
  is_hidden?: boolean
  locked?: boolean
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null
  }

  return value as Record<string, unknown>
}

function parseOutlinePoints(value: unknown): OutlinePoint[] {
  if (!Array.isArray(value)) return []

  const points: OutlinePoint[] = []
  for (const entry of value) {
    const point = asRecord(entry)
    if (!point) continue
    if (typeof point.x_mm !== 'number' || !Number.isFinite(point.x_mm)) continue
    if (typeof point.y_mm !== 'number' || !Number.isFinite(point.y_mm)) continue
    points.push({ x_mm: point.x_mm, y_mm: point.y_mm })
  }

  return points
}

function extractVerticalConnectionOutline(connection: VerticalConnection): OutlinePoint[] {
  const opening = asRecord(connection.opening_json)
  const openingOutline = parseOutlinePoints(opening?.opening_outline)
  if (openingOutline.length >= 3) {
    return openingOutline
  }

  const footprint = asRecord(connection.footprint_json)
  const vertices = parseOutlinePoints(footprint?.vertices)
  if (vertices.length >= 3) {
    return vertices
  }

  const polygon = parseOutlinePoints(footprint?.polygon)
  if (polygon.length >= 3) {
    return polygon
  }

  const rect = asRecord(footprint?.rect)
  if (!rect) return []

  const width = typeof rect.width_mm === 'number' && rect.width_mm > 0 ? rect.width_mm : null
  const depth = typeof rect.depth_mm === 'number' && rect.depth_mm > 0 ? rect.depth_mm : null
  if (width == null || depth == null) return []

  const x = typeof rect.x_mm === 'number' && Number.isFinite(rect.x_mm) ? rect.x_mm : 0
  const y = typeof rect.y_mm === 'number' && Number.isFinite(rect.y_mm) ? rect.y_mm : 0

  return [
    { x_mm: x, y_mm: y },
    { x_mm: x + width, y_mm: y },
    { x_mm: x + width, y_mm: y + depth },
    { x_mm: x, y_mm: y + depth },
  ]
}

// ─── Komponente ───────────────────────────────────────────────────────────────

interface Props {
  width: number
  height: number
  state: EditorState
  isValid: boolean
  onAddVertex: (p: Point2D, options?: SnapOverrideOptions) => void
  onClosePolygon: () => void
  onMoveVertex: (i: number, p: Point2D, options?: SnapOverrideOptions) => void
  onSelectVertex: (i: number | null) => void
  onSelectEdge: (i: number | null) => void
  onHoverVertex: (i: number | null) => void
  onDeleteVertex: (i: number) => void
  onUpdateSettings: (settings: Partial<EditorSettings>) => void
  onSetTool: (t: EditorTool) => void
  onReset: () => void
  onSave: () => void
  verticalConnections?: VerticalConnection[]
  openings?: Opening[]
  selectedOpeningId?: string | null
  onSelectOpening?: (id: string | null) => void
  onAddOpening?: (wallId: string, wallLengthMm: number) => void
  placements?: Placement[]
  selectedPlacementId?: string | null
  onSelectPlacement?: (id: string | null) => void
  highlightedOpeningIds?: string[]
  highlightedPlacementIds?: string[]
  canAddPlacement?: boolean
  onAddPlacement?: (wallId: string, wallLengthMm: number) => void
  wallSegments?: WallSegmentMeta[]
  dimensions?: Dimension[]
  centerlines?: Centerline[]
  onAddDimension?: (dimension: Pick<Dimension, 'type' | 'points' | 'style' | 'label'>) => void
  showCenterlines?: boolean
  onToggleCenterlines?: () => void
  acousticGrid?: GeoJsonGrid | null
  acousticVisible?: boolean
  acousticOpacity?: number
  edgeLengthPreviewMm?: number | null
  onReferenceImageUpdate?: (img: NonNullable<EditorState['referenceImage']>) => void
  navigationSettings: NavigationSettings
  virtualVisitor?: {
    x_mm: number
    y_mm: number
    yaw_rad: number
    visible?: boolean
  } | null
  onRepositionVisitor?: (point: { x_mm: number; y_mm: number }) => void
  safeEditMode?: boolean
  onShortcutBlocked?: (reason: string) => void
}

export function PolygonEditor({
  width, height, state, isValid,
  onAddVertex, onClosePolygon, onMoveVertex,
  onSelectVertex, onSelectEdge, onHoverVertex, onDeleteVertex,
  onUpdateSettings,
  onSetTool, onReset, onSave,
  verticalConnections = [],
  openings = [], selectedOpeningId, onSelectOpening, onAddOpening,
  placements = [], selectedPlacementId, onSelectPlacement, canAddPlacement, onAddPlacement,
  highlightedOpeningIds = [],
  highlightedPlacementIds = [],
  wallSegments = [],
  dimensions = [],
  centerlines = [],
  showCenterlines = false,
  onToggleCenterlines,
  acousticGrid = null,
  acousticVisible = false,
  acousticOpacity = 0.5,
  edgeLengthPreviewMm = null,
  onReferenceImageUpdate,
  navigationSettings,
  virtualVisitor = null,
  onRepositionVisitor,
  safeEditMode = false,
  onShortcutBlocked,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<Konva.Stage>(null)
  const calibrationPointsRef = useRef<Array<{ x: number; y: number }>>([])
  const middlePanActiveRef = useRef(false)
  const middlePanStartRef = useRef<{ pointerX: number; pointerY: number; offsetX: number; offsetY: number } | null>(null)
  const [dragLabel, setDragLabel] = useState<{ x: number; y: number; text: string } | null>(null)
  const [referenceImageElement, setReferenceImageElement] = useState<HTMLImageElement | null>(null)
  const [isOrthoModifierDown, setIsOrthoModifierDown] = useState(false)
  const [isMagnetismBypassDown, setIsMagnetismBypassDown] = useState(false)
  const [isBaseToleranceModifierDown, setIsBaseToleranceModifierDown] = useState(false)
  const [snapToleranceMode, setSnapToleranceMode] = useState<'auto' | 'base'>('auto')
  const [viewport, setViewport] = useState({ x: 0, y: 0, zoom: 1 })

  const dynamicMagnetismToleranceMm = useMemo(() => {
    const baseTolerance = state.settings.magnetismToleranceMm
    if (!Number.isFinite(baseTolerance) || baseTolerance <= 0) {
      return baseTolerance
    }

    const zoomFactor = Math.max(0.2, viewport.zoom)
    const scaledTolerance = baseTolerance / zoomFactor
    const minTolerance = Math.max(24, Math.round(baseTolerance * 0.35))
    const maxTolerance = Math.max(minTolerance, Math.round(baseTolerance * 2))
    return Math.max(minTolerance, Math.min(maxTolerance, Math.round(scaledTolerance)))
  }, [state.settings.magnetismToleranceMm, viewport.zoom])

  const magnetismEnabled = state.settings.magnetismEnabled || state.settings.axisMagnetismEnabled
  const baseMagnetismToleranceMm = state.settings.magnetismToleranceMm
  const useBaseMagnetismTolerance = snapToleranceMode === 'base' || isBaseToleranceModifierDown
  const selectedMagnetismToleranceMm = useBaseMagnetismTolerance
    ? baseMagnetismToleranceMm
    : dynamicMagnetismToleranceMm
  const isMagnetismIndicatorWarn = !magnetismEnabled || isMagnetismBypassDown || selectedMagnetismToleranceMm <= 0
  const toleranceRatio = !Number.isFinite(baseMagnetismToleranceMm) || baseMagnetismToleranceMm <= 0
    ? 1
    : selectedMagnetismToleranceMm / baseMagnetismToleranceMm
  const isMagnetismIndicatorActive = !isMagnetismIndicatorWarn
    && (toleranceRatio >= 1.35 || toleranceRatio <= 0.75)
  const effectiveMagnetismLabel = isMagnetismIndicatorWarn
    ? 'aus'
    : useBaseMagnetismTolerance
      ? `${selectedMagnetismToleranceMm} mm (Basis)`
      : `${selectedMagnetismToleranceMm} mm`
  const effectiveMagnetismTooltip = (() => {
    if (isMagnetismIndicatorWarn) {
      if (isMagnetismBypassDown && Number.isFinite(baseMagnetismToleranceMm) && baseMagnetismToleranceMm > 0) {
        return `Fangtoleranz: aus (Alt gedrueckt, Basis ${baseMagnetismToleranceMm} mm)`
      }

      if (!magnetismEnabled && Number.isFinite(baseMagnetismToleranceMm) && baseMagnetismToleranceMm > 0) {
        return `Fangtoleranz: aus (Punkt-/Achsenfang deaktiviert, Basis ${baseMagnetismToleranceMm} mm)`
      }

      return 'Fangtoleranz: aus'
    }

    if (useBaseMagnetismTolerance) {
      if (Number.isFinite(baseMagnetismToleranceMm) && baseMagnetismToleranceMm > 0) {
        return `Fangtoleranz: Basis-Modus aktiv (${baseMagnetismToleranceMm} mm). Klick wechselt auf Auto. Ctrl haelt den Basis-Modus temporaer.`
      }

      return 'Fangtoleranz: Basis-Modus aktiv. Klick wechselt auf Auto. Ctrl haelt den Basis-Modus temporaer.'
    }

    if (Number.isFinite(baseMagnetismToleranceMm) && baseMagnetismToleranceMm > 0) {
      return `Fangtoleranz (Basis -> Effektiv): ${baseMagnetismToleranceMm} mm -> ${selectedMagnetismToleranceMm} mm. Klick wechselt auf Basis.`
    }

    return `Fangtoleranz (Effektiv): ${selectedMagnetismToleranceMm} mm. Klick wechselt auf Basis.`
  })()

  function resolvePointerModifiers(evt?: { shiftKey?: boolean; altKey?: boolean; ctrlKey?: boolean } | null) {
    return {
      ortho: isOrthoModifierDown || Boolean(evt?.shiftKey),
      magnetismBypass: isMagnetismBypassDown || Boolean(evt?.altKey),
      forceBaseTolerance: isBaseToleranceModifierDown || Boolean(evt?.ctrlKey),
    }
  }

  function resolveActiveMagnetismToleranceMm(evt?: { ctrlKey?: boolean } | null): number {
    const forceBaseTolerance = isBaseToleranceModifierDown || Boolean(evt?.ctrlKey)
    return forceBaseTolerance ? baseMagnetismToleranceMm : dynamicMagnetismToleranceMm
  }
  const zoomPercent = Math.max(1, Math.round(viewport.zoom * 100))
  const zoomLabel = `${zoomPercent}%`
  const magnetismIndicatorClassName = `${styles.settingMeta} ${
    isMagnetismIndicatorWarn
      ? styles.settingMetaWarn
      : isMagnetismIndicatorActive
        ? styles.settingMetaActive
        : ''
  }`

  const resolveLogicalPointer = useCallback((stage: Konva.Stage) => {
    const pointer = stage.getPointerPosition()
    if (!pointer) {
      return null
    }

    return {
      x: (pointer.x - viewport.x) / viewport.zoom,
      y: (pointer.y - viewport.y) / viewport.zoom,
    }
  }, [viewport.x, viewport.y, viewport.zoom])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Shift') {
        setIsOrthoModifierDown(true)
      }
      if (event.key === 'Alt') {
        setIsMagnetismBypassDown(true)
      }
      if (event.key === 'Control') {
        setIsBaseToleranceModifierDown(true)
      }
    }

    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === 'Shift') {
        setIsOrthoModifierDown(false)
      }
      if (event.key === 'Alt') {
        setIsMagnetismBypassDown(false)
      }
      if (event.key === 'Control') {
        setIsBaseToleranceModifierDown(false)
      }
    }

    const onBlur = () => {
      setIsOrthoModifierDown(false)
      setIsMagnetismBypassDown(false)
      setIsBaseToleranceModifierDown(false)
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [])

  useEffect(() => {
    const url = state.referenceImage?.url
    if (!url) {
      setReferenceImageElement(null)
      return
    }

    const image = new window.Image()
    image.src = url
    image.onload = () => setReferenceImageElement(image)
  }, [state.referenceImage?.url])

  const handleStageClick = useCallback((_e: Konva.KonvaEventObject<MouseEvent>) => {
    if (middlePanActiveRef.current) {
      return
    }

    const stage = stageRef.current
    if (!stage) return
    const pos = resolveLogicalPointer(stage)
    if (!pos) return

    if (state.tool === 'calibrate' && state.referenceImage) {
      const currentImage = state.referenceImage
      const prev = calibrationPointsRef.current
      const next = prev.length === 2 ? [{ x: pos.x, y: pos.y }] : [...prev, { x: pos.x, y: pos.y }]
      calibrationPointsRef.current = next
      if (next.length !== 2) return

      const refLengthMm = Number(window.prompt('Referenzlänge in mm eingeben:'))
      if (!Number.isNaN(refLengthMm) && refLengthMm > 0) {
        const px = Math.hypot(next[1].x - next[0].x, next[1].y - next[0].y)
        const newCanvasScale = px / (refLengthMm * SCALE)
        onReferenceImageUpdate?.({ ...currentImage, scale: newCanvasScale })
      }
      calibrationPointsRef.current = []
      return
    }

    if (state.tool === 'select' && onRepositionVisitor) {
      onRepositionVisitor({ x_mm: canvasToWorld(pos.x), y_mm: canvasToWorld(pos.y) })
      return
    }

    if (state.tool !== 'draw') return
    if (safeEditMode) return

    const modifiers = resolvePointerModifiers(_e.evt)

    let point = { x_mm: canvasToWorld(pos.x), y_mm: canvasToWorld(pos.y) }
    const origin = state.vertices.at(-1)
    if (modifiers.ortho && origin) {
      point = constrainWithShiftModifier(point, { x_mm: origin.x_mm, y_mm: origin.y_mm })
    }

    // Child shapes (vertices, edges) set e.cancelBubble = true so they never reach here
    onAddVertex(point, {
      disableMagnetism: modifiers.magnetismBypass,
      magnetismToleranceMmOverride: resolveActiveMagnetismToleranceMm(_e.evt),
    })
  }, [resolveLogicalPointer, safeEditMode, state.tool, state.referenceImage, state.vertices, isOrthoModifierDown, isMagnetismBypassDown, isBaseToleranceModifierDown, baseMagnetismToleranceMm, dynamicMagnetismToleranceMm, constrainWithShiftModifier, onAddVertex, onReferenceImageUpdate, onRepositionVisitor])

  const handleStageDblClick = useCallback(() => {
    if (safeEditMode) return
    if (state.tool === 'draw' && state.vertices.length >= 3) onClosePolygon()
  }, [safeEditMode, state.tool, state.vertices.length, onClosePolygon])

  useEffect(() => {
    const isSelectedVertexLocked = (() => {
      if (state.selectedIndex === null || state.vertices.length < 2) {
        return false
      }

      const index = state.selectedIndex
      const prevEdgeIndex = (index - 1 + state.vertices.length) % state.vertices.length
      const currentWallLocked = Boolean(wallSegments[index]?.locked)
      const previousWallLocked = Boolean(wallSegments[prevEdgeIndex]?.locked)
      return currentWallLocked || previousWallLocked
    })()
    const shortcutStates = resolvePolygonShortcutStates({
      safeEditMode,
      selectedVertexIndex: state.selectedIndex,
      selectedEdgeIndex: state.selectedEdgeIndex,
      selectedVertexLocked: isSelectedVertexLocked,
    })

    function handleKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'd' || e.key === 'D') {
        if (shortcutStates.toolDraw.enabled) {
          onSetTool('draw')
        } else {
          onShortcutBlocked?.(shortcutStates.toolDraw.reasonIfDisabled ?? 'Zeichnen ist nicht verfuegbar')
        }
      }
      if (e.key === 's' || e.key === 'S') {
        if (shortcutStates.toolSelect.enabled) {
          onSetTool('select')
        } else {
          onShortcutBlocked?.(shortcutStates.toolSelect.reasonIfDisabled ?? 'Auswahl ist nicht verfuegbar')
        }
      }
      if (e.key === 'Backspace' || e.key === 'Delete') {
        if (shortcutStates.deleteVertex.enabled && state.selectedIndex !== null) {
          onDeleteVertex(state.selectedIndex)
        } else {
          onShortcutBlocked?.(shortcutStates.deleteVertex.reasonIfDisabled ?? 'Punkt kann nicht geloescht werden')
        }
      }
      if (e.key === 'Escape' && shortcutStates.clearSelection.enabled) {
        onSelectVertex(null)
        onSelectEdge(null)
      } else if (e.key === 'Escape') {
        onShortcutBlocked?.(shortcutStates.clearSelection.reasonIfDisabled ?? 'Keine Auswahl aktiv')
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [safeEditMode, wallSegments, state.selectedIndex, state.selectedEdgeIndex, state.vertices.length, onSetTool, onDeleteVertex, onSelectVertex, onSelectEdge, onShortcutBlocked])

  useEffect(() => {
    const onMouseMove = (event: MouseEvent) => {
      if (!middlePanActiveRef.current || !middlePanStartRef.current) {
        return
      }

      const start = middlePanStartRef.current
      setViewport((prev) => ({
        ...prev,
        x: start.offsetX + (event.clientX - start.pointerX),
        y: start.offsetY + (event.clientY - start.pointerY),
      }))
    }

    const onMouseUp = () => {
      middlePanActiveRef.current = false
      middlePanStartRef.current = null
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [])

  const handleStageWheel = useCallback((event: Konva.KonvaEventObject<WheelEvent>) => {
    event.evt.preventDefault()

    const stage = stageRef.current
    if (!stage) {
      return
    }

    const pointer = stage.getPointerPosition()
    if (!pointer) {
      return
    }

    const isTrackpadPan =
      navigationSettings.touchpad_mode === 'trackpad'
      && !event.evt.ctrlKey
      && Math.abs(event.evt.deltaX) + Math.abs(event.evt.deltaY) > 0

    if (isTrackpadPan) {
      setViewport((prev) => ({
        ...prev,
        x: prev.x - event.evt.deltaX,
        y: prev.y - event.evt.deltaY,
      }))
      return
    }

    const logicalX = (pointer.x - viewport.x) / viewport.zoom
    const logicalY = (pointer.y - viewport.y) / viewport.zoom
    const directionMultiplier = navigationSettings.zoom_direction === 'inverted' ? -1 : 1
    const directionalDelta = event.evt.deltaY * directionMultiplier
    const baseFactor = navigationSettings.touchpad_mode === 'trackpad'
      ? 1 + 0.02 * profileZoomFactor(navigationSettings.navigation_profile)
      : 1 + 0.08 * profileZoomFactor(navigationSettings.navigation_profile)
    const zoomFactor = directionalDelta > 0 ? 1 / baseFactor : baseFactor
    const nextZoom = Math.min(4, Math.max(0.35, viewport.zoom * zoomFactor))

    setViewport({
      x: pointer.x - logicalX * nextZoom,
      y: pointer.y - logicalY * nextZoom,
      zoom: nextZoom,
    })
  }, [navigationSettings, viewport.x, viewport.y, viewport.zoom])

  const handleResetZoom = useCallback(() => {
    const targetZoom = 1
    const logicalCenterX = (width / 2 - viewport.x) / viewport.zoom
    const logicalCenterY = (height / 2 - viewport.y) / viewport.zoom

    setViewport({
      x: width / 2 - logicalCenterX * targetZoom,
      y: height / 2 - logicalCenterY * targetZoom,
      zoom: targetZoom,
    })
  }, [height, viewport.x, viewport.y, viewport.zoom, width])

  const handleToggleSnapToleranceMode = useCallback(() => {
    setSnapToleranceMode((prev) => (prev === 'auto' ? 'base' : 'auto'))
  }, [])

  const handleContainerMouseDown = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    if (event.button !== 1 || !navigationSettings.middle_mouse_pan) {
      return
    }

    event.preventDefault()
    middlePanActiveRef.current = true
    middlePanStartRef.current = {
      pointerX: event.clientX,
      pointerY: event.clientY,
      offsetX: viewport.x,
      offsetY: viewport.y,
    }
  }, [navigationSettings.middle_mouse_pan, viewport.x, viewport.y])

  const pts = state.vertices.map(v => ({
    x: worldToCanvas(v.x_mm),
    y: worldToCanvas(v.y_mm),
  }))
  const highlightedOpeningSet = new Set(highlightedOpeningIds)
  const highlightedPlacementSet = new Set(highlightedPlacementIds)

  const wallVisibleByIndex = state.vertices.map((_, index) => {
    const segment = wallSegments[index]
    if (!segment) return true
    if (typeof segment.visible === 'boolean') return segment.visible
    if (typeof segment.is_hidden === 'boolean') return !segment.is_hidden
    return true
  })

  const wallLockedByIndex = state.vertices.map((_, index) => {
    const segment = wallSegments[index]
    return Boolean(segment?.locked)
  })

  const alignmentSegments = useMemo(() => {
    if (state.vertices.length < 2) {
      return [] as SnapSegment[]
    }

    const edgeCount = state.closed ? state.vertices.length : state.vertices.length - 1
    const segments: SnapSegment[] = []
    for (let i = 0; i < edgeCount; i += 1) {
      const nextIndex = (i + 1) % state.vertices.length
      const start = state.vertices[i]
      const end = state.vertices[nextIndex]
      segments.push({
        start: { x_mm: start.x_mm, y_mm: start.y_mm },
        end: { x_mm: end.x_mm, y_mm: end.y_mm },
      })
    }

    return segments
  }, [state.closed, state.vertices])

  function constrainWithShiftModifier(point: Point2D, origin: Point2D): Point2D {
    const orthogonalCandidate = constrainOrthogonally(point, origin)
    if (alignmentSegments.length === 0) {
      return orthogonalCandidate
    }

    const segmentAxisCandidate = constrainToNearestSegmentAxis(point, origin, alignmentSegments)
    const orthDx = orthogonalCandidate.x_mm - point.x_mm
    const orthDy = orthogonalCandidate.y_mm - point.y_mm
    const orthDistSq = orthDx * orthDx + orthDy * orthDy

    const axisDx = segmentAxisCandidate.x_mm - point.x_mm
    const axisDy = segmentAxisCandidate.y_mm - point.y_mm
    const axisDistSq = axisDx * axisDx + axisDy * axisDy

    return axisDistSq < orthDistSq ? segmentAxisCandidate : orthogonalCandidate
  }

  const isWallEditable = useCallback((index: number) => {
    return wallVisibleByIndex[index] !== false && !wallLockedByIndex[index]
  }, [wallLockedByIndex, wallVisibleByIndex])

  const isVertexLocked = useCallback((index: number) => {
    if (state.vertices.length < 2) {
      return false
    }

    const prevEdgeIndex = (index - 1 + state.vertices.length) % state.vertices.length
    return Boolean(wallLockedByIndex[index] || wallLockedByIndex[prevEdgeIndex])
  }, [state.vertices.length, wallLockedByIndex])

  const linePoints = pts.flatMap(p => [p.x, p.y])
  const closedLinePoints = state.closed
    ? [...linePoints, pts[0]?.x, pts[0]?.y].filter(n => n !== undefined) as number[]
    : linePoints

  const hasErrors = state.validationErrors.length > 0

  // Öffnungs-Hilfsfunktion: Canvas-Koordinaten berechnen
  function openingCanvasCoords(opening: Opening) {
    const wallIdx = state.wallIds.indexOf(opening.wall_id)
    if (wallIdx < 0 || wallIdx >= pts.length) return null
    const p0 = pts[wallIdx]
    const p1 = pts[(wallIdx + 1) % pts.length]
    const dx = p1.x - p0.x
    const dy = p1.y - p0.y
    const len = Math.hypot(dx, dy)
    if (len === 0) return null
    const dirX = dx / len
    const dirY = dy / len
    const scaledOffset = worldToCanvas(opening.offset_mm)
    const scaledWidth = worldToCanvas(opening.width_mm)
    return {
      x1: p0.x + dirX * scaledOffset,
      y1: p0.y + dirY * scaledOffset,
      x2: p0.x + dirX * (scaledOffset + scaledWidth),
      y2: p0.y + dirY * (scaledOffset + scaledWidth),
    }
  }

  // Öffnung hinzufügen für ausgewählte Wand
  function handleAddOpeningForSelectedEdge() {
    if (state.selectedEdgeIndex === null || !onAddOpening || !isWallEditable(state.selectedEdgeIndex)) return
    const i = state.selectedEdgeIndex
    const wallId = state.wallIds[i]
    const vI = state.vertices[i]
    const vNext = state.vertices[(i + 1) % state.vertices.length]
    const wallLen = Math.hypot(vNext.x_mm - vI.x_mm, vNext.y_mm - vI.y_mm)
    onAddOpening(wallId, wallLen)
  }

  // Platzierung hinzufügen für ausgewählte Wand
  function handleAddPlacementForSelectedEdge() {
    if (state.selectedEdgeIndex === null || !onAddPlacement || !isWallEditable(state.selectedEdgeIndex)) return
    const i = state.selectedEdgeIndex
    const wallId = state.wallIds[i]
    const vI = state.vertices[i]
    const vNext = state.vertices[(i + 1) % state.vertices.length]
    const wallLen = Math.hypot(vNext.x_mm - vI.x_mm, vNext.y_mm - vI.y_mm)
    onAddPlacement(wallId, wallLen)
  }

  // Canvas-Koordinaten für Placement berechnen
  function placementCanvasCoords(placement: Placement) {
    const wallIdx = state.wallIds.indexOf(placement.wall_id)
    if (wallIdx < 0 || wallIdx >= pts.length) return null
    const p0 = pts[wallIdx]
    const p1 = pts[(wallIdx + 1) % pts.length]
    const dx = p1.x - p0.x
    const dy = p1.y - p0.y
    const len = Math.hypot(dx, dy)
    if (len === 0) return null
    const dirX = dx / len
    const dirY = dy / len
    const scaledOffset = worldToCanvas(placement.offset_mm)
    const scaledWidth = worldToCanvas(placement.width_mm)
    return {
      x1: p0.x + dirX * scaledOffset,
      y1: p0.y + dirY * scaledOffset,
      x2: p0.x + dirX * (scaledOffset + scaledWidth),
      y2: p0.y + dirY * (scaledOffset + scaledWidth),
    }
  }

  return (
    <div
      ref={containerRef}
      className={styles.container}
      onMouseDown={handleContainerMouseDown}
    >
      {/* ── Toolbar ── */}
      <div className={styles.toolbar}>
        <ToolBtn active={state.tool === 'draw'} onClick={() => onSetTool('draw')}>Zeichnen</ToolBtn>
        <ToolBtn active={state.tool === 'select'} onClick={() => onSetTool('select')}>Auswählen</ToolBtn>
        {isOrthoModifierDown && <span className={styles.modifierBadge}>ORTHO</span>}
        {isMagnetismBypassDown && <span className={styles.modifierBadge}>MAG OFF</span>}
        {isBaseToleranceModifierDown && <span className={styles.modifierBadge}>BASE TOL</span>}
        <label className={styles.settingToggle} title="Punktfang ein/aus">
          <input
            type="checkbox"
            checked={state.settings.magnetismEnabled}
            onChange={(event) => onUpdateSettings({ magnetismEnabled: event.target.checked })}
          />
          Punktfang
        </label>
        <label className={styles.settingToggle} title="Fang auf Wandachsen/Projektionen ein/aus">
          <input
            type="checkbox"
            checked={state.settings.axisMagnetismEnabled}
            onChange={(event) => onUpdateSettings({ axisMagnetismEnabled: event.target.checked })}
          />
          Achsenfang
        </label>
        <label className={styles.settingField} title="Längenraster in mm für direkte Kantenlängen-Eingaben">
          L-Snap
          <input
            className={styles.settingInput}
            type="number"
            min="0"
            step="10"
            value={state.settings.lengthSnapStepMm}
            onChange={(event) => {
              const value = Number(event.target.value)
              if (!Number.isFinite(value) || value < 0) return
              onUpdateSettings({ lengthSnapStepMm: Math.round(value) })
            }}
          />
        </label>
        <button
          type="button"
          className={`${magnetismIndicatorClassName} ${styles.settingMetaButton}`}
          title={effectiveMagnetismTooltip}
          onClick={handleToggleSnapToleranceMode}
        >
          Fang: {effectiveMagnetismLabel}
        </button>
        <button
          type="button"
          className={`${styles.settingMeta} ${styles.settingMetaSubtle} ${styles.settingMetaButton}`}
          title="Aktuelle Zoom-Stufe auf dem Canvas. Klick: auf 100% zurücksetzen"
          onClick={handleResetZoom}
        >
          Zoom: {zoomLabel}
        </button>
        <label className={styles.toolBtn} title="Grundriss laden">
          📷 Laden
          <input
            type="file"
            accept="image/*"
            className={styles.hiddenFileInput}
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (!file) return
              const url = URL.createObjectURL(file)
              onReferenceImageUpdate?.({
                url,
                x: 50,
                y: 50,
                rotation: 0,
                scale: 1,
                opacity: 0.5,
              })
              e.target.value = ''
            }}
          />
        </label>
        {state.referenceImage && (
          <ToolBtn active={state.tool === 'calibrate'} onClick={() => onSetTool('calibrate')}>
            Kalibrieren
          </ToolBtn>
        )}
        {state.referenceImage && (
          <input
            className={styles.referenceOpacitySlider}
            type="range"
            min="0.1"
            max="1"
            step="0.05"
            value={state.referenceImage.opacity}
            onChange={(e) => onReferenceImageUpdate?.({
              ...state.referenceImage!,
              opacity: Number(e.target.value),
            })}
            title="Transparenz Referenzbild"
          />
        )}
        {!state.closed && state.vertices.length >= 3 && (
          <button type="button" className={styles.closeBtn} onClick={onClosePolygon}>Polygon schließen</button>
        )}
        {state.tool === 'select' && state.selectedEdgeIndex !== null && onAddOpening && isWallEditable(state.selectedEdgeIndex) && (
          <button type="button" className={styles.toolBtn} onClick={handleAddOpeningForSelectedEdge}>
            + Öffnung
          </button>
        )}
        {state.tool === 'select' && state.selectedEdgeIndex !== null && canAddPlacement && onAddPlacement && isWallEditable(state.selectedEdgeIndex) && (
          <button type="button" className={styles.toolBtn} onClick={handleAddPlacementForSelectedEdge}>
            + Platzieren
          </button>
        )}
        {state.closed && (placements.length > 0 || centerlines.length > 0) && onToggleCenterlines && (
          <ToolBtn active={showCenterlines} onClick={onToggleCenterlines}>
            ⊕ Mittellinien
          </ToolBtn>
        )}
        <button type="button" className={styles.resetBtn} onClick={onReset}>Zurücksetzen</button>
        <div className={styles.spacer} />
        {state.validationErrors.length > 0 && (
          <span className={styles.errorBadge}>{state.validationErrors[0]}</span>
        )}
        {isValid && (
          <button type="button" className={styles.saveBtn} onClick={onSave}>Speichern</button>
        )}
      </div>

      {/* ── Canvas ── */}
      <Stage
        ref={stageRef}
        width={width}
        height={height}
        x={viewport.x}
        y={viewport.y}
        scaleX={viewport.zoom}
        scaleY={viewport.zoom}
        onClick={handleStageClick}
        onDblClick={handleStageDblClick}
        onWheel={handleStageWheel}
        className={state.tool === 'draw' || state.tool === 'calibrate' ? styles.stageCrosshair : styles.stageDefault}
      >
        <AcousticOverlay
          grid={acousticGrid}
          opacity={acousticOpacity}
          visible={acousticVisible}
          stageScale={SCALE}
        />

        <Layer>
          {state.referenceImage && referenceImageElement && (
            <KonvaImage
              image={referenceImageElement}
              x={state.referenceImage.x}
              y={state.referenceImage.y}
              rotation={state.referenceImage.rotation}
              scaleX={state.referenceImage.scale}
              scaleY={state.referenceImage.scale}
              opacity={state.referenceImage.opacity}
              draggable
              onDragEnd={(e) => {
                onReferenceImageUpdate?.({
                  ...state.referenceImage!,
                  x: e.target.x(),
                  y: e.target.y(),
                })
              }}
            />
          )}

          {/* Polygon-Fläche */}
          {state.closed && pts.length >= 3 && (
            <Line
              points={closedLinePoints}
              closed
              fill={hasErrors ? COLOR.errorFill : COLOR.polygonFill}
              stroke={hasErrors ? COLOR.error : COLOR.polygon}
              strokeWidth={2}
            />
          )}

          {/* Offene Linien */}
          {!state.closed && pts.length >= 2 && (
            <Line points={linePoints} stroke={COLOR.preview} strokeWidth={2} dash={[8, 4]} />
          )}

          {state.closed && (
            <Group listening={false}>
              {verticalConnections.map((connection) => {
                const outline = extractVerticalConnectionOutline(connection)
                if (outline.length < 3) {
                  return null
                }

                const overlayPoints = outline.flatMap((point) => [worldToCanvas(point.x_mm), worldToCanvas(point.y_mm)])
                return (
                  <Line
                    key={`vc-overlay-${connection.id}`}
                    points={overlayPoints}
                    closed
                    fill={COLOR.verticalConnectionFill}
                    stroke={COLOR.verticalConnectionStroke}
                    strokeWidth={1}
                    dash={[6, 4]}
                  />
                )
              })}
            </Group>
          )}

          {/* Klickbare Kantensegmente (select-Modus) */}
          {state.closed && state.tool === 'select' && (
            <Group>
              {pts.map((p, i) => {
                if (!wallVisibleByIndex[i]) return null
                const next = pts[(i + 1) % pts.length]
                const isEdgeSelected = state.selectedEdgeIndex === i
                return (
                  <Line
                    key={state.wallIds[i] ?? i}
                    points={[p.x, p.y, next.x, next.y]}
                    stroke={isEdgeSelected ? COLOR.edgeSelected : 'transparent'}
                    strokeWidth={isEdgeSelected ? 4 : 12}
                    hitStrokeWidth={12}
                    dash={wallLockedByIndex[i] ? [6, 4] : undefined}
                    onClick={(e) => {
                      e.cancelBubble = true
                      onSelectEdge(isEdgeSelected ? null : i)
                    }}
                  />
                )
              })}
            </Group>
          )}

          {/* Mittelpunkt-Griffe für Wand-Verschiebung */}
          {state.closed && state.tool === 'select' && (
            <Group>
              {pts.map((p, i) => {
                if (!wallVisibleByIndex[i]) return null
                const next = pts[(i + 1) % pts.length]
                const mx = (p.x + next.x) / 2
                const my = (p.y + next.y) / 2
                const wallLocked = wallLockedByIndex[i]
                return (
                  <Rect
                    key={`mid-${state.wallIds[i] ?? i}`}
                    x={mx}
                    y={my}
                    width={10}
                    height={10}
                    offsetX={5}
                    offsetY={5}
                    rotation={45}
                    fill={COLOR.edgeSelected}
                    opacity={0.85}
                    draggable={!safeEditMode && !wallLocked}
                    onDragMove={(e) => {
                      if (safeEditMode || wallLocked) {
                        e.target.x(mx)
                        e.target.y(my)
                        return
                      }
                      const modifiers = resolvePointerModifiers(e.evt)
                      const dx = canvasToWorld(e.target.x() - mx)
                      const dy = canvasToWorld(e.target.y() - my)
                      const iV = i
                      const iNext = (i + 1) % state.vertices.length
                      const vI = state.vertices[iV]
                      const vNext = state.vertices[iNext]
                      onMoveVertex(iV, { x_mm: vI.x_mm + dx, y_mm: vI.y_mm + dy }, {
                        disableMagnetism: modifiers.magnetismBypass,
                        magnetismToleranceMmOverride: resolveActiveMagnetismToleranceMm(e.evt),
                      })
                      onMoveVertex(iNext, { x_mm: vNext.x_mm + dx, y_mm: vNext.y_mm + dy }, {
                        disableMagnetism: modifiers.magnetismBypass,
                        magnetismToleranceMmOverride: resolveActiveMagnetismToleranceMm(e.evt),
                      })
                      e.target.x(mx)
                      e.target.y(my)
                    }}
                  />
                )
              })}
            </Group>
          )}

          {state.closed && (
            <Group listening={false}>
              {pts.map((p, i) => {
                if (!wallVisibleByIndex[i] || !wallLockedByIndex[i]) {
                  return null
                }
                const next = pts[(i + 1) % pts.length]
                const mx = (p.x + next.x) / 2
                const my = (p.y + next.y) / 2
                return (
                  <Text
                    key={`wall-lock-${state.wallIds[i] ?? i}`}
                    x={mx - 6}
                    y={my - 18}
                    text="🔒"
                    fontSize={12}
                    fill={COLOR.edgeSelected}
                  />
                )
              })}
            </Group>
          )}

          {/* Öffnungen an Wänden */}
          {state.closed && (
            <Group>
              {openings.map(opening => {
                const coords = openingCanvasCoords(opening)
                if (!coords) return null
                const isSelected = opening.id === selectedOpeningId
                const isGroupHighlighted = highlightedOpeningSet.has(opening.id)
                const dx = coords.x2 - coords.x1
                const dy = coords.y2 - coords.y1
                const len = Math.hypot(dx, dy)
                const normX = len === 0 ? 0 : -dy / len
                const normY = len === 0 ? 0 : dx / len
                return (
                  <Group key={opening.id}>
                    <Line
                      points={[coords.x1, coords.y1, coords.x2, coords.y2]}
                      stroke={
                        isSelected
                          ? openingColor(opening.type, true)
                          : isGroupHighlighted
                            ? COLOR.openingGroupHighlighted
                            : openingColor(opening.type, false)
                      }
                      strokeWidth={
                        isSelected ? 6
                          : isGroupHighlighted ? 5
                          : opening.type === 'radiator' ? 6
                            : opening.type === 'niche' ? 8
                              : 4
                      }
                      dash={
                        opening.type === 'pipe' ? [4, 4]
                          : opening.type === 'socket' ? [2, 2]
                            : undefined
                      }
                      hitStrokeWidth={10}
                      lineCap="round"
                      onClick={(e) => {
                        e.cancelBubble = true
                        onSelectOpening?.(isSelected ? null : opening.id)
                      }}
                    />
                    {opening.wall_offset_depth_mm && opening.wall_offset_depth_mm > 0 && (
                      <Line
                        key={`${opening.id}-depth`}
                        points={[
                          coords.x1 + normX * worldToCanvas(opening.wall_offset_depth_mm),
                          coords.y1 + normY * worldToCanvas(opening.wall_offset_depth_mm),
                          coords.x2 + normX * worldToCanvas(opening.wall_offset_depth_mm),
                          coords.y2 + normY * worldToCanvas(opening.wall_offset_depth_mm),
                        ]}
                        stroke={openingColor(opening.type, false)}
                        strokeWidth={1}
                        dash={[4, 4]}
                        opacity={0.5}
                      />
                    )}
                  </Group>
                )
              })}
            </Group>
          )}

          {/* Bemaßungslinien */}
          {state.closed && (
            <Group>
              {state.selectedEdgeIndex !== null && edgeLengthPreviewMm !== null && edgeLengthPreviewMm > 0 && (() => {
                const i = state.selectedEdgeIndex
                const start = pts[i]
                const end = pts[(i + 1) % pts.length]
                if (!start || !end) return null

                const dx = end.x - start.x
                const dy = end.y - start.y
                const len = Math.hypot(dx, dy)
                if (len === 0) return null

                const nx = -dy / len
                const ny = dx / len
                const offsetPx = worldToCanvas(100)
                const x1 = start.x + nx * offsetPx
                const y1 = start.y + ny * offsetPx
                const x2 = end.x + nx * offsetPx
                const y2 = end.y + ny * offsetPx
                const currentLengthMm = canvasToWorld(len)
                const isDraft = Math.abs(edgeLengthPreviewMm - currentLengthMm) > 0.5
                const previewColor = isDraft ? COLOR.edgePreviewDraft : COLOR.edgePreviewCommit

                const dirX = dx / len
                const dirY = dy / len
                const targetLenPx = worldToCanvas(edgeLengthPreviewMm)
                const ghostX = start.x + dirX * targetLenPx
                const ghostY = start.y + dirY * targetLenPx
                const showGhost = isDraft && Math.hypot(ghostX - end.x, ghostY - end.y) > worldToCanvas(2)
                const label = `${Math.round(edgeLengthPreviewMm)} mm${isDraft ? ' (Draft)' : ''}`

                return (
                  <Group key={`edge-preview-${i}`} listening={false}>
                    <Line points={[start.x, start.y, x1, y1]} stroke={previewColor} strokeWidth={1} dash={[4, 2]} />
                    <Line points={[end.x, end.y, x2, y2]} stroke={previewColor} strokeWidth={1} dash={[4, 2]} />
                    {isDraft && (
                      <Line
                        points={[
                          start.x + nx * worldToCanvas(72),
                          start.y + ny * worldToCanvas(72),
                          end.x + nx * worldToCanvas(72),
                          end.y + ny * worldToCanvas(72),
                        ]}
                        stroke={COLOR.edgePreviewCommit}
                        strokeWidth={1}
                        opacity={0.7}
                      />
                    )}
                    <Line points={[x1, y1, x2, y2]} stroke={previewColor} strokeWidth={2} dash={isDraft ? [6, 3] : undefined} />
                    {showGhost && (
                      <>
                        <Line points={[end.x, end.y, ghostX, ghostY]} stroke={COLOR.edgePreviewGhost} strokeWidth={1} dash={[3, 3]} />
                        <Circle x={ghostX} y={ghostY} radius={4} fill={COLOR.edgePreviewGhost} opacity={0.85} />
                      </>
                    )}
                    <Text
                      x={(x1 + x2) / 2 - 28}
                      y={(y1 + y2) / 2 - 10}
                      text={label}
                      fontSize={11}
                      fill={previewColor}
                    />
                  </Group>
                )
              })()}

              {dimensions.filter((dimension) => dimension.visible !== false).map((dimension) => {
                if (dimension.type !== 'linear' || dimension.points.length < 2) return null

                const p1 = {
                  x: worldToCanvas(dimension.points[0].x_mm),
                  y: worldToCanvas(dimension.points[0].y_mm),
                }
                const p2 = {
                  x: worldToCanvas(dimension.points[1].x_mm),
                  y: worldToCanvas(dimension.points[1].y_mm),
                }
                const style = dimension.style as { offset_mm?: number }
                const offsetPx = worldToCanvas(style.offset_mm ?? 50)
                const dx = p2.x - p1.x
                const dy = p2.y - p1.y
                const len = Math.hypot(dx, dy)
                if (len === 0) return null

                const nx = -dy / len
                const ny = dx / len
                const lx1 = p1.x + nx * offsetPx
                const ly1 = p1.y + ny * offsetPx
                const lx2 = p2.x + nx * offsetPx
                const ly2 = p2.y + ny * offsetPx

                const lengthMm = Math.round(Math.hypot(
                  dimension.points[1].x_mm - dimension.points[0].x_mm,
                  dimension.points[1].y_mm - dimension.points[0].y_mm,
                ))
                const label = dimension.label ?? `${lengthMm} mm`

                return (
                  <Group key={dimension.id}>
                    <Line points={[lx1, ly1, lx2, ly2]} stroke={COLOR.preview} strokeWidth={1} dash={[4, 2]} />
                    <Text
                      x={(lx1 + lx2) / 2 - 24}
                      y={(ly1 + ly2) / 2 - 8}
                      text={label}
                      fontSize={10}
                      fill={COLOR.polygon}
                    />
                  </Group>
                )
              })}
            </Group>
          )}

          {/* Centerlines (persistierte Mittellinien) */}
          {state.closed && showCenterlines && (
            <CenterlineLayer
              centerlines={centerlines}
              worldToCanvas={worldToCanvas}
              stroke={COLOR.centerline}
            />
          )}

          {/* Platzierungen an Wänden */}
          {state.closed && (
            <Group>
              {placements.filter((placement) => placement.visible !== false).map(placement => {
                const coords = placementCanvasCoords(placement)
                if (!coords) return null
                const isSelected = placement.id === selectedPlacementId
                const isGroupHighlighted = highlightedPlacementSet.has(placement.id)
                const isLocked = Boolean(placement.locked)
                const midX = (coords.x1 + coords.x2) / 2
                const midY = (coords.y1 + coords.y2) / 2
                const dx = coords.x2 - coords.x1
                const dy = coords.y2 - coords.y1
                const angle = Math.atan2(dy, dx) * 180 / Math.PI
                const w = Math.hypot(dx, dy)
                const d = worldToCanvas(placement.depth_mm)
                return (
                  <Group key={placement.id}>
                    <Rect
                      x={midX}
                      y={midY}
                      width={w}
                      height={Math.max(d, 4)}
                      offsetX={w / 2}
                      offsetY={Math.max(d, 4) / 2}
                      rotation={angle}
                      fill={isSelected ? COLOR.placementSelectedFill : COLOR.placementFill}
                      stroke={
                        isSelected
                          ? COLOR.placementSelectedStroke
                          : isGroupHighlighted
                            ? COLOR.placementGroupHighlightedStroke
                            : COLOR.placementStroke
                      }
                      strokeWidth={isSelected || isGroupHighlighted ? 2 : 1}
                      dash={isLocked ? [5, 3] : undefined}
                      opacity={0.7}
                      onClick={(e) => {
                        e.cancelBubble = true
                        onSelectPlacement?.(isSelected ? null : placement.id)
                      }}
                    />
                    {isLocked && (
                      <Text
                        x={midX - 6}
                        y={midY - 8}
                        text="🔒"
                        fontSize={12}
                        fill={COLOR.placementSelectedStroke}
                      />
                    )}
                  </Group>
                )
              })}
            </Group>
          )}

          {/* Virtual Visitor */}
          {virtualVisitor?.visible !== false && (
            <Group>
              <Line
                points={(() => {
                  const x = worldToCanvas(virtualVisitor?.x_mm ?? 0)
                  const y = worldToCanvas(virtualVisitor?.y_mm ?? 0)
                  const yaw = virtualVisitor?.yaw_rad ?? 0
                  const coneLength = worldToCanvas(900)
                  const halfAngle = 0.35
                  const x1 = x + Math.cos(yaw - halfAngle) * coneLength
                  const y1 = y + Math.sin(yaw - halfAngle) * coneLength
                  const x2 = x + Math.cos(yaw + halfAngle) * coneLength
                  const y2 = y + Math.sin(yaw + halfAngle) * coneLength
                  return [x, y, x1, y1, x2, y2]
                })()}
                closed
                fill="rgba(56, 189, 248, 0.18)"
                stroke={resolveColor('--status-info', '#38bdf8')}
                strokeWidth={1}
              />
              <Line
                points={(() => {
                  const x = worldToCanvas(virtualVisitor?.x_mm ?? 0)
                  const y = worldToCanvas(virtualVisitor?.y_mm ?? 0)
                  const yaw = virtualVisitor?.yaw_rad ?? 0
                  const rayLength = worldToCanvas(1050)
                  return [x, y, x + Math.cos(yaw) * rayLength, y + Math.sin(yaw) * rayLength]
                })()}
                stroke={resolveColor('--status-info', '#38bdf8')}
                strokeWidth={2}
                dash={[6, 4]}
              />
              <Circle
                x={worldToCanvas(virtualVisitor?.x_mm ?? 0)}
                y={worldToCanvas(virtualVisitor?.y_mm ?? 0)}
                radius={7}
                fill={resolveColor('--status-info', '#38bdf8')}
                stroke={resolveColor('--text-inverse', '#fff')}
                strokeWidth={2}
              />
            </Group>
          )}

          {/* Vertices */}
          <Group>
            {pts.map((p, i) => {
              const isHover = state.hoverIndex === i
              const isSelected = state.selectedIndex === i
              const vertexLocked = isVertexLocked(i)
              const color = isSelected ? COLOR.vertexSelected
                : isHover ? COLOR.vertexHover
                : COLOR.vertex

              return (
                <Circle
                  key={state.vertices[i].id}
                  x={p.x}
                  y={p.y}
                  radius={isSelected || isHover ? 8 : 6}
                  fill={color}
                  stroke={COLOR.vertexStroke}
                  strokeWidth={2}
                  draggable={state.tool === 'select' && !safeEditMode && !vertexLocked}
                  onMouseEnter={() => onHoverVertex(i)}
                  onMouseLeave={() => onHoverVertex(null)}
                  onClick={(e) => {
                    e.cancelBubble = true
                    if (state.tool === 'draw' && i === 0 && state.vertices.length >= 3 && !safeEditMode) {
                      onClosePolygon()
                    } else {
                      onSelectVertex(isSelected ? null : i)
                    }
                  }}
                  onDblClick={(e) => {
                    e.cancelBubble = true
                    if (state.tool === 'select' && !safeEditMode && !vertexLocked) onDeleteVertex(i)
                  }}
                  onDragEnd={(e) => {
                    if (safeEditMode || vertexLocked) {
                      e.target.x(p.x)
                      e.target.y(p.y)
                      setDragLabel(null)
                      return
                    }

                    const rawPoint = {
                      x_mm: canvasToWorld(e.target.x()),
                      y_mm: canvasToWorld(e.target.y()),
                    }
                    const modifiers = resolvePointerModifiers(e.evt)
                    const nextPoint = modifiers.ortho
                      ? constrainWithShiftModifier(rawPoint, { x_mm: state.vertices[i].x_mm, y_mm: state.vertices[i].y_mm })
                      : rawPoint

                    setDragLabel(null)
                    onMoveVertex(i, nextPoint, {
                      disableMagnetism: modifiers.magnetismBypass,
                      magnetismToleranceMmOverride: resolveActiveMagnetismToleranceMm(e.evt),
                    })
                  }}
                  onDragMove={(e) => {
                    if (safeEditMode || vertexLocked) {
                      e.target.x(p.x)
                      e.target.y(p.y)
                      return
                    }

                    const rawX = e.target.x()
                    const rawY = e.target.y()
                    const modifiers = resolvePointerModifiers(e.evt)
                    const constrainedCanvas = modifiers.ortho
                      ? (() => {
                        const constrained = constrainWithShiftModifier(
                          { x_mm: canvasToWorld(rawX), y_mm: canvasToWorld(rawY) },
                          { x_mm: state.vertices[i].x_mm, y_mm: state.vertices[i].y_mm },
                        )
                        return { x: worldToCanvas(constrained.x_mm), y: worldToCanvas(constrained.y_mm) }
                      })()
                      : { x: rawX, y: rawY }

                    e.target.x(constrainedCanvas.x)
                    e.target.y(constrainedCanvas.y)

                    const x = constrainedCanvas.x
                    const y = constrainedCanvas.y
                    const nextIdx = (i + 1) % pts.length
                    const prevIdx = (i - 1 + pts.length) % pts.length
                    const toNext = Math.hypot(
                      canvasToWorld(pts[nextIdx].x - x),
                      canvasToWorld(pts[nextIdx].y - y),
                    )
                    const toPrev = Math.hypot(
                      canvasToWorld(pts[prevIdx].x - x),
                      canvasToWorld(pts[prevIdx].y - y),
                    )
                    const activeLen = state.selectedEdgeIndex === i ? toPrev : toNext
                    setDragLabel({
                      x: x + 12,
                      y: y - 16,
                      text: `${Math.round(activeLen)} mm`,
                    })
                  }}
                />
              )
            })}
          </Group>

          {dragLabel && (
            <Group>
              <Rect
                x={dragLabel.x - 4}
                y={dragLabel.y - 12}
                width={dragLabel.text.length * 7 + 8}
                height={18}
                fill="rgba(0,0,0,0.75)"
                cornerRadius={3}
              />
              <Text
                x={dragLabel.x}
                y={dragLabel.y - 10}
                text={dragLabel.text}
                fill="white"
                fontSize={12}
                fontFamily="monospace"
              />
            </Group>
          )}
        </Layer>
      </Stage>

      {/* ── Info ── */}
      <div className={styles.info}>
        {state.tool === 'draw' && !state.closed && (
          <span>Klick: Punkt setzen · Doppelklick oder erster Punkt: Polygon schließen</span>
        )}
        {state.tool === 'select' && (
          <span>Ziehen: Punkt/Wand verschieben · Doppelklick: löschen · Shift=Align (H/V + Nachbarwand-Winkel) · Alt=Magnet aus · Ctrl=Basis-Fangtoleranz · D=Zeichnen · S=Auswählen · Esc=Abwählen · Mausrad=Zoom · Fangtoleranz passt sich Zoom an</span>
        )}
        {safeEditMode && (
          <span>Safe-Edit aktiv: Geometrieänderungen sind gesperrt.</span>
        )}
        {state.tool === 'calibrate' && state.referenceImage && (
          <span>Kalibrieren: Zwei Punkte anklicken, dann Referenzlänge eingeben</span>
        )}
        <span className={styles.vertexCount}>{state.vertices.length} Punkte · {openings.length} Öffnungen · {verticalConnections.length} Treppen</span>
      </div>
    </div>
  )
}

function ToolBtn({ active, onClick, children }: {
  active: boolean; onClick: () => void; children: React.ReactNode
}) {
  return (
    <button
      type="button"
      className={`${styles.toolBtn} ${active ? styles.toolBtnActive : ''}`}
      onClick={onClick}
    >
      {children}
    </button>
  )
}
