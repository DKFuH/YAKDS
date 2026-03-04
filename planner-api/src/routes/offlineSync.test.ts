import Fastify from 'fastify'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const projectId = '11111111-1111-1111-1111-111111111111'
const tenantId = '00000000-0000-0000-0000-000000000001'

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    project: {
      findUnique: vi.fn(),
    },
    room: {
      findMany: vi.fn(),
    },
    siteSurvey: {
      findMany: vi.fn(),
    },
    offlineSyncJob: {
      count: vi.fn(),
      createMany: vi.fn(),
      findMany: vi.fn(),
    },
  },
}))

vi.mock('../db.js', () => ({
  prisma: prismaMock,
}))

import { offlineSyncRoutes } from './offlineSync.js'

describe('offlineSyncRoutes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.offlineSyncJob.count.mockResolvedValue(0)
    prismaMock.offlineSyncJob.createMany.mockResolvedValue({ count: 0 })
    prismaMock.offlineSyncJob.findMany.mockResolvedValue([])
  })

  it('returns offline bundle for existing project', async () => {
    prismaMock.project.findUnique.mockResolvedValue({ id: projectId, tenant_id: tenantId })
    prismaMock.room.findMany.mockResolvedValue([{ id: 'room-1', project_id: projectId }])
    prismaMock.siteSurvey.findMany.mockResolvedValue([{ id: 'survey-1', project_id: projectId }])

    const app = Fastify()
    await app.register(offlineSyncRoutes, { prefix: '/api/v1' })

    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectId}/offline-bundle`,
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
      project: { id: projectId },
      rooms: [{ id: 'room-1' }],
      site_surveys: [{ id: 'survey-1' }],
      offline_sync_pending: 0,
    })

    await app.close()
  })

  it('returns 404 when project is missing for offline bundle', async () => {
    prismaMock.project.findUnique.mockResolvedValue(null)

    const app = Fastify()
    await app.register(offlineSyncRoutes, { prefix: '/api/v1' })

    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectId}/offline-bundle`,
    })

    expect(response.statusCode).toBe(404)

    await app.close()
  })

  it('queues offline sync jobs and returns pending count', async () => {
    prismaMock.offlineSyncJob.count.mockResolvedValue(1)
    prismaMock.offlineSyncJob.findMany.mockResolvedValue([
      {
        id: 'job-1',
        tenant_id: tenantId,
        project_id: projectId,
        entity_type: 'POST /projects/123/site-surveys',
        payload_json: { created_by: 'mobile-user' },
        status: 'pending',
        created_at: new Date('2026-03-04T12:00:00.000Z'),
        updated_at: new Date('2026-03-04T12:00:00.000Z'),
      },
    ])

    const app = Fastify()
    app.addHook('onRequest', async (request) => {
      ;(request as { tenantId?: string }).tenantId = tenantId
    })
    await app.register(offlineSyncRoutes, { prefix: '/api/v1' })

    const queueResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/offline-sync',
      payload: {
        jobs: [
          {
            project_id: projectId,
            entity_type: 'POST /projects/123/site-surveys',
            payload_json: { created_by: 'mobile-user' },
          },
        ],
      },
    })

    expect(queueResponse.statusCode).toBe(202)
    expect(queueResponse.json()).toMatchObject({ queued: 1, pending_total: 1 })
    expect(prismaMock.offlineSyncJob.createMany).toHaveBeenCalledTimes(1)

    const pendingResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/offline-sync/pending',
    })

    expect(pendingResponse.statusCode).toBe(200)
    expect(pendingResponse.json()).toMatchObject({ pending_total: 1 })

    await app.close()
  })

  it('rejects invalid offline sync payloads', async () => {
    const app = Fastify()
    await app.register(offlineSyncRoutes, { prefix: '/api/v1' })

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/offline-sync',
      payload: { jobs: [] },
    })

    expect(response.statusCode).toBe(400)

    await app.close()
  })
})
