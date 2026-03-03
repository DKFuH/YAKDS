import type { FastifyInstance } from 'fastify'
import type { Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '../db.js'
import { sendBadRequest, sendNotFound } from '../errors.js'
import {
  nestCutlistParts,
  OversizedPartError,
  type NestingPart,
  type NestingResult,
} from '../services/nestingService.js'
import { buildNestingDxf } from '../services/nestingDxfExporter.js'

type ProjectRecord = {
  id: string
  tenant_id: string | null
}

type CutlistPartLike = {
  label?: string
  width_mm?: number
  height_mm?: number
  quantity?: number
  material_code?: string
}

type CutlistRecord = {
  id: string
  project_id: string
  parts: unknown
}

type NestingJobRecord = {
  id: string
  tenant_id: string
  project_id: string
  source_cutlist_id: string
  sheet_width_mm: number
  sheet_height_mm: number
  kerf_mm: number
  allow_rotate: boolean
  status: 'draft' | 'calculated' | 'exported'
  result_json: unknown
  created_at: Date
  updated_at: Date
}

type NestingStore = {
  create: (args: unknown) => Promise<NestingJobRecord>
  findMany: (args: unknown) => Promise<NestingJobRecord[]>
  findUnique: (args: unknown) => Promise<NestingJobRecord | null>
  update?: (args: unknown) => Promise<NestingJobRecord>
  delete: (args: unknown) => Promise<unknown>
}

const ProjectParamsSchema = z.object({
  id: z.string().uuid(),
})

const JobParamsSchema = z.object({
  id: z.string().uuid(),
})

const CreateNestingJobBodySchema = z.object({
  source_cutlist_id: z.string().uuid(),
  sheet_width_mm: z.number().int().positive(),
  sheet_height_mm: z.number().int().positive(),
  kerf_mm: z.number().int().min(0).optional(),
  allow_rotate: z.boolean().optional(),
})

function getNestingStore() {
  return (prisma as unknown as Record<string, NestingStore>).nestingJob
}

function normalizeCutlistParts(partsRaw: unknown): NestingPart[] {
  if (!Array.isArray(partsRaw)) return []

  return (partsRaw as CutlistPartLike[])
    .map((part, index) => ({
      id: `part-${index + 1}`,
      label: part.label?.trim() || `Teil ${index + 1}`,
      width_mm: typeof part.width_mm === 'number' ? part.width_mm : 0,
      height_mm: typeof part.height_mm === 'number' ? part.height_mm : 0,
      material_key: part.material_code?.trim() || 'UNBEKANNT',
      quantity: typeof part.quantity === 'number' ? part.quantity : 1,
    }))
    .filter((part) => part.width_mm > 0 && part.height_mm > 0 && part.quantity > 0)
}

function parseNestingResult(value: unknown): NestingResult {
  if (!value || typeof value !== 'object') {
    return { sheets: [], total_parts: 0, placed_parts: 0, waste_pct: 0 }
  }

  const candidate = value as NestingResult
  if (!Array.isArray(candidate.sheets)) {
    return { sheets: [], total_parts: 0, placed_parts: 0, waste_pct: 0 }
  }

  return {
    sheets: candidate.sheets,
    total_parts: typeof candidate.total_parts === 'number' ? candidate.total_parts : 0,
    placed_parts: typeof candidate.placed_parts === 'number' ? candidate.placed_parts : 0,
    waste_pct: typeof candidate.waste_pct === 'number' ? candidate.waste_pct : 0,
  }
}

export async function nestingRoutes(app: FastifyInstance) {
  app.post<{ Params: { id: string } }>('/projects/:id/nesting-jobs', async (request, reply) => {
    const parsedParams = ProjectParamsSchema.safeParse(request.params)
    if (!parsedParams.success) {
      return sendBadRequest(reply, parsedParams.error.errors[0].message)
    }

    const parsedBody = CreateNestingJobBodySchema.safeParse(request.body ?? {})
    if (!parsedBody.success) {
      return sendBadRequest(reply, parsedBody.error.errors[0].message)
    }

    const project = await prisma.project.findUnique({
      where: { id: parsedParams.data.id },
      select: { id: true, tenant_id: true },
    }) as ProjectRecord | null

    if (!project) {
      return sendNotFound(reply, 'Project not found')
    }

    const cutlist = await (prisma as unknown as { cutlist: { findUnique: (args: unknown) => Promise<CutlistRecord | null> } }).cutlist
      .findUnique({ where: { id: parsedBody.data.source_cutlist_id } })

    if (!cutlist || cutlist.project_id !== project.id) {
      return sendNotFound(reply, 'Cutlist not found')
    }

    const parts = normalizeCutlistParts(cutlist.parts)
    let result: NestingResult

    try {
      result = nestCutlistParts(parts, {
        sheet_width_mm: parsedBody.data.sheet_width_mm,
        sheet_height_mm: parsedBody.data.sheet_height_mm,
        kerf_mm: parsedBody.data.kerf_mm ?? 4,
        allow_rotate: parsedBody.data.allow_rotate ?? true,
      })
    } catch (error) {
      if (error instanceof OversizedPartError) {
        return sendBadRequest(reply, error.message)
      }
      throw error
    }

    const tenantId = project.tenant_id ?? request.tenantId ?? '00000000-0000-0000-0000-000000000000'

    const store = getNestingStore()
    const created = await store.create({
      data: {
        tenant_id: tenantId,
        project_id: project.id,
        source_cutlist_id: parsedBody.data.source_cutlist_id,
        sheet_width_mm: parsedBody.data.sheet_width_mm,
        sheet_height_mm: parsedBody.data.sheet_height_mm,
        kerf_mm: parsedBody.data.kerf_mm ?? 4,
        allow_rotate: parsedBody.data.allow_rotate ?? true,
        status: 'calculated',
        result_json: result as unknown as Prisma.InputJsonValue,
      },
    })

    return reply.status(201).send(created)
  })

  app.get<{ Params: { id: string } }>('/projects/:id/nesting-jobs', async (request, reply) => {
    const parsedParams = ProjectParamsSchema.safeParse(request.params)
    if (!parsedParams.success) {
      return sendBadRequest(reply, parsedParams.error.errors[0].message)
    }

    const project = await prisma.project.findUnique({ where: { id: parsedParams.data.id }, select: { id: true } })
    if (!project) {
      return sendNotFound(reply, 'Project not found')
    }

    const store = getNestingStore()
    const jobs = await store.findMany({
      where: { project_id: parsedParams.data.id },
      orderBy: { created_at: 'desc' },
    })

    return reply.send(jobs)
  })

  app.get<{ Params: { id: string } }>('/nesting-jobs/:id', async (request, reply) => {
    const parsedParams = JobParamsSchema.safeParse(request.params)
    if (!parsedParams.success) {
      return sendBadRequest(reply, parsedParams.error.errors[0].message)
    }

    const store = getNestingStore()
    const job = await store.findUnique({ where: { id: parsedParams.data.id } })
    if (!job) {
      return sendNotFound(reply, 'Nesting job not found')
    }

    return reply.send(job)
  })

  app.get<{ Params: { id: string } }>('/nesting-jobs/:id/export/dxf', async (request, reply) => {
    const parsedParams = JobParamsSchema.safeParse(request.params)
    if (!parsedParams.success) {
      return sendBadRequest(reply, parsedParams.error.errors[0].message)
    }

    const store = getNestingStore()
    const job = await store.findUnique({ where: { id: parsedParams.data.id } })
    if (!job) {
      return sendNotFound(reply, 'Nesting job not found')
    }

    const result = parseNestingResult(job.result_json)
    const dxf = buildNestingDxf(result)

    if (store.update) {
      await store.update({
        where: { id: job.id },
        data: { status: 'exported' },
      })
    }

    reply.header('content-disposition', `attachment; filename="nesting-${job.id}.dxf"`)
    reply.type('application/dxf')
    return reply.send(dxf)
  })

  app.delete<{ Params: { id: string } }>('/nesting-jobs/:id', async (request, reply) => {
    const parsedParams = JobParamsSchema.safeParse(request.params)
    if (!parsedParams.success) {
      return sendBadRequest(reply, parsedParams.error.errors[0].message)
    }

    const store = getNestingStore()
    const job = await store.findUnique({ where: { id: parsedParams.data.id } })
    if (!job) {
      return sendNotFound(reply, 'Nesting job not found')
    }

    await store.delete({ where: { id: parsedParams.data.id } })
    return reply.status(204).send()
  })
}
