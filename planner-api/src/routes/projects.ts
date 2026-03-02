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

export async function projectRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { user_id?: string; search?: string; status_filter?: string; sales_rep?: string } }>('/projects', async (request, reply) => {
    const parsedQuery = ProjectListQuerySchema.safeParse(request.query)
    if (!parsedQuery.success) {
      return sendBadRequest(reply, parsedQuery.error.errors[0]?.message ?? 'Invalid query')
    }

    const { user_id, search, status_filter, sales_rep } = parsedQuery.data

    const projects = await prisma.project.findMany({
      where: {
        ...(user_id ? { user_id } : {}),
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
    const user = await prisma.user.findUnique({ where: { id: user_id } })
    if (!user) {
      return sendNotFound(reply, 'User not found')
    }

    const project = await prisma.project.create({
      data: {
        name,
        description,
        user_id,
        tenant_id: user.tenant_id ?? request.tenantId ?? undefined,
        branch_id: user.branch_id ?? request.branchId ?? undefined,
      },
      select: projectBoardSelect(),
    })

    return reply.status(201).send(project)
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
        recipientEmail: `alerts+${project.tenant_id}@yakds.local`,
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
        data: { status: 'archived', project_status: 'archived' },
        select: projectBoardSelect(),
      })
      return reply.send(project)
    }

    // unarchive
    const project = await prisma.project.update({
      where: { id: request.params.id },
      data: { status: 'active', project_status: 'lead' },
      select: projectBoardSelect(),
    })
    return reply.send(project)
  })
}
