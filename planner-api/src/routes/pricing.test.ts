import Fastify from 'fastify'
import { describe, expect, it } from 'vitest'

import { pricingRoutes } from './pricing.js'

function createBomLine() {
  return {
    id: 'line-1',
    project_id: 'project-12',
    type: 'cabinet' as const,
    catalog_item_id: 'cab-60',
    description: 'Cabinet',
    qty: 1,
    unit: 'stk' as const,
    list_price_net: 1000,
    dealer_price_net: 700,
    variant_surcharge: 0,
    object_surcharges: 0,
    position_discount_pct: 0,
    pricing_group_discount_pct: 0,
    line_net_after_discounts: 1000,
    tax_group_id: 'tax-de',
    tax_rate: 0.19,
  }
}

describe('pricingRoutes', () => {
  it('returns a pricing summary for preview requests', async () => {
    const app = Fastify()
    await app.register(pricingRoutes, { prefix: '/api/v1' })

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/pricing/preview',
      payload: {
        bom_lines: [createBomLine()],
        settings: {
          project_id: 'project-12',
          global_discount_pct: 0,
          extra_costs: [],
        },
      },
    })

    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.subtotal_net).toBe(1000)
    expect(body.vat_amount).toBe(190)
    expect(body.total_gross).toBe(1190)

    await app.close()
  })

  it('returns block evaluations and a recommended block', async () => {
    const app = Fastify()
    await app.register(pricingRoutes, { prefix: '/api/v1' })

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/pricing/block-preview',
      payload: {
        price_summary: {
          dealer_price_net: 800,
          subtotal_net: 1200,
          total_purchase_price_net: 1000,
          total_sell_price_net: 1200,
          total_points: 90,
        },
        blocks: [
          {
            id: 'block-purchase',
            name: 'EK Block',
            basis: 'purchase_price',
            tiers: [{ min_value: 900, discount_pct: 8 }],
          },
          {
            id: 'block-sell',
            name: 'VK Block',
            basis: 'sell_price',
            tiers: [{ min_value: 1000, discount_pct: 5 }],
          },
        ],
      },
    })

    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.evaluations).toHaveLength(2)
    expect(body.best_block).toEqual(
      expect.objectContaining({
        block_id: 'block-purchase',
        applied_discount_pct: 8,
        recommended: true,
      }),
    )

    await app.close()
  })

  it('rejects invalid preview payloads', async () => {
    const app = Fastify()
    await app.register(pricingRoutes, { prefix: '/api/v1' })

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/pricing/preview',
      payload: {
        bom_lines: [],
        settings: {
          project_id: 'project-12',
          global_discount_pct: 150,
          extra_costs: [],
        },
      },
    })

    expect(response.statusCode).toBe(400)

    await app.close()
  })

  it('rejects block preview payloads without block definitions', async () => {
    const app = Fastify()
    await app.register(pricingRoutes, { prefix: '/api/v1' })

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/pricing/block-preview',
      payload: {
        price_summary: {
          dealer_price_net: 800,
          subtotal_net: 1200,
        },
        blocks: [],
      },
    })

    expect(response.statusCode).toBe(400)

    await app.close()
  })
})
