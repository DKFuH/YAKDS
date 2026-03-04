import Fastify from 'fastify'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    project: { findUnique: vi.fn() },
    tenantSetting: { findUnique: vi.fn() },
    panoramaTour: { findMany: vi.fn() },
  },
}))

vi.mock('../db.js', () => ({
  prisma: prismaMock,
}))

import { presentationRoutes } from './presentation.js'

describe('presentationRoutes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function buildAppWithTenant(tenantId = 'tenant-a') {
    const app = Fastify()
    app.addHook('preHandler', async (request) => {
      request.tenantId = tenantId
    })
    return app
  }

  it('returns presentation session payload with branding and preferred panorama entry', async () => {
    prismaMock.project.findUnique.mockResolvedValue({
      id: '11111111-1111-1111-1111-111111111111',
      name: 'Showroom Küche',
      tenant_id: 'tenant-a',
    })
    prismaMock.tenantSetting.findUnique.mockResolvedValue({
      company_name: 'Muster Schreinerei',
      company_city: 'Münster',
      company_web: 'https://muster.example',
      logo_url: 'https://muster.example/logo.png',
    })
    prismaMock.panoramaTour.findMany.mockResolvedValue([
      {
        id: '22222222-2222-2222-2222-222222222222',
        name: 'Tour Nord',
        share_token: 'share-222',
        updated_at: new Date('2026-03-01T10:00:00.000Z'),
      },
    ])

    const app = buildAppWithTenant()
    await app.register(presentationRoutes, { prefix: '/api/v1' })

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/projects/11111111-1111-1111-1111-111111111111/presentation-sessions',
      payload: {},
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual(
      expect.objectContaining({
        project_name: 'Showroom Küche',
        branding: expect.objectContaining({
          company_name: 'Muster Schreinerei',
          company_city: 'Münster',
        }),
        preferred_entry: {
          kind: 'panorama-tour',
          panorama_tour_id: '22222222-2222-2222-2222-222222222222',
        },
      }),
    )

    await app.close()
  })

  it('falls back to split-view when no panorama tours exist', async () => {
    prismaMock.project.findUnique.mockResolvedValue({
      id: '11111111-1111-1111-1111-111111111111',
      name: 'Projekt B',
      tenant_id: 'tenant-a',
    })
    prismaMock.tenantSetting.findUnique.mockResolvedValue(null)
    prismaMock.panoramaTour.findMany.mockResolvedValue([])

    const app = buildAppWithTenant()
    await app.register(presentationRoutes, { prefix: '/api/v1' })

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/projects/11111111-1111-1111-1111-111111111111/presentation-sessions',
      payload: { entry: 'auto' },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json().preferred_entry).toEqual({ kind: 'split-view' })

    await app.close()
  })

  it('honors explicit split-view entry request', async () => {
    prismaMock.project.findUnique.mockResolvedValue({
      id: '11111111-1111-1111-1111-111111111111',
      name: 'Projekt C',
      tenant_id: 'tenant-a',
    })
    prismaMock.tenantSetting.findUnique.mockResolvedValue(null)
    prismaMock.panoramaTour.findMany.mockResolvedValue([
      {
        id: '33333333-3333-3333-3333-333333333333',
        name: 'Tour Süd',
        share_token: null,
        updated_at: new Date('2026-03-01T10:00:00.000Z'),
      },
    ])

    const app = buildAppWithTenant()
    await app.register(presentationRoutes, { prefix: '/api/v1' })

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/projects/11111111-1111-1111-1111-111111111111/presentation-sessions',
      payload: { entry: 'split-view' },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json().preferred_entry).toEqual({ kind: 'split-view' })

    await app.close()
  })

  it('returns not found when project is outside tenant scope', async () => {
    prismaMock.project.findUnique.mockResolvedValue({
      id: '11111111-1111-1111-1111-111111111111',
      name: 'Fremdprojekt',
      tenant_id: 'tenant-b',
    })

    const app = buildAppWithTenant('tenant-a')
    await app.register(presentationRoutes, { prefix: '/api/v1' })

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/projects/11111111-1111-1111-1111-111111111111/presentation-sessions',
      payload: {},
    })

    expect(response.statusCode).toBe(404)

    await app.close()
  })

  it('returns forbidden when tenant scope is missing', async () => {
    const app = Fastify()
    await app.register(presentationRoutes, { prefix: '/api/v1' })

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/projects/11111111-1111-1111-1111-111111111111/presentation-sessions',
      payload: {},
    })

    expect(response.statusCode).toBe(403)

    await app.close()
  })
})
