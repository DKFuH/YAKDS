import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../db.js'
import { sendBadRequest } from '../errors.js'

const WorkspaceLayoutSchema = z.object({
  layout_json: z.record(z.unknown()),
})

export async function workspaceLayoutRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { user_id: string } }>('/user/workspace-layout', async (request, reply) => {
    const userId = (request.query as { user_id?: string }).user_id
    if (!userId) {
      return sendBadRequest(reply, 'user_id is required')
    }

    const layout = await prisma.userWorkspaceLayout.findUnique({
      where: { user_id: userId },
    })

    return reply.send(layout ?? { user_id: userId, layout_json: {} })
  })

  app.put<{ Querystring: { user_id: string } }>('/user/workspace-layout', async (request, reply) => {
    const userId = (request.query as { user_id?: string }).user_id
    if (!userId) {
      return sendBadRequest(reply, 'user_id is required')
    }

    const parsed = WorkspaceLayoutSchema.safeParse(request.body)
    if (!parsed.success) {
      return sendBadRequest(reply, parsed.error.errors[0]?.message ?? 'Invalid payload')
    }

    const layout = await prisma.userWorkspaceLayout.upsert({
      where: { user_id: userId },
      create: { user_id: userId, layout_json: parsed.data.layout_json as object },
      update: { layout_json: parsed.data.layout_json as object },
    })

    return reply.send(layout)
  })
}
