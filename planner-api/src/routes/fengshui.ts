import type { FastifyInstance } from 'fastify'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '../db.js'
import { sendBadRequest, sendNotFound } from '../errors.js'
import { analyzeFengShui } from '../services/fengshuiEngine.js'

const AnalyzeBodySchema = z.object({
  mode: z.enum(['west', 'east', 'both']).default('both'),
  compass_deg: z.number().min(0).max(360).default(0),
  entry: z.object({
    x_mm: z.number(),
    y_mm: z.number(),
    room_id: z.string().optional(),
    door_id: z.string().optional(),
    placement_id: z.string().optional(),
  }).optional(),
  bounds_mm: z.object({
    x_min: z.number(),
    y_min: z.number(),
    x_max: z.number(),
    y_max: z.number(),
  }),
  kitchen: z.object({
    sink: z.object({ x_mm: z.number(), y_mm: z.number(), placement_id: z.string().optional() }).optional(),
    hob: z.object({ x_mm: z.number(), y_mm: z.number(), placement_id: z.string().optional() }).optional(),
    fridge: z.object({ x_mm: z.number(), y_mm: z.number(), placement_id: z.string().optional() }).optional(),
  }).optional(),
}).strict()

export async function fengshuiRoutes(app: FastifyInstance) {
  // POST /projects/:id/analyze/fengshui
  app.post<{ Params: { id: string }; Body: z.infer<typeof AnalyzeBodySchema> }>(
    '/projects/:id/analyze/fengshui',
    async (request, reply) => {
      const project = await prisma.project.findUnique({ where: { id: request.params.id } })
      if (!project) return sendNotFound(reply, 'Project not found')

      const parsed = AnalyzeBodySchema.safeParse(request.body)
      if (!parsed.success) return sendBadRequest(reply, parsed.error.message)

      const result = analyzeFengShui(parsed.data)

      const created = await prisma.fengShuiAnalysis.create({
        data: {
          project_id: request.params.id,
          tenant_id: project.tenant_id ?? request.tenantId ?? '',
          mode: parsed.data.mode,
          entry_refs: parsed.data.entry
            ? (parsed.data.entry as unknown as Prisma.InputJsonValue)
            : Prisma.JsonNull,
          compass_deg: parsed.data.compass_deg,
          bounds_mm: parsed.data.bounds_mm as unknown as Prisma.InputJsonValue,
          zones_geojson: result.zones_geojson,
          findings: result.findings,
          score_total: result.score_total,
          score_west: result.score_west,
          score_east: result.score_east,
        },
        select: { id: true, mode: true, compass_deg: true, score_total: true, score_west: true, score_east: true, created_at: true },
      })

      return reply.status(201).send(created)
    },
  )

  // GET /projects/:id/fengshui-analyses
  app.get<{ Params: { id: string } }>(
    '/projects/:id/fengshui-analyses',
    async (request, reply) => {
      const project = await prisma.project.findUnique({ where: { id: request.params.id } })
      if (!project) return sendNotFound(reply, 'Project not found')

      const list = await prisma.fengShuiAnalysis.findMany({
        where: { project_id: request.params.id },
        select: { id: true, mode: true, score_total: true, score_west: true, score_east: true, compass_deg: true, created_at: true },
        orderBy: { created_at: 'desc' },
      })
      return reply.send(list)
    },
  )

  // GET /fengshui-analyses/:id
  app.get<{ Params: { id: string } }>(
    '/fengshui-analyses/:id',
    async (request, reply) => {
      const a = await prisma.fengShuiAnalysis.findUnique({
        where: { id: request.params.id },
        select: {
          id: true, project_id: true, tenant_id: true, mode: true,
          entry_refs: true, compass_deg: true, bounds_mm: true,
          score_total: true, score_west: true, score_east: true,
          created_at: true,
        },
      })
      if (!a) return sendNotFound(reply, 'FengShui analysis not found')
      return reply.send(a)
    },
  )

  // GET /fengshui-analyses/:id/zones
  app.get<{ Params: { id: string } }>(
    '/fengshui-analyses/:id/zones',
    async (request, reply) => {
      const a = await prisma.fengShuiAnalysis.findUnique({ where: { id: request.params.id } })
      if (!a) return sendNotFound(reply, 'FengShui analysis not found')
      return reply.send(a.zones_geojson)
    },
  )

  // GET /fengshui-analyses/:id/findings
  app.get<{ Params: { id: string } }>(
    '/fengshui-analyses/:id/findings',
    async (request, reply) => {
      const a = await prisma.fengShuiAnalysis.findUnique({ where: { id: request.params.id } })
      if (!a) return sendNotFound(reply, 'FengShui analysis not found')
      return reply.send(a.findings)
    },
  )

  // DELETE /fengshui-analyses/:id
  app.delete<{ Params: { id: string } }>(
    '/fengshui-analyses/:id',
    async (request, reply) => {
      const a = await prisma.fengShuiAnalysis.findUnique({ where: { id: request.params.id } })
      if (!a) return sendNotFound(reply, 'FengShui analysis not found')
      await prisma.fengShuiAnalysis.delete({ where: { id: request.params.id } })
      return reply.status(204).send()
    },
  )
}
