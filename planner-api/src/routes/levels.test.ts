import Fastify from 'fastify'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const tenantId = '00000000-0000-0000-0000-000000000001'
const otherTenantId = '00000000-0000-0000-0000-000000000099'
const projectId = '11111111-1111-1111-1111-111111111111'
const levelId = '22222222-2222-2222-2222-222222222222'

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    project: {
      findUnique: vi.fn(),
    },
    buildingLevel: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    room: {
      updateMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

vi.mock('../db.js', () => ({
  prisma: prismaMock,
}))

import { tenantMiddleware } from '../tenantMiddleware.js'
import { levelsRoutes } from './levels.js'

async function createApp() {
  const app = Fastify()
  await app.register(tenantMiddleware)
  await app.register(levelsRoutes, { prefix: '/api/v1' })
  return app
}

describe('levelsRoutes', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    prismaMock.project.findUnique.mockResolvedValue({
      id: projectId,
      tenant_id: tenantId,
    })
    prismaMock.buildingLevel.findFirst.mockResolvedValue({
      id: levelId,
      project_id: projectId,
      tenant_id: tenantId,
      name: 'EG',
      order_index: 0,
      created_at: new Date().toISOString(),
    })
    prismaMock.buildingLevel.findMany.mockResolvedValue([
      {
        id: levelId,
        project_id: projectId,
        tenant_id: tenantId,
        name: 'EG',
        elevation_mm: 0,
        order_index: 0,
        visible: true,
      },
    ])
    prismaMock.buildingLevel.findUnique.mockResolvedValue({
      id: levelId,
      project_id: projectId,
      tenant_id: tenantId,
      name: 'EG',
      order_index: 0,
      visible: true,
    })
    prismaMock.room.updateMany.mockResolvedValue({ count: 0 })
    prismaMock.buildingLevel.create.mockResolvedValue({
      id: levelId,
      project_id: projectId,
      tenant_id: tenantId,
      name: 'EG',
      elevation_mm: 0,
      order_index: 0,
      visible: true,
    })
    prismaMock.buildingLevel.update.mockResolvedValue({
      id: levelId,
      project_id: projectId,
      tenant_id: tenantId,
      name: 'OG',
      elevation_mm: 2800,
      order_index: 1,
      visible: true,
    })
    prismaMock.buildingLevel.delete.mockResolvedValue({ id: levelId })
    prismaMock.$transaction.mockImplementation(async (operations: Array<Promise<unknown>>) => Promise.all(operations))
  })

  it('returns 403 when tenant header is missing', async () => {
    const app = await createApp()

    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectId}/levels`,
    })

    expect(response.statusCode).toBe(403)
    await app.close()
  })

  it('bootstraps default level on GET when project has no levels', async () => {
    prismaMock.buildingLevel.findFirst.mockResolvedValueOnce(null)

    const app = await createApp()

    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectId}/levels`,
      headers: { 'x-tenant-id': tenantId },
    })

    expect(response.statusCode).toBe(200)
    expect(prismaMock.buildingLevel.create).toHaveBeenCalledTimes(1)
    expect(prismaMock.room.updateMany).toHaveBeenCalledTimes(1)
    await app.close()
  })

  it('creates level with next order index', async () => {
    prismaMock.buildingLevel.findFirst.mockResolvedValueOnce({ order_index: 2 })
    prismaMock.buildingLevel.create.mockResolvedValueOnce({
      id: '33333333-3333-3333-3333-333333333333',
      project_id: projectId,
      tenant_id: tenantId,
      name: 'OG',
      elevation_mm: 2800,
      order_index: 3,
      visible: true,
    })

    const app = await createApp()

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/levels`,
      headers: { 'x-tenant-id': tenantId },
      payload: {
        name: 'OG',
        elevation_mm: 2800,
      },
    })

    expect(response.statusCode).toBe(201)
    expect(prismaMock.buildingLevel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          order_index: 3,
        }),
      }),
    )
    await app.close()
  })

  it('returns 404 for patch when level is outside tenant scope', async () => {
    prismaMock.project.findUnique.mockResolvedValueOnce({
      id: projectId,
      tenant_id: otherTenantId,
    })

    const app = await createApp()

    const response = await app.inject({
      method: 'PATCH',
      url: `/api/v1/levels/${levelId}`,
      headers: { 'x-tenant-id': tenantId },
      payload: {
        visible: false,
      },
    })

    expect(response.statusCode).toBe(404)
    expect(prismaMock.buildingLevel.update).not.toHaveBeenCalled()
    await app.close()
  })

  it('returns 400 when deleting the last remaining level', async () => {
    prismaMock.buildingLevel.findMany.mockResolvedValueOnce([
      {
        id: levelId,
        project_id: projectId,
        tenant_id: tenantId,
        name: 'EG',
        order_index: 0,
        visible: true,
      },
    ])

    const app = await createApp()

    const response = await app.inject({
      method: 'DELETE',
      url: `/api/v1/levels/${levelId}`,
      headers: { 'x-tenant-id': tenantId },
    })

    expect(response.statusCode).toBe(400)
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
    await app.close()
  })

  it('reassigns rooms before deleting a level', async () => {
    prismaMock.buildingLevel.findMany.mockResolvedValueOnce([
      {
        id: levelId,
        project_id: projectId,
        tenant_id: tenantId,
        name: 'EG',
        order_index: 0,
        visible: true,
      },
      {
        id: '44444444-4444-4444-4444-444444444444',
        project_id: projectId,
        tenant_id: tenantId,
        name: 'OG',
        order_index: 1,
        visible: true,
      },
    ])

    const app = await createApp()

    const response = await app.inject({
      method: 'DELETE',
      url: `/api/v1/levels/${levelId}`,
      headers: { 'x-tenant-id': tenantId },
    })

    expect(response.statusCode).toBe(204)
    expect(prismaMock.room.updateMany).toHaveBeenCalledWith({
      where: { level_id: levelId },
      data: { level_id: '44444444-4444-4444-4444-444444444444' },
    })
    expect(prismaMock.buildingLevel.delete).toHaveBeenCalledWith({ where: { id: levelId } })
    await app.close()
  })
})
