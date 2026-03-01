import Fastify from 'fastify'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    manufacturer: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    catalogArticle: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    articlePrice: { create: vi.fn() },
    articleOption: { create: vi.fn() },
    articleVariant: { create: vi.fn() },
    generatedItem: { create: vi.fn() },
  },
}))

vi.mock('../db.js', () => ({ prisma: prismaMock }))

import { manufacturerRoutes } from './manufacturers.js'

describe('manufacturerRoutes', () => {
  beforeEach(() => vi.clearAllMocks())

  it('GET /manufacturers returns list', async () => {
    prismaMock.manufacturer.findMany.mockResolvedValue([
      { id: 'mfr-1', name: 'Acme Küchen', code: 'ACME', created_at: new Date().toISOString() },
    ])
    const app = Fastify()
    await app.register(manufacturerRoutes, { prefix: '/api/v1' })

    const res = await app.inject({ method: 'GET', url: '/api/v1/manufacturers' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual(expect.arrayContaining([expect.objectContaining({ name: 'Acme Küchen' })]))
    await app.close()
  })

  it('POST /manufacturers creates a manufacturer', async () => {
    const created = { id: 'mfr-2', name: 'Test GmbH', code: 'TEST', created_at: new Date().toISOString() }
    prismaMock.manufacturer.create.mockResolvedValue(created)
    const app = Fastify()
    await app.register(manufacturerRoutes, { prefix: '/api/v1' })

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/manufacturers',
      payload: { name: 'Test GmbH', code: 'TEST' },
    })
    expect(res.statusCode).toBe(201)
    expect(res.json()).toMatchObject({ name: 'Test GmbH' })
    await app.close()
  })

  it('GET /manufacturers/:id/articles returns articles for manufacturer', async () => {
    const mfrId = '4003d506-698f-431c-9945-8c014606774c'
    prismaMock.catalogArticle.findMany.mockResolvedValue([
      { id: 'art-1', manufacturer_id: mfrId, sku: 'US60', name: 'Unterschrank 60', article_type: 'cabinet' },
    ])
    const app = Fastify()
    await app.register(manufacturerRoutes, { prefix: '/api/v1' })

    const res = await app.inject({ method: 'GET', url: `/api/v1/manufacturers/${mfrId}/articles` })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual(expect.arrayContaining([expect.objectContaining({ sku: 'US60' })]))
    await app.close()
  })

  it('DELETE /manufacturers/:id returns 204', async () => {
    const mfrId = '4003d506-698f-431c-9945-8c014606774c'
    prismaMock.manufacturer.delete.mockResolvedValue({ id: mfrId })
    const app = Fastify()
    await app.register(manufacturerRoutes, { prefix: '/api/v1' })

    const res = await app.inject({ method: 'DELETE', url: `/api/v1/manufacturers/${mfrId}` })
    expect(res.statusCode).toBe(204)
    await app.close()
  })
})
