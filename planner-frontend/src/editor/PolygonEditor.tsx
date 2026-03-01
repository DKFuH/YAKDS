import { useRef, useCallback } from 'react'
import { Stage, Layer, Line, Circle, Group } from 'react-konva'
import type Konva from 'konva'
import type { Point2D } from '@shared/types'
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
} as const

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
}

export function PolygonEditor({
  width, height, state, isValid,
  onAddVertex, onClosePolygon, onMoveVertex,
  onSelectVertex, onSelectEdge, onHoverVertex, onDeleteVertex,
  onSetTool, onReset, onSave,
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

  return (
    <div className={styles.container}>
      {/* ── Toolbar ── */}
      <div className={styles.toolbar}>
        <ToolBtn active={state.tool === 'draw'} onClick={() => onSetTool('draw')}>Zeichnen</ToolBtn>
        <ToolBtn active={state.tool === 'select'} onClick={() => onSetTool('select')}>Auswählen</ToolBtn>
        {!state.closed && state.vertices.length >= 3 && (
          <button type="button" className={styles.closeBtn} onClick={onClosePolygon}>Polygon schließen</button>
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
          <span>Ziehen: Punkt verschieben · Doppelklick auf Punkt: löschen · Kante klicken: auswählen</span>
        )}
        <span className={styles.vertexCount}>{state.vertices.length} Punkte</span>
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
