import Fastify from 'fastify'
import { describe, expect, it } from 'vitest'

import { bomRoutes } from './bom.js'

function createProjectSnapshot() {
  return {
    id: 'project-11',
    cabinets: [
      {
        id: 'cab-1',
        catalog_item_id: 'cab-60',
        tax_group_id: 'tax-de',
        flags: {
          requires_customization: false,
          height_variant: null,
          labor_surcharge: false,
          special_trim_needed: true,
        },
      },
    ],
    appliances: [],
    accessories: [],
    priceListItems: [
      { catalog_item_id: 'cab-60', list_price_net: 500, dealer_price_net: 300 },
    ],
    taxGroups: [{ id: 'tax-de', name: 'DE 19%', tax_rate: 0.19 }],
    quoteSettings: {
      freight_flat_rate: 89,
      assembly_rate_per_item: 45,
    },
  }
}

describe('bomRoutes', () => {
  it('returns calculated BOM preview for inline project snapshots', async () => {
    const app = Fastify()
    await app.register(bomRoutes, { prefix: '/api/v1' })

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/bom/preview',
      payload: {
        project: createProjectSnapshot(),
        options: { specialTrimSurchargeNet: 75 },
      },
    })

    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.lines).toHaveLength(3)
    expect(body.totals.total_list_net).toBe(664)
    expect(body.lines.some((line: { type: string; list_price_net: number }) => line.type === 'surcharge' && line.list_price_net === 75)).toBe(true)

    await app.close()
  })

  it('validates malformed requests', async () => {
    const app = Fastify()
    await app.register(bomRoutes, { prefix: '/api/v1' })

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/bom/preview',
      payload: { project: { id: 'broken' } },
    })

    expect(response.statusCode).toBe(400)

    await app.close()
  })
})
