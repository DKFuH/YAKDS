import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../db.js'
import { sendNotFound, sendBadRequest } from '../errors.js'

const CreateProjectSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  user_id: z.string().uuid(),
})

const UpdateProjectSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  status: z.enum(['active', 'archived']).optional(),
})

const CreateVersionBodySchema = z.object({
  label: z.string().min(1).max(200).optional().nullable(),
})


  // GET /projects – alle Projekte eines Users
  app.get<{ Querystring: { user_id: string } }>('/projects', async (request, reply) => {
    const { user_id } = request.query

    if (!user_id) {
      return sendBadRequest(reply, 'user_id query parameter is required')
    }

    const projects = await prisma.project.findMany({
      where: { user_id },
      orderBy: { updated_at: 'desc' },
      select: {
        id: true,
        name: true,
        description: true,
        status: true,
        lead_status: true,
        quote_value: true,
        close_probability: true,
        created_at: true,
        updated_at: true,
        _count: { select: { rooms: true } },
      },
    })

    return reply.send(projects)
  })

  // POST /projects – neues Projekt anlegen
  app.post('/projects', async (request, reply) => {
    const parsed = CreateProjectSchema.safeParse(request.body)
    if (!parsed.success) {
      return sendBadRequest(reply, parsed.error.errors[0].message)
    }

    const { name, description, user_id } = parsed.data

    const user = await prisma.user.findUnique({ where: { id: user_id } })
    if (!user) {
      return sendNotFound(reply, 'User not found')
    }

    const project = await prisma.project.create({
      data: { name, description, user_id },
    })

    return reply.status(201).send(project)
  })

  // GET /projects/:id – Projekt laden
  app.get<{ Params: { id: string } }>('/projects/:id', async (request, reply) => {
    const { id } = request.params

    const project = await prisma.project.findUnique({
      where: { id },
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

  // PUT /projects/:id – Projekt aktualisieren
  app.put<{ Params: { id: string } }>('/projects/:id', async (request, reply) => {
    const { id } = request.params

    const parsed = UpdateProjectSchema.safeParse(request.body)
    if (!parsed.success) {
      return sendBadRequest(reply, parsed.error.errors[0].message)
    }

    const existing = await prisma.project.findUnique({ where: { id } })
    if (!existing) {
      return sendNotFound(reply, 'Project not found')
    }

    const project = await prisma.project.update({
      where: { id },
      data: parsed.data,
    })

    return reply.send(project)
  })

  // DELETE /projects/:id – Projekt löschen
  app.delete<{ Params: { id: string } }>('/projects/:id', async (request, reply) => {
    const { id } = request.params

    const existing = await prisma.project.findUnique({ where: { id } })
    if (!existing) {
      return sendNotFound(reply, 'Project not found')
    }

    await prisma.project.delete({ where: { id } })

    return reply.status(204).send()
  })

  // POST /projects/:id/versions – Snapshot speichern
  app.post<{ Params: { id: string } }>('/projects/:id/versions', async (request, reply) => {
    const { id } = request.params

    const parsedBody = CreateVersionBodySchema.safeParse(request.body)
    if (!parsedBody.success) {
      return sendBadRequest(reply, parsedBody.error.errors[0].message)
    }

    const project = await prisma.project.findUnique({
      where: { id },
      include: { rooms: true },
    })

    if (!project) {
      return sendNotFound(reply, 'Project not found')
    }

    // Wrap version-number allocation and snapshot creation in a transaction to
    // prevent concurrent requests from producing a duplicate (project_id, version).
    const version = await prisma.$transaction(async (tx) => {
      const lastVersion = await tx.projectVersion.findFirst({
        where: { project_id: id },
        orderBy: { version: 'desc' },
      })

      return tx.projectVersion.create({
        data: {
          project_id: id,
          version: (lastVersion?.version ?? 0) + 1,
          snapshot: project as object,
          label: parsedBody.data.label ?? null,
        },
      })
    })

    return reply.status(201).send(version)
  })

  // GET /projects/:id/versions – alle Versionen
  app.get<{ Params: { id: string } }>('/projects/:id/versions', async (request, reply) => {
    const { id } = request.params

    const versions = await prisma.projectVersion.findMany({
      where: { project_id: id },
      orderBy: { version: 'desc' },
      select: { id: true, version: true, label: true, created_at: true },
    })

    return reply.send(versions)
  })
}
