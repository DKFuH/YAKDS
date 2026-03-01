import Fastify from 'fastify'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const TENANT_ID = '00000000-0000-0000-0000-000000000001'
const projectId = '11111111-1111-1111-1111-111111111111'

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    project: {
      findFirst: vi.fn(),
    },
  },
}))

vi.mock('../db.js', () => ({
  prisma: prismaMock,
}))

import { tenantMiddleware } from '../tenantMiddleware.js'
import { exportRoutes } from './exports.js'

async function makeApp() {
  const app = Fastify()
  await tenantMiddleware(app)
  app.register(exportRoutes, { prefix: '/api/v1' })
  return app
}

function createPayload() {
  return {
    filename: 'kitchen-plan',
    payload: {
      room: {
        boundary: [
          { id: 'v1', x_mm: 0, y_mm: 0, index: 0 },
          { id: 'v2', x_mm: 4000, y_mm: 0, index: 1 },
          { id: 'v3', x_mm: 4000, y_mm: 3000, index: 2 },
          { id: 'v4', x_mm: 0, y_mm: 3000, index: 3 },
        ],
      },
      wallSegments: [
        {
          id: 'wall-1',
          start: { x_mm: 0, y_mm: 0 },
          end: { x_mm: 4000, y_mm: 0 },
          length_mm: 4000,
        },
      ],
      openings: [
        {
          id: 'opening-1',
          wall_id: 'wall-1',
          offset_mm: 800,
          width_mm: 900,
          source: 'manual',
        },
      ],
      furniture: [
        {
          id: 'furniture-1',
          footprintRect: {
            min: { x_mm: 500, y_mm: 500 },
            max: { x_mm: 1100, y_mm: 1100 },
          },
        },
      ],
      includeFurniture: true,
    },
  }
}

describe('exportRoutes', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns a DXF document as attachment', async () => {
    const app = Fastify()
    await app.register(exportRoutes, { prefix: '/api/v1' })

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/exports/dxf',
      payload: createPayload(),
    })

    expect(response.statusCode).toBe(200)
    expect(response.headers['content-disposition']).toContain('kitchen-plan.dxf')
    expect(response.headers['content-type']).toContain('application/dxf')
    expect(response.body).toContain('YAKDS_ROOM')
    expect(response.body).toContain('YAKDS_OPENINGS')

    await app.close()
  })

  it('rejects malformed export payloads', async () => {
    const app = Fastify()
    await app.register(exportRoutes, { prefix: '/api/v1' })

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/exports/dxf',
      payload: {
        payload: {
          room: { boundary: [] },
          wallSegments: [],
          openings: [],
          furniture: [],
          includeFurniture: true,
        },
      },
    })

    expect(response.statusCode).toBe(400)

    await app.close()
  })

  it('returns a clear staging error for native DWG exports by default', async () => {
    const app = Fastify()
    await app.register(exportRoutes, { prefix: '/api/v1' })

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/exports/dwg',
      payload: createPayload(),
    })

    expect(response.statusCode).toBe(501)
    expect(response.json()).toEqual({
      error: 'DWG_EXPORT_NOT_AVAILABLE',
      message: 'Native DWG export is not wired yet. Use /exports/dxf or set allow_dxf_fallback=true.',
    })

    await app.close()
  })

  it('can fall back from DWG export requests to DXF attachments when allowed', async () => {
    prismaMock.project.findFirst.mockResolvedValue({ id: projectId })

    const app = await makeApp()

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/export-dwg`,
      headers: { 'x-tenant-id': TENANT_ID },
      payload: {
        ...createPayload(),
        filename: 'kitchen-plan.dwg',
        allow_dxf_fallback: true,
      },
    })

    expect(response.statusCode).toBe(200)
    expect(response.headers['x-yakds-export-fallback']).toBe('dwg->dxf')
    expect(response.headers['content-disposition']).toContain('kitchen-plan.dxf')
    expect(response.headers['content-type']).toContain('application/dxf')
    expect(response.body).toContain('YAKDS_WALLS')

    await app.close()
  })
})
