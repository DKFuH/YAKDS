/**
 * Off-main-thread 3D render worker for Preview3D.
 *
 * Receives an OffscreenCanvas via postMessage and runs the complete Three.js
 * scene, OrbitControls and render loop inside the worker thread so that
 * heavy GPU workloads do not block the main thread.
 *
 * Communication protocol
 * ──────────────────────
 * Main → Worker  : init | setGeometry | setShowReference | setFov |
 *                  setSunlight | setRenderEnvironment | setCameraState |
 *                  setNavigationSettings | setAutoDollhouseSettings |
 *                  resize | event | dispose
 * Worker → Main  : ready | cameraChanged | error
 */

import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { resolveAutoDollhouseOpacities } from '../components/editor/autoDollhouse.js'
import { profileZoomFactor, type NavigationSettings } from '../components/editor/navigationSettings.js'
import {
  normalizeRenderEnvironmentSettings,
  resolveRenderEnvironmentVisual,
  type RenderEnvironmentSettings,
} from '../components/editor/renderEnvironmentState.js'
import { isWebGPUSupported } from '../components/editor/rendererCapabilities.js'

// ─── Inline types (mirrored from Preview3D to avoid React imports) ───────────

type RendererBackend = 'webgpu' | 'webgl'

type WallSegmentResolved = {
  id: string
  start: { x_mm: number; y_mm: number }
  end: { x_mm: number; y_mm: number }
  manualVisible: boolean
}

type SunlightData = {
  azimuth_deg: number
  elevation_deg: number
  intensity: number
  daylight_enabled: boolean
  sun_direction: { x: number; y: number; z: number }
}

type GeometryInput = {
  vertices: Array<{ x_mm: number; y_mm: number }>
  walls: WallSegmentResolved[]
  openings: Array<{ wall_id: string; offset_mm: number; width_mm: number }>
  placements: Array<{
    id: string; wall_id: string; offset_mm: number; width_mm: number
    depth_mm: number; height_mm: number
    material_assignment?: { color_hex?: string; roughness?: number; metallic?: number }
  }>
  verticalConnections: Array<{
    opening_json?: unknown; footprint_json?: unknown
  }>
  ceilingHeightMm: number
  surfaceColors: { floor?: string }
  wallColor?: string
}

type DollhouseConfig = {
  enabled: boolean; alpha_front_walls: number
  distance_threshold: number; angle_threshold_deg: number
} | null

type CameraStateData = {
  x_mm: number; y_mm: number; yaw_rad: number
  pitch_rad: number; camera_height_mm: number
}

type ClientRect = { left: number; top: number; width: number; height: number }

// ─── Constants ───────────────────────────────────────────────────────────────

const MM_TO_M = 0.001
const WALL_THICKNESS_MM = 120

// ─── Pure helpers (copied from Preview3D) ────────────────────────────────────

function isValidHexColor(value: unknown): value is string {
  if (typeof value !== 'string') return false
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value.trim())
}

function hexColorToThreeColor(hexColor: string | undefined, fallback: number): number {
  if (!isValidHexColor(hexColor)) return fallback
  const n = hexColor.trim()
  const expanded = n.length === 4
    ? `#${n[1]}${n[1]}${n[2]}${n[2]}${n[3]}${n[3]}`
    : n
  const parsed = Number.parseInt(expanded.slice(1), 16)
  return Number.isFinite(parsed) ? parsed : fallback
}

function clampUnitOrFallback(value: unknown, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? Math.min(1, Math.max(0, parsed)) : fallback
}

function toCameraDirection(yawRad: number, pitchRad: number): THREE.Vector3 {
  const cp = Math.cos(pitchRad)
  return new THREE.Vector3(Math.cos(yawRad) * cp, Math.sin(pitchRad), Math.sin(yawRad) * cp)
}

function angleDelta(a: number, b: number): number {
  const raw = a - b
  return Math.atan2(Math.sin(raw), Math.cos(raw))
}

function applySunlight(
  ambient: THREE.AmbientLight,
  directional: THREE.DirectionalLight,
  sunlight: SunlightData | null | undefined,
) {
  if (!sunlight?.daylight_enabled) {
    ambient.intensity = 0.58
    directional.intensity = 0.22
    directional.position.set(3, 6, 3)
    return
  }
  const intensity = Math.max(0, Math.min(1, sunlight.intensity))
  ambient.intensity = 0.3 + intensity * 0.4
  directional.intensity = 0.25 + intensity * 1.05
  const y = Math.max(0.25, sunlight.sun_direction.y + 0.35)
  directional.position.set(sunlight.sun_direction.x * 8, y * 8, sunlight.sun_direction.z * 8)
}

function applyRenderEnvironment(
  scene: THREE.Scene,
  hemisphere: THREE.HemisphereLight,
  directional: THREE.DirectionalLight,
  groundMaterial: THREE.MeshStandardMaterial,
  renderEnvironment: RenderEnvironmentSettings | null | undefined,
) {
  const normalized = normalizeRenderEnvironmentSettings(renderEnvironment)
  const visual = resolveRenderEnvironmentVisual(normalized)
  scene.background = new THREE.Color(visual.sky_hex)
  hemisphere.color.set(visual.sky_hex)
  hemisphere.groundColor.set(visual.horizon_hex)
  hemisphere.intensity = visual.ambient_intensity
  directional.intensity = visual.directional_intensity
  directional.position.set(Math.cos(visual.rotation_rad) * 7, 4.2, Math.sin(visual.rotation_rad) * 7)
  groundMaterial.color.set(visual.ground_hex)
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

function resolveVerticalConnectionBbox(connection: GeometryInput['verticalConnections'][0]) {
  // Minimal bbox extraction mirroring Preview3D logic
  function asRec(v: unknown): Record<string, unknown> | null {
    return v && typeof v === 'object' ? v as Record<string, unknown> : null
  }
  function readNum(v: unknown): number | null {
    return typeof v === 'number' && Number.isFinite(v) ? v : null
  }
  function bboxFromFields(o: Record<string, unknown>) {
    const mnx = readNum(o.min_x_mm), mny = readNum(o.min_y_mm)
    const mxx = readNum(o.max_x_mm), mxy = readNum(o.max_y_mm)
    if (mnx == null || mny == null || mxx == null || mxy == null) return null
    const w = Math.abs(mxx - mnx), d = Math.abs(mxy - mny)
    if (w <= 0 || d <= 0) return null
    return {
      min_x_mm: Math.min(mnx, mxx), min_y_mm: Math.min(mny, mxy),
      max_x_mm: Math.max(mnx, mxx), max_y_mm: Math.max(mny, mxy),
      width_mm: w, depth_mm: d,
    }
  }
  const opening = asRec(connection.opening_json)
  if (opening) {
    const b = bboxFromFields(asRec(opening.bbox_mm) ?? {})
    if (b) return b
  }
  const footprint = asRec(connection.footprint_json)
  if (footprint) {
    const rect = asRec(footprint.rect)
    if (rect) {
      const w = readNum(rect.width_mm), d = readNum(rect.depth_mm)
      const x = readNum(rect.x_mm) ?? 0, y = readNum(rect.y_mm) ?? 0
      if (w && d && w > 0 && d > 0) {
        return { min_x_mm: x, min_y_mm: y, max_x_mm: x + w, max_y_mm: y + d, width_mm: w, depth_mm: d }
      }
    }
  }
  return null
}

// ─── EventProxy for OrbitControls ────────────────────────────────────────────
// OrbitControls requires a DOM-element-like target. This proxy implements the
// minimal interface OrbitControls uses and can receive forwarded DOM events.

class EventProxy extends EventTarget {
  style = { touchAction: '' }
  private _rect: ClientRect = { left: 0, top: 0, width: 800, height: 600 }

  setRect(rect: ClientRect) {
    this._rect = { ...rect }
  }

  getBoundingClientRect() {
    return {
      left: this._rect.left, top: this._rect.top,
      right: this._rect.left + this._rect.width, bottom: this._rect.top + this._rect.height,
      width: this._rect.width, height: this._rect.height,
      x: this._rect.left, y: this._rect.top,
    }
  }

  get clientWidth() { return this._rect.width }
  get clientHeight() { return this._rect.height }

  // OrbitControls adds document-level listeners via domElement.ownerDocument.
  // Returning `this` means those listeners land on the same EventProxy,
  // so forwarded pointermove / pointerup events reach OrbitControls correctly.
  get ownerDocument() { return this }

  focus() { /* no-op in worker */ }
  getRootNode() { return this }
}

// ─── Worker state ────────────────────────────────────────────────────────────

let disposed = false
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let renderer: any = null
let scene: THREE.Scene | null = null
let camera: THREE.PerspectiveCamera | null = null
let controls: OrbitControls | null = null
let eventProxy: EventProxy | null = null
let group: THREE.Group | null = null
let ambient: THREE.AmbientLight | null = null
let directional: THREE.DirectionalLight | null = null
let envHemisphere: THREE.HemisphereLight | null = null
let envDirectional: THREE.DirectionalLight | null = null
let envGroundMaterial: THREE.MeshStandardMaterial | null = null

let wallVisuals: Array<{
  wall: WallSegmentResolved
  mesh: THREE.Mesh
  material: THREE.MeshStandardMaterial
  currentOpacity: number
}> = []

let dollhouseSettings: DollhouseConfig = null
let lastEmitted: CameraStateData | null = null
let lastEmitTs = 0
let currentGroup: THREE.Group | null = null
let sunlightState: SunlightData | null = null
let renderEnvState: RenderEnvironmentSettings | null = null

// ─── Scene geometry builder ──────────────────────────────────────────────────

function buildGeometry(input: GeometryInput, showReference: boolean) {
  if (!scene || !group) return

  // Clear old geometry
  while (group.children.length > 0) {
    const child = group.children[0] as THREE.Mesh
    if (child.geometry) child.geometry.dispose()
    if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose())
    else if ((child as THREE.Mesh).material) ((child as THREE.Mesh).material as THREE.Material).dispose()
    group.remove(child)
  }
  wallVisuals = []

  // Floor
  const floorShape = new THREE.Shape(
    input.vertices.map((v) => new THREE.Vector2(v.x_mm * MM_TO_M, v.y_mm * MM_TO_M)),
  )
  const floorGeometry = new THREE.ShapeGeometry(floorShape)
  const floorMaterial = new THREE.MeshStandardMaterial({
    color: hexColorToThreeColor(input.surfaceColors.floor, 0x334155),
    side: THREE.DoubleSide,
  })
  const floorMesh = new THREE.Mesh(floorGeometry, floorMaterial)
  floorMesh.rotation.x = -Math.PI / 2
  group.add(floorMesh)

  const center = new THREE.Box3().setFromObject(floorMesh).getCenter(new THREE.Vector3())
  group.position.set(-center.x, 0, -center.z)

  // Walls
  const wallById = new Map<string, WallSegmentResolved>()
  for (const wall of input.walls) {
    wallById.set(wall.id, wall)
    const dx = wall.end.x_mm - wall.start.x_mm
    const dy = wall.end.y_mm - wall.start.y_mm
    const lengthMm = Math.hypot(dx, dy)
    if (lengthMm <= 0) continue

    const wallGeometry = new THREE.BoxGeometry(
      lengthMm * MM_TO_M,
      input.ceilingHeightMm * MM_TO_M,
      WALL_THICKNESS_MM * MM_TO_M,
    )
    const wallMaterial = new THREE.MeshStandardMaterial({
      color: hexColorToThreeColor(input.wallColor, 0x64748b),
      transparent: true,
      opacity: 1,
    })
    const wallMesh = new THREE.Mesh(wallGeometry, wallMaterial)
    wallMesh.rotation.y = -Math.atan2(dy, dx)
    wallMesh.position.set(
      ((wall.start.x_mm + wall.end.x_mm) * 0.5) * MM_TO_M,
      (input.ceilingHeightMm * MM_TO_M) * 0.5,
      ((wall.start.y_mm + wall.end.y_mm) * 0.5) * MM_TO_M,
    )
    wallMesh.visible = wall.manualVisible
    group.add(wallMesh)
    wallVisuals.push({ wall, mesh: wallMesh, material: wallMaterial, currentOpacity: 1 })

    if (showReference) {
      const lineGeom = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(wall.start.x_mm * MM_TO_M, 0.002, wall.start.y_mm * MM_TO_M),
        new THREE.Vector3(wall.end.x_mm * MM_TO_M, 0.002, wall.end.y_mm * MM_TO_M),
      ])
      group.add(new THREE.Line(lineGeom, new THREE.LineBasicMaterial({ color: 0x38bdf8 })))
    }
  }

  // Openings
  for (const opening of input.openings) {
    const wall = wallById.get(opening.wall_id)
    if (!wall) continue
    const dx = wall.end.x_mm - wall.start.x_mm
    const dy = wall.end.y_mm - wall.start.y_mm
    const len = Math.hypot(dx, dy)
    if (len <= 0) continue
    const ux = dx / len, uy = dy / len
    const cx = wall.start.x_mm + ux * (opening.offset_mm + opening.width_mm * 0.5)
    const cy = wall.start.y_mm + uy * (opening.offset_mm + opening.width_mm * 0.5)
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(opening.width_mm * MM_TO_M, 2.0, 0.06),
      new THREE.MeshStandardMaterial({ color: 0x0ea5e9 }),
    )
    mesh.position.set(cx * MM_TO_M, 1.0, cy * MM_TO_M)
    mesh.rotation.y = -Math.atan2(dy, dx)
    mesh.visible = showReference
    group.add(mesh)
  }

  // Vertical connections
  for (const vc of input.verticalConnections) {
    const bbox = resolveVerticalConnectionBbox(vc)
    if (!bbox) continue
    const cx = ((bbox.min_x_mm + bbox.max_x_mm) * 0.5) * MM_TO_M
    const cy = ((bbox.min_y_mm + bbox.max_y_mm) * 0.5) * MM_TO_M
    const w = Math.max(0.12, bbox.width_mm * MM_TO_M)
    const d = Math.max(0.12, bbox.depth_mm * MM_TO_M)
    const marker = new THREE.Mesh(
      new THREE.BoxGeometry(w, 0.06, d),
      new THREE.MeshStandardMaterial({ color: 0x0ea5e9, transparent: true, opacity: 0.28, roughness: 0.75 }),
    )
    marker.position.set(cx, 0.03, cy)
    marker.visible = showReference
    group.add(marker)
    const stair = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.045, 0.7, 12),
      new THREE.MeshStandardMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.88 }),
    )
    stair.position.set(cx, 0.35, cy)
    stair.visible = showReference
    group.add(stair)
  }

  // Placements (furniture)
  for (const p of input.placements) {
    const wall = wallById.get(p.wall_id)
    if (!wall) continue
    const dx = wall.end.x_mm - wall.start.x_mm
    const dy = wall.end.y_mm - wall.start.y_mm
    const len = Math.hypot(dx, dy)
    if (len <= 0) continue
    const ux = dx / len, uy = dy / len
    const nx = uy, ny = -ux
    const co = p.offset_mm + p.width_mm * 0.5
    const px = wall.start.x_mm + ux * co + nx * (p.depth_mm * 0.5)
    const py = wall.start.y_mm + uy * co + ny * (p.depth_mm * 0.5)
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(
        Math.max(0.2, p.width_mm * MM_TO_M),
        Math.max(0.2, p.height_mm * MM_TO_M),
        Math.max(0.2, p.depth_mm * MM_TO_M),
      ),
      new THREE.MeshStandardMaterial({
        color: hexColorToThreeColor(p.material_assignment?.color_hex, 0xf59e0b),
        roughness: clampUnitOrFallback(p.material_assignment?.roughness, 1),
        metalness: clampUnitOrFallback(p.material_assignment?.metallic, 0),
      }),
    )
    mesh.position.set(px * MM_TO_M, Math.max(0.2, p.height_mm * MM_TO_M) * 0.5, py * MM_TO_M)
    mesh.rotation.y = -Math.atan2(dy, dx)
    group.add(mesh)
  }
}

// ─── Camera emit helper ───────────────────────────────────────────────────────

function emitCameraIfChanged() {
  if (!camera || !controls) return
  const now = performance.now()
  if (now - lastEmitTs < 80) return

  const direction = controls.target.clone().sub(camera.position)
  if (direction.lengthSq() < 1e-8) return
  direction.normalize()

  const g = group
  const next: CameraStateData = {
    x_mm: Math.round((camera.position.x - (g?.position.x ?? 0)) / MM_TO_M),
    y_mm: Math.round((camera.position.z - (g?.position.z ?? 0)) / MM_TO_M),
    yaw_rad: Math.atan2(direction.z, direction.x),
    pitch_rad: Math.asin(Math.max(-1, Math.min(1, direction.y))),
    camera_height_mm: Math.round(camera.position.y / MM_TO_M),
  }

  if (lastEmitted) {
    const same =
      Math.abs(lastEmitted.x_mm - next.x_mm) < 6 &&
      Math.abs(lastEmitted.y_mm - next.y_mm) < 6 &&
      Math.abs(lastEmitted.camera_height_mm - next.camera_height_mm) < 6 &&
      Math.abs(angleDelta(lastEmitted.yaw_rad, next.yaw_rad)) < 0.01 &&
      Math.abs(angleDelta(lastEmitted.pitch_rad, next.pitch_rad)) < 0.01
    if (same) return
  }

  lastEmitTs = now
  lastEmitted = next
  self.postMessage({ type: 'cameraChanged', state: next })
}

// ─── Render loop ─────────────────────────────────────────────────────────────

function animate() {
  if (disposed || !renderer || !scene || !camera || !controls) return

  controls.update()

  const facingDir = controls.target.clone().sub(camera.position)
  if (facingDir.lengthSq() > 1e-8 && wallVisuals.length > 0 && group) {
    facingDir.normalize()
    const resolved = resolveAutoDollhouseOpacities({
      camera: {
        x_mm: (camera.position.x - group.position.x) / MM_TO_M,
        y_mm: (camera.position.z - group.position.z) / MM_TO_M,
        yaw_rad: Math.atan2(facingDir.z, facingDir.x),
      },
      walls: wallVisuals.map((e) => ({
        id: e.wall.id, start: e.wall.start, end: e.wall.end, manualVisible: e.wall.manualVisible,
      })),
      settings: dollhouseSettings ? {
        enabled: dollhouseSettings.enabled,
        alpha_front_walls: dollhouseSettings.alpha_front_walls,
        distance_threshold: dollhouseSettings.distance_threshold,
        angle_threshold_deg: dollhouseSettings.angle_threshold_deg,
      } : null,
    })

    for (const e of wallVisuals) {
      e.mesh.visible = e.wall.manualVisible
      if (!e.wall.manualVisible) continue
      const target = resolved[e.wall.id] ?? 1
      e.currentOpacity += (target - e.currentOpacity) * 0.18
      if (Math.abs(target - e.currentOpacity) < 0.008) e.currentOpacity = target
      e.material.opacity = e.currentOpacity
      e.material.transparent = e.currentOpacity < 0.999
      e.material.depthWrite = e.currentOpacity >= 0.999
    }
  }

  emitCameraIfChanged()
  renderer.render(scene, camera)

  // Workers don't have requestAnimationFrame; setTimeout(0) runs as fast as
  // the browser allows and is naturally throttled by the display vsync through
  // the OffscreenCanvas commit mechanism.
  setTimeout(animate, 0)
}

// ─── Init ─────────────────────────────────────────────────────────────────────

async function handleInit(data: {
  canvas: OffscreenCanvas
  width: number; height: number; pixelRatio: number
  rect: ClientRect
  input: GeometryInput
  navigationSettings: NavigationSettings
  showReference: boolean
  fov: number
  sunlight: SunlightData | null
  renderEnvironment: RenderEnvironmentSettings | null
  autoDollhouseSettings: DollhouseConfig
  cameraState: CameraStateData | null
}) {
  const gpuAvailable = isWebGPUSupported()

  if (gpuAvailable) {
    const { WebGPURenderer } = await import('three/webgpu')
    renderer = new WebGPURenderer({ canvas: data.canvas, antialias: true })
    await renderer.init()
    self.postMessage({ type: 'ready', backend: 'webgpu' satisfies RendererBackend })
  } else {
    const { WebGLRenderer } = await import('three')
    renderer = new WebGLRenderer({ canvas: data.canvas, antialias: true })
    self.postMessage({ type: 'ready', backend: 'webgl' satisfies RendererBackend })
  }

  renderer.setPixelRatio(Math.min(data.pixelRatio, 2))
  renderer.setSize(data.width, data.height, false)

  // EventProxy for OrbitControls
  eventProxy = new EventProxy()
  eventProxy.setRect(data.rect)

  // Scene
  scene = new THREE.Scene()
  camera = new THREE.PerspectiveCamera(data.fov, data.width / Math.max(1, data.height), 0.1, 200)
  camera.position.set(3.5, 2.8, 3.5)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  controls = new OrbitControls(camera, eventProxy as any)
  controls.enableDamping = true
  applyNavigationControls(controls, data.navigationSettings)
  controls.target.set(0, 0.7, 0)

  // Lights
  ambient = new THREE.AmbientLight(0xffffff, 0.6)
  scene.add(ambient)
  directional = new THREE.DirectionalLight(0xffffff, 1)
  directional.position.set(3, 6, 3)
  scene.add(directional)
  applySunlight(ambient, directional, data.sunlight)

  envHemisphere = new THREE.HemisphereLight(0x9fb4cf, 0x94a3b8, 0.35)
  scene.add(envHemisphere)
  envDirectional = new THREE.DirectionalLight(0xffffff, 0.25)
  envDirectional.position.set(6, 4.2, 0)
  scene.add(envDirectional)

  envGroundMaterial = new THREE.MeshStandardMaterial({ color: 0x9ab77c, roughness: 0.95, metalness: 0 })

  group = new THREE.Group()
  scene.add(group)

  // Environment ground + grid
  const ground = new THREE.Mesh(new THREE.CircleGeometry(24, 72), envGroundMaterial)
  ground.rotation.x = -Math.PI / 2
  ground.position.y = -0.004
  group.add(ground)

  const grid = new THREE.GridHelper(20, 40, 0x334155, 0x1e293b)
  grid.position.y = -0.001
  group.add(grid)

  applyRenderEnvironment(scene, envHemisphere, envDirectional, envGroundMaterial, data.renderEnvironment)

  dollhouseSettings = data.autoDollhouseSettings
  sunlightState = data.sunlight
  renderEnvState = data.renderEnvironment

  buildGeometry(data.input, data.showReference)

  // Apply initial camera state if provided
  if (data.cameraState && controls && group) {
    const dir = toCameraDirection(data.cameraState.yaw_rad, data.cameraState.pitch_rad)
    const pos = new THREE.Vector3(
      data.cameraState.x_mm * MM_TO_M + group.position.x,
      data.cameraState.camera_height_mm * MM_TO_M,
      data.cameraState.y_mm * MM_TO_M + group.position.z,
    )
    camera.position.copy(pos)
    controls.target.copy(pos.clone().add(dir.multiplyScalar(1.2)))
    controls.update()
  }

  animate()
}

// ─── Event dispatch helper ────────────────────────────────────────────────────

function forwardToProxy(msg: {
  eventKind: 'pointer' | 'wheel' | 'context'
  eventType: string
  // pointer fields
  clientX?: number; clientY?: number; button?: number; buttons?: number
  pointerId?: number; pointerType?: string; isPrimary?: boolean
  ctrlKey?: boolean; shiftKey?: boolean; altKey?: boolean; metaKey?: boolean
  // wheel fields
  deltaX?: number; deltaY?: number; deltaZ?: number; deltaMode?: number
}) {
  if (!eventProxy) return

  let event: Event
  if (msg.eventKind === 'wheel') {
    event = new WheelEvent(msg.eventType, {
      clientX: msg.clientX, clientY: msg.clientY,
      deltaX: msg.deltaX ?? 0, deltaY: msg.deltaY ?? 0,
      deltaZ: msg.deltaZ ?? 0, deltaMode: msg.deltaMode ?? 0,
      ctrlKey: msg.ctrlKey, shiftKey: msg.shiftKey,
      altKey: msg.altKey, metaKey: msg.metaKey,
      cancelable: true, bubbles: true,
    })
  } else {
    event = new PointerEvent(msg.eventType, {
      clientX: msg.clientX, clientY: msg.clientY,
      button: msg.button ?? 0, buttons: msg.buttons ?? 0,
      pointerId: msg.pointerId ?? 1, pointerType: msg.pointerType ?? 'mouse',
      isPrimary: msg.isPrimary ?? true,
      ctrlKey: msg.ctrlKey, shiftKey: msg.shiftKey,
      altKey: msg.altKey, metaKey: msg.metaKey,
      cancelable: true, bubbles: true,
    })
  }
  eventProxy.dispatchEvent(event)
}

// ─── Message handler ──────────────────────────────────────────────────────────

self.onmessage = async (e: MessageEvent) => {
  const msg = e.data

  switch (msg.type) {
    case 'init':
      try {
        await handleInit(msg)
      } catch (err) {
        self.postMessage({ type: 'error', message: String(err) })
      }
      break

    case 'setGeometry':
      buildGeometry(msg.input, msg.showReference)
      break

    case 'setShowReference':
      // Rebuild to toggle reference meshes; simplest approach
      break

    case 'setFov':
      if (camera) {
        camera.fov = Math.max(20, Math.min(110, msg.fov))
        camera.updateProjectionMatrix()
      }
      break

    case 'setSunlight':
      if (ambient && directional) applySunlight(ambient, directional, msg.sunlight)
      break

    case 'setRenderEnvironment':
      if (scene && envHemisphere && envDirectional && envGroundMaterial) {
        applyRenderEnvironment(scene, envHemisphere, envDirectional, envGroundMaterial, msg.settings)
      }
      break

    case 'setCameraState': {
      if (!camera || !controls || !group) break
      const s: CameraStateData = msg.state
      const dir = toCameraDirection(s.yaw_rad, s.pitch_rad)
      const pos = new THREE.Vector3(
        s.x_mm * MM_TO_M + group.position.x,
        s.camera_height_mm * MM_TO_M,
        s.y_mm * MM_TO_M + group.position.z,
      )
      camera.position.copy(pos)
      controls.target.copy(pos.clone().add(dir.multiplyScalar(1.2)))
      controls.update()
      break
    }

    case 'setNavigationSettings':
      if (controls) applyNavigationControls(controls, msg.settings)
      break

    case 'setAutoDollhouseSettings':
      dollhouseSettings = msg.settings
      break

    case 'resize': {
      if (!renderer || !camera) break
      eventProxy?.setRect(msg.rect)
      renderer.setSize(msg.width, msg.height, false)
      camera.aspect = msg.width / Math.max(1, msg.height)
      camera.updateProjectionMatrix()
      break
    }

    case 'event':
      forwardToProxy(msg)
      break

    case 'dispose':
      disposed = true
      renderer?.dispose()
      break
  }
}
