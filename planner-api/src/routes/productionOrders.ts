import type { FastifyInstance } from 'fastify'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '../db.js'
import { sendBadRequest, sendNotFound } from '../errors.js'
import { queueNotification } from '../services/notificationService.js'

const productionOrderStatusValues = [
  'draft',
  'confirmed',
  'in_production',
  'ready',
  'delivered',
  'installed',
] as const

type ProductionOrderStatus = (typeof productionOrderStatusValues)[number]

// Status-Übergänge: welche Folge-Zustände sind erlaubt?
const ALLOWED_TRANSITIONS: Record<ProductionOrderStatus, ProductionOrderStatus[]> = {
  draft: ['confirmed'],
  confirmed: ['in_production'],
  in_production: ['ready'],
  ready: ['delivered'],
  delivered: ['installed'],
  installed: [],
}

// Freeze-Guard: ab diesem Status darf die Planung nicht mehr geändert werden
const FROZEN_STATUSES: ProductionOrderStatus[] = [
  'confirmed',
  'in_production',
  'ready',
  'delivered',
  'installed',
]

const CreateProductionOrderSchema = z.object({
  quote_id: z.string().uuid().optional(),
  bom_snapshot: z.record(z.unknown()).optional(),
  due_date: z.string().datetime().nullable().optional(),
  created_by: z.string().min(1).max(200),
  notes: z.string().max(2000).nullable().optional(),
})

const UpdateStatusSchema = z.object({
  status: z.enum(productionOrderStatusValues),
  user_id: z.string().max(200).optional(),
  note: z.string().max(1000).nullable().optional(),
})

const LinkPurchaseOrderSchema = z.object({
  purchase_order_id: z.string().uuid(),
})

// ─── Hilfsfunktion: Ist ein Projekt eingefroren? ──────────────────────────────

export async function isProjectFrozen(projectId: string): Promise<boolean> {
  const frozenOrder = await prisma.productionOrder.findFirst({
    where: {
      project_id: projectId,
      status: { in: FROZEN_STATUSES },
    },
    select: { id: true },
  })
  return frozenOrder !== null
}

// ─── Routes ──────────────────────────────────────────────────────────────────

export async function productionOrderRoutes(app: FastifyInstance) {
  // ─── Freeze-Status eines Projekts abrufen ────────────────────────────────

  app.get<{ Params: { id: string } }>('/projects/:id/freeze-status', async (request, reply) => {
    const project = await prisma.project.findUnique({ where: { id: request.params.id } })
    if (!project) return sendNotFound(reply, 'Project not found')

    const frozen = await isProjectFrozen(request.params.id)
    const frozenOrder = frozen
      ? await prisma.productionOrder.findFirst({
          where: { project_id: request.params.id, status: { in: FROZEN_STATUSES } },
          select: { id: true, status: true, frozen_at: true },
        })
      : null

    return reply.send({ frozen, production_order: frozenOrder })
  })

  // ─── Produktionsauftrag erstellen ────────────────────────────────────────

  app.post<{ Params: { id: string } }>('/projects/:id/production-orders', async (request, reply) => {
    const parsed = CreateProductionOrderSchema.safeParse(request.body)
    if (!parsed.success) {
      return sendBadRequest(reply, parsed.error.errors[0]?.message ?? 'Invalid payload')
    }

    const project = await prisma.project.findUnique({ where: { id: request.params.id } })
    if (!project) return sendNotFound(reply, 'Project not found')

    const tenantId = project.tenant_id ?? request.tenantId ?? ''
    const { quote_id, bom_snapshot, due_date, created_by, notes } = parsed.data

    const order = await prisma.productionOrder.create({
      data: {
        project_id: request.params.id,
        tenant_id: tenantId,
        quote_id: quote_id ?? null,
        bom_snapshot: (bom_snapshot ?? {}) as Prisma.InputJsonValue,
        due_date: due_date ? new Date(due_date) : null,
        created_by,
        notes: notes ?? null,
      },
      include: { events: { orderBy: { created_at: 'asc' } } },
    })

    return reply.status(201).send(order)
  })

  // ─── Alle Produktionsaufträge eines Projekts auflisten ───────────────────

  app.get<{ Params: { id: string } }>('/projects/:id/production-orders', async (request, reply) => {
    const project = await prisma.project.findUnique({ where: { id: request.params.id } })
    if (!project) return sendNotFound(reply, 'Project not found')

    const orders = await prisma.productionOrder.findMany({
      where: { project_id: request.params.id },
      include: {
        events: { orderBy: { created_at: 'asc' } },
        purchase_orders: { select: { id: true, supplier_name: true, status: true } },
      },
      orderBy: { created_at: 'desc' },
    })

    return reply.send(orders)
  })

  // ─── Einzelnen Produktionsauftrag abrufen ─────────────────────────────────

  app.get<{ Params: { id: string } }>('/production-orders/:id', async (request, reply) => {
    const order = await prisma.productionOrder.findUnique({
      where: { id: request.params.id },
      include: {
        events: { orderBy: { created_at: 'asc' } },
        purchase_orders: { select: { id: true, supplier_name: true, status: true } },
      },
    })
    if (!order) return sendNotFound(reply, 'Production order not found')

    return reply.send(order)
  })

  // ─── Status-Übergang mit Audit-Log ────────────────────────────────────────

  app.patch<{ Params: { id: string } }>('/production-orders/:id/status', async (request, reply) => {
    const parsed = UpdateStatusSchema.safeParse(request.body)
    if (!parsed.success) {
      return sendBadRequest(reply, parsed.error.errors[0]?.message ?? 'Invalid payload')
    }

    const existing = await prisma.productionOrder.findUnique({
      where: { id: request.params.id },
    })
    if (!existing) return sendNotFound(reply, 'Production order not found')

    const currentStatus = existing.status as ProductionOrderStatus
    const targetStatus = parsed.data.status as ProductionOrderStatus
    const allowed = ALLOWED_TRANSITIONS[currentStatus]

    if (!allowed.includes(targetStatus)) {
      return sendBadRequest(
        reply,
        `Statusübergang von '${currentStatus}' nach '${targetStatus}' nicht erlaubt. Erlaubt: ${allowed.join(', ') || '–'}`,
      )
    }

    const isFreezing = FROZEN_STATUSES.includes(targetStatus) && !FROZEN_STATUSES.includes(currentStatus)

    const order = await prisma.$transaction(async (tx) => {
      // Audit-Event schreiben
      await tx.productionOrderEvent.create({
        data: {
          production_order_id: existing.id,
          from_status: currentStatus,
          to_status: targetStatus,
          user_id: parsed.data.user_id ?? null,
          note: parsed.data.note ?? null,
        },
      })

      return tx.productionOrder.update({
        where: { id: existing.id },
        data: {
          status: targetStatus,
          frozen_at: isFreezing ? new Date() : existing.frozen_at,
        },
        include: {
          events: { orderBy: { created_at: 'asc' } },
          purchase_orders: { select: { id: true, supplier_name: true, status: true } },
        },
      })
    })

    if (order.tenant_id) {
      await queueNotification({
        tenantId: order.tenant_id,
        eventType: 'custom',
        entityType: 'production_order',
        entityId: order.id,
        recipientEmail: `alerts+${order.tenant_id}@okp.local`,
        subject: `Produktionsauftrag-Status geändert`,
        message: `Produktionsauftrag ${order.id} wurde auf '${targetStatus}' gesetzt.${isFreezing ? ' Planung ist jetzt eingefroren.' : ''}`,
        metadata: { status: targetStatus, frozen: isFreezing },
      })
    }

    return reply.send(order)
  })

  // ─── PurchaseOrder mit ProductionOrder verknüpfen ─────────────────────────

  app.patch<{ Params: { id: string } }>(
    '/production-orders/:id/link-purchase-order',
    async (request, reply) => {
      const parsed = LinkPurchaseOrderSchema.safeParse(request.body)
      if (!parsed.success) {
        return sendBadRequest(reply, parsed.error.errors[0]?.message ?? 'Invalid payload')
      }

      const productionOrder = await prisma.productionOrder.findUnique({
        where: { id: request.params.id },
      })
      if (!productionOrder) return sendNotFound(reply, 'Production order not found')

      const purchaseOrder = await prisma.purchaseOrder.findUnique({
        where: { id: parsed.data.purchase_order_id },
      })
      if (!purchaseOrder) return sendNotFound(reply, 'Purchase order not found')

      if (purchaseOrder.project_id !== productionOrder.project_id) {
        return sendBadRequest(reply, 'Purchase order belongs to a different project')
      }

      await prisma.purchaseOrder.update({
        where: { id: parsed.data.purchase_order_id },
        data: { production_order_id: request.params.id },
      })

      const updated = await prisma.productionOrder.findUnique({
        where: { id: request.params.id },
        include: {
          events: { orderBy: { created_at: 'asc' } },
          purchase_orders: { select: { id: true, supplier_name: true, status: true } },
        },
      })

      return reply.send(updated)
    },
  )

  // ─── Produktionsauftrag löschen (nur draft) ───────────────────────────────

  app.delete<{ Params: { id: string } }>('/production-orders/:id', async (request, reply) => {
    const existing = await prisma.productionOrder.findUnique({
      where: { id: request.params.id },
    })
    if (!existing) return sendNotFound(reply, 'Production order not found')

    if (existing.status !== 'draft') {
      return sendBadRequest(reply, 'Nur Produktionsaufträge im Status "draft" können gelöscht werden')
    }

    await prisma.productionOrder.delete({ where: { id: request.params.id } })
    return reply.status(204).send()
  })
}
