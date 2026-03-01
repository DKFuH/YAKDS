import { FastifyInstance } from 'fastify'
import type { Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '../db.js'
import { sendBadRequest, sendNotFound } from '../errors.js'

const QuoteParamsSchema = z.object({
  id: z.string().uuid(),
})

const QuoteExportParamsSchema = z.object({
  id: z.string().uuid(),
})

const BomLineSchema = z.object({
  type: z.string().min(1),
  description: z.string().min(1),
  qty: z.number().positive(),
  unit: z.string().min(1),
  line_net_after_discounts: z.number(),
  tax_rate: z.number().min(0),
})

const CreateQuoteBodySchema = z.object({
  valid_until: z.string().datetime().optional(),
  free_text: z.string().max(10000).nullable().optional(),
  footer_text: z.string().max(10000).nullable().optional(),
  bom_lines: z.array(BomLineSchema).max(2000).default([]),
  price_summary: z.unknown().optional(),
})

function plusDaysIso(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString()
}

function buildQuoteNumber(prefix: string, version: number): string {
  const year = new Date().getFullYear()
  return `${prefix}-${year}-${String(version).padStart(4, '0')}`
}

function toQuoteItems(lines: z.infer<typeof BomLineSchema>[]) {
  return lines.map((line, index) => {
    const unitPriceNet = line.qty > 0 ? line.line_net_after_discounts / line.qty : 0
    const lineGross = line.line_net_after_discounts * (1 + line.tax_rate)

    return {
      position: index + 1,
      type: line.type,
      description: line.description,
      qty: line.qty,
      unit: line.unit,
      unit_price_net: unitPriceNet,
      line_net: line.line_net_after_discounts,
      tax_rate: line.tax_rate,
      line_gross: lineGross,
      notes: null,
      show_on_quote: true,
    }
  })
}

export async function quoteRoutes(app: FastifyInstance) {
  app.post<{ Params: { id: string } }>('/projects/:id/create-quote', async (request, reply) => {
    const parsedParams = QuoteParamsSchema.safeParse(request.params)
    if (!parsedParams.success) {
      return sendBadRequest(reply, parsedParams.error.errors[0].message)
    }

    const parsedBody = CreateQuoteBodySchema.safeParse(request.body)
    if (!parsedBody.success) {
      return sendBadRequest(reply, parsedBody.error.errors[0].message)
    }

    const projectId = parsedParams.data.id
    const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true } })
    if (!project) {
      return sendNotFound(reply, 'Project not found')
    }

    const latestQuote = await prisma.quote.findFirst({
      where: { project_id: projectId },
      orderBy: { version: 'desc' },
      select: { version: true },
    })

    const settings = await prisma.quoteSettings.findUnique({
      where: { project_id: projectId },
      select: {
        quote_number_prefix: true,
        default_validity_days: true,
        default_free_text: true,
        default_footer_text: true,
      },
    })

    const nextVersion = (latestQuote?.version ?? 0) + 1
    const prefix = settings?.quote_number_prefix ?? 'ANG'
    const quoteNumber = buildQuoteNumber(prefix, nextVersion)
    const validUntil = parsedBody.data.valid_until ?? plusDaysIso(settings?.default_validity_days ?? 30)
    const freeText = parsedBody.data.free_text ?? settings?.default_free_text ?? null
    const footerText = parsedBody.data.footer_text ?? settings?.default_footer_text ?? null

    const quote = await prisma.quote.create({
      data: {
        project_id: projectId,
        version: nextVersion,
        quote_number: quoteNumber,
        valid_until: new Date(validUntil),
        free_text: freeText,
        footer_text: footerText,
        ...(parsedBody.data.price_summary !== undefined
          ? { price_snapshot: parsedBody.data.price_summary as Prisma.InputJsonValue }
          : {}),
        items: {
          create: toQuoteItems(parsedBody.data.bom_lines),
        },
      },
      include: {
        items: {
          orderBy: { position: 'asc' },
        },
      },
    })

    return reply.status(201).send(quote)
  })

  app.get<{ Params: { id: string } }>('/quotes/:id', async (request, reply) => {
    const parsedParams = QuoteParamsSchema.safeParse(request.params)
    if (!parsedParams.success) {
      return sendBadRequest(reply, parsedParams.error.errors[0].message)
    }

    const quote = await prisma.quote.findUnique({
      where: { id: parsedParams.data.id },
      include: {
        items: {
          orderBy: { position: 'asc' },
        },
      },
    })

    if (!quote) {
      return sendNotFound(reply, 'Quote not found')
    }

    return reply.send(quote)
  })

  app.post<{ Params: { id: string } }>('/quotes/:id/export-pdf', async (request, reply) => {
    const parsedParams = QuoteExportParamsSchema.safeParse(request.params)
    if (!parsedParams.success) {
      return sendBadRequest(reply, parsedParams.error.errors[0].message)
    }

    const quote = await prisma.quote.findUnique({
      where: { id: parsedParams.data.id },
      select: {
        id: true,
        project_id: true,
        version: true,
      },
    })

    if (!quote) {
      return sendNotFound(reply, 'Quote not found')
    }

    const pdfUrl = `/api/v1/quotes/${quote.id}/pdf/quote-v${quote.version}.pdf`
    return reply.send({ pdf_url: pdfUrl })
  })
}
