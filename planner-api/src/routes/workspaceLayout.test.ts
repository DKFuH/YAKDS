import Fastify from 'fastify'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const userId = 'dev-user-id'

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    userWorkspaceLayout: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  },
}))

vi.mock('../db.js', () => ({
  prisma: prismaMock,
}))

import { workspaceLayoutRoutes } from './workspaceLayout.js'

describe('workspaceLayoutRoutes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns empty layout when no layout is stored', async () => {
    prismaMock.userWorkspaceLayout.findUnique.mockResolvedValue(null)

    const app = Fastify()
    await app.register(workspaceLayoutRoutes, { prefix: '/api/v1' })

    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/user/workspace-layout?user_id=${userId}`,
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({ user_id: userId, layout_json: {} })

    await app.close()
  })

  it('returns stored layout for the user', async () => {
    const layout = { user_id: userId, layout_json: { panels: ['2d', '3d'], ratio: 0.6 } }
    prismaMock.userWorkspaceLayout.findUnique.mockResolvedValue(layout)

    const app = Fastify()
    await app.register(workspaceLayoutRoutes, { prefix: '/api/v1' })

    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/user/workspace-layout?user_id=${userId}`,
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({ user_id: userId, layout_json: { ratio: 0.6 } })

    await app.close()
  })

  it('returns 400 when user_id is missing', async () => {
    const app = Fastify()
    await app.register(workspaceLayoutRoutes, { prefix: '/api/v1' })

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/user/workspace-layout',
    })

    expect(response.statusCode).toBe(400)

    await app.close()
  })

  it('saves workspace layout via PUT', async () => {
    const layoutJson = { panels: ['floor', 'perspective'], ratio: 0.5 }
    const saved = { user_id: userId, layout_json: layoutJson }
    prismaMock.userWorkspaceLayout.upsert.mockResolvedValue(saved)

    const app = Fastify()
    await app.register(workspaceLayoutRoutes, { prefix: '/api/v1' })

    const response = await app.inject({
      method: 'PUT',
      url: `/api/v1/user/workspace-layout?user_id=${userId}`,
      payload: { layout_json: layoutJson },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({ user_id: userId, layout_json: layoutJson })
    expect(prismaMock.userWorkspaceLayout.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { user_id: userId },
      create: expect.objectContaining({ user_id: userId, layout_json: layoutJson }),
      update: expect.objectContaining({ layout_json: layoutJson }),
    }))

    await app.close()
  })

  it('returns 400 when layout_json is missing in PUT', async () => {
    const app = Fastify()
    await app.register(workspaceLayoutRoutes, { prefix: '/api/v1' })

    const response = await app.inject({
      method: 'PUT',
      url: `/api/v1/user/workspace-layout?user_id=${userId}`,
      payload: {},
    })

    expect(response.statusCode).toBe(400)

    await app.close()
  })
})
