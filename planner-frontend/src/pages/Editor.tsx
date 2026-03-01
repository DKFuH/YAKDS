import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import type { Vertex } from '@shared/types'
import { projectsApi, type ProjectDetail } from '../api/projects.js'
import { roomsApi, type RoomBoundaryPayload, type RoomPayload } from '../api/rooms.js'
import { openingsApi, type Opening } from '../api/openings.js'
import { usePolygonEditor, edgeLengthMm } from '../editor/usePolygonEditor.js'
import { CanvasArea } from '../components/editor/CanvasArea.js'
import { LeftSidebar } from '../components/editor/LeftSidebar.js'
import { RightSidebar } from '../components/editor/RightSidebar.js'
import { StatusBar } from '../components/editor/StatusBar.js'
import styles from './Editor.module.css'

export function Editor() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [project, setProject] = useState<ProjectDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null)
  const [openings, setOpenings] = useState<Opening[]>([])
  const [selectedOpeningId, setSelectedOpeningId] = useState<string | null>(null)

  // Editor-State nach oben gehoben, damit RightSidebar darauf zugreifen kann
  const editor = usePolygonEditor()

  // Stabiler Ref auf selectedRoom/openings (kein stale closure in Callbacks)
  const selectedRoomRef = useRef<RoomPayload | null>(null)
  const openingsRef = useRef<Opening[]>(openings)
  openingsRef.current = openings

  useEffect(() => {
    if (!id) return
    projectsApi.get(id)
      .then(p => {
        setProject(p)
        if (p.rooms.length > 0) setSelectedRoomId(p.rooms[0].id)
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [id])

  // Editor-Vertices + Öffnungen neu laden wenn Raum wechselt
  useEffect(() => {
    setSelectedOpeningId(null)
    if (!project || !selectedRoomId) {
      editor.reset()
      setOpenings([])
      return
    }
    const room = project.rooms.find(r => r.id === selectedRoomId)
    const verts = ((room?.boundary as RoomBoundaryPayload | undefined)?.vertices ?? []) as Vertex[]
    if (verts.length >= 3) {
      editor.loadVertices(verts)
    } else {
      editor.reset()
    }
    // Öffnungen aus room.openings laden (JSONB, bereits im room-Objekt)
    setOpenings((room?.openings as unknown as Opening[]) ?? [])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRoomId])

  // Raum anlegen
  const handleAddRoom = useCallback(async () => {
    if (!project) return
    const name = prompt('Raumname:')
    if (!name?.trim()) return
    const newRoom = await roomsApi.create({
      project_id: project.id,
      name: name.trim(),
      boundary: { vertices: [], wall_segments: [] },
    })
    setProject(prev => prev ? { ...prev, rooms: [...prev.rooms, newRoom as unknown as ProjectDetail['rooms'][0]] } : prev)
    setSelectedRoomId(newRoom.id)
  }, [project])

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
    const newOpening: Opening = {
      id: crypto.randomUUID(),
      wall_id: wallId,
      type: 'door',
      offset_mm: offset,
      width_mm: defaultWidth,
      height_mm: 2100,
      sill_height_mm: 0,
      source: 'manual',
    }
    const updated = [...openingsRef.current, newOpening]
    setOpenings(updated)
    setSelectedOpeningId(newOpening.id)
    handleSaveOpenings(updated)
  }, [handleSaveOpenings])

  // Öffnung aktualisieren
  const handleUpdateOpening = useCallback((updated: Opening) => {
    const newOpenings = openingsRef.current.map(o => o.id === updated.id ? updated : o)
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

  if (loading) return <div className={styles.center}>Lade Projekt…</div>
  if (error) return <div className={styles.center}>{error}</div>
  if (!project) return null

  const selectedRoom = project.rooms.find(r => r.id === selectedRoomId) ?? null
  selectedRoomRef.current = selectedRoom as unknown as RoomPayload | null

  // Auswahl-Info für RightSidebar
  const { state } = editor
  const selectedVertex = state.selectedIndex !== null ? (state.vertices[state.selectedIndex] ?? null) : null
  const selEdgeLen = state.selectedEdgeIndex !== null
    ? edgeLengthMm(state.vertices, state.selectedEdgeIndex)
    : null
  const selectedOpening = openings.find(o => o.id === selectedOpeningId) ?? null

  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <button type="button" className={styles.backBtn} onClick={() => navigate('/')}>← Projekte</button>
        <span className={styles.projectName}>{project.name}</span>
        <div className={styles.topbarActions}>
          <button type="button" className={styles.btnSecondary}>Angebot</button>
        </div>
      </header>

      <div className={styles.workspace}>
        <LeftSidebar
          rooms={project.rooms}
          selectedRoomId={selectedRoomId}
          onSelectRoom={setSelectedRoomId}
          onAddRoom={handleAddRoom}
        />

        <CanvasArea
          room={selectedRoom as unknown as RoomPayload | null}
          onRoomUpdated={handleRoomUpdated}
          editor={editor}
          openings={openings}
          selectedOpeningId={selectedOpeningId}
          onSelectOpening={setSelectedOpeningId}
          onAddOpening={handleAddOpening}
        />

        <RightSidebar
          room={selectedRoom}
          selectedVertexIndex={state.selectedIndex}
          selectedVertex={selectedVertex}
          selectedEdgeIndex={state.selectedEdgeIndex}
          edgeLengthMm={selEdgeLen}
          selectedOpening={selectedOpening}
          onMoveVertex={editor.moveVertex}
          onSetEdgeLength={editor.setEdgeLength}
          onUpdateOpening={handleUpdateOpening}
          onDeleteOpening={handleDeleteOpening}
        />
      </div>

      <StatusBar project={project} selectedRoom={selectedRoom} />
    </div>
  )
}
