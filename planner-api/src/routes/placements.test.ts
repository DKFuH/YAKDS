import Fastify from 'fastify'
import { beforeEach, describe, expect, it, vi } from 'vitest'

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

import { placementRoutes } from './placements.js'

const roomId = 'room-1'

function createRoom(overrides: Record<string, unknown> = {}) {
  return {
    id: roomId,
    boundary: {
      vertices: [
        { id: 'v1', x_mm: 0, y_mm: 0 },
        { id: 'v2', x_mm: 4000, y_mm: 0 },
      ],
      wall_segments: [
        {
          id: 'wall-1',
          start_vertex_id: 'v1',
          end_vertex_id: 'v2',
        },
      ],
    },
    openings: [],
    placements: [],
    ...overrides,
  }
}

describe('placementRoutes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('lists all placements for a room', async () => {
    prismaMock.room.findUnique.mockResolvedValue(
      createRoom({
        placements: [
          {
            id: 'placement-1',
            catalog_item_id: 'catalog-1',
            wall_id: 'wall-1',
            offset_mm: 100,
            width_mm: 600,
            depth_mm: 560,
            height_mm: 720,
          },
        ],
      }),
    )

    const app = Fastify()
    await app.register(placementRoutes, { prefix: '/api/v1' })

    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/rooms/${roomId}/placements`,
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toHaveLength(1)

    await app.close()
  })

  it('creates a placement when wall, openings and siblings allow it', async () => {
    prismaMock.room.findUnique.mockResolvedValue(createRoom())
    prismaMock.room.update.mockResolvedValue({})

    const app = Fastify()
    await app.register(placementRoutes, { prefix: '/api/v1' })

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/rooms/${roomId}/placements`,
      payload: {
        catalog_item_id: 'catalog-1',
        wall_id: 'wall-1',
        offset_mm: 100,
        width_mm: 600,
        depth_mm: 560,
        height_mm: 720,
      },
    })

    expect(response.statusCode).toBe(201)
    expect(response.json()).toEqual(
      expect.objectContaining({
        catalog_item_id: 'catalog-1',
        wall_id: 'wall-1',
        offset_mm: 100,
      }),
    )
    expect(prismaMock.room.update).toHaveBeenCalledTimes(1)

    await app.close()
  })

  it('rejects placements that overlap existing placements', async () => {
    prismaMock.room.findUnique.mockResolvedValue(
      createRoom({
        placements: [
          {
            id: 'placement-existing',
            catalog_item_id: 'catalog-2',
            wall_id: 'wall-1',
            offset_mm: 500,
            width_mm: 700,
            depth_mm: 560,
            height_mm: 720,
          },
        ],
      }),
    )

    const app = Fastify()
    await app.register(placementRoutes, { prefix: '/api/v1' })

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/rooms/${roomId}/placements`,
      payload: {
        catalog_item_id: 'catalog-1',
        wall_id: 'wall-1',
        offset_mm: 900,
        width_mm: 600,
        depth_mm: 560,
        height_mm: 720,
      },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json()).toEqual({
      error: 'BAD_REQUEST',
      message: 'Placement overlaps with existing placement placement-existing.',
    })
    expect(prismaMock.room.update).not.toHaveBeenCalled()

    await app.close()
  })

  it('rejects placements that overlap openings', async () => {
    prismaMock.room.findUnique.mockResolvedValue(
      createRoom({
        openings: [
          {
            id: 'opening-1',
            wall_id: 'wall-1',
            offset_mm: 700,
            width_mm: 900,
          },
        ],
      }),
    )

    const app = Fastify()
    await app.register(placementRoutes, { prefix: '/api/v1' })

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/rooms/${roomId}/placements`,
      payload: {
        catalog_item_id: 'catalog-1',
        wall_id: 'wall-1',
        offset_mm: 1000,
        width_mm: 600,
        depth_mm: 560,
        height_mm: 720,
      },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json()).toEqual({
      error: 'BAD_REQUEST',
      message: 'Placement overlaps with opening opening-1.',
    })
    expect(prismaMock.room.update).not.toHaveBeenCalled()

    await app.close()
  })

  it('deletes a placement from the room payload', async () => {
    prismaMock.room.findUnique.mockResolvedValue(
      createRoom({
        placements: [
          {
            id: 'placement-1',
            catalog_item_id: 'catalog-1',
            wall_id: 'wall-1',
            offset_mm: 100,
            width_mm: 600,
            depth_mm: 560,
            height_mm: 720,
          },
          {
            id: 'placement-2',
            catalog_item_id: 'catalog-2',
            wall_id: 'wall-1',
            offset_mm: 900,
            width_mm: 600,
            depth_mm: 560,
            height_mm: 720,
          },
        ],
      }),
    )
    prismaMock.room.update.mockResolvedValue({})

    const app = Fastify()
    await app.register(placementRoutes, { prefix: '/api/v1' })

    const response = await app.inject({
      method: 'DELETE',
      url: `/api/v1/rooms/${roomId}/placements/placement-1`,
    })

    expect(response.statusCode).toBe(204)
    expect(prismaMock.room.update).toHaveBeenCalledWith({
      where: { id: roomId },
      data: {
        placements: [
          {
            id: 'placement-2',
            catalog_item_id: 'catalog-2',
            wall_id: 'wall-1',
            offset_mm: 900,
            width_mm: 600,
            depth_mm: 560,
            height_mm: 720,
          },
        ],
      },
    })

    await app.close()
  })

  it('replaces all placements for a room via batch put', async () => {
    prismaMock.room.findUnique.mockResolvedValue(
      createRoom({
        openings: [
          {
            id: 'opening-1',
            wall_id: 'wall-1',
            offset_mm: 2500,
            width_mm: 500,
          },
        ],
        placements: [
          {
            id: 'placement-1',
            catalog_item_id: 'catalog-1',
            wall_id: 'wall-1',
            offset_mm: 100,
            width_mm: 600,
            depth_mm: 560,
            height_mm: 720,
          },
        ],
      }),
    )
    prismaMock.room.update.mockResolvedValue({})

    const app = Fastify()
    await app.register(placementRoutes, { prefix: '/api/v1' })

    const payload = {
      placements: [
        {
          id: 'placement-1',
          catalog_item_id: 'catalog-1',
          wall_id: 'wall-1',
          offset_mm: 300,
          width_mm: 600,
          depth_mm: 560,
          height_mm: 720,
        },
        {
          id: 'placement-2',
          catalog_item_id: 'catalog-2',
          wall_id: 'wall-1',
          offset_mm: 1200,
          width_mm: 800,
          depth_mm: 600,
          height_mm: 2100,
        },
      ],
    }

    const response = await app.inject({
      method: 'PUT',
      url: `/api/v1/rooms/${roomId}/placements`,
      payload,
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual(payload.placements)
    expect(prismaMock.room.update).toHaveBeenCalledWith({
      where: { id: roomId },
      data: {
        placements: payload.placements,
      },
    })

    await app.close()
  })

  it('rejects invalid batch placement updates', async () => {
    prismaMock.room.findUnique.mockResolvedValue(createRoom())

    const app = Fastify()
    await app.register(placementRoutes, { prefix: '/api/v1' })

    const response = await app.inject({
      method: 'PUT',
      url: `/api/v1/rooms/${roomId}/placements`,
      payload: {
        placements: [
          {
            id: 'placement-1',
            catalog_item_id: 'catalog-1',
            wall_id: 'wall-1',
            offset_mm: 100,
            width_mm: 900,
            depth_mm: 560,
            height_mm: 720,
          },
          {
            id: 'placement-2',
            catalog_item_id: 'catalog-2',
            wall_id: 'wall-1',
            offset_mm: 800,
            width_mm: 900,
            depth_mm: 560,
            height_mm: 720,
          },
        ],
      },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json()).toEqual({
      error: 'BAD_REQUEST',
      message: 'Placement overlaps with existing placement placement-2.',
    })
    expect(prismaMock.room.update).not.toHaveBeenCalled()

    await app.close()
  })

  it('updates a single placement by id', async () => {
    prismaMock.room.findUnique.mockResolvedValue(
      createRoom({
        placements: [
          {
            id: 'placement-1',
            catalog_item_id: 'catalog-1',
            wall_id: 'wall-1',
            offset_mm: 100,
            width_mm: 600,
            depth_mm: 560,
            height_mm: 720,
          },
          {
            id: 'placement-2',
            catalog_item_id: 'catalog-2',
            wall_id: 'wall-1',
            offset_mm: 1200,
            width_mm: 700,
            depth_mm: 560,
            height_mm: 720,
          },
        ],
      }),
    )
    prismaMock.room.update.mockResolvedValue({})

    const app = Fastify()
    await app.register(placementRoutes, { prefix: '/api/v1' })

    const response = await app.inject({
      method: 'PUT',
      url: `/api/v1/rooms/${roomId}/placements/placement-1`,
      payload: {
        id: 'placement-1',
        catalog_item_id: 'catalog-1',
        wall_id: 'wall-1',
        offset_mm: 250,
        width_mm: 600,
        depth_mm: 560,
        height_mm: 720,
      },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({
      id: 'placement-1',
      catalog_item_id: 'catalog-1',
      wall_id: 'wall-1',
      offset_mm: 250,
      width_mm: 600,
      depth_mm: 560,
      height_mm: 720,
    })
    expect(prismaMock.room.update).toHaveBeenCalledTimes(1)

    await app.close()
  })

  it('rejects single-placement updates with mismatched ids', async () => {
    prismaMock.room.findUnique.mockResolvedValue(createRoom())

    const app = Fastify()
    await app.register(placementRoutes, { prefix: '/api/v1' })

    const response = await app.inject({
      method: 'PUT',
      url: `/api/v1/rooms/${roomId}/placements/placement-1`,
      payload: {
        id: 'placement-2',
        catalog_item_id: 'catalog-1',
        wall_id: 'wall-1',
        offset_mm: 250,
        width_mm: 600,
        depth_mm: 560,
        height_mm: 720,
      },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json()).toEqual({
      error: 'BAD_REQUEST',
      message: 'Placement id in payload must match route parameter.',
    })

    await app.close()
  })
})
