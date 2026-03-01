import Fastify from 'fastify'
import { describe, expect, it } from 'vitest'
import { tenantMiddleware } from './tenantMiddleware.js'

/**
 * Mounts tenantMiddleware and a probe route in the same plugin scope
 * so the preHandler hook applies to the route.
 */
function makeApp() {
  const app = Fastify()
  app.register(async (instance) => {
    await tenantMiddleware(instance)
    instance.get('/probe', async (request, reply) => {
      reply.send({ tenantId: request.tenantId, branchId: request.branchId })
    })
  })
  return app
}

describe('tenantMiddleware', () => {
  it('sets tenantId and branchId from request headers', async () => {
    const app = makeApp()
    const res = await app.inject({
      method: 'GET',
      url: '/probe',
      headers: { 'x-tenant-id': 'tenant-abc', 'x-branch-id': 'branch-xyz' },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().tenantId).toBe('tenant-abc')
    expect(res.json().branchId).toBe('branch-xyz')
    await app.close()
  })

  it('sets null when headers are absent', async () => {
    const app = makeApp()
    const res = await app.inject({ method: 'GET', url: '/probe' })

    expect(res.statusCode).toBe(200)
    expect(res.json().tenantId).toBeNull()
    expect(res.json().branchId).toBeNull()
    await app.close()
  })

  it('sets tenantId only when branch header is absent', async () => {
    const app = makeApp()
    const res = await app.inject({
      method: 'GET',
      url: '/probe',
      headers: { 'x-tenant-id': 'tenant-only' },
    })

    expect(res.json().tenantId).toBe('tenant-only')
    expect(res.json().branchId).toBeNull()
    await app.close()
  })
})
