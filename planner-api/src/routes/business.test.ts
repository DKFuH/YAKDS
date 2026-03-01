import Fastify from 'fastify'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { prismaMock } = vi.hoisted(() => {
  const mock = {
    project: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    customerPriceList: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    customerDiscount: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    projectLineItem: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    $transaction: vi.fn(),
  }
  // Make $transaction execute the callback with the mock as tx
  mock.$transaction.mockImplementation(async (cb: (tx: typeof mock) => Promise<unknown>) => cb(mock))
  return { prismaMock: mock }
})

vi.mock('../db.js', () => ({
  prisma: prismaMock,
}))

import { businessRoutes } from './business.js'

const fetchMock = vi.fn()

const projectId = '77777777-7777-7777-7777-777777777777'

const businessProject = {
  id: projectId,
  user_id: '11111111-1111-1111-1111-111111111111',
  name: 'Projekt Alpha',
  description: 'Kuechenprojekt fuer Vertrieb',
  status: 'active',
  lead_status: 'quoted',
  quote_value: 18500,
  close_probability: 65,
  created_at: new Date('2026-03-01T00:00:00.000Z'),
  updated_at: new Date('2026-03-01T12:00:00.000Z'),
  customer_price_lists: [
    {
      id: '88888888-8888-8888-8888-888888888888',
      project_id: projectId,
      name: 'VIP Preisliste',
      price_adjustment_pct: -8,
      notes: 'Sonderkondition',
      created_at: new Date('2026-03-01T00:00:00.000Z'),
      updated_at: new Date('2026-03-01T00:00:00.000Z'),
    },
  ],
  customer_discounts: [
    {
      id: '99999999-9999-9999-9999-999999999999',
      project_id: projectId,
      label: 'Fruehjahrsrabatt',
      discount_pct: 5,
      scope: 'project',
      created_at: new Date('2026-03-01T00:00:00.000Z'),
      updated_at: new Date('2026-03-01T00:00:00.000Z'),
    },
  ],
  project_line_items: [
    {
      id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      project_id: projectId,
      source_type: 'manual',
      description: 'Montage',
      qty: 2,
      unit: 'pauschal',
      unit_price_net: 700,
      tax_rate: 0.19,
      line_net: 1400,
      created_at: new Date('2026-03-01T00:00:00.000Z'),
      updated_at: new Date('2026-03-01T00:00:00.000Z'),
    },
  ],
}

describe('businessRoutes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockResolvedValue({ ok: true, status: 202 })
    prismaMock.customerPriceList.deleteMany.mockResolvedValue({ count: 1 })
    prismaMock.customerPriceList.createMany.mockResolvedValue({ count: 1 })
    prismaMock.customerDiscount.deleteMany.mockResolvedValue({ count: 1 })
    prismaMock.customerDiscount.createMany.mockResolvedValue({ count: 1 })
    prismaMock.projectLineItem.deleteMany.mockResolvedValue({ count: 1 })
    prismaMock.projectLineItem.createMany.mockResolvedValue({ count: 1 })
    prismaMock.project.update.mockResolvedValue({ id: projectId })
  })

  it('returns a project business summary', async () => {
    prismaMock.project.findUnique.mockResolvedValue(businessProject)

    const app = Fastify()
    await app.register(businessRoutes, { prefix: '/api/v1' })

    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectId}/business-summary`,
    })

    expect(response.statusCode).toBe(200)
    expect(response.json().project.lead_status).toBe('quoted')
    expect(response.json().totals.project_line_items_net).toBe(1400)

    await app.close()
  })

  it('updates business settings and related business tables', async () => {
    prismaMock.project.findUnique
      .mockResolvedValueOnce({ id: projectId })
      .mockResolvedValueOnce({
        ...businessProject,
        lead_status: 'won',
        quote_value: 22000,
        close_probability: 90,
      })

    const app = Fastify()
    await app.register(businessRoutes, { prefix: '/api/v1' })

    const response = await app.inject({
      method: 'PUT',
      url: `/api/v1/projects/${projectId}/business-summary`,
      payload: {
        lead_status: 'won',
        quote_value: 22000,
        close_probability: 90,
        customer_price_lists: [
          {
            name: 'VIP Preisliste',
            price_adjustment_pct: -10,
            notes: 'Abschlusskondition',
          },
        ],
        customer_discounts: [
          {
            label: 'Aktionsrabatt',
            discount_pct: 7.5,
            scope: 'project',
          },
        ],
        project_line_items: [
          {
            source_type: 'manual',
            description: 'Montage',
            qty: 3,
            unit: 'pauschal',
            unit_price_net: 800,
            tax_rate: 0.19,
          },
        ],
      },
    })

    expect(response.statusCode).toBe(200)
    expect(prismaMock.project.update).toHaveBeenCalledWith({
      where: { id: projectId },
      data: {
        lead_status: 'won',
        quote_value: 22000,
        close_probability: 90,
      },
    })
    expect(prismaMock.projectLineItem.createMany).toHaveBeenCalledWith({
      data: [
        {
          project_id: projectId,
          source_type: 'manual',
          description: 'Montage',
          qty: 3,
          unit: 'pauschal',
          unit_price_net: 800,
          tax_rate: 0.19,
          line_net: 2400,
        },
      ],
    })

    await app.close()
  })

  it('exports a project business snapshot as json', async () => {
    prismaMock.project.findUnique.mockResolvedValue(businessProject)

    const app = Fastify()
    await app.register(businessRoutes, { prefix: '/api/v1' })

    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectId}/export/json`,
    })

    expect(response.statusCode).toBe(200)
    expect(response.json().format).toBe('json')
    expect(response.json().data.customer_discounts).toHaveLength(1)

    await app.close()
  })

  it('exports a project business snapshot as csv', async () => {
    prismaMock.project.findUnique.mockResolvedValue(businessProject)

    const app = Fastify()
    await app.register(businessRoutes, { prefix: '/api/v1' })

    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectId}/export/csv`,
    })

    expect(response.statusCode).toBe(200)
    expect(response.headers['content-type']).toContain('text/csv')
    expect(response.body).toContain('Montage')

    await app.close()
  })

  it('delivers a project business snapshot to a webhook', async () => {
    prismaMock.project.findUnique.mockResolvedValue(businessProject)

    const app = Fastify()
    await app.register(businessRoutes, { prefix: '/api/v1' })

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/export/webhook`,
      payload: {
        target_url: 'https://example.com/hooks/business',
        event: 'project.business.exported',
      },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json().delivered).toBe(true)
    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.com/hooks/business',
      expect.objectContaining({
        method: 'POST',
      }),
    )

    await app.close()
  })
})
