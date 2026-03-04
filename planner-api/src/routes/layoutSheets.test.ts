import Fastify from 'fastify'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const projectId = '11111111-1111-1111-1111-111111111111'
const missingProjectId = '99999999-9999-9999-9999-999999999999'
const sheetId = '22222222-2222-2222-2222-222222222222'
const viewId = '33333333-3333-3333-3333-333333333333'

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    project: {
      findUnique: vi.fn(),
    },
    layoutSheet: {
      findMany: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
    layoutView: {
      create: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
  },
}))

vi.mock('../db.js', () => ({
  prisma: prismaMock,
}))

import { layoutSheetRoutes } from './layoutSheets.js'

function createSheetFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: sheetId,
    project_id: projectId,
    name: 'Grundriss',
    sheet_type: 'floorplan',
    position: 0,
    config: {},
    created_at: '2026-03-03T10:00:00.000Z',
    updated_at: '2026-03-03T10:00:00.000Z',
    views: [],
    ...overrides,
  }
}

function createViewFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: viewId,
    sheet_id: sheetId,
    view_type: 'detail',
    label: null,
    room_id: null,
    wall_id: null,
    clip_x_mm: null,
    clip_y_mm: null,
    clip_w_mm: null,
    clip_h_mm: null,
    scale: 1,
    x_on_sheet: 0,
    y_on_sheet: 0,
    created_at: '2026-03-03T10:00:00.000Z',
    ...overrides,
  }
}

async function createApp() {
  const app = Fastify()
  await app.register(layoutSheetRoutes, { prefix: '/api/v1' })
  return app
}

describe('layoutSheetRoutes', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    prismaMock.project.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) => {
      if (where.id === projectId) return { id: projectId }
      return null
    })

    prismaMock.layoutSheet.findMany.mockResolvedValue([
      createSheetFixture({ id: 'sheet-1', position: 0 }),
      createSheetFixture({ id: 'sheet-2', position: 1, sheet_type: 'elevations', name: 'Ansichten' }),
    ])

    prismaMock.layoutSheet.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) => {
      if (where.id === sheetId) return createSheetFixture()
      return null
    })

    prismaMock.layoutView.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) => {
      if (where.id === viewId) return createViewFixture()
      return null
    })

    prismaMock.layoutSheet.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
      return createSheetFixture(data)
    })

    prismaMock.layoutView.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
      return createViewFixture(data)
    })

    prismaMock.layoutSheet.delete.mockResolvedValue({ id: sheetId })
    prismaMock.layoutView.delete.mockResolvedValue({ id: viewId })
  })

  it('POST /projects/:id/layout-sheets returns 201', async () => {
    const app = await createApp()

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/layout-sheets`,
      payload: { name: 'Installationsplan', sheet_type: 'installation', position: 2, config: {} },
    })

    expect(response.statusCode).toBe(201)
    expect(response.json()).toMatchObject({ project_id: projectId, name: 'Installationsplan' })
    await app.close()
  })

  it('POST /projects/:id/layout-sheets with invalid sheet_type returns 400', async () => {
    const app = await createApp()

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/layout-sheets`,
      payload: { name: 'X', sheet_type: 'invalid-type' },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json()).toMatchObject({ error: 'BAD_REQUEST' })
    await app.close()
  })

  it('GET /projects/:id/layout-sheets returns ordered array', async () => {
    const app = await createApp()

    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectId}/layout-sheets`,
    })

    expect(response.statusCode).toBe(200)
    expect(Array.isArray(response.json())).toBe(true)
    expect(prismaMock.layoutSheet.findMany).toHaveBeenCalledWith(expect.objectContaining({
      orderBy: { position: 'asc' },
    }))
    await app.close()
  })

  it('DELETE /layout-sheets/:id returns 204', async () => {
    const app = await createApp()

    const response = await app.inject({
      method: 'DELETE',
      url: `/api/v1/layout-sheets/${sheetId}`,
    })

    expect(response.statusCode).toBe(204)
    await app.close()
  })

  it('POST /projects/:id/layout-sheets/scaffold returns exactly 3 default sheets', async () => {
    const app = await createApp()

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/layout-sheets/scaffold`,
    })

    expect(response.statusCode).toBe(201)
    const body = response.json()
    expect(Array.isArray(body)).toBe(true)
    expect(body).toHaveLength(3)
    expect(body.map((entry: { name: string }) => entry.name)).toEqual(['Grundriss', 'Ansichten', 'Installationsplan'])
    await app.close()
  })

  it('POST /projects/:id/layout-sheets/scaffold creates correct sheet types', async () => {
    const app = await createApp()

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/layout-sheets/scaffold`,
    })

    expect(response.statusCode).toBe(201)
    const body = response.json()
    expect(body.map((entry: { sheet_type: string }) => entry.sheet_type)).toEqual([
      'floorplan',
      'elevations',
      'installation',
    ])
    await app.close()
  })

  it('POST /layout-sheets/:id/views with detail returns 201', async () => {
    const app = await createApp()

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/layout-sheets/${sheetId}/views`,
      payload: { view_type: 'detail', scale: 1.5, x_on_sheet: 20, y_on_sheet: 30 },
    })

    expect(response.statusCode).toBe(201)
    expect(response.json()).toMatchObject({ sheet_id: sheetId, view_type: 'detail' })
    await app.close()
  })

  it('POST /layout-sheets/:id/views with clip coordinates persists clip_x_mm', async () => {
    const app = await createApp()

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/layout-sheets/${sheetId}/views`,
      payload: {
        view_type: 'detail',
        clip_x_mm: 10,
        clip_y_mm: 20,
        clip_w_mm: 500,
        clip_h_mm: 300,
      },
    })

    expect(response.statusCode).toBe(201)
    expect(response.json()).toMatchObject({ clip_x_mm: 10 })
    await app.close()
  })

  it('DELETE /layout-views/:id returns 204', async () => {
    const app = await createApp()

    const response = await app.inject({
      method: 'DELETE',
      url: `/api/v1/layout-views/${viewId}`,
    })

    expect(response.statusCode).toBe(204)
    await app.close()
  })

  it('GET /projects/:id/layout-sheets unknown project returns 404', async () => {
    const app = await createApp()

    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${missingProjectId}/layout-sheets`,
    })

    expect(response.statusCode).toBe(404)
    await app.close()
  })

  it('GET /layout-sheets/:id/render-svg includes arc label when enabled', async () => {
    prismaMock.layoutSheet.findUnique.mockResolvedValueOnce(createSheetFixture({
      config: { show_arc_annotations: true, arc_dimension_style: 'radius-first' },
    }))
    const app = await createApp()

    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/layout-sheets/${sheetId}/render-svg`,
    })

    expect(response.statusCode).toBe(200)
    expect(response.headers['content-type']).toContain('image/svg+xml')
    expect(response.body).toContain('R=1000 mm')
    await app.close()
  })
})
