import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../db.js'
import { sendBadRequest, sendForbidden, sendNotFound } from '../errors.js'

const DEFAULT_LEVEL_NAME = 'EG'
const FALLBACK_TENANT_ID = '00000000-0000-0000-0000-000000000001'

const CreateLevelSchema = z.object({
  name: z.string().min(1).max(120),
  elevation_mm: z.number().int().min(-50000).max(50000).optional(),
  height_mm: z.number().int().min(500).max(10000).nullable().optional(),
  order_index: z.number().int().min(0).optional(),
  visible: z.boolean().optional(),
  config_json: z.record(z.unknown()).optional(),
})

const UpdateLevelSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  elevation_mm: z.number().int().min(-50000).max(50000).optional(),
  height_mm: z.number().int().min(500).max(10000).nullable().optional(),
  order_index: z.number().int().min(0).optional(),
  visible: z.boolean().optional(),
  config_json: z.record(z.unknown()).optional(),
})

function resolveTenantId(request: {
  tenantId?: string | null
  headers?: Record<string, string | string[] | undefined>
}): string | null {
  if (request.tenantId) {
    return request.tenantId
  }

  const tenantHeader = request.headers?.['x-tenant-id']
  if (!tenantHeader) {
    return null
  }

  return Array.isArray(tenantHeader) ? (tenantHeader[0] ?? null) : tenantHeader
}

function normalizeLevelName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').slice(0, 120)
}

async function resolveScopedProject(projectId: string, tenantId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, tenant_id: true },
  })

  if (!project) {
    return null
  }

  if (project.tenant_id && project.tenant_id !== tenantId) {
    return null
  }

  return project
}

async function ensureDefaultLevel(params: { projectId: string; tenantId: string; projectTenantId: string | null }) {
  const existing = await prisma.buildingLevel.findFirst({
    where: { project_id: params.projectId },
    orderBy: [{ order_index: 'asc' }, { created_at: 'asc' }],
  })

  const level = existing ?? await prisma.buildingLevel.create({
    data: {
      tenant_id: params.projectTenantId ?? params.tenantId ?? FALLBACK_TENANT_ID,
      project_id: params.projectId,
      name: DEFAULT_LEVEL_NAME,
      elevation_mm: 0,
      order_index: 0,
      visible: true,
      config_json: {},
    },
  })

  const assignResult = await prisma.room.updateMany({
    where: {
      project_id: params.projectId,
      level_id: null,
    },
    data: { level_id: level.id },
  })

  return {
    level,
    created: !existing,
    assignedRooms: assignResult.count,
  }
}

export async function levelsRoutes(app: FastifyInstance) {
  app.get<{ Params: { id: string } }>('/projects/:id/levels', async (request, reply) => {
    const tenantId = resolveTenantId(request)
    if (!tenantId) {
      return sendForbidden(reply, 'Tenant scope is required')
    }

    const project = await resolveScopedProject(request.params.id, tenantId)
    if (!project) {
      return sendNotFound(reply, 'Project not found in tenant scope')
    }

    await ensureDefaultLevel({
      projectId: project.id,
      tenantId,
      projectTenantId: project.tenant_id,
    })

    const levels = await prisma.buildingLevel.findMany({
      where: { project_id: project.id },
      orderBy: [{ order_index: 'asc' }, { created_at: 'asc' }],
    })

    return reply.send(levels)
  })

  app.post<{ Params: { id: string } }>('/projects/:id/levels', async (request, reply) => {
    const tenantId = resolveTenantId(request)
    if (!tenantId) {
      return sendForbidden(reply, 'Tenant scope is required')
    }

    const parsed = CreateLevelSchema.safeParse(request.body)
    if (!parsed.success) {
      return sendBadRequest(reply, parsed.error.errors[0]?.message ?? 'Invalid payload')
    }

    const project = await resolveScopedProject(request.params.id, tenantId)
    if (!project) {
      return sendNotFound(reply, 'Project not found in tenant scope')
    }

    const maxOrderLevel = await prisma.buildingLevel.findFirst({
      where: { project_id: project.id },
      orderBy: { order_index: 'desc' },
      select: { order_index: true },
    })

    const level = await prisma.buildingLevel.create({
      data: {
        tenant_id: project.tenant_id ?? tenantId,
        project_id: project.id,
        name: normalizeLevelName(parsed.data.name),
        elevation_mm: parsed.data.elevation_mm ?? 0,
        height_mm: parsed.data.height_mm,
        order_index: parsed.data.order_index ?? ((maxOrderLevel?.order_index ?? -1) + 1),
        visible: parsed.data.visible ?? true,
        config_json: parsed.data.config_json ?? {},
      },
    })

    return reply.status(201).send(level)
  })

  app.patch<{ Params: { id: string } }>('/levels/:id', async (request, reply) => {
    const tenantId = resolveTenantId(request)
    if (!tenantId) {
      return sendForbidden(reply, 'Tenant scope is required')
    }

    const parsed = UpdateLevelSchema.safeParse(request.body)
    if (!parsed.success) {
      return sendBadRequest(reply, parsed.error.errors[0]?.message ?? 'Invalid payload')
    }

    const level = await prisma.buildingLevel.findUnique({ where: { id: request.params.id } })
    if (!level) {
      return sendNotFound(reply, 'Level not found')
    }

    const project = await resolveScopedProject(level.project_id, tenantId)
    if (!project) {
      return sendNotFound(reply, 'Level not found in tenant scope')
    }

    const updated = await prisma.buildingLevel.update({
      where: { id: level.id },
      data: {
        ...(parsed.data.name !== undefined ? { name: normalizeLevelName(parsed.data.name) } : {}),
        ...(parsed.data.elevation_mm !== undefined ? { elevation_mm: parsed.data.elevation_mm } : {}),
        ...(parsed.data.height_mm !== undefined ? { height_mm: parsed.data.height_mm } : {}),
        ...(parsed.data.order_index !== undefined ? { order_index: parsed.data.order_index } : {}),
        ...(parsed.data.visible !== undefined ? { visible: parsed.data.visible } : {}),
        ...(parsed.data.config_json !== undefined ? { config_json: parsed.data.config_json } : {}),
      },
    })

    return reply.send(updated)
  })

  app.delete<{ Params: { id: string } }>('/levels/:id', async (request, reply) => {
    const tenantId = resolveTenantId(request)
    if (!tenantId) {
      return sendForbidden(reply, 'Tenant scope is required')
    }

    const level = await prisma.buildingLevel.findUnique({ where: { id: request.params.id } })
    if (!level) {
      return sendNotFound(reply, 'Level not found')
    }

    const project = await resolveScopedProject(level.project_id, tenantId)
    if (!project) {
      return sendNotFound(reply, 'Level not found in tenant scope')
    }

    const allLevels = await prisma.buildingLevel.findMany({
      where: { project_id: level.project_id },
      orderBy: [{ order_index: 'asc' }, { created_at: 'asc' }],
    })

    if (allLevels.length <= 1) {
      return sendBadRequest(reply, 'At least one level must remain in project')
    }

    const fallbackLevel = allLevels.find((entry) => entry.id !== level.id)
    if (!fallbackLevel) {
      return sendBadRequest(reply, 'Fallback level is missing')
    }

    await prisma.$transaction([
      prisma.room.updateMany({
        where: { level_id: level.id },
        data: { level_id: fallbackLevel.id },
      }),
      prisma.buildingLevel.delete({ where: { id: level.id } }),
    ])

    return reply.status(204).send()
  })

  app.post<{ Params: { id: string } }>('/projects/:id/levels/bootstrap', async (request, reply) => {
    const tenantId = resolveTenantId(request)
    if (!tenantId) {
      return sendForbidden(reply, 'Tenant scope is required')
    }

    const project = await resolveScopedProject(request.params.id, tenantId)
    if (!project) {
      return sendNotFound(reply, 'Project not found in tenant scope')
    }

    const bootstrap = await ensureDefaultLevel({
      projectId: project.id,
      tenantId,
      projectTenantId: project.tenant_id,
    })

    const levels = await prisma.buildingLevel.findMany({
      where: { project_id: project.id },
      orderBy: [{ order_index: 'asc' }, { created_at: 'asc' }],
    })

    return reply.send({
      default_level_id: bootstrap.level.id,
      created_default_level: bootstrap.created,
      assigned_rooms: bootstrap.assignedRooms,
      levels,
    })
  })
}
