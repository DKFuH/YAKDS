import Fastify from 'fastify'
import { describe, expect, it, vi } from 'vitest'
import { ofmlImportRoutes } from './orders.js'

// ─── Minimal helpers ─────────────────────────────────────────────

async function createApp() {
  const app = Fastify()
  await app.register(ofmlImportRoutes, { prefix: '/api/v1' })
  return app
}

// ─── /import/ocd ─────────────────────────────────────────────────

const VALID_OCD_XML = `<?xml version="1.0" encoding="UTF-8"?>
<OCD>
  <ARTICLE ArticleID="ART-001" CompositeID="NOBILIA:BASE:ART-001" Description="Unterschrank 60cm" Manufacturer="NOBILIA" Series="BASE">
    <PRICE_TABLE PriceValue="349.90" Currency="EUR" TaxType="standard" />
  </ARTICLE>
</OCD>`

describe('ordersRoutes – POST /api/v1/import/ocd', () => {
  it('parses a valid OCD XML and returns articles and prices', async () => {
    const app = await createApp()
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/import/ocd',
      payload: { xml: VALID_OCD_XML },
    })

    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.articles).toHaveLength(1)
    expect(body.articles[0].article_id).toBe('ART-001')
    expect(body.articles[0].prices[0].price_value).toBe(349.9)
    expect(body.parsed_at).toBeDefined()
  })

  it('returns 400 when xml field is missing', async () => {
    const app = await createApp()
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/import/ocd',
      payload: {},
    })

    expect(response.statusCode).toBe(400)
  })

  it('returns 400 when xml field is an empty string', async () => {
    const app = await createApp()
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/import/ocd',
      payload: { xml: '' },
    })

    expect(response.statusCode).toBe(400)
  })
})

// ─── /import/oex-orders ──────────────────────────────────────────

const validOexOrders = [
  {
    order_ref: 'OEX-2026-001',
    supplier_code: 'NOBILIA',
    order_date: '2026-03-05T06:00:00.000Z',
    delivery_date: '2026-04-01T00:00:00.000Z',
    currency: 'EUR',
    lines: [
      {
        position: 1,
        article_id: 'ART-001',
        composite_id: 'NOBILIA:BASE:ART-001',
        description: 'Unterschrank 60cm',
        qty: 2,
        unit: 'stk',
        unit_price_net: 349.9,
        line_net: 699.8,
        tax_type: 'standard',
      },
    ],
  },
]

describe('ordersRoutes – POST /api/v1/import/oex-orders', () => {
  it('accepts valid OEX orders and returns normalised result', async () => {
    const app = await createApp()
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/import/oex-orders',
      payload: { orders: validOexOrders },
    })

    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.source_format).toBe('oex')
    expect(body.orders).toHaveLength(1)
    expect(body.orders[0].order_ref).toBe('OEX-2026-001')
    expect(body.orders[0].lines).toHaveLength(1)
    expect(body.parsed_at).toBeDefined()
  })

  it('returns 400 when orders array is empty', async () => {
    const app = await createApp()
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/import/oex-orders',
      payload: { orders: [] },
    })

    expect(response.statusCode).toBe(400)
  })

  it('returns 400 when orders field is missing', async () => {
    const app = await createApp()
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/import/oex-orders',
      payload: {},
    })

    expect(response.statusCode).toBe(400)
  })

  it('returns 400 when an order has no lines', async () => {
    const app = await createApp()
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/import/oex-orders',
      payload: {
        orders: [
          {
            order_ref: 'OEX-BAD',
            supplier_code: 'NOBILIA',
            currency: 'EUR',
            lines: [],
          },
        ],
      },
    })

    expect(response.statusCode).toBe(400)
  })

  it('accepts orders without optional fields', async () => {
    const app = await createApp()
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/import/oex-orders',
      payload: {
        orders: [
          {
            order_ref: 'OEX-MIN',
            supplier_code: 'SUPPLIER',
            currency: 'EUR',
            lines: [
              {
                position: 1,
                article_id: 'ART-X',
                qty: 1,
              },
            ],
          },
        ],
      },
    })

    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.orders[0].order_ref).toBe('OEX-MIN')
  })
})
