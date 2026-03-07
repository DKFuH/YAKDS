import Fastify from 'fastify'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const tenantId = '00000000-0000-0000-0000-000000000001'
const projectId = '11111111-1111-1111-1111-111111111111'

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    project: {
      findFirst: vi.fn(),
    },
    alternative: {
      findFirst: vi.fn(),
    },
  },
}))

vi.mock('../db.js', () => ({
  prisma: prismaMock,
}))

import { exportRoutes } from './exports.js'
import { tenantMiddleware } from '../tenantMiddleware.js'

function createPayload() {
  return {
    project_id: projectId,
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
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.project.findFirst.mockResolvedValue({ id: projectId, rooms: [] })
    prismaMock.alternative.findFirst.mockResolvedValue({
      area: {
        project_id: projectId,
      },
    })
  })

  it('returns a DXF document as attachment', async () => {
    const app = Fastify()
    await app.register(tenantMiddleware)
    await app.register(exportRoutes, { prefix: '/api/v1' })

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/exports/dxf',
      headers: { 'x-tenant-id': tenantId },
      payload: createPayload(),
    })

    expect(response.statusCode).toBe(200)
    expect(response.headers['content-disposition']).toContain('kitchen-plan.dxf')
    expect(response.headers['content-type']).toContain('application/dxf')
    expect(response.body).toContain('OKP_ROOM')
    expect(response.body).toContain('OKP_OPENINGS')

    await app.close()
  })

  it('rejects malformed export payloads', async () => {
    const app = Fastify()
    await app.register(tenantMiddleware)
    await app.register(exportRoutes, { prefix: '/api/v1' })

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/exports/dxf',
      headers: { 'x-tenant-id': tenantId },
      payload: {
        project_id: projectId,
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
    await app.register(tenantMiddleware)
    await app.register(exportRoutes, { prefix: '/api/v1' })

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/exports/dwg',
      headers: { 'x-tenant-id': tenantId },
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
    const app = Fastify()
    await app.register(tenantMiddleware)
    await app.register(exportRoutes, { prefix: '/api/v1' })

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/projects/11111111-1111-1111-1111-111111111111/export-dwg',
      headers: { 'x-tenant-id': tenantId },
      payload: {
        ...createPayload(),
        filename: 'kitchen-plan.dwg',
        allow_dxf_fallback: true,
      },
    })

    expect(response.statusCode).toBe(200)
    expect(response.headers['x-okp-export-fallback']).toBe('dwg->dxf')
    expect(response.headers['content-disposition']).toContain('kitchen-plan.dxf')
    expect(response.headers['content-type']).toContain('application/dxf')
    expect(response.body).toContain('OKP_WALLS')

    await app.close()
  })

  it('returns 403 without tenant header', async () => {
    const app = Fastify()
    await app.register(tenantMiddleware)
    await app.register(exportRoutes, { prefix: '/api/v1' })

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/exports/dxf',
      payload: createPayload(),
    })

    expect(response.statusCode).toBe(403)
    expect(response.json()).toMatchObject({ error: 'FORBIDDEN' })

    await app.close()
  })

  it('returns 404 when project is outside tenant scope', async () => {
    prismaMock.project.findFirst.mockResolvedValueOnce(null)

    const app = Fastify()
    await app.register(tenantMiddleware)
    await app.register(exportRoutes, { prefix: '/api/v1' })

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/exports/dxf',
      headers: { 'x-tenant-id': tenantId },
      payload: createPayload(),
    })

    expect(response.statusCode).toBe(404)
    expect(response.json()).toMatchObject({
      error: 'NOT_FOUND',
      message: 'Project not found in tenant scope',
    })

    await app.close()
  })

  it('exports GLB for an alternative', async () => {
    prismaMock.project.findFirst.mockResolvedValueOnce({
      id: projectId,
      rooms: [
        {
          ceiling_height_mm: 2500,
          boundary: {
            wall_segments: [
              { id: 'w1', x0_mm: 0, y0_mm: 0, x1_mm: 4000, y1_mm: 0 },
            ],
          },
          placements: [
            { id: 'p1', wall_id: 'w1', offset_mm: 0, width_mm: 600, depth_mm: 600, height_mm: 720 },
          ],
        },
      ],
    })

    const app = Fastify()
    await app.register(tenantMiddleware)
    await app.register(exportRoutes, { prefix: '/api/v1' })

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/alternatives/alt-1/export/gltf',
      headers: { 'x-tenant-id': tenantId },
    })

    expect(response.statusCode).toBe(200)
    expect(response.headers['content-type']).toContain('model/gltf-binary')
    expect(response.headers['content-disposition']).toContain('alternative-alt-1.glb')
    expect(response.rawPayload.readUInt32LE(0)).toBe(0x46546c67)

    await app.close()
  })

  it('exports GLB when room contains arc wall segment', async () => {
    prismaMock.project.findFirst.mockResolvedValueOnce({
      id: projectId,
      rooms: [
        {
          ceiling_height_mm: 2500,
          boundary: {
            wall_segments: [
              {
                id: 'arc-1',
                kind: 'arc',
                start: { x_mm: 1000, y_mm: 0 },
                end: { x_mm: 0, y_mm: 1000 },
                center: { x_mm: 0, y_mm: 0 },
                radius_mm: 1000,
                clockwise: false,
                thickness_mm: 100,
              },
            ],
          },
          placements: [],
        },
      ],
    })

    const app = Fastify()
    await app.register(tenantMiddleware)
    await app.register(exportRoutes, { prefix: '/api/v1' })

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/alternatives/alt-1/export/gltf',
      headers: { 'x-tenant-id': tenantId },
    })

    expect(response.statusCode).toBe(200)
    expect(response.rawPayload.readUInt32LE(0)).toBe(0x46546c67)

    await app.close()
  })

  it('returns 404 when alternative does not exist for tenant scope', async () => {
    prismaMock.alternative.findFirst.mockResolvedValueOnce(null)

    const app = Fastify()
    await app.register(tenantMiddleware)
    await app.register(exportRoutes, { prefix: '/api/v1' })

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/alternatives/missing-alt/export/gltf',
      headers: { 'x-tenant-id': tenantId },
    })

    expect(response.statusCode).toBe(404)
    expect(response.json()).toMatchObject({
      error: 'NOT_FOUND',
      message: 'Alternative not found',
    })

    await app.close()
  })
})
