import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../db.js'
import { sendBadRequest, sendNotFound } from '../errors.js'
import { queueNotification } from '../services/notificationService.js'

const purchaseOrderStatusValues = [
  'draft',
  'sent',
  'confirmed',
  'partially_delivered',
  'delivered',
  'cancelled',
] as const

const PurchaseOrderItemSchema = z.object({
  position: z.number().int().min(0),
  sku: z.string().max(200).nullable().optional(),
  description: z.string().min(1).max(500),
  qty: z.number().positive(),
  unit: z.string().min(1).max(50).optional(),
  unit_price_net: z.number().min(0).optional(),
  line_net: z.number().min(0).optional(),
  notes: z.string().max(1000).nullable().optional(),
})

const CreatePurchaseOrderSchema = z.object({
  supplier_name: z.string().min(1).max(300),
  supplier_ref: z.string().max(200).nullable().optional(),
  order_date: z.string().datetime().nullable().optional(),
  delivery_date: z.string().datetime().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  created_by: z.string().min(1).max(200),
  items: z.array(PurchaseOrderItemSchema).optional(),
})

const UpdatePurchaseOrderSchema = z.object({
  supplier_name: z.string().min(1).max(300).optional(),
  supplier_ref: z.string().max(200).nullable().optional(),
  order_date: z.string().datetime().nullable().optional(),
  delivery_date: z.string().datetime().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  items: z.array(PurchaseOrderItemSchema).optional(),
})

const UpdateStatusSchema = z.object({
  status: z.enum(purchaseOrderStatusValues),
})

function parseOptionalDate(value: string | null | undefined): Date | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  return new Date(value)
}

export async function purchaseOrderRoutes(app: FastifyInstance) {
  // ─── Create purchase order for a project ────────────────────────────────────

  app.post<{ Params: { id: string } }>('/projects/:id/purchase-orders', async (request, reply) => {
    const parsed = CreatePurchaseOrderSchema.safeParse(request.body)
    if (!parsed.success) {
      return sendBadRequest(reply, parsed.error.errors[0]?.message ?? 'Invalid payload')
    }

    const project = await prisma.project.findUnique({ where: { id: request.params.id } })
    if (!project) {
      return sendNotFound(reply, 'Project not found')
    }

    const tenantId = project.tenant_id ?? request.tenantId ?? ''

    const { items, order_date, delivery_date, ...rest } = parsed.data

    const order = await prisma.purchaseOrder.create({
      data: {
        project_id: request.params.id,
        tenant_id: tenantId,
        order_date: parseOptionalDate(order_date) ?? null,
        delivery_date: parseOptionalDate(delivery_date) ?? null,
        ...rest,
        items: items
          ? {
              create: items.map((item) => ({
                position: item.position,
                sku: item.sku ?? null,
                description: item.description,
                qty: item.qty,
                unit: item.unit ?? 'Stk',
                unit_price_net: item.unit_price_net ?? 0,
                line_net: item.line_net ?? 0,
                notes: item.notes ?? null,
              })),
            }
          : undefined,
      },
      include: { items: { orderBy: { position: 'asc' } } },
    })

    return reply.status(201).send(order)
  })

  // ─── List purchase orders for a project ─────────────────────────────────────

  app.get<{ Params: { id: string } }>('/projects/:id/purchase-orders', async (request, reply) => {
    const project = await prisma.project.findUnique({ where: { id: request.params.id } })
    if (!project) {
      return sendNotFound(reply, 'Project not found')
    }

    const orders = await prisma.purchaseOrder.findMany({
      where: { project_id: request.params.id },
      include: { items: { orderBy: { position: 'asc' } } },
      orderBy: { created_at: 'desc' },
    })

    return reply.send(orders)
  })

  // ─── Get single purchase order ───────────────────────────────────────────────

  app.get<{ Params: { id: string } }>('/purchase-orders/:id', async (request, reply) => {
    const order = await prisma.purchaseOrder.findUnique({
      where: { id: request.params.id },
      include: { items: { orderBy: { position: 'asc' } } },
    })
    if (!order) {
      return sendNotFound(reply, 'Purchase order not found')
    }

    return reply.send(order)
  })

  // ─── Update purchase order ───────────────────────────────────────────────────

  app.put<{ Params: { id: string } }>('/purchase-orders/:id', async (request, reply) => {
    const parsed = UpdatePurchaseOrderSchema.safeParse(request.body)
    if (!parsed.success) {
      return sendBadRequest(reply, parsed.error.errors[0]?.message ?? 'Invalid payload')
    }

    const existing = await prisma.purchaseOrder.findUnique({ where: { id: request.params.id } })
    if (!existing) {
      return sendNotFound(reply, 'Purchase order not found')
    }

    const { items, order_date, delivery_date, ...rest } = parsed.data

    const order = await prisma.$transaction(async (tx) => {
      if (items !== undefined) {
        await tx.purchaseOrderItem.deleteMany({ where: { purchase_order_id: request.params.id } })
        if (items.length > 0) {
          await tx.purchaseOrderItem.createMany({
            data: items.map((item) => ({
              purchase_order_id: request.params.id,
              position: item.position,
              sku: item.sku ?? null,
              description: item.description,
              qty: item.qty,
              unit: item.unit ?? 'Stk',
              unit_price_net: item.unit_price_net ?? 0,
              line_net: item.line_net ?? 0,
              notes: item.notes ?? null,
            })),
          })
        }
      }

      return tx.purchaseOrder.update({
        where: { id: request.params.id },
        data: {
          ...rest,
          ...(order_date !== undefined ? { order_date: parseOptionalDate(order_date) } : {}),
          ...(delivery_date !== undefined ? { delivery_date: parseOptionalDate(delivery_date) } : {}),
        },
        include: { items: { orderBy: { position: 'asc' } } },
      })
    })

    return reply.send(order)
  })

  // ─── Update purchase order status ───────────────────────────────────────────

  app.patch<{ Params: { id: string } }>('/purchase-orders/:id/status', async (request, reply) => {
    const parsed = UpdateStatusSchema.safeParse(request.body)
    if (!parsed.success) {
      return sendBadRequest(reply, parsed.error.errors[0]?.message ?? 'Invalid payload')
    }

    const existing = await prisma.purchaseOrder.findUnique({ where: { id: request.params.id } })
    if (!existing) {
      return sendNotFound(reply, 'Purchase order not found')
    }

    const order = await prisma.purchaseOrder.update({
      where: { id: request.params.id },
      data: { status: parsed.data.status },
      include: { items: { orderBy: { position: 'asc' } } },
    })

    if (order.tenant_id) {
      await queueNotification({
        tenantId: order.tenant_id,
        eventType: 'custom',
        entityType: 'purchase_order',
        entityId: order.id,
        recipientEmail: `alerts+${order.tenant_id}@yakds.local`,
        subject: `Bestellstatus geändert: ${order.supplier_name}`,
        message: `Bestellung ${order.id} bei ${order.supplier_name} wurde auf ${order.status} gesetzt.`,
        metadata: { status: order.status },
      })
    }

    return reply.send(order)
  })

  // ─── Delete purchase order ───────────────────────────────────────────────────

  app.delete<{ Params: { id: string } }>('/purchase-orders/:id', async (request, reply) => {
    const existing = await prisma.purchaseOrder.findUnique({ where: { id: request.params.id } })
    if (!existing) {
      return sendNotFound(reply, 'Purchase order not found')
    }

    await prisma.purchaseOrder.delete({ where: { id: request.params.id } })
    return reply.status(204).send()
  })
}
