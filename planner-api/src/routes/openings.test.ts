import Fastify from 'fastify'
import { describe, expect, it } from 'vitest'

import { openingRoutes } from './openings.js'

describe('openingRoutes', () => {
  it('validates openings against wall bounds and siblings', async () => {
    const app = Fastify()
    await app.register(openingRoutes, { prefix: '/api/v1' })

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/openings/validate',
      payload: {
        wall: { id: 'wall-1', length_mm: 4000 },
        opening: {
          id: 'opening-1',
          wall_id: 'wall-1',
          offset_mm: 500,
          width_mm: 1000,
          source: 'manual',
        },
        existing_openings: [
          {
            id: 'opening-2',
            wall_id: 'wall-1',
            offset_mm: 1200,
            width_mm: 900,
            source: 'manual',
          },
        ],
      },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({
      valid: false,
      errors: ['Opening overlaps with existing opening opening-2.'],
    })

    await app.close()
  })

  it('detects opening candidates from CAD intervals', async () => {
    const app = Fastify()
    await app.register(openingRoutes, { prefix: '/api/v1' })

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/openings/detect-from-cad',
      payload: {
        wallLength_mm: 4000,
        entities: [
          {
            id: 'line-1',
            layer_id: 'walls',
            type: 'line',
            geometry: {
              type: 'line',
              start: { x_mm: 0, y_mm: 0 },
              end: { x_mm: 1000, y_mm: 0 },
            },
          },
          {
            id: 'line-2',
            layer_id: 'walls',
            type: 'line',
            geometry: {
              type: 'line',
              start: { x_mm: 1800, y_mm: 0 },
              end: { x_mm: 4000, y_mm: 0 },
            },
          },
        ],
      },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({
      candidates: [
        {
          offset_mm: 1000,
          width_mm: 800,
          confidence: 'high',
        },
      ],
    })

    await app.close()
  })
})
