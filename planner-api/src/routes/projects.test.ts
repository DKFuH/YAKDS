import Fastify from 'fastify'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const TENANT_ID = 'tenant-1'
const USER_ID = 'user-1'

const { prismaMock } = vi.hoisted(() => {
  const projectFindMany = vi.fn()
  const projectFindUnique = vi.fn()
  const projectFindFirst = vi.fn()
  const projectCreate = vi.fn()
  const projectUpdate = vi.fn()
  const projectDelete = vi.fn()
  const areaCreate = vi.fn()
  const alternativeCreate = vi.fn()
  const userFindUnique = vi.fn()
  const tenantSettingFindUnique = vi.fn()

  return {
    prismaMock: {
      project: {
        findMany: projectFindMany,
        findUnique: projectFindUnique,
        findFirst: projectFindFirst,
        create: projectCreate,
        update: projectUpdate,
        delete: projectDelete,
      },
      user: {
        findUnique: userFindUnique,
      },
      tenantSetting: {
        findUnique: tenantSettingFindUnique,
      },
      area: {
        create: areaCreate,
      },
      alternative: {
        create: alternativeCreate,
      },
      projectVersion: {
        findFirst: vi.fn(),
        create: vi.fn(),
        findMany: vi.fn(),
      },
      room: {
        findMany: vi.fn(),
      },
      $transaction: vi.fn(async (handler: (tx: any) => Promise<any>) =>
        handler({
          project: {
            create: projectCreate,
            findUnique: projectFindUnique,
            findFirst: projectFindFirst,
            update: projectUpdate,
          },
          area: {
            create: areaCreate,
          },
          alternative: {
            create: alternativeCreate,
          },
          projectVersion: {
            findFirst: vi.fn(),
            create: vi.fn(),
          },
        })
      ),
    },
  }
})

vi.mock('../db.js', () => ({ prisma: prismaMock }))
vi.mock('../services/notificationService.js', () => ({
  queueNotification: vi.fn(),
}))

import { projectRoutes } from './projects.js'

function makeApp() {
  const app = Fastify()
  app.decorateRequest('tenantId', null)
  app.decorateRequest('branchId', null)
  app.addHook('preHandler', (request, _reply, done) => {
    request.tenantId = TENANT_ID
    done()
  })
  app.register(projectRoutes)
  return app
}

describe('projectRoutes', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    prismaMock.user.findUnique.mockResolvedValue({
      id: USER_ID,
      tenant_id: TENANT_ID,
      branch_id: 'branch-1',
    })

    prismaMock.tenantSetting.findUnique.mockResolvedValue({
      tenant_id: TENANT_ID,
      default_advisor: null,
      default_processor: null,
      default_area_name: null,
      default_alternative_name: null,
    })
  })

  it('GET /projects lists active projects in tenant scope', async () => {
    prismaMock.project.findMany.mockResolvedValue([
      { id: 'project-1', name: 'Kitchen', status: 'active', project_status: 'lead' },
    ])

    const app = makeApp()
    const response = await app.inject({ method: 'GET', url: '/projects' })

    expect(response.statusCode).toBe(200)
    expect(prismaMock.project.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenant_id: TENANT_ID,
          status: 'active',
        }),
      })
    )

    await app.close()
  })

  it('GET /projects supports include_archived=true', async () => {
    prismaMock.project.findMany.mockResolvedValue([
      { id: 'project-2', name: 'Archived', status: 'archived', project_status: 'archived' },
    ])

    const app = makeApp()
    const response = await app.inject({ method: 'GET', url: '/projects?include_archived=true' })

    expect(response.statusCode).toBe(200)
    expect(prismaMock.project.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenant_id: TENANT_ID }),
      })
    )
    expect(prismaMock.project.findMany.mock.calls[0][0].where.status).toBeUndefined()

    await app.close()
  })

  it('POST /projects creates project and default area/alternative', async () => {
    prismaMock.project.create.mockResolvedValue({
      id: 'project-3',
      tenant_id: TENANT_ID,
      name: 'Living Room',
      status: 'active',
      project_status: 'lead',
      assigned_to: null,
      advisor: null,
      archived_at: null,
      retention_until: null,
      archive_reason: null,
    })
    prismaMock.area.create.mockResolvedValue({ id: 'area-3' })
    prismaMock.alternative.create.mockResolvedValue({ id: 'alt-3' })

    const app = makeApp()
    const response = await app.inject({
      method: 'POST',
      url: '/projects',
      payload: {
        name: 'Living Room',
        user_id: USER_ID,
      },
    })

    expect(response.statusCode).toBe(201)
    expect(prismaMock.project.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'Living Room',
          user_id: USER_ID,
          tenant_id: TENANT_ID,
        }),
      })
    )
    expect(prismaMock.area.create).toHaveBeenCalled()
    expect(prismaMock.alternative.create).toHaveBeenCalled()

    await app.close()
  })

  it('POST /projects applies tenant defaults', async () => {
    prismaMock.tenantSetting.findUnique.mockResolvedValue({
      tenant_id: TENANT_ID,
      default_advisor: 'Default Advisor',
      default_processor: 'Default Processor',
      default_area_name: 'Basisbereich',
      default_alternative_name: 'Variante A',
    })
    prismaMock.project.create.mockResolvedValue({
      id: 'project-4',
      tenant_id: TENANT_ID,
      name: 'Defaults Project',
      status: 'active',
      project_status: 'lead',
      assigned_to: 'Default Processor',
      advisor: 'Default Advisor',
      archived_at: null,
      retention_until: null,
      archive_reason: null,
    })
    prismaMock.area.create.mockResolvedValue({ id: 'area-4' })
    prismaMock.alternative.create.mockResolvedValue({ id: 'alt-4' })

    const app = makeApp()
    const response = await app.inject({
      method: 'POST',
      url: '/projects',
      payload: {
        name: 'Defaults Project',
        user_id: USER_ID,
      },
    })

    expect(response.statusCode).toBe(201)
    expect(prismaMock.project.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          advisor: 'Default Advisor',
          assigned_to: 'Default Processor',
        }),
      })
    )
    expect(prismaMock.area.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ name: 'Basisbereich' }),
      })
    )
    expect(prismaMock.alternative.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ name: 'Variante A' }),
      })
    )

    await app.close()
  })

  it('POST /projects returns 404 when user does not exist', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null)

    const app = makeApp()
    const response = await app.inject({
      method: 'POST',
      url: '/projects',
      payload: {
        name: 'Unknown User Project',
        user_id: USER_ID,
      },
    })

    expect(response.statusCode).toBe(404)
    expect(prismaMock.project.create).not.toHaveBeenCalled()

    await app.close()
  })

  it('GET /projects/archive lists archived projects', async () => {
    prismaMock.project.findMany.mockResolvedValue([
      {
        id: 'project-5',
        name: 'Archived Project',
        status: 'archived',
        project_status: 'archived',
        archived_at: new Date('2026-03-04T00:00:00.000Z'),
      },
    ])

    const app = makeApp()
    const response = await app.inject({
      method: 'GET',
      url: '/projects/archive?archive_reason=customer',
    })

    expect(response.statusCode).toBe(200)
    expect(prismaMock.project.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenant_id: TENANT_ID,
          status: 'archived',
          archive_reason: expect.any(Object),
        }),
      })
    )

    await app.close()
  })

  it('POST /projects/:id/archive archives project with metadata', async () => {
    prismaMock.project.findFirst.mockResolvedValue({ id: 'project-6' })
    prismaMock.project.update.mockResolvedValue({
      id: 'project-6',
      status: 'archived',
      project_status: 'archived',
      archive_reason: 'manual',
      archived_at: new Date('2026-03-05T00:00:00.000Z'),
      retention_until: new Date('2028-03-04T00:00:00.000Z'),
    })

    const app = makeApp()
    const response = await app.inject({
      method: 'POST',
      url: '/projects/project-6/archive',
      payload: {
        archive_reason: 'manual',
        retention_days: 730,
      },
    })

    expect(response.statusCode).toBe(200)
    expect(prismaMock.project.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'project-6' },
        data: expect.objectContaining({
          status: 'archived',
          project_status: 'archived',
          archive_reason: 'manual',
        }),
      })
    )

    await app.close()
  })

  it('POST /projects/:id/archive returns 404 for missing project', async () => {
    prismaMock.project.findFirst.mockResolvedValue(null)

    const app = makeApp()
    const response = await app.inject({
      method: 'POST',
      url: '/projects/project-missing/archive',
      payload: { archive_reason: 'manual' },
    })

    expect(response.statusCode).toBe(404)
    expect(prismaMock.project.update).not.toHaveBeenCalled()

    await app.close()
  })

  it('POST /projects/:id/restore restores archived project', async () => {
    prismaMock.project.findFirst.mockResolvedValue({ id: 'project-7' })
    prismaMock.project.update.mockResolvedValue({
      id: 'project-7',
      status: 'active',
      project_status: 'lead',
      archived_at: null,
      retention_until: null,
      archive_reason: null,
    })

    const app = makeApp()
    const response = await app.inject({
      method: 'POST',
      url: '/projects/project-7/restore',
    })

    expect(response.statusCode).toBe(200)
    expect(prismaMock.project.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'project-7' },
        data: {
          status: 'active',
          project_status: 'lead',
          archived_at: null,
          retention_until: null,
          archive_reason: null,
        },
      })
    )

    await app.close()
  })

  it('PATCH /projects/:id/status updates project workflow status', async () => {
    prismaMock.project.findUnique.mockResolvedValue({ id: 'project-8' })
    prismaMock.project.update.mockResolvedValue({
      id: 'project-8',
      status: 'archived',
      project_status: 'archived',
    })

    const app = makeApp()
    const response = await app.inject({
      method: 'PATCH',
      url: '/projects/project-8/status',
      payload: {
        project_status: 'archived',
      },
    })

    expect(response.statusCode).toBe(200)
    expect(prismaMock.project.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'project-8' },
        data: expect.objectContaining({
          project_status: 'archived',
          status: 'archived',
        }),
      })
    )

    await app.close()
  })

  it('PATCH /projects/:id/3dots archives and unarchives project', async () => {
    prismaMock.project.findUnique.mockResolvedValue({
      id: 'project-9',
      user_id: USER_ID,
      name: 'Three Dots',
      description: null,
      deadline: null,
      priority: 'medium',
      assigned_to: null,
      advisor: null,
      sales_rep: null,
      tenant_id: TENANT_ID,
      branch_id: 'branch-1',
    })
    prismaMock.project.update
      .mockResolvedValueOnce({ id: 'project-9', status: 'archived', project_status: 'archived' })
      .mockResolvedValueOnce({ id: 'project-9', status: 'active', project_status: 'lead' })

    const app = makeApp()

    const archiveResponse = await app.inject({
      method: 'PATCH',
      url: '/projects/project-9/3dots?action=archive',
    })
    expect(archiveResponse.statusCode).toBe(200)

    const unarchiveResponse = await app.inject({
      method: 'PATCH',
      url: '/projects/project-9/3dots?action=unarchive',
    })
    expect(unarchiveResponse.statusCode).toBe(200)

    await app.close()
  })

  it('GET /projects/board returns board list in tenant scope', async () => {
    prismaMock.project.findMany.mockResolvedValue([
      { id: 'project-10', name: 'A', status: 'active', project_status: 'lead' },
      { id: 'project-11', name: 'B', status: 'active', project_status: 'approved' },
    ])

    const app = makeApp()
    const response = await app.inject({ method: 'GET', url: '/projects/board' })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toHaveLength(2)

    await app.close()
  })
})
