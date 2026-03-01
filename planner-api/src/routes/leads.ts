/**
 * leads.ts – Sprint 24 / TASK-24-A01
 * Webplaner Lead-Erstellung + Handover (Promotion) in Profi-Projekt
 */
import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../db.js'
import { sendBadRequest, sendForbidden, sendNotFound } from '../errors.js'

// ─── Schemas ─────────────────────────────────────────────────────

const ContactSchema = z.object({
    name: z.string().min(1).max(120),
    email: z.string().email(),
    phone: z.string().max(40).optional(),
    address: z.string().max(255).optional(),
})

const ConsentSchema = z.object({
    marketing: z.boolean().default(false),
    data_processing: z.boolean(),
    timestamp: z.string().optional(),
})

const SimpleCabinetSchema = z.object({
    id: z.string().min(1),
    type: z.enum(['base', 'wall', 'tall', 'appliance']),
    width_mm: z.number().positive(),
    height_mm: z.number().positive(),
    depth_mm: z.number().positive(),
    label: z.string().optional(),
})

const SimpleRoomSchema = z.object({
    width_mm: z.number().positive(),
    depth_mm: z.number().positive(),
    ceiling_height_mm: z.number().positive().default(2500),
    shape: z.enum(['rectangle', 'l_shape', 'u_shape']).default('rectangle'),
})

const LeadCreateSchema = z.object({
    tenant_id: z.string().uuid().optional(),
    contact: ContactSchema,
    consent: ConsentSchema,
    room: SimpleRoomSchema,
    cabinets: z.array(SimpleCabinetSchema).max(100).default([]),
})

const LeadIdSchema = z.object({ id: z.string().uuid() })

const LeadPromoteSchema = z.object({
    user_id: z.string().uuid(),
    project_name: z.string().min(1).max(255).optional(),
    tenant_id: z.string().uuid().optional(),
    branch_id: z.string().uuid().optional(),
})

const LEAD_RETENTION_DAYS = Number(process.env.LEAD_RETENTION_DAYS ?? 30)

function sanitizeText(value: string): string {
    return value
        .replace(/[<>]/g, '')
        .replace(/[\u0000-\u001F\u007F]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
}

function sanitizeOptionalText(value?: string): string | undefined {
    if (!value) return undefined
    const sanitized = sanitizeText(value)
    return sanitized.length > 0 ? sanitized : undefined
}

function sanitizeContact(contact: z.infer<typeof ContactSchema>) {
    return {
        name: sanitizeText(contact.name),
        email: contact.email.trim().toLowerCase(),
        phone: sanitizeOptionalText(contact.phone),
        address: sanitizeOptionalText(contact.address),
    }
}

function splitLeadName(name: string) {
    const sanitized = sanitizeText(name)
    const parts = sanitized.split(' ').filter(Boolean)
    if (parts.length <= 1) {
        return { first_name: null, last_name: sanitized }
    }
    return {
        first_name: parts.slice(0, -1).join(' '),
        last_name: parts[parts.length - 1] ?? sanitized,
    }
}

function getTenantId(request: unknown): string | null {
    const tenantId = (request as { tenantId?: string | null }).tenantId
    return tenantId ?? null
}

async function cleanupStaleLeads() {
    if (!Number.isFinite(LEAD_RETENTION_DAYS) || LEAD_RETENTION_DAYS <= 0) return
    const cutoff = new Date(Date.now() - LEAD_RETENTION_DAYS * 24 * 60 * 60 * 1000)
    await prisma.lead.deleteMany({
        where: {
            promoted_to_project_id: null,
            status: 'new',
            created_at: { lt: cutoff },
        },
    })
}

// ─── Hilfsfunktion: Raum-Polygon aus einfacher Raumform ──────────

function buildRoomBoundary(room: z.infer<typeof SimpleRoomSchema>) {
    const { width_mm, depth_mm } = room
    // Rechteckiger Raum als Polygon
    const vertices = [
        { x: 0, y: 0 },
        { x: width_mm, y: 0 },
        { x: width_mm, y: depth_mm },
        { x: 0, y: depth_mm },
    ]
    const wall_segments = [
        { id: 'w1', start: vertices[0], end: vertices[1], length_mm: width_mm },
        { id: 'w2', start: vertices[1], end: vertices[2], length_mm: depth_mm },
        { id: 'w3', start: vertices[2], end: vertices[3], length_mm: width_mm },
        { id: 'w4', start: vertices[3], end: vertices[0], length_mm: depth_mm },
    ]
    return { vertices, wall_segments }
}

// ─── Hilfsfunktion: Schränke auf Wand w1 platzieren ─────────────

function buildPlacements(cabinets: z.infer<typeof SimpleCabinetSchema>[]) {
    let offset = 0
    return cabinets.map((cab) => {
        const placement = {
            id: cab.id,
            catalog_item_id: null,
            type: cab.type === 'base' ? 'base' : cab.type === 'wall' ? 'wall' : cab.type === 'tall' ? 'tall' : 'appliance',
            wall_id: 'w1',
            offset_mm: offset,
            width_mm: cab.width_mm,
            height_mm: cab.height_mm,
            depth_mm: cab.depth_mm,
            label: cab.label ?? cab.type,
        }
        offset += cab.width_mm
        return placement
    })
}

// ─── Routen ──────────────────────────────────────────────────────

export async function leadRoutes(app: FastifyInstance) {

    /**
     * POST /leads/create
     * Erstellt einen Webplaner-Lead.
     */
    app.post('/leads/create', async (request, reply) => {
        const tenantId = getTenantId(request)
        if (!tenantId) return sendForbidden(reply, 'Tenant scope is required')

        const parsed = LeadCreateSchema.safeParse(request.body)
        if (!parsed.success) return sendBadRequest(reply, parsed.error.errors[0].message)

        const { contact, consent, room, cabinets, tenant_id } = parsed.data

        if (tenant_id && tenant_id !== tenantId) {
            return sendForbidden(reply, 'Cross-tenant lead create is not allowed')
        }

        // Datenschutz: consent.data_processing muss true sein
        if (!consent.data_processing) {
            return sendBadRequest(reply, 'Einwilligung zur Datenverarbeitung ist erforderlich.')
        }

        await cleanupStaleLeads()

        const sanitizedContact = sanitizeContact(contact)

        const lead = await prisma.$transaction(async (tx) => {
            const existingContact = await tx.contact.findFirst({
                where: {
                    tenant_id: tenantId,
                    email: sanitizedContact.email,
                },
            })

            const contact = existingContact ?? await tx.contact.create({
                data: {
                    tenant_id: tenantId,
                    type: 'end_customer',
                    ...splitLeadName(sanitizedContact.name),
                    email: sanitizedContact.email,
                    phone: sanitizedContact.phone ?? null,
                    address_json: sanitizedContact.address ? { label: sanitizedContact.address } : {},
                    lead_source: 'web_planner',
                },
            })

            return tx.lead.create({
                data: {
                    tenant_id: tenantId,
                    contact_id: contact.id,
                    status: 'new',
                    contact_json: sanitizedContact,
                    consent_json: { ...consent, timestamp: consent.timestamp ?? new Date().toISOString() },
                    room_json: room,
                    cabinets_json: cabinets,
                },
            })
        })

        return reply.status(201).send(lead)
    })

    /**
     * GET /leads
     * Listet Leads auf (tenant-gefiltert).
     */
    app.get('/leads', async (request, reply) => {
        const tenantIdHeader = getTenantId(request)
        if (!tenantIdHeader) return sendForbidden(reply, 'Tenant scope is required')

        const q = z.object({
            tenant_id: z.string().uuid().optional(),
            status: z.enum(['new', 'qualified', 'quoted', 'won', 'lost']).optional(),
            limit: z.coerce.number().int().min(1).max(200).default(50),
            offset: z.coerce.number().int().min(0).default(0),
        }).safeParse(request.query)
        if (!q.success) return sendBadRequest(reply, q.error.errors[0].message)

        if (q.data.tenant_id && q.data.tenant_id !== tenantIdHeader) {
            return sendForbidden(reply, 'Cross-tenant lead query is not allowed')
        }

        await cleanupStaleLeads()

        const tenantId = tenantIdHeader

        const leads = await prisma.lead.findMany({
            where: {
                ...(tenantId ? { tenant_id: tenantId } : {}),
                ...(q.data.status ? { status: q.data.status } : {}),
            },
            orderBy: { created_at: 'desc' },
            take: q.data.limit,
            skip: q.data.offset,
        })

        return reply.send(leads)
    })

    /**
     * GET /leads/:id
     */
    app.get<{ Params: { id: string } }>('/leads/:id', async (request, reply) => {
        const tenantId = getTenantId(request)
        if (!tenantId) return sendForbidden(reply, 'Tenant scope is required')

        const params = LeadIdSchema.safeParse(request.params)
        if (!params.success) return sendBadRequest(reply, params.error.errors[0].message)

        const lead = await prisma.lead.findFirst({ where: { id: params.data.id, tenant_id: tenantId } })
        if (!lead) return sendNotFound(reply, 'Lead not found')

        return reply.send(lead)
    })

    /**
     * POST /leads/:id/promote
     * Konvertiert einen Webplaner-Lead in ein vollwertiges Profi-Projekt.
     * Mapping: Raumgeometrie → Raumpolygon, Schrankliste → Placements, Kontaktdaten → Projektbeschreibung
     */
    app.post<{ Params: { id: string } }>('/leads/:id/promote', async (request, reply) => {
        const tenantId = getTenantId(request)
        if (!tenantId) return sendForbidden(reply, 'Tenant scope is required')

        const params = LeadIdSchema.safeParse(request.params)
        if (!params.success) return sendBadRequest(reply, params.error.errors[0].message)

        const body = LeadPromoteSchema.safeParse(request.body)
        if (!body.success) return sendBadRequest(reply, body.error.errors[0].message)

        const leadCheck = await prisma.lead.findFirst({ where: { id: params.data.id, tenant_id: tenantId } })
        if (!leadCheck) return sendNotFound(reply, 'Lead not found')
        if (leadCheck.promoted_to_project_id) {
            return sendBadRequest(reply, `Lead wurde bereits zu Projekt ${leadCheck.promoted_to_project_id} konvertiert.`)
        }

        const contact = leadCheck.contact_json as { name: string; email: string; phone?: string; address?: string }
        const room = leadCheck.room_json as z.infer<typeof SimpleRoomSchema>
        const cabinets = (leadCheck.cabinets_json ?? []) as z.infer<typeof SimpleCabinetSchema>[]

        const boundary = buildRoomBoundary(room)
        const placements = buildPlacements(cabinets)
        const projectName = sanitizeOptionalText(body.data.project_name) ?? `Lead: ${sanitizeText(contact.name)}`

        // Wrap all mutations in a transaction to prevent race-condition double-promotion.
        // The updateMany with promoted_to_project_id:null acts as an optimistic lock.
        const result = await prisma.$transaction(async (tx) => {
            // Claim the lead atomically – only succeeds if still un-promoted
            const claimed = await tx.lead.updateMany({
                where: { id: params.data.id, tenant_id: tenantId, promoted_to_project_id: null },
                data: { status: 'qualified' },
            })
            if (claimed.count === 0) return null

            const project = await tx.project.create({
                data: {
                    user_id: body.data.user_id,
                    name: projectName,
                    description: `Aus Webplaner-Lead konvertiert (Lead-ID: ${params.data.id}).`,
                    status: 'active',
                    lead_status: 'qualified',
                    tenant_id: tenantId,
                    branch_id: body.data.branch_id ?? null,
                },
            })

            await tx.room.create({
                data: {
                    project_id: project.id,
                    name: 'Raum (Webplaner)',
                    ceiling_height_mm: room.ceiling_height_mm,
                    boundary,
                    placements,
                },
            })

            if (leadCheck.contact_id) {
                await tx.projectContact.upsert({
                    where: {
                        project_id_contact_id: {
                            project_id: project.id,
                            contact_id: leadCheck.contact_id,
                        },
                    },
                    update: { is_primary: true },
                    create: {
                        project_id: project.id,
                        contact_id: leadCheck.contact_id,
                        is_primary: true,
                    },
                })
            }

            await tx.lead.update({
                where: { id: params.data.id },
                data: { promoted_to_project_id: project.id },
            })

            return project
        })

        if (!result) {
            return sendBadRequest(reply, 'Lead wurde bereits konvertiert.')
        }

        return reply.status(201).send({
            lead_id: params.data.id,
            project_id: result.id,
            project_name: result.name,
            room_mapped: true,
            placements_count: placements.length,
        })
    })

    /**
     * POST /leads/promote (alias ohne :id, mit lead_id im Body)
     * Für die Sprint-Anforderung: /leads/promote
     */
    app.post('/leads/promote', async (request, reply) => {
        const tenantId = getTenantId(request)
        if (!tenantId) return sendForbidden(reply, 'Tenant scope is required')

        const parsed = z.object({
            lead_id: z.string().uuid(),
            user_id: z.string().uuid(),
            project_name: z.string().max(255).optional(),
            tenant_id: z.string().uuid().optional(),
            branch_id: z.string().uuid().optional(),
        }).safeParse(request.body)
        if (!parsed.success) return sendBadRequest(reply, parsed.error.errors[0].message)

        // Delegiere an den :id/promote Handler-Logik
        const { lead_id, ...rest } = parsed.data
        const leadCheck = await prisma.lead.findFirst({ where: { id: lead_id, tenant_id: tenantId } })
        if (!leadCheck) return sendNotFound(reply, 'Lead not found')
        if (leadCheck.promoted_to_project_id) return sendBadRequest(reply, `Bereits zu Projekt ${leadCheck.promoted_to_project_id} konvertiert.`)

        const contact = leadCheck.contact_json as { name: string; email: string; phone?: string }
        const room = leadCheck.room_json as z.infer<typeof SimpleRoomSchema>
        const cabinets = (leadCheck.cabinets_json ?? []) as z.infer<typeof SimpleCabinetSchema>[]

        const boundary = buildRoomBoundary(room)
        const placements = buildPlacements(cabinets)
        const projectName = sanitizeOptionalText(rest.project_name) ?? `Lead: ${sanitizeText(contact.name)}`

        const txResult = await prisma.$transaction(async (tx) => {
            const claimed = await tx.lead.updateMany({
                where: { id: lead_id, tenant_id: tenantId, promoted_to_project_id: null },
                data: { status: 'qualified' },
            })
            if (claimed.count === 0) return null

            const project = await tx.project.create({
                data: {
                    user_id: rest.user_id,
                    name: projectName,
                    description: `Aus Webplaner-Lead konvertiert (Lead-ID: ${lead_id}).`,
                    status: 'active',
                    lead_status: 'qualified',
                    tenant_id: tenantId,
                    branch_id: rest.branch_id ?? null,
                },
            })

            await tx.room.create({
                data: { project_id: project.id, name: 'Raum (Webplaner)', ceiling_height_mm: room.ceiling_height_mm, boundary, placements },
            })

            if (leadCheck.contact_id) {
                await tx.projectContact.upsert({
                    where: {
                        project_id_contact_id: {
                            project_id: project.id,
                            contact_id: leadCheck.contact_id,
                        },
                    },
                    update: { is_primary: true },
                    create: {
                        project_id: project.id,
                        contact_id: leadCheck.contact_id,
                        is_primary: true,
                    },
                })
            }

            await tx.lead.update({ where: { id: lead_id }, data: { promoted_to_project_id: project.id } })

            return project
        })

        if (!txResult) return sendBadRequest(reply, 'Lead wurde bereits konvertiert.')

        return reply.status(201).send({ lead_id, project_id: txResult.id, project_name: txResult.name, placements_count: placements.length })
    })
}
