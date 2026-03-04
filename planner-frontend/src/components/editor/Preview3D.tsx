import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { RoomPayload } from '../../api/rooms.js'
import type { VerticalConnection } from '../../api/verticalConnections.js'
import { profileZoomFactor, type NavigationSettings } from './navigationSettings.js'
import styles from './Preview3D.module.css'

type VertexLike = { id: string; x_mm: number; y_mm: number }
type WallLike = { id: string; start_vertex_id?: string; end_vertex_id?: string }
type OpeningLike = { wall_id: string; offset_mm: number; width_mm: number }
type PlacementLike = {
  id: string
  wall_id: string
  offset_mm: number
  width_mm: number
  depth_mm: number
  height_mm: number
  material_assignment?: {
    color_hex?: string
    roughness?: number
    metallic?: number
  }
}

type SurfaceKey = 'floor' | 'ceiling' | 'wall_north' | 'wall_south' | 'wall_east' | 'wall_west'

type SurfaceColorMap = {
  floor?: string
  ceiling?: string
  wall_north?: string
  wall_south?: string
  wall_east?: string
  wall_west?: string
}

type OutlinePoint = { x_mm: number; y_mm: number }

type Bbox2dMm = {
  min_x_mm: number
  min_y_mm: number
  max_x_mm: number
  max_y_mm: number
  width_mm: number
  depth_mm: number
}

type WallSegmentResolved = {
  id: string
  start: { x_mm: number; y_mm: number }
  end: { x_mm: number; y_mm: number }
}

type SunlightPreview = {
  azimuth_deg: number
  elevation_deg: number
  intensity: number
  daylight_enabled: boolean
  sun_direction: {
    x: number
    y: number
    z: number
  }
}

interface Props {
  room: RoomPayload | null
  verticalConnections?: VerticalConnection[]
  cameraState?: {
    x_mm: number
    y_mm: number
    yaw_rad: number
    pitch_rad: number
    camera_height_mm: number
  } | null
  onCameraStateChange?: (state: {
    x_mm: number
    y_mm: number
    yaw_rad: number
    pitch_rad: number
    camera_height_mm: number
  }) => void
  sunlight?: SunlightPreview | null
  navigationSettings: NavigationSettings
}

const MM_TO_M = 0.001
const WALL_THICKNESS_MM = 120

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') {
    return null
  }
  return value as Record<string, unknown>
}

function isSurfaceKey(value: unknown): value is SurfaceKey {
  return value === 'floor' ||
    value === 'ceiling' ||
    value === 'wall_north' ||
    value === 'wall_south' ||
    value === 'wall_east' ||
    value === 'wall_west'
}

function isValidHexColor(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false
  }
  const trimmed = value.trim()
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(trimmed)
}

function hexColorToThreeColor(hexColor: string | undefined, fallback: number): number {
  if (!isValidHexColor(hexColor)) {
    return fallback
  }

  const normalized = hexColor.trim()
  const expanded = normalized.length === 4
    ? `#${normalized[1]}${normalized[1]}${normalized[2]}${normalized[2]}${normalized[3]}${normalized[3]}`
    : normalized

  const parsed = Number.parseInt(expanded.slice(1), 16)
  return Number.isFinite(parsed) ? parsed : fallback
}

function extractSurfaceColors(room: RoomPayload): SurfaceColorMap {
  const colors: SurfaceColorMap = {}
  const coloring = asRecord(room.coloring)
  const surfaces = Array.isArray(coloring?.surfaces) ? coloring.surfaces : []

  for (const entry of surfaces) {
    const surfaceEntry = asRecord(entry)
    if (!surfaceEntry) continue

    const surface = surfaceEntry.surface
    if (!isSurfaceKey(surface)) continue

    const colorHex = surfaceEntry.color_hex
    if (!isValidHexColor(colorHex)) continue

    colors[surface] = colorHex.trim()
  }

  return colors
}

function chooseWallColor(surfaceColors: SurfaceColorMap): string | undefined {
  return surfaceColors.wall_north
    ?? surfaceColors.wall_south
    ?? surfaceColors.wall_east
    ?? surfaceColors.wall_west
}

function clampUnitOrFallback(value: unknown, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed)) {
    return fallback
  }
  return Math.min(1, Math.max(0, parsed))
}

function parseOutlinePoints(value: unknown): OutlinePoint[] {
  if (!Array.isArray(value)) {
    return []
  }

  const points: OutlinePoint[] = []
  for (const entry of value) {
    const point = asRecord(entry)
    if (!point) continue
    if (typeof point.x_mm !== 'number' || !Number.isFinite(point.x_mm)) continue
    if (typeof point.y_mm !== 'number' || !Number.isFinite(point.y_mm)) continue
    points.push({ x_mm: point.x_mm, y_mm: point.y_mm })
  }

  return points
}

function bboxFromOutline(points: OutlinePoint[]): Bbox2dMm | null {
  if (points.length < 3) return null

  const xs = points.map((point) => point.x_mm)
  const ys = points.map((point) => point.y_mm)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const width = maxX - minX
  const depth = maxY - minY

  if (width <= 0 || depth <= 0) {
    return null
  }

  return {
    min_x_mm: minX,
    min_y_mm: minY,
    max_x_mm: maxX,
    max_y_mm: maxY,
    width_mm: width,
    depth_mm: depth,
  }
}

function readBbox(value: unknown): Bbox2dMm | null {
  const bbox = asRecord(value)
  if (!bbox) return null

  if (
    typeof bbox.min_x_mm !== 'number' ||
    typeof bbox.min_y_mm !== 'number' ||
    typeof bbox.max_x_mm !== 'number' ||
    typeof bbox.max_y_mm !== 'number'
  ) {
    return null
  }

  const minX = Math.min(bbox.min_x_mm, bbox.max_x_mm)
  const maxX = Math.max(bbox.min_x_mm, bbox.max_x_mm)
  const minY = Math.min(bbox.min_y_mm, bbox.max_y_mm)
  const maxY = Math.max(bbox.min_y_mm, bbox.max_y_mm)

  const width = typeof bbox.width_mm === 'number' && bbox.width_mm > 0
    ? bbox.width_mm
    : maxX - minX
  const depth = typeof bbox.depth_mm === 'number' && bbox.depth_mm > 0
    ? bbox.depth_mm
    : maxY - minY

  if (width <= 0 || depth <= 0) {
    return null
  }

  return {
    min_x_mm: minX,
    min_y_mm: minY,
    max_x_mm: maxX,
    max_y_mm: maxY,
    width_mm: width,
    depth_mm: depth,
  }
}

function resolveVerticalConnectionBbox(connection: VerticalConnection): Bbox2dMm | null {
  const opening = asRecord(connection.opening_json)
  const openingBbox = readBbox(opening?.bbox_mm)
  if (openingBbox) {
    return openingBbox
  }

  const openingOutline = parseOutlinePoints(opening?.opening_outline)
  const outlineBbox = bboxFromOutline(openingOutline)
  if (outlineBbox) {
    return outlineBbox
  }

  const footprint = asRecord(connection.footprint_json)
  const footprintVertices = parseOutlinePoints(footprint?.vertices)
  const verticesBbox = bboxFromOutline(footprintVertices)
  if (verticesBbox) {
    return verticesBbox
  }

  const footprintPolygon = parseOutlinePoints(footprint?.polygon)
  const polygonBbox = bboxFromOutline(footprintPolygon)
  if (polygonBbox) {
    return polygonBbox
  }

  const rect = asRecord(footprint?.rect)
  if (!rect) return null

  const width = typeof rect.width_mm === 'number' && rect.width_mm > 0 ? rect.width_mm : null
  const depth = typeof rect.depth_mm === 'number' && rect.depth_mm > 0 ? rect.depth_mm : null
  if (width == null || depth == null) return null

  const x = typeof rect.x_mm === 'number' && Number.isFinite(rect.x_mm) ? rect.x_mm : 0
  const y = typeof rect.y_mm === 'number' && Number.isFinite(rect.y_mm) ? rect.y_mm : 0

  return {
    min_x_mm: x,
    min_y_mm: y,
    max_x_mm: x + width,
    max_y_mm: y + depth,
    width_mm: width,
    depth_mm: depth,
  }
}

function resolveWalls(vertices: VertexLike[], walls: WallLike[]): WallSegmentResolved[] {
  const byId = new Map(vertices.map((vertex) => [vertex.id, vertex]))

  if (walls.length > 0 && walls.every((wall) => wall.start_vertex_id && wall.end_vertex_id)) {
    return walls
      .map((wall) => {
        const start = byId.get(wall.start_vertex_id as string)
        const end = byId.get(wall.end_vertex_id as string)
        if (!start || !end) {
          return null
        }
        return {
          id: wall.id,
          start: { x_mm: start.x_mm, y_mm: start.y_mm },
          end: { x_mm: end.x_mm, y_mm: end.y_mm },
        }
      })
      .filter((wall): wall is WallSegmentResolved => wall !== null)
  }

  return vertices.map((start, index) => {
    const end = vertices[(index + 1) % vertices.length]
    return {
      id: `wall-${index}`,
      start: { x_mm: start.x_mm, y_mm: start.y_mm },
      end: { x_mm: end.x_mm, y_mm: end.y_mm },
    }
  })
}

function toCameraDirection(yawRad: number, pitchRad: number): THREE.Vector3 {
  const cosPitch = Math.cos(pitchRad)
  return new THREE.Vector3(
    Math.cos(yawRad) * cosPitch,
    Math.sin(pitchRad),
    Math.sin(yawRad) * cosPitch,
  )
}

function angleDelta(a: number, b: number): number {
  const raw = a - b
  return Math.atan2(Math.sin(raw), Math.cos(raw))
}

function applySunlight(
  ambient: THREE.AmbientLight,
  directional: THREE.DirectionalLight,
  sunlight: SunlightPreview | null | undefined,
) {
  if (!sunlight || !sunlight.daylight_enabled) {
    ambient.intensity = 0.58
    directional.intensity = 0.22
    directional.position.set(3, 6, 3)
    return
  }

  const intensity = Math.max(0, Math.min(1, sunlight.intensity))
  ambient.intensity = 0.3 + intensity * 0.4
  directional.intensity = 0.25 + intensity * 1.05

  const y = Math.max(0.25, sunlight.sun_direction.y + 0.35)
  directional.position.set(
    sunlight.sun_direction.x * 8,
    y * 8,
    sunlight.sun_direction.z * 8,
  )
}

function applyNavigationControls(controls: OrbitControls, settings: NavigationSettings) {
  controls.screenSpacePanning = true
  controls.enablePan = true
  controls.dampingFactor = settings.navigation_profile === 'presentation' ? 0.12 : 0.08
  controls.panSpeed = settings.navigation_profile === 'trackpad' ? 1.2 : 0.9
  controls.rotateSpeed = settings.invert_y_axis ? -0.8 : 0.8

  const zoomSign = settings.zoom_direction === 'inverted' ? -1 : 1
  controls.zoomSpeed = zoomSign * profileZoomFactor(settings.navigation_profile)

  controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE
  controls.mouseButtons.RIGHT = THREE.MOUSE.PAN
  controls.mouseButtons.MIDDLE = settings.middle_mouse_pan ? THREE.MOUSE.PAN : THREE.MOUSE.DOLLY

  if (settings.touchpad_mode === 'trackpad') {
    controls.touches.ONE = THREE.TOUCH.PAN
    controls.touches.TWO = THREE.TOUCH.DOLLY_ROTATE
  } else {
    controls.touches.ONE = THREE.TOUCH.ROTATE
    controls.touches.TWO = THREE.TOUCH.DOLLY_PAN
  }
}

export function Preview3D({ room, verticalConnections = [], cameraState = null, onCameraStateChange, sunlight = null, navigationSettings }: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  const controlsRef = useRef<OrbitControls | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const groupRef = useRef<THREE.Group | null>(null)
  const ambientLightRef = useRef<THREE.AmbientLight | null>(null)
  const directionalLightRef = useRef<THREE.DirectionalLight | null>(null)
  const cameraStateRef = useRef<Props['cameraState']>(cameraState)
  const onCameraStateChangeRef = useRef<Props['onCameraStateChange']>(onCameraStateChange)
  const lastEmittedRef = useRef<{
    x_mm: number
    y_mm: number
    yaw_rad: number
    pitch_rad: number
    camera_height_mm: number
  } | null>(null)
  const [showReference, setShowReference] = useState(true)

  cameraStateRef.current = cameraState
  onCameraStateChangeRef.current = onCameraStateChange

  const geometryInput = useMemo(() => {
    if (!room) {
      return null
    }

    const boundary = room.boundary as { vertices?: unknown[]; wall_segments?: unknown[] }
    const vertices = (boundary.vertices ?? []) as VertexLike[]
    const walls = (boundary.wall_segments ?? []) as WallLike[]
    const openings = (room.openings ?? []) as OpeningLike[]
    const placements = (room.placements ?? []) as PlacementLike[]

    if (vertices.length < 3) {
      return null
    }

    const surfaceColors = extractSurfaceColors(room)

    return {
      vertices,
      walls: resolveWalls(vertices, walls),
      openings,
      placements,
      verticalConnections,
      ceilingHeightMm: room.ceiling_height_mm,
      surfaceColors,
      wallColor: chooseWallColor(surfaceColors),
    }
  }, [room, verticalConnections])

  useEffect(() => {
    const mount = rootRef.current
    if (!mount || !geometryInput) {
      return
    }

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x0f172a)

    const camera = new THREE.PerspectiveCamera(55, mount.clientWidth / Math.max(1, mount.clientHeight), 0.1, 200)
    camera.position.set(3.5, 2.8, 3.5)

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(mount.clientWidth, Math.max(1, mount.clientHeight))
    mount.appendChild(renderer.domElement)

    const controls = new OrbitControls(camera, renderer.domElement)
    controlsRef.current = controls
    cameraRef.current = camera
    controls.enableDamping = true
    applyNavigationControls(controls, navigationSettings)
    controls.target.set(0, 0.7, 0)

    const ambient = new THREE.AmbientLight(0xffffff, 0.6)
    ambientLightRef.current = ambient
    scene.add(ambient)
    const directional = new THREE.DirectionalLight(0xffffff, 1)
    directionalLightRef.current = directional
    directional.position.set(3, 6, 3)
    scene.add(directional)
    applySunlight(ambient, directional, sunlight)

    const group = new THREE.Group()
    groupRef.current = group
    scene.add(group)

    const grid = new THREE.GridHelper(20, 40, 0x334155, 0x1e293b)
    grid.position.y = -0.001
    group.add(grid)

    const floorShape = new THREE.Shape(
      geometryInput.vertices.map((vertex) => new THREE.Vector2(vertex.x_mm * MM_TO_M, vertex.y_mm * MM_TO_M)),
    )
    const floorGeometry = new THREE.ShapeGeometry(floorShape)
    const floorMaterial = new THREE.MeshStandardMaterial({
      color: hexColorToThreeColor(geometryInput.surfaceColors.floor, 0x334155),
      side: THREE.DoubleSide,
    })
    const floorMesh = new THREE.Mesh(floorGeometry, floorMaterial)
    floorMesh.rotation.x = -Math.PI / 2
    group.add(floorMesh)

    const center = new THREE.Box3().setFromObject(floorMesh).getCenter(new THREE.Vector3())
    group.position.set(-center.x, 0, -center.z)

    const applyExternalCameraState = (state: NonNullable<Props['cameraState']>) => {
      const direction = toCameraDirection(state.yaw_rad, state.pitch_rad)
      const position = new THREE.Vector3(
        state.x_mm * MM_TO_M + group.position.x,
        state.camera_height_mm * MM_TO_M,
        state.y_mm * MM_TO_M + group.position.z,
      )
      camera.position.copy(position)
      controls.target.copy(position.clone().add(direction.multiplyScalar(1.2)))
      controls.update()
    }

    if (cameraStateRef.current) {
      applyExternalCameraState(cameraStateRef.current)
    }

    const wallById = new Map<string, WallSegmentResolved>()

    for (const wall of geometryInput.walls) {
      wallById.set(wall.id, wall)
      const dx = wall.end.x_mm - wall.start.x_mm
      const dy = wall.end.y_mm - wall.start.y_mm
      const lengthMm = Math.hypot(dx, dy)
      if (lengthMm <= 0) continue

      const lengthM = lengthMm * MM_TO_M
      const wallHeightM = geometryInput.ceilingHeightMm * MM_TO_M
      const wallThicknessM = WALL_THICKNESS_MM * MM_TO_M

      const wallGeometry = new THREE.BoxGeometry(lengthM, wallHeightM, wallThicknessM)
      const wallMaterial = new THREE.MeshStandardMaterial({
        color: hexColorToThreeColor(geometryInput.wallColor, 0x64748b),
      })
      const wallMesh = new THREE.Mesh(wallGeometry, wallMaterial)

      const angle = Math.atan2(dy, dx)
      wallMesh.rotation.y = -angle
      wallMesh.position.set(
        ((wall.start.x_mm + wall.end.x_mm) * 0.5) * MM_TO_M,
        wallHeightM * 0.5,
        ((wall.start.y_mm + wall.end.y_mm) * 0.5) * MM_TO_M,
      )

      group.add(wallMesh)

      if (showReference) {
        const lineGeom = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(wall.start.x_mm * MM_TO_M, 0.002, wall.start.y_mm * MM_TO_M),
          new THREE.Vector3(wall.end.x_mm * MM_TO_M, 0.002, wall.end.y_mm * MM_TO_M),
        ])
        const line = new THREE.Line(lineGeom, new THREE.LineBasicMaterial({ color: 0x38bdf8 }))
        group.add(line)
      }
    }

    for (const opening of geometryInput.openings) {
      const wall = wallById.get(opening.wall_id)
      if (!wall) continue

      const dx = wall.end.x_mm - wall.start.x_mm
      const dy = wall.end.y_mm - wall.start.y_mm
      const wallLength = Math.hypot(dx, dy)
      if (wallLength <= 0) continue

      const ux = dx / wallLength
      const uy = dy / wallLength
      const cx = wall.start.x_mm + ux * (opening.offset_mm + opening.width_mm * 0.5)
      const cy = wall.start.y_mm + uy * (opening.offset_mm + opening.width_mm * 0.5)

      const openingMesh = new THREE.Mesh(
        new THREE.BoxGeometry(opening.width_mm * MM_TO_M, 2.0, 0.06),
        new THREE.MeshStandardMaterial({ color: 0x0ea5e9 }),
      )
      openingMesh.position.set(cx * MM_TO_M, 1.0, cy * MM_TO_M)
      openingMesh.rotation.y = -Math.atan2(dy, dx)
      openingMesh.visible = showReference
      group.add(openingMesh)
    }

    for (const connection of geometryInput.verticalConnections) {
      const bbox = resolveVerticalConnectionBbox(connection)
      if (!bbox) continue

      const centerX = ((bbox.min_x_mm + bbox.max_x_mm) * 0.5) * MM_TO_M
      const centerY = ((bbox.min_y_mm + bbox.max_y_mm) * 0.5) * MM_TO_M
      const width = Math.max(0.12, bbox.width_mm * MM_TO_M)
      const depth = Math.max(0.12, bbox.depth_mm * MM_TO_M)

      const openingMarker = new THREE.Mesh(
        new THREE.BoxGeometry(width, 0.06, depth),
        new THREE.MeshStandardMaterial({
          color: 0x0ea5e9,
          transparent: true,
          opacity: 0.28,
          roughness: 0.75,
        }),
      )
      openingMarker.position.set(centerX, 0.03, centerY)
      openingMarker.visible = showReference
      group.add(openingMarker)

      const stairMarker = new THREE.Mesh(
        new THREE.CylinderGeometry(0.045, 0.045, 0.7, 12),
        new THREE.MeshStandardMaterial({
          color: 0x38bdf8,
          transparent: true,
          opacity: 0.88,
        }),
      )
      stairMarker.position.set(centerX, 0.35, centerY)
      stairMarker.visible = showReference
      group.add(stairMarker)
    }

    for (const placement of geometryInput.placements) {
      const wall = wallById.get(placement.wall_id)
      if (!wall) continue

      const dx = wall.end.x_mm - wall.start.x_mm
      const dy = wall.end.y_mm - wall.start.y_mm
      const wallLength = Math.hypot(dx, dy)
      if (wallLength <= 0) continue

      const ux = dx / wallLength
      const uy = dy / wallLength
      const nx = uy
      const ny = -ux

      const centerOffset = placement.offset_mm + placement.width_mm * 0.5
      const px = wall.start.x_mm + ux * centerOffset + nx * (placement.depth_mm * 0.5)
      const py = wall.start.y_mm + uy * centerOffset + ny * (placement.depth_mm * 0.5)
      const placementColor = hexColorToThreeColor(placement.material_assignment?.color_hex, 0xf59e0b)
      const placementRoughness = clampUnitOrFallback(placement.material_assignment?.roughness, 1)
      const placementMetalness = clampUnitOrFallback(placement.material_assignment?.metallic, 0)

      const furnitureMesh = new THREE.Mesh(
        new THREE.BoxGeometry(
          Math.max(0.2, placement.width_mm * MM_TO_M),
          Math.max(0.2, placement.height_mm * MM_TO_M),
          Math.max(0.2, placement.depth_mm * MM_TO_M),
        ),
        new THREE.MeshStandardMaterial({
          color: placementColor,
          roughness: placementRoughness,
          metalness: placementMetalness,
        }),
      )
      furnitureMesh.position.set(
        px * MM_TO_M,
        Math.max(0.2, placement.height_mm * MM_TO_M) * 0.5,
        py * MM_TO_M,
      )
      furnitureMesh.rotation.y = -Math.atan2(dy, dx)
      group.add(furnitureMesh)
    }

    let disposed = false
    let lastEmitTs = 0

    const emitCameraStateIfChanged = () => {
      if (!onCameraStateChangeRef.current) {
        return
      }

      const now = performance.now()
      if (now - lastEmitTs < 80) {
        return
      }

      const direction = controls.target.clone().sub(camera.position)
      if (direction.lengthSq() < 1e-8) {
        return
      }
      direction.normalize()

      const next = {
        x_mm: Math.round((camera.position.x - group.position.x) / MM_TO_M),
        y_mm: Math.round((camera.position.z - group.position.z) / MM_TO_M),
        yaw_rad: Math.atan2(direction.z, direction.x),
        pitch_rad: Math.asin(Math.max(-1, Math.min(1, direction.y))),
        camera_height_mm: Math.round(camera.position.y / MM_TO_M),
      }

      const prev = lastEmittedRef.current
      if (prev) {
        const same =
          Math.abs(prev.x_mm - next.x_mm) < 6 &&
          Math.abs(prev.y_mm - next.y_mm) < 6 &&
          Math.abs(prev.camera_height_mm - next.camera_height_mm) < 6 &&
          Math.abs(angleDelta(prev.yaw_rad, next.yaw_rad)) < 0.01 &&
          Math.abs(angleDelta(prev.pitch_rad, next.pitch_rad)) < 0.01
        if (same) {
          return
        }
      }

      lastEmitTs = now
      lastEmittedRef.current = next
      onCameraStateChangeRef.current(next)
    }
    const onResize = () => {
      if (disposed) return
      const width = Math.max(1, mount.clientWidth)
      const height = Math.max(1, mount.clientHeight)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.setSize(width, height)
    }

    const resizeObserver = new ResizeObserver(onResize)
    resizeObserver.observe(mount)

    const animate = () => {
      if (disposed) return
      controls.update()
      emitCameraStateIfChanged()
      renderer.render(scene, camera)
      requestAnimationFrame(animate)
    }
    animate()

    return () => {
      disposed = true
      resizeObserver.disconnect()
      controls.dispose()
      if (controlsRef.current === controls) controlsRef.current = null
      if (cameraRef.current === camera) cameraRef.current = null
      if (groupRef.current === group) groupRef.current = null
      if (ambientLightRef.current === ambient) ambientLightRef.current = null
      if (directionalLightRef.current === directional) directionalLightRef.current = null
      renderer.dispose()
      mount.removeChild(renderer.domElement)
    }
  }, [geometryInput, navigationSettings, showReference])

  useEffect(() => {
    const next = cameraState
    const camera = cameraRef.current
    const controls = controlsRef.current
    const group = groupRef.current
    if (!next || !camera || !controls || !group) {
      return
    }

    const direction = toCameraDirection(next.yaw_rad, next.pitch_rad)
    const position = new THREE.Vector3(
      next.x_mm * MM_TO_M + group.position.x,
      next.camera_height_mm * MM_TO_M,
      next.y_mm * MM_TO_M + group.position.z,
    )

    camera.position.copy(position)
    controls.target.copy(position.clone().add(direction.multiplyScalar(1.2)))
    controls.update()
  }, [cameraState])

  useEffect(() => {
    const ambient = ambientLightRef.current
    const directional = directionalLightRef.current
    if (!ambient || !directional) return
    applySunlight(ambient, directional, sunlight)
  }, [sunlight])

  useEffect(() => {
    const controls = controlsRef.current
    if (!controls) {
      return
    }

    applyNavigationControls(controls, navigationSettings)
    controls.update()
  }, [navigationSettings])

  if (!geometryInput) {
    return (
      <div className={styles.wrap}>
        <div className={styles.toolbar}>
          <span className={styles.meta}>3D-Preview</span>
        </div>
        <div className={styles.empty}>Kein geschlossener Raum für 3D-Preview verfügbar.</div>
      </div>
    )
  }

  return (
    <section className={styles.wrap}>
      <header className={styles.toolbar}>
        <span className={styles.meta}>
          3D-Preview · Orbit/Zoom/Pan
        </span>
        <button
          type="button"
          className={styles.toggle}
          onClick={() => setShowReference((prev) => !prev)}
        >
          Referenz {showReference ? 'ausblenden' : 'einblenden'}
        </button>
      </header>
      <div ref={rootRef} className={styles.canvas} />
    </section>
  )
}
