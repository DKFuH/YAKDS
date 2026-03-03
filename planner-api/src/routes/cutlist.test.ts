import Fastify from 'fastify'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const projectId = '11111111-1111-1111-1111-111111111111'
const roomId = '22222222-2222-2222-2222-222222222222'
const cutlistId = '33333333-3333-3333-3333-333333333333'

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    project: {
      findUnique: vi.fn(),
    },
    room: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    catalogArticle: {
      findMany: vi.fn(),
    },
    cutlist: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
  },
}))

vi.mock('../db.js', () => ({
  prisma: prismaMock,
}))

import { cutlistRoutes } from './cutlist.js'

async function createApp() {
  const app = Fastify()
  await app.register(cutlistRoutes, { prefix: '/api/v1' })
  return app
}

function createCutlistRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: cutlistId,
    project_id: projectId,
    room_id: roomId,
    generated_at: new Date('2026-03-03T10:00:00.000Z'),
    parts: [
      {
        label: 'Seite links',
        width_mm: 560,
        height_mm: 720,
        quantity: 1,
        material_code: 'SPAN-19',
        material_label: 'Span 19',
        grain_direction: 'length',
        article_name: 'US 60',
        article_id: 'a-1',
        placement_id: 'p-1',
        room_id: roomId,
        room_name: 'Küche',
      },
    ],
    summary: {
      total_parts: 1,
      by_material: {
        'SPAN-19': { count: 1, area_sqm: 0.403, material_label: 'Span 19' },
      },
    },
    ...overrides,
  }
}

describe('cutlistRoutes', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    prismaMock.project.findUnique.mockResolvedValue({ id: projectId, name: 'Projekt A' })
    prismaMock.room.findUnique.mockResolvedValue({ id: roomId, name: 'Küche' })
    prismaMock.room.findMany.mockResolvedValue([
      {
        id: roomId,
        name: 'Küche',
        placements: [{ id: 'p-1', catalog_article_id: 'a-1', quantity: 1 }],
      },
    ])
    prismaMock.catalogArticle.findMany.mockResolvedValue([
      {
        id: 'a-1',
        name: 'US 60',
        base_dims_json: { width_mm: 600, height_mm: 720 },
        material_code: 'SPAN-19',
        material_label: 'Span 19',
        grain_direction: 'length',
        cutlist_parts: [
          { label: 'Seite links', width_mm: 560, height_mm: 720, qty_per_unit: 1, material_code: 'SPAN-19' },
        ],
      },
    ])

    prismaMock.cutlist.create.mockResolvedValue(createCutlistRecord())
    prismaMock.cutlist.findMany.mockResolvedValue([createCutlistRecord()])
    prismaMock.cutlist.findUnique.mockResolvedValue(createCutlistRecord())
    prismaMock.cutlist.delete.mockResolvedValue({ id: cutlistId })
  })

  it('POST /projects/:id/cutlist/generate returns 201 with persisted cutlist', async () => {
    const app = await createApp()

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/cutlist/generate`,
      payload: { room_id: roomId },
    })

    expect(response.statusCode).toBe(201)
    expect(response.json()).toMatchObject({ id: cutlistId, project_id: projectId })
    await app.close()
  })

  it('GET /projects/:id/cutlists returns stored cutlists', async () => {
    const app = await createApp()

    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectId}/cutlists`,
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toHaveLength(1)
    await app.close()
  })

  it('GET /cutlists/:id/export.csv returns csv content', async () => {
    const app = await createApp()

    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/cutlists/${cutlistId}/export.csv`,
    })

    expect(response.statusCode).toBe(200)
    expect(response.headers['content-type']).toContain('text/csv')
    expect(response.body).toContain('Seite links')
    await app.close()
  })

  it('GET /cutlists/:id/export.pdf returns pdf content', async () => {
    const app = await createApp()

    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/cutlists/${cutlistId}/export.pdf`,
    })

    expect(response.statusCode).toBe(200)
    expect(response.headers['content-type']).toContain('application/pdf')
    expect(response.body.startsWith('%PDF-1.4')).toBe(true)
    await app.close()
  })

  it('DELETE /cutlists/:id returns 204', async () => {
    const app = await createApp()

    const response = await app.inject({
      method: 'DELETE',
      url: `/api/v1/cutlists/${cutlistId}`,
    })

    expect(response.statusCode).toBe(204)
    expect(prismaMock.cutlist.delete).toHaveBeenCalledWith({ where: { id: cutlistId } })
    await app.close()
  })

  it('GET /cutlists/:id returns one cutlist', async () => {
    const app = await createApp()

    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/cutlists/${cutlistId}`,
    })

    expect(response.statusCode).toBe(200)
    expect(response.json().id).toBe(cutlistId)
    await app.close()
  })
})
