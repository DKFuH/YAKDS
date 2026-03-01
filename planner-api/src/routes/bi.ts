/**
 * bi.ts – Sprint 23 / TASK-23-A01
 * BI-Endpunkte: /bi/summary, /bi/quotes, /bi/products
 * Multi-Tenant-sicher über tenantId aus Request.
 */
import { FastifyInstance } from 'fastify'
import type { FastifyReply } from 'fastify'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { prisma } from '../db.js'
import { sendBadRequest, sendForbidden, sendNotFound } from '../errors.js'

const DateRangeSchema = z.object({
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
    tenant_id: z.string().uuid().optional(),
})

export async function biRoutes(app: FastifyInstance) {

    function getTenantId(request: unknown): string | null {
        const tenantId = (request as { tenantId?: string | null }).tenantId
        return tenantId ?? null
    }

    function enforceTenantScope(request: unknown, reply: FastifyReply, queryTenantId?: string): string | FastifyReply {
        const tenantId = getTenantId(request)
        if (!tenantId) return sendForbidden(reply, 'Tenant scope is required')
        if (queryTenantId && queryTenantId !== tenantId) return sendForbidden(reply, 'Cross-tenant query is not allowed')
        return tenantId
    }

    /**
     * GET /bi/summary
     * KPI-Überblick: Angebote, Wert, Conversion, Zeitraum
     */
    app.get('/bi/summary', async (request, reply) => {
        const q = DateRangeSchema.safeParse(request.query)
        if (!q.success) return sendBadRequest(reply, q.error.errors[0].message)

        const tenantScoped = enforceTenantScope(request, reply, q.data.tenant_id)
        if (typeof tenantScoped !== 'string') return tenantScoped

        const tenantId = tenantScoped
        const { from, to } = q.data

        const dateFilter = {
            ...(from ? { gte: from } : {}),
            ...(to ? { lte: to } : {}),
        }

        // Projekte im Zeitraum
        const projects = await prisma.project.findMany({
            where: {
                ...(tenantId ? { tenant_id: tenantId } : {}),
                ...(from || to ? { created_at: dateFilter } : {}),
            },
            select: {
                id: true,
                lead_status: true,
                quote_value: true,
                quotes: {
                    select: { id: true, status: true, price_snapshot: true, created_at: true },
                },
            },
        })

        const totalProjects = projects.length
        const wonProjects = projects.filter((p) => p.lead_status === 'won').length
        const lostProjects = projects.filter((p) => p.lead_status === 'lost').length
        const quotedProjects = projects.filter((p) => p.lead_status === 'quoted').length

        const totalQuotes = projects.flatMap((p) => p.quotes).length
        const sentQuotes = projects.flatMap((p) => p.quotes).filter((q) => q.status === 'sent' || q.status === 'accepted').length

        const totalQuoteValue = projects.reduce((sum, p) => sum + (p.quote_value ?? 0), 0)
        const avgQuoteValue = totalProjects > 0 ? totalQuoteValue / totalProjects : 0

        return reply.send({
            period: { from: from ?? null, to: to ?? null },
            tenant_id: tenantId,
            projects: {
                total: totalProjects,
                won: wonProjects,
                lost: lostProjects,
                quoted: quotedProjects,
                conversion_rate: totalProjects > 0 ? Math.round((wonProjects / totalProjects) * 100) : 0,
            },
            quotes: {
                total: totalQuotes,
                sent: sentQuotes,
            },
            value: {
                total_net: Math.round(totalQuoteValue * 100) / 100,
                avg_net: Math.round(avgQuoteValue * 100) / 100,
            },
        })
    })

    /**
     * GET /bi/quotes
     * Angebotsliste mit Status und Wert für BI-Auswertung.
     */
    app.get('/bi/quotes', async (request, reply) => {
        const q = DateRangeSchema.safeParse(request.query)
        if (!q.success) return sendBadRequest(reply, q.error.errors[0].message)

        const tenantScoped = enforceTenantScope(request, reply, q.data.tenant_id)
        if (typeof tenantScoped !== 'string') return tenantScoped

        const tenantId = tenantScoped
        const { from, to } = q.data

        const quotes = await prisma.quote.findMany({
            where: {
                project: {
                    ...(tenantId ? { tenant_id: tenantId } : {}),
                },
                ...(from || to ? { created_at: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
            },
            select: {
                id: true,
                quote_number: true,
                status: true,
                valid_until: true,
                created_at: true,
                project: {
                    select: { id: true, name: true, lead_status: true, tenant_id: true },
                },
                items: {
                    select: { line_net: true, line_gross: true },
                },
            },
            orderBy: { created_at: 'desc' },
            take: 1000,
        })

        const result = quotes.map((q) => ({
            quote_id: q.id,
            quote_number: q.quote_number,
            status: q.status,
            valid_until: q.valid_until,
            created_at: q.created_at,
            project_id: q.project.id,
            project_name: q.project.name,
            lead_status: q.project.lead_status,
            tenant_id: q.project.tenant_id,
            total_net: q.items.reduce((sum, i) => sum + i.line_net, 0),
            total_gross: q.items.reduce((sum, i) => sum + i.line_gross, 0),
        }))

        return reply.send({ count: result.length, quotes: result })
    })

    /**
     * GET /bi/products
     * Top-Warengruppen nach Umsatz (über QuoteItems).
     */
    app.get('/bi/products', async (request, reply) => {
        const q = DateRangeSchema.safeParse(request.query)
        if (!q.success) return sendBadRequest(reply, q.error.errors[0].message)

        const tenantScoped = enforceTenantScope(request, reply, q.data.tenant_id)
        if (typeof tenantScoped !== 'string') return tenantScoped

        const tenantId = tenantScoped
        const { from, to } = q.data

        const items = await prisma.quoteItem.findMany({
            where: {
                quote: {
                    project: {
                        ...(tenantId ? { tenant_id: tenantId } : {}),
                    },
                    ...(from || to ? { created_at: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
                },
            },
            select: {
                type: true,
                description: true,
                qty: true,
                line_net: true,
            },
        })

        // Aggregiere nach Typ
        const byType = new Map<string, { revenue_net: number; count: number }>()
        for (const item of items) {
            const key = item.type || 'other'
            const existing = byType.get(key) ?? { revenue_net: 0, count: 0 }
            existing.revenue_net += item.line_net
            existing.count += 1
            byType.set(key, existing)
        }

        const topProducts = Array.from(byType.entries())
            .map(([type, data]) => ({ type, ...data, revenue_net: Math.round(data.revenue_net * 100) / 100 }))
            .sort((a, b) => b.revenue_net - a.revenue_net)

        return reply.send({ tenant_id: tenantId, total_items: items.length, by_type: topProducts })
    })

    // ── Tenant / Branch CRUD (Verwaltung) ────────────────────────

    /** GET /tenants – return only the requesting tenant's own record */
    app.get('/tenants', async (request, reply) => {
        const tenantId = getTenantId(request)
        if (!tenantId) return sendForbidden(reply, 'Tenant scope is required')

        const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId },
            include: { _count: { select: { branches: true, users: true, projects: true } } },
        })
        if (!tenant) return sendNotFound(reply, 'Tenant not found')
        return reply.send([tenant])
    })

    /** POST /tenants – only permitted when no tenant scope is set (super-admin path) */
    app.post('/tenants', async (request, reply) => {
        if (getTenantId(request)) return sendForbidden(reply, 'Cannot create a tenant within an existing tenant scope')
        const parsed = z.object({ name: z.string().min(1).max(120) }).safeParse(request.body)
        if (!parsed.success) return sendBadRequest(reply, parsed.error.errors[0].message)
        const tenant = await prisma.tenant.create({ data: parsed.data })
        return reply.status(201).send(tenant)
    })

    /** GET /tenants/:id/branches */
    app.get<{ Params: { id: string } }>('/tenants/:id/branches', async (request, reply) => {
        const params = z.object({ id: z.string().uuid() }).safeParse(request.params)
        if (!params.success) return sendBadRequest(reply, params.error.errors[0].message)
        const branches = await prisma.branch.findMany({ where: { tenant_id: params.data.id } })
        return reply.send(branches)
    })

    /** POST /tenants/:id/branches */
    app.post<{ Params: { id: string } }>('/tenants/:id/branches', async (request, reply) => {
        const params = z.object({ id: z.string().uuid() }).safeParse(request.params)
        if (!params.success) return sendBadRequest(reply, params.error.errors[0].message)
        const body = z.object({ name: z.string().min(1).max(120), location_json: z.record(z.unknown()).optional() }).safeParse(request.body)
        if (!body.success) return sendBadRequest(reply, body.error.errors[0].message)
        const branch = await prisma.branch.create({
            data: {
                name: body.data.name,
                tenant_id: params.data.id,
                ...(body.data.location_json !== undefined ? { location_json: body.data.location_json as Prisma.InputJsonValue } : {}),
            },
        })
        return reply.status(201).send(branch)
    })
}
