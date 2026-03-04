import Fastify from 'fastify'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const projectId = '11111111-1111-1111-1111-111111111111'
const alternativeId = '22222222-2222-2222-2222-222222222222'

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    project: {
      findUnique: vi.fn(),
    },
    alternative: {
      findUnique: vi.fn(),
    },
    room: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
  },
}))

vi.mock('../db.js', () => ({
  prisma: prismaMock,
}))

import { cadInteropRoutes } from './cadInterop.js'

const DXF_WITH_LINE = [
  '0',
  'SECTION',
  '2',
  'HEADER',
  '9',
  '$ACADVER',
  '1',
  'AC1015',
  '0',
  'ENDSEC',
  '0',
  'SECTION',
  '2',
  'ENTITIES',
  '0',
  'LINE',
  '8',
  'WALLS',
  '10',
  '0',
  '20',
  '0',
  '30',
  '0',
  '11',
  '5000',
  '21',
  '0',
  '31',
  '0',
  '0',
  'ENDSEC',
  '0',
  'EOF',
].join('\n')

const DXF_WITHOUT_LINE = [
  '0',
  'SECTION',
  '2',
  'HEADER',
  '9',
  '$ACADVER',
  '1',
  'AC1015',
  '0',
  'ENDSEC',
  '0',
  'SECTION',
  '2',
  'ENTITIES',
  '0',
  'CIRCLE',
  '8',
  'WALLS',
  '10',
  '0',
  '20',
  '0',
  '40',
  '50',
  '0',
  'ENDSEC',
  '0',
  'EOF',
].join('\n')

const DXF_WITH_ARC = [
  '0',
  'SECTION',
  '2',
  'HEADER',
  '9',
  '$ACADVER',
  '1',
  'AC1015',
  '0',
  'ENDSEC',
  '0',
  'SECTION',
  '2',
  'ENTITIES',
  '0',
  'ARC',
  '8',
  'WALLS',
  '10',
  '0',
  '20',
  '0',
  '30',
  '0',
  '40',
  '1000',
  '50',
  '0',
  '51',
  '90',
  '0',
  'ENDSEC',
  '0',
  'EOF',
].join('\n')

async function createApp() {
  const app = Fastify()
  await app.register(cadInteropRoutes, { prefix: '/api/v1' })
  return app
}

function createAlternative() {
  return {
    id: alternativeId,
    area: {
      project: {
        id: projectId,
        name: 'Projekt CAD',
      },
    },
  }
}

describe('cadInteropRoutes', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    prismaMock.project.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) => {
      if (where.id === projectId) {
        return { id: projectId, name: 'Projekt CAD' }
      }

      return null
    })

    prismaMock.alternative.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) => {
      if (where.id === alternativeId) {
        return createAlternative()
      }

      return null
    })

    prismaMock.room.create.mockResolvedValue({ id: 'room-created' })

    prismaMock.room.findMany.mockResolvedValue([
      {
        id: 'room-1',
        name: 'Küche',
        ceiling_height_mm: 2600,
        boundary: {
          wall_segments: [{ id: 'wall-1', x0_mm: 0, y0_mm: 0, x1_mm: 4000, y1_mm: 0 }],
        },
        placements: [{ wall_id: 'wall-1', offset_mm: 200, width_mm: 600, depth_mm: 560 }],
      },
    ])
  })

  it('imports DXF buffer and creates room', async () => {
    const app = await createApp()

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/import/dwg`,
      headers: {
        'content-type': 'application/octet-stream',
        'x-filename': 'grundriss.dxf',
      },
      payload: Buffer.from(DXF_WITH_LINE, 'utf8'),
    })

    expect(response.statusCode).toBe(201)
    expect(response.json()).toMatchObject({
      room_id: 'room-created',
      wall_segments_count: expect.any(Number),
      needs_review: false,
    })

    await app.close()
  })

  it('returns 400 when DXF has no LINE entities', async () => {
    const app = await createApp()

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/import/dwg`,
      headers: {
        'content-type': 'application/octet-stream',
        'x-filename': 'leer.dxf',
      },
      payload: Buffer.from(DXF_WITHOUT_LINE, 'utf8'),
    })

    expect(response.statusCode).toBe(400)
    expect(response.json()).toMatchObject({ error: 'BAD_REQUEST' })

    await app.close()
  })

  it('imports ARC entities and reports detection count', async () => {
    const app = await createApp()

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/import/dwg`,
      headers: {
        'content-type': 'application/octet-stream',
        'x-filename': 'bogen.dxf',
      },
      payload: Buffer.from(DXF_WITH_ARC, 'utf8'),
    })

    expect(response.statusCode).toBe(201)
    expect(response.json()).toMatchObject({
      arc_entities_detected: 1,
      needs_review: false,
    })

    await app.close()
  })

  it('returns 400 for empty body', async () => {
    const app = await createApp()

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/import/dwg`,
      headers: {
        'content-type': 'application/octet-stream',
        'x-filename': 'leer.dxf',
      },
      payload: Buffer.alloc(0),
    })

    expect(response.statusCode).toBe(400)

    await app.close()
  })

  it('returns 404 for unknown project on import', async () => {
    const app = await createApp()

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/projects/33333333-3333-3333-3333-333333333333/import/dwg',
      headers: {
        'content-type': 'application/octet-stream',
        'x-filename': 'grundriss.dxf',
      },
      payload: Buffer.from(DXF_WITH_LINE, 'utf8'),
    })

    expect(response.statusCode).toBe(404)

    await app.close()
  })

  it('exports DWG endpoint with dxf content type', async () => {
    const app = await createApp()

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/alternatives/${alternativeId}/export/dwg`,
    })

    expect(response.statusCode).toBe(200)
    expect(response.headers['content-type']).toContain('application/dxf')

    await app.close()
  })

  it('exports DWG payload containing ENTITIES section', async () => {
    const app = await createApp()

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/alternatives/${alternativeId}/export/dwg`,
    })

    expect(response.statusCode).toBe(200)
    expect(response.body.includes('ENTITIES')).toBe(true)

    await app.close()
  })

  it('exports ARC entities for arc walls in boundary', async () => {
    prismaMock.room.findMany.mockResolvedValueOnce([
      {
        id: 'room-arc',
        name: 'Bogenraum',
        ceiling_height_mm: 2600,
        boundary: {
          wall_segments: [
            {
              id: 'arc-1',
              kind: 'arc',
              start: { x_mm: 1000, y_mm: 0 },
              end: { x_mm: 0, y_mm: 1000 },
              center: { x_mm: 0, y_mm: 0 },
              radius_mm: 1000,
              clockwise: false,
            },
          ],
        },
        placements: [],
      },
    ])

    const app = await createApp()

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/alternatives/${alternativeId}/export/dwg`,
    })

    expect(response.statusCode).toBe(200)
    expect(response.body.includes('\nARC\n')).toBe(true)

    await app.close()
  })

  it('returns 404 for unknown alternative on dwg export', async () => {
    const app = await createApp()

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/alternatives/44444444-4444-4444-4444-444444444444/export/dwg',
    })

    expect(response.statusCode).toBe(404)

    await app.close()
  })

  it('exports SKP ruby script with ruby content type', async () => {
    const app = await createApp()

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/alternatives/${alternativeId}/export/skp`,
    })

    expect(response.statusCode).toBe(200)
    expect(response.headers['content-type']).toContain('application/ruby')

    await app.close()
  })

  it('exports SKP payload containing Sketchup.active_model', async () => {
    const app = await createApp()

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/alternatives/${alternativeId}/export/skp`,
    })

    expect(response.statusCode).toBe(200)
    expect(response.body.includes('Sketchup.active_model')).toBe(true)

    await app.close()
  })

  it('redirects batch export with format=dxf', async () => {
    const app = await createApp()

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/alternatives/${alternativeId}/export?format=dxf`,
    })

    expect(response.statusCode).toBe(302)
    expect(response.headers.location).toContain(`/api/v1/alternatives/${alternativeId}/export/dxf`)

    await app.close()
  })

  it('returns urls object for format=all', async () => {
    const app = await createApp()

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/alternatives/${alternativeId}/export?format=all`,
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
      urls: {
        dxf: `/api/v1/alternatives/${alternativeId}/export/dxf`,
        dwg: `/api/v1/alternatives/${alternativeId}/export/dwg`,
        gltf: `/api/v1/alternatives/${alternativeId}/export/gltf`,
        ifc: `/api/v1/alternatives/${alternativeId}/export/ifc`,
        skp: `/api/v1/alternatives/${alternativeId}/export/skp`,
      },
    })

    await app.close()
  })

  it('returns 400 for invalid format in batch export', async () => {
    const app = await createApp()

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/alternatives/${alternativeId}/export?format=invalid`,
    })

    expect(response.statusCode).toBe(400)

    await app.close()
  })
})
