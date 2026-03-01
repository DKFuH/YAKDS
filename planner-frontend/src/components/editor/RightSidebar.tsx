import { useEffect, useState } from 'react'
import type { Vertex, Point2D } from '@shared/types'
import type { Room } from '../../api/projects.js'
import styles from './RightSidebar.module.css'

interface Props {
  room: Room | null
  selectedVertexIndex: number | null
  selectedVertex: Vertex | null
  selectedEdgeIndex: number | null
  edgeLengthMm: number | null
  onMoveVertex: (index: number, pos: Point2D) => void
  onSetEdgeLength: (edgeIndex: number, lengthMm: number) => void
}

export function RightSidebar({
  room,
  selectedVertexIndex, selectedVertex,
  selectedEdgeIndex, edgeLengthMm,
  onMoveVertex, onSetEdgeLength,
}: Props) {
  return (
    <aside className={styles.sidebar}>
      {/* ── Punkt-Eigenschaften ── */}
      {selectedVertex !== null && selectedVertexIndex !== null ? (
        <VertexPanel
          key={selectedVertex.id}
          index={selectedVertexIndex}
          vertex={selectedVertex}
          onMove={onMoveVertex}
        />
      ) : selectedEdgeIndex !== null && edgeLengthMm !== null ? (
        <EdgePanel
          key={selectedEdgeIndex}
          edgeIndex={selectedEdgeIndex}
          lengthMm={edgeLengthMm}
          onSetLength={onSetEdgeLength}
        />
      ) : (
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Eigenschaften</h3>
          {room ? (
            <dl className={styles.props}>
              <dt>Raumhöhe</dt>
              <dd>{(room.ceiling_height_mm / 1000).toFixed(2)} m</dd>
              <dt>Platzierungen</dt>
              <dd>{(room.placements as unknown[]).length}</dd>
            </dl>
          ) : (
            <p className={styles.empty}>Kein Objekt ausgewählt</p>
          )}
        </div>
      )}

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Prüfungen</h3>
        <p className={styles.empty}>Sprint 9 – folgt</p>
      </div>

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Dachschrägen</h3>
        <p className={styles.empty}>Sprint 6 – folgt</p>
      </div>
    </aside>
  )
}

// ─── Vertex-Panel ─────────────────────────────────────────────────────────────

function VertexPanel({ index, vertex, onMove }: {
  index: number
  vertex: Vertex
  onMove: (i: number, pos: Point2D) => void
}) {
  const [xVal, setXVal] = useState(String(Math.round(vertex.x_mm)))
  const [yVal, setYVal] = useState(String(Math.round(vertex.y_mm)))

  useEffect(() => {
    setXVal(String(Math.round(vertex.x_mm)))
    setYVal(String(Math.round(vertex.y_mm)))
  }, [vertex.x_mm, vertex.y_mm])

  function commitX() {
    const n = parseFloat(xVal)
    if (!Number.isFinite(n)) { setXVal(String(Math.round(vertex.x_mm))); return }
    onMove(index, { x_mm: n, y_mm: vertex.y_mm })
  }

  function commitY() {
    const n = parseFloat(yVal)
    if (!Number.isFinite(n)) { setYVal(String(Math.round(vertex.y_mm))); return }
    onMove(index, { x_mm: vertex.x_mm, y_mm: n })
  }

  return (
    <div className={styles.section}>
      <h3 className={styles.sectionTitle}>Punkt {index + 1}</h3>
      <div className={styles.field}>
        <label className={styles.fieldLabel}>X (mm)</label>
        <input
          aria-label="X-Koordinate in mm"
          className={styles.fieldInput}
          type="number"
          value={xVal}
          onChange={e => setXVal(e.target.value)}
          onBlur={commitX}
          onKeyDown={e => { if (e.key === 'Enter') commitX() }}
        />
      </div>
      <div className={styles.field}>
        <label className={styles.fieldLabel}>Y (mm)</label>
        <input
          aria-label="Y-Koordinate in mm"
          className={styles.fieldInput}
          type="number"
          value={yVal}
          onChange={e => setYVal(e.target.value)}
          onBlur={commitY}
          onKeyDown={e => { if (e.key === 'Enter') commitY() }}
        />
      </div>
    </div>
  )
}

// ─── Kanten-Panel ─────────────────────────────────────────────────────────────

function EdgePanel({ edgeIndex, lengthMm, onSetLength }: {
  edgeIndex: number
  lengthMm: number
  onSetLength: (i: number, mm: number) => void
}) {
  const [lenVal, setLenVal] = useState(String(Math.round(lengthMm)))

  useEffect(() => {
    setLenVal(String(Math.round(lengthMm)))
  }, [lengthMm])

  function commit() {
    const n = parseFloat(lenVal)
    if (!Number.isFinite(n) || n <= 0) { setLenVal(String(Math.round(lengthMm))); return }
    onSetLength(edgeIndex, n)
  }

  return (
    <div className={styles.section}>
      <h3 className={styles.sectionTitle}>Kante {edgeIndex + 1}</h3>
      <div className={styles.field}>
        <label className={styles.fieldLabel}>Länge (mm)</label>
        <input
          aria-label="Kantenlänge in mm"
          className={styles.fieldInput}
          type="number"
          min={1}
          value={lenVal}
          onChange={e => setLenVal(e.target.value)}
          onBlur={commit}
          onKeyDown={e => { if (e.key === 'Enter') commit() }}
        />
      </div>
      <p className={styles.hint}>{(lengthMm / 1000).toFixed(3)} m</p>
    </div>
  )
}
