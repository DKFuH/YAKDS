import { useRef, useEffect, useState, useCallback } from 'react'
import type { Opening } from '../../api/openings.js'
import type { RoomPayload } from '../../api/rooms.js'
import { roomsApi } from '../../api/rooms.js'
import { PolygonEditor } from '../../editor/PolygonEditor.js'
import type { EditorAPI } from '../../editor/usePolygonEditor.js'
import styles from './CanvasArea.module.css'

interface Props {
  room: RoomPayload | null
  onRoomUpdated: (room: RoomPayload) => void
  editor: EditorAPI
  openings: Opening[]
  selectedOpeningId: string | null
  onSelectOpening: (id: string | null) => void
  onAddOpening: (wallId: string, wallLengthMm: number) => void
}

export function CanvasArea({ room, onRoomUpdated, editor, openings, selectedOpeningId, onSelectOpening, onAddOpening }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Ref-Trick: stabile handleSave ohne stale closure auf editor.state
  const editorRef = useRef(editor)
  editorRef.current = editor

  useEffect(() => {
    if (!containerRef.current) return
    const observer = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect
      setDimensions({ width, height })
    })
    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  const handleSave = useCallback(async () => {
    if (!room) return
    const { vertices, wallIds } = editorRef.current.state
    setSaving(true)
    setSaveError(null)
    try {
      const wallSegments = vertices.map((v, i) => ({
        id: wallIds[i] ?? crypto.randomUUID(),
        index: i,
        start_vertex_id: v.id,
        end_vertex_id: vertices[(i + 1) % vertices.length].id,
        length_mm: Math.hypot(
          vertices[(i + 1) % vertices.length].x_mm - v.x_mm,
          vertices[(i + 1) % vertices.length].y_mm - v.y_mm,
        ),
      }))
      const updated = await roomsApi.update(room.id, {
        boundary: { vertices, wall_segments: wallSegments },
      })
      onRoomUpdated(updated)
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'Speichern fehlgeschlagen')
    } finally {
      setSaving(false)
    }
  }, [room, onRoomUpdated])

  return (
    <main className={styles.canvas} ref={containerRef}>
      {saving && <div className={styles.overlay}>Speichere…</div>}
      {saveError && <div className={styles.errorOverlay}>{saveError}</div>}

      {room ? (
        <PolygonEditor
          width={dimensions.width}
          height={dimensions.height}
          state={editor.state}
          isValid={editor.isValid}
          onAddVertex={editor.addVertex}
          onClosePolygon={editor.closePolygon}
          onMoveVertex={editor.moveVertex}
          onSelectVertex={editor.selectVertex}
          onSelectEdge={editor.selectEdge}
          onHoverVertex={editor.hoverVertex}
          onDeleteVertex={editor.deleteVertex}
          onSetTool={editor.setTool}
          onReset={editor.reset}
          onSave={handleSave}
          openings={openings}
          selectedOpeningId={selectedOpeningId}
          onSelectOpening={onSelectOpening}
          onAddOpening={onAddOpening}
        />
      ) : (
        <div className={styles.placeholder}>
          <p>Kein Raum ausgewählt</p>
          <p className={styles.hint}>Wähle einen Raum links oder lege einen neuen an.</p>
        </div>
      )}
    </main>
  )
}
