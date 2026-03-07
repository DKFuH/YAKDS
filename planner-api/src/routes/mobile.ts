import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../db.js'
import { sendBadRequest, sendForbidden, sendNotFound } from '../errors.js'
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

const allowedTransitions: Record<ProductionOrderStatus, ProductionOrderStatus[]> = {
  draft: ['confirmed'],
  confirmed: ['in_production'],
  in_production: ['ready'],
  ready: ['delivered'],
  delivered: ['installed'],
  installed: [],
}

const MobileOrderParamsSchema = z.object({
  id: z.string().uuid(),
})

const ConfirmStepSchema = z.object({
  to_status: z.enum(productionOrderStatusValues),
  note: z.string().max(1000).optional(),
})

const ReportIssueSchema = z.object({
  note: z.string().min(1).max(1000),
  severity: z.enum(['low', 'medium', 'high']).default('medium'),
})

const NotificationsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(30),
})

function headerValue(value: string | string[] | undefined): string | null {
  if (!value) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

function getTenantId(request: { tenantId?: string | null; headers?: Record<string, string | string[] | undefined> }): string | null {
  return request.tenantId ?? headerValue(request.headers?.['x-tenant-id'])
}

function getUserId(request: { headers?: Record<string, string | string[] | undefined> }): string | null {
  return headerValue(request.headers?.['x-user-id'])
}

function getUserEmail(request: { headers?: Record<string, string | string[] | undefined> }): string | null {
  return headerValue(request.headers?.['x-user-email'])
}

export async function mobileRoutes(app: FastifyInstance) {
  app.get('/mobile/me/dashboard', async (request, reply) => {
    const tenantId = getTenantId(request)
    const userId = getUserId(request)
    if (!tenantId || !userId) {
      return sendForbidden(reply, 'Auth context and tenant scope are required')
    }

    const now = new Date()
    const dueThreshold = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

    const [projects, orders] = await Promise.all([
      prisma.project.findMany({
        where: {
          tenant_id: tenantId,
          OR: [
            { assigned_to: userId },
            { user_id: userId },
          ],
        },
        select: {
          id: true,
          name: true,
          project_status: true,
          progress_pct: true,
          updated_at: true,
        },
        orderBy: { updated_at: 'desc' },
        take: 20,
      }),
      prisma.productionOrder.findMany({
        where: {
          tenant_id: tenantId,
          project: {
            OR: [
              { assigned_to: userId },
              { user_id: userId },
            ],
          },
        },
        select: {
          id: true,
          status: true,
          due_date: true,
          updated_at: true,
        },
        orderBy: { updated_at: 'desc' },
        take: 100,
      }),
    ])

    const byStatus = orders.reduce<Record<string, number>>((acc, order) => {
      const key = order.status
      acc[key] = (acc[key] ?? 0) + 1
      return acc
    }, {})

    const dueSoon = orders.filter((order) => {
      if (!order.due_date) return false
      if (order.status === 'installed') return false
      return order.due_date <= dueThreshold
    }).length

    return reply.send({
      user_id: userId,
      assigned_projects: projects.length,
      active_orders: orders.filter((order) => order.status !== 'installed').length,
      due_soon_orders: dueSoon,
      orders_by_status: byStatus,
      recent_projects: projects,
      recent_orders: orders.slice(0, 10),
      generated_at: now.toISOString(),
    })
  })

  app.get<{ Params: { id: string } }>('/mobile/orders/:id/status', async (request, reply) => {
    const tenantId = getTenantId(request)
    if (!tenantId) {
      return sendForbidden(reply, 'Tenant scope is required')
    }

    const params = MobileOrderParamsSchema.safeParse(request.params)
    if (!params.success) {
      return sendBadRequest(reply, params.error.errors[0]?.message ?? 'Invalid order id')
    }

    const order = await prisma.productionOrder.findFirst({
      where: {
        id: params.data.id,
        tenant_id: tenantId,
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            project_status: true,
            progress_pct: true,
          },
        },
      },
    })

    if (!order) {
      return sendNotFound(reply, 'Production order not found in tenant scope')
    }

    return reply.send({
      id: order.id,
      status: order.status,
      due_date: order.due_date,
      frozen_at: order.frozen_at,
      notes: order.notes,
      project: order.project,
      updated_at: order.updated_at,
    })
  })

  app.get<{ Params: { id: string } }>('/mobile/orders/:id/timeline', async (request, reply) => {
    const tenantId = getTenantId(request)
    if (!tenantId) {
      return sendForbidden(reply, 'Tenant scope is required')
    }

    const params = MobileOrderParamsSchema.safeParse(request.params)
    if (!params.success) {
      return sendBadRequest(reply, params.error.errors[0]?.message ?? 'Invalid order id')
    }

    const order = await prisma.productionOrder.findFirst({
      where: {
        id: params.data.id,
        tenant_id: tenantId,
      },
      select: {
        id: true,
        status: true,
        created_at: true,
      },
    })

    if (!order) {
      return sendNotFound(reply, 'Production order not found in tenant scope')
    }

    const events = await prisma.productionOrderEvent.findMany({
      where: {
        production_order_id: order.id,
      },
      orderBy: { created_at: 'asc' },
    })

    const timeline = [
      {
        type: 'order_created',
        created_at: order.created_at,
        to_status: order.status,
        note: 'Production order created',
      },
      ...events.map((event) => ({
        type: 'status_event',
        created_at: event.created_at,
        from_status: event.from_status,
        to_status: event.to_status,
        user_id: event.user_id,
        note: event.note,
      })),
    ]

    return reply.send({
      order_id: order.id,
      timeline,
    })
  })

  app.post<{ Params: { id: string } }>('/mobile/orders/:id/actions/confirm-step', async (request, reply) => {
    const tenantId = getTenantId(request)
    const userId = getUserId(request)
    if (!tenantId || !userId) {
      return sendForbidden(reply, 'Auth context and tenant scope are required')
    }

    const params = MobileOrderParamsSchema.safeParse(request.params)
    if (!params.success) {
      return sendBadRequest(reply, params.error.errors[0]?.message ?? 'Invalid order id')
    }

    const body = ConfirmStepSchema.safeParse(request.body)
    if (!body.success) {
      return sendBadRequest(reply, body.error.errors[0]?.message ?? 'Invalid payload')
    }

    const existing = await prisma.productionOrder.findFirst({
      where: {
        id: params.data.id,
        tenant_id: tenantId,
      },
      select: {
        id: true,
        status: true,
        tenant_id: true,
        frozen_at: true,
      },
    })

    if (!existing) {
      return sendNotFound(reply, 'Production order not found in tenant scope')
    }

    const allowed = allowedTransitions[existing.status as ProductionOrderStatus]
    if (!allowed.includes(body.data.to_status)) {
      return sendBadRequest(
        reply,
        `Status transition from '${existing.status}' to '${body.data.to_status}' is not allowed`,
      )
    }

    const shouldFreeze = existing.status === 'draft' && body.data.to_status !== 'draft'

    const updated = await prisma.$transaction(async (tx) => {
      await tx.productionOrderEvent.create({
        data: {
          production_order_id: existing.id,
          from_status: existing.status,
          to_status: body.data.to_status,
          user_id: userId,
          note: body.data.note ?? 'Step confirmed via mobile',
        },
      })

      return tx.productionOrder.update({
        where: { id: existing.id },
        data: {
          status: body.data.to_status,
          frozen_at: shouldFreeze ? new Date() : existing.frozen_at,
        },
        select: {
          id: true,
          status: true,
          frozen_at: true,
          updated_at: true,
        },
      })
    })

    await queueNotification({
      tenantId,
      eventType: 'custom',
      entityType: 'production_order',
      entityId: existing.id,
      recipientEmail: `alerts+${tenantId}@okp.local`,
      subject: 'Mobile step confirmed',
      message: `Production order ${existing.id} moved to ${body.data.to_status}`,
      metadata: {
        source: 'mobile',
        user_id: userId,
      },
    })

    return reply.send(updated)
  })

  app.post<{ Params: { id: string } }>('/mobile/orders/:id/actions/report-issue', async (request, reply) => {
    const tenantId = getTenantId(request)
    const userId = getUserId(request)
    if (!tenantId || !userId) {
      return sendForbidden(reply, 'Auth context and tenant scope are required')
    }

    const params = MobileOrderParamsSchema.safeParse(request.params)
    if (!params.success) {
      return sendBadRequest(reply, params.error.errors[0]?.message ?? 'Invalid order id')
    }

    const body = ReportIssueSchema.safeParse(request.body)
    if (!body.success) {
      return sendBadRequest(reply, body.error.errors[0]?.message ?? 'Invalid payload')
    }

    const order = await prisma.productionOrder.findFirst({
      where: {
        id: params.data.id,
        tenant_id: tenantId,
      },
      select: {
        id: true,
        status: true,
      },
    })

    if (!order) {
      return sendNotFound(reply, 'Production order not found in tenant scope')
    }

    const issueEvent = await prisma.productionOrderEvent.create({
      data: {
        production_order_id: order.id,
        from_status: order.status,
        to_status: order.status,
        user_id: userId,
        note: `[issue:${body.data.severity}] ${body.data.note}`,
      },
    })

    await queueNotification({
      tenantId,
      eventType: 'custom',
      entityType: 'production_order_issue',
      entityId: order.id,
      recipientEmail: `alerts+${tenantId}@okp.local`,
      subject: 'Mobile issue reported',
      message: `Issue reported for production order ${order.id}`,
      metadata: {
        source: 'mobile',
        severity: body.data.severity,
        user_id: userId,
      },
    })

    return reply.status(201).send({
      reported: true,
      event_id: issueEvent.id,
    })
  })

  app.get<{ Querystring: { limit?: number } }>('/mobile/notifications', async (request, reply) => {
    const tenantId = getTenantId(request)
    if (!tenantId) {
      return sendForbidden(reply, 'Tenant scope is required')
    }

    const query = NotificationsQuerySchema.safeParse(request.query)
    if (!query.success) {
      return sendBadRequest(reply, query.error.errors[0]?.message ?? 'Invalid query')
    }

    const userEmail = getUserEmail(request)

    const events = await prisma.notificationEvent.findMany({
      where: {
        tenant_id: tenantId,
        ...(userEmail ? { recipient_email: userEmail } : {}),
      },
      orderBy: { created_at: 'desc' },
      take: query.data.limit,
    })

    return reply.send({
      count: events.length,
      events,
    })
  })
}
