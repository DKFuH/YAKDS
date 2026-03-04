import { randomUUID } from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '../db.js'
import { sendBadRequest, sendNotFound } from '../errors.js'

type OfflineSyncJob = {
  id: string
  tenant_id: string
  project_id?: string
  entity_type: string
  payload_json: unknown
  status: 'pending'
  created_at: string
}

const OfflineSyncJobSchema = z.object({
  tenant_id: z.string().uuid().optional(),
  project_id: z.string().uuid().optional(),
  entity_type: z.string().min(1).max(120),
  payload_json: z.unknown(),
})

const OfflineSyncPayloadSchema = z.object({
  jobs: z.array(OfflineSyncJobSchema).min(1).max(200),
})

function resolveTenantId(requestTenantId: string | null | undefined, payloadTenantId: string | undefined): string {
  return requestTenantId ?? payloadTenantId ?? 'global'
}

export async function offlineSyncRoutes(app: FastifyInstance) {
  app.get<{ Params: { id: string } }>('/projects/:id/offline-bundle', async (request, reply) => {
    const project = await prisma.project.findUnique({ where: { id: request.params.id } })
    if (!project) {
      return sendNotFound(reply, 'Project not found')
    }

    const [rooms, siteSurveys] = await Promise.all([
      prisma.room.findMany({
        where: { project_id: request.params.id },
        orderBy: { created_at: 'asc' },
      }),
      prisma.siteSurvey.findMany({
        where: { project_id: request.params.id },
        orderBy: { created_at: 'desc' },
      }),
    ])

    const tenantId = project.tenant_id ?? request.tenantId ?? 'global'
    const pending = await prisma.offlineSyncJob.count({
      where: {
        tenant_id: tenantId,
        project_id: request.params.id,
        status: 'pending',
      },
    })

    return reply.send({
      project,
      rooms,
      site_surveys: siteSurveys,
      offline_sync_pending: pending,
      generated_at: new Date().toISOString(),
    })
  })

  app.post('/offline-sync', async (request, reply) => {
    const parsed = OfflineSyncPayloadSchema.safeParse(request.body)
    if (!parsed.success) {
      return sendBadRequest(reply, parsed.error.errors[0]?.message ?? 'Invalid payload')
    }

    const tenantId = resolveTenantId(request.tenantId, parsed.data.jobs[0]?.tenant_id)
    const now = new Date().toISOString()
    const jobs: OfflineSyncJob[] = parsed.data.jobs.map((job) => ({
      id: randomUUID(),
      tenant_id: tenantId,
      project_id: job.project_id,
      entity_type: job.entity_type,
      payload_json: job.payload_json,
      status: 'pending',
      created_at: now,
    }))

    await prisma.offlineSyncJob.createMany({
      data: jobs.map((job) => ({
        id: job.id,
        tenant_id: job.tenant_id,
        project_id: job.project_id,
        entity_type: job.entity_type,
        payload_json: job.payload_json as Prisma.InputJsonValue,
        status: job.status,
      })),
    })

    const pendingTotal = await prisma.offlineSyncJob.count({
      where: {
        tenant_id: tenantId,
        status: 'pending',
      },
    })

    return reply.status(202).send({
      queued: jobs.length,
      pending_total: pendingTotal,
    })
  })

  app.get('/offline-sync/pending', async (request, reply) => {
    const tenantId = request.tenantId ?? 'global'
    const pending = await prisma.offlineSyncJob.findMany({
      where: {
        tenant_id: tenantId,
        status: 'pending',
      },
      orderBy: { created_at: 'asc' },
    })

    return reply.send({
      pending_total: pending.length,
      jobs: pending,
    })
  })
}
