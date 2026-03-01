import { useEffect, useState } from 'react'
import type { Vertex, Point2D } from '@shared/types'
import type { Opening } from '../../api/openings.js'
import type { Room } from '../../api/projects.js'
import styles from './RightSidebar.module.css'

interface Props {
  room: Room | null
  selectedVertexIndex: number | null
  selectedVertex: Vertex | null
  selectedEdgeIndex: number | null
  edgeLengthMm: number | null
  selectedOpening: Opening | null
  onMoveVertex: (index: number, pos: Point2D) => void
  onSetEdgeLength: (edgeIndex: number, lengthMm: number) => void
  onUpdateOpening: (opening: Opening) => void
  onDeleteOpening: (openingId: string) => void
}

export function RightSidebar({
  room,
  selectedVertexIndex, selectedVertex,
  selectedEdgeIndex, edgeLengthMm,
  selectedOpening,
  onMoveVertex, onSetEdgeLength,
  onUpdateOpening, onDeleteOpening,
}: Props) {
  return (
    <aside className={styles.sidebar}>
      {selectedOpening ? (
        <OpeningPanel
          key={selectedOpening.id}
          opening={selectedOpening}
          onUpdate={onUpdateOpening}
          onDelete={onDeleteOpening}
        />
      ) : selectedVertex !== null && selectedVertexIndex !== null ? (
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

// ─── Öffnungs-Panel ───────────────────────────────────────────────────────────

const OPENING_LABELS: Record<string, string> = {
  door: 'Tür',
  window: 'Fenster',
  'pass-through': 'Durchgang',
}

function OpeningPanel({ opening, onUpdate, onDelete }: {
  opening: Opening
  onUpdate: (o: Opening) => void
  onDelete: (id: string) => void
}) {
  const [offset, setOffset] = useState(String(Math.round(opening.offset_mm)))
  const [width, setWidth] = useState(String(Math.round(opening.width_mm)))
  const [height, setHeight] = useState(String(opening.height_mm ? Math.round(opening.height_mm) : ''))
  const [sill, setSill] = useState(String(opening.sill_height_mm ? Math.round(opening.sill_height_mm) : '0'))

  useEffect(() => {
    setOffset(String(Math.round(opening.offset_mm)))
    setWidth(String(Math.round(opening.width_mm)))
    setHeight(String(opening.height_mm ? Math.round(opening.height_mm) : ''))
    setSill(String(opening.sill_height_mm ? Math.round(opening.sill_height_mm) : '0'))
  }, [opening.id])

  function commitField(field: keyof Opening, raw: string, min = 0) {
    const n = parseFloat(raw)
    if (!Number.isFinite(n) || n < min) return
    onUpdate({ ...opening, [field]: n })
  }

  return (
    <div className={styles.section}>
      <h3 className={styles.sectionTitle}>
        {OPENING_LABELS[opening.type ?? 'door'] ?? 'Öffnung'}
      </h3>

      {/* Typ-Auswahl */}
      <div className={styles.field}>
        <label className={styles.fieldLabel}>Typ</label>
        <select
          aria-label="Öffnungstyp"
          className={styles.fieldInput}
          value={opening.type ?? 'door'}
          onChange={e => onUpdate({ ...opening, type: e.target.value as Opening['type'] })}
        >
          <option value="door">Tür</option>
          <option value="window">Fenster</option>
          <option value="pass-through">Durchgang</option>
        </select>
      </div>

      <div className={styles.field}>
        <label className={styles.fieldLabel}>Abstand (mm)</label>
        <input
          aria-label="Abstand vom Wandstart in mm"
          className={styles.fieldInput}
          type="number"
          min={0}
          value={offset}
          onChange={e => setOffset(e.target.value)}
          onBlur={() => commitField('offset_mm', offset)}
          onKeyDown={e => { if (e.key === 'Enter') commitField('offset_mm', offset) }}
        />
      </div>

      <div className={styles.field}>
        <label className={styles.fieldLabel}>Breite (mm)</label>
        <input
          aria-label="Öffnungsbreite in mm"
          className={styles.fieldInput}
          type="number"
          min={1}
          value={width}
          onChange={e => setWidth(e.target.value)}
          onBlur={() => commitField('width_mm', width, 1)}
          onKeyDown={e => { if (e.key === 'Enter') commitField('width_mm', width, 1) }}
        />
      </div>

      <div className={styles.field}>
        <label className={styles.fieldLabel}>Höhe (mm)</label>
        <input
          aria-label="Öffnungshöhe in mm"
          className={styles.fieldInput}
          type="number"
          min={1}
          value={height}
          onChange={e => setHeight(e.target.value)}
          onBlur={() => commitField('height_mm', height, 1)}
          onKeyDown={e => { if (e.key === 'Enter') commitField('height_mm', height, 1) }}
        />
      </div>

      {opening.type === 'window' && (
        <div className={styles.field}>
          <label className={styles.fieldLabel}>Brüstung (mm)</label>
          <input
            aria-label="Brüstungshöhe in mm"
            className={styles.fieldInput}
            type="number"
            min={0}
            value={sill}
            onChange={e => setSill(e.target.value)}
            onBlur={() => commitField('sill_height_mm', sill)}
            onKeyDown={e => { if (e.key === 'Enter') commitField('sill_height_mm', sill) }}
          />
        </div>
      )}

      <button
        type="button"
        className={styles.deleteBtn}
        onClick={() => onDelete(opening.id)}
      >
        Öffnung löschen
      </button>
    </div>
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
