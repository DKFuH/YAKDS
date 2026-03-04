import Fastify from 'fastify'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const roomId = '33333333-3333-3333-3333-333333333333'
const wallId = '44444444-4444-4444-4444-444444444444'

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    room: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}))

vi.mock('../db.js', () => ({
  prisma: prismaMock,
}))

import { openingRoutes } from './openings.js'

describe('openingRoutes', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    prismaMock.room.findUnique.mockResolvedValue({
      id: roomId,
      openings: [],
      boundary: {
        wall_segments: [{ id: wallId, length_mm: 4000 }],
      },
    })

    prismaMock.room.update.mockImplementation(async ({ data }: { data: { openings: unknown[] } }) => ({
      id: roomId,
      openings: data.openings,
      boundary: {
        wall_segments: [{ id: wallId, length_mm: 4000 }],
      },
    }))
  })

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

  it('creates opening with type radiator', async () => {
    const app = Fastify()
    await app.register(openingRoutes, { prefix: '/api/v1' })

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/rooms/${roomId}/openings`,
      payload: {
        wall_id: wallId,
        type: 'radiator',
        offset_mm: 300,
        width_mm: 900,
        source: 'manual',
      },
    })

    expect(response.statusCode).toBe(201)
    expect(response.json()).toMatchObject({
      wall_id: wallId,
      type: 'radiator',
      offset_mm: 300,
      width_mm: 900,
    })

    await app.close()
  })

  it('creates opening with type niche and wall_offset_depth_mm', async () => {
    const app = Fastify()
    await app.register(openingRoutes, { prefix: '/api/v1' })

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/rooms/${roomId}/openings`,
      payload: {
        wall_id: wallId,
        type: 'niche',
        offset_mm: 1200,
        width_mm: 600,
        wall_offset_depth_mm: 200,
        source: 'manual',
      },
    })

    expect(response.statusCode).toBe(201)
    expect(response.json()).toMatchObject({
      wall_id: wallId,
      type: 'niche',
      wall_offset_depth_mm: 200,
    })

    await app.close()
  })

  it('rejects opening with unknown type', async () => {
    const app = Fastify()
    await app.register(openingRoutes, { prefix: '/api/v1' })

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/rooms/${roomId}/openings`,
      payload: {
        wall_id: wallId,
        type: 'unknown_type',
        offset_mm: 200,
        width_mm: 700,
        source: 'manual',
      },
    })

    expect(response.statusCode).toBe(400)

    await app.close()
  })

  it('validates opening width against computed arc wall length', async () => {
    prismaMock.room.findUnique.mockResolvedValueOnce({
      id: roomId,
      openings: [],
      boundary: {
        wall_segments: [{
          id: wallId,
          kind: 'arc',
          start: { x_mm: 1000, y_mm: 0 },
          end: { x_mm: 0, y_mm: 1000 },
          center: { x_mm: 0, y_mm: 0 },
          radius_mm: 1000,
          clockwise: false,
        }],
      },
    })

    const app = Fastify()
    await app.register(openingRoutes, { prefix: '/api/v1' })

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/rooms/${roomId}/openings`,
      payload: {
        wall_id: wallId,
        type: 'door',
        offset_mm: 1000,
        width_mm: 900,
        source: 'manual',
      },
    })

    expect(response.statusCode).toBe(400)
    await app.close()
  })
})
