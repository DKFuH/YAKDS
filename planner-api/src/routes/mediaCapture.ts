import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../db.js'
import { sendBadRequest, sendForbidden, sendNotFound, sendServerError } from '../errors.js'
import { registerProjectDocument } from '../services/documentRegistry.js'
import {
  extractRenderEnvironmentFromConfig,
  normalizeRenderEnvironmentSettings,
  type RenderEnvironmentSettings,
} from './renderEnvironmentConfig.js'

type RenderPreset = 'draft' | 'balanced' | 'best'

type RenderPresetProfile = {
  samples: number
  shadow_quality: 'low' | 'medium' | 'high'
  output_scale: number
}

const PRESET_PROFILE: Record<RenderPreset, RenderPresetProfile> = {
  draft: {
    samples: 32,
    shadow_quality: 'low',
    output_scale: 0.75,
  },
  balanced: {
    samples: 96,
    shadow_quality: 'medium',
    output_scale: 1,
  },
  best: {
    samples: 256,
    shadow_quality: 'high',
    output_scale: 1.5,
  },
}

const ProjectParamsSchema = z.object({
  id: z.string().uuid(),
})

const Export360ParamsSchema = z.object({
  id: z.string().uuid(),
  jobId: z.string().uuid(),
})

const ScreenshotBodySchema = z.object({
  image_base64: z.string().min(1),
  filename: z.string().min(1).max(255).optional(),
  mime_type: z.enum(['image/png', 'image/jpeg']).optional(),
  width_px: z.number().int().positive().max(16384).optional(),
  height_px: z.number().int().positive().max(16384).optional(),
  view_mode: z.enum(['2d', '3d', 'split', 'elevation', 'section', 'presentation']).optional(),
  transparent_background: z.boolean().optional(),
  uploaded_by: z.string().min(1).max(120).optional(),
})

const Export360BodySchema = z.object({
  preset: z.enum(['draft', 'balanced', 'best']).optional(),
  width_px: z.number().int().min(1024).max(16384).optional(),
  height_px: z.number().int().min(512).max(8192).optional(),
  format: z.enum(['png', 'jpeg']).optional(),
  quality: z.number().min(0.1).max(1).optional(),
  environment: z.object({
    preset_id: z.enum(['studio', 'daylight', 'interior']),
    intensity: z.number().min(0.2).max(2),
    rotation_deg: z.number().min(-7200).max(7200),
    ground_tint: z.string().regex(/^#?[0-9a-fA-F]{6}$/),
  }).optional(),
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

function decodeBase64(value: string): Buffer | null {
  try {
    return Buffer.from(value, 'base64')
  } catch {
    return null
  }
}

function sanitizeFilename(raw: string | undefined, fallback: string): string {
  if (!raw || raw.trim().length === 0) {
    return fallback
  }

  return raw
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '_')
    .slice(0, 255)
}

async function resolveScopedProject(projectId: string, tenantId: string): Promise<{ id: string } | null> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, tenant_id: tenantId },
    select: { id: true },
  })

  if (!project) {
    return null
  }

  return { id: project.id }
}

async function resolveRenderEnvironment(projectId: string, requestEnvironment: unknown): Promise<RenderEnvironmentSettings> {
  if (requestEnvironment) {
    return normalizeRenderEnvironmentSettings(requestEnvironment)
  }

  const environment = await prisma.projectEnvironment.findUnique({
    where: { project_id: projectId },
    select: { config_json: true },
  })

  return extractRenderEnvironmentFromConfig(environment?.config_json)
}

function build360ScenePayload(
  preset: RenderPreset,
  environment: RenderEnvironmentSettings,
  format: 'png' | 'jpeg',
  quality: number,
  widthPx: number,
  heightPx: number,
) {
  return {
    render_preset: preset,
    render_profile: PRESET_PROFILE[preset],
    presentation_source: { kind: 'manual-camera' as const },
    render_environment: environment,
    export_360: {
      enabled: true,
      format,
      quality,
      width_px: widthPx,
      height_px: heightPx,
    },
  }
}

export async function mediaCaptureRoutes(app: FastifyInstance) {
  app.post<{ Params: { id: string } }>('/projects/:id/screenshot', async (request, reply) => {
    const tenantId = resolveTenantId(request)
    if (!tenantId) {
      return sendForbidden(reply, 'Tenant scope is required')
    }

    const parsedParams = ProjectParamsSchema.safeParse(request.params)
    if (!parsedParams.success) {
      return sendBadRequest(reply, parsedParams.error.errors[0]?.message ?? 'Invalid project id')
    }

    const parsedBody = ScreenshotBodySchema.safeParse(request.body ?? {})
    if (!parsedBody.success) {
      return sendBadRequest(reply, parsedBody.error.errors[0]?.message ?? 'Invalid screenshot payload')
    }

    const project = await resolveScopedProject(parsedParams.data.id, tenantId)
    if (!project) {
      return sendNotFound(reply, 'Project not found in tenant scope')
    }

    const buffer = decodeBase64(parsedBody.data.image_base64)
    if (!buffer || buffer.length === 0) {
      return sendBadRequest(reply, 'Invalid image_base64 payload')
    }

    const mimeType = parsedBody.data.mime_type ?? 'image/png'
    const extension = mimeType === 'image/jpeg' ? 'jpg' : 'png'
    const fallbackFilename = `screenshot-${Date.now()}.${extension}`

    try {
      const document = await registerProjectDocument({
        projectId: project.id,
        tenantId,
        filename: sanitizeFilename(parsedBody.data.filename, fallbackFilename),
        mimeType,
        uploadedBy: parsedBody.data.uploaded_by ?? 'system:screenshot',
        type: 'render_image',
        sourceKind: 'manual_upload',
        sourceId: null,
        tags: [
          'screenshot',
          ...(parsedBody.data.view_mode ? [`view:${parsedBody.data.view_mode}`] : []),
        ],
        versionMetadata: {
          capture: {
            width_px: parsedBody.data.width_px ?? null,
            height_px: parsedBody.data.height_px ?? null,
            view_mode: parsedBody.data.view_mode ?? null,
            transparent_background: parsedBody.data.transparent_background ?? false,
          },
        },
        buffer,
      })

      const downloadUrl = `/api/v1/projects/${project.id}/documents/${document.id}/download`
      return reply.status(201).send({
        project_id: project.id,
        document_id: document.id,
        filename: document.filename,
        mime_type: document.mime_type,
        download_url: downloadUrl,
        preview_url: downloadUrl,
        width_px: parsedBody.data.width_px ?? null,
        height_px: parsedBody.data.height_px ?? null,
      })
    } catch (error) {
      return sendServerError(reply, error instanceof Error ? error.message : 'Screenshot upload failed')
    }
  })

  app.post<{ Params: { id: string } }>('/projects/:id/export-360', async (request, reply) => {
    const tenantId = resolveTenantId(request)
    if (!tenantId) {
      return sendForbidden(reply, 'Tenant scope is required')
    }

    const parsedParams = ProjectParamsSchema.safeParse(request.params)
    if (!parsedParams.success) {
      return sendBadRequest(reply, parsedParams.error.errors[0]?.message ?? 'Invalid project id')
    }

    const parsedBody = Export360BodySchema.safeParse(request.body ?? {})
    if (!parsedBody.success) {
      return sendBadRequest(reply, parsedBody.error.errors[0]?.message ?? 'Invalid export payload')
    }

    const project = await resolveScopedProject(parsedParams.data.id, tenantId)
    if (!project) {
      return sendNotFound(reply, 'Project not found in tenant scope')
    }

    const preset = parsedBody.data.preset ?? 'balanced'
    const widthPx = parsedBody.data.width_px ?? 4096
    const heightPx = parsedBody.data.height_px ?? 2048
    const format = parsedBody.data.format ?? 'png'
    const quality = parsedBody.data.quality ?? 0.92
    const environment = await resolveRenderEnvironment(project.id, parsedBody.data.environment)

    const job = await prisma.renderJob.create({
      data: {
        project_id: project.id,
        status: 'queued',
        scene_payload: build360ScenePayload(preset, environment, format, quality, widthPx, heightPx),
      },
    })

    return reply.status(202).send({
      project_id: project.id,
      job_id: job.id,
      status: job.status,
      status_url: `/api/v1/projects/${project.id}/export-360/${job.id}`,
    })
  })

  app.get<{ Params: { id: string; jobId: string } }>('/projects/:id/export-360/:jobId', async (request, reply) => {
    const tenantId = resolveTenantId(request)
    if (!tenantId) {
      return sendForbidden(reply, 'Tenant scope is required')
    }

    const parsedParams = Export360ParamsSchema.safeParse(request.params)
    if (!parsedParams.success) {
      return sendBadRequest(reply, parsedParams.error.errors[0]?.message ?? 'Invalid route params')
    }

    const project = await resolveScopedProject(parsedParams.data.id, tenantId)
    if (!project) {
      return sendNotFound(reply, 'Project not found in tenant scope')
    }

    const job = await prisma.renderJob.findUnique({
      where: { id: parsedParams.data.jobId },
      include: { result: true },
    })

    if (!job || job.project_id !== project.id) {
      return sendNotFound(reply, '360 export job not found')
    }

    return reply.send({
      project_id: project.id,
      job_id: job.id,
      status: job.status,
      error_message: job.error_message,
      preview_url: job.result?.image_url ?? null,
      download_url: job.result?.image_url ?? null,
      width_px: job.result?.width_px ?? null,
      height_px: job.result?.height_px ?? null,
      render_time_ms: job.result?.render_time_ms ?? null,
    })
  })
}
