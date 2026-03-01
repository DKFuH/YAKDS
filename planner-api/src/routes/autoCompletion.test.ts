import Fastify from 'fastify'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    project: { findFirst: vi.fn() },
    room: { findFirst: vi.fn() },
    placement: { findMany: vi.fn() },
    generatedItem: {
      findMany: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    generatedItemSourceLink: { deleteMany: vi.fn() },
  },
}))

vi.mock('../db.js', () => ({ prisma: prismaMock }))

import { autoCompletionRoutes } from './autoCompletion.js'

const PROJECT_ID = 'proj-1'
const ROOM_ID = 'room-1'

describe('autoCompletionRoutes', () => {
  beforeEach(() => vi.clearAllMocks())

  it('POST auto-complete triggers rebuild and returns summary', async () => {
    prismaMock.project.findFirst.mockResolvedValue({ id: PROJECT_ID })
    prismaMock.room.findFirst.mockResolvedValue({ id: ROOM_ID })
    prismaMock.placement.findMany.mockResolvedValue([
      { id: 'p-1', wall_id: 'w-1', offset_mm: 0, width_mm: 600, depth_mm: 600, height_mm: 720, type: 'base' },
      { id: 'p-2', wall_id: 'w-1', offset_mm: 600, width_mm: 600, depth_mm: 600, height_mm: 720, type: 'base' },
    ])
    prismaMock.generatedItem.findMany.mockResolvedValue([])
    prismaMock.generatedItem.create.mockImplementation(({ data }: { data: { label: string; item_type: string; qty: number; unit: string } }) =>
      Promise.resolve({ id: 'gi-new', ...data })
    )

    const app = Fastify()
    await app.register(autoCompletionRoutes, { prefix: '/api/v1' })

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${PROJECT_ID}/rooms/${ROOM_ID}/auto-complete`,
      payload: { worktopOverhangFront_mm: 20 },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body).toMatchObject({ project_id: PROJECT_ID, room_id: ROOM_ID })
    expect(body.created).toBeGreaterThan(0)
    await app.close()
  })

  it('GET auto-complete lists generated items', async () => {
    prismaMock.generatedItem.findMany.mockResolvedValue([
      { id: 'gi-1', item_type: 'worktop', label: 'Arbeitsplatte (Wand w-1)', qty: 1200, unit: 'mm', source_links: [], catalog_article: null },
    ])

    const app = Fastify()
    await app.register(autoCompletionRoutes, { prefix: '/api/v1' })

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${PROJECT_ID}/rooms/${ROOM_ID}/auto-complete`,
    })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual(expect.arrayContaining([expect.objectContaining({ item_type: 'worktop' })]))
    await app.close()
  })
})
