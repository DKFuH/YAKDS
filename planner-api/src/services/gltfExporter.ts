import * as THREE from 'three'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'
import { tessellateArcWall } from './arcWallMesher.js'

function ensureNodeFileReader() {
  const globalScope = globalThis as unknown as { FileReader?: unknown }

  if (typeof globalScope.FileReader !== 'undefined') {
    return
  }

  class NodeFileReader {
    public result: string | ArrayBuffer | null = null
    public error: unknown = null
    public onloadend: ((ev: { target: NodeFileReader }) => unknown) | null = null
    public onerror: ((ev: { target: NodeFileReader }) => unknown) | null = null

    readAsArrayBuffer(blob: Blob) {
      blob.arrayBuffer()
        .then((buffer) => {
          this.result = buffer
          this.onloadend?.({ target: this })
        })
        .catch((error: unknown) => {
          this.error = error
          this.onerror?.({ target: this })
        })
    }

    readAsDataURL(blob: Blob) {
      blob.arrayBuffer()
        .then((buffer) => {
          const base64 = Buffer.from(buffer).toString('base64')
          this.result = `data:${blob.type || 'application/octet-stream'};base64,${base64}`
          this.onloadend?.({ target: this })
        })
        .catch((error: unknown) => {
          this.error = error
          this.onerror?.({ target: this })
        })
    }
  }

  globalScope.FileReader = NodeFileReader
}

export interface PlacedObject {
  id: string
  wall_id: string
  offset_mm: number
  width_mm: number
  depth_mm: number
  height_mm?: number
  label?: string
}

export interface WallSegment {
  id: string
  kind?: 'line' | 'arc'
  x0_mm?: number
  y0_mm?: number
  x1_mm?: number
  y1_mm?: number
  start?: { x_mm: number; y_mm: number }
  end?: { x_mm: number; y_mm: number }
  center?: { x_mm: number; y_mm: number }
  radius_mm?: number
  clockwise?: boolean
  thickness_mm?: number
}

export interface GltfExportInput {
  walls: WallSegment[]
  placements: PlacedObject[]
  room_height_mm?: number
}

const MM_TO_M = 0.001

export async function exportToGlb(input: GltfExportInput): Promise<Buffer> {
  ensureNodeFileReader()

  const scene = new THREE.Scene()
  const roomHeight = (input.room_height_mm ?? 2500) * MM_TO_M

  for (const wall of input.walls) {
    if (
      wall.kind === 'arc' &&
      wall.start &&
      wall.end &&
      wall.center &&
      typeof wall.radius_mm === 'number'
    ) {
      const meshed = tessellateArcWall({
        start: wall.start,
        end: wall.end,
        center: wall.center,
        radius_mm: wall.radius_mm,
        clockwise: Boolean(wall.clockwise),
        thickness_mm: wall.thickness_mm ?? 100,
      }, {
        wall_height_mm: input.room_height_mm ?? 2500,
      })

      const shape = new THREE.Shape(
        meshed.footprint.map((point, index) => new THREE.Vector2(point.x_mm * MM_TO_M, point.y_mm * MM_TO_M)),
      )

      const arcGeometry = new THREE.ExtrudeGeometry(shape, {
        depth: roomHeight,
        bevelEnabled: false,
      })
      arcGeometry.rotateX(Math.PI / 2)

      const arcMesh = new THREE.Mesh(arcGeometry, new THREE.MeshStandardMaterial({ color: 0xcccccc }))
      arcMesh.position.set(0, roomHeight, 0)
      arcMesh.name = `wall_${wall.id}`
      scene.add(arcMesh)
      continue
    }

    if (
      typeof wall.x0_mm !== 'number' ||
      typeof wall.y0_mm !== 'number' ||
      typeof wall.x1_mm !== 'number' ||
      typeof wall.y1_mm !== 'number'
    ) {
      continue
    }

    const dx = (wall.x1_mm - wall.x0_mm) * MM_TO_M
    const dy = (wall.y1_mm - wall.y0_mm) * MM_TO_M
    const length = Math.hypot(dx, dy)
    if (length < 0.001) continue

    const wallThickness = 0.1
    const geo = new THREE.BoxGeometry(length, roomHeight, wallThickness)
    const mat = new THREE.MeshStandardMaterial({ color: 0xcccccc })
    const mesh = new THREE.Mesh(geo, mat)

    const mx = ((wall.x0_mm + wall.x1_mm) / 2) * MM_TO_M
    const my = ((wall.y0_mm + wall.y1_mm) / 2) * MM_TO_M
    mesh.position.set(mx, roomHeight / 2, my)
    mesh.rotation.y = -Math.atan2(dy, dx)
    mesh.name = `wall_${wall.id}`
    scene.add(mesh)
  }

  for (const placement of input.placements) {
    const width = placement.width_mm * MM_TO_M
    const depth = placement.depth_mm * MM_TO_M
    const height = (placement.height_mm ?? 720) * MM_TO_M

    const geo = new THREE.BoxGeometry(width, height, depth)
    const mat = new THREE.MeshStandardMaterial({ color: 0x8b4513 })
    const mesh = new THREE.Mesh(geo, mat)

    mesh.position.set(placement.offset_mm * MM_TO_M + width / 2, height / 2, depth / 2)
    mesh.name = placement.label ?? `placement_${placement.id}`
    scene.add(mesh)
  }

  scene.add(new THREE.PointLight(0xffffff, 0.8))
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.5)
  dirLight.position.set(5, 10, 5)
  dirLight.target.position.set(0, 0, -1)
  dirLight.add(dirLight.target)
  scene.add(dirLight)

  return new Promise((resolve, reject) => {
    const exporter = new GLTFExporter()
    exporter.parse(
      scene,
      (result) => {
        if (result instanceof ArrayBuffer) {
          resolve(Buffer.from(result))
          return
        }

        resolve(Buffer.from(JSON.stringify(result)))
      },
      (error) => reject(error),
      { binary: true },
    )
  })
}