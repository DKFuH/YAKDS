import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../db.js'
import { sendBadRequest, sendNotFound } from '../errors.js'

const CreateAreaSchema = z.object({
  name: z.string().min(1).max(200),
  sort_order: z.number().int().min(0).optional(),
})

const UpdateAreaSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  sort_order: z.number().int().min(0).optional(),
})

const CreateAlternativeSchema = z.object({
  name: z.string().min(1).max(200),
  is_active: z.boolean().optional(),
  sort_order: z.number().int().min(0).optional(),
})

const UpdateAlternativeSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  is_active: z.boolean().optional(),
  sort_order: z.number().int().min(0).optional(),
})

const UpsertModelSettingsSchema = z.object({
  manufacturer_name: z.string().max(200).nullable().optional(),
  model_name: z.string().max(200).nullable().optional(),
  handle_name: z.string().max(200).nullable().optional(),
  worktop_model: z.string().max(200).nullable().optional(),
  worktop_color: z.string().max(200).nullable().optional(),
  plinth_height_mm: z.number().int().min(0).nullable().optional(),
  cover_panel_enabled: z.boolean().optional(),
  room_height_mm: z.number().int().min(0).nullable().optional(),
  wall_thickness_mm: z.number().int().min(0).nullable().optional(),
  extra_json: z.record(z.unknown()).optional(),
})

export async function areaRoutes(app: FastifyInstance) {
  // ─── Areas ───────────────────────────────────────────────────────────────

  app.get<{ Params: { projectId: string } }>('/projects/:projectId/areas', async (request, reply) => {
    const project = await prisma.project.findUnique({ where: { id: request.params.projectId } })
    if (!project) {
      return sendNotFound(reply, 'Project not found')
    }

    const areas = await prisma.area.findMany({
      where: { project_id: request.params.projectId },
      orderBy: [{ sort_order: 'asc' }, { created_at: 'asc' }],
      include: {
        alternatives: {
          orderBy: [{ sort_order: 'asc' }, { created_at: 'asc' }],
          include: { model_settings: true },
        },
      },
    })

    return reply.send(areas)
  })

  app.post<{ Params: { projectId: string } }>('/projects/:projectId/areas', async (request, reply) => {
    const parsed = CreateAreaSchema.safeParse(request.body)
    if (!parsed.success) {
      return sendBadRequest(reply, parsed.error.errors[0]?.message ?? 'Invalid payload')
    }

    const project = await prisma.project.findUnique({ where: { id: request.params.projectId } })
    if (!project) {
      return sendNotFound(reply, 'Project not found')
    }

    const area = await prisma.area.create({
      data: {
        project_id: request.params.projectId,
        name: parsed.data.name,
        sort_order: parsed.data.sort_order ?? 0,
      },
      include: { alternatives: true },
    })

    return reply.status(201).send(area)
  })

  app.put<{ Params: { projectId: string; areaId: string } }>('/projects/:projectId/areas/:areaId', async (request, reply) => {
    const parsed = UpdateAreaSchema.safeParse(request.body)
    if (!parsed.success) {
      return sendBadRequest(reply, parsed.error.errors[0]?.message ?? 'Invalid payload')
    }

    const existing = await prisma.area.findFirst({
      where: { id: request.params.areaId, project_id: request.params.projectId },
    })
    if (!existing) {
      return sendNotFound(reply, 'Area not found')
    }

    const area = await prisma.area.update({
      where: { id: request.params.areaId },
      data: parsed.data,
      include: { alternatives: true },
    })

    return reply.send(area)
  })

  app.delete<{ Params: { projectId: string; areaId: string } }>('/projects/:projectId/areas/:areaId', async (request, reply) => {
    const existing = await prisma.area.findFirst({
      where: { id: request.params.areaId, project_id: request.params.projectId },
    })
    if (!existing) {
      return sendNotFound(reply, 'Area not found')
    }

    await prisma.area.delete({ where: { id: request.params.areaId } })
    return reply.status(204).send()
  })

  // ─── Alternatives ─────────────────────────────────────────────────────────

  app.post<{ Params: { projectId: string; areaId: string } }>('/projects/:projectId/areas/:areaId/alternatives', async (request, reply) => {
    const parsed = CreateAlternativeSchema.safeParse(request.body)
    if (!parsed.success) {
      return sendBadRequest(reply, parsed.error.errors[0]?.message ?? 'Invalid payload')
    }

    const area = await prisma.area.findFirst({
      where: { id: request.params.areaId, project_id: request.params.projectId },
    })
    if (!area) {
      return sendNotFound(reply, 'Area not found')
    }

    const alternative = await prisma.alternative.create({
      data: {
        area_id: request.params.areaId,
        name: parsed.data.name,
        is_active: parsed.data.is_active ?? false,
        sort_order: parsed.data.sort_order ?? 0,
      },
      include: { model_settings: true },
    })

    return reply.status(201).send(alternative)
  })

  app.put<{ Params: { projectId: string; areaId: string; alternativeId: string } }>('/projects/:projectId/areas/:areaId/alternatives/:alternativeId', async (request, reply) => {
    const parsed = UpdateAlternativeSchema.safeParse(request.body)
    if (!parsed.success) {
      return sendBadRequest(reply, parsed.error.errors[0]?.message ?? 'Invalid payload')
    }

    const existing = await prisma.alternative.findFirst({
      where: { id: request.params.alternativeId, area_id: request.params.areaId },
    })
    if (!existing) {
      return sendNotFound(reply, 'Alternative not found')
    }

    const alternative = await prisma.alternative.update({
      where: { id: request.params.alternativeId },
      data: parsed.data,
      include: { model_settings: true },
    })

    return reply.send(alternative)
  })

  app.delete<{ Params: { projectId: string; areaId: string; alternativeId: string } }>('/projects/:projectId/areas/:areaId/alternatives/:alternativeId', async (request, reply) => {
    const existing = await prisma.alternative.findFirst({
      where: { id: request.params.alternativeId, area_id: request.params.areaId },
    })
    if (!existing) {
      return sendNotFound(reply, 'Alternative not found')
    }

    await prisma.alternative.delete({ where: { id: request.params.alternativeId } })
    return reply.status(204).send()
  })

  // ─── Alternative (by id only) ─────────────────────────────────────────────

  app.get<{ Params: { alternativeId: string } }>('/alternatives/:alternativeId/model-settings', async (request, reply) => {
    const alternative = await prisma.alternative.findUnique({
      where: { id: request.params.alternativeId },
      include: { model_settings: true },
    })
    if (!alternative) {
      return sendNotFound(reply, 'Alternative not found')
    }

    return reply.send(alternative.model_settings ?? {})
  })

  app.put<{ Params: { alternativeId: string } }>('/alternatives/:alternativeId/model-settings', async (request, reply) => {
    const parsed = UpsertModelSettingsSchema.safeParse(request.body)
    if (!parsed.success) {
      return sendBadRequest(reply, parsed.error.errors[0]?.message ?? 'Invalid payload')
    }

    const alternative = await prisma.alternative.findUnique({
      where: { id: request.params.alternativeId },
    })
    if (!alternative) {
      return sendNotFound(reply, 'Alternative not found')
    }

    const { extra_json, ...rest } = parsed.data

    const settings = await prisma.modelSettings.upsert({
      where: { alternative_id: request.params.alternativeId },
      create: {
        alternative_id: request.params.alternativeId,
        ...rest,
        extra_json: (extra_json ?? {}) as object,
      },
      update: {
        ...rest,
        ...(extra_json !== undefined ? { extra_json: extra_json as object } : {}),
      },
    })

    return reply.send(settings)
  })
}
