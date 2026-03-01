import { useCallback, useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import type { Vertex } from '@shared/types'
import { projectsApi, type ProjectDetail } from '../api/projects.js'
import { roomsApi, type RoomPayload } from '../api/rooms.js'
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

  // Editor-State nach oben gehoben, damit RightSidebar darauf zugreifen kann
  const editor = usePolygonEditor()

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

  // Editor-Vertices neu laden wenn Raum wechselt
  useEffect(() => {
    if (!project || !selectedRoomId) {
      editor.reset()
      return
    }
    const room = project.rooms.find(r => r.id === selectedRoomId)
    const verts = (room?.boundary?.vertices ?? []) as Vertex[]
    if (verts.length >= 3) {
      editor.loadVertices(verts)
    } else {
      editor.reset()
    }
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
    setProject(prev => {
      if (!prev) return prev
      return {
        ...prev,
        rooms: prev.rooms.map(r => r.id === updated.id ? updated as unknown as typeof r : r),
      }
    })
  }, [])

  if (loading) return <div className={styles.center}>Lade Projekt…</div>
  if (error) return <div className={styles.center}>{error}</div>
  if (!project) return null

  const selectedRoom = project.rooms.find(r => r.id === selectedRoomId) ?? null

  // Auswahl-Info für RightSidebar
  const { state } = editor
  const selectedVertex = state.selectedIndex !== null ? (state.vertices[state.selectedIndex] ?? null) : null
  const selEdgeLen = state.selectedEdgeIndex !== null
    ? edgeLengthMm(state.vertices, state.selectedEdgeIndex)
    : null

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
        />

        <RightSidebar
          room={selectedRoom}
          selectedVertexIndex={state.selectedIndex}
          selectedVertex={selectedVertex}
          selectedEdgeIndex={state.selectedEdgeIndex}
          edgeLengthMm={selEdgeLen}
          onMoveVertex={editor.moveVertex}
          onSetEdgeLength={editor.setEdgeLength}
        />
      </div>

      <StatusBar project={project} selectedRoom={selectedRoom} />
    </div>
  )
}
