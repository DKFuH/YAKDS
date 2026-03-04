import Fastify from 'fastify'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const TENANT_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const TENANT_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    tenantSetting: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  },
}))

vi.mock('../db.js', () => ({ prisma: prismaMock }))

import { localesRoutes } from './locales.js'

function makeApp(tenantId = TENANT_A) {
  const app = Fastify()
  app.addHook('onRequest', async (req) => {
    ;(req as unknown as { tenantId: string }).tenantId = tenantId
  })
  app.register(localesRoutes, { prefix: '/api/v1' })
  return app
}

function makeAppNoTenant() {
  const app = Fastify()
  app.register(localesRoutes, { prefix: '/api/v1' })
  return app
}

describe('localesRoutes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('GET /locales returns 4 entries with planned flags', async () => {
    const app = makeApp()
    const res = await app.inject({ method: 'GET', url: '/api/v1/locales' })
    expect(res.statusCode).toBe(200)
    const body = res.json() as Array<{ code: string; planned: boolean }>
    expect(body).toHaveLength(4)
    expect(body.find((l) => l.code === 'de')?.planned).toBe(false)
    expect(body.find((l) => l.code === 'en')?.planned).toBe(false)
    expect(body.find((l) => l.code === 'fr')?.planned).toBe(true)
    expect(body.find((l) => l.code === 'nl')?.planned).toBe(true)
  })

  it('GET /tenant/locale-settings returns stored locale values for own tenant', async () => {
    prismaMock.tenantSetting.findUnique.mockResolvedValue({
      preferred_locale: 'en',
      fallback_locale: 'de',
    })
    const app = makeApp()
    const res = await app.inject({ method: 'GET', url: '/api/v1/tenant/locale-settings' })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { preferred_locale: string; fallback_locale: string }
    expect(body.preferred_locale).toBe('en')
    expect(body.fallback_locale).toBe('de')
    expect(prismaMock.tenantSetting.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenant_id: TENANT_A } })
    )
  })

  it('PUT /tenant/locale-settings with valid code updates and returns 200', async () => {
    prismaMock.tenantSetting.upsert.mockResolvedValue({
      preferred_locale: 'en',
      fallback_locale: null,
    })
    const app = makeApp()
    const res = await app.inject({
      method: 'PUT',
      url: '/api/v1/tenant/locale-settings',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ preferred_locale: 'en' }),
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { preferred_locale: string }
    expect(body.preferred_locale).toBe('en')
  })

  it('PUT /tenant/locale-settings with invalid code returns 400', async () => {
    const app = makeApp()
    const res = await app.inject({
      method: 'PUT',
      url: '/api/v1/tenant/locale-settings',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ preferred_locale: 'xx' }),
    })
    expect(res.statusCode).toBe(400)
  })

  it('GET /tenant/locale-settings without tenant scope returns 403', async () => {
    const app = makeAppNoTenant()
    const res = await app.inject({ method: 'GET', url: '/api/v1/tenant/locale-settings' })
    expect(res.statusCode).toBe(403)
  })

  it('GET /tenant/locale-settings scopes query to own tenant_id (isolation)', async () => {
    prismaMock.tenantSetting.findUnique.mockResolvedValue({ preferred_locale: 'de', fallback_locale: null })
    const appB = makeApp(TENANT_B)
    const res = await appB.inject({ method: 'GET', url: '/api/v1/tenant/locale-settings' })
    expect(res.statusCode).toBe(200)
    // Must query with TENANT_B's id, not TENANT_A's
    expect(prismaMock.tenantSetting.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenant_id: TENANT_B } })
    )
    expect(prismaMock.tenantSetting.findUnique).not.toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenant_id: TENANT_A } })
    )
  })
})
