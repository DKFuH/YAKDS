import { useCallback, useEffect, useReducer } from 'react'
import type { Point2D, Vertex } from '@shared/types'
import { validatePolygon } from '@shared/geometry/validatePolygon'
import { buildAllowedAngles, getMagnetizedLength, snapPoint, type SnapSegment } from './snapUtils.js'
import { loadEditorSettings, saveEditorSettings } from './editorPreferences.js'

// ─── Typen ───────────────────────────────────────────────────────────────────

export type EditorTool = 'draw' | 'select' | 'move' | 'calibrate'

export interface ReferenceImageState {
  url: string
  x: number
  y: number
  rotation: number
  scale: number
  opacity: number
}

export interface EditorSettings {
  gridSizeMm: number   // 0 = kein Raster
  angleSnap: boolean
  angleStepDeg: number
  magnetismEnabled: boolean
  axisMagnetismEnabled: boolean
  magnetismToleranceMm: number
  lengthSnapStepMm: number
  minEdgeLengthMm: number
}

export interface EditorState {
  tool: EditorTool
  vertices: Vertex[]
  /** Stabile Wand-IDs: wallIds[i] = ID der Kante von vertex[i] zu vertex[(i+1)%n] */
  wallIds: string[]
  closed: boolean
  selectedIndex: number | null
  selectedEdgeIndex: number | null
  hoverIndex: number | null
  settings: EditorSettings
  referenceImage: ReferenceImageState | null
  validationErrors: string[]
  isDirty: boolean
}

export interface SnapOverrideOptions {
  disableMagnetism?: boolean
  magnetismToleranceMmOverride?: number
}

export interface EdgeLengthSetOptions {
  fineStep?: boolean
}

type Action =
  | { type: 'SET_TOOL'; tool: EditorTool }
  | { type: 'ADD_VERTEX'; point: Point2D; disableMagnetism?: boolean; magnetismToleranceMmOverride?: number }
  | { type: 'CLOSE_POLYGON' }
  | { type: 'MOVE_VERTEX'; index: number; point: Point2D; disableMagnetism?: boolean; magnetismToleranceMmOverride?: number }
  | { type: 'SELECT_VERTEX'; index: number | null }
  | { type: 'SELECT_EDGE'; index: number | null }
  | { type: 'HOVER_VERTEX'; index: number | null }
  | { type: 'DELETE_VERTEX'; index: number }
  | { type: 'SET_EDGE_LENGTH'; edgeIndex: number; lengthMm: number; useFineStep?: boolean }
  | { type: 'LOAD_VERTICES'; vertices: Vertex[] }
  | { type: 'LOAD_BOUNDARY'; vertices: Vertex[]; wallIds?: string[] }
  | { type: 'RESET' }
  | { type: 'UPDATE_SETTINGS'; settings: Partial<EditorSettings> }
  | { type: 'SET_REFERENCE_IMAGE'; referenceImage: ReferenceImageState | null }

// ─── Hilfsfunktionen ─────────────────────────────────────────────────────────

function newId(): string { return crypto.randomUUID() }

function buildVertex(point: Point2D, index: number): Vertex {
  return { id: newId(), x_mm: point.x_mm, y_mm: point.y_mm, index }
}

function reindex(vertices: Vertex[]): Vertex[] {
  return vertices.map((v, i) => ({ ...v, index: i }))
}

function runValidation(vertices: Vertex[], minEdgeLengthMm: number, closed: boolean): string[] {
  if (!closed || vertices.length < 3) return []
  return validatePolygon(vertices, minEdgeLengthMm).errors
}

function buildMagnetismSegments(vertices: Vertex[], closed: boolean, excludedVertexIndices: number[] = []): SnapSegment[] {
  if (vertices.length < 2) return []

  const excluded = new Set(excludedVertexIndices)
  const segments: SnapSegment[] = []
  const edgeCount = closed ? vertices.length : vertices.length - 1

  for (let i = 0; i < edgeCount; i += 1) {
    const nextIndex = (i + 1) % vertices.length
    if (excluded.has(i) || excluded.has(nextIndex)) {
      continue
    }

    const start = vertices[i]
    const end = vertices[nextIndex]
    segments.push({
      start: { x_mm: start.x_mm, y_mm: start.y_mm },
      end: { x_mm: end.x_mm, y_mm: end.y_mm },
    })
  }

  return segments
}

/** Berechnet Kantenlänge in mm */
export function edgeLengthMm(vertices: Vertex[], edgeIndex: number): number {
  if (vertices.length < 2) return 0
  const a = vertices[edgeIndex]
  const b = vertices[(edgeIndex + 1) % vertices.length]
  return Math.hypot(b.x_mm - a.x_mm, b.y_mm - a.y_mm)
}

/** Setzt Kantenlänge durch Verschieben des Endpunkts entlang der Kantenrichtung */
function applySetEdgeLength(vertices: Vertex[], edgeIndex: number, lengthMm: number): Vertex[] {
  if (vertices.length < 2 || lengthMm <= 0) return vertices
  const endIdx = (edgeIndex + 1) % vertices.length
  const a = vertices[edgeIndex]
  const b = vertices[endIdx]
  const dx = b.x_mm - a.x_mm
  const dy = b.y_mm - a.y_mm
  const len = Math.hypot(dx, dy)
  const factor = len > 0 ? lengthMm / len : 1
  return vertices.map((v, i) =>
    i === endIdx
      ? { ...v, x_mm: a.x_mm + dx * factor, y_mm: a.y_mm + dy * factor }
      : v,
  )
}

// ─── Reducer ─────────────────────────────────────────────────────────────────

const DEFAULT_SETTINGS: EditorSettings = {
  gridSizeMm: 100,
  angleSnap: true,
  angleStepDeg: 45,
  magnetismEnabled: true,
  axisMagnetismEnabled: true,
  magnetismToleranceMm: 120,
  lengthSnapStepMm: 50,
  minEdgeLengthMm: 100,
}

function initialState(settingsOverride: Partial<EditorSettings> = {}): EditorState {
  return {
    tool: 'draw',
    vertices: [],
    wallIds: [],
    closed: false,
    selectedIndex: null,
    selectedEdgeIndex: null,
    hoverIndex: null,
    settings: { ...DEFAULT_SETTINGS, ...settingsOverride },
    referenceImage: null,
    validationErrors: [],
    isDirty: false,
  }
}

function sanitizeWallIds(vertices: Vertex[], wallIds?: string[]): string[] {
  return vertices.map((_, index) => {
    const candidate = wallIds?.[index]
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate
    }
    return newId()
  })
}

function reducer(state: EditorState, action: Action): EditorState {
  switch (action.type) {
    case 'SET_TOOL':
      return { ...state, tool: action.tool, selectedIndex: null, selectedEdgeIndex: null }

    case 'ADD_VERTEX': {
      if (state.closed || state.tool !== 'draw') return state
      const origin = state.vertices.at(-1) ?? null
      const magnetismEnabled = state.settings.magnetismEnabled && !action.disableMagnetism
      const axisMagnetismEnabled = state.settings.axisMagnetismEnabled && !action.disableMagnetism
      const magnetismToleranceMm = Number.isFinite(action.magnetismToleranceMmOverride) && (action.magnetismToleranceMmOverride ?? 0) > 0
        ? Math.round(action.magnetismToleranceMmOverride as number)
        : state.settings.magnetismToleranceMm
      const snapped = snapPoint(action.point, origin, state.settings.gridSizeMm, state.settings.angleSnap, {
        allowedAnglesDeg: buildAllowedAngles(state.settings.angleStepDeg),
        magnetismEnabled,
        magnetismCandidates: state.vertices.map((vertex) => ({ x_mm: vertex.x_mm, y_mm: vertex.y_mm })),
        axisMagnetismEnabled,
        magnetismSegments: buildMagnetismSegments(state.vertices, state.closed),
        magnetismToleranceMm,
        lengthMagnetismEnabled: !action.disableMagnetism,
        lengthSnapStepMm: state.settings.lengthSnapStepMm,
      })
      const newVertex = buildVertex(snapped, state.vertices.length)
      const vertices = [...state.vertices, newVertex]
      return {
        ...state,
        vertices,
        wallIds: [...state.wallIds, newId()],
        isDirty: true,
        validationErrors: runValidation(vertices, state.settings.minEdgeLengthMm, false),
      }
    }

    case 'CLOSE_POLYGON': {
      if (state.vertices.length < 3 || state.closed) return state
      const errors = runValidation(state.vertices, state.settings.minEdgeLengthMm, true)
      return { ...state, closed: true, tool: 'select', validationErrors: errors }
    }

    case 'MOVE_VERTEX': {
      if (action.index < 0 || action.index >= state.vertices.length) return state
      const magnetismEnabled = state.settings.magnetismEnabled && !action.disableMagnetism
      const axisMagnetismEnabled = state.settings.axisMagnetismEnabled && !action.disableMagnetism
      const magnetismToleranceMm = Number.isFinite(action.magnetismToleranceMmOverride) && (action.magnetismToleranceMmOverride ?? 0) > 0
        ? Math.round(action.magnetismToleranceMmOverride as number)
        : state.settings.magnetismToleranceMm
      const snapped = snapPoint(action.point, null, state.settings.gridSizeMm, false, {
        magnetismEnabled,
        magnetismCandidates: state.vertices
          .filter((_, index) => index !== action.index)
          .map((vertex) => ({ x_mm: vertex.x_mm, y_mm: vertex.y_mm })),
        axisMagnetismEnabled,
        magnetismSegments: buildMagnetismSegments(state.vertices, state.closed, [action.index]),
        magnetismToleranceMm,
      })
      const vertices = state.vertices.map((v, i) =>
        i === action.index ? { ...v, x_mm: snapped.x_mm, y_mm: snapped.y_mm } : v,
      )
      return {
        ...state,
        vertices,
        isDirty: true,
        validationErrors: runValidation(vertices, state.settings.minEdgeLengthMm, state.closed),
      }
    }

    case 'SELECT_VERTEX':
      return { ...state, selectedIndex: action.index, selectedEdgeIndex: null }

    case 'SELECT_EDGE':
      return { ...state, selectedEdgeIndex: action.index, selectedIndex: null }

    case 'HOVER_VERTEX':
      return { ...state, hoverIndex: action.index }

    case 'DELETE_VERTEX': {
      if (state.vertices.length <= 3) return state
      const vertices = reindex(state.vertices.filter((_, i) => i !== action.index))
      const wallIds = state.wallIds.filter((_, i) => i !== action.index)
      return {
        ...state,
        vertices,
        wallIds,
        selectedIndex: null,
        selectedEdgeIndex: null,
        closed: state.closed && vertices.length >= 3,
        isDirty: true,
        validationErrors: runValidation(vertices, state.settings.minEdgeLengthMm, state.closed),
      }
    }

    case 'SET_EDGE_LENGTH': {
      if (!state.closed || action.edgeIndex < 0 || action.edgeIndex >= state.vertices.length) return state
      const baseStep = state.settings.lengthSnapStepMm
      const effectiveStep = action.useFineStep && baseStep > 0
        ? Math.max(1, Math.round(baseStep / 2))
        : baseStep
      const targetLength = getMagnetizedLength(action.lengthMm, effectiveStep)
      const vertices = applySetEdgeLength(state.vertices, action.edgeIndex, targetLength)
      return {
        ...state,
        vertices,
        isDirty: true,
        validationErrors: runValidation(vertices, state.settings.minEdgeLengthMm, state.closed),
      }
    }

    case 'LOAD_VERTICES': {
      const vertices = reindex(action.vertices)
      // Neue stabile Wall-IDs für alle Kanten erzeugen
      const wallIds = vertices.map(() => newId())
      return {
        ...initialState(),
        vertices,
        wallIds,
        closed: vertices.length >= 3,
        tool: 'select',
        validationErrors: runValidation(vertices, DEFAULT_SETTINGS.minEdgeLengthMm, true),
      }
    }

    case 'LOAD_BOUNDARY': {
      const vertices = reindex(action.vertices)
      const wallIds = sanitizeWallIds(vertices, action.wallIds)
      return {
        ...initialState(),
        vertices,
        wallIds,
        closed: vertices.length >= 3,
        tool: 'select',
        validationErrors: runValidation(vertices, DEFAULT_SETTINGS.minEdgeLengthMm, true),
      }
    }

    case 'RESET':
      return initialState()

    case 'UPDATE_SETTINGS': {
      const settings = { ...state.settings, ...action.settings }
      return {
        ...state,
        settings,
        validationErrors: runValidation(state.vertices, settings.minEdgeLengthMm, state.closed),
      }
    }

    case 'SET_REFERENCE_IMAGE':
      return { ...state, referenceImage: action.referenceImage }

    default:
      return state
  }
}

// Exported for reducer-level tests that should not rely on React hook runtime.
export function createInitialEditorState(): EditorState {
  return initialState()
}

export function editorReducer(state: EditorState, action: Action): EditorState {
  return reducer(state, action)
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function usePolygonEditor(initialVertices?: Vertex[]) {
  const [state, dispatch] = useReducer(
    reducer,
    undefined,
    () => {
      const s = initialState(loadEditorSettings())
      if (initialVertices && initialVertices.length >= 3) {
        return reducer(s, { type: 'LOAD_VERTICES', vertices: initialVertices })
      }
      return s
    },
  )

  useEffect(() => {
    saveEditorSettings(state.settings)
  }, [state.settings])

  const addVertex = useCallback((point: Point2D, options?: SnapOverrideOptions) =>
    dispatch({
      type: 'ADD_VERTEX',
      point,
      disableMagnetism: options?.disableMagnetism,
      magnetismToleranceMmOverride: options?.magnetismToleranceMmOverride,
    }), [])

  const closePolygon = useCallback(() =>
    dispatch({ type: 'CLOSE_POLYGON' }), [])

  const moveVertex = useCallback((index: number, point: Point2D, options?: SnapOverrideOptions) =>
    dispatch({
      type: 'MOVE_VERTEX',
      index,
      point,
      disableMagnetism: options?.disableMagnetism,
      magnetismToleranceMmOverride: options?.magnetismToleranceMmOverride,
    }), [])

  const selectVertex = useCallback((index: number | null) =>
    dispatch({ type: 'SELECT_VERTEX', index }), [])

  const selectEdge = useCallback((index: number | null) =>
    dispatch({ type: 'SELECT_EDGE', index }), [])

  const hoverVertex = useCallback((index: number | null) =>
    dispatch({ type: 'HOVER_VERTEX', index }), [])

  const deleteVertex = useCallback((index: number) =>
    dispatch({ type: 'DELETE_VERTEX', index }), [])

  const setEdgeLength = useCallback((edgeIndex: number, lengthMm: number, options?: EdgeLengthSetOptions) =>
    dispatch({ type: 'SET_EDGE_LENGTH', edgeIndex, lengthMm, useFineStep: options?.fineStep }), [])

  const setTool = useCallback((tool: EditorTool) =>
    dispatch({ type: 'SET_TOOL', tool }), [])

  const loadVertices = useCallback((vertices: Vertex[]) =>
    dispatch({ type: 'LOAD_VERTICES', vertices }), [])

  const loadBoundary = useCallback((vertices: Vertex[], wallIds?: string[]) =>
    dispatch({ type: 'LOAD_BOUNDARY', vertices, wallIds }), [])

  const reset = useCallback(() =>
    dispatch({ type: 'RESET' }), [])

  const updateSettings = useCallback((settings: Partial<EditorSettings>) =>
    dispatch({ type: 'UPDATE_SETTINGS', settings }), [])

  const setReferenceImage = useCallback((referenceImage: ReferenceImageState | null) =>
    dispatch({ type: 'SET_REFERENCE_IMAGE', referenceImage }), [])

  const isValid = state.closed && state.validationErrors.length === 0

  return {
    state,
    isValid,
    addVertex,
    closePolygon,
    moveVertex,
    selectVertex,
    selectEdge,
    hoverVertex,
    deleteVertex,
    setEdgeLength,
    setTool,
    loadVertices,
    loadBoundary,
    reset,
    updateSettings,
    setReferenceImage,
  }
}

export type EditorAPI = ReturnType<typeof usePolygonEditor>
