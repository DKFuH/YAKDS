import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import type { Vertex } from '@shared/types'
import { projectsApi, type ProjectDetail } from '../api/projects.js'
import {
  type CatalogArticle,
  type UnifiedCatalogItem,
} from '../api/catalog.js'
import { placementsApi, type Placement } from '../api/placements.js'
import { roomsApi, type RoomBoundaryPayload, type RoomPayload } from '../api/rooms.js'
import { openingsApi, type Opening } from '../api/openings.js'
import { validateApi, type ValidateResponse } from '../api/validate.js'
import { autoCompletionApi, type AutoCompleteResult } from '../api/autoCompletion.js'
import { usePolygonEditor, edgeLengthMm } from '../editor/usePolygonEditor.js'
import { CanvasArea } from '../components/editor/CanvasArea.js'
import { PopoutWindow } from '../components/editor/PopoutWindow.js'
import { Preview3D } from '../components/editor/Preview3D.js'
import { LeftSidebar } from '../components/editor/LeftSidebar.js'
import { RightSidebar, type CeilingConstraint, type ConfiguredDimensions } from '../components/editor/RightSidebar.js'
import { StatusBar } from '../components/editor/StatusBar.js'
import { AreasPanel } from '../components/editor/AreasPanel.js'
import styles from './Editor.module.css'

function resolveArticleVariantId(article: CatalogArticle, chosenOptions: Record<string, string>): string | undefined {
  if (!article.variants || article.variants.length === 0) {
    return undefined
  }

  for (const variant of article.variants) {
    const values = (variant.variant_values_json ?? {}) as Record<string, unknown>
    const keys = Object.keys(values)
    if (keys.length === 0) {
      continue
    }

    const matches = keys.every((key) => {
      const selected = chosenOptions[key]
      if (selected == null || selected.trim() === '') {
        return false
      }
      return String(values[key]) === selected
    })

    if (matches) {
      return variant.id
    }
  }

  return undefined
}

function resolveArticlePriceForVariant(article: CatalogArticle, variantId?: string) {
  const prices = article.prices ?? []
  if (prices.length === 0) {
    return undefined
  }

  if (variantId) {
    const variantPrice = prices.find((price) => price.article_variant_id === variantId)
    if (variantPrice) {
      return variantPrice
    }
  }

  const defaultPrice = prices.find((price) => !price.article_variant_id)
  return defaultPrice ?? prices[0]
}

export function Editor() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [project, setProject] = useState<ProjectDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'2d' | '3d'>('2d')
  const [openings, setOpenings] = useState<Opening[]>([])
  const [selectedOpeningId, setSelectedOpeningId] = useState<string | null>(null)
  const [placements, setPlacements] = useState<Placement[]>([])
  const [selectedPlacementId, setSelectedPlacementId] = useState<string | null>(null)
  const [selectedCatalogItem, setSelectedCatalogItem] = useState<UnifiedCatalogItem | null>(null)
  const [configuredDimensions, setConfiguredDimensions] = useState<ConfiguredDimensions | null>(null)
  const [chosenOptions, setChosenOptions] = useState<Record<string, string>>({})
  const [validationResult, setValidationResult] = useState<ValidateResponse | null>(null)
  const [validationLoading, setValidationLoading] = useState(false)
  const [autoCompleteLoading, setAutoCompleteLoading] = useState(false)
  const [autoCompleteResult, setAutoCompleteResult] = useState<AutoCompleteResult | null>(null)
  const [isPreviewPopoutOpen, setIsPreviewPopoutOpen] = useState(false)
  const [showAreasPanel, setShowAreasPanel] = useState(false)

  // Editor-State nach oben gehoben, damit RightSidebar darauf zugreifen kann
  const editor = usePolygonEditor()

  // Stabiler Ref auf selectedRoom/openings (kein stale closure in Callbacks)
  const selectedRoomRef = useRef<RoomPayload | null>(null)
  const openingsRef = useRef<Opening[]>(openings)
  const placementsRef = useRef<Placement[]>(placements)
  openingsRef.current = openings
  placementsRef.current = placements

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
    setSelectedPlacementId(null)
    if (!project || !selectedRoomId) {
      editor.reset()
      setOpenings([])
      setPlacements([])
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
    setPlacements((room?.placements as unknown as Placement[]) ?? [])
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

  const handleSavePlacements = useCallback(async (newPlacements: Placement[]) => {
    if (!selectedRoomRef.current) return
    try {
      const saved = await placementsApi.save(selectedRoomRef.current.id, newPlacements)
      setPlacements(saved)
    } catch (e) {
      console.error('Platzierungen speichern fehlgeschlagen:', e)
    }
  }, [])

  // Reset configuredDimensions whenever the selected catalog item changes
  useEffect(() => {
    if (selectedCatalogItem) {
      if ('base_dims_json' in selectedCatalogItem) {
        // CatalogArticle
        setConfiguredDimensions({
          width_mm: selectedCatalogItem.base_dims_json.width_mm,
          height_mm: selectedCatalogItem.base_dims_json.height_mm,
          depth_mm: selectedCatalogItem.base_dims_json.depth_mm,
        })
        setChosenOptions({})
      } else {
        // Legacy CatalogItem
        setConfiguredDimensions({
          width_mm: selectedCatalogItem.width_mm,
          height_mm: selectedCatalogItem.height_mm,
          depth_mm: selectedCatalogItem.depth_mm,
        })
        setChosenOptions({})
      }
    } else {
      setConfiguredDimensions(null)
      setChosenOptions({})
    }
  }, [selectedCatalogItem])

  const handleAddPlacement = useCallback((wallId: string, wallLengthMm: number) => {
    if (!selectedCatalogItem) {
      console.warn('Kein Katalogartikel ausgewählt')
      return
    }

    const isArticle = 'base_dims_json' in selectedCatalogItem
    const article = isArticle ? (selectedCatalogItem as CatalogArticle) : null

    const itemWidth = isArticle ? selectedCatalogItem.base_dims_json.width_mm : selectedCatalogItem.width_mm
    const itemHeight = isArticle ? selectedCatalogItem.base_dims_json.height_mm : selectedCatalogItem.height_mm
    const itemDepth = isArticle ? selectedCatalogItem.base_dims_json.depth_mm : selectedCatalogItem.depth_mm

    const dims = configuredDimensions ?? {
      width_mm: itemWidth,
      height_mm: itemHeight,
      depth_mm: itemDepth,
    }

    const cleanedChosenOptions = Object.fromEntries(
      Object.entries(chosenOptions).filter(([, value]) => value.trim() !== ''),
    )
    const resolvedVariantId = article ? resolveArticleVariantId(article, cleanedChosenOptions) : undefined
    const resolvedArticlePrice = article ? resolveArticlePriceForVariant(article, resolvedVariantId) : undefined

    const placementWidth = Math.max(1, dims.width_mm)
    const offset = Math.max(0, Math.round((wallLengthMm - placementWidth) / 2))
    const newPlacement: Placement = {
      id: crypto.randomUUID(),
      catalog_item_id: selectedCatalogItem.id,
      ...(isArticle ? { catalog_article_id: selectedCatalogItem.id } : {}),
      ...(resolvedVariantId ? { article_variant_id: resolvedVariantId } : {}),
      description: selectedCatalogItem.name,
      ...(isArticle && Object.keys(cleanedChosenOptions).length > 0
        ? { chosen_options: cleanedChosenOptions }
        : {}),
      ...(isArticle && resolvedArticlePrice
        ? {
            list_price_net: resolvedArticlePrice.list_net,
            dealer_price_net: resolvedArticlePrice.dealer_net,
            ...(resolvedArticlePrice.tax_group_id ? { tax_group_id: resolvedArticlePrice.tax_group_id } : {}),
          }
        : {}),
      ...(!isArticle ? { list_price_net: selectedCatalogItem.list_price_net } : {}),
      ...(!isArticle && selectedCatalogItem.dealer_price_net != null
        ? { dealer_price_net: selectedCatalogItem.dealer_price_net }
        : {}),
      wall_id: wallId,
      offset_mm: offset,
      width_mm: placementWidth,
      depth_mm: Math.max(1, dims.depth_mm),
      height_mm: Math.max(1, dims.height_mm),
    }

    const updated = [...placementsRef.current, newPlacement]
    setPlacements(updated)
    setSelectedPlacementId(newPlacement.id)
    handleSavePlacements(updated)
  }, [handleSavePlacements, selectedCatalogItem, configuredDimensions, chosenOptions])

  const handleUpdatePlacement = useCallback((updated: Placement) => {
    const nextPlacements = placementsRef.current.map((placement) => (
      placement.id === updated.id ? updated : placement
    ))
    setPlacements(nextPlacements)
    handleSavePlacements(nextPlacements)
  }, [handleSavePlacements])

  const handleDeletePlacement = useCallback((placementId: string) => {
    const nextPlacements = placementsRef.current.filter((placement) => placement.id !== placementId)
    setPlacements(nextPlacements)
    setSelectedPlacementId((current) => (current === placementId ? null : current))
    handleSavePlacements(nextPlacements)
  }, [handleSavePlacements])

  // Auto-Vervollständigung (Langteile, Sockel, Wangen)
  const handleAutoComplete = useCallback(async () => {
    if (!id || !selectedRoomRef.current) return
    setAutoCompleteLoading(true)
    try {
      const result = await autoCompletionApi.run(id, selectedRoomRef.current.id)
      setAutoCompleteResult(result)
    } catch (e) {
      console.error('Auto-Vervollständigung fehlgeschlagen:', e)
    } finally {
      setAutoCompleteLoading(false)
    }
  }, [id])

  // Geometrieprüfung ausführen
  const handleRunValidation = useCallback(async () => {
    if (!selectedRoomRef.current || !id) return
    const room = selectedRoomRef.current
    const boundary = room.boundary as { vertices?: Array<{ id: string; x_mm: number; y_mm: number }>; wall_segments?: Array<{ id: string; start_vertex_id?: string; end_vertex_id?: string; length_mm?: number }> }
    const vertices = boundary.vertices ?? []
    const wallSegments = boundary.wall_segments ?? []
    const roomPolygon = vertices.map(v => ({ x_mm: v.x_mm, y_mm: v.y_mm }))
    if (roomPolygon.length < 3) return

    const vertexById = new Map(vertices.map(v => [v.id, v]))
    const walls = wallSegments.flatMap(w => {
      const s = vertexById.get(w.start_vertex_id ?? '')
      const e = vertexById.get(w.end_vertex_id ?? '')
      if (!s || !e) return []
      const len = w.length_mm ?? Math.hypot(e.x_mm - s.x_mm, e.y_mm - s.y_mm)
      return [{ id: w.id, start: { x_mm: s.x_mm, y_mm: s.y_mm }, end: { x_mm: e.x_mm, y_mm: e.y_mm }, length_mm: len }]
    })

    const objects = placementsRef.current.map(p => ({
      id: p.id, type: 'base' as const,
      wall_id: p.wall_id, offset_mm: p.offset_mm,
      width_mm: p.width_mm, depth_mm: p.depth_mm, height_mm: p.height_mm,
    }))
    const openingsMapped = openingsRef.current.map(o => ({
      id: o.id, wall_id: o.wall_id, offset_mm: o.offset_mm, width_mm: o.width_mm,
    }))
    const constraints = (room.ceiling_constraints as CeilingConstraint[] | undefined) ?? []

    setValidationLoading(true)
    try {
      const result = await validateApi.run(id, {
        user_id: 'anonymous',
        roomPolygon,
        objects,
        openings: openingsMapped,
        walls,
        ceilingConstraints: constraints,
        nominalCeilingMm: room.ceiling_height_mm,
      })
      setValidationResult(result)
    } catch (e) {
      console.error('Validierung fehlgeschlagen:', e)
    } finally {
      setValidationLoading(false)
    }
  }, [id])

  // Dachschrägen speichern
  const handleSaveCeilingConstraints = useCallback((constraints: CeilingConstraint[]) => {
    if (!selectedRoomRef.current) return
    roomsApi.update(selectedRoomRef.current.id, {
      ceiling_constraints: constraints as unknown[],
    }).then(updated => {
      handleRoomUpdated(updated)
    }).catch((e: Error) => console.error('Dachschrägen speichern fehlgeschlagen:', e))
  }, [handleRoomUpdated])

  const selectedRoom = project?.rooms.find(r => r.id === selectedRoomId) ?? null
  selectedRoomRef.current = selectedRoom as unknown as RoomPayload | null

  useEffect(() => {
    if (!selectedRoom) {
      setIsPreviewPopoutOpen(false)
    }
  }, [selectedRoom])

  if (loading) return <div className={styles.center}>Lade Projekt…</div>
  if (error) return <div className={styles.center}>{error}</div>
  if (!project) return null

  // Auswahl-Info für RightSidebar
  const { state } = editor
  const selectedVertex = state.selectedIndex !== null ? (state.vertices[state.selectedIndex] ?? null) : null
  const selEdgeLen = state.selectedEdgeIndex !== null
    ? edgeLengthMm(state.vertices, state.selectedEdgeIndex)
    : null
  const selectedOpening = openings.find(o => o.id === selectedOpeningId) ?? null
  const selectedPlacement = placements.find(p => p.id === selectedPlacementId) ?? null

  // Wandgeometrie für Dachschrägen-Panel
  const selectedWallGeom = useMemo(() => {
    const i = state.selectedEdgeIndex
    if (i === null || !state.wallIds[i]) return null
    const v0 = state.vertices[i]
    const v1 = state.vertices[(i + 1) % state.vertices.length]
    if (!v0 || !v1) return null
    return { id: state.wallIds[i], start: { x_mm: v0.x_mm, y_mm: v0.y_mm }, end: { x_mm: v1.x_mm, y_mm: v1.y_mm } }
  }, [state.selectedEdgeIndex, state.vertices, state.wallIds])

  const ceilingConstraints = ((selectedRoom as unknown as RoomPayload | null)?.ceiling_constraints as CeilingConstraint[] | undefined) ?? []

  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <button type="button" className={styles.backBtn} onClick={() => navigate('/')}>← Projekte</button>
        <span className={styles.projectName}>{project.name}</span>
        <div className={styles.topbarActions}>
          {autoCompleteResult && (
            <span className={styles.autoCompleteHint}>
              ✓ {autoCompleteResult.created} Langteile generiert
            </span>
          )}
          <button
            type="button"
            className={styles.btnSecondary}
            onClick={handleAutoComplete}
            disabled={autoCompleteLoading || !selectedRoomId}
            title="Arbeitsplatten, Sockel und Wangen automatisch generieren"
          >
            {autoCompleteLoading ? 'Generiere…' : 'Auto vervollständigen'}
          </button>
          <button
            type="button"
            className={styles.btnSecondary}
            onClick={() => setViewMode((prev) => (prev === '2d' ? '3d' : '2d'))}
          >
            {viewMode === '2d' ? '3D Preview' : '2D Editor'}
          </button>
          <button
            type="button"
            className={styles.btnSecondary}
            onClick={() => setIsPreviewPopoutOpen((prev) => !prev)}
            disabled={!selectedRoom}
            title="3D-Ansicht in separatem Fenster öffnen"
          >
            {isPreviewPopoutOpen ? '3D-Fenster schließen' : '3D in Fenster'}
          </button>
          <button type="button" className={styles.btnSecondary} onClick={() => navigate(`/projects/${id}/quote-lines`)}>
            Angebotspositionen
          </button>
          <button type="button" className={styles.btnSecondary} onClick={() => setShowAreasPanel((prev) => !prev)}>
            {showAreasPanel ? 'Bereiche ausblenden' : 'Bereiche / Alternativen'}
          </button>
        </div>
      </header>

      <div className={styles.workspace}>
        {showAreasPanel && id && (
          <AreasPanel projectId={id} />
        )}
        <LeftSidebar
          rooms={project.rooms}
          selectedRoomId={selectedRoomId}
          onSelectRoom={setSelectedRoomId}
          onAddRoom={handleAddRoom}
          selectedCatalogItem={selectedCatalogItem}
          onSelectCatalogItem={setSelectedCatalogItem}
        />

        {viewMode === '2d' ? (
          <CanvasArea
            room={selectedRoom as unknown as RoomPayload | null}
            onRoomUpdated={handleRoomUpdated}
            editor={editor}
            openings={openings}
            selectedOpeningId={selectedOpeningId}
            onSelectOpening={setSelectedOpeningId}
            onAddOpening={handleAddOpening}
            placements={placements}
            selectedPlacementId={selectedPlacementId}
            onSelectPlacement={setSelectedPlacementId}
            canAddPlacement={selectedCatalogItem !== null}
            onAddPlacement={handleAddPlacement}
          />
        ) : (
          <Preview3D room={selectedRoom as unknown as RoomPayload | null} />
        )}

        <RightSidebar
          projectId={id ?? ''}
          room={selectedRoom}
          selectedVertexIndex={state.selectedIndex}
          selectedVertex={selectedVertex}
          selectedEdgeIndex={state.selectedEdgeIndex}
          edgeLengthMm={selEdgeLen}
          selectedOpening={selectedOpening}
          selectedPlacement={selectedPlacement}
          selectedCatalogItem={selectedCatalogItem}
          configuredDimensions={configuredDimensions}
          onConfigureDimensions={setConfiguredDimensions}
          chosenOptions={chosenOptions}
          onSetChosenOptions={setChosenOptions}
          ceilingConstraints={ceilingConstraints}
          selectedWallGeom={selectedWallGeom}
          onMoveVertex={editor.moveVertex}
          onSetEdgeLength={editor.setEdgeLength}
          onUpdateOpening={handleUpdateOpening}
          onDeleteOpening={handleDeleteOpening}
          onUpdatePlacement={handleUpdatePlacement}
          onDeletePlacement={handleDeletePlacement}
          onSaveCeilingConstraints={handleSaveCeilingConstraints}
          validationResult={validationResult}
          validationLoading={validationLoading}
          onRunValidation={handleRunValidation}
          placements={placements}
          selectedRoomId={selectedRoomId}
        />
      </div>

      <StatusBar project={project} selectedRoom={selectedRoom} />

      {isPreviewPopoutOpen && (
        <PopoutWindow
          title={`${project.name} - 3D Preview`}
          name={`yakds-preview-${project.id}`}
          onClose={() => setIsPreviewPopoutOpen(false)}
        >
          <Preview3D room={selectedRoom as unknown as RoomPayload | null} />
        </PopoutWindow>
      )}
    </div>
  )
}
