import type { FastifyInstance } from 'fastify'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '../db.js'
import { sendBadRequest, sendNotFound } from '../errors.js'
import {
  generateShareToken,
  isExpired,
  normalizePanoramaPoints,
  resolveExpiryDate,
} from '../services/panoramaTourService.js'

const TourBodySchema = z.object({
  name: z.string().min(1).max(140),
  points_json: z.array(z.unknown()).default([]),
})

const ShareBodySchema = z.object({
  expires_in_days: z.number().int().positive().max(3650).optional(),
})

type PanoramaTourStore = {
  findMany: (args: unknown) => Promise<Record<string, unknown>[]>
  findUnique: (args: unknown) => Promise<Record<string, unknown> | null>
  create: (args: unknown) => Promise<Record<string, unknown>>
  update: (args: unknown) => Promise<Record<string, unknown>>
  delete: (args: unknown) => Promise<Record<string, unknown>>
}

function getStore(): PanoramaTourStore {
  return (prisma as unknown as { panoramaTour: PanoramaTourStore }).panoramaTour
}

function ensureTenant(tenantId: string | null, reply: { status: (code: number) => { send: (payload: unknown) => unknown } }) {
  if (tenantId) return true
  reply.status(403).send({ error: 'FORBIDDEN', message: 'Missing tenant scope' })
  return false
}

export async function panoramaTourRoutes(app: FastifyInstance) {
  app.get<{ Params: { id: string } }>('/projects/:id/panorama-tours', async (request, reply) => {
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

  app.post<{ Params: { id: string } }>('/projects/:id/panorama-tours', async (request, reply) => {
    if (!ensureTenant(request.tenantId, reply)) return

    const project = await prisma.project.findUnique({
      where: { id: request.params.id },
      select: { id: true, tenant_id: true },
    })
    if (!project || project.tenant_id !== request.tenantId) {
      return sendNotFound(reply, 'Project not found')
    }

    const parsed = TourBodySchema.safeParse(request.body ?? {})
    if (!parsed.success) return sendBadRequest(reply, parsed.error.errors[0]?.message ?? 'Invalid payload')

    let normalizedPoints: unknown[]
    try {
      normalizedPoints = normalizePanoramaPoints(parsed.data.points_json)
    } catch {
      return sendBadRequest(reply, 'Invalid panorama points payload')
    }

    const store = getStore()
    const created = await store.create({
      data: {
        tenant_id: request.tenantId,
        project_id: request.params.id,
        name: parsed.data.name,
        points_json: normalizedPoints as Prisma.InputJsonValue,
      },
    })

    return reply.status(201).send(created)
  })

  app.put<{ Params: { id: string } }>('/panorama-tours/:id', async (request, reply) => {
    if (!ensureTenant(request.tenantId, reply)) return

    const parsed = TourBodySchema.safeParse(request.body ?? {})
    if (!parsed.success) return sendBadRequest(reply, parsed.error.errors[0]?.message ?? 'Invalid payload')

    const store = getStore()
    const existing = await store.findUnique({ where: { id: request.params.id } })
    if (!existing || String(existing.tenant_id) !== request.tenantId) {
      return sendNotFound(reply, 'Panorama tour not found')
    }

    let normalizedPoints: unknown[]
    try {
      normalizedPoints = normalizePanoramaPoints(parsed.data.points_json)
    } catch {
      return sendBadRequest(reply, 'Invalid panorama points payload')
    }

    const updated = await store.update({
      where: { id: request.params.id },
      data: {
        name: parsed.data.name,
        points_json: normalizedPoints as Prisma.InputJsonValue,
      },
    })

    return reply.send(updated)
  })

  app.delete<{ Params: { id: string } }>('/panorama-tours/:id', async (request, reply) => {
    if (!ensureTenant(request.tenantId, reply)) return

    const store = getStore()
    const existing = await store.findUnique({ where: { id: request.params.id } })
    if (!existing || String(existing.tenant_id) !== request.tenantId) {
      return sendNotFound(reply, 'Panorama tour not found')
    }

    await store.delete({ where: { id: request.params.id } })
    return reply.status(204).send()
  })

  app.post<{ Params: { id: string } }>('/panorama-tours/:id/share', async (request, reply) => {
    if (!ensureTenant(request.tenantId, reply)) return

    const parsed = ShareBodySchema.safeParse(request.body ?? {})
    if (!parsed.success) return sendBadRequest(reply, parsed.error.errors[0]?.message ?? 'Invalid payload')

    const store = getStore()
    const existing = await store.findUnique({ where: { id: request.params.id } })
    if (!existing || String(existing.tenant_id) !== request.tenantId) {
      return sendNotFound(reply, 'Panorama tour not found')
    }

    const share_token = generateShareToken()
    const expires_at = resolveExpiryDate(parsed.data.expires_in_days ?? null)

    const updated = await store.update({
      where: { id: request.params.id },
      data: {
        share_token,
        expires_at,
      },
    })

    return reply.send({
      id: String(updated.id),
      share_token,
      expires_at,
      share_url: `/share/panorama/${share_token}`,
    })
  })

  app.get<{ Params: { token: string } }>('/share/panorama/:token', async (request, reply) => {
    const store = getStore()
    const found = await store.findUnique({ where: { share_token: request.params.token } })
    if (!found) {
      return sendNotFound(reply, 'Panorama tour not found')
    }

    const expiresAt = found.expires_at as Date | string | null | undefined
    const expiresDate = expiresAt ? new Date(expiresAt) : null
    if (isExpired(expiresDate)) {
      return reply.status(410).send({
        error: 'GONE',
        message: 'Panorama share link expired',
      })
    }

    return reply.send({
      id: found.id,
      project_id: found.project_id,
      name: found.name,
      points_json: found.points_json,
      expires_at: expiresDate,
    })
  })
}
