import Fastify from 'fastify'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const tenantA = 'tenant-a'
const tenantB = 'tenant-b'
const projectId = 'project-1'
const tourId = 'tour-1'

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    project: {
      findUnique: vi.fn(),
    },
    panoramaTour: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}))

vi.mock('../db.js', () => ({ prisma: prismaMock }))

import { panoramaTourRoutes } from './panoramaTours.js'

function tourFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: tourId,
    tenant_id: tenantA,
    project_id: projectId,
    name: 'Standardtour',
    points_json: [],
    share_token: null,
    expires_at: null,
    created_at: '2026-03-04T02:20:00.000Z',
    updated_at: '2026-03-04T02:20:00.000Z',
    ...overrides,
  }
}

async function createApp() {
  const app = Fastify()
  app.decorateRequest('tenantId', null)
  app.decorateRequest('branchId', null)
  app.addHook('preHandler', async (request) => {
    request.tenantId = tenantA
  })
  await app.register(panoramaTourRoutes, { prefix: '/api/v1' })
  return app
}

describe('panoramaTourRoutes', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    prismaMock.project.findUnique.mockResolvedValue({ id: projectId, tenant_id: tenantA })
    prismaMock.panoramaTour.findMany.mockResolvedValue([tourFixture()])
    prismaMock.panoramaTour.findUnique.mockResolvedValue(tourFixture())
    prismaMock.panoramaTour.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => tourFixture(data))
    prismaMock.panoramaTour.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => tourFixture(data))
    prismaMock.panoramaTour.delete.mockResolvedValue(tourFixture())
  })

  it('GET /projects/:id/panorama-tours lists tours', async () => {
    const app = await createApp()

    const res = await app.inject({ method: 'GET', url: `/api/v1/projects/${projectId}/panorama-tours` })

    expect(res.statusCode).toBe(200)
    expect(Array.isArray(res.json())).toBe(true)
    await app.close()
  })

  it('POST /projects/:id/panorama-tours creates tour', async () => {
    const app = await createApp()

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/panorama-tours`,
      payload: {
        name: 'Kundentour',
        points_json: [
          {
            id: 'p1',
            label: 'Eingang',
            camera: { x: 0, y: 1.6, z: 0, yaw: 90, pitch: 0 },
            hotspots: [],
          },
        ],
      },
    })

    expect(res.statusCode).toBe(201)
    expect(res.json()).toMatchObject({ name: 'Kundentour' })
    await app.close()
  })

  it('POST /projects/:id/panorama-tours rejects foreign-tenant project', async () => {
    prismaMock.project.findUnique.mockResolvedValue({ id: projectId, tenant_id: tenantB })
    const app = await createApp()

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/panorama-tours`,
      payload: {
        name: 'Kundentour',
        points_json: [],
      },
    })

    expect(res.statusCode).toBe(404)
    await app.close()
  })

  it('PUT /panorama-tours/:id enforces tenant ownership', async () => {
    prismaMock.panoramaTour.findUnique.mockResolvedValue(tourFixture({ tenant_id: tenantB }))
    const app = await createApp()

    const res = await app.inject({
      method: 'PUT',
      url: `/api/v1/panorama-tours/${tourId}`,
      payload: {
        name: 'Updated',
        points_json: [],
      },
    })

    expect(res.statusCode).toBe(404)
    await app.close()
  })

  it('POST /panorama-tours/:id/share returns token and share url', async () => {
    const app = await createApp()

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/panorama-tours/${tourId}/share`,
      payload: { expires_in_days: 7 },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({
      share_token: expect.any(String),
      share_url: expect.stringContaining('/share/panorama/'),
    })
    await app.close()
  })

  it('GET /share/panorama/:token returns 410 for expired token', async () => {
    prismaMock.panoramaTour.findUnique.mockResolvedValue(
      tourFixture({
        share_token: 'expired-token',
        expires_at: new Date(Date.now() - 24 * 60 * 60 * 1000),
      }),
    )

    const app = await createApp()
    const res = await app.inject({ method: 'GET', url: '/api/v1/share/panorama/expired-token' })

    expect(res.statusCode).toBe(410)
    await app.close()
  })
})
