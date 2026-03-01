import Fastify from 'fastify'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    project: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    projectVersion: {
      findFirst: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

prismaMock.$transaction.mockImplementation(async (callback: (tx: typeof prismaMock) => Promise<unknown>) => callback(prismaMock))

vi.mock('../db.js', () => ({
  prisma: prismaMock,
}))

import { projectRoutes } from './projects.js'

const projectId = '11111111-1111-1111-1111-111111111111'

const boardProject = {
  id: projectId,
  user_id: 'dev-user-id',
  name: 'Studio Nord',
  description: 'Phase-3 Pilotprojekt',
  status: 'active',
  project_status: 'planning',
  deadline: new Date('2026-03-20T00:00:00.000Z'),
  priority: 'high',
  assigned_to: 'Planung Team',
  progress_pct: 42,
  lead_status: 'qualified',
  quote_value: 18000,
  close_probability: 70,
  tenant_id: null,
  branch_id: null,
  created_at: new Date('2026-03-01T00:00:00.000Z'),
  updated_at: new Date('2026-03-02T00:00:00.000Z'),
  _count: { rooms: 2, quotes: 1 },
}

describe('projectRoutes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns board projects filtered for sprint 25 workflow', async () => {
    prismaMock.project.findMany.mockResolvedValue([boardProject])

    const app = Fastify()
    await app.register(projectRoutes, { prefix: '/api/v1' })

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/projects/board?user_id=dev-user-id&status_filter=planning',
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: projectId,
        project_status: 'planning',
        priority: 'high',
      }),
    ]))
    expect(prismaMock.project.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        user_id: 'dev-user-id',
        project_status: 'planning',
        status: 'active',
      }),
    }))

    await app.close()
  })

  it('updates only the workflow status through the dedicated status endpoint', async () => {
    prismaMock.project.findUnique.mockResolvedValue({ id: projectId })
    prismaMock.project.update.mockResolvedValue({
      ...boardProject,
      project_status: 'quoted',
      progress_pct: 55,
    })

    const app = Fastify()
    await app.register(projectRoutes, { prefix: '/api/v1' })

    const response = await app.inject({
      method: 'PATCH',
      url: `/api/v1/projects/${projectId}/status`,
      payload: {
        project_status: 'quoted',
        progress_pct: 55,
      },
    })

    expect(response.statusCode).toBe(200)
    expect(prismaMock.project.update).toHaveBeenCalledWith({
      where: { id: projectId },
      data: {
        project_status: 'quoted',
        progress_pct: 55,
        status: 'active',
      },
      select: expect.any(Object),
    })

    await app.close()
  })

  it('updates assignment metadata through the assign endpoint', async () => {
    prismaMock.project.findUnique.mockResolvedValue({ id: projectId })
    prismaMock.project.update.mockResolvedValue({
      ...boardProject,
      assigned_to: 'Montage Team',
      priority: 'medium',
      progress_pct: 60,
    })

    const app = Fastify()
    await app.register(projectRoutes, { prefix: '/api/v1' })

    const response = await app.inject({
      method: 'PATCH',
      url: `/api/v1/projects/${projectId}/assign`,
      payload: {
        assigned_to: 'Montage Team',
        priority: 'medium',
        deadline: '2026-03-25T00:00:00.000Z',
        progress_pct: 60,
      },
    })

    expect(response.statusCode).toBe(200)
    expect(prismaMock.project.update).toHaveBeenCalledWith({
      where: { id: projectId },
      data: expect.objectContaining({
        assigned_to: 'Montage Team',
        priority: 'medium',
        progress_pct: 60,
      }),
      select: expect.any(Object),
    })

    await app.close()
  })
})
