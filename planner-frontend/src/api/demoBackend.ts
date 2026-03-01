import type { Opening, WallSegment } from '@shared/types'
import type { CatalogItem, CatalogItemType } from './catalog.js'
import type { Placement } from './placements.js'
import type { Project, ProjectDetail } from './projects.js'
import type { RoomBoundaryPayload, RoomPayload } from './rooms.js'
import type { ValidatePayload, ValidateResponse } from './validate.js'

interface DemoStore {
  projects: ProjectDetail[]
  catalog: CatalogItem[]
}

const STORAGE_KEY = 'yakds-demo-store-v1'

function now(): string {
  return new Date().toISOString()
}

function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`
}

function buildBoundary(widthMm: number, depthMm: number): RoomBoundaryPayload {
  const vertices = [
    { id: uid('v'), index: 0, x_mm: 0, y_mm: 0 },
    { id: uid('v'), index: 1, x_mm: widthMm, y_mm: 0 },
    { id: uid('v'), index: 2, x_mm: widthMm, y_mm: depthMm },
    { id: uid('v'), index: 3, x_mm: 0, y_mm: depthMm }
  ]

  const wall_segments: WallSegment[] = vertices.map((vertex, index) => {
    const next = vertices[(index + 1) % vertices.length]
    const horizontal = vertex.y_mm === next.y_mm
    return {
      id: uid('wall'),
      index,
      start_vertex_id: vertex.id,
      end_vertex_id: next.id,
      length_mm: horizontal ? Math.abs(next.x_mm - vertex.x_mm) : Math.abs(next.y_mm - vertex.y_mm)
    }
  })

  return { vertices, wall_segments }
}

function buildRoom(projectId: string, name = 'Küche'): RoomPayload {
  const timestamp = now()
  return {
    id: uid('room'),
    project_id: projectId,
    name,
    ceiling_height_mm: 2500,
    boundary: buildBoundary(4200, 3200),
    ceiling_constraints: [],
    openings: [],
    placements: [],
    created_at: timestamp,
    updated_at: timestamp
  }
}

function seedCatalog(): CatalogItem[] {
  const items: Array<{
    sku: string
    name: string
    type: CatalogItemType
    width_mm: number
    height_mm: number
    depth_mm: number
    list_price_net: number
  }> = [
    { sku: 'US-060', name: 'Unterschrank 60', type: 'base_cabinet', width_mm: 600, height_mm: 720, depth_mm: 560, list_price_net: 249 },
    { sku: 'US-080', name: 'Unterschrank 80', type: 'base_cabinet', width_mm: 800, height_mm: 720, depth_mm: 560, list_price_net: 289 },
    { sku: 'HS-090', name: 'Hängeschrank 90', type: 'wall_cabinet', width_mm: 900, height_mm: 720, depth_mm: 350, list_price_net: 199 },
    { sku: 'TS-060', name: 'Hochschrank 60', type: 'tall_cabinet', width_mm: 600, height_mm: 2100, depth_mm: 600, list_price_net: 599 },
    { sku: 'APL-001', name: 'Arbeitsplatte Eiche 2 m', type: 'worktop', width_mm: 2000, height_mm: 38, depth_mm: 635, list_price_net: 179 },
    { sku: 'GER-001', name: 'Einbauherd', type: 'appliance', width_mm: 600, height_mm: 595, depth_mm: 560, list_price_net: 749 }
  ]

  return items.map((item) => ({
    id: uid('cat'),
    ...item,
    dealer_price_net: Math.round(item.list_price_net * 0.72 * 100) / 100,
    default_markup_pct: 25,
    tax_group_id: 'tax-standard',
    pricing_group_id: 'pricing-standard'
  }))
}

function seedStore(): DemoStore {
  const timestamp = now()
  const projectId = uid('project')
  const room = buildRoom(projectId)
  return {
    projects: [
      {
        id: projectId,
        name: 'Demo Küche',
        description: 'Lokaler Demo-Modus ohne Datenbank',
        status: 'active',
        created_at: timestamp,
        updated_at: timestamp,
        _count: { rooms: 1 },
        rooms: [room],
        quotes: []
      }
    ],
    catalog: seedCatalog()
  }
}

function loadStore(): DemoStore {
  if (typeof window === 'undefined') {
    return seedStore()
  }

  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    const seeded = seedStore()
    saveStore(seeded)
    return seeded
  }

  try {
    return JSON.parse(raw) as DemoStore
  } catch {
    const seeded = seedStore()
    saveStore(seeded)
    return seeded
  }
}

function saveStore(store: DemoStore): void {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
    window.localStorage.setItem('yakds-demo-mode', 'true')
  }
}

function updateStore(mutator: (store: DemoStore) => DemoStore): DemoStore {
  const next = mutator(loadStore())
  saveStore(next)
  return next
}

export function isDemoModeEnabled(): boolean {
  return typeof window !== 'undefined' && window.localStorage.getItem('yakds-demo-mode') === 'true'
}

export function listProjects(): Project[] {
  return loadStore().projects.map(({ rooms, quotes, ...project }) => ({
    ...project,
    _count: { rooms: rooms.length }
  }))
}

export function getProject(id: string): ProjectDetail {
  const project = loadStore().projects.find((entry) => entry.id === id)
  if (!project) {
    throw new Error('Projekt nicht gefunden.')
  }
  return project
}

export function createProject(data: { name: string; description?: string }): Project {
  const timestamp = now()
  const projectId = uid('project')
  const room = buildRoom(projectId)

  const store = updateStore((current) => ({
    ...current,
    projects: [
      {
        id: projectId,
        name: data.name,
        description: data.description ?? null,
        status: 'active',
        created_at: timestamp,
        updated_at: timestamp,
        _count: { rooms: 1 },
        rooms: [room],
        quotes: []
      },
      ...current.projects
    ]
  }))

  const project = store.projects.find((entry) => entry.id === projectId)
  if (!project) {
    throw new Error('Projekt konnte nicht erstellt werden.')
  }

  return {
    id: project.id,
    name: project.name,
    description: project.description,
    status: project.status,
    created_at: project.created_at,
    updated_at: project.updated_at,
    _count: { rooms: project.rooms.length }
  }
}

export function updateProject(id: string, data: { name?: string; description?: string; status?: string }): Project {
  const store = updateStore((current) => ({
    ...current,
    projects: current.projects.map((project) =>
      project.id === id
        ? {
            ...project,
            name: data.name ?? project.name,
            description: data.description ?? project.description,
            status: (data.status as Project['status'] | undefined) ?? project.status,
            updated_at: now()
          }
        : project
    )
  }))

  const project = store.projects.find((entry) => entry.id === id)
  if (!project) {
    throw new Error('Projekt nicht gefunden.')
  }

  return {
    id: project.id,
    name: project.name,
    description: project.description,
    status: project.status,
    created_at: project.created_at,
    updated_at: project.updated_at,
    _count: { rooms: project.rooms.length }
  }
}

export function deleteProject(id: string): void {
  updateStore((current) => ({
    ...current,
    projects: current.projects.filter((project) => project.id !== id)
  }))
}

export function createRoom(data: {
  project_id: string
  name: string
  ceiling_height_mm?: number
  boundary: RoomBoundaryPayload
}): RoomPayload {
  const roomId = uid('room')
  const timestamp = now()

  const store = updateStore((current) => ({
    ...current,
    projects: current.projects.map((project) =>
      project.id === data.project_id
        ? {
            ...project,
            updated_at: timestamp,
            rooms: [
              ...project.rooms,
              {
                id: roomId,
                project_id: data.project_id,
                name: data.name,
                ceiling_height_mm: data.ceiling_height_mm ?? 2500,
                boundary: data.boundary,
                ceiling_constraints: [],
                openings: [],
                placements: [],
                created_at: timestamp,
                updated_at: timestamp
              }
            ]
          }
        : project
    )
  }))

  const project = store.projects.find((entry) => entry.id === data.project_id)
  const room = project?.rooms.find((entry) => entry.id === roomId)
  if (!room) {
    throw new Error('Raum konnte nicht erstellt werden.')
  }
  return room as RoomPayload
}

export function updateRoom(
  id: string,
  data: Partial<{
    name: string
    ceiling_height_mm: number
    boundary: RoomBoundaryPayload
    ceiling_constraints: unknown[]
    openings: unknown[]
    placements: unknown[]
  }>
): RoomPayload {
  const store = updateStore((current) => ({
    ...current,
    projects: current.projects.map((project) => ({
      ...project,
      rooms: project.rooms.map((room) =>
        room.id === id
          ? {
              ...room,
              ...data,
              updated_at: now()
            }
          : room
      )
    }))
  }))

  for (const project of store.projects) {
    const room = project.rooms.find((entry) => entry.id === id)
    if (room) {
      return room as RoomPayload
    }
  }

  throw new Error('Raum nicht gefunden.')
}

export function savePlacements(roomId: string, placements: Placement[]): Placement[] {
  updateRoom(roomId, { placements })
  return placements
}

export function saveOpenings(roomId: string, openings: Opening[]): Opening[] {
  updateRoom(roomId, { openings })
  return openings
}

export function listCatalog(params?: {
  type?: CatalogItemType
  q?: string
  limit?: number
  offset?: number
}): CatalogItem[] {
  let items = [...loadStore().catalog]

  if (params?.type) {
    items = items.filter((item) => item.type === params.type)
  }

  if (params?.q) {
    const query = params.q.toLowerCase()
    items = items.filter((item) => item.name.toLowerCase().includes(query) || item.sku.toLowerCase().includes(query))
  }

  const offset = params?.offset ?? 0
  const limit = params?.limit ?? items.length
  return items.slice(offset, offset + limit)
}

export function getCatalogItem(id: string): CatalogItem {
  const item = loadStore().catalog.find((entry) => entry.id === id)
  if (!item) {
    throw new Error('Katalogartikel nicht gefunden.')
  }
  return item
}

export function validateProject(payload: ValidatePayload): ValidateResponse {
  const violations = payload.objects.flatMap((object, index) => {
    return payload.objects.slice(index + 1).flatMap((other) => {
      if (object.wall_id !== other.wall_id) {
        return []
      }

      const overlaps =
        object.offset_mm < other.offset_mm + other.width_mm &&
        other.offset_mm < object.offset_mm + object.width_mm

      if (!overlaps) {
        return []
      }

      return [
        {
          severity: 'error' as const,
          code: 'DEMO-COLLISION',
          message: `Platzierungen ${object.id} und ${other.id} überlappen.`,
          affected_ids: [object.id, other.id]
        }
      ]
    })
  })

  return {
    valid: violations.length === 0,
    violations,
    errors: violations.filter((entry) => entry.severity === 'error'),
    warnings: [],
    hints: []
  }
}
