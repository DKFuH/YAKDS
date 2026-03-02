import Fastify from 'fastify'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const ROOM_ID = '11111111-1111-1111-1111-111111111111'
const WALL_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const VERTEX_A = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
const VERTEX_B = 'cccccccc-cccc-cccc-cccc-cccccccccccc'

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    room: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}))

vi.mock('../db.js', () => ({ prisma: prismaMock }))

import { wallRoutes } from './walls.js'

const baseRoom = {
  id: ROOM_ID,
  boundary: {
    vertices: [
      { id: VERTEX_A, x_mm: 0, y_mm: 0, index: 0 },
      { id: VERTEX_B, x_mm: 4000, y_mm: 0, index: 1 },
    ],
    wall_segments: [
      { id: WALL_ID, index: 0, start_vertex_id: VERTEX_A, end_vertex_id: VERTEX_B, length_mm: 4000 },
    ],
  },
}

describe('wallRoutes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.room.update.mockImplementation(({ data }: any) => Promise.resolve({ ...baseRoom, ...data }))
  })

  describe('PATCH /walls/:id/shift', () => {
    it('shifts a wall by delta_mm', async () => {
      prismaMock.room.findUnique.mockResolvedValue(baseRoom)

      const app = Fastify()
      await app.register(wallRoutes, { prefix: '/api/v1' })

      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/walls/${WALL_ID}/shift`,
        payload: { room_id: ROOM_ID, delta_mm: 100 },
      })

      expect(res.statusCode).toBe(200)
      expect(res.json()).toMatchObject({ wall_id: WALL_ID, delta_mm: 100 })
      await app.close()
    })

    it('returns 404 when room not found', async () => {
      prismaMock.room.findUnique.mockResolvedValue(null)

      const app = Fastify()
      await app.register(wallRoutes, { prefix: '/api/v1' })

      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/walls/${WALL_ID}/shift`,
        payload: { room_id: ROOM_ID, delta_mm: 100 },
      })

      expect(res.statusCode).toBe(404)
      await app.close()
    })

    it('returns 400 for invalid payload', async () => {
      const app = Fastify()
      await app.register(wallRoutes, { prefix: '/api/v1' })

      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/walls/${WALL_ID}/shift`,
        payload: { room_id: ROOM_ID }, // missing delta_mm
      })

      expect(res.statusCode).toBe(400)
      await app.close()
    })
  })

  describe('POST /walls/:id/split', () => {
    it('splits a wall at the given offset', async () => {
      prismaMock.room.findUnique.mockResolvedValue(baseRoom)

      const app = Fastify()
      await app.register(wallRoutes, { prefix: '/api/v1' })

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/walls/${WALL_ID}/split`,
        payload: { room_id: ROOM_ID, offset_mm: 2000 },
      })

      expect(res.statusCode).toBe(201)
      const body = res.json()
      expect(body).toHaveProperty('wall1_id')
      expect(body).toHaveProperty('wall2_id')
      expect(body).toHaveProperty('vertex_id')
      await app.close()
    })

    it('returns 400 when offset is out of bounds', async () => {
      prismaMock.room.findUnique.mockResolvedValue(baseRoom)

      const app = Fastify()
      await app.register(wallRoutes, { prefix: '/api/v1' })

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/walls/${WALL_ID}/split`,
        payload: { room_id: ROOM_ID, offset_mm: 5000 }, // beyond wall length
      })

      expect(res.statusCode).toBe(400)
      await app.close()
    })
  })

  describe('POST /rooms/:id/complete', () => {
    it('adds a closing wall segment', async () => {
      prismaMock.room.findUnique.mockResolvedValue(baseRoom)

      const app = Fastify()
      await app.register(wallRoutes, { prefix: '/api/v1' })

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/rooms/${ROOM_ID}/complete`,
      })

      expect(res.statusCode).toBe(201)
      expect(res.json()).toMatchObject({ mode: '90deg' })
      await app.close()
    })

    it('returns already-closed message when polygon is closed', async () => {
      const closedRoom = {
        ...baseRoom,
        boundary: {
          ...baseRoom.boundary,
          wall_segments: [
            {
              id: WALL_ID,
              index: 0,
              start_vertex_id: VERTEX_A,
              end_vertex_id: VERTEX_B,
              length_mm: 4000,
            },
            {
              id: 'closing-wall',
              index: 1,
              start_vertex_id: VERTEX_B,
              end_vertex_id: VERTEX_A, // closes back to first vertex
            },
          ],
        },
      }
      prismaMock.room.findUnique.mockResolvedValue(closedRoom)

      const app = Fastify()
      await app.register(wallRoutes, { prefix: '/api/v1' })

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/rooms/${ROOM_ID}/complete`,
      })

      expect(res.statusCode).toBe(200)
      expect(res.json().message).toBe('Already closed')
      await app.close()
    })

    it('returns 400 for unknown completion mode', async () => {
      prismaMock.room.findUnique.mockResolvedValue(baseRoom)

      const app = Fastify()
      await app.register(wallRoutes, { prefix: '/api/v1' })

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/rooms/${ROOM_ID}/complete?mode=freeform`,
      })

      expect(res.statusCode).toBe(400)
      await app.close()
    })
  })

  describe('wall-objects CRUD', () => {
    const roomWithWallObj = {
      ...baseRoom,
      boundary: {
        ...baseRoom.boundary,
        wall_segments: [
          {
            id: WALL_ID,
            index: 0,
            start_vertex_id: VERTEX_A,
            end_vertex_id: VERTEX_B,
            length_mm: 4000,
            wall_objects: [],
          },
        ],
      },
    }

    it('POST adds a wall object', async () => {
      prismaMock.room.findUnique.mockResolvedValue(roomWithWallObj)

      const app = Fastify()
      await app.register(wallRoutes, { prefix: '/api/v1' })

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/walls/${WALL_ID}/wall-objects`,
        payload: {
          room_id: ROOM_ID,
          wall_object: {
            type: 'door_single',
            offset_mm: 500,
            width_mm: 900,
          },
        },
      })

      expect(res.statusCode).toBe(201)
      const body = res.json()
      expect(body.type).toBe('door_single')
      expect(body.wall_id).toBe(WALL_ID)
      await app.close()
    })

    it('POST returns 400 for invalid wall object type', async () => {
      const app = Fastify()
      await app.register(wallRoutes, { prefix: '/api/v1' })

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/walls/${WALL_ID}/wall-objects`,
        payload: {
          room_id: ROOM_ID,
          wall_object: {
            type: 'invalid_type',
            offset_mm: 500,
            width_mm: 900,
          },
        },
      })

      expect(res.statusCode).toBe(400)
      await app.close()
    })

    it('PATCH /wall-objects/:id/hinge-side updates hinge side', async () => {
      const wallObjId = 'dddddddd-dddd-dddd-dddd-dddddddddddd'
      const roomWithObj = {
        ...baseRoom,
        boundary: {
          ...baseRoom.boundary,
          wall_segments: [
            {
              id: WALL_ID,
              index: 0,
              start_vertex_id: VERTEX_A,
              end_vertex_id: VERTEX_B,
              wall_objects: [{ id: wallObjId, type: 'door_single', offset_mm: 500, width_mm: 900, wall_id: WALL_ID }],
            },
          ],
        },
      }
      prismaMock.room.findUnique.mockResolvedValue(roomWithObj)

      const app = Fastify()
      await app.register(wallRoutes, { prefix: '/api/v1' })

      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/wall-objects/${wallObjId}/hinge-side`,
        payload: { room_id: ROOM_ID, hinge_side: 'right' },
      })

      expect(res.statusCode).toBe(200)
      expect(res.json()).toMatchObject({ id: wallObjId, hinge_side: 'right' })
      await app.close()
    })
  })

  describe('installations', () => {
    it('POST /walls/:id/installations adds an installation', async () => {
      const roomWithWall = {
        ...baseRoom,
        boundary: {
          ...baseRoom.boundary,
          wall_segments: [
            { id: WALL_ID, index: 0, start_vertex_id: VERTEX_A, end_vertex_id: VERTEX_B, installations: [] },
          ],
        },
      }
      prismaMock.room.findUnique.mockResolvedValue(roomWithWall)

      const app = Fastify()
      await app.register(wallRoutes, { prefix: '/api/v1' })

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/walls/${WALL_ID}/installations`,
        payload: {
          room_id: ROOM_ID,
          installation: {
            installation_type: 'socket_single',
            offset_mm: 800,
            height_from_floor_mm: 300,
          },
        },
      })

      expect(res.statusCode).toBe(201)
      const body = res.json()
      expect(body.installation_type).toBe('socket_single')
      expect(body.wall_id).toBe(WALL_ID)
      await app.close()
    })

    it('POST /walls/:id/installations returns 400 for invalid type', async () => {
      const app = Fastify()
      await app.register(wallRoutes, { prefix: '/api/v1' })

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/walls/${WALL_ID}/installations`,
        payload: {
          room_id: ROOM_ID,
          installation: {
            installation_type: 'unknown_type',
            offset_mm: 800,
          },
        },
      })

      expect(res.statusCode).toBe(400)
      await app.close()
    })
  })
})
