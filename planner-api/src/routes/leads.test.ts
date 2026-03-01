import Fastify from 'fastify'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const TENANT_ID = '00000000-0000-0000-0000-000000000001'
const LEAD_ID = '00000000-0000-0000-0000-000000000002'
const USER_ID = '00000000-0000-0000-0000-000000000003'
const PROJECT_ID = '00000000-0000-0000-0000-000000000004'

const { prismaMock } = vi.hoisted(() => {
  const mock = {
    lead: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    project: { create: vi.fn() },
    room: { create: vi.fn() },
    $transaction: vi.fn(),
  }
  mock.$transaction.mockImplementation(async (cb: (tx: typeof mock) => Promise<unknown>) => cb(mock))
  return { prismaMock: mock }
})

vi.mock('../db.js', () => ({ prisma: prismaMock }))

import { tenantMiddleware } from '../tenantMiddleware.js'
import { leadRoutes } from './leads.js'

function makeApp() {
  const app = Fastify()
  app.register(async (instance) => {
    await tenantMiddleware(instance)
    await leadRoutes(instance)
  })
  return app
}

function makeLeadPayload() {
  return {
    contact: { name: 'Max Mustermann', email: 'max@example.de' },
    consent: { marketing: false, data_processing: true },
    room: { width_mm: 3000, depth_mm: 2500, ceiling_height_mm: 2500 },
    cabinets: [],
  }
}

function makeStoredLead() {
  return {
    id: LEAD_ID,
    tenant_id: TENANT_ID,
    status: 'new',
    contact_json: { name: 'Max Mustermann', email: 'max@example.de' },
    consent_json: { marketing: false, data_processing: true, timestamp: '2026-01-01T00:00:00.000Z' },
    room_json: { width_mm: 3000, depth_mm: 2500, ceiling_height_mm: 2500, shape: 'rectangle' },
    cabinets_json: [],
    created_at: new Date().toISOString(),
    promoted_to_project_id: null,
  }
}

describe('leadRoutes', () => {
  beforeEach(() => vi.clearAllMocks())

  it('POST /leads/create returns 403 without tenant header', async () => {
    const app = makeApp()
    const res = await app.inject({
      method: 'POST',
      url: '/leads/create',
      payload: makeLeadPayload(),
    })
    expect(res.statusCode).toBe(403)
    await app.close()
  })

  it('POST /leads/create returns 400 when data_processing consent is false', async () => {
    prismaMock.lead.deleteMany.mockResolvedValue({ count: 0 })

    const app = makeApp()
    const res = await app.inject({
      method: 'POST',
      url: '/leads/create',
      headers: { 'x-tenant-id': TENANT_ID },
      payload: { ...makeLeadPayload(), consent: { marketing: false, data_processing: false } },
    })

    expect(res.statusCode).toBe(400)
    await app.close()
  })

  it('POST /leads/create creates a lead and returns 201', async () => {
    prismaMock.lead.deleteMany.mockResolvedValue({ count: 0 })
    prismaMock.lead.create.mockResolvedValue(makeStoredLead())

    const app = makeApp()
    const res = await app.inject({
      method: 'POST',
      url: '/leads/create',
      headers: { 'x-tenant-id': TENANT_ID },
      payload: makeLeadPayload(),
    })

    expect(res.statusCode).toBe(201)
    expect(res.json().id).toBe(LEAD_ID)
    await app.close()
  })

  it('GET /leads returns lead list for tenant', async () => {
    prismaMock.lead.deleteMany.mockResolvedValue({ count: 0 })
    prismaMock.lead.findMany.mockResolvedValue([makeStoredLead()])

    const app = makeApp()
    const res = await app.inject({
      method: 'GET',
      url: '/leads',
      headers: { 'x-tenant-id': TENANT_ID },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toHaveLength(1)
    await app.close()
  })

  it('GET /leads returns 403 without tenant header', async () => {
    const app = makeApp()
    const res = await app.inject({ method: 'GET', url: '/leads' })
    expect(res.statusCode).toBe(403)
    await app.close()
  })

  it('POST /leads/promote promotes a lead to a project', async () => {
    prismaMock.lead.findFirst.mockResolvedValue(makeStoredLead())
    // updateMany claims the lead (atomic lock step inside transaction)
    prismaMock.lead.updateMany.mockResolvedValue({ count: 1 })
    prismaMock.project.create.mockResolvedValue({
      id: PROJECT_ID,
      name: 'Lead: Max Mustermann',
      user_id: USER_ID,
      tenant_id: TENANT_ID,
      status: 'active',
      lead_status: 'qualified',
    })
    prismaMock.room.create.mockResolvedValue({ id: 'room-1' })
    prismaMock.lead.update.mockResolvedValue({ id: LEAD_ID, status: 'qualified', promoted_to_project_id: PROJECT_ID })

    const app = makeApp()
    const res = await app.inject({
      method: 'POST',
      url: '/leads/promote',
      headers: { 'x-tenant-id': TENANT_ID },
      payload: { lead_id: LEAD_ID, user_id: USER_ID },
    })

    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.lead_id).toBe(LEAD_ID)
    expect(body.project_id).toBe(PROJECT_ID)
    await app.close()
  })
})
