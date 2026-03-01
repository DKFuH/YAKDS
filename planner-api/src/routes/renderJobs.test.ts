import Fastify from 'fastify'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    project: { findUnique: vi.fn() },
    renderJob: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    renderJobResult: {
      upsert: vi.fn(),
    },
  },
}))

vi.mock('../db.js', () => ({
  prisma: prismaMock,
}))

import { renderJobRoutes } from './renderJobs.js'

describe('renderJobRoutes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates render jobs for existing projects', async () => {
    prismaMock.project.findUnique.mockResolvedValue({ id: '11111111-1111-1111-1111-111111111111' })
    prismaMock.renderJob.create.mockResolvedValue({
      id: '22222222-2222-2222-2222-222222222222',
      project_id: '11111111-1111-1111-1111-111111111111',
      status: 'queued',
    })

    const app = Fastify()
    await app.register(renderJobRoutes, { prefix: '/api/v1' })

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/projects/11111111-1111-1111-1111-111111111111/render-jobs',
      payload: { scene_payload: { room_id: 'room-1' } },
    })

    expect(response.statusCode).toBe(201)
    expect(response.json().status).toBe('queued')

    await app.close()
  })

  it('runs worker flow from register to complete', async () => {
    prismaMock.renderJob.findFirst.mockResolvedValueOnce({
      id: '33333333-3333-3333-3333-333333333333',
      status: 'queued',
      worker_id: null,
      created_at: new Date('2026-03-01T00:00:00.000Z'),
    })

    prismaMock.renderJob.update
      .mockResolvedValueOnce({
        id: '33333333-3333-3333-3333-333333333333',
        status: 'assigned',
        worker_id: 'dynamic-worker',
      })
      .mockResolvedValueOnce({
        id: '33333333-3333-3333-3333-333333333333',
        status: 'running',
        worker_id: 'dynamic-worker',
      })
      .mockResolvedValueOnce({
        id: '33333333-3333-3333-3333-333333333333',
        status: 'done',
        worker_id: 'dynamic-worker',
      })

    prismaMock.renderJobResult.upsert.mockResolvedValue({
      id: 'result-1',
      job_id: '33333333-3333-3333-3333-333333333333',
      image_url: 'https://example.com/render.png',
    })

    const app = Fastify()
    await app.register(renderJobRoutes, { prefix: '/api/v1' })

    const registerResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/render-workers/register',
      payload: { node_name: 'worker-a' },
    })
    expect(registerResponse.statusCode).toBe(201)

    const workerId = registerResponse.json().worker_id as string

    prismaMock.renderJob.update.mockImplementation(async (args: { data: { worker_id?: string; status: string } }) => ({
      id: '33333333-3333-3333-3333-333333333333',
      status: args.data.status,
      worker_id: args.data.worker_id ?? workerId,
    }))

    prismaMock.renderJob.findUnique.mockResolvedValue({
      id: '33333333-3333-3333-3333-333333333333',
      status: 'assigned',
      worker_id: workerId,
    })

    const fetchResponse = await app.inject({
      method: 'POST',
      url: `/api/v1/render-workers/${workerId}/fetch-job`,
    })
    expect(fetchResponse.statusCode).toBe(200)
    expect(fetchResponse.json().job.status).toBe('assigned')

    const startResponse = await app.inject({
      method: 'POST',
      url: `/api/v1/render-workers/${workerId}/jobs/33333333-3333-3333-3333-333333333333/start`,
    })
    expect(startResponse.statusCode).toBe(200)

    const completeResponse = await app.inject({
      method: 'POST',
      url: `/api/v1/render-workers/${workerId}/jobs/33333333-3333-3333-3333-333333333333/complete`,
      payload: {
        image_url: 'https://example.com/render.png',
        width_px: 1920,
        height_px: 1080,
        render_time_ms: 1200,
      },
    })
    expect(completeResponse.statusCode).toBe(200)
    expect(completeResponse.json().job.status).toBe('done')

    await app.close()
  })

  it('returns render job including result on status endpoint', async () => {
    prismaMock.renderJob.findUnique.mockResolvedValue({
      id: '55555555-5555-5555-5555-555555555555',
      status: 'done',
      result: {
        id: 'result-5',
        image_url: 'https://example.com/5.png',
      },
    })

    const app = Fastify()
    await app.register(renderJobRoutes, { prefix: '/api/v1' })

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/render-jobs/55555555-5555-5555-5555-555555555555',
    })

    expect(response.statusCode).toBe(200)
    expect(response.json().status).toBe('done')

    await app.close()
  })
})
