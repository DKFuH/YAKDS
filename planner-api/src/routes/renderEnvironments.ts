import type { FastifyInstance } from 'fastify'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '../db.js'
import { sendBadRequest, sendForbidden, sendNotFound } from '../errors.js'
import {
  mergeConfigWithRenderEnvironment,
  extractRenderEnvironmentFromConfig,
  normalizeRenderEnvironmentSettings,
  RENDER_ENVIRONMENT_PRESETS,
} from './renderEnvironmentConfig.js'

const ParamsSchema = z.object({
  id: z.string().uuid(),
})

const PatchSchema = z.object({
  preset_id: z.enum(['studio', 'daylight', 'interior']).optional(),
  intensity: z.number().min(0.2).max(2).optional(),
  rotation_deg: z.number().min(-7200).max(7200).optional(),
  ground_tint: z.string().regex(/^#?[0-9a-fA-F]{6}$/).optional(),
}).refine((value) => Object.keys(value).length > 0, {
  message: 'At least one field must be provided',
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

export async function renderEnvironmentRoutes(app: FastifyInstance) {
  app.get<{ Params: { id: string } }>('/projects/:id/render-environments', async (request, reply) => {
    const tenantId = resolveTenantId(request)
    if (!tenantId) {
      return sendForbidden(reply, 'Tenant scope is required')
    }

    const parsedParams = ParamsSchema.safeParse(request.params)
    if (!parsedParams.success) {
      return sendBadRequest(reply, parsedParams.error.errors[0]?.message ?? 'Invalid project id')
    }

    const project = await resolveScopedProject(parsedParams.data.id, tenantId)
    if (!project) {
      return sendNotFound(reply, 'Project not found in tenant scope')
    }

    const environment = await prisma.projectEnvironment.findUnique({
      where: { project_id: project.id },
      select: { config_json: true },
    })

    const active = extractRenderEnvironmentFromConfig(environment?.config_json)

    return reply.send({
      project_id: project.id,
      presets: RENDER_ENVIRONMENT_PRESETS,
      active,
    })
  })

  app.patch<{ Params: { id: string } }>('/projects/:id/render-environment', async (request, reply) => {
    const tenantId = resolveTenantId(request)
    if (!tenantId) {
      return sendForbidden(reply, 'Tenant scope is required')
    }

    const parsedParams = ParamsSchema.safeParse(request.params)
    if (!parsedParams.success) {
      return sendBadRequest(reply, parsedParams.error.errors[0]?.message ?? 'Invalid project id')
    }

    const parsedBody = PatchSchema.safeParse(request.body ?? {})
    if (!parsedBody.success) {
      return sendBadRequest(reply, parsedBody.error.errors[0]?.message ?? 'Invalid environment payload')
    }

    const project = await resolveScopedProject(parsedParams.data.id, tenantId)
    if (!project) {
      return sendNotFound(reply, 'Project not found in tenant scope')
    }

    const existingEnvironment = await prisma.projectEnvironment.findUnique({
      where: { project_id: project.id },
      select: {
        config_json: true,
        north_angle_deg: true,
        latitude: true,
        longitude: true,
        timezone: true,
        default_datetime: true,
        daylight_enabled: true,
      },
    })

    const current = extractRenderEnvironmentFromConfig(existingEnvironment?.config_json)
    const next = normalizeRenderEnvironmentSettings({
      ...current,
      ...parsedBody.data,
    })
    const nextConfig = mergeConfigWithRenderEnvironment(existingEnvironment?.config_json, next)

    await prisma.projectEnvironment.upsert({
      where: { project_id: project.id },
      update: {
        config_json: nextConfig as Prisma.InputJsonValue,
      },
      create: {
        tenant_id: tenantId,
        project_id: project.id,
        north_angle_deg: existingEnvironment?.north_angle_deg ?? 0,
        latitude: existingEnvironment?.latitude ?? null,
        longitude: existingEnvironment?.longitude ?? null,
        timezone: existingEnvironment?.timezone ?? null,
        default_datetime: existingEnvironment?.default_datetime ?? null,
        daylight_enabled: existingEnvironment?.daylight_enabled ?? true,
        config_json: nextConfig as Prisma.InputJsonValue,
      },
    })

    return reply.send({
      project_id: project.id,
      presets: RENDER_ENVIRONMENT_PRESETS,
      active: next,
    })
  })
}
