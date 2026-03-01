import Fastify from 'fastify'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    project: { findFirst: vi.fn() },
  },
}))

vi.mock('../db.js', () => ({
  prisma: prismaMock,
}))

import { validateRoutes } from './validate.js'

const projectId = '11111111-1111-1111-1111-111111111111'
const userId = '22222222-2222-2222-2222-222222222222'

function createPayload() {
  return {
    project_id: projectId,
    user_id: userId,
    roomPolygon: [
      { x_mm: 0, y_mm: 0 },
      { x_mm: 4000, y_mm: 0 },
      { x_mm: 4000, y_mm: 4000 },
      { x_mm: 0, y_mm: 4000 },
    ],
    objects: [
      {
        id: 'cab-wall-1',
        type: 'wall',
        wall_id: 'wall-1',
        offset_mm: 600,
        width_mm: 800,
        depth_mm: 350,
        height_mm: 1300,
        worldPos: { x_mm: 1000, y_mm: 100 },
      },
    ],
    openings: [],
    walls: [
      {
        id: 'wall-1',
        start: { x_mm: 0, y_mm: 0 },
        end: { x_mm: 4000, y_mm: 0 },
        length_mm: 4000,
      },
    ],
    ceilingConstraints: [
      {
        wall_id: 'wall-1',
        wall_start: { x_mm: 0, y_mm: 0 },
        wall_end: { x_mm: 4000, y_mm: 0 },
        kniestock_height_mm: 1000,
        slope_angle_deg: 45,
        depth_into_room_mm: 1000,
      },
    ],
    nominalCeilingMm: 2500,
    minClearanceMm: 50,
  }
}

describe('validateRoutes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns height violations for sloped ceilings', async () => {
    prismaMock.project.findFirst.mockResolvedValue({ id: projectId })

    const app = Fastify()
    await app.register(validateRoutes, { prefix: '/api/v1' })

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/validate',
      payload: createPayload(),
    })

    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.valid).toBe(false)
    expect(body.violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'HANGING_CABINET_SLOPE_COLLISION',
          affected_ids: ['cab-wall-1'],
          flags: expect.objectContaining({
            requires_customization: true,
            labor_surcharge: true,
          }),
        }),
      ]),
    )

    await app.close()
  })

  it('returns 404 when project is not owned by the user', async () => {
    prismaMock.project.findFirst.mockResolvedValue(null)

    const app = Fastify()
    await app.register(validateRoutes, { prefix: '/api/v1' })

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/validate',
      payload: createPayload(),
    })

    expect(response.statusCode).toBe(404)

    await app.close()
  })
})
