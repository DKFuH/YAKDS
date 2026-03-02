import Fastify from 'fastify'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    project: {
      findUnique: vi.fn(),
    },
    area: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    alternative: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    modelSettings: {
      upsert: vi.fn(),
    },
  },
}))

vi.mock('../db.js', () => ({
  prisma: prismaMock,
}))

import { areaRoutes } from './areas.js'

const projectId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const areaId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
const alternativeId = 'cccccccc-cccc-cccc-cccc-cccccccccccc'

const sampleArea = {
  id: areaId,
  project_id: projectId,
  name: 'Küche',
  sort_order: 0,
  created_at: new Date('2026-03-01T00:00:00.000Z'),
  updated_at: new Date('2026-03-01T00:00:00.000Z'),
  alternatives: [],
}

const sampleAlternative = {
  id: alternativeId,
  area_id: areaId,
  name: 'Variante A',
  is_active: false,
  sort_order: 0,
  created_at: new Date('2026-03-01T00:00:00.000Z'),
  updated_at: new Date('2026-03-01T00:00:00.000Z'),
  model_settings: null,
}

describe('areaRoutes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('lists areas for a project', async () => {
    prismaMock.project.findUnique.mockResolvedValue({ id: projectId })
    prismaMock.area.findMany.mockResolvedValue([sampleArea])

    const app = Fastify()
    await app.register(areaRoutes, { prefix: '/api/v1' })

    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectId}/areas`,
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: areaId, name: 'Küche' }),
    ]))

    await app.close()
  })

  it('creates an area', async () => {
    prismaMock.project.findUnique.mockResolvedValue({ id: projectId })
    prismaMock.area.create.mockResolvedValue(sampleArea)

    const app = Fastify()
    await app.register(areaRoutes, { prefix: '/api/v1' })

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/areas`,
      payload: { name: 'Küche' },
    })

    expect(response.statusCode).toBe(201)
    expect(response.json()).toMatchObject({ id: areaId, name: 'Küche' })

    await app.close()
  })

  it('creates an alternative within an area', async () => {
    prismaMock.area.findFirst.mockResolvedValue(sampleArea)
    prismaMock.alternative.create.mockResolvedValue(sampleAlternative)

    const app = Fastify()
    await app.register(areaRoutes, { prefix: '/api/v1' })

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/areas/${areaId}/alternatives`,
      payload: { name: 'Variante A' },
    })

    expect(response.statusCode).toBe(201)
    expect(response.json()).toMatchObject({ id: alternativeId, name: 'Variante A' })

    await app.close()
  })

  it('returns 404 when project not found for area creation', async () => {
    prismaMock.project.findUnique.mockResolvedValue(null)

    const app = Fastify()
    await app.register(areaRoutes, { prefix: '/api/v1' })

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/areas`,
      payload: { name: 'Neue Fläche' },
    })

    expect(response.statusCode).toBe(404)

    await app.close()
  })

  it('upserts model settings for an alternative', async () => {
    prismaMock.alternative.findUnique.mockResolvedValue(sampleAlternative)
    const savedSettings = {
      id: 'settings-id',
      alternative_id: alternativeId,
      manufacturer_name: 'Nolte',
      model_name: 'Concept 130',
      handle_name: null,
      worktop_model: null,
      worktop_color: null,
      plinth_height_mm: 150,
      cover_panel_enabled: false,
      room_height_mm: 2500,
      wall_thickness_mm: null,
      extra_json: {},
      created_at: new Date('2026-03-01T00:00:00.000Z'),
      updated_at: new Date('2026-03-01T00:00:00.000Z'),
    }
    prismaMock.modelSettings.upsert.mockResolvedValue(savedSettings)

    const app = Fastify()
    await app.register(areaRoutes, { prefix: '/api/v1' })

    const response = await app.inject({
      method: 'PUT',
      url: `/api/v1/alternatives/${alternativeId}/model-settings`,
      payload: { manufacturer_name: 'Nolte', model_name: 'Concept 130', plinth_height_mm: 150, room_height_mm: 2500 },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({ manufacturer_name: 'Nolte', model_name: 'Concept 130' })

    await app.close()
  })
})
