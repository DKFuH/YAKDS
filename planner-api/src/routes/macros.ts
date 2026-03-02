import { randomUUID } from 'node:crypto'
import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../db.js'
import { sendNotFound, sendBadRequest } from '../errors.js'

type ProjectJson = Record<string, unknown>

const MacroSchema = z.object({
  id: z.string().uuid().default(() => randomUUID()),
  name: z.string().min(1).max(200),
  placements: z.array(z.record(z.unknown())).min(1),
})

export async function macroRoutes(app: FastifyInstance) {
  // GET /projects/:projectId/macros
  app.get<{ Params: { projectId: string } }>('/projects/:projectId/macros', async (request, reply) => {
    const project = await prisma.project.findUnique({ where: { id: request.params.projectId } })
    if (!project) return sendNotFound(reply, 'Project not found')
    return reply.send(((project as unknown as ProjectJson).macros as unknown[]) ?? [])
  })

  // POST /projects/:projectId/macros
  app.post<{ Params: { projectId: string } }>('/projects/:projectId/macros', async (request, reply) => {
    const parsed = MacroSchema.safeParse(request.body)
    if (!parsed.success) return sendBadRequest(reply, parsed.error.errors[0].message)
    const project = await prisma.project.findUnique({ where: { id: request.params.projectId } })
    if (!project) return sendNotFound(reply, 'Project not found')
    const existing = ((project as unknown as ProjectJson).macros as unknown[]) ?? []
    const newMacro = { ...parsed.data, project_id: request.params.projectId, created_at: new Date().toISOString() }
    await prisma.project.update({ where: { id: request.params.projectId }, data: { macros: [...existing, newMacro] } as any })
    return reply.status(201).send(newMacro)
  })

  // DELETE /projects/:projectId/macros/:macroId
  app.delete<{ Params: { projectId: string; macroId: string } }>(
    '/projects/:projectId/macros/:macroId',
    async (request, reply) => {
      const { projectId, macroId } = request.params
      const project = await prisma.project.findUnique({ where: { id: projectId } })
      if (!project) return sendNotFound(reply, 'Project not found')
      const existing = ((project as unknown as ProjectJson).macros as Array<{ id: string }>) ?? []
      await prisma.project.update({ where: { id: projectId }, data: { macros: existing.filter(m => m.id !== macroId) } as any })
      return reply.status(204).send()
    },
  )
}
