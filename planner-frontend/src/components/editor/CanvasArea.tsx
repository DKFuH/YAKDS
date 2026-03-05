import { useRef, useEffect, useState, useCallback } from 'react'
import type { Opening } from '../../api/openings.js'
import type { Placement } from '../../api/placements.js'
import type { Dimension } from '../../api/dimensions.js'
import type { Centerline } from '../../api/centerlines.js'
import type { RoomPayload } from '../../api/rooms.js'
import type { GeoJsonGrid } from '../../api/acoustics.js'
import type { VerticalConnection } from '../../api/verticalConnections.js'
import { roomsApi } from '../../api/rooms.js'
import { PolygonEditor } from '../../editor/PolygonEditor.js'
import type { EditorAPI } from '../../editor/usePolygonEditor.js'
import { autofixBoundaryVertices, buildBoundaryFromVertices, rebindOpeningsAndPlacements } from '../../editor/roomTopology.js'
import type { NavigationSettings } from './navigationSettings.js'
import { CompassOverlay } from './CompassOverlay.js'
import styles from './CanvasArea.module.css'

interface Props {
  room: RoomPayload | null
  onRoomUpdated: (room: RoomPayload) => void
  editor: EditorAPI
  verticalConnections: VerticalConnection[]
  openings: Opening[]
  selectedOpeningId: string | null
  onSelectOpening: (id: string | null) => void
  onAddOpening: (wallId: string, wallLengthMm: number) => void
  placements: Placement[]
  dimensions: Dimension[]
  centerlines: Centerline[]
  selectedPlacementId: string | null
  onSelectPlacement: (id: string | null) => void
  highlightedOpeningIds?: string[]
  highlightedPlacementIds?: string[]
  canAddPlacement: boolean
  onAddPlacement: (wallId: string, wallLengthMm: number) => void
  acousticGrid: GeoJsonGrid | null
  acousticVisible: boolean
  acousticOpacity: number
  edgeLengthPreviewMm?: number | null
  onReferenceImageUpdate: (img: NonNullable<RoomPayload['reference_image']>) => void
  navigationSettings: NavigationSettings
  safeEditMode: boolean
  showCompass?: boolean
  northAngleDeg?: number
  virtualVisitor?: {
    x_mm: number
    y_mm: number
    yaw_rad: number
    visible?: boolean
  } | null
  onRepositionVisitor?: (point: { x_mm: number; y_mm: number }) => void
  onBoundaryTopologyRebind?: (payload: {
    openings: Opening[]
    placements: Placement[]
    changedOpenings: number
    changedPlacements: number
  }) => void
}

function createWallId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `wall-${Math.random().toString(36).slice(2, 12)}`
}

export function CanvasArea({ room, onRoomUpdated, editor, verticalConnections, openings, selectedOpeningId, onSelectOpening, onAddOpening, placements, dimensions, centerlines, selectedPlacementId, onSelectPlacement, highlightedOpeningIds = [], highlightedPlacementIds = [], canAddPlacement, onAddPlacement, acousticGrid, acousticVisible, acousticOpacity, edgeLengthPreviewMm = null, onReferenceImageUpdate, navigationSettings, safeEditMode, showCompass = false, northAngleDeg = 0, virtualVisitor = null, onRepositionVisitor, onBoundaryTopologyRebind }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [showCenterlines, setShowCenterlines] = useState(false)

  // Ref-Trick: stabile handleSave ohne stale closure auf editor.state
  const editorRef = useRef(editor)
  editorRef.current = editor
  const wallSegments = (((room?.boundary as unknown as { wall_segments?: Array<{ id?: string; visible?: boolean; is_hidden?: boolean; locked?: boolean }> } | undefined)?.wall_segments) ?? [])

  useEffect(() => {
    if (!containerRef.current) return
    const observer = new ResizeObserver(entries => {
      const entry = entries[0]
      if (!entry) return
      setCanvasSize({
        width: Math.floor(entry.contentRect.width),
        height: Math.floor(entry.contentRect.height),
      })
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
      const autofix = autofixBoundaryVertices(vertices)
      if (autofix.vertices.length < 3 || autofix.validationErrors.length > 0) {
        setSaveError(autofix.validationErrors[0] ?? 'Raumgeometrie ist nicht gueltig')
        return
      }

      const regenerateWallIds = autofix.changed || wallIds.length !== autofix.vertices.length
      const candidateWallIds = regenerateWallIds
        ? autofix.vertices.map(() => createWallId())
        : wallIds

      const built = buildBoundaryFromVertices(autofix.vertices, candidateWallIds)
      const updated = await roomsApi.update(room.id, {
        boundary: built.boundary,
      })

      if (autofix.changed || regenerateWallIds) {
        editorRef.current.loadBoundary(built.boundary.vertices, built.wallIds)
      }

      const rebound = rebindOpeningsAndPlacements(room.boundary, built.boundary, openings, placements)
      if (rebound.changedOpenings > 0 || rebound.changedPlacements > 0) {
        onBoundaryTopologyRebind?.(rebound)
      }

      onRoomUpdated(updated)
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'Speichern fehlgeschlagen')
    } finally {
      setSaving(false)
    }
  }, [room, onBoundaryTopologyRebind, onRoomUpdated, openings, placements])

  return (
    <main className={styles.canvas}>
      {saving && <div className={styles.overlay}>Speichere…</div>}
      {saveError && <div className={styles.errorOverlay}>{saveError}</div>}

      {room ? (
        <div ref={containerRef} className={styles.canvasViewport}>
          <PolygonEditor
            width={canvasSize.width}
            height={canvasSize.height}
            state={editor.state}
            isValid={editor.isValid}
            onAddVertex={editor.addVertex}
            onClosePolygon={editor.closePolygon}
            onMoveVertex={editor.moveVertex}
            onSelectVertex={editor.selectVertex}
            onSelectEdge={editor.selectEdge}
            onHoverVertex={editor.hoverVertex}
            onDeleteVertex={editor.deleteVertex}
            onUpdateSettings={editor.updateSettings}
            onSetTool={editor.setTool}
            onReset={editor.reset}
            onSave={handleSave}
            verticalConnections={verticalConnections}
            openings={openings}
            selectedOpeningId={selectedOpeningId}
            onSelectOpening={onSelectOpening}
            onAddOpening={onAddOpening}
            placements={placements}
            wallSegments={wallSegments}
            dimensions={dimensions}
            centerlines={centerlines}
            showCenterlines={showCenterlines}
            onToggleCenterlines={() => setShowCenterlines((value) => !value)}
            selectedPlacementId={selectedPlacementId}
            onSelectPlacement={onSelectPlacement}
            highlightedOpeningIds={highlightedOpeningIds}
            highlightedPlacementIds={highlightedPlacementIds}
            canAddPlacement={canAddPlacement}
            onAddPlacement={onAddPlacement}
            acousticGrid={acousticGrid}
            acousticVisible={acousticVisible}
            acousticOpacity={acousticOpacity}
            edgeLengthPreviewMm={edgeLengthPreviewMm}
            onReferenceImageUpdate={onReferenceImageUpdate}
            navigationSettings={navigationSettings}
            safeEditMode={safeEditMode}
            virtualVisitor={virtualVisitor}
            onRepositionVisitor={onRepositionVisitor}
          />
          {showCompass && <CompassOverlay northAngleDeg={northAngleDeg} />}
        </div>
      ) : (
        <div className={styles.placeholder}>
          <p>Kein Raum ausgewählt</p>
          <p className={styles.hint}>Wähle einen Raum links oder lege einen neuen an.</p>
        </div>
      )}
    </main>
  )
}
