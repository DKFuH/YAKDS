import Fastify from 'fastify'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const TENANT_ID = '00000000-0000-0000-0000-000000000001'
const CONTACT_ID = '00000000-0000-0000-0000-000000000002'
const PROJECT_ID = '00000000-0000-0000-0000-000000000003'

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    contact: {
      findMany: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
    },
    project: {
      findFirst: vi.fn(),
    },
    projectContact: {
      upsert: vi.fn(),
    },
  },
}))

vi.mock('../db.js', () => ({ prisma: prismaMock }))

import { tenantMiddleware } from '../tenantMiddleware.js'
import { contactRoutes } from './contacts.js'

function makeApp() {
  const app = Fastify()
  app.register(async (instance) => {
    await tenantMiddleware(instance)
    await contactRoutes(instance)
  })
  return app
}

describe('contactRoutes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('lists contacts with project KPIs', async () => {
    prismaMock.contact.findMany.mockResolvedValue([
      {
        id: CONTACT_ID,
        tenant_id: TENANT_ID,
        type: 'end_customer',
        company: null,
        first_name: 'Max',
        last_name: 'Mustermann',
        email: 'max@example.de',
        phone: null,
        address_json: {},
        lead_source: 'web_planner',
        budget_estimate: null,
        notes: null,
        created_at: new Date('2026-03-01T00:00:00.000Z'),
        updated_at: new Date('2026-03-01T00:00:00.000Z'),
        projects: [
          {
            is_primary: true,
            project: {
              id: PROJECT_ID,
              name: 'Projekt Nord',
              quote_value: 12000,
              lead_status: 'won',
              project_status: 'contract',
            },
          },
        ],
      },
    ])

    const app = makeApp()
    const response = await app.inject({
      method: 'GET',
      url: '/contacts?search=max',
      headers: { 'x-tenant-id': TENANT_ID },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: CONTACT_ID,
        project_count: 1,
        revenue_total: 12000,
        conversion_pct: 100,
      }),
    ]))

    await app.close()
  })

  it('creates a contact in tenant scope', async () => {
    prismaMock.contact.create.mockResolvedValue({
      id: CONTACT_ID,
      tenant_id: TENANT_ID,
      type: 'end_customer',
      company: null,
      first_name: 'Max',
      last_name: 'Mustermann',
      email: 'max@example.de',
      phone: null,
      address_json: {},
      lead_source: 'showroom',
      budget_estimate: 15000,
      notes: null,
      created_at: new Date('2026-03-01T00:00:00.000Z'),
      updated_at: new Date('2026-03-01T00:00:00.000Z'),
    })

    const app = makeApp()
    const response = await app.inject({
      method: 'POST',
      url: '/contacts',
      headers: { 'x-tenant-id': TENANT_ID },
      payload: {
        first_name: 'Max',
        last_name: 'Mustermann',
        email: 'Max@Example.de',
        lead_source: 'showroom',
        budget_estimate: 15000,
      },
    })

    expect(response.statusCode).toBe(201)
    expect(prismaMock.contact.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenant_id: TENANT_ID,
        email: 'max@example.de',
      }),
    })

    await app.close()
  })

  it('attaches a contact to a project in the same tenant', async () => {
    prismaMock.project.findFirst.mockResolvedValue({ id: PROJECT_ID })
    prismaMock.contact.findFirst.mockResolvedValue({ id: CONTACT_ID })
    prismaMock.projectContact.upsert.mockResolvedValue({
      project_id: PROJECT_ID,
      contact_id: CONTACT_ID,
      is_primary: false,
    })

    const app = makeApp()
    const response = await app.inject({
      method: 'POST',
      url: `/projects/${PROJECT_ID}/contacts/${CONTACT_ID}`,
      headers: { 'x-tenant-id': TENANT_ID },
    })

    expect(response.statusCode).toBe(201)
    expect(prismaMock.projectContact.upsert).toHaveBeenCalledWith({
      where: {
        project_id_contact_id: {
          project_id: PROJECT_ID,
          contact_id: CONTACT_ID,
        },
      },
      update: {},
      create: {
        project_id: PROJECT_ID,
        contact_id: CONTACT_ID,
      },
    })

    await app.close()
  })
})
