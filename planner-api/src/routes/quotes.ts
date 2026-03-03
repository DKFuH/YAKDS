import { FastifyInstance } from 'fastify'
import type { Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '../db.js'
import { sendBadRequest, sendNotFound, sendServerError } from '../errors.js'
import { registerProjectDocument } from '../services/documentRegistry.js'
import { queueNotification } from '../services/notificationService.js'
import { buildQuotePdf, type PdfSender, type PdfRecipient } from '../services/pdfGenerator.js'

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

    const settings = await prisma.quoteSettings.findUnique({
      where: { project_id: projectId },
      select: {
        quote_number_prefix: true,
        default_validity_days: true,
        default_free_text: true,
        default_footer_text: true,
      },
    })

    const prefix = settings?.quote_number_prefix ?? 'ANG'
    const validUntil = parsedBody.data.valid_until ?? plusDaysIso(settings?.default_validity_days ?? 30)
    const freeText = parsedBody.data.free_text ?? settings?.default_free_text ?? null
    const footerText = parsedBody.data.footer_text ?? settings?.default_footer_text ?? null

    // Wrap version-number allocation and quote creation in a transaction to
    // prevent concurrent requests from producing duplicate quote numbers.
    const quote = await prisma.$transaction(async (tx) => {
      const latestQuote = await tx.quote.findFirst({
        where: { project_id: projectId },
        orderBy: { version: 'desc' },
        select: { version: true },
      })

      const nextVersion = (latestQuote?.version ?? 0) + 1
      const quoteNumber = buildQuoteNumber(prefix, nextVersion)

      return tx.quote.create({
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
    })

    const projectWithTenant = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, name: true, tenant_id: true },
    })

    if (projectWithTenant?.tenant_id) {
      await queueNotification({
        tenantId: projectWithTenant.tenant_id,
        eventType: 'quote_created',
        entityType: 'quote',
        entityId: quote.id,
        recipientEmail: `alerts+${projectWithTenant.tenant_id}@yakds.local`,
        subject: `Neues Angebot: ${quote.quote_number}`,
        message: `Für Projekt ${projectWithTenant.name} wurde das Angebot ${quote.quote_number} erstellt.`,
        metadata: {
          project_id: projectWithTenant.id,
          quote_number: quote.quote_number,
          version: quote.version,
        },
      })
    }

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
        project: {
          select: {
            id: true,
            tenant_id: true,
          },
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
      include: {
        items: {
          orderBy: { position: 'asc' },
        },
        project: {
          select: {
            id: true,
            tenant_id: true,
          },
        },
      },
    })

    if (!quote) {
      return sendNotFound(reply, 'Quote not found')
    }

    const settings = await prisma.tenantSetting.findUnique({
      where: { tenant_id: quote.project.tenant_id ?? '' },
    })

    const sender: PdfSender | undefined = settings?.company_name
      ? {
          company_name: settings.company_name,
          street: settings.company_street ?? undefined,
          zip: settings.company_zip ?? undefined,
          city: settings.company_city ?? undefined,
          phone: settings.company_phone ?? undefined,
          email: settings.company_email ?? undefined,
          web: settings.company_web ?? undefined,
          vat_id: settings.vat_id ?? undefined,
          tax_number: settings.tax_number ?? undefined,
          iban: settings.iban ?? undefined,
          bic: settings.bic ?? undefined,
          bank_name: settings.bank_name ?? undefined,
        }
      : undefined

    const lead = await prisma.lead.findFirst({
      where: { promoted_to_project_id: quote.project.id },
      select: { contact_json: true },
    })

    let recipient: PdfRecipient | undefined
    if (lead) {
      const contactJson = lead.contact_json as { name?: string; email?: string; street?: string; zip?: string; city?: string } | null
      if (contactJson?.name) {
        recipient = {
          name: contactJson.name,
          email: contactJson.email ?? undefined,
          street: contactJson.street ?? undefined,
          zip: contactJson.zip ?? undefined,
          city: contactJson.city ?? undefined,
        }
      }
    }

    const pdf = buildQuotePdf({
      quote_number: quote.quote_number,
      version: quote.version,
      valid_until: quote.valid_until,
      free_text: quote.free_text,
      footer_text: settings?.quote_footer ?? quote.footer_text ?? null,
      items: quote.items,
      price_snapshot: (quote.price_snapshot as { subtotal_net?: number; vat_amount?: number; total_gross?: number } | null | undefined),
      sender,
      recipient,
    })
    const safeQuoteNumber = quote.quote_number.toLowerCase().replace(/[^a-z0-9-]+/g, '-')
    const filename = `${safeQuoteNumber || `quote-v${quote.version}`}.pdf`

    if (!quote.project.tenant_id) {
      return sendServerError(reply, 'Quote project is missing tenant scope')
    }

    const document = await registerProjectDocument({
      projectId: quote.project.id,
      tenantId: quote.project.tenant_id,
      filename,
      mimeType: 'application/pdf',
      uploadedBy: 'system:quote-export',
      type: 'quote_pdf',
      tags: ['quote', `quote:${quote.quote_number}`],
      sourceKind: 'quote_export',
      sourceId: quote.id,
      buffer: pdf,
    })

    reply.header('content-disposition', `attachment; filename="${filename}"`)
    reply.header('x-document-id', document.id)
    reply.type('application/pdf')
    return reply.send(pdf)
  })
}
