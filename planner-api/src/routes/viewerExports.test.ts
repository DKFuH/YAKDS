import Fastify from 'fastify'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const tenantId = '00000000-0000-0000-0000-000000000001'
const projectId = '11111111-1111-1111-1111-111111111111'
const otherProjectId = '99999999-9999-9999-9999-999999999999'
const sheetId = '22222222-2222-2222-2222-222222222222'

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    project: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    room: {
      findMany: vi.fn(),
    },
    layoutSheet: {
      findUnique: vi.fn(),
    },
    projectEnvironment: {
      findUnique: vi.fn(),
    },
  },
}))

vi.mock('../db.js', () => ({
  prisma: prismaMock,
}))

import { viewerExportsRoutes } from './viewerExports.js'
import { tenantMiddleware } from '../tenantMiddleware.js'

function createRoom(boundary: unknown) {
  return {
    name: 'Kitchen',
    boundary,
  }
}

function validBoundary() {
  return {
    vertices: [
      { x_mm: 0, y_mm: 0 },
      { x_mm: 4000, y_mm: 0 },
      { x_mm: 4000, y_mm: 3000 },
      { x_mm: 0, y_mm: 3000 },
    ],
  }
}

async function createApp() {
  const app = Fastify()
  await app.register(tenantMiddleware)
  await app.register(viewerExportsRoutes, { prefix: '/api/v1' })
  return app
}

describe('viewerExportsRoutes', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    prismaMock.project.findUnique.mockResolvedValue({
      id: projectId,
      tenant_id: tenantId,
      name: 'Project Alpha',
    })
    prismaMock.project.findFirst.mockResolvedValue({ id: projectId })
    prismaMock.room.findMany.mockResolvedValue([createRoom(validBoundary())])
    prismaMock.layoutSheet.findUnique.mockResolvedValue({
      id: sheetId,
      project_id: projectId,
      name: 'Layout Sheet A',
      config: {},
    })
    prismaMock.projectEnvironment.findUnique.mockResolvedValue({ north_angle_deg: 0 })
  })

  it('html-viewer forbidden without tenant', async () => {
    const app = await createApp()

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/export/html-viewer`,
    })

    expect(response.statusCode).toBe(403)
    expect(response.json()).toMatchObject({ error: 'FORBIDDEN' })
    await app.close()
  })

  it('html-viewer 404 when project not in tenant', async () => {
    prismaMock.project.findUnique.mockResolvedValueOnce({
      id: projectId,
      tenant_id: otherProjectId,
      name: 'Project Outside Scope',
    })

    const app = await createApp()

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/export/html-viewer`,
      headers: { 'x-tenant-id': tenantId },
    })

    expect(response.statusCode).toBe(404)
    expect(response.json()).toMatchObject({
      error: 'NOT_FOUND',
      message: 'Project not found in tenant scope',
    })
    await app.close()
  })

  it('html-viewer success returns attachment + html', async () => {
    const app = await createApp()

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/export/html-viewer`,
      headers: { 'x-tenant-id': tenantId },
    })

    expect(response.statusCode).toBe(200)
    expect(response.headers['content-disposition']).toContain('.html')
    expect(response.headers['content-type']).toContain('text/html')
    expect(response.body).toContain('<html')
    expect(response.body).toContain('viewer-data')
    await app.close()
  })

  it('plan-svg success returns svg', async () => {
    const app = await createApp()

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/export/plan-svg`,
      headers: { 'x-tenant-id': tenantId },
    })

    expect(response.statusCode).toBe(200)
    expect(response.headers['content-disposition']).toContain('.svg')
    expect(response.headers['content-type']).toContain('image/svg+xml')
    expect(response.body).toContain('<svg')
    expect(response.body).toContain('<polygon')
    await app.close()
  })

  it('plan-svg returns fallback svg when no valid room vertices', async () => {
    prismaMock.room.findMany.mockResolvedValueOnce([createRoom({ vertices: [{ x_mm: 1000 }] })])

    const app = await createApp()

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/export/plan-svg`,
      headers: { 'x-tenant-id': tenantId },
    })

    expect(response.statusCode).toBe(200)
    expect(response.body).toContain('No valid room geometry available')
    await app.close()
  })

  it('layout-sheet 404 when sheet missing', async () => {
    prismaMock.layoutSheet.findUnique.mockResolvedValueOnce(null)

    const app = await createApp()

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/layout-sheets/${sheetId}/export/svg`,
      headers: { 'x-tenant-id': tenantId },
    })

    expect(response.statusCode).toBe(404)
    expect(response.json()).toMatchObject({
      error: 'NOT_FOUND',
      message: 'Layout sheet not found',
    })
    await app.close()
  })

  it('layout-sheet 404 when sheet project out of tenant', async () => {
    prismaMock.project.findFirst.mockResolvedValueOnce(null)

    const app = await createApp()

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/layout-sheets/${sheetId}/export/svg`,
      headers: { 'x-tenant-id': tenantId },
    })

    expect(response.statusCode).toBe(404)
    expect(response.json()).toMatchObject({
      error: 'NOT_FOUND',
      message: 'Layout sheet not found in tenant scope',
    })
    await app.close()
  })

  it('layout-sheet success includes north arrow when config show_north_arrow true', async () => {
    prismaMock.layoutSheet.findUnique.mockResolvedValueOnce({
      id: sheetId,
      project_id: projectId,
      name: 'Layout Sheet North',
      config: {
        show_north_arrow: true,
      },
    })
    prismaMock.projectEnvironment.findUnique.mockResolvedValueOnce({ north_angle_deg: 35 })

    const app = await createApp()

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/layout-sheets/${sheetId}/export/svg`,
      headers: { 'x-tenant-id': tenantId },
    })

    expect(response.statusCode).toBe(200)
    expect(response.headers['content-type']).toContain('image/svg+xml')
    expect(response.body).toContain('>N<')
    expect(response.body).toContain('rotate(35)')
    await app.close()
  })
})
