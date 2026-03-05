import Fastify from 'fastify'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const tenantId = 'tenant-a'
const projectId = '11111111-1111-1111-1111-111111111111'

type EnvironmentState = {
  id: string
  north_angle_deg: number
  latitude: number | null
  longitude: number | null
  timezone: string | null
  default_datetime: Date | null
  daylight_enabled: boolean
  config_json: Record<string, unknown>
}

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    project: {
      findUnique: vi.fn(),
    },
    projectEnvironment: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  },
}))

vi.mock('../db.js', () => ({ prisma: prismaMock }))

import { renderEnvironmentRoutes } from './renderEnvironments.js'

async function createApp(tenantScope: string | null = tenantId) {
  const app = Fastify()
  app.addHook('preHandler', async (request) => {
    request.tenantId = tenantScope
  })
  await app.register(renderEnvironmentRoutes, { prefix: '/api/v1' })
  return app
}

describe('renderEnvironmentRoutes', () => {
  let environmentState: EnvironmentState | null

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

      const result: Record<string, unknown> = {}
      for (const key of Object.keys(select ?? {})) {
        if (select[key]) {
          result[key] = environmentState[key as keyof EnvironmentState]
        }
      }
      return result
    })

    prismaMock.projectEnvironment.upsert.mockImplementation(async ({ create, update }: {
      create: Partial<EnvironmentState>
      update: Partial<EnvironmentState>
    }) => {
      if (environmentState) {
        environmentState = {
          ...environmentState,
          ...update,
          config_json: (update.config_json as Record<string, unknown>) ?? environmentState.config_json,
        }
      } else {
        environmentState = {
          id: 'env-1',
          north_angle_deg: create.north_angle_deg ?? 0,
          latitude: create.latitude ?? null,
          longitude: create.longitude ?? null,
          timezone: create.timezone ?? null,
          default_datetime: (create.default_datetime as Date | null) ?? null,
          daylight_enabled: create.daylight_enabled ?? true,
          config_json: (create.config_json as Record<string, unknown>) ?? {},
        }
      }
      return environmentState
    })
  })

  it('GET returns defaults and presets when project config is missing', async () => {
    const app = await createApp()

    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectId}/render-environments`,
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({
      project_id: projectId,
      presets: [
        {
          id: 'studio',
          label: 'Studio',
          description: 'Neutrales Studiolicht fuer Produktansichten',
        },
        {
          id: 'daylight',
          label: 'Daylight',
          description: 'Natuerlicher Himmel als Tageslicht-Fallback',
        },
        {
          id: 'interior',
          label: 'Interior',
          description: 'Warme Innenraumstimmung fuer Praesentationen',
        },
      ],
      active: {
        preset_id: 'daylight',
        intensity: 1,
        rotation_deg: 0,
        ground_tint: '#9AB77C',
      },
    })

    await app.close()
  })

  it('GET normalizes stored render environment values', async () => {
    environmentState = {
      id: 'env-1',
      north_angle_deg: 0,
      latitude: null,
      longitude: null,
      timezone: null,
      default_datetime: null,
      daylight_enabled: true,
      config_json: {
        render_environment: {
          preset_id: 'interior',
          intensity: 7,
          rotation_deg: -15,
          ground_tint: '8e7967',
        },
      },
    }

    const app = await createApp()

    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectId}/render-environments`,
    })

    expect(response.statusCode).toBe(200)
    expect(response.json().active).toEqual({
      preset_id: 'interior',
      intensity: 2,
      rotation_deg: 345,
      ground_tint: '#8E7967',
    })

    await app.close()
  })

  it('PATCH merges partial settings and preserves unrelated config keys', async () => {
    environmentState = {
      id: 'env-1',
      north_angle_deg: 0,
      latitude: null,
      longitude: null,
      timezone: null,
      default_datetime: null,
      daylight_enabled: true,
      config_json: {
        another_feature: { enabled: true },
        render_environment: {
          preset_id: 'daylight',
          intensity: 0.9,
          rotation_deg: 120,
          ground_tint: '#88AA66',
        },
      },
    }

    const app = await createApp()

    const response = await app.inject({
      method: 'PATCH',
      url: `/api/v1/projects/${projectId}/render-environment`,
      payload: {
        preset_id: 'studio',
        intensity: 1.4,
      },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json().active).toEqual({
      preset_id: 'studio',
      intensity: 1.4,
      rotation_deg: 120,
      ground_tint: '#88AA66',
    })

    expect(prismaMock.projectEnvironment.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: {
          config_json: {
            another_feature: { enabled: true },
            render_environment: {
              preset_id: 'studio',
              intensity: 1.4,
              rotation_deg: 120,
              ground_tint: '#88AA66',
            },
          },
        },
      }),
    )

    await app.close()
  })

  it('PATCH creates project environment row when it does not exist', async () => {
    const app = await createApp()

    const response = await app.inject({
      method: 'PATCH',
      url: `/api/v1/projects/${projectId}/render-environment`,
      payload: {
        preset_id: 'interior',
        rotation_deg: 90,
      },
    })

    expect(response.statusCode).toBe(200)
    expect(prismaMock.projectEnvironment.upsert).toHaveBeenCalledTimes(1)
    expect(response.json().active).toEqual({
      preset_id: 'interior',
      intensity: 1,
      rotation_deg: 90,
      ground_tint: '#9AB77C',
    })

    await app.close()
  })

  it('PATCH rejects empty payload', async () => {
    const app = await createApp()

    const response = await app.inject({
      method: 'PATCH',
      url: `/api/v1/projects/${projectId}/render-environment`,
      payload: {},
    })

    expect(response.statusCode).toBe(400)

    await app.close()
  })

  it('PATCH rejects invalid ground_tint', async () => {
    const app = await createApp()

    const response = await app.inject({
      method: 'PATCH',
      url: `/api/v1/projects/${projectId}/render-environment`,
      payload: {
        ground_tint: '#xyz123',
      },
    })

    expect(response.statusCode).toBe(400)

    await app.close()
  })

  it('returns 403 when tenant scope is missing', async () => {
    const app = await createApp(null)

    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectId}/render-environments`,
    })

    expect(response.statusCode).toBe(403)

    await app.close()
  })

  it('returns 404 when project does not belong to tenant', async () => {
    prismaMock.project.findUnique.mockResolvedValue({ id: projectId, tenant_id: 'tenant-other' })
    const app = await createApp()

    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectId}/render-environments`,
    })

    expect(response.statusCode).toBe(404)

    await app.close()
  })
})
