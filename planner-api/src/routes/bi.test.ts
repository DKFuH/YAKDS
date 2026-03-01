import Fastify from 'fastify'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const TENANT_ID = '00000000-0000-0000-0000-000000000001'

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    project: { findMany: vi.fn() },
    quote: { findMany: vi.fn() },
    quoteItem: { findMany: vi.fn() },
    tenant: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn() },
    branch: { findMany: vi.fn(), create: vi.fn() },
  },
}))

vi.mock('../db.js', () => ({ prisma: prismaMock }))

import { tenantMiddleware } from '../tenantMiddleware.js'
import { biRoutes } from './bi.js'

function makeApp() {
  const app = Fastify()
  app.register(async (instance) => {
    await tenantMiddleware(instance)
    await biRoutes(instance)
  })
  return app
}

describe('biRoutes', () => {
  beforeEach(() => vi.clearAllMocks())

  it('GET /bi/summary returns 403 without tenant header', async () => {
    const app = makeApp()
    const res = await app.inject({ method: 'GET', url: '/bi/summary' })
    expect(res.statusCode).toBe(403)
    await app.close()
  })

  it('GET /bi/summary returns KPI summary for tenant', async () => {
    prismaMock.project.findMany.mockResolvedValue([
      { id: 'p1', lead_status: 'won', quote_value: 5000, quotes: [] },
      {
        id: 'p2',
        lead_status: 'quoted',
        quote_value: 3000,
        quotes: [{ id: 'q1', status: 'sent', price_snapshot: null, created_at: new Date().toISOString() }],
      },
    ])

    const app = makeApp()
    const res = await app.inject({
      method: 'GET',
      url: '/bi/summary',
      headers: { 'x-tenant-id': TENANT_ID },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.projects.total).toBe(2)
    expect(body.projects.won).toBe(1)
    expect(body.value.total_net).toBe(8000)
    await app.close()
  })

  it('GET /bi/quotes returns quote list', async () => {
    prismaMock.quote.findMany.mockResolvedValue([
      {
        id: 'q1',
        quote_number: 'Q-001',
        status: 'sent',
        valid_until: null,
        created_at: new Date().toISOString(),
        project: { id: 'p1', name: 'Projekt 1', lead_status: 'quoted', tenant_id: TENANT_ID },
        items: [{ line_net: 1200, line_gross: 1428 }],
      },
    ])

    const app = makeApp()
    const res = await app.inject({
      method: 'GET',
      url: '/bi/quotes',
      headers: { 'x-tenant-id': TENANT_ID },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.count).toBe(1)
    expect(body.quotes[0].total_net).toBe(1200)
    await app.close()
  })

  it('GET /bi/products groups items by type sorted by revenue', async () => {
    prismaMock.quoteItem.findMany.mockResolvedValue([
      { type: 'cabinet', description: 'Unterschrank', qty: 1, line_net: 600 },
      { type: 'cabinet', description: 'Hängeschrank', qty: 1, line_net: 300 },
      { type: 'freight', description: 'Frachtpauschale', qty: 1, line_net: 89 },
    ])

    const app = makeApp()
    const res = await app.inject({
      method: 'GET',
      url: '/bi/products',
      headers: { 'x-tenant-id': TENANT_ID },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.total_items).toBe(3)
    expect(body.by_type).toHaveLength(2)
    expect(body.by_type[0].type).toBe('cabinet')
    expect(body.by_type[0].revenue_net).toBe(900)
    await app.close()
  })

  it('GET /tenants returns tenant list for the requesting tenant', async () => {
    prismaMock.tenant.findUnique.mockResolvedValue(
      { id: TENANT_ID, name: 'Studio Nord', _count: { branches: 2, users: 5, projects: 10 } },
    )

    const app = makeApp()
    const res = await app.inject({
      method: 'GET',
      url: '/tenants',
      headers: { 'x-tenant-id': TENANT_ID },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toHaveLength(1)
    expect(res.json()[0].id).toBe(TENANT_ID)
    await app.close()
  })

  it('GET /tenants returns 403 without tenant header', async () => {
    const app = makeApp()
    const res = await app.inject({ method: 'GET', url: '/tenants' })
    expect(res.statusCode).toBe(403)
    await app.close()
  })

  it('POST /tenants creates a tenant when no tenant scope is set', async () => {
    prismaMock.tenant.create.mockResolvedValue({ id: TENANT_ID, name: 'Studio Süd' })

    const app = makeApp()
    const res = await app.inject({
      method: 'POST',
      url: '/tenants',
      payload: { name: 'Studio Süd' },
    })

    expect(res.statusCode).toBe(201)
    expect(res.json().name).toBe('Studio Süd')
    await app.close()
  })

  it('POST /tenants returns 403 when a tenant scope is already set', async () => {
    const app = makeApp()
    const res = await app.inject({
      method: 'POST',
      url: '/tenants',
      headers: { 'x-tenant-id': TENANT_ID },
      payload: { name: 'Evil Tenant' },
    })
    expect(res.statusCode).toBe(403)
    await app.close()
  })
})
