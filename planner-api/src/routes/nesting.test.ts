import Fastify from 'fastify'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const projectId = '11111111-1111-1111-1111-111111111111'
const cutlistId = '22222222-2222-2222-2222-222222222222'
const jobId = '33333333-3333-3333-3333-333333333333'

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    project: {
      findUnique: vi.fn(),
    },
    cutlist: {
      findUnique: vi.fn(),
    },
    nestingJob: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}))

vi.mock('../db.js', () => ({
  prisma: prismaMock,
}))

import { nestingRoutes } from './nesting.js'

async function createApp() {
  const app = Fastify()
  await app.register(nestingRoutes, { prefix: '/api/v1' })
  return app
}

function createJobRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: jobId,
    tenant_id: 'tenant-1',
    project_id: projectId,
    source_cutlist_id: cutlistId,
    sheet_width_mm: 2800,
    sheet_height_mm: 2070,
    kerf_mm: 4,
    allow_rotate: true,
    status: 'calculated',
    result_json: {
      sheets: [
        {
          index: 1,
          width_mm: 2800,
          height_mm: 2070,
          used_area_mm2: 720000,
          waste_area_mm2: 5076000,
          placements: [
            {
              part_id: 'part-1',
              x_mm: 0,
              y_mm: 0,
              width_mm: 1000,
              height_mm: 720,
              rotated: false,
            },
          ],
        },
      ],
      total_parts: 1,
      placed_parts: 1,
      waste_pct: 87.58,
    },
    created_at: new Date('2026-03-03T10:00:00.000Z'),
    updated_at: new Date('2026-03-03T10:00:00.000Z'),
    ...overrides,
  }
}

describe('nestingRoutes', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    prismaMock.project.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) => {
      if (where.id === projectId) return { id: projectId, tenant_id: 'tenant-1' }
      return null
    })

    prismaMock.cutlist.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) => {
      if (where.id === cutlistId) {
        return {
          id: cutlistId,
          project_id: projectId,
          parts: [
            {
              label: 'Seite links',
              width_mm: 1000,
              height_mm: 720,
              quantity: 1,
              material_code: 'SPAN-19',
            },
          ],
        }
      }
      return null
    })

    prismaMock.nestingJob.create.mockResolvedValue(createJobRecord())
    prismaMock.nestingJob.findMany.mockResolvedValue([createJobRecord()])
    prismaMock.nestingJob.findUnique.mockResolvedValue(createJobRecord())
    prismaMock.nestingJob.update.mockResolvedValue(createJobRecord({ status: 'exported' }))
    prismaMock.nestingJob.delete.mockResolvedValue({ id: jobId })
  })

  it('POST /projects/:id/nesting-jobs returns 201', async () => {
    const app = await createApp()

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/nesting-jobs`,
      payload: {
        source_cutlist_id: cutlistId,
        sheet_width_mm: 2800,
        sheet_height_mm: 2070,
        kerf_mm: 4,
        allow_rotate: true,
      },
    })

    expect(response.statusCode).toBe(201)
    expect(response.json()).toMatchObject({ id: jobId, project_id: projectId })
    await app.close()
  })

  it('POST /projects/:id/nesting-jobs returns 400 for oversized part', async () => {
    prismaMock.cutlist.findUnique.mockResolvedValue({
      id: cutlistId,
      project_id: projectId,
      parts: [{ label: 'XXL', width_mm: 5000, height_mm: 4000, quantity: 1, material_code: 'SPAN-19' }],
    })

    const app = await createApp()

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/nesting-jobs`,
      payload: {
        source_cutlist_id: cutlistId,
        sheet_width_mm: 2800,
        sheet_height_mm: 2070,
      },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json()).toMatchObject({ error: 'BAD_REQUEST' })
    await app.close()
  })

  it('GET /projects/:id/nesting-jobs returns list', async () => {
    const app = await createApp()

    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectId}/nesting-jobs`,
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toHaveLength(1)
    await app.close()
  })

  it('GET /nesting-jobs/:id returns detail', async () => {
    const app = await createApp()

    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/nesting-jobs/${jobId}`,
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({ id: jobId })
    await app.close()
  })

  it('GET /nesting-jobs/:id/export/dxf returns DXF headers', async () => {
    const app = await createApp()

    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/nesting-jobs/${jobId}/export/dxf`,
    })

    expect(response.statusCode).toBe(200)
    expect(response.headers['content-type']).toContain('application/dxf')
    expect(response.headers['content-disposition']).toContain(`nesting-${jobId}.dxf`)
    expect(response.body).toContain('SECTION')
    expect(response.body).toContain('SHEET_BORDER')
    await app.close()
  })

  it('DELETE /nesting-jobs/:id returns 204', async () => {
    const app = await createApp()

    const response = await app.inject({
      method: 'DELETE',
      url: `/api/v1/nesting-jobs/${jobId}`,
    })

    expect(response.statusCode).toBe(204)
    expect(prismaMock.nestingJob.delete).toHaveBeenCalledWith({ where: { id: jobId } })
    await app.close()
  })
})
