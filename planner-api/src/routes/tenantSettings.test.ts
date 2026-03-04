import Fastify from 'fastify'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const TENANT_ID = '00000000-0000-0000-0000-000000000001'

const { prismaMock } = vi.hoisted(() => {
  const mock = {
    tenantSetting: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    quote: { findUnique: vi.fn() },
    lead: { findFirst: vi.fn() },
  }
  return { prismaMock: mock }
})

const { registerProjectDocumentMock } = vi.hoisted(() => ({
  registerProjectDocumentMock: vi.fn(),
}))

vi.mock('../db.js', () => ({ prisma: prismaMock }))
vi.mock('../services/documentRegistry.js', () => ({
  registerProjectDocument: registerProjectDocumentMock,
}))

import { tenantSettingsRoutes } from './tenantSettings.js'
import { quoteRoutes } from './quotes.js'
import { buildQuotePdf } from '../services/pdfGenerator.js'

function makeApp() {
  const app = Fastify()
  app.addHook('onRequest', async (req) => {
    ;(req as unknown as { tenantId: string }).tenantId = TENANT_ID
  })
  app.register(tenantSettingsRoutes, { prefix: '/api/v1' })
  return app
}

function makeQuoteApp() {
  const app = Fastify()
  app.register(quoteRoutes, { prefix: '/api/v1' })
  return app
}

describe('tenantSettingsRoutes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    registerProjectDocumentMock.mockResolvedValue({ id: 'doc-1' })
  })

  // Test 1: PUT upsert company_name → 200
  it('PUT /tenant/settings upserts company_name and returns 200', async () => {
    const stored = {
      id: 'ts-1',
      tenant_id: TENANT_ID,
      company_name: 'Muster GmbH',
      company_street: null,
      company_zip: null,
      company_city: null,
      company_phone: null,
      company_email: null,
      company_web: null,
      iban: null,
      bic: null,
      bank_name: null,
      vat_id: null,
      tax_number: null,
      quote_footer: null,
      logo_url: null,
      currency_code: 'EUR',
      email_from_name: null,
      email_from_address: null,
      created_at: new Date(),
      updated_at: new Date(),
    }
    prismaMock.tenantSetting.upsert.mockResolvedValue(stored)

    const app = makeApp()
    const res = await app.inject({
      method: 'PUT',
      url: '/api/v1/tenant/settings',
      payload: { company_name: 'Muster GmbH' },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().company_name).toBe('Muster GmbH')
    expect(prismaMock.tenantSetting.upsert).toHaveBeenCalledTimes(1)
    await app.close()
  })

  it('PUT /tenant/settings persists navigation settings payload', async () => {
    prismaMock.tenantSetting.upsert.mockResolvedValue({
      id: 'ts-2',
      tenant_id: TENANT_ID,
      navigation_profile: 'trackpad',
      invert_y_axis: true,
      middle_mouse_pan: false,
      touchpad_mode: 'trackpad',
      zoom_direction: 'inverted',
      created_at: new Date(),
      updated_at: new Date(),
    })

    const app = makeApp()
    const res = await app.inject({
      method: 'PUT',
      url: '/api/v1/tenant/settings',
      payload: {
        navigation_profile: 'trackpad',
        invert_y_axis: true,
        middle_mouse_pan: false,
        touchpad_mode: 'trackpad',
        zoom_direction: 'inverted',
      },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({
      navigation_profile: 'trackpad',
      invert_y_axis: true,
      middle_mouse_pan: false,
      touchpad_mode: 'trackpad',
      zoom_direction: 'inverted',
    })
    await app.close()
  })

  // Test 2: PUT with invalid email → 400
  it('PUT /tenant/settings returns 400 for invalid email', async () => {
    const app = makeApp()
    const res = await app.inject({
      method: 'PUT',
      url: '/api/v1/tenant/settings',
      payload: { company_email: 'not-an-email' },
    })

    expect(res.statusCode).toBe(400)
    await app.close()
  })

  it('PUT /tenant/settings rejects invalid navigation profile', async () => {
    const app = makeApp()
    const res = await app.inject({
      method: 'PUT',
      url: '/api/v1/tenant/settings',
      payload: { navigation_profile: 'gaming' },
    })

    expect(res.statusCode).toBe(400)
    await app.close()
  })

  // Test 3: GET returns stored data
  it('GET /tenant/settings returns stored settings', async () => {
    prismaMock.tenantSetting.findUnique.mockResolvedValue({
      id: 'ts-1',
      tenant_id: TENANT_ID,
      company_name: 'Muster GmbH',
      vat_id: 'DE123456789',
      iban: 'DE89370400440532013000',
      created_at: new Date(),
      updated_at: new Date(),
    })

    const app = makeApp()
    const res = await app.inject({ method: 'GET', url: '/api/v1/tenant/settings' })

    expect(res.statusCode).toBe(200)
    expect(res.json().company_name).toBe('Muster GmbH')
    expect(res.json().vat_id).toBe('DE123456789')
    await app.close()
  })

  // Test 4: export-pdf with TenantSetting → PDF contains company_name
  it('POST /quotes/:id/export-pdf with TenantSetting includes company_name in PDF', async () => {
    prismaMock.quote.findUnique.mockResolvedValue({
      id: '44444444-4444-4444-4444-444444444444',
      version: 1,
      quote_number: 'ANG-2026-0001',
      valid_until: new Date('2026-03-31T00:00:00.000Z'),
      free_text: null,
      footer_text: null,
      price_snapshot: null,
      items: [],
      project: {
        id: '11111111-1111-1111-1111-111111111111',
        tenant_id: TENANT_ID,
      },
    })
    prismaMock.tenantSetting.findUnique.mockResolvedValue({
      company_name: 'Muster Küchen GmbH',
      company_street: 'Musterstraße 1',
      company_zip: '12345',
      company_city: 'Musterstadt',
      company_phone: null,
      company_email: null,
      company_web: null,
      vat_id: 'DE123456789',
      tax_number: null,
      iban: 'DE89370400440532013000',
      bic: 'COBADEFFXXX',
      bank_name: 'Commerzbank',
      quote_footer: null,
    })
    prismaMock.lead.findFirst.mockResolvedValue(null)

    const app = makeQuoteApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/quotes/44444444-4444-4444-4444-444444444444/export-pdf',
    })

    expect(res.statusCode).toBe(200)
    expect(res.body).toContain('Muster')
    await app.close()
  })

  // Test 5: export-pdf without TenantSetting → no crash
  it('POST /quotes/:id/export-pdf without TenantSetting does not crash', async () => {
    prismaMock.quote.findUnique.mockResolvedValue({
      id: '44444444-4444-4444-4444-444444444444',
      version: 1,
      quote_number: 'ANG-2026-0002',
      valid_until: new Date('2026-03-31T00:00:00.000Z'),
      free_text: null,
      footer_text: null,
      price_snapshot: null,
      items: [],
      project: {
        id: '11111111-1111-1111-1111-111111111111',
        tenant_id: TENANT_ID,
      },
    })
    prismaMock.tenantSetting.findUnique.mockResolvedValue(null)
    prismaMock.lead.findFirst.mockResolvedValue(null)

    const app = makeQuoteApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/quotes/44444444-4444-4444-4444-444444444444/export-pdf',
    })

    expect(res.statusCode).toBe(200)
    expect(res.body.startsWith('%PDF-1.4')).toBe(true)
    await app.close()
  })

  // Test 6: export-pdf with Lead → recipient block set
  it('POST /quotes/:id/export-pdf with Lead sets recipient block', async () => {
    prismaMock.quote.findUnique.mockResolvedValue({
      id: '44444444-4444-4444-4444-444444444444',
      version: 1,
      quote_number: 'ANG-2026-0003',
      valid_until: new Date('2026-03-31T00:00:00.000Z'),
      free_text: null,
      footer_text: null,
      price_snapshot: null,
      items: [],
      project: {
        id: '11111111-1111-1111-1111-111111111111',
        tenant_id: TENANT_ID,
      },
    })
    prismaMock.tenantSetting.findUnique.mockResolvedValue(null)
    prismaMock.lead.findFirst.mockResolvedValue({
      contact_json: { name: 'Max Mustermann', email: 'max@example.de' },
    })

    const app = makeQuoteApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/quotes/44444444-4444-4444-4444-444444444444/export-pdf',
    })

    expect(res.statusCode).toBe(200)
    expect(res.body).toContain('Max Mustermann')
    await app.close()
  })
})

// Test 7 & 8: buildQuotePdf unit tests for sender/no-sender
describe('buildQuotePdf with sender/recipient', () => {
  // Test 7: sender set → company_name in output
  it('includes company_name in PDF when sender is provided', () => {
    const pdf = buildQuotePdf({
      quote_number: 'ANG-2026-0010',
      version: 1,
      valid_until: '2026-12-31T00:00:00.000Z',
      free_text: null,
      footer_text: null,
      items: [],
      sender: {
        company_name: 'Test Küchen GmbH',
        iban: 'DE12345678901234567890',
        bic: 'TESTDEBBXXX',
        bank_name: 'Testbank',
        vat_id: 'DE987654321',
      },
    })

    const content = pdf.toString('latin1')
    expect(content.startsWith('%PDF-1.4')).toBe(true)
    expect(content).toContain('Test')
  })

  // Test 8: without sender → no crash, valid PDF
  it('creates valid PDF without sender or recipient', () => {
    const pdf = buildQuotePdf({
      quote_number: 'ANG-2026-0011',
      version: 1,
      valid_until: '2026-12-31T00:00:00.000Z',
      free_text: null,
      footer_text: null,
      items: [],
    })

    const content = pdf.toString('latin1')
    expect(content.startsWith('%PDF-1.4')).toBe(true)
    expect(content).toContain('ANG-2026-0011')
  })
})
