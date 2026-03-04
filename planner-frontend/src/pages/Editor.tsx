import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import type { Vertex } from '@shared/types'
import { projectsApi, type ProjectDetail } from '../api/projects.js'
import {
  type CatalogArticle,
  type UnifiedCatalogItem,
} from '../api/catalog.js'
import { placementsApi, type Placement } from '../api/placements.js'
import { dimensionsApi, type Dimension } from '../api/dimensions.js'
import { centerlinesApi, type Centerline } from '../api/centerlines.js'
import { roomsApi, type ReferenceImagePayload, type RoomBoundaryPayload, type RoomPayload } from '../api/rooms.js'
import { areasApi } from '../api/areas.js'
import { openingsApi, type Opening } from '../api/openings.js'
import { validateApi, type ValidateResponse } from '../api/validate.js'
import { autoCompletionApi, type AutoCompleteResult } from '../api/autoCompletion.js'
import { acousticsApi, type AcousticGridMeta, type GeoJsonGrid } from '../api/acoustics.js'
import { usePolygonEditor, edgeLengthMm, type EditorState } from '../editor/usePolygonEditor.js'
import { CanvasArea } from '../components/editor/CanvasArea.js'
import { PopoutWindow } from '../components/editor/PopoutWindow.js'
import { Preview3D } from '../components/editor/Preview3D.js'
import { LeftSidebar } from '../components/editor/LeftSidebar.js'
import { RightSidebar, type CeilingConstraint, type ConfiguredDimensions } from '../components/editor/RightSidebar.js'
import { StatusBar } from '../components/editor/StatusBar.js'
import { AreasPanel } from '../components/editor/AreasPanel.js'
import { LayoutSheetTabs } from '../components/editor/LayoutSheetTabs.js'
import styles from './Editor.module.css'
import {
  clampNumber,
  loadPlannerViewSettings,
  savePlannerViewSettings,
  type PlannerViewMode,
} from './plannerViewSettings.js'

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

function parseReferenceImage(raw: unknown): NonNullable<EditorState['referenceImage']> | null {
  if (!raw || typeof raw !== 'object') return null
  const candidate = raw as Partial<ReferenceImagePayload>
  if (typeof candidate.url !== 'string' || candidate.url.length === 0) return null

  return {
    url: candidate.url,
    x: typeof candidate.x === 'number' ? candidate.x : 50,
    y: typeof candidate.y === 'number' ? candidate.y : 50,
    rotation: typeof candidate.rotation === 'number' ? candidate.rotation : 0,
    scale: typeof candidate.scale === 'number' ? candidate.scale : 1,
    opacity: typeof candidate.opacity === 'number' ? candidate.opacity : 0.5,
  }
}

interface SyncedCameraState {
  x_mm: number
  y_mm: number
  yaw_rad: number
  pitch_rad: number
  camera_height_mm: number
}

export function Editor() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [project, setProject] = useState<ProjectDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<PlannerViewMode>('2d')
  const [splitRatio, setSplitRatio] = useState(58)
  const [splitDragging, setSplitDragging] = useState(false)
  const [showVirtualVisitor, setShowVirtualVisitor] = useState(true)
  const [cameraHeightMm, setCameraHeightMm] = useState(1650)
  const [cameraState, setCameraState] = useState<SyncedCameraState>({
    x_mm: 0,
    y_mm: 0,
    yaw_rad: 0,
    pitch_rad: -0.12,
    camera_height_mm: 1650,
  })
  const [compactLayout, setCompactLayout] = useState(() => (typeof window !== 'undefined' ? window.innerWidth < 1180 : false))
  const [openings, setOpenings] = useState<Opening[]>([])
  const [selectedOpeningId, setSelectedOpeningId] = useState<string | null>(null)
  const [placements, setPlacements] = useState<Placement[]>([])
  const [dimensions, setDimensions] = useState<Dimension[]>([])
  const [centerlines, setCenterlines] = useState<Centerline[]>([])
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
  const [selectedAlternativeId, setSelectedAlternativeId] = useState<string | null>(null)
  const [gltfExportLoading, setGltfExportLoading] = useState(false)
  const [acousticEnabled, setAcousticEnabled] = useState(false)
  const [acousticOpacityPct, setAcousticOpacityPct] = useState(50)
  const [acousticVariable, setAcousticVariable] = useState<'spl_db' | 'spl_dba' | 't20_s' | 'sti'>('spl_db')
  const [acousticGrids, setAcousticGrids] = useState<AcousticGridMeta[]>([])
  const [activeAcousticGridId, setActiveAcousticGridId] = useState<string | null>(null)
  const [acousticGrid, setAcousticGrid] = useState<GeoJsonGrid | null>(null)
  const [acousticBusy, setAcousticBusy] = useState(false)
  const [acousticMin, setAcousticMin] = useState<number | null>(null)
  const [acousticMax, setAcousticMax] = useState<number | null>(null)
  const [workflowStep, setWorkflowStep] = useState<'walls' | 'openings' | 'furniture'>('walls')
  const [activeLayoutSheetId, setActiveLayoutSheetId] = useState<string | null>(null)
  const [moreMenuOpen, setMoreMenuOpen] = useState(false)
  const moreMenuRef = useRef<HTMLDivElement | null>(null)
  const splitContainerRef = useRef<HTMLDivElement | null>(null)
  const centeredVisitorRoomIdRef = useRef<string | null>(null)

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

  const refreshAcousticGrids = useCallback(async () => {
    if (!id) {
      return
    }

    const grids = await acousticsApi.listGrids(id)
    setAcousticGrids(grids)

    setActiveAcousticGridId((current) => {
      if (current && grids.some((grid) => grid.id === current)) {
        return current
      }

      const variableMatch = grids.find((grid) => grid.variable === acousticVariable)
      return variableMatch?.id ?? grids[0]?.id ?? null
    })
  }, [id, acousticVariable])

  useEffect(() => {
    if (!id) {
      return
    }

    refreshAcousticGrids().catch((error: unknown) => {
      console.error('Akustik-Grids laden fehlgeschlagen:', error)
    })
  }, [id, refreshAcousticGrids])

  useEffect(() => {
    const match = acousticGrids.find((grid) => grid.id === activeAcousticGridId)
    if (!match) {
      return
    }

    setAcousticVariable(match.variable)
  }, [activeAcousticGridId, acousticGrids])

  useEffect(() => {
    if (!activeAcousticGridId || !acousticEnabled) {
      setAcousticGrid(null)
      setAcousticMin(null)
      setAcousticMax(null)
      return
    }

    acousticsApi.getTiles(activeAcousticGridId)
      .then((grid) => {
        setAcousticGrid(grid)
        setAcousticMin(grid.min)
        setAcousticMax(grid.max)
      })
      .catch((error: unknown) => {
        console.error('Akustik-Kacheln laden fehlgeschlagen:', error)
        setAcousticGrid(null)
        setAcousticMin(null)
        setAcousticMax(null)
      })
  }, [activeAcousticGridId, acousticEnabled])

  const handleAcousticUpload = useCallback(async (file: File) => {
    if (!id) {
      return
    }

    setAcousticBusy(true)
    try {
      const result = await acousticsApi.importCnivg(id, file)
      await refreshAcousticGrids()
      setActiveAcousticGridId(result.grid_id)
      setAcousticEnabled(true)
    } catch (error) {
      alert(`Akustik-Import fehlgeschlagen: ${String(error)}`)
    } finally {
      setAcousticBusy(false)
    }
  }, [id, refreshAcousticGrids])

  const handleDeleteAcousticGrid = useCallback(async (gridId: string) => {
    if (!id) {
      return
    }

    setAcousticBusy(true)
    try {
      await acousticsApi.deleteGrid(gridId)
      if (activeAcousticGridId === gridId) {
        setActiveAcousticGridId(null)
      }
      await refreshAcousticGrids()
    } catch (error) {
      alert(`Akustik-Grid löschen fehlgeschlagen: ${String(error)}`)
    } finally {
      setAcousticBusy(false)
    }
  }, [id, activeAcousticGridId, refreshAcousticGrids])

  const handleSetAcousticVariable = useCallback((variable: 'spl_db' | 'spl_dba' | 't20_s' | 'sti') => {
    setAcousticVariable(variable)
    const match = acousticGrids.find((grid) => grid.variable === variable)
    if (match) {
      setActiveAcousticGridId(match.id)
    }
  }, [acousticGrids])

  // Close "Mehr" flyout on outside click
  useEffect(() => {
    if (!moreMenuOpen) return
    function handleOutsideClick(e: MouseEvent) {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setMoreMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [moreMenuOpen])

  useEffect(() => {
    const onResize = () => {
      setCompactLayout(window.innerWidth < 1180)
    }
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    if (!id) {
      return
    }

    const saved = loadPlannerViewSettings(id)
    if (!saved) {
      return
    }

    setViewMode(saved.mode)
    setSplitRatio(saved.split_ratio)
    setShowVirtualVisitor(saved.visitor_visible)
    setCameraHeightMm(saved.camera_height_mm)
    setCameraState((prev) => ({
      ...prev,
      camera_height_mm: saved.camera_height_mm,
    }))
  }, [id])

  useEffect(() => {
    if (!id) {
      return
    }

    savePlannerViewSettings(id, {
      mode: viewMode,
      split_ratio: splitRatio,
      visitor_visible: showVirtualVisitor,
      camera_height_mm: cameraHeightMm,
    })
  }, [id, viewMode, splitRatio, showVirtualVisitor, cameraHeightMm])

  useEffect(() => {
    setCameraState((prev) => ({
      ...prev,
      camera_height_mm: cameraHeightMm,
    }))
  }, [cameraHeightMm])

  useEffect(() => {
    if (!splitDragging) {
      return
    }

    const handlePointerMove = (event: MouseEvent) => {
      const host = splitContainerRef.current
      if (!host) {
        return
      }
      const rect = host.getBoundingClientRect()
      const ratio = ((event.clientX - rect.left) / rect.width) * 100
      setSplitRatio(clampNumber(ratio, 25, 75))
    }

    const handlePointerUp = () => {
      setSplitDragging(false)
    }

    window.addEventListener('mousemove', handlePointerMove)
    window.addEventListener('mouseup', handlePointerUp)
    return () => {
      window.removeEventListener('mousemove', handlePointerMove)
      window.removeEventListener('mouseup', handlePointerUp)
    }
  }, [splitDragging])

  useEffect(() => {
    if (!splitContainerRef.current) {
      return
    }
    splitContainerRef.current.style.setProperty('--split-left', `${splitRatio}%`)
  }, [splitRatio, viewMode])

  useEffect(() => {
    if (!id) return
    areasApi.list(id)
      .then((areas) => {
        const allAlternatives = areas.flatMap((area) => area.alternatives)
        const preferred = allAlternatives.find((alternative) => alternative.is_active) ?? allAlternatives[0] ?? null
        setSelectedAlternativeId(preferred?.id ?? null)
      })
      .catch(() => {
        setSelectedAlternativeId(null)
      })
  }, [id])

  // Editor-Vertices + Öffnungen neu laden wenn Raum wechselt
  useEffect(() => {
    setSelectedOpeningId(null)
    setSelectedPlacementId(null)
    if (!project || !selectedRoomId) {
      editor.reset()
      setOpenings([])
      setPlacements([])
      setDimensions([])
      setCenterlines([])
      return
    }
    const room = project.rooms.find(r => r.id === selectedRoomId)
    const verts = ((room?.boundary as RoomBoundaryPayload | undefined)?.vertices ?? []) as Vertex[]
    if (verts.length >= 3) {
      editor.loadVertices(verts)
    } else {
      editor.reset()
    }
    editor.setReferenceImage(parseReferenceImage((room as unknown as RoomPayload | undefined)?.reference_image))
    // Öffnungen aus room.openings laden (JSONB, bereits im room-Objekt)
    setOpenings((room?.openings as unknown as Opening[]) ?? [])
    setPlacements((room?.placements as unknown as Placement[]) ?? [])

    let cancelled = false
    dimensionsApi.list(selectedRoomId)
      .then((items) => {
        if (!cancelled) setDimensions(items)
      })
      .catch(() => {
        if (!cancelled) setDimensions([])
      })

    centerlinesApi.list(selectedRoomId)
      .then((items) => {
        if (!cancelled) setCenterlines(items)
      })
      .catch(() => {
        if (!cancelled) setCenterlines([])
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRoomId])

  // Raum anlegen (Name kommt aus dem Inline-Formular der LeftSidebar)
  const handleAddRoom = useCallback(async (name: string) => {
    if (!project) return
    const newRoom = await roomsApi.create({
      project_id: project.id,
      name,
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

  const handleGltfExport = useCallback(async () => {
    if (!selectedAlternativeId) {
      alert('Keine Alternative ausgewählt')
      return
    }

    setGltfExportLoading(true)
    try {
      const response = await fetch(`/api/v1/alternatives/${selectedAlternativeId}/export/gltf`, {
        method: 'POST',
        headers: { 'X-Tenant-Id': '00000000-0000-0000-0000-000000000001' },
      })

      if (!response.ok) {
        alert('Export fehlgeschlagen')
        return
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `planung-${selectedAlternativeId}.glb`
      link.click()
      URL.revokeObjectURL(url)
    } catch {
      alert('Export fehlgeschlagen')
    } finally {
      setGltfExportLoading(false)
    }
  }, [selectedAlternativeId])

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

  const handleReferenceImageUpdate = useCallback((img: NonNullable<EditorState['referenceImage']>) => {
    editor.setReferenceImage(img)
    if (!selectedRoomRef.current) return

    roomsApi.updateReferenceImage(selectedRoomRef.current.id, img)
      .then((updated) => {
        handleRoomUpdated(updated)
      })
      .catch((e: Error) => {
        console.error('Referenzbild speichern fehlgeschlagen:', e)
      })
  }, [editor, handleRoomUpdated])

  const selectedRoom = project?.rooms.find(r => r.id === selectedRoomId) ?? null
  selectedRoomRef.current = selectedRoom as unknown as RoomPayload | null

  const effectiveViewMode: PlannerViewMode = compactLayout && viewMode === 'split' ? '2d' : viewMode

  useEffect(() => {
    if (!selectedRoom) {
      return
    }

    if (centeredVisitorRoomIdRef.current === selectedRoom.id) {
      return
    }
    centeredVisitorRoomIdRef.current = selectedRoom.id

    const boundary = selectedRoom.boundary as RoomBoundaryPayload | undefined
    const vertices = (boundary?.vertices ?? []) as Vertex[]
    if (vertices.length < 1) {
      return
    }

    const sum = vertices.reduce(
      (acc, vertex) => ({
        x_mm: acc.x_mm + vertex.x_mm,
        y_mm: acc.y_mm + vertex.y_mm,
      }),
      { x_mm: 0, y_mm: 0 },
    )
    const centerX = Math.round(sum.x_mm / vertices.length)
    const centerY = Math.round(sum.y_mm / vertices.length)

    setCameraState((prev) => ({
      ...prev,
      x_mm: centerX,
      y_mm: centerY,
      camera_height_mm: cameraHeightMm,
    }))
  }, [selectedRoom, cameraHeightMm])

  const handleRepositionVisitor = useCallback((point: { x_mm: number; y_mm: number }) => {
    setCameraState((prev) => ({
      ...prev,
      x_mm: point.x_mm,
      y_mm: point.y_mm,
    }))
  }, [])

  const handleCameraStateChange = useCallback((next: SyncedCameraState) => {
    setCameraState((prev) => {
      const stable =
        Math.abs(prev.x_mm - next.x_mm) < 1 &&
        Math.abs(prev.y_mm - next.y_mm) < 1 &&
        Math.abs(prev.camera_height_mm - next.camera_height_mm) < 1 &&
        Math.abs(prev.yaw_rad - next.yaw_rad) < 0.0005 &&
        Math.abs(prev.pitch_rad - next.pitch_rad) < 0.0005
      return stable ? prev : next
    })
    setCameraHeightMm(clampNumber(Math.round(next.camera_height_mm), 900, 2400))
  }, [])

  useEffect(() => {
    if (!selectedRoom) {
      setIsPreviewPopoutOpen(false)
    }
  }, [selectedRoom])

  // Auswahl-Info für RightSidebar – muss VOR den Early-Returns stehen (Rules of Hooks)
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

  const canvasPanel = (
    <CanvasArea
      room={selectedRoom as unknown as RoomPayload | null}
      onRoomUpdated={handleRoomUpdated}
      editor={editor}
      openings={openings}
      selectedOpeningId={selectedOpeningId}
      onSelectOpening={setSelectedOpeningId}
      onAddOpening={handleAddOpening}
      placements={placements}
      dimensions={dimensions}
      centerlines={centerlines}
      selectedPlacementId={selectedPlacementId}
      onSelectPlacement={setSelectedPlacementId}
      canAddPlacement={selectedCatalogItem !== null}
      onAddPlacement={handleAddPlacement}
      acousticGrid={acousticGrid}
      acousticVisible={acousticEnabled}
      acousticOpacity={acousticOpacityPct / 100}
      onReferenceImageUpdate={handleReferenceImageUpdate}
      virtualVisitor={{
        x_mm: cameraState.x_mm,
        y_mm: cameraState.y_mm,
        yaw_rad: cameraState.yaw_rad,
        visible: showVirtualVisitor,
      }}
      onRepositionVisitor={showVirtualVisitor ? handleRepositionVisitor : undefined}
    />
  )

  const previewPanel = (
    <Preview3D
      room={selectedRoom as unknown as RoomPayload | null}
      cameraState={cameraState}
      onCameraStateChange={handleCameraStateChange}
    />
  )

  if (loading) return <div className={styles.center}>Lade Projekt…</div>
  if (error) return <div className={styles.center}>{error}</div>
  if (!project) return null

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
          <div className={styles.modeSwitch} aria-label="Ansichtsmodus">
            <button
              type="button"
              className={`${styles.modeBtn} ${viewMode === '2d' ? styles.modeBtnActive : ''}`}
              onClick={() => setViewMode('2d')}
            >
              2D
            </button>
            <button
              type="button"
              className={`${styles.modeBtn} ${viewMode === 'split' ? styles.modeBtnActive : ''}`}
              onClick={() => setViewMode('split')}
              title={compactLayout ? 'Split auf kleinen Displays nicht verfügbar' : '2D und 3D parallel'}
              disabled={compactLayout}
            >
              Split
            </button>
            <button
              type="button"
              className={`${styles.modeBtn} ${viewMode === '3d' ? styles.modeBtnActive : ''}`}
              onClick={() => setViewMode('3d')}
            >
              3D
            </button>
          </div>
          <label className={styles.visitorToggle}>
            <input
              type="checkbox"
              checked={showVirtualVisitor}
              onChange={(event) => setShowVirtualVisitor(event.target.checked)}
            />
            Besucher
          </label>
          <label className={styles.heightControl}>
            Höhe {cameraHeightMm} mm
            <input
              type="range"
              min={900}
              max={2400}
              step={10}
              value={cameraHeightMm}
              onChange={(event) => setCameraHeightMm(Number(event.target.value))}
            />
          </label>
          <div className={styles.moreMenuWrapper} ref={moreMenuRef}>
            <button
              type="button"
              className={styles.btnSecondary}
              aria-haspopup="true"
              onClick={() => setMoreMenuOpen((prev) => !prev)}
            >
              Mehr ▾
            </button>
            {moreMenuOpen && (
              <div className={styles.moreMenu} role="menu">
                <button
                  role="menuitem"
                  type="button"
                  className={styles.moreMenuItem}
                  onClick={() => { setMoreMenuOpen(false); void handleAutoComplete() }}
                  disabled={autoCompleteLoading || !selectedRoomId}
                  title="Arbeitsplatten, Sockel und Wangen automatisch generieren"
                >
                  {autoCompleteLoading ? 'Generiere…' : 'Auto vervollständigen'}
                </button>
                <button
                  role="menuitem"
                  type="button"
                  className={styles.moreMenuItem}
                  onClick={() => { setMoreMenuOpen(false); setIsPreviewPopoutOpen((prev) => !prev) }}
                  disabled={!selectedRoom}
                  title="3D-Ansicht in separatem Fenster öffnen"
                >
                  {isPreviewPopoutOpen ? '3D-Fenster schließen' : '3D in Fenster'}
                </button>
                <button
                  role="menuitem"
                  type="button"
                  className={styles.moreMenuItem}
                  onClick={() => { setMoreMenuOpen(false); navigate(`/projects/${id}/quote-lines`) }}
                >
                  Angebotspositionen
                </button>
                <button
                  role="menuitem"
                  type="button"
                  className={styles.moreMenuItem}
                  onClick={() => { setMoreMenuOpen(false); navigate(`/projects/${id}/panorama-tours`) }}
                >
                  Panorama-Touren
                </button>
                <button
                  role="menuitem"
                  type="button"
                  className={styles.moreMenuItem}
                  onClick={() => { setMoreMenuOpen(false); navigate(`/projects/${id}/specification-packages`) }}
                >
                  Werkstattpakete
                </button>
                <button
                  role="menuitem"
                  type="button"
                  className={styles.moreMenuItem}
                  onClick={() => { setMoreMenuOpen(false); void handleGltfExport() }}
                  disabled={gltfExportLoading || !selectedAlternativeId}
                >
                  {gltfExportLoading ? 'GLB exportiere…' : 'GLB exportieren'}
                </button>
                <button
                  role="menuitem"
                  type="button"
                  className={styles.moreMenuItem}
                  onClick={() => { setMoreMenuOpen(false); setShowAreasPanel((prev) => !prev) }}
                >
                  {showAreasPanel ? 'Bereiche ausblenden' : 'Bereiche / Alternativen'}
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Workflow step tabs */}
      <nav className={styles.stepBar} aria-label="Arbeitsschritte">
        {(['walls', 'openings', 'furniture'] as const).map((step, idx) => {
          const labels = ['1 · Wände', '2 · Öffnungen', '3 · Möbelierung'] as const
          const isActive = workflowStep === step
          return (
            <button
              key={step}
              type="button"
              aria-current={isActive ? 'step' : undefined}
              className={`${styles.stepTab} ${isActive ? styles.stepTabActive : ''}`}
              onClick={() => setWorkflowStep(step)}
              onKeyDown={(e: KeyboardEvent<HTMLButtonElement>) => {
                const steps = ['walls', 'openings', 'furniture'] as const
                if (e.key === 'ArrowRight') { e.preventDefault(); setWorkflowStep(steps[Math.min(idx + 1, 2)]) }
                if (e.key === 'ArrowLeft') { e.preventDefault(); setWorkflowStep(steps[Math.max(idx - 1, 0)]) }
              }}
            >
              {labels[idx]}
            </button>
          )
        })}
      </nav>

      {id && (
        <LayoutSheetTabs
          projectId={id}
          activeSheetId={activeLayoutSheetId}
          onSheetChange={setActiveLayoutSheetId}
        />
      )}

      <div className={styles.workspace}>
        {showAreasPanel && id && (
          <AreasPanel projectId={id} onOpenAlternative={setSelectedAlternativeId} />
        )}
        <LeftSidebar
          rooms={project.rooms}
          selectedRoomId={selectedRoomId}
          onSelectRoom={setSelectedRoomId}
          onAddRoom={handleAddRoom}
          selectedCatalogItem={selectedCatalogItem}
          onSelectCatalogItem={setSelectedCatalogItem}
          workflowStep={workflowStep}
        />

        <div className={styles.editorViewport}>
          {effectiveViewMode === '2d' && canvasPanel}

          {effectiveViewMode === '3d' && previewPanel}

          {effectiveViewMode === 'split' && (
            <div className={styles.splitLayout} ref={splitContainerRef}>
              <div className={`${styles.splitPane} ${styles.splitPanePrimary}`}>
                {canvasPanel}
              </div>
              <div
                className={styles.splitDivider}
                role="separator"
                aria-orientation="vertical"
                aria-label="Split-Ansicht verschieben"
                onMouseDown={() => setSplitDragging(true)}
              />
              <div className={`${styles.splitPane} ${styles.splitPaneSecondary}`}>
                {previewPanel}
              </div>
            </div>
          )}
        </div>

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
          acousticEnabled={acousticEnabled}
          acousticOpacityPct={acousticOpacityPct}
          acousticVariable={acousticVariable}
          acousticGrids={acousticGrids}
          activeAcousticGridId={activeAcousticGridId}
          acousticMin={acousticMin}
          acousticMax={acousticMax}
          acousticBusy={acousticBusy}
          onToggleAcoustics={setAcousticEnabled}
          onSetAcousticOpacityPct={setAcousticOpacityPct}
          onSetAcousticVariable={handleSetAcousticVariable}
          onAcousticUpload={handleAcousticUpload}
          onSelectAcousticGrid={setActiveAcousticGridId}
          onDeleteAcousticGrid={handleDeleteAcousticGrid}
        />
      </div>

      <StatusBar project={project} selectedRoom={selectedRoom} />

      {isPreviewPopoutOpen && (
        <PopoutWindow
          title={`${project.name} - 3D Preview`}
          name={`yakds-preview-${project.id}`}
          onClose={() => setIsPreviewPopoutOpen(false)}
        >
          <Preview3D
            room={selectedRoom as unknown as RoomPayload | null}
            cameraState={cameraState}
            onCameraStateChange={handleCameraStateChange}
          />
        </PopoutWindow>
      )}
    </div>
  )
}
