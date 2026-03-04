import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../db.js'
import { sendBadRequest, sendForbidden, sendNotFound } from '../errors.js'

const contactTypeValues = ['end_customer', 'architect', 'contractor'] as const
const contactPartyKindValues = ['company', 'private_person', 'contact_person'] as const
const leadSourceValues = ['web_planner', 'showroom', 'referral', 'other'] as const

const ContactQuerySchema = z.object({
  search: z.string().min(1).max(200).optional(),
  type: z.enum(contactTypeValues).optional(),
  party_kind: z.enum(contactPartyKindValues).optional(),
  contact_role: z.string().min(1).max(200).optional(),
})

const CreateContactSchema = z.object({
  type: z.enum(contactTypeValues).default('end_customer'),
  party_kind: z.enum(contactPartyKindValues).default('private_person'),
  contact_role: z.string().max(200).nullable().optional(),
  company: z.string().max(200).nullable().optional(),
  first_name: z.string().max(120).nullable().optional(),
  last_name: z.string().min(1).max(120),
  email: z.string().email().nullable().optional(),
  phone: z.string().max(40).nullable().optional(),
  address: z.object({
    street: z.string().max(200).nullable().optional(),
    zip: z.string().max(20).nullable().optional(),
    city: z.string().max(120).nullable().optional(),
    country: z.string().max(120).nullable().optional(),
  }).optional(),
  lead_source: z.enum(leadSourceValues).default('other'),
  budget_estimate: z.number().min(0).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
})

const AttachContactParamsSchema = z.object({
  id: z.string().uuid(),
  contactId: z.string().uuid(),
})

function normalizeNullable(value: string | null | undefined): string | null {
  if (value == null) {
    return null
  }
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

function getTenantId(request: { tenantId?: string | null }): string | null {
  return request.tenantId ?? null
}

export async function contactRoutes(app: FastifyInstance) {
  app.get<{
    Querystring: {
      search?: string
      type?: typeof contactTypeValues[number]
      party_kind?: typeof contactPartyKindValues[number]
      contact_role?: string
    }
  }>('/contacts', async (request, reply) => {
    const tenantId = getTenantId(request)
    if (!tenantId) {
      return sendForbidden(reply, 'Tenant scope is required')
    }

    const parsedQuery = ContactQuerySchema.safeParse(request.query)
    if (!parsedQuery.success) {
      return sendBadRequest(reply, parsedQuery.error.errors[0]?.message ?? 'Invalid query')
    }

    const search = parsedQuery.data.search?.trim()
    const contactRole = parsedQuery.data.contact_role?.trim()

    const contacts = await prisma.contact.findMany({
      where: {
        tenant_id: tenantId,
        ...(parsedQuery.data.type ? { type: parsedQuery.data.type } : {}),
        ...(parsedQuery.data.party_kind ? { party_kind: parsedQuery.data.party_kind } : {}),
        ...(contactRole ? { contact_role: { contains: contactRole, mode: 'insensitive' } } : {}),
        ...(search
          ? {
              OR: [
                { first_name: { contains: search, mode: 'insensitive' } },
                { last_name: { contains: search, mode: 'insensitive' } },
                { company: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
                { phone: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: {
        projects: {
          include: {
            project: {
              select: {
                id: true,
                name: true,
                quote_value: true,
                lead_status: true,
                project_status: true,
              },
            },
          },
        },
      },
      orderBy: [
        { last_name: 'asc' },
        { first_name: 'asc' },
      ],
    })

    const payload = contacts.map((contact) => {
      const projectCount = contact.projects.length
      const totalRevenue = contact.projects.reduce((sum, link) => sum + (link.project.quote_value ?? 0), 0)
      const wonCount = contact.projects.filter((link) => link.project.lead_status === 'won').length
      const conversionPct = projectCount > 0 ? Math.round((wonCount / projectCount) * 100) : 0

      return {
        ...contact,
        project_count: projectCount,
        revenue_total: totalRevenue,
        conversion_pct: conversionPct,
        projects: contact.projects.map((link) => ({
          id: link.project.id,
          name: link.project.name,
          quote_value: link.project.quote_value,
          lead_status: link.project.lead_status,
          project_status: link.project.project_status,
          is_primary: link.is_primary,
        })),
      }
    })

    return reply.send(payload)
  })

  app.post('/contacts', async (request, reply) => {
    const tenantId = getTenantId(request)
    if (!tenantId) {
      return sendForbidden(reply, 'Tenant scope is required')
    }

    const parsedBody = CreateContactSchema.safeParse(request.body)
    if (!parsedBody.success) {
      return sendBadRequest(reply, parsedBody.error.errors[0]?.message ?? 'Invalid payload')
    }

    const data = parsedBody.data

    const contact = await prisma.contact.create({
      data: {
        tenant_id: tenantId,
        type: data.type,
        party_kind: data.party_kind,
        contact_role: normalizeNullable(data.contact_role),
        company: normalizeNullable(data.company),
        first_name: normalizeNullable(data.first_name),
        last_name: data.last_name.trim(),
        email: normalizeNullable(data.email)?.toLowerCase() ?? null,
        phone: normalizeNullable(data.phone),
        address_json: data.address ?? {},
        lead_source: data.lead_source,
        budget_estimate: data.budget_estimate ?? null,
        notes: normalizeNullable(data.notes),
      },
    })

    return reply.status(201).send(contact)
  })

  app.post<{ Params: { id: string; contactId: string } }>('/projects/:id/contacts/:contactId', async (request, reply) => {
    const tenantId = getTenantId(request)
    if (!tenantId) {
      return sendForbidden(reply, 'Tenant scope is required')
    }

    const parsedParams = AttachContactParamsSchema.safeParse(request.params)
    if (!parsedParams.success) {
      return sendBadRequest(reply, parsedParams.error.errors[0]?.message ?? 'Invalid route params')
    }

    const [project, contact] = await Promise.all([
      prisma.project.findFirst({
        where: { id: parsedParams.data.id, tenant_id: tenantId },
        select: { id: true },
      }),
      prisma.contact.findFirst({
        where: { id: parsedParams.data.contactId, tenant_id: tenantId },
        select: { id: true },
      }),
    ])

    if (!project) {
      return sendNotFound(reply, 'Project not found in tenant scope')
    }
    if (!contact) {
      return sendNotFound(reply, 'Contact not found in tenant scope')
    }

    const link = await prisma.projectContact.upsert({
      where: {
        project_id_contact_id: {
          project_id: parsedParams.data.id,
          contact_id: parsedParams.data.contactId,
        },
      },
      update: {},
      create: {
        project_id: parsedParams.data.id,
        contact_id: parsedParams.data.contactId,
      },
    })

    return reply.status(201).send(link)
  })
}
