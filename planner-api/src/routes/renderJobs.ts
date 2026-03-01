import { randomUUID } from 'node:crypto'
import { FastifyInstance } from 'fastify'
import type { Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '../db.js'
import { sendBadRequest, sendNotFound } from '../errors.js'

const registeredWorkers = new Set<string>()

const CreateRenderJobParamsSchema = z.object({
  id: z.string().uuid(),
})

const CreateRenderJobBodySchema = z.object({
  scene_payload: z.unknown().optional(),
})

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
  image_url: z.string().url(),
  width_px: z.number().int().positive(),
  height_px: z.number().int().positive(),
  render_time_ms: z.number().int().nonnegative(),
})

const FailJobBodySchema = z.object({
  error_message: z.string().min(1).max(2000),
})

function ensureWorkerRegistered(workerId: string): boolean {
  return registeredWorkers.has(workerId)
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

    const job = await prisma.renderJob.create({
      data: {
        project_id: project.id,
        status: 'queued',
        ...(parsedBody.data.scene_payload !== undefined
          ? { scene_payload: parsedBody.data.scene_payload as Prisma.InputJsonValue }
          : {}),
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

    const workerId = randomUUID()
    registeredWorkers.add(workerId)

    return reply.status(201).send({
      worker_id: workerId,
      node_name: parsedBody.data?.node_name ?? null,
    })
  })

  app.post<{ Params: { workerId: string } }>('/render-workers/:workerId/fetch-job', async (request, reply) => {
    const parsedParams = WorkerParamsSchema.safeParse(request.params)
    if (!parsedParams.success) {
      return sendBadRequest(reply, parsedParams.error.errors[0].message)
    }

    if (!ensureWorkerRegistered(parsedParams.data.workerId)) {
      return sendNotFound(reply, 'Worker not registered')
    }

    const job = await prisma.renderJob.findFirst({
      where: { status: 'queued' },
      orderBy: { created_at: 'asc' },
    })

    if (!job) {
      return reply.send({ job: null })
    }

    const updated = await prisma.renderJob.update({
      where: { id: job.id },
      data: {
        status: 'assigned',
        worker_id: parsedParams.data.workerId,
        assigned_at: new Date(),
      },
    })

    return reply.send({ job: updated })
  })

  app.post<{ Params: { workerId: string; jobId: string } }>(
    '/render-workers/:workerId/jobs/:jobId/start',
    async (request, reply) => {
      const parsedParams = WorkerJobParamsSchema.safeParse(request.params)
      if (!parsedParams.success) {
        return sendBadRequest(reply, parsedParams.error.errors[0].message)
      }

      if (!ensureWorkerRegistered(parsedParams.data.workerId)) {
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

      if (!ensureWorkerRegistered(parsedParams.data.workerId)) {
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
          status: 'done',
          completed_at: new Date(),
          error_message: null,
        },
      })

      const result = await prisma.renderJobResult.upsert({
        where: { job_id: updated.id },
        create: {
          job_id: updated.id,
          image_url: parsedBody.data.image_url,
          width_px: parsedBody.data.width_px,
          height_px: parsedBody.data.height_px,
          render_time_ms: parsedBody.data.render_time_ms,
        },
        update: {
          image_url: parsedBody.data.image_url,
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

      if (!ensureWorkerRegistered(parsedParams.data.workerId)) {
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
