import Fastify from 'fastify'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    project: { findUnique: vi.fn() },
    quote: { findFirst: vi.fn(), create: vi.fn(), findUnique: vi.fn() },
    quoteSettings: { findUnique: vi.fn() },
  },
}))

vi.mock('../db.js', () => ({
  prisma: prismaMock,
}))

import { quoteRoutes } from './quotes.js'

describe('quoteRoutes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates a new quote with incremented version and items', async () => {
    prismaMock.project.findUnique.mockResolvedValue({ id: '11111111-1111-1111-1111-111111111111' })
    prismaMock.quote.findFirst.mockResolvedValue({ version: 2 })
    prismaMock.quoteSettings.findUnique.mockResolvedValue({
      quote_number_prefix: 'ANG',
      default_validity_days: 30,
      default_free_text: 'Standardtext',
      default_footer_text: 'Standardfuss',
    })
    prismaMock.quote.create.mockResolvedValue({
      id: '22222222-2222-2222-2222-222222222222',
      project_id: '11111111-1111-1111-1111-111111111111',
      version: 3,
      quote_number: 'ANG-2026-0003',
      status: 'draft',
      valid_until: new Date('2026-03-31T00:00:00.000Z'),
      free_text: 'Standardtext',
      footer_text: 'Standardfuss',
      price_snapshot: { total_gross: 999 },
      created_at: new Date('2026-03-01T00:00:00.000Z'),
      items: [
        {
          id: 'it-1',
          quote_id: '22222222-2222-2222-2222-222222222222',
          position: 1,
          type: 'cabinet',
          description: 'Unterschrank 60',
          qty: 1,
          unit: 'stk',
          unit_price_net: 500,
          line_net: 500,
          tax_rate: 0.19,
          line_gross: 595,
          notes: null,
          show_on_quote: true,
        },
      ],
    })

    const app = Fastify()
    await app.register(quoteRoutes, { prefix: '/api/v1' })

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/projects/11111111-1111-1111-1111-111111111111/create-quote',
      payload: {
        bom_lines: [
          {
            type: 'cabinet',
            description: 'Unterschrank 60',
            qty: 1,
            unit: 'stk',
            line_net_after_discounts: 500,
            tax_rate: 0.19,
          },
        ],
        price_summary: { total_gross: 999 },
      },
    })

    expect(response.statusCode).toBe(201)
    const body = response.json()
    expect(body.version).toBe(3)
    expect(body.items).toHaveLength(1)

    expect(prismaMock.quote.create).toHaveBeenCalledTimes(1)
    expect(prismaMock.quote.create.mock.calls[0][0].data.quote_number).toContain('ANG-')

    await app.close()
  })

  it('returns quote by id', async () => {
    prismaMock.quote.findUnique.mockResolvedValue({
      id: '33333333-3333-3333-3333-333333333333',
      project_id: '11111111-1111-1111-1111-111111111111',
      version: 1,
      quote_number: 'ANG-2026-0001',
      items: [],
    })

    const app = Fastify()
    await app.register(quoteRoutes, { prefix: '/api/v1' })

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/quotes/33333333-3333-3333-3333-333333333333',
    })

    expect(response.statusCode).toBe(200)
    expect(response.json().id).toBe('33333333-3333-3333-3333-333333333333')

    await app.close()
  })

  it('returns pdf url for export endpoint', async () => {
    prismaMock.quote.findUnique.mockResolvedValue({
      id: '44444444-4444-4444-4444-444444444444',
      project_id: '11111111-1111-1111-1111-111111111111',
      version: 4,
    })

    const app = Fastify()
    await app.register(quoteRoutes, { prefix: '/api/v1' })

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/quotes/44444444-4444-4444-4444-444444444444/export-pdf',
    })

    expect(response.statusCode).toBe(200)
    expect(response.json().pdf_url).toBe('/api/v1/quotes/44444444-4444-4444-4444-444444444444/pdf/quote-v4.pdf')

    await app.close()
  })
})
