import Fastify from 'fastify'
import { Prisma } from '@prisma/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const roomId = '33333333-3333-3333-3333-333333333333'

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    project: {
      findUnique: vi.fn(),
    },
    room: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findMany: vi.fn(),
    },
  },
}))

vi.mock('../db.js', () => ({
  prisma: prismaMock,
}))

const { isTenantPluginEnabledMock } = vi.hoisted(() => ({
  isTenantPluginEnabledMock: vi.fn(),
}))

vi.mock('../plugins/tenantPluginAccess.js', () => ({
  isTenantPluginEnabled: isTenantPluginEnabledMock,
}))

import { roomRoutes } from './rooms.js'

describe('roomRoutes reference image', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    prismaMock.room.findUnique.mockResolvedValue({ id: roomId })
    prismaMock.room.update.mockImplementation(async ({ data }: { data: { reference_image: unknown } }) => ({
      id: roomId,
      reference_image: data.reference_image,
    }))
  })

  it('stores reference image via PUT /rooms/:id/reference-image', async () => {
    const app = Fastify()
    await app.register(roomRoutes, { prefix: '/api/v1' })

    const response = await app.inject({
      method: 'PUT',
      url: `/api/v1/rooms/${roomId}/reference-image`,
      payload: {
        url: 'https://example.com/floorplan.png',
        x: 40,
        y: 80,
        rotation: 0,
        scale: 1,
        opacity: 0.5,
      },
    })

    expect(response.statusCode).toBe(200)
    expect(prismaMock.room.update).toHaveBeenCalledWith({
      where: { id: roomId },
      data: {
        reference_image: {
          url: 'https://example.com/floorplan.png',
          x: 40,
          y: 80,
          rotation: 0,
          scale: 1,
          opacity: 0.5,
        },
      },
    })

    await app.close()
  })

  it('returns 400 for invalid URL in PUT /rooms/:id/reference-image', async () => {
    const app = Fastify()
    await app.register(roomRoutes, { prefix: '/api/v1' })

    const response = await app.inject({
      method: 'PUT',
      url: `/api/v1/rooms/${roomId}/reference-image`,
      payload: {
        url: 'not-a-valid-url',
      },
    })

    expect(response.statusCode).toBe(400)
    expect(prismaMock.room.update).not.toHaveBeenCalled()

    await app.close()
  })

  it('clears reference image via DELETE /rooms/:id/reference-image', async () => {
    const app = Fastify()
    await app.register(roomRoutes, { prefix: '/api/v1' })

    const response = await app.inject({
      method: 'DELETE',
      url: `/api/v1/rooms/${roomId}/reference-image`,
    })

    expect(response.statusCode).toBe(200)
    expect(prismaMock.room.update).toHaveBeenCalledWith({
      where: { id: roomId },
      data: { reference_image: Prisma.JsonNull },
    })

    await app.close()
  })
})

describe('roomRoutes measurement import', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    isTenantPluginEnabledMock.mockResolvedValue(true)

    prismaMock.room.findUnique.mockResolvedValue({
      id: roomId,
      measure_lines: [],
      reference_image: null,
    })
    prismaMock.room.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: roomId,
      ...data,
    }))
  })

  it('imports measurement segments via POST /rooms/:id/measurement-import', async () => {
    const app = Fastify()
    app.addHook('onRequest', async (request) => {
      ;(request as { tenantId?: string }).tenantId = '00000000-0000-0000-0000-000000000001'
    })
    await app.register(roomRoutes, { prefix: '/api/v1' })

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/rooms/${roomId}/measurement-import`,
      payload: {
        segments: [
          {
            start: { x_mm: 0, y_mm: 0 },
            end: { x_mm: 3000, y_mm: 0 },
            label: 'Nordwand',
          },
        ],
        reference_image: {
          url: 'https://example.com/reference.png',
          x: 20,
          y: 40,
          scale: 1,
        },
      },
    })

    expect(response.statusCode).toBe(201)
    const body = response.json() as { imported_segments: number }
    expect(body.imported_segments).toBe(1)
    expect(prismaMock.room.update).toHaveBeenCalledTimes(1)

    await app.close()
  })

  it('returns 400 for invalid measurement import payload', async () => {
    const app = Fastify()
    app.addHook('onRequest', async (request) => {
      ;(request as { tenantId?: string }).tenantId = '00000000-0000-0000-0000-000000000001'
    })
    await app.register(roomRoutes, { prefix: '/api/v1' })

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/rooms/${roomId}/measurement-import`,
      payload: {
        segments: [{ start: { x_mm: 0, y_mm: 0 } }],
      },
    })

    expect(response.statusCode).toBe(400)

    await app.close()
  })

  it('returns 403 when survey-import plugin is disabled', async () => {
    isTenantPluginEnabledMock.mockResolvedValue(false)

    const app = Fastify()
    app.addHook('onRequest', async (request) => {
      ;(request as { tenantId?: string }).tenantId = '00000000-0000-0000-0000-000000000001'
    })
    await app.register(roomRoutes, { prefix: '/api/v1' })

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/rooms/${roomId}/measurement-import`,
      payload: {
        segments: [
          {
            start: { x_mm: 0, y_mm: 0 },
            end: { x_mm: 500, y_mm: 0 },
          },
        ],
      },
    })

    expect(response.statusCode).toBe(403)

    await app.close()
  })
})
