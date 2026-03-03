import Fastify from 'fastify'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const roomId = '11111111-1111-1111-1111-111111111111'
const missingRoomId = '99999999-9999-9999-9999-999999999999'
const dimensionId = '22222222-2222-2222-2222-222222222222'

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    room: {
      findUnique: vi.fn(),
    },
    dimension: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}))

vi.mock('../db.js', () => ({
  prisma: prismaMock,
}))

import { dimensionRoutes } from './dimensions.js'

const roomFixture = {
  id: roomId,
  ceiling_height_mm: 2500,
  boundary: {
    wall_segments: [
      { id: 'wall-1', x0_mm: 0, y0_mm: 0, x1_mm: 3000, y1_mm: 0 },
      { id: 'wall-2', x0_mm: 3000, y0_mm: 0, x1_mm: 3000, y1_mm: 2500 },
      { id: 'wall-3', x0_mm: 3000, y0_mm: 2500, x1_mm: 0, y1_mm: 2500 },
      { id: 'wall-4', x0_mm: 0, y0_mm: 2500, x1_mm: 0, y1_mm: 0 },
    ],
  },
  placements: [
    { id: 'pl-1', wall_id: 'wall-1', offset_mm: 150, width_mm: 600, depth_mm: 560 },
  ],
}

function createDimensionFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: dimensionId,
    room_id: roomId,
    type: 'linear',
    points: [{ x_mm: 0, y_mm: 0 }, { x_mm: 2000, y_mm: 0 }],
    style: { unit: 'mm', offset_mm: 120 },
    label: null,
    created_at: '2026-03-02T09:00:00.000Z',
    updated_at: '2026-03-02T09:00:00.000Z',
    ...overrides,
  }
}

async function createApp() {
  const app = Fastify()
  await app.register(dimensionRoutes, { prefix: '/api/v1' })
  return app
}

describe('dimensionRoutes', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    prismaMock.room.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) => {
      if (where.id === roomId) return roomFixture
      return null
    })

    prismaMock.dimension.create.mockResolvedValue(createDimensionFixture())
    prismaMock.dimension.findMany.mockResolvedValue([createDimensionFixture()])

    prismaMock.dimension.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) => {
      if (where.id === dimensionId) return createDimensionFixture({ id: dimensionId })
      return null
    })

    prismaMock.dimension.delete.mockResolvedValue({ id: dimensionId })
    prismaMock.dimension.deleteMany.mockResolvedValue({ count: 2 })
    prismaMock.dimension.update.mockImplementation(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
      return { ...createDimensionFixture({ id: where.id }), ...data }
    })
  })

  it('POST /dimensions linear returns 201', async () => {
    const app = await createApp()

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/dimensions',
      payload: {
        room_id: roomId,
        type: 'linear',
        points: [{ x_mm: 0, y_mm: 0 }, { x_mm: 2400, y_mm: 0 }],
      },
    })

    expect(response.statusCode).toBe(201)
    expect(response.json()).toMatchObject({ id: dimensionId, type: 'linear' })
    await app.close()
  })

  it('POST /dimensions angular with 3 points returns 201', async () => {
    const app = await createApp()

    prismaMock.dimension.create.mockResolvedValueOnce(createDimensionFixture({ type: 'angular' }))

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/dimensions',
      payload: {
        room_id: roomId,
        type: 'angular',
        points: [{ x_mm: 0, y_mm: 0 }, { x_mm: 1000, y_mm: 0 }, { x_mm: 1000, y_mm: 1000 }],
      },
    })

    expect(response.statusCode).toBe(201)
    expect(response.json()).toMatchObject({ type: 'angular' })
    await app.close()
  })

  it('POST /dimensions angular with 2 points returns 400', async () => {
    const app = await createApp()

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/dimensions',
      payload: {
        room_id: roomId,
        type: 'angular',
        points: [{ x_mm: 0, y_mm: 0 }, { x_mm: 1000, y_mm: 0 }],
      },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json()).toMatchObject({ error: 'BAD_REQUEST' })
    await app.close()
  })

  it('POST /dimensions unknown room returns 404', async () => {
    const app = await createApp()

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/dimensions',
      payload: {
        room_id: missingRoomId,
        type: 'linear',
        points: [{ x_mm: 0, y_mm: 0 }, { x_mm: 2000, y_mm: 0 }],
      },
    })

    expect(response.statusCode).toBe(404)
    await app.close()
  })

  it('GET /rooms/:id/dimensions returns array', async () => {
    const app = await createApp()

    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/rooms/${roomId}/dimensions`,
    })

    expect(response.statusCode).toBe(200)
    expect(Array.isArray(response.json())).toBe(true)
    await app.close()
  })

  it('DELETE /dimensions/:id returns 204', async () => {
    const app = await createApp()

    const response = await app.inject({
      method: 'DELETE',
      url: `/api/v1/dimensions/${dimensionId}`,
    })

    expect(response.statusCode).toBe(204)
    await app.close()
  })

  it('DELETE /dimensions/:id unknown dimension returns 404', async () => {
    const app = await createApp()

    const response = await app.inject({
      method: 'DELETE',
      url: '/api/v1/dimensions/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    })

    expect(response.statusCode).toBe(404)
    await app.close()
  })

  it('POST /rooms/:id/dimensions/auto returns 201 and creates multiple dimensions', async () => {
    const app = await createApp()

    const createdDimensions = [
      createDimensionFixture({ id: 'dim-1' }),
      createDimensionFixture({ id: 'dim-2' }),
      createDimensionFixture({ id: 'dim-3' }),
      createDimensionFixture({ id: 'dim-4' }),
    ]
    prismaMock.dimension.create
      .mockResolvedValueOnce(createdDimensions[0])
      .mockResolvedValueOnce(createdDimensions[1])
      .mockResolvedValueOnce(createdDimensions[2])
      .mockResolvedValueOnce(createdDimensions[3])

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/rooms/${roomId}/dimensions/auto`,
      payload: {},
    })

    expect(response.statusCode).toBe(201)
    expect(response.json()).toHaveLength(4)
    expect(prismaMock.dimension.deleteMany).toHaveBeenCalledWith({ where: { room_id: roomId } })
    await app.close()
  })

  it('GET /rooms/:id/elevation/:wallIndex returns SVG with content type', async () => {
    const app = await createApp()

    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/rooms/${roomId}/elevation/0`,
    })

    expect(response.statusCode).toBe(200)
    expect(response.headers['content-type']).toContain('image/svg+xml')
    expect(response.body).toContain('<svg')
    await app.close()
  })

  it('GET /rooms/:id/elevation/99 returns 404', async () => {
    const app = await createApp()

    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/rooms/${roomId}/elevation/99`,
    })

    expect(response.statusCode).toBe(404)
    await app.close()
  })

  // ── Sprint 63: PUT /dimensions/:id ─────────────────────────────────────────

  it('PUT /dimensions/:id with label returns 200 and updated label', async () => {
    const app = await createApp()

    prismaMock.dimension.update.mockResolvedValueOnce(createDimensionFixture({ label: 'Override' }))

    const response = await app.inject({
      method: 'PUT',
      url: `/api/v1/dimensions/${dimensionId}`,
      payload: { label: 'Override' },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({ label: 'Override' })
    await app.close()
  })

  it('PUT /dimensions/:id with style returns 200 and updated style', async () => {
    const app = await createApp()

    const updatedStyle = { unit: 'cm', offset_mm: 200 }
    prismaMock.dimension.update.mockResolvedValueOnce(createDimensionFixture({ style: updatedStyle }))

    const response = await app.inject({
      method: 'PUT',
      url: `/api/v1/dimensions/${dimensionId}`,
      payload: { style: updatedStyle },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({ style: updatedStyle })
    await app.close()
  })

  it('PUT /dimensions/:id unknown dimension returns 404', async () => {
    const app = await createApp()

    const response = await app.inject({
      method: 'PUT',
      url: '/api/v1/dimensions/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      payload: { label: 'X' },
    })

    expect(response.statusCode).toBe(404)
    await app.close()
  })

  it('PUT /dimensions/:id with invalid style (fontSize > 24) returns 400', async () => {
    const app = await createApp()

    const response = await app.inject({
      method: 'PUT',
      url: `/api/v1/dimensions/${dimensionId}`,
      payload: { style: { fontSize: 99 } },
    })

    expect(response.statusCode).toBe(400)
    await app.close()
  })

  // ── Sprint 63: POST /rooms/:id/dimensions/smart ────────────────────────────

  it('POST /rooms/:id/dimensions/smart returns 201 and creates wall + placement dimensions', async () => {
    const app = await createApp()

    const createdDimensions = [
      createDimensionFixture({ id: 'smart-1' }),
      createDimensionFixture({ id: 'smart-2' }),
      createDimensionFixture({ id: 'smart-3' }),
      createDimensionFixture({ id: 'smart-4' }),
      createDimensionFixture({ id: 'smart-5' }),
    ]
    createdDimensions.forEach((d, i) => {
      prismaMock.dimension.create.mockResolvedValueOnce(createdDimensions[i])
    })

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/rooms/${roomId}/dimensions/smart`,
      payload: {},
    })

    expect(response.statusCode).toBe(201)
    const body = response.json()
    expect(Array.isArray(body)).toBe(true)
    expect(body.length).toBeGreaterThanOrEqual(1)
    await app.close()
  })

  it('POST /rooms/:id/dimensions/smart unknown room returns 404', async () => {
    const app = await createApp()

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/rooms/${missingRoomId}/dimensions/smart`,
      payload: {},
    })

    expect(response.statusCode).toBe(404)
    await app.close()
  })

  it('POST /rooms/:id/dimensions/smart room without boundary returns 400', async () => {
    const app = await createApp()

    const noBoundaryRoomId = '33333333-3333-3333-3333-333333333333'
    prismaMock.room.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) => {
      if (where.id === roomId) return roomFixture
      if (where.id === noBoundaryRoomId) return { ...roomFixture, id: noBoundaryRoomId, boundary: {} }
      return null
    })

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/rooms/${noBoundaryRoomId}/dimensions/smart`,
      payload: {},
    })

    expect(response.statusCode).toBe(400)
    await app.close()
  })

  it('POST /rooms/:id/dimensions/smart deletes existing dimensions first', async () => {
    const app = await createApp()

    prismaMock.dimension.create.mockResolvedValue(createDimensionFixture())

    await app.inject({
      method: 'POST',
      url: `/api/v1/rooms/${roomId}/dimensions/smart`,
      payload: {},
    })

    expect(prismaMock.dimension.deleteMany).toHaveBeenCalledWith({ where: { room_id: roomId } })
    await app.close()
  })

  it('POST /rooms/:id/dimensions/smart with placement creates at least wall + placement dimensions', async () => {
    const app = await createApp()

    const roomWithTwoPlacements = {
      ...roomFixture,
      placements: [
        { id: 'pl-1', wall_id: 'wall-1', offset_mm: 0, width_mm: 600, depth_mm: 560 },
        { id: 'pl-2', wall_id: 'wall-1', offset_mm: 700, width_mm: 900, depth_mm: 560 },
      ],
    }
    prismaMock.room.findUnique.mockResolvedValueOnce(roomWithTwoPlacements)

    const dims = [
      createDimensionFixture({ id: 'd1' }),
      createDimensionFixture({ id: 'd2', label: '600 mm' }),
      createDimensionFixture({ id: 'd3', label: '900 mm' }),
      createDimensionFixture({ id: 'd4' }),
      createDimensionFixture({ id: 'd5' }),
      createDimensionFixture({ id: 'd6' }),
    ]
    dims.forEach(d => prismaMock.dimension.create.mockResolvedValueOnce(d))

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/rooms/${roomId}/dimensions/smart`,
      payload: {},
    })

    expect(response.statusCode).toBe(201)
    const body = response.json()
    expect(body.length).toBeGreaterThanOrEqual(3)
    await app.close()
  })

  it('POST /rooms/:id/dimensions/smart wall without placements creates only wall dimension', async () => {
    const app = await createApp()

    const roomWithNoWallPlacements = {
      ...roomFixture,
      placements: [],
    }
    prismaMock.room.findUnique.mockResolvedValueOnce(roomWithNoWallPlacements)

    const wallDims = [
      createDimensionFixture({ id: 'w1' }),
      createDimensionFixture({ id: 'w2' }),
      createDimensionFixture({ id: 'w3' }),
      createDimensionFixture({ id: 'w4' }),
    ]
    wallDims.forEach(d => prismaMock.dimension.create.mockResolvedValueOnce(d))

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/rooms/${roomId}/dimensions/smart`,
      payload: {},
    })

    expect(response.statusCode).toBe(201)
    const body = response.json()
    expect(body.length).toBe(4)
    await app.close()
  })
})