import Fastify from 'fastify'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const tenantId = '00000000-0000-0000-0000-000000000001'
const otherTenantId = '00000000-0000-0000-0000-000000000099'
const projectId = '11111111-1111-1111-1111-111111111111'
const otherProjectId = '99999999-9999-9999-9999-999999999999'
const fromLevelId = '22222222-2222-2222-2222-222222222222'
const toLevelId = '33333333-3333-3333-3333-333333333333'
const roomId = '44444444-4444-4444-4444-444444444444'
const verticalConnectionId = '55555555-5555-5555-5555-555555555555'

const { prismaMock, txMock } = vi.hoisted(() => {
  const tx = {
    verticalConnection: {
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    room: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  }

  const prisma = {
    project: {
      findUnique: vi.fn(),
    },
    buildingLevel: {
      findMany: vi.fn(),
    },
    room: {
      findUnique: vi.fn(),
    },
    verticalConnection: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(async (input: unknown) => {
      if (typeof input === 'function') {
        return (input as (client: typeof tx) => Promise<unknown>)(tx)
      }

      return Promise.all(input as Array<Promise<unknown>>)
    }),
  }

  return { prismaMock: prisma, txMock: tx }
})

vi.mock('../db.js', () => ({
  prisma: prismaMock,
}))

import { tenantMiddleware } from '../tenantMiddleware.js'
import { verticalConnectionsRoutes } from './verticalConnections.js'

async function createApp() {
  const app = Fastify()
  await app.register(tenantMiddleware)
  await app.register(verticalConnectionsRoutes, { prefix: '/api/v1' })
  return app
}

describe('verticalConnectionsRoutes', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    prismaMock.project.findUnique.mockResolvedValue({
      id: projectId,
      tenant_id: tenantId,
    })

    prismaMock.buildingLevel.findMany.mockResolvedValue([
      { id: fromLevelId, project_id: projectId, elevation_mm: 0 },
      { id: toLevelId, project_id: projectId, elevation_mm: 2800 },
    ])

    prismaMock.room.findUnique.mockResolvedValue({
      id: roomId,
      project_id: projectId,
    })

    prismaMock.verticalConnection.findMany.mockResolvedValue([
      {
        id: verticalConnectionId,
        tenant_id: tenantId,
        project_id: projectId,
        from_level_id: fromLevelId,
        to_level_id: toLevelId,
        kind: 'straight_stair',
      },
    ])

    prismaMock.verticalConnection.findUnique.mockResolvedValue({
      id: verticalConnectionId,
      tenant_id: tenantId,
      project_id: projectId,
      from_level_id: fromLevelId,
      to_level_id: toLevelId,
      kind: 'straight_stair',
      footprint_json: {
        room_id: roomId,
        rect: { x_mm: 1000, y_mm: 1000, width_mm: 1200, depth_mm: 2800 },
      },
      stair_json: {
        width_mm: 1000,
        tread_mm: 270,
      },
      opening_json: {},
    })

    txMock.verticalConnection.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: verticalConnectionId,
      ...data,
    }))

    txMock.verticalConnection.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: verticalConnectionId,
      tenant_id: tenantId,
      project_id: projectId,
      ...data,
    }))

    txMock.verticalConnection.delete.mockResolvedValue({ id: verticalConnectionId })

    txMock.room.findUnique.mockResolvedValue({
      id: roomId,
      ceiling_openings: [],
    })

    txMock.room.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: roomId,
      ...data,
    }))
  })

  it('returns 403 when tenant scope is missing', async () => {
    const app = await createApp()

    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectId}/vertical-connections`,
    })

    expect(response.statusCode).toBe(403)
    await app.close()
  })

  it('lists project vertical connections', async () => {
    const app = await createApp()

    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectId}/vertical-connections`,
      headers: { 'x-tenant-id': tenantId },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toHaveLength(1)
    expect(prismaMock.verticalConnection.findMany).toHaveBeenCalledWith({
      where: {
        tenant_id: tenantId,
        project_id: projectId,
      },
      orderBy: [{ created_at: 'asc' }],
    })

    await app.close()
  })

  it('rejects cross-project level combination and does not create connection', async () => {
    prismaMock.buildingLevel.findMany.mockResolvedValueOnce([
      { id: fromLevelId, project_id: projectId, elevation_mm: 0 },
      { id: toLevelId, project_id: otherProjectId, elevation_mm: 2800 },
    ])

    const app = await createApp()

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/vertical-connections`,
      headers: { 'x-tenant-id': tenantId },
      payload: {
        from_level_id: fromLevelId,
        to_level_id: toLevelId,
        kind: 'straight_stair',
        footprint_json: {
          room_id: roomId,
          rect: { x_mm: 1000, y_mm: 1000, width_mm: 1200, depth_mm: 2800 },
        },
      },
    })

    expect(response.statusCode).toBe(400)
    expect(txMock.verticalConnection.create).not.toHaveBeenCalled()

    await app.close()
  })

  it('returns 400 when from_level_id and to_level_id are equal', async () => {
    const app = await createApp()

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/vertical-connections`,
      headers: { 'x-tenant-id': tenantId },
      payload: {
        from_level_id: fromLevelId,
        to_level_id: fromLevelId,
        kind: 'straight_stair',
        footprint_json: {
          room_id: roomId,
          rect: { x_mm: 1000, y_mm: 1000, width_mm: 1200, depth_mm: 2800 },
        },
      },
    })

    expect(response.statusCode).toBe(400)
    expect(txMock.verticalConnection.create).not.toHaveBeenCalled()

    await app.close()
  })

  it('creates vertical connection and computes opening_json', async () => {
    const app = await createApp()

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/vertical-connections`,
      headers: { 'x-tenant-id': tenantId },
      payload: {
        from_level_id: fromLevelId,
        to_level_id: toLevelId,
        kind: 'straight_stair',
        footprint_json: {
          room_id: roomId,
          rect: { x_mm: 1000, y_mm: 1000, width_mm: 1200, depth_mm: 2800 },
        },
        stair_json: {
          width_mm: 1000,
          tread_mm: 270,
        },
      },
    })

    expect(response.statusCode).toBe(201)
    expect(txMock.verticalConnection.create).toHaveBeenCalledTimes(1)

    const createCall = txMock.verticalConnection.create.mock.calls[0][0] as {
      data: { opening_json: { source_kind: string } }
    }
    expect(createCall.data.opening_json.source_kind).toBe('straight_stair')
    expect(txMock.room.update).toHaveBeenCalledTimes(1)

    await app.close()
  })

  it('rejects impossible stair parameters', async () => {
    const app = await createApp()

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/vertical-connections`,
      headers: { 'x-tenant-id': tenantId },
      payload: {
        from_level_id: fromLevelId,
        to_level_id: toLevelId,
        kind: 'straight_stair',
        footprint_json: {
          room_id: roomId,
          rect: { x_mm: 1000, y_mm: 1000, width_mm: 1200, depth_mm: 2800 },
        },
        stair_json: {
          step_count: 3,
          rise_mm: 500,
        },
      },
    })

    expect(response.statusCode).toBe(400)
    expect(txMock.verticalConnection.create).not.toHaveBeenCalled()

    await app.close()
  })

  it('updates vertical connection and recomputes opening_json', async () => {
    const app = await createApp()

    const response = await app.inject({
      method: 'PATCH',
      url: `/api/v1/vertical-connections/${verticalConnectionId}`,
      headers: { 'x-tenant-id': tenantId },
      payload: {
        kind: 'l_stair',
        stair_json: {
          width_mm: 1100,
          tread_mm: 280,
        },
      },
    })

    expect(response.statusCode).toBe(200)
    expect(txMock.verticalConnection.update).toHaveBeenCalledTimes(1)

    const updateCall = txMock.verticalConnection.update.mock.calls[0][0] as {
      data: { kind: string; opening_json: { source_kind: string } }
    }
    expect(updateCall.data.kind).toBe('l_stair')
    expect(updateCall.data.opening_json.source_kind).toBe('l_stair')

    await app.close()
  })

  it('deletes vertical connection and removes room ceiling opening', async () => {
    txMock.room.findUnique.mockResolvedValueOnce({
      id: roomId,
      ceiling_openings: [
        {
          vertical_connection_id: verticalConnectionId,
          opening_json: { source_kind: 'straight_stair' },
        },
        {
          vertical_connection_id: 'other-vc',
          opening_json: { source_kind: 'void' },
        },
      ],
    })

    const app = await createApp()

    const response = await app.inject({
      method: 'DELETE',
      url: `/api/v1/vertical-connections/${verticalConnectionId}`,
      headers: { 'x-tenant-id': tenantId },
    })

    expect(response.statusCode).toBe(204)
    expect(txMock.verticalConnection.delete).toHaveBeenCalledWith({ where: { id: verticalConnectionId } })

    const roomUpdateCall = txMock.room.update.mock.calls[0][0] as {
      data: { ceiling_openings: Array<{ vertical_connection_id: string }> }
    }
    expect(roomUpdateCall.data.ceiling_openings).toEqual([
      {
        vertical_connection_id: 'other-vc',
        opening_json: { source_kind: 'void' },
      },
    ])

    await app.close()
  })

  it('returns 404 when project is outside tenant scope', async () => {
    prismaMock.project.findUnique.mockResolvedValueOnce({
      id: projectId,
      tenant_id: otherTenantId,
    })

    const app = await createApp()

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/vertical-connections`,
      headers: { 'x-tenant-id': tenantId },
      payload: {
        from_level_id: fromLevelId,
        to_level_id: toLevelId,
        kind: 'straight_stair',
        footprint_json: {
          room_id: roomId,
          rect: { x_mm: 1000, y_mm: 1000, width_mm: 1200, depth_mm: 2800 },
        },
      },
    })

    expect(response.statusCode).toBe(404)
    expect(txMock.verticalConnection.create).not.toHaveBeenCalled()

    await app.close()
  })
})
