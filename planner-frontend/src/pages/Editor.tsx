import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { projectsApi, type ProjectDetail } from '../api/projects.js'
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

  if (loading) return <div className={styles.center}>Lade Projekt…</div>
  if (error) return <div className={styles.center}>{error}</div>
  if (!project) return null

  const selectedRoom = project.rooms.find(r => r.id === selectedRoomId) ?? null

  return (
    <div className={styles.shell}>
      {/* ── Topbar ── */}
      <header className={styles.topbar}>
        <button className={styles.backBtn} onClick={() => navigate('/')}>← Projekte</button>
        <span className={styles.projectName}>{project.name}</span>
        <div className={styles.topbarActions}>
          <button className={styles.btnSecondary}>Angebot</button>
          <button className={styles.btnPrimary}>Speichern</button>
        </div>
      </header>

      {/* ── Hauptbereich ── */}
      <div className={styles.workspace}>
        <LeftSidebar
          rooms={project.rooms}
          selectedRoomId={selectedRoomId}
          onSelectRoom={setSelectedRoomId}
        />

        <CanvasArea room={selectedRoom} />

        <RightSidebar room={selectedRoom} />
      </div>

      {/* ── Statuszeile ── */}
      <StatusBar project={project} selectedRoom={selectedRoom} />
    </div>
  )
}
