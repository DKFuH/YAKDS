import { useRef, useCallback, useEffect, useState } from 'react'
import { Stage, Layer, Line, Circle, Group, Rect, Text, Image as KonvaImage } from 'react-konva'
import type Konva from 'konva'
import type { Point2D } from '@shared/types'
import type { Opening } from '../api/openings.js'
import type { Placement } from '../api/placements.js'
import type { Dimension } from '../api/dimensions.js'
import type { Centerline } from '../api/centerlines.js'
import type { GeoJsonGrid } from '../api/acoustics.js'
import type { EditorState, EditorTool } from './usePolygonEditor.js'
import { CenterlineLayer } from '../components/canvas/CenterlineLayer.js'
import { AcousticOverlay } from '../pages/AcousticOverlay.js'
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
  error: resolveColor('--status-danger'),
  errorFill: resolveColor('--status-danger-bg'),
  openingDoor: resolveColor('--status-info'),
  openingWindow: resolveColor('--status-info-soft', '--status-info'),
  openingPassThrough: resolveColor('--status-success'),
  openingSelected: resolveColor('--status-warning'),
  placementFill: resolveColor('--primary-soft', '--primary-light'),
  placementStroke: resolveColor('--primary-color'),
  placementSelectedFill: resolveColor('--status-warning'),
  placementSelectedStroke: resolveColor('--status-warning-strong', '--status-warning-text'),
  centerline: resolveColor('--status-info', '--primary-color'),
  vertexStroke: resolveColor('--text-inverse'),
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

// ─── Komponente ───────────────────────────────────────────────────────────────

interface Props {
  width: number
  height: number
  state: EditorState
  isValid: boolean
  onAddVertex: (p: Point2D) => void
  onClosePolygon: () => void
  onMoveVertex: (i: number, p: Point2D) => void
  onSelectVertex: (i: number | null) => void
  onSelectEdge: (i: number | null) => void
  onHoverVertex: (i: number | null) => void
  onDeleteVertex: (i: number) => void
  onSetTool: (t: EditorTool) => void
  onReset: () => void
  onSave: () => void
  openings?: Opening[]
  selectedOpeningId?: string | null
  onSelectOpening?: (id: string | null) => void
  onAddOpening?: (wallId: string, wallLengthMm: number) => void
  placements?: Placement[]
  selectedPlacementId?: string | null
  onSelectPlacement?: (id: string | null) => void
  canAddPlacement?: boolean
  onAddPlacement?: (wallId: string, wallLengthMm: number) => void
  dimensions?: Dimension[]
  centerlines?: Centerline[]
  onAddDimension?: (dimension: Pick<Dimension, 'type' | 'points' | 'style' | 'label'>) => void
  showCenterlines?: boolean
  onToggleCenterlines?: () => void
  acousticGrid?: GeoJsonGrid | null
  acousticVisible?: boolean
  acousticOpacity?: number
  onReferenceImageUpdate?: (img: NonNullable<EditorState['referenceImage']>) => void
  virtualVisitor?: {
    x_mm: number
    y_mm: number
    yaw_rad: number
    visible?: boolean
  } | null
  onRepositionVisitor?: (point: { x_mm: number; y_mm: number }) => void
}

export function PolygonEditor({
  width, height, state, isValid,
  onAddVertex, onClosePolygon, onMoveVertex,
  onSelectVertex, onSelectEdge, onHoverVertex, onDeleteVertex,
  onSetTool, onReset, onSave,
  openings = [], selectedOpeningId, onSelectOpening, onAddOpening,
  placements = [], selectedPlacementId, onSelectPlacement, canAddPlacement, onAddPlacement,
  dimensions = [],
  centerlines = [],
  showCenterlines = false,
  onToggleCenterlines,
  acousticGrid = null,
  acousticVisible = false,
  acousticOpacity = 0.5,
  onReferenceImageUpdate,
  virtualVisitor = null,
  onRepositionVisitor,
}: Props) {
  const stageRef = useRef<Konva.Stage>(null)
  const calibrationPointsRef = useRef<Array<{ x: number; y: number }>>([])
  const [dragLabel, setDragLabel] = useState<{ x: number; y: number; text: string } | null>(null)
  const [referenceImageElement, setReferenceImageElement] = useState<HTMLImageElement | null>(null)

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
    const pos = stageRef.current?.getPointerPosition()
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
    // Child shapes (vertices, edges) set e.cancelBubble = true so they never reach here
    onAddVertex({ x_mm: canvasToWorld(pos.x), y_mm: canvasToWorld(pos.y) })
  }, [state.tool, state.referenceImage, onAddVertex, onReferenceImageUpdate, onRepositionVisitor])

  const handleStageDblClick = useCallback(() => {
    if (state.tool === 'draw' && state.vertices.length >= 3) onClosePolygon()
  }, [state.tool, state.vertices.length, onClosePolygon])

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'd' || e.key === 'D') onSetTool('draw')
      if (e.key === 's' || e.key === 'S') onSetTool('select')
      if ((e.key === 'Backspace' || e.key === 'Delete') && state.selectedIndex !== null) {
        onDeleteVertex(state.selectedIndex)
      }
      if (e.key === 'Escape') {
        onSelectVertex(null)
        onSelectEdge(null)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [state.selectedIndex, state.tool, onSetTool, onDeleteVertex, onSelectVertex, onSelectEdge])

  const pts = state.vertices.map(v => ({
    x: worldToCanvas(v.x_mm),
    y: worldToCanvas(v.y_mm),
  }))

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
    if (state.selectedEdgeIndex === null || !onAddOpening) return
    const i = state.selectedEdgeIndex
    const wallId = state.wallIds[i]
    const vI = state.vertices[i]
    const vNext = state.vertices[(i + 1) % state.vertices.length]
    const wallLen = Math.hypot(vNext.x_mm - vI.x_mm, vNext.y_mm - vI.y_mm)
    onAddOpening(wallId, wallLen)
  }

  // Platzierung hinzufügen für ausgewählte Wand
  function handleAddPlacementForSelectedEdge() {
    if (state.selectedEdgeIndex === null || !onAddPlacement) return
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
    <div className={styles.container}>
      {/* ── Toolbar ── */}
      <div className={styles.toolbar}>
        <ToolBtn active={state.tool === 'draw'} onClick={() => onSetTool('draw')}>Zeichnen</ToolBtn>
        <ToolBtn active={state.tool === 'select'} onClick={() => onSetTool('select')}>Auswählen</ToolBtn>
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
        {state.tool === 'select' && state.selectedEdgeIndex !== null && onAddOpening && (
          <button type="button" className={styles.toolBtn} onClick={handleAddOpeningForSelectedEdge}>
            + Öffnung
          </button>
        )}
        {state.tool === 'select' && state.selectedEdgeIndex !== null && canAddPlacement && onAddPlacement && (
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
        onClick={handleStageClick}
        onDblClick={handleStageDblClick}
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

          {/* Klickbare Kantensegmente (select-Modus) */}
          {state.closed && state.tool === 'select' && (
            <Group>
              {pts.map((p, i) => {
                const next = pts[(i + 1) % pts.length]
                const isEdgeSelected = state.selectedEdgeIndex === i
                return (
                  <Line
                    key={state.wallIds[i] ?? i}
                    points={[p.x, p.y, next.x, next.y]}
                    stroke={isEdgeSelected ? COLOR.edgeSelected : 'transparent'}
                    strokeWidth={isEdgeSelected ? 4 : 12}
                    hitStrokeWidth={12}
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
                const next = pts[(i + 1) % pts.length]
                const mx = (p.x + next.x) / 2
                const my = (p.y + next.y) / 2
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
                    draggable
                    onDragMove={(e) => {
                      const dx = canvasToWorld(e.target.x() - mx)
                      const dy = canvasToWorld(e.target.y() - my)
                      const iV = i
                      const iNext = (i + 1) % state.vertices.length
                      const vI = state.vertices[iV]
                      const vNext = state.vertices[iNext]
                      onMoveVertex(iV, { x_mm: vI.x_mm + dx, y_mm: vI.y_mm + dy })
                      onMoveVertex(iNext, { x_mm: vNext.x_mm + dx, y_mm: vNext.y_mm + dy })
                      e.target.x(mx)
                      e.target.y(my)
                    }}
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
                const dx = coords.x2 - coords.x1
                const dy = coords.y2 - coords.y1
                const len = Math.hypot(dx, dy)
                const normX = len === 0 ? 0 : -dy / len
                const normY = len === 0 ? 0 : dx / len
                return (
                  <Group key={opening.id}>
                    <Line
                      points={[coords.x1, coords.y1, coords.x2, coords.y2]}
                      stroke={openingColor(opening.type, isSelected)}
                      strokeWidth={
                        isSelected ? 6
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
              {dimensions.map((dimension) => {
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
              {placements.map(placement => {
                const coords = placementCanvasCoords(placement)
                if (!coords) return null
                const isSelected = placement.id === selectedPlacementId
                const midX = (coords.x1 + coords.x2) / 2
                const midY = (coords.y1 + coords.y2) / 2
                const dx = coords.x2 - coords.x1
                const dy = coords.y2 - coords.y1
                const angle = Math.atan2(dy, dx) * 180 / Math.PI
                const w = Math.hypot(dx, dy)
                const d = worldToCanvas(placement.depth_mm)
                return (
                  <Rect
                    key={placement.id}
                    x={midX}
                    y={midY}
                    width={w}
                    height={Math.max(d, 4)}
                    offsetX={w / 2}
                    offsetY={Math.max(d, 4) / 2}
                    rotation={angle}
                    fill={isSelected ? COLOR.placementSelectedFill : COLOR.placementFill}
                    stroke={isSelected ? COLOR.placementSelectedStroke : COLOR.placementStroke}
                    strokeWidth={isSelected ? 2 : 1}
                    opacity={0.7}
                    onClick={(e) => {
                      e.cancelBubble = true
                      onSelectPlacement?.(isSelected ? null : placement.id)
                    }}
                  />
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
                  draggable={state.tool === 'select'}
                  onMouseEnter={() => onHoverVertex(i)}
                  onMouseLeave={() => onHoverVertex(null)}
                  onClick={(e) => {
                    e.cancelBubble = true
                    if (state.tool === 'draw' && i === 0 && state.vertices.length >= 3) {
                      onClosePolygon()
                    } else {
                      onSelectVertex(isSelected ? null : i)
                    }
                  }}
                  onDblClick={(e) => {
                    e.cancelBubble = true
                    if (state.tool === 'select') onDeleteVertex(i)
                  }}
                  onDragEnd={(e) => {
                    setDragLabel(null)
                    onMoveVertex(i, {
                      x_mm: canvasToWorld(e.target.x()),
                      y_mm: canvasToWorld(e.target.y()),
                    })
                  }}
                  onDragMove={(e) => {
                    const x = e.target.x()
                    const y = e.target.y()
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
          <span>Ziehen: Punkt/Wand verschieben · Doppelklick: löschen · D=Zeichnen · S=Auswählen · Esc=Abwählen</span>
        )}
        {state.tool === 'calibrate' && state.referenceImage && (
          <span>Kalibrieren: Zwei Punkte anklicken, dann Referenzlänge eingeben</span>
        )}
        <span className={styles.vertexCount}>{state.vertices.length} Punkte · {openings.length} Öffnungen</span>
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
