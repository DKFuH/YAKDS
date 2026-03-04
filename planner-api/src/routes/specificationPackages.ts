import type { FastifyInstance } from 'fastify'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '../db.js'
import { sendBadRequest, sendNotFound } from '../errors.js'
import { generateSpecificationPackage } from '../services/specificationPackageService.js'

const PackageBodySchema = z.object({
  name: z.string().min(1).max(140),
  config_json: z.object({
    sections: z.array(z.string()).optional(),
    include_cover_page: z.boolean().optional(),
    include_company_profile: z.boolean().optional(),
  }).default({}),
})

type SpecificationPackageStore = {
  findMany: (args: unknown) => Promise<Record<string, unknown>[]>
  findUnique: (args: unknown) => Promise<Record<string, unknown> | null>
  create: (args: unknown) => Promise<Record<string, unknown>>
  update: (args: unknown) => Promise<Record<string, unknown>>
  delete: (args: unknown) => Promise<Record<string, unknown>>
}

function getStore(): SpecificationPackageStore {
  return (prisma as unknown as { specificationPackage: SpecificationPackageStore }).specificationPackage
}

function ensureTenant(tenantId: string | null, reply: { status: (code: number) => { send: (payload: unknown) => unknown } }) {
  if (tenantId) return true
  reply.status(403).send({ error: 'FORBIDDEN', message: 'Missing tenant scope' })
  return false
}

export async function specificationPackageRoutes(app: FastifyInstance) {
  app.get<{ Params: { id: string } }>('/projects/:id/specification-packages', async (request, reply) => {
    if (!ensureTenant(request.tenantId, reply)) return

    const store = getStore()
    const items = await store.findMany({
      where: {
        tenant_id: request.tenantId,
        project_id: request.params.id,
      },
      orderBy: { created_at: 'asc' },
    })

    return reply.send(items)
  })

  app.post<{ Params: { id: string } }>('/projects/:id/specification-packages', async (request, reply) => {
    if (!ensureTenant(request.tenantId, reply)) return

    const project = await prisma.project.findUnique({
      where: { id: request.params.id },
      select: { id: true, tenant_id: true },
    })
    if (!project || project.tenant_id !== request.tenantId) {
      return sendNotFound(reply, 'Project not found')
    }

    const parsed = PackageBodySchema.safeParse(request.body ?? {})
    if (!parsed.success) return sendBadRequest(reply, parsed.error.errors[0]?.message ?? 'Invalid payload')

    const store = getStore()
    const created = await store.create({
      data: {
        tenant_id: request.tenantId,
        project_id: request.params.id,
        name: parsed.data.name,
        config_json: parsed.data.config_json as unknown as Prisma.InputJsonValue,
      },
    })

    return reply.status(201).send(created)
  })

  app.post<{ Params: { id: string } }>('/specification-packages/:id/generate', async (request, reply) => {
    if (!ensureTenant(request.tenantId, reply)) return

    const store = getStore()
    const existing = await store.findUnique({ where: { id: request.params.id } })
    if (!existing || String(existing.tenant_id) !== request.tenantId) {
      return sendNotFound(reply, 'Specification package not found')
    }

    const generated = await generateSpecificationPackage(
      prisma,
      String(existing.project_id),
      String(existing.id),
      ((existing.config_json ?? {}) as Record<string, unknown>) ?? {},
    )

    const updated = await store.update({
      where: { id: request.params.id },
      data: {
        generated_at: new Date(),
        artifact_json: {
          generated_at: new Date().toISOString(),
          sections: generated.sections,
          filename: `specification-package-${String(existing.id).slice(0, 8)}.pdf`,
        } as unknown as Prisma.InputJsonValue,
      },
    })

    return reply.send({
      id: updated.id,
      sections: generated.sections,
      generated_at: updated.generated_at,
    })
  })

  app.get<{ Params: { id: string } }>('/specification-packages/:id/download', async (request, reply) => {
    if (!ensureTenant(request.tenantId, reply)) return

    const store = getStore()
    const existing = await store.findUnique({ where: { id: request.params.id } })
    if (!existing || String(existing.tenant_id) !== request.tenantId) {
      return sendNotFound(reply, 'Specification package not found')
    }

    const generated = await generateSpecificationPackage(
      prisma,
      String(existing.project_id),
      String(existing.id),
      ((existing.config_json ?? {}) as Record<string, unknown>) ?? {},
    )

    const filename = `specification-package-${String(existing.id).slice(0, 8)}.pdf`
    reply.header('content-disposition', `attachment; filename="${filename}"`)
    reply.type('application/pdf')
    return reply.send(generated.merged_pdf)
  })

  app.delete<{ Params: { id: string } }>('/specification-packages/:id', async (request, reply) => {
    if (!ensureTenant(request.tenantId, reply)) return

    const store = getStore()
    const existing = await store.findUnique({ where: { id: request.params.id } })
    if (!existing || String(existing.tenant_id) !== request.tenantId) {
      return sendNotFound(reply, 'Specification package not found')
    }

    await store.delete({ where: { id: request.params.id } })
    return reply.status(204).send()
  })
}
