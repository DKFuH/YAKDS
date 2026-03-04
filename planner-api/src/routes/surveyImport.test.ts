import Fastify from 'fastify'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const tenantId = '00000000-0000-0000-0000-000000000001'
const projectId = '11111111-1111-1111-1111-111111111111'
const roomId = '22222222-2222-2222-2222-222222222222'

const sampleEgi = [
  '[GLOBAL]',
  'Roomheight=2472.3',
  '',
  '[Wall_1]',
  'RefPntX=0',
  'RefPntY=0',
  'Width=4000',
  'AngleZ=0',
  '',
  '[Wall_2]',
  'RefPntX=4000',
  'RefPntY=0',
  'Width=3000',
  'AngleZ=90',
  '',
  '[Wall_3]',
  'RefPntX=4000',
  'RefPntY=3000',
  'Width=4000',
  'AngleZ=180',
  '',
  '[Door_1]',
  'WallRefNo=1',
  'Width=875',
  'Height=2100',
].join('\n')

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    room: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    project: {
      findUnique: vi.fn(),
    },
    importJob: {
      create: vi.fn(),
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

import { surveyImportRoutes } from './surveyImport.js'

async function createApp() {
  const app = Fastify()
  app.addHook('onRequest', async (request) => {
    ;(request as { tenantId?: string }).tenantId = tenantId
  })
  await app.register(surveyImportRoutes, { prefix: '/api/v1' })
  return app
}

describe('surveyImportRoutes', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    isTenantPluginEnabledMock.mockResolvedValue(true)
    prismaMock.room.findUnique.mockResolvedValue({
      id: roomId,
      project_id: projectId,
      boundary: { vertices: [], wall_segments: [] },
      measure_lines: [],
      openings: [],
      ceiling_constraints: [],
      placements: [],
    })
    prismaMock.project.findUnique.mockResolvedValue({
      id: projectId,
      tenant_id: tenantId,
    })
    prismaMock.room.update.mockResolvedValue({ id: roomId })
    prismaMock.importJob.create.mockResolvedValue({ id: 'job-1' })
  })

  it('POST /survey-import/formats/egi/parse returns summary and preview', async () => {
    const app = await createApp()

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/survey-import/formats/egi/parse',
      payload: {
        source_filename: 'sample.egi',
        content: sampleEgi,
      },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
      format: 'egi',
      summary: {
        walls: 3,
        doors: 1,
      },
      preview: {
        room_height_mm: 2472.3,
      },
    })

    await app.close()
  })

  it('POST /rooms/:id/survey-import/egi imports mapped structures and returns 201', async () => {
    const app = await createApp()

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/rooms/${roomId}/survey-import/egi`,
      payload: {
        source_filename: 'import.egi',
        content: sampleEgi,
      },
    })

    expect(response.statusCode).toBe(201)
    const body = response.json() as {
      imported: { walls: number; openings: number; roofs: number; placements: number; measure_lines: number }
      job_id: string
    }
    expect(body.imported.walls).toBe(3)
    expect(body.imported.openings).toBe(1)
    expect(body.job_id).toBe('job-1')
    expect(prismaMock.room.update).toHaveBeenCalledTimes(1)
    expect(prismaMock.importJob.create).toHaveBeenCalledTimes(1)

    await app.close()
  })

  it('returns 403 when survey-import plugin is disabled', async () => {
    isTenantPluginEnabledMock.mockResolvedValue(false)
    const app = await createApp()

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/survey-import/formats/egi/parse',
      payload: {
        content: sampleEgi,
      },
    })

    expect(response.statusCode).toBe(403)
    expect(response.json()).toMatchObject({ error: 'PLUGIN_DISABLED' })

    await app.close()
  })

  it('returns 400 when EGI file is structurally unusable', async () => {
    const app = await createApp()

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/survey-import/formats/egi/parse',
      payload: {
        content: '[GLOBAL]\nRoomheight=2500',
      },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json()).toMatchObject({ error: 'BAD_REQUEST' })

    await app.close()
  })
})
