import { randomUUID } from 'node:crypto'
import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../db.js'
import { sendNotFound, sendBadRequest } from '../errors.js'

const MAX_DESCRIPTION_LENGTH = 2000

type ProjectJson = Record<string, unknown>

const QuoteLineSchema = z.object({
  id: z.string().uuid().default(() => randomUUID()),
  parent_id: z.string().uuid().optional(),
  type: z.enum(['standard', 'custom', 'text']).default('standard'),
  catalog_item_id: z.string().optional(),
  description: z.string().min(1).max(MAX_DESCRIPTION_LENGTH),
  qty: z.number().positive(),
  unit: z.enum(['stk', 'm', 'm2', 'pauschal']).default('stk'),
  list_price_net: z.number().min(0),
  dealer_price_net: z.number().min(0).optional(),
  position_discount_pct: z.number().min(0).max(100).default(0),
  pricing_group_id: z.string().uuid().optional(),
  exclude_from_order: z.boolean().default(false),
  exclude_from_quote: z.boolean().default(false),
  sort_order: z.number().int().min(0).default(0),
})

const PricingGroupSchema = z.object({
  id: z.string().uuid().default(() => randomUUID()),
  name: z.string().min(1).max(200),
  discount_pct: z.number().min(0).max(100),
})

export async function quoteLineRoutes(app: FastifyInstance) {
  // GET /projects/:projectId/quote-lines
  app.get<{ Params: { projectId: string } }>('/projects/:projectId/quote-lines', async (request, reply) => {
    const project = await prisma.project.findUnique({ where: { id: request.params.projectId } })
    if (!project) return sendNotFound(reply, 'Project not found')
    return reply.send(((project as unknown as ProjectJson).quote_lines as unknown[]) ?? [])
  })

  // POST /projects/:projectId/quote-lines
  app.post<{ Params: { projectId: string } }>('/projects/:projectId/quote-lines', async (request, reply) => {
    const parsed = QuoteLineSchema.safeParse(request.body)
    if (!parsed.success) return sendBadRequest(reply, parsed.error.errors[0].message)
    const project = await prisma.project.findUnique({ where: { id: request.params.projectId } })
    if (!project) return sendNotFound(reply, 'Project not found')
    const existing = ((project as unknown as ProjectJson).quote_lines as unknown[]) ?? []
    const newLine = { ...parsed.data, project_id: request.params.projectId }
    await prisma.project.update({ where: { id: request.params.projectId }, data: { quote_lines: [...existing, newLine] } as any })
    return reply.status(201).send(newLine)
  })

  // PATCH /projects/:projectId/quote-lines/:lineId
  app.patch<{ Params: { projectId: string; lineId: string } }>(
    '/projects/:projectId/quote-lines/:lineId',
    async (request, reply) => {
      const { projectId, lineId } = request.params
      const parsed = QuoteLineSchema.partial().safeParse(request.body)
      if (!parsed.success) return sendBadRequest(reply, parsed.error.errors[0].message)
      const project = await prisma.project.findUnique({ where: { id: projectId } })
      if (!project) return sendNotFound(reply, 'Project not found')
      const existing = ((project as unknown as ProjectJson).quote_lines as Array<{ id: string }>) ?? []
      let found = false
      const updated = existing.map(l => {
        if (l.id !== lineId) return l
        found = true
        return { ...l, ...parsed.data }
      })
      if (!found) return sendNotFound(reply, 'Quote line not found')
      await prisma.project.update({ where: { id: projectId }, data: { quote_lines: updated } as any })
      return reply.send(updated.find(l => l.id === lineId))
    },
  )

  // DELETE /projects/:projectId/quote-lines/:lineId
  app.delete<{ Params: { projectId: string; lineId: string } }>(
    '/projects/:projectId/quote-lines/:lineId',
    async (request, reply) => {
      const { projectId, lineId } = request.params
      const project = await prisma.project.findUnique({ where: { id: projectId } })
      if (!project) return sendNotFound(reply, 'Project not found')
      const existing = ((project as unknown as ProjectJson).quote_lines as Array<{ id: string }>) ?? []
      await prisma.project.update({ where: { id: projectId }, data: { quote_lines: existing.filter(l => l.id !== lineId) } as any })
      return reply.status(204).send()
    },
  )

  // GET /projects/:projectId/pricing-groups
  app.get<{ Params: { projectId: string } }>('/projects/:projectId/pricing-groups', async (request, reply) => {
    const project = await prisma.project.findUnique({ where: { id: request.params.projectId } })
    if (!project) return sendNotFound(reply, 'Project not found')
    return reply.send(((project as unknown as ProjectJson).pricing_groups_json as unknown[]) ?? [])
  })

  // POST /projects/:projectId/pricing-groups
  app.post<{ Params: { projectId: string } }>('/projects/:projectId/pricing-groups', async (request, reply) => {
    const parsed = PricingGroupSchema.safeParse(request.body)
    if (!parsed.success) return sendBadRequest(reply, parsed.error.errors[0].message)
    const project = await prisma.project.findUnique({ where: { id: request.params.projectId } })
    if (!project) return sendNotFound(reply, 'Project not found')
    const existing = ((project as unknown as ProjectJson).pricing_groups_json as unknown[]) ?? []
    const newGroup = { ...parsed.data, project_id: request.params.projectId }
    await prisma.project.update({ where: { id: request.params.projectId }, data: { pricing_groups_json: [...existing, newGroup] } as any })
    return reply.status(201).send(newGroup)
  })
}
