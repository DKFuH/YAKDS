import { FastifyInstance } from 'fastify'
import type { Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '../db.js'
import { sendBadRequest, sendNotFound, sendServerError } from '../errors.js'
import { registerProjectDocument } from '../services/documentRegistry.js'
import {
  extractRenderEnvironmentFromConfig,
  normalizeRenderEnvironmentSettings,
  type RenderEnvironmentSettings,
} from './renderEnvironmentConfig.js'

const CreateRenderJobParamsSchema = z.object({
  id: z.string().uuid(),
})

const CreateRenderJobBodySchema = z.object({
  scene_payload: z.unknown().optional(),
  environment: z.object({
    preset_id: z.enum(['studio', 'daylight', 'interior']),
    intensity: z.number().min(0.2).max(2),
    rotation_deg: z.number().min(-7200).max(7200),
    ground_tint: z.string().regex(/^#?[0-9a-fA-F]{6}$/),
  }).optional(),
  preset: z.enum(['draft', 'balanced', 'best']).optional(),
  source: z
    .object({
      kind: z.enum(['split-view', 'panorama-tour', 'manual-camera']),
      panorama_tour_id: z.string().uuid().optional(),
    })
    .optional(),
}).superRefine((value, ctx) => {
  if (value.source?.kind === 'panorama-tour' && !value.source.panorama_tour_id) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'panorama_tour_id is required for panorama-tour source',
      path: ['source', 'panorama_tour_id'],
    })
  }
})

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

function buildScenePayload(
  scenePayload: unknown,
  preset: RenderPreset,
  source: { kind: 'split-view' | 'panorama-tour' | 'manual-camera'; panorama_tour_id?: string } | undefined,
  environment: RenderEnvironmentSettings,
): Prisma.InputJsonValue {
  const profile = PRESET_PROFILE[preset]
  const normalizedSource = source
    ? {
        kind: source.kind,
        ...(source.panorama_tour_id ? { panorama_tour_id: source.panorama_tour_id } : {}),
      }
    : { kind: 'split-view' as const }

  if (scenePayload && typeof scenePayload === 'object' && !Array.isArray(scenePayload)) {
    return {
      ...(scenePayload as Record<string, unknown>),
      render_preset: preset,
      render_profile: profile,
      presentation_source: normalizedSource,
      render_environment: environment,
    } as Prisma.InputJsonValue
  }

  return {
    scene_payload: scenePayload ?? null,
    render_preset: preset,
    render_profile: profile,
    presentation_source: normalizedSource,
    render_environment: environment,
  } as Prisma.InputJsonValue
}

const RenderJobIdParamsSchema = z.object({
  id: z.string().uuid(),
})

const WorkerRegisterBodySchema = z.object({
  node_name: z.string().min(1).max(120).optional(),
}).optional()

const WorkerParamsSchema = z.object({
  workerId: z.string().uuid(),
})

const WorkerJobParamsSchema = z.object({
  workerId: z.string().uuid(),
  jobId: z.string().uuid(),
})

const CompleteJobBodySchema = z.object({
  image_url: z.string().url().optional(),
  image_base64: z.string().min(1).optional(),
  filename: z.string().min(1).max(255).optional(),
  width_px: z.number().int().positive(),
  height_px: z.number().int().positive(),
  render_time_ms: z.number().int().nonnegative(),
}).superRefine((value, ctx) => {
  if (!value.image_url && !value.image_base64) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Either image_url or image_base64 is required',
    })
  }
})

function decodeBase64(value: string): Buffer {
  return Buffer.from(value, 'base64')
}

const FailJobBodySchema = z.object({
  error_message: z.string().min(1).max(2000),
})

async function touchRegisteredWorker(workerId: string): Promise<boolean> {
  const worker = await prisma.renderNode.findUnique({
    where: { id: workerId },
    select: { id: true },
  })

  if (!worker) {
    return false
  }

  await prisma.renderNode.update({
    where: { id: workerId },
    data: {
      status: 'active',
      last_seen_at: new Date(),
    },
  })

  return true
}

export async function renderJobRoutes(app: FastifyInstance) {
  app.post<{ Params: { id: string } }>('/projects/:id/render-jobs', async (request, reply) => {
    const parsedParams = CreateRenderJobParamsSchema.safeParse(request.params)
    if (!parsedParams.success) {
      return sendBadRequest(reply, parsedParams.error.errors[0].message)
    }

    const parsedBody = CreateRenderJobBodySchema.safeParse(request.body)
    if (!parsedBody.success) {
      return sendBadRequest(reply, parsedBody.error.errors[0].message)
    }

    const project = await prisma.project.findUnique({ where: { id: parsedParams.data.id }, select: { id: true } })
    if (!project) {
      return sendNotFound(reply, 'Project not found')
    }

    const preset = parsedBody.data.preset ?? 'balanced'
    let renderEnvironment = parsedBody.data.environment
      ? normalizeRenderEnvironmentSettings(parsedBody.data.environment)
      : null

    if (!renderEnvironment) {
      const projectEnvironment = await prisma.projectEnvironment.findUnique({
        where: { project_id: project.id },
        select: { config_json: true },
      })
      renderEnvironment = extractRenderEnvironmentFromConfig(projectEnvironment?.config_json)
    }

    const scenePayload = buildScenePayload(
      parsedBody.data.scene_payload,
      preset,
      parsedBody.data.source,
      renderEnvironment,
    )

    const job = await prisma.renderJob.create({
      data: {
        project_id: project.id,
        status: 'queued',
        scene_payload: scenePayload,
      },
    })

    return reply.status(201).send(job)
  })

  app.get<{ Params: { id: string } }>('/render-jobs/:id', async (request, reply) => {
    const parsedParams = RenderJobIdParamsSchema.safeParse(request.params)
    if (!parsedParams.success) {
      return sendBadRequest(reply, parsedParams.error.errors[0].message)
    }

    const job = await prisma.renderJob.findUnique({
      where: { id: parsedParams.data.id },
      include: { result: true },
    })

    if (!job) {
      return sendNotFound(reply, 'Render job not found')
    }

    return reply.send(job)
  })

  app.post('/render-workers/register', async (request, reply) => {
    const parsedBody = WorkerRegisterBodySchema.safeParse(request.body)
    if (!parsedBody.success) {
      return sendBadRequest(reply, parsedBody.error.errors[0].message)
    }

    const worker = await prisma.renderNode.create({
      data: {
        node_name: parsedBody.data?.node_name ?? null,
        status: 'active',
        last_seen_at: new Date(),
      },
    })

    return reply.status(201).send({
      worker_id: worker.id,
      node_name: worker.node_name,
      status: worker.status,
    })
  })

  app.post<{ Params: { workerId: string } }>('/render-workers/:workerId/fetch-job', async (request, reply) => {
    const parsedParams = WorkerParamsSchema.safeParse(request.params)
    if (!parsedParams.success) {
      return sendBadRequest(reply, parsedParams.error.errors[0].message)
    }

    if (!(await touchRegisteredWorker(parsedParams.data.workerId))) {
      return sendNotFound(reply, 'Worker not registered')
    }

    const job = await prisma.renderJob.findFirst({
      where: { status: 'queued' },
      orderBy: { created_at: 'asc' },
    })

    if (!job) {
      return reply.send({ job: null })
    }

    // Atomic assignment: only update if the job is still 'queued'.
    // This prevents two workers from picking up the same job concurrently.
    const assignResult = await prisma.renderJob.updateMany({
      where: { id: job.id, status: 'queued' },
      data: {
        status: 'assigned',
        worker_id: parsedParams.data.workerId,
        assigned_at: new Date(),
      },
    })

    if (assignResult.count === 0) {
      // Another worker grabbed it first
      return reply.send({ job: null })
    }

    const updated = await prisma.renderJob.findUnique({ where: { id: job.id } })
    return reply.send({ job: updated })
  })

  app.post<{ Params: { workerId: string; jobId: string } }>(
    '/render-workers/:workerId/jobs/:jobId/start',
    async (request, reply) => {
      const parsedParams = WorkerJobParamsSchema.safeParse(request.params)
      if (!parsedParams.success) {
        return sendBadRequest(reply, parsedParams.error.errors[0].message)
      }

      if (!(await touchRegisteredWorker(parsedParams.data.workerId))) {
        return sendNotFound(reply, 'Worker not registered')
      }

      const job = await prisma.renderJob.findUnique({
        where: { id: parsedParams.data.jobId },
        include: {
          project: {
            select: {
              id: true,
              tenant_id: true,
            },
          },
        },
      })
      if (!job) {
        return sendNotFound(reply, 'Render job not found')
      }
      if (job.worker_id !== parsedParams.data.workerId) {
        return sendBadRequest(reply, 'Job is not assigned to this worker')
      }

      const updated = await prisma.renderJob.update({
        where: { id: parsedParams.data.jobId },
        data: {
          status: 'running',
          started_at: new Date(),
        },
      })

      return reply.send(updated)
    },
  )

  app.post<{ Params: { workerId: string; jobId: string } }>(
    '/render-workers/:workerId/jobs/:jobId/complete',
    async (request, reply) => {
      const parsedParams = WorkerJobParamsSchema.safeParse(request.params)
      if (!parsedParams.success) {
        return sendBadRequest(reply, parsedParams.error.errors[0].message)
      }

      const parsedBody = CompleteJobBodySchema.safeParse(request.body)
      if (!parsedBody.success) {
        return sendBadRequest(reply, parsedBody.error.errors[0].message)
      }

      if (!(await touchRegisteredWorker(parsedParams.data.workerId))) {
        return sendNotFound(reply, 'Worker not registered')
      }

      const job = await prisma.renderJob.findUnique({
        where: { id: parsedParams.data.jobId },
        include: {
          project: {
            select: {
              id: true,
              tenant_id: true,
            },
          },
        },
      })
      if (!job) {
        return sendNotFound(reply, 'Render job not found')
      }
      if (job.worker_id !== parsedParams.data.workerId) {
        return sendBadRequest(reply, 'Job is not assigned to this worker')
      }

      const updated = await prisma.renderJob.update({
        where: { id: parsedParams.data.jobId },
        data: {
          status: 'done',
          completed_at: new Date(),
          error_message: null,
        },
      })

      let imageUrl = parsedBody.data.image_url ?? null

      if (parsedBody.data.image_base64) {
        if (!job.project.tenant_id) {
          return sendServerError(reply, 'Render job project is missing tenant scope')
        }

        const document = await registerProjectDocument({
          projectId: job.project.id,
          tenantId: job.project.tenant_id,
          filename: parsedBody.data.filename ?? `${job.id}.png`,
          mimeType: 'image/png',
          uploadedBy: `system:render-worker:${parsedParams.data.workerId}`,
          type: 'render_image',
          tags: ['render', `render-job:${job.id}`],
          sourceKind: 'render_job',
          sourceId: job.id,
          buffer: decodeBase64(parsedBody.data.image_base64),
        })
        imageUrl = `/api/v1/projects/${job.project.id}/documents/${document.id}/download`
      }

      const result = await prisma.renderJobResult.upsert({
        where: { job_id: updated.id },
        create: {
          job_id: updated.id,
          image_url: imageUrl ?? '',
          width_px: parsedBody.data.width_px,
          height_px: parsedBody.data.height_px,
          render_time_ms: parsedBody.data.render_time_ms,
        },
        update: {
          image_url: imageUrl ?? '',
          width_px: parsedBody.data.width_px,
          height_px: parsedBody.data.height_px,
          render_time_ms: parsedBody.data.render_time_ms,
        },
      })

      return reply.send({ job: updated, result })
    },
  )

  app.post<{ Params: { workerId: string; jobId: string } }>(
    '/render-workers/:workerId/jobs/:jobId/fail',
    async (request, reply) => {
      const parsedParams = WorkerJobParamsSchema.safeParse(request.params)
      if (!parsedParams.success) {
        return sendBadRequest(reply, parsedParams.error.errors[0].message)
      }

      const parsedBody = FailJobBodySchema.safeParse(request.body)
      if (!parsedBody.success) {
        return sendBadRequest(reply, parsedBody.error.errors[0].message)
      }

      if (!(await touchRegisteredWorker(parsedParams.data.workerId))) {
        return sendNotFound(reply, 'Worker not registered')
      }

      const job = await prisma.renderJob.findUnique({ where: { id: parsedParams.data.jobId } })
      if (!job) {
        return sendNotFound(reply, 'Render job not found')
      }
      if (job.worker_id !== parsedParams.data.workerId) {
        return sendBadRequest(reply, 'Job is not assigned to this worker')
      }

      const updated = await prisma.renderJob.update({
        where: { id: parsedParams.data.jobId },
        data: {
          status: 'failed',
          error_message: parsedBody.data.error_message,
          completed_at: new Date(),
        },
      })

      return reply.send(updated)
    },
  )
}
