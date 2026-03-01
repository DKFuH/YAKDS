import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../db.js'
import { sendBadRequest, sendNotFound } from '../errors.js'

const ProjectParamsSchema = z.object({
  id: z.string().uuid(),
})

const BusinessSummaryBodySchema = z.object({
  lead_status: z.enum(['new', 'qualified', 'quoted', 'won', 'lost']).optional(),
  quote_value: z.number().nonnegative().nullable().optional(),
  close_probability: z.number().int().min(0).max(100).nullable().optional(),
  customer_price_lists: z.array(
    z.object({
      name: z.string().min(1).max(120),
      price_adjustment_pct: z.number().min(-100).max(500).default(0),
      notes: z.string().max(500).nullable().optional(),
    }),
  ).default([]),
  customer_discounts: z.array(
    z.object({
      label: z.string().min(1).max(120),
      discount_pct: z.number().min(0).max(100),
      scope: z.string().min(1).max(80).default('project'),
    }),
  ).default([]),
  project_line_items: z.array(
    z.object({
      source_type: z.enum(['manual', 'bom', 'pricing', 'quote']).default('manual'),
      description: z.string().min(1).max(500),
      qty: z.number().positive(),
      unit: z.string().min(1).max(20),
      unit_price_net: z.number(),
      tax_rate: z.number().min(0),
    }),
  ).default([]),
})

const WebhookBodySchema = z.object({
  target_url: z.string().url().refine((url) => !isPrivateOrBlockedUrl(url), {
    message: 'Webhook target_url must not point to private or internal network addresses',
  }),
  event: z.string().min(1).max(120).default('project.business.exported'),
})

/** Block SSRF: rejects localhost, RFC-1918 / link-local addresses and non-http(s) schemes. */
function isPrivateOrBlockedUrl(url: string): boolean {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return true
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) return true
  const hostname = parsed.hostname
  if (hostname === 'localhost') return true
  // IPv6 loopback / link-local
  if (hostname === '[::1]' || hostname === '::1') return true
  if (hostname.startsWith('[fe80:') || hostname.startsWith('[fc') || hostname.startsWith('[fd')) return true
  // IPv4 private / link-local ranges
  const privateRanges = [
    /^127\./,           // loopback
    /^10\./,            // RFC-1918
    /^172\.(1[6-9]|2\d|3[01])\./,  // RFC-1918
    /^192\.168\./,      // RFC-1918
    /^169\.254\./,      // link-local / cloud metadata (AWS, GCP, Azure)
    /^0\./,             // this-network
    /^100\.(6[4-9]|[7-9]\d|1[0-1]\d|12[0-7])\./,  // CGNAT RFC-6598
  ]
  if (privateRanges.some((r) => r.test(hostname))) return true
  return false
}

type BusinessProject = Awaited<ReturnType<typeof loadBusinessProject>>

function toLineNet(qty: number, unitPriceNet: number) {
  return Number((qty * unitPriceNet).toFixed(2))
}

async function loadBusinessProject(projectId: string) {
  return prisma.project.findUnique({
    where: { id: projectId },
    include: {
      customer_price_lists: { orderBy: { created_at: 'asc' } },
      customer_discounts: { orderBy: { created_at: 'asc' } },
      project_line_items: { orderBy: { created_at: 'asc' } },
    },
  })
}

function toBusinessSummary(project: Exclude<BusinessProject, null>) {
  const totalLineNet = project.project_line_items.reduce((sum, item) => sum + item.line_net, 0)

  return {
    project: {
      id: project.id,
      user_id: project.user_id,
      name: project.name,
      description: project.description,
      status: project.status,
      lead_status: project.lead_status,
      quote_value: project.quote_value,
      close_probability: project.close_probability,
      created_at: project.created_at,
      updated_at: project.updated_at,
    },
    customer_price_lists: project.customer_price_lists,
    customer_discounts: project.customer_discounts,
    project_line_items: project.project_line_items,
    totals: {
      project_line_items_net: Number(totalLineNet.toFixed(2)),
      customer_discount_count: project.customer_discounts.length,
      customer_price_list_count: project.customer_price_lists.length,
    },
  }
}

function escapeCsvCell(value: unknown) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`
}

function toBusinessCsv(summary: ReturnType<typeof toBusinessSummary>) {
  const rows: string[] = []
  rows.push([
    'section',
    'record_id',
    'name',
    'label',
    'description',
    'qty',
    'unit',
    'value_1',
    'value_2',
    'value_3',
  ].join(','))

  rows.push([
    'project',
    summary.project.id,
    summary.project.name,
    summary.project.lead_status,
    summary.project.description ?? '',
    '',
    '',
    summary.project.quote_value ?? '',
    summary.project.close_probability ?? '',
    summary.totals.project_line_items_net,
  ].map(escapeCsvCell).join(','))

  for (const priceList of summary.customer_price_lists) {
    rows.push([
      'customer_price_list',
      priceList.id,
      priceList.name,
      '',
      priceList.notes ?? '',
      '',
      '',
      priceList.price_adjustment_pct,
      '',
      '',
    ].map(escapeCsvCell).join(','))
  }

  for (const discount of summary.customer_discounts) {
    rows.push([
      'customer_discount',
      discount.id,
      discount.label,
      discount.scope,
      '',
      '',
      '',
      discount.discount_pct,
      '',
      '',
    ].map(escapeCsvCell).join(','))
  }

  for (const item of summary.project_line_items) {
    rows.push([
      'project_line_item',
      item.id,
      item.source_type,
      '',
      item.description,
      item.qty,
      item.unit,
      item.unit_price_net,
      item.tax_rate,
      item.line_net,
    ].map(escapeCsvCell).join(','))
  }

  return rows.join('\n')
}

export async function businessRoutes(app: FastifyInstance) {
  app.get<{ Params: { id: string } }>('/projects/:id/business-summary', async (request, reply) => {
    const parsedParams = ProjectParamsSchema.safeParse(request.params)
    if (!parsedParams.success) {
      return sendBadRequest(reply, parsedParams.error.errors[0].message)
    }

    const project = await loadBusinessProject(parsedParams.data.id)
    if (!project) {
      return sendNotFound(reply, 'Project not found')
    }

    return reply.send(toBusinessSummary(project))
  })

  app.put<{ Params: { id: string } }>('/projects/:id/business-summary', async (request, reply) => {
    const parsedParams = ProjectParamsSchema.safeParse(request.params)
    if (!parsedParams.success) {
      return sendBadRequest(reply, parsedParams.error.errors[0].message)
    }

    const parsedBody = BusinessSummaryBodySchema.safeParse(request.body)
    if (!parsedBody.success) {
      return sendBadRequest(reply, parsedBody.error.errors[0].message)
    }

    const existing = await prisma.project.findUnique({
      where: { id: parsedParams.data.id },
      select: { id: true },
    })
    if (!existing) {
      return sendNotFound(reply, 'Project not found')
    }

    await prisma.$transaction(async (tx) => {
      await tx.project.update({
        where: { id: parsedParams.data.id },
        data: {
          ...(parsedBody.data.lead_status !== undefined ? { lead_status: parsedBody.data.lead_status } : {}),
          ...(parsedBody.data.quote_value !== undefined ? { quote_value: parsedBody.data.quote_value } : {}),
          ...(parsedBody.data.close_probability !== undefined
            ? { close_probability: parsedBody.data.close_probability }
            : {}),
        },
      })

      await tx.customerPriceList.deleteMany({ where: { project_id: parsedParams.data.id } })
      if (parsedBody.data.customer_price_lists.length > 0) {
        await tx.customerPriceList.createMany({
          data: parsedBody.data.customer_price_lists.map((item) => ({
            project_id: parsedParams.data.id,
            name: item.name,
            price_adjustment_pct: item.price_adjustment_pct,
            notes: item.notes ?? null,
          })),
        })
      }

      await tx.customerDiscount.deleteMany({ where: { project_id: parsedParams.data.id } })
      if (parsedBody.data.customer_discounts.length > 0) {
        await tx.customerDiscount.createMany({
          data: parsedBody.data.customer_discounts.map((item) => ({
            project_id: parsedParams.data.id,
            label: item.label,
            discount_pct: item.discount_pct,
            scope: item.scope,
          })),
        })
      }

      await tx.projectLineItem.deleteMany({ where: { project_id: parsedParams.data.id } })
      if (parsedBody.data.project_line_items.length > 0) {
        await tx.projectLineItem.createMany({
          data: parsedBody.data.project_line_items.map((item) => ({
            project_id: parsedParams.data.id,
            source_type: item.source_type,
            description: item.description,
            qty: item.qty,
            unit: item.unit,
            unit_price_net: item.unit_price_net,
            tax_rate: item.tax_rate,
            line_net: toLineNet(item.qty, item.unit_price_net),
          })),
        })
      }
    })

    const project = await loadBusinessProject(parsedParams.data.id)
    if (!project) {
      return sendNotFound(reply, 'Project not found')
    }

    return reply.send(toBusinessSummary(project))
  })

  app.get<{ Params: { id: string } }>('/projects/:id/export/json', async (request, reply) => {
    const parsedParams = ProjectParamsSchema.safeParse(request.params)
    if (!parsedParams.success) {
      return sendBadRequest(reply, parsedParams.error.errors[0].message)
    }

    const project = await loadBusinessProject(parsedParams.data.id)
    if (!project) {
      return sendNotFound(reply, 'Project not found')
    }

    return reply.send({
      exported_at: new Date().toISOString(),
      format: 'json',
      data: toBusinessSummary(project),
    })
  })

  app.get<{ Params: { id: string } }>('/projects/:id/export/csv', async (request, reply) => {
    const parsedParams = ProjectParamsSchema.safeParse(request.params)
    if (!parsedParams.success) {
      return sendBadRequest(reply, parsedParams.error.errors[0].message)
    }

    const project = await loadBusinessProject(parsedParams.data.id)
    if (!project) {
      return sendNotFound(reply, 'Project not found')
    }

    const summary = toBusinessSummary(project)
    reply.header('content-disposition', `attachment; filename="project-${project.id}-business.csv"`)
    reply.type('text/csv; charset=utf-8')
    return reply.send(toBusinessCsv(summary))
  })

  app.post<{ Params: { id: string } }>('/projects/:id/export/webhook', async (request, reply) => {
    const parsedParams = ProjectParamsSchema.safeParse(request.params)
    if (!parsedParams.success) {
      return sendBadRequest(reply, parsedParams.error.errors[0].message)
    }

    const parsedBody = WebhookBodySchema.safeParse(request.body)
    if (!parsedBody.success) {
      return sendBadRequest(reply, parsedBody.error.errors[0].message)
    }

    const project = await loadBusinessProject(parsedParams.data.id)
    if (!project) {
      return sendNotFound(reply, 'Project not found')
    }

    const payload = {
      event: parsedBody.data.event,
      exported_at: new Date().toISOString(),
      data: toBusinessSummary(project),
    }

    try {
      const response = await fetch(parsedBody.data.target_url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        return reply.status(502).send({
          error: 'WEBHOOK_FAILED',
          message: `Webhook responded with status ${response.status}`,
        })
      }

      return reply.send({
        delivered: true,
        event: parsedBody.data.event,
        target_url: parsedBody.data.target_url,
        status: response.status,
      })
    } catch {
      return reply.status(502).send({
        error: 'WEBHOOK_FAILED',
        message: 'Failed to deliver webhook',
      })
    }
  })
}
