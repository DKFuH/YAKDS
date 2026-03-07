import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../db.js'
import { sendBadRequest, sendNotFound } from '../errors.js'
import { queueNotification } from '../services/notificationService.js'

const projectWorkflowStatusValues = [
  'lead',
  'planning',
  'quoted',
  'contract',
  'production',
  'installed',
  'archived',
] as const

const projectPriorityValues = ['low', 'medium', 'high'] as const

const CreateProjectSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  user_id: z.string().min(1).max(200),
})

const UpdateProjectSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).nullable().optional(),
  status: z.enum(['active', 'archived']).optional(),
  project_status: z.enum(projectWorkflowStatusValues).optional(),
  deadline: z.string().datetime().nullable().optional(),
  priority: z.enum(projectPriorityValues).optional(),
  assigned_to: z.string().min(1).max(200).nullable().optional(),
  progress_pct: z.number().int().min(0).max(100).optional(),
})

const UpdateProjectStatusSchema = z.object({
  project_status: z.enum(projectWorkflowStatusValues),
  progress_pct: z.number().int().min(0).max(100).optional(),
})

const AssignProjectSchema = z.object({
  assigned_to: z.string().min(1).max(200).nullable().optional(),
  priority: z.enum(projectPriorityValues).optional(),
  deadline: z.string().datetime().nullable().optional(),
  progress_pct: z.number().int().min(0).max(100).optional(),
})

const CreateVersionBodySchema = z.object({
  label: z.string().min(1).max(200).optional().nullable(),
})

const ProjectListQuerySchema = z.object({
  user_id: z.string().min(1).optional(),
  search: z.string().min(1).max(200).optional(),
  status_filter: z.enum(projectWorkflowStatusValues).optional(),
  sales_rep: z.string().min(1).max(200).optional(),
  include_archived: z.coerce.boolean().optional(),
})

const ProjectArchiveQuerySchema = z.object({
  search: z.string().min(1).max(200).optional(),
  archive_reason: z.string().min(1).max(500).optional(),
  retention_until_before: z.string().datetime().optional(),
  retention_until_after: z.string().datetime().optional(),
})

const ArchiveProjectBodySchema = z.object({
  archive_reason: z.string().min(1).max(500).optional(),
  retention_days: z.number().int().min(1).max(3650).optional(),
})

const ProjectBoardQuerySchema = z.object({
  user_id: z.string().min(1).optional(),
  branch_id: z.string().min(1).optional(),
  status_filter: z.enum(projectWorkflowStatusValues).optional(),
})

function parseOptionalDate(value: string | null | undefined): Date | null | undefined {
  if (value === undefined) {
    return undefined
  }
  if (value === null) {
    return null
  }
  return new Date(value)
}

function parseLockedBy(raw: string | null | undefined): { user: string | null; host: string | null } {
  if (!raw) {
    return { user: null, host: null }
  }

  const atIndex = raw.lastIndexOf('@')
  if (atIndex > 0 && atIndex < raw.length - 1) {
    const userPart = raw.slice(0, atIndex)
    const hostPart = raw.slice(atIndex + 1)
    return {
      user: userPart || null,
      host: hostPart || null,
    }
  }

  return {
    user: raw,
    host: null,
  }
}

function projectBoardSelect() {
  return {
    id: true,
    user_id: true,
    name: true,
    description: true,
    status: true,
    project_status: true,
    deadline: true,
    priority: true,
    assigned_to: true,
    advisor: true,
    sales_rep: true,
    archived_at: true,
    retention_until: true,
    archive_reason: true,
    progress_pct: true,
    lead_status: true,
    quote_value: true,
    close_probability: true,
    tenant_id: true,
    branch_id: true,
    created_at: true,
    updated_at: true,
    _count: { select: { rooms: true, quotes: true } },
  } as const
}

function resolveTenantScope(request: { tenantId?: string | null }) {
  return request.tenantId ? { tenant_id: request.tenantId } : {}
}

export async function projectRoutes(app: FastifyInstance) {
  app.get<{
    Querystring: {
      user_id?: string
      search?: string
      status_filter?: string
      sales_rep?: string
      include_archived?: boolean
    }
  }>('/projects', async (request, reply) => {
    const parsedQuery = ProjectListQuerySchema.safeParse(request.query)
    if (!parsedQuery.success) {
      return sendBadRequest(reply, parsedQuery.error.errors[0]?.message ?? 'Invalid query')
    }

    const { user_id, search, status_filter, sales_rep, include_archived } = parsedQuery.data

    const projects = await prisma.project.findMany({
      where: {
        ...(user_id ? { user_id } : {}),
        ...resolveTenantScope(request),
        ...(!include_archived ? { status: 'active' } : {}),
        ...(status_filter ? { project_status: status_filter as typeof projectWorkflowStatusValues[number] } : {}),
        ...(sales_rep ? { sales_rep } : {}),
        ...(search
          ? { name: { contains: search, mode: 'insensitive' } }
          : {}),
      },
      orderBy: { updated_at: 'desc' },
      select: projectBoardSelect(),
    })

    return reply.send(projects)
  })

  app.get<{
    Querystring: {
      search?: string
      archive_reason?: string
      retention_until_before?: string
      retention_until_after?: string
    }
  }>('/projects/archive', async (request, reply) => {
    const parsedQuery = ProjectArchiveQuerySchema.safeParse(request.query)
    if (!parsedQuery.success) {
      return sendBadRequest(reply, parsedQuery.error.errors[0]?.message ?? 'Invalid query')
    }

    const retentionUntilBefore = parsedQuery.data.retention_until_before
      ? new Date(parsedQuery.data.retention_until_before)
      : undefined
    const retentionUntilAfter = parsedQuery.data.retention_until_after
      ? new Date(parsedQuery.data.retention_until_after)
      : undefined

    const projects = await prisma.project.findMany({
      where: {
        ...resolveTenantScope(request),
        status: 'archived',
        ...(parsedQuery.data.search
          ? { name: { contains: parsedQuery.data.search, mode: 'insensitive' } }
          : {}),
        ...(parsedQuery.data.archive_reason
          ? { archive_reason: { contains: parsedQuery.data.archive_reason, mode: 'insensitive' } }
          : {}),
        ...((retentionUntilBefore || retentionUntilAfter)
          ? {
              retention_until: {
                ...(retentionUntilAfter ? { gte: retentionUntilAfter } : {}),
                ...(retentionUntilBefore ? { lte: retentionUntilBefore } : {}),
              },
            }
          : {}),
      },
      orderBy: [
        { archived_at: 'desc' },
        { updated_at: 'desc' },
      ],
      select: projectBoardSelect(),
    })

    return reply.send(projects)
  })

  app.get<{
    Querystring: {
      user_id?: string
      branch_id?: string
      status_filter?: typeof projectWorkflowStatusValues[number]
    }
  }>('/projects/board', async (request, reply) => {
    const parsedQuery = ProjectBoardQuerySchema.safeParse(request.query)
    if (!parsedQuery.success) {
      return sendBadRequest(reply, parsedQuery.error.errors[0]?.message ?? 'Invalid query')
    }

    const { user_id, branch_id, status_filter } = parsedQuery.data
    const tenantId = request.tenantId

    const projects = await prisma.project.findMany({
      where: {
        ...(user_id ? { user_id } : {}),
        ...(tenantId ? { tenant_id: tenantId } : {}),
        ...(branch_id ?? request.branchId ? { branch_id: branch_id ?? request.branchId ?? undefined } : {}),
        ...(status_filter ? { project_status: status_filter } : {}),
        status: 'active',
      },
      orderBy: [
        { priority: 'desc' },
        { updated_at: 'desc' },
      ],
      select: projectBoardSelect(),
    })

    return reply.send(projects)
  })

  app.get<{ Querystring: { user_id?: string; branch_id?: string } }>('/projects/gantt', async (request, reply) => {
    const parsedQuery = ProjectBoardQuerySchema.omit({ status_filter: true }).safeParse(request.query)
    if (!parsedQuery.success) {
      return sendBadRequest(reply, parsedQuery.error.errors[0]?.message ?? 'Invalid query')
    }

    const { user_id, branch_id } = parsedQuery.data
    const tenantId = request.tenantId

    const projects = await prisma.project.findMany({
      where: {
        ...(user_id ? { user_id } : {}),
        ...(tenantId ? { tenant_id: tenantId } : {}),
        ...(branch_id ?? request.branchId ? { branch_id: branch_id ?? request.branchId ?? undefined } : {}),
        status: 'active',
      },
      orderBy: [
        { deadline: 'asc' },
        { updated_at: 'desc' },
      ],
      select: projectBoardSelect(),
    })

    return reply.send(
      projects.map((project) => ({
        ...project,
        start_at: project.created_at,
        end_at: project.deadline,
      })),
    )
  })

  app.post('/projects', async (request, reply) => {
    const parsed = CreateProjectSchema.safeParse(request.body)
    if (!parsed.success) {
      return sendBadRequest(reply, parsed.error.errors[0]?.message ?? 'Invalid payload')
    }

    const { name, description, user_id } = parsed.data
    const user = await prisma.user.upsert({
      where: { id: user_id },
      update: {},
      create: {
        id: user_id,
        email: `${user_id}@okp.local`,
        name: user_id,
        password_hash: '',
      },
    })

    const tenantId = user.tenant_id ?? request.tenantId ?? null
    const defaults = tenantId
      ? await prisma.tenantSetting.findUnique({
          where: { tenant_id: tenantId },
          select: {
            default_advisor: true,
            default_processor: true,
            default_area_name: true,
            default_alternative_name: true,
          },
        })
      : null

    const defaultAreaName = defaults?.default_area_name?.trim() || 'Bereich 1'
    const defaultAlternativeName = defaults?.default_alternative_name?.trim() || 'Variante A'

    const project = await prisma.$transaction(async (tx) => {
      const created = await tx.project.create({
        data: {
          name,
          description,
          user_id,
          tenant_id: tenantId ?? undefined,
          branch_id: user.branch_id ?? request.branchId ?? undefined,
          advisor: defaults?.default_advisor?.trim() || null,
          assigned_to: defaults?.default_processor?.trim() || null,
        },
        select: projectBoardSelect(),
      })

      const area = await tx.area.create({
        data: {
          project_id: created.id,
          name: defaultAreaName,
          sort_order: 0,
        },
      })

      await tx.alternative.create({
        data: {
          area_id: area.id,
          name: defaultAlternativeName,
          is_active: true,
          sort_order: 0,
        },
      })

      return created
    })

    return reply.status(201).send(project)
  })

  app.post<{ Params: { id: string } }>('/projects/:id/archive', async (request, reply) => {
    const parsedBody = ArchiveProjectBodySchema.safeParse(request.body ?? {})
    if (!parsedBody.success) {
      return sendBadRequest(reply, parsedBody.error.errors[0]?.message ?? 'Invalid payload')
    }

    const existing = await prisma.project.findFirst({
      where: {
        id: request.params.id,
        ...resolveTenantScope(request),
      },
      select: { id: true },
    })
    if (!existing) {
      return sendNotFound(reply, 'Project not found')
    }

    const now = new Date()
    const retentionDays = parsedBody.data.retention_days ?? 365
    const retentionUntil = new Date(now.getTime() + retentionDays * 24 * 60 * 60 * 1000)

    const project = await prisma.project.update({
      where: { id: request.params.id },
      data: {
        status: 'archived',
        project_status: 'archived',
        archived_at: now,
        retention_until: retentionUntil,
        archive_reason: parsedBody.data.archive_reason ?? null,
      },
      select: projectBoardSelect(),
    })

    return reply.send(project)
  })

  app.post<{ Params: { id: string } }>('/projects/:id/restore', async (request, reply) => {
    const existing = await prisma.project.findFirst({
      where: {
        id: request.params.id,
        ...resolveTenantScope(request),
      },
      select: { id: true },
    })
    if (!existing) {
      return sendNotFound(reply, 'Project not found')
    }

    const project = await prisma.project.update({
      where: { id: request.params.id },
      data: {
        status: 'active',
        project_status: 'lead',
        archived_at: null,
        retention_until: null,
        archive_reason: null,
      },
      select: projectBoardSelect(),
    })

    return reply.send(project)
  })

  app.get<{ Params: { id: string } }>('/projects/:id', async (request, reply) => {
    const project = await prisma.project.findUnique({
      where: { id: request.params.id },
      include: {
        rooms: true,
        quotes: {
          select: { id: true, version: true, quote_number: true, status: true, valid_until: true },
          orderBy: { version: 'desc' },
        },
      },
    })

    if (!project) {
      return sendNotFound(reply, 'Project not found')
    }

    return reply.send(project)
  })

  app.get<{ Params: { id: string } }>('/projects/:id/lock-state', async (request, reply) => {
    const project = await prisma.project.findFirst({
      where: {
        id: request.params.id,
        ...resolveTenantScope(request),
      },
      select: { id: true },
    })

    if (!project) {
      return sendNotFound(reply, 'Project not found')
    }

    const lockedAlternative = await prisma.alternative.findFirst({
      where: {
        area: {
          project_id: request.params.id,
        },
        locked_at: {
          not: null,
        },
      },
      orderBy: {
        locked_at: 'desc',
      },
      select: {
        id: true,
        locked_by: true,
        locked_at: true,
      },
    })

    const parsedActor = parseLockedBy(lockedAlternative?.locked_by ?? null)

    return reply.send({
      project_id: request.params.id,
      locked: Boolean(lockedAlternative),
      alternative_id: lockedAlternative?.id ?? null,
      locked_by_user: parsedActor.user,
      locked_by_host: parsedActor.host,
      locked_at: lockedAlternative?.locked_at ?? null,
    })
  })

  app.put<{ Params: { id: string } }>('/projects/:id', async (request, reply) => {
    const parsed = UpdateProjectSchema.safeParse(request.body)
    if (!parsed.success) {
      return sendBadRequest(reply, parsed.error.errors[0]?.message ?? 'Invalid payload')
    }

    const existing = await prisma.project.findUnique({ where: { id: request.params.id } })
    if (!existing) {
      return sendNotFound(reply, 'Project not found')
    }

    const project = await prisma.project.update({
      where: { id: request.params.id },
      data: {
        ...parsed.data,
        deadline: parseOptionalDate(parsed.data.deadline),
      },
      select: projectBoardSelect(),
    })

    return reply.send(project)
  })

  app.patch<{ Params: { id: string } }>('/projects/:id/status', async (request, reply) => {
    const parsed = UpdateProjectStatusSchema.safeParse(request.body)
    if (!parsed.success) {
      return sendBadRequest(reply, parsed.error.errors[0]?.message ?? 'Invalid payload')
    }

    const existing = await prisma.project.findUnique({ where: { id: request.params.id } })
    if (!existing) {
      return sendNotFound(reply, 'Project not found')
    }

    const project = await prisma.project.update({
      where: { id: request.params.id },
      data: {
        project_status: parsed.data.project_status,
        ...(parsed.data.progress_pct !== undefined ? { progress_pct: parsed.data.progress_pct } : {}),
        ...(parsed.data.project_status === 'archived' ? { status: 'archived' } : { status: 'active' }),
      },
      select: projectBoardSelect(),
    })

    if (project.tenant_id) {
      await queueNotification({
        tenantId: project.tenant_id,
        eventType: 'project_status_changed',
        entityType: 'project',
        entityId: project.id,
        recipientEmail: `alerts+${project.tenant_id}@okp.local`,
        subject: `Projektstatus geändert: ${project.name}`,
        message: `Projekt ${project.name} wurde auf ${project.project_status} gesetzt.`,
        metadata: {
          project_status: project.project_status,
          progress_pct: project.progress_pct,
        },
      })
    }

    return reply.send(project)
  })

  app.patch<{ Params: { id: string } }>('/projects/:id/assign', async (request, reply) => {
    const parsed = AssignProjectSchema.safeParse(request.body)
    if (!parsed.success) {
      return sendBadRequest(reply, parsed.error.errors[0]?.message ?? 'Invalid payload')
    }

    const existing = await prisma.project.findUnique({ where: { id: request.params.id } })
    if (!existing) {
      return sendNotFound(reply, 'Project not found')
    }

    const project = await prisma.project.update({
      where: { id: request.params.id },
      data: {
        ...(parsed.data.assigned_to !== undefined ? { assigned_to: parsed.data.assigned_to } : {}),
        ...(parsed.data.priority !== undefined ? { priority: parsed.data.priority } : {}),
        ...(parsed.data.progress_pct !== undefined ? { progress_pct: parsed.data.progress_pct } : {}),
        ...(parsed.data.deadline !== undefined ? { deadline: parseOptionalDate(parsed.data.deadline) } : {}),
      },
      select: projectBoardSelect(),
    })

    return reply.send(project)
  })

  app.delete<{ Params: { id: string } }>('/projects/:id', async (request, reply) => {
    const existing = await prisma.project.findUnique({ where: { id: request.params.id } })
    if (!existing) {
      return sendNotFound(reply, 'Project not found')
    }

    await prisma.project.delete({ where: { id: request.params.id } })
    return reply.status(204).send()
  })

  app.post<{ Params: { id: string } }>('/projects/:id/versions', async (request, reply) => {
    const parsedBody = CreateVersionBodySchema.safeParse(request.body)
    if (!parsedBody.success) {
      return sendBadRequest(reply, parsedBody.error.errors[0]?.message ?? 'Invalid payload')
    }

    const project = await prisma.project.findUnique({
      where: { id: request.params.id },
      include: { rooms: true },
    })

    if (!project) {
      return sendNotFound(reply, 'Project not found')
    }

    const version = await prisma.$transaction(async (tx) => {
      const lastVersion = await tx.projectVersion.findFirst({
        where: { project_id: request.params.id },
        orderBy: { version: 'desc' },
      })

      return tx.projectVersion.create({
        data: {
          project_id: request.params.id,
          version: (lastVersion?.version ?? 0) + 1,
          snapshot: project as object,
          label: parsedBody.data.label ?? null,
        },
      })
    })

    return reply.status(201).send(version)
  })

  app.get<{ Params: { id: string } }>('/projects/:id/versions', async (request, reply) => {
    const versions = await prisma.projectVersion.findMany({
      where: { project_id: request.params.id },
      orderBy: { version: 'desc' },
      select: { id: true, version: true, label: true, created_at: true },
    })

    return reply.send(versions)
  })

  // Sprint 34: Fachberater/Sachbearbeiter zuweisen
  const AdvisorSchema = z.object({
    advisor: z.string().min(1).max(200).nullable(),
    sales_rep: z.string().min(1).max(200).nullable().optional(),
  })

  app.patch<{ Params: { id: string } }>('/projects/:id/advisor', async (request, reply) => {
    const parsed = AdvisorSchema.safeParse(request.body)
    if (!parsed.success) {
      return sendBadRequest(reply, parsed.error.errors[0]?.message ?? 'Invalid payload')
    }

    const existing = await prisma.project.findUnique({ where: { id: request.params.id } })
    if (!existing) {
      return sendNotFound(reply, 'Project not found')
    }

    const project = await prisma.project.update({
      where: { id: request.params.id },
      data: {
        ...(parsed.data.advisor !== undefined ? { advisor: parsed.data.advisor } : {}),
        ...(parsed.data.sales_rep !== undefined ? { sales_rep: parsed.data.sales_rep } : {}),
      },
      select: projectBoardSelect(),
    })

    return reply.send(project)
  })

  // Sprint 31: 3-Punkte-Menü – duplicate / archive
  const ThreeDotsQuerySchema = z.object({
    action: z.enum(['duplicate', 'archive', 'unarchive']),
  })

  app.patch<{ Params: { id: string }; Querystring: { action?: string } }>('/projects/:id/3dots', async (request, reply) => {
    const parsedQuery = ThreeDotsQuerySchema.safeParse(request.query)
    if (!parsedQuery.success) {
      return sendBadRequest(reply, parsedQuery.error.errors[0]?.message ?? 'Invalid action')
    }

    const existing = await prisma.project.findUnique({ where: { id: request.params.id } })
    if (!existing) {
      return sendNotFound(reply, 'Project not found')
    }

    if (parsedQuery.data.action === 'duplicate') {
      const copy = await prisma.project.create({
        data: {
          user_id: existing.user_id,
          name: `${existing.name} (Kopie)`,
          description: existing.description,
          status: 'active',
          project_status: 'lead',
          deadline: existing.deadline,
          priority: existing.priority,
          assigned_to: existing.assigned_to,
          advisor: existing.advisor,
          sales_rep: existing.sales_rep,
          progress_pct: 0,
          tenant_id: existing.tenant_id,
          branch_id: existing.branch_id,
        },
        select: projectBoardSelect(),
      })
      return reply.status(201).send(copy)
    }

    if (parsedQuery.data.action === 'archive') {
      const project = await prisma.project.update({
        where: { id: request.params.id },
        data: {
          status: 'archived',
          project_status: 'archived',
          archived_at: new Date(),
          retention_until: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          archive_reason: 'Archiviert über 3dots-Menü',
        },
        select: projectBoardSelect(),
      })
      return reply.send(project)
    }

    // unarchive
    const project = await prisma.project.update({
      where: { id: request.params.id },
      data: {
        status: 'active',
        project_status: 'lead',
        archived_at: null,
        retention_until: null,
        archive_reason: null,
      },
      select: projectBoardSelect(),
    })
    return reply.send(project)
  })
}
