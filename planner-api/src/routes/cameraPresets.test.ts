import Fastify from 'fastify'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const tenantId = 'tenant-a'
const projectId = '11111111-1111-1111-1111-111111111111'
const presetIdA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const presetIdB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    project: {
      findUnique: vi.fn(),
    },
    projectEnvironment: {
      findUnique: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
  },
}))

vi.mock('../db.js', () => ({ prisma: prismaMock }))

import { cameraPresetRoutes } from './cameraPresets.js'

async function createApp(tenantScope: string | null = tenantId) {
  const app = Fastify()
  app.addHook('preHandler', async (request) => {
    request.tenantId = tenantScope
  })
  await app.register(cameraPresetRoutes, { prefix: '/api/v1' })
  return app
}

function samplePreset(id: string, overrides?: Partial<Record<string, unknown>>) {
  return {
    id,
    name: `Preset-${id.slice(0, 4)}`,
    position: { x: 100, y: 1600, z: 300 },
    target: { x: 1200, y: 1500, z: 300 },
    fov: 55,
    mode: 'orbit',
    is_default: false,
    created_at: '2026-03-01T10:00:00.000Z',
    updated_at: '2026-03-01T10:00:00.000Z',
    ...overrides,
  }
}

describe('cameraPresetRoutes', () => {
  let environmentState: { id: string; config_json: Record<string, unknown> } | null

  beforeEach(() => {
    vi.clearAllMocks()

    environmentState = null

    prismaMock.project.findUnique.mockResolvedValue({
      id: projectId,
      tenant_id: tenantId,
    })

    prismaMock.projectEnvironment.findUnique.mockImplementation(async ({ select }: { select: Record<string, boolean> }) => {
      if (!environmentState) {
        return null
      }
      if (select.id && select.config_json) {
        return {
          id: environmentState.id,
          config_json: environmentState.config_json,
        }
      }
      return {
        config_json: environmentState.config_json,
      }
    })

    prismaMock.projectEnvironment.update.mockImplementation(async ({ data }: { data: { config_json: Record<string, unknown> } }) => {
      environmentState = {
        id: environmentState?.id ?? 'env-1',
        config_json: data.config_json,
      }
      return {
        id: environmentState.id,
        config_json: environmentState.config_json,
      }
    })

    prismaMock.projectEnvironment.create.mockImplementation(async ({ data }: { data: { config_json: Record<string, unknown> } }) => {
      environmentState = {
        id: 'env-1',
        config_json: data.config_json,
      }
      return {
        id: 'env-1',
        config_json: data.config_json,
      }
    })
  })

  it('GET returns empty preset list when config is missing', async () => {
    const app = await createApp()

    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectId}/camera-presets`,
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({
      project_id: projectId,
      presets: [],
      active_preset_id: null,
    })

    await app.close()
  })

  it('POST creates a preset and stores it in environment config', async () => {
    const app = await createApp()

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/camera-presets`,
      payload: {
        name: 'Hero Shot',
        position: { x: 100, y: 1650, z: 200 },
        target: { x: 1200, y: 1400, z: 400 },
        fov: 62,
        mode: 'orbit',
      },
    })

    expect(response.statusCode).toBe(201)
    const body = response.json()
    expect(body.project_id).toBe(projectId)
    expect(body.presets).toHaveLength(1)
    expect(body.preset.name).toBe('Hero Shot')
    expect(body.preset.fov).toBe(62)
    expect(prismaMock.projectEnvironment.create).toHaveBeenCalledTimes(1)

    await app.close()
  })

  it('POST with is_default enforces single default preset', async () => {
    environmentState = {
      id: 'env-1',
      config_json: {
        camera_presets: [samplePreset(presetIdA, { is_default: true })],
        active_camera_preset_id: presetIdA,
      },
    }

    const app = await createApp()

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/camera-presets`,
      payload: {
        name: 'Default New',
        position: { x: 10, y: 1600, z: 20 },
        target: { x: 900, y: 1400, z: 50 },
        fov: 48,
        mode: 'visitor',
        is_default: true,
      },
    })

    expect(response.statusCode).toBe(201)
    const body = response.json()
    expect(body.presets).toHaveLength(2)
    const defaultCount = body.presets.filter((entry: { is_default: boolean }) => entry.is_default).length
    expect(defaultCount).toBe(1)
    expect(body.active_preset_id).toBe(body.preset.id)

    await app.close()
  })

  it('PATCH updates preset fields', async () => {
    environmentState = {
      id: 'env-1',
      config_json: {
        camera_presets: [samplePreset(presetIdA)],
        active_camera_preset_id: null,
      },
    }

    const app = await createApp()

    const response = await app.inject({
      method: 'PATCH',
      url: `/api/v1/projects/${projectId}/camera-presets/${presetIdA}`,
      payload: {
        name: 'Updated Preset',
        fov: 73,
        is_default: true,
      },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json().preset.name).toBe('Updated Preset')
    expect(response.json().preset.fov).toBe(73)
    expect(response.json().preset.is_default).toBe(true)

    await app.close()
  })

  it('POST apply stores active_preset_id', async () => {
    environmentState = {
      id: 'env-1',
      config_json: {
        camera_presets: [samplePreset(presetIdA), samplePreset(presetIdB)],
        active_camera_preset_id: null,
      },
    }

    const app = await createApp()

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/camera-presets/${presetIdB}/apply`,
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
      project_id: projectId,
      active_preset_id: presetIdB,
    })

    await app.close()
  })

  it('DELETE removes preset and clears active id when needed', async () => {
    environmentState = {
      id: 'env-1',
      config_json: {
        camera_presets: [samplePreset(presetIdA), samplePreset(presetIdB)],
        active_camera_preset_id: presetIdB,
      },
    }

    const app = await createApp()

    const response = await app.inject({
      method: 'DELETE',
      url: `/api/v1/projects/${projectId}/camera-presets/${presetIdB}`,
    })

    expect(response.statusCode).toBe(204)
    expect(environmentState?.config_json.camera_presets).toHaveLength(1)
    expect(environmentState?.config_json.active_camera_preset_id).toBeNull()

    await app.close()
  })

  it('returns 404 for unknown preset on apply', async () => {
    environmentState = {
      id: 'env-1',
      config_json: {
        camera_presets: [samplePreset(presetIdA)],
        active_camera_preset_id: null,
      },
    }

    const app = await createApp()

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/camera-presets/${presetIdB}/apply`,
    })

    expect(response.statusCode).toBe(404)

    await app.close()
  })

  it('returns 403 when tenant header is missing', async () => {
    const app = await createApp(null)

    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectId}/camera-presets`,
    })

    expect(response.statusCode).toBe(403)

    await app.close()
  })
})
