import { useEffect, useState } from 'react'
import type { Vertex, Point2D } from '@shared/types'
import type { Opening } from '../../api/openings.js'
import type { Room } from '../../api/projects.js'
import styles from './RightSidebar.module.css'

export interface CeilingConstraint {
  id?: string
  wall_id: string
  wall_start: Point2D
  wall_end: Point2D
  kniestock_height_mm: number
  slope_angle_deg: number
  depth_into_room_mm: number
}

interface Props {
  room: Room | null
  selectedVertexIndex: number | null
  selectedVertex: Vertex | null
  selectedEdgeIndex: number | null
  edgeLengthMm: number | null
  selectedOpening: Opening | null
  ceilingConstraints: CeilingConstraint[]
  selectedWallGeom: { id: string; start: Point2D; end: Point2D } | null
  onMoveVertex: (index: number, pos: Point2D) => void
  onSetEdgeLength: (edgeIndex: number, lengthMm: number) => void
  onUpdateOpening: (opening: Opening) => void
  onDeleteOpening: (openingId: string) => void
  onSaveCeilingConstraints: (constraints: CeilingConstraint[]) => void
}

export function RightSidebar({
  room,
  selectedVertexIndex, selectedVertex,
  selectedEdgeIndex, edgeLengthMm,
  selectedOpening,
  ceilingConstraints,
  selectedWallGeom,
  onMoveVertex, onSetEdgeLength,
  onUpdateOpening, onDeleteOpening,
  onSaveCeilingConstraints,
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

      <CeilingConstraintPanel
        constraints={ceilingConstraints}
        wallGeom={selectedWallGeom}
        onSave={onSaveCeilingConstraints}
      />
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

// ─── Dachschrägen-Panel ───────────────────────────────────────────────────────

function CeilingConstraintPanel({ constraints, wallGeom, onSave }: {
  constraints: CeilingConstraint[]
  wallGeom: { id: string; start: Point2D; end: Point2D } | null
  onSave: (constraints: CeilingConstraint[]) => void
}) {
  const wallConstraints = wallGeom
    ? constraints.filter(c => c.wall_id === wallGeom.id)
    : []

  function addConstraint() {
    if (!wallGeom) return
    const newC: CeilingConstraint = {
      id: crypto.randomUUID(),
      wall_id: wallGeom.id,
      wall_start: wallGeom.start,
      wall_end: wallGeom.end,
      kniestock_height_mm: 1200,
      slope_angle_deg: 45,
      depth_into_room_mm: 600,
    }
    onSave([...constraints, newC])
  }

  function updateConstraint(updated: CeilingConstraint) {
    onSave(constraints.map(c => c.id === updated.id ? updated : c))
  }

  function deleteConstraint(id: string) {
    onSave(constraints.filter(c => c.id !== id))
  }

  return (
    <div className={styles.section}>
      <h3 className={styles.sectionTitle}>Dachschrägen</h3>

      {!wallGeom ? (
        <p className={styles.empty}>Wand auswählen</p>
      ) : (
        <>
          {wallConstraints.length === 0 && (
            <p className={styles.empty}>Keine Dachschräge an dieser Wand</p>
          )}
          {wallConstraints.map(c => (
            <ConstraintRow
              key={c.id}
              constraint={c}
              onUpdate={updateConstraint}
              onDelete={() => deleteConstraint(c.id!)}
            />
          ))}
          <button type="button" className={styles.addConstraintBtn} onClick={addConstraint}>
            + Dachschräge hinzufügen
          </button>
        </>
      )}
    </div>
  )
}

function ConstraintRow({ constraint, onUpdate, onDelete }: {
  constraint: CeilingConstraint
  onUpdate: (c: CeilingConstraint) => void
  onDelete: () => void
}) {
  const [kniestock, setKniestock] = useState(String(Math.round(constraint.kniestock_height_mm)))
  const [angle, setAngle] = useState(String(constraint.slope_angle_deg))
  const [depth, setDepth] = useState(String(Math.round(constraint.depth_into_room_mm)))

  function commit(field: keyof CeilingConstraint, raw: string, min = 0) {
    const n = parseFloat(raw)
    if (!Number.isFinite(n) || n < min) return
    onUpdate({ ...constraint, [field]: n })
  }

  return (
    <div className={styles.constraintRow}>
      <div className={styles.field}>
        <label className={styles.fieldLabel}>Kniestock (mm)</label>
        <input
          aria-label="Kniestockhöhe in mm"
          className={styles.fieldInput}
          type="number"
          min={0}
          value={kniestock}
          onChange={e => setKniestock(e.target.value)}
          onBlur={() => commit('kniestock_height_mm', kniestock)}
          onKeyDown={e => { if (e.key === 'Enter') commit('kniestock_height_mm', kniestock) }}
        />
      </div>
      <div className={styles.field}>
        <label className={styles.fieldLabel}>Neigung (°)</label>
        <input
          aria-label="Dachneigung in Grad"
          className={styles.fieldInput}
          type="number"
          min={0}
          max={90}
          step={0.5}
          value={angle}
          onChange={e => setAngle(e.target.value)}
          onBlur={() => commit('slope_angle_deg', angle)}
          onKeyDown={e => { if (e.key === 'Enter') commit('slope_angle_deg', angle) }}
        />
      </div>
      <div className={styles.field}>
        <label className={styles.fieldLabel}>Tiefe ins Zimmer (mm)</label>
        <input
          aria-label="Tiefe der Dachschräge ins Zimmer in mm"
          className={styles.fieldInput}
          type="number"
          min={0}
          value={depth}
          onChange={e => setDepth(e.target.value)}
          onBlur={() => commit('depth_into_room_mm', depth)}
          onKeyDown={e => { if (e.key === 'Enter') commit('depth_into_room_mm', depth) }}
        />
      </div>
      <button type="button" className={styles.deleteBtn} onClick={onDelete}>
        Dachschräge löschen
      </button>
    </div>
  )
}
