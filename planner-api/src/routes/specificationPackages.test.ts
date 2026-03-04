import Fastify from 'fastify'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const tenantA = 'tenant-a'
const tenantB = 'tenant-b'
const projectId = 'project-1'
const packageId = 'pkg-1'

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    project: {
      findUnique: vi.fn(),
    },
    quote: {
      count: vi.fn(),
    },
    room: {
      count: vi.fn(),
    },
    cutlist: {
      count: vi.fn(),
    },
    nestingJob: {
      count: vi.fn(),
    },
    layoutSheet: {
      count: vi.fn(),
    },
    specificationPackage: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}))

vi.mock('../db.js', () => ({ prisma: prismaMock }))

import { specificationPackageRoutes } from './specificationPackages.js'

function packageFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: packageId,
    tenant_id: tenantA,
    project_id: projectId,
    name: 'Werkstattpaket',
    config_json: { sections: ['quote', 'bom', 'cutlist', 'layout_sheets'] },
    generated_at: null,
    artifact_json: {},
    created_at: '2026-03-04T02:45:00.000Z',
    updated_at: '2026-03-04T02:45:00.000Z',
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
  await app.register(specificationPackageRoutes, { prefix: '/api/v1' })
  return app
}

describe('specificationPackageRoutes', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    prismaMock.project.findUnique.mockResolvedValue({ id: projectId, tenant_id: tenantA })
    prismaMock.quote.count.mockResolvedValue(1)
    prismaMock.room.count.mockResolvedValue(1)
    prismaMock.cutlist.count.mockResolvedValue(1)
    prismaMock.nestingJob.count.mockResolvedValue(1)
    prismaMock.layoutSheet.count.mockResolvedValue(1)

    prismaMock.specificationPackage.findMany.mockResolvedValue([packageFixture()])
    prismaMock.specificationPackage.findUnique.mockResolvedValue(packageFixture())
    prismaMock.specificationPackage.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => packageFixture(data))
    prismaMock.specificationPackage.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => packageFixture(data))
    prismaMock.specificationPackage.delete.mockResolvedValue(packageFixture())
  })

  it('creates and lists specification packages', async () => {
    const app = await createApp()

    const createRes = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/specification-packages`,
      payload: { name: 'Vertrieb + Werkstatt' },
    })
    expect(createRes.statusCode).toBe(201)

    const listRes = await app.inject({ method: 'GET', url: `/api/v1/projects/${projectId}/specification-packages` })
    expect(listRes.statusCode).toBe(200)
    expect(Array.isArray(listRes.json())).toBe(true)

    await app.close()
  })

  it('rejects package creation for foreign-tenant project', async () => {
    prismaMock.project.findUnique.mockResolvedValue({ id: projectId, tenant_id: tenantB })
    const app = await createApp()

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/specification-packages`,
      payload: { name: 'Vertrieb + Werkstatt' },
    })

    expect(res.statusCode).toBe(404)
    await app.close()
  })

  it('generates and downloads package pdf', async () => {
    const app = await createApp()

    const generateRes = await app.inject({
      method: 'POST',
      url: `/api/v1/specification-packages/${packageId}/generate`,
    })
    expect(generateRes.statusCode).toBe(200)
    expect(generateRes.json()).toMatchObject({ sections: expect.any(Array) })

    const downloadRes = await app.inject({
      method: 'GET',
      url: `/api/v1/specification-packages/${packageId}/download`,
    })
    expect(downloadRes.statusCode).toBe(200)
    expect(downloadRes.headers['content-type']).toContain('application/pdf')

    await app.close()
  })

  it('deletes package', async () => {
    const app = await createApp()

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/specification-packages/${packageId}`,
    })
    expect(res.statusCode).toBe(204)

    await app.close()
  })
})
