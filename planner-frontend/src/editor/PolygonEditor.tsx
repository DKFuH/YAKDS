import { useRef, useCallback } from 'react'
import { Stage, Layer, Line, Circle, Group } from 'react-konva'
import type Konva from 'konva'
import type { Point2D } from '@shared/types'
import type { Opening } from '../api/openings.js'
import type { EditorState, EditorTool } from './usePolygonEditor.js'
import styles from './PolygonEditor.module.css'

// ─── Koordinaten-Umrechnung ───────────────────────────────────────────────────
// Welt (mm) ↔ Canvas (px): 1px = SCALE mm

const SCALE = 0.15 // 1px = ~6,67mm → 5m Raum = 750px

function worldToCanvas(mm: number): number { return mm * SCALE }
function canvasToWorld(px: number): number { return px / SCALE }

// ─── Farben ───────────────────────────────────────────────────────────────────

const COLOR = {
  polygon: '#6366f1',
  polygonFill: '#6366f120',
  preview: '#94a3b8',
  vertex: '#6366f1',
  vertexHover: '#ef4444',
  vertexSelected: '#f59e0b',
  edgeSelected: '#f59e0b',
  error: '#ef4444',
  openingDoor: '#3b82f6',
  openingWindow: '#06b6d4',
  openingPassThrough: '#10b981',
  openingSelected: '#f97316',
} as const

function openingColor(type: Opening['type'], selected: boolean) {
  if (selected) return COLOR.openingSelected
  if (type === 'window') return COLOR.openingWindow
  if (type === 'pass-through') return COLOR.openingPassThrough
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
}

export function PolygonEditor({
  width, height, state, isValid,
  onAddVertex, onClosePolygon, onMoveVertex,
  onSelectVertex, onSelectEdge, onHoverVertex, onDeleteVertex,
  onSetTool, onReset, onSave,
  openings = [], selectedOpeningId, onSelectOpening, onAddOpening,
}: Props) {
  const stageRef = useRef<Konva.Stage>(null)

  const handleStageClick = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    if (state.tool !== 'draw') return
    if (e.target !== stageRef.current) return
    const pos = stageRef.current!.getPointerPosition()!
    onAddVertex({ x_mm: canvasToWorld(pos.x), y_mm: canvasToWorld(pos.y) })
  }, [state.tool, onAddVertex])

  const handleStageDblClick = useCallback(() => {
    if (state.tool === 'draw' && state.vertices.length >= 3) onClosePolygon()
  }, [state.tool, state.vertices.length, onClosePolygon])

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

  return (
    <div className={styles.container}>
      {/* ── Toolbar ── */}
      <div className={styles.toolbar}>
        <ToolBtn active={state.tool === 'draw'} onClick={() => onSetTool('draw')}>Zeichnen</ToolBtn>
        <ToolBtn active={state.tool === 'select'} onClick={() => onSetTool('select')}>Auswählen</ToolBtn>
        {!state.closed && state.vertices.length >= 3 && (
          <button type="button" className={styles.closeBtn} onClick={onClosePolygon}>Polygon schließen</button>
        )}
        {state.tool === 'select' && state.selectedEdgeIndex !== null && onAddOpening && (
          <button type="button" className={styles.toolBtn} onClick={handleAddOpeningForSelectedEdge}>
            + Öffnung
          </button>
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
        style={{ cursor: state.tool === 'draw' ? 'crosshair' : 'default' }}
      >
        <Layer>
          {/* Polygon-Fläche */}
          {state.closed && pts.length >= 3 && (
            <Line
              points={closedLinePoints}
              closed
              fill={hasErrors ? '#ef444415' : COLOR.polygonFill}
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

          {/* Öffnungen an Wänden */}
          {state.closed && (
            <Group>
              {openings.map(opening => {
                const coords = openingCanvasCoords(opening)
                if (!coords) return null
                const isSelected = opening.id === selectedOpeningId
                return (
                  <Line
                    key={opening.id}
                    points={[coords.x1, coords.y1, coords.x2, coords.y2]}
                    stroke={openingColor(opening.type, isSelected)}
                    strokeWidth={isSelected ? 6 : 4}
                    hitStrokeWidth={10}
                    lineCap="round"
                    onClick={(e) => {
                      e.cancelBubble = true
                      onSelectOpening?.(isSelected ? null : opening.id)
                    }}
                  />
                )
              })}
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
                  stroke="#fff"
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
                    onMoveVertex(i, {
                      x_mm: canvasToWorld(e.target.x()),
                      y_mm: canvasToWorld(e.target.y()),
                    })
                  }}
                />
              )
            })}
          </Group>
        </Layer>
      </Stage>

      {/* ── Info ── */}
      <div className={styles.info}>
        {state.tool === 'draw' && !state.closed && (
          <span>Klick: Punkt setzen · Doppelklick oder erster Punkt: Polygon schließen</span>
        )}
        {state.tool === 'select' && (
          <span>Ziehen: Punkt verschieben · Doppelklick: löschen · Kante/Öffnung klicken: auswählen</span>
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
