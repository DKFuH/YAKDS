import Fastify from 'fastify'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const projectId = '11111111-1111-1111-1111-111111111111'
const orderId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const alternativeId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
const tenantId = '00000000-0000-0000-0000-000000000001'

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    project: {
      findUnique: vi.fn(),
    },
    alternative: {
      findFirst: vi.fn(),
    },
    purchaseOrder: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
    },
    purchaseOrderItem: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

prismaMock.$transaction.mockImplementation(async (callback: (tx: typeof prismaMock) => Promise<unknown>) => callback(prismaMock))

vi.mock('../db.js', () => ({
  prisma: prismaMock,
}))

vi.mock('../services/notificationService.js', () => ({
  queueNotification: vi.fn().mockResolvedValue(null),
}))

import { purchaseOrderRoutes } from './purchaseOrders.js'

const sampleOrder = {
  id: orderId,
  project_id: projectId,
  tenant_id: tenantId,
  supplier_name: 'Nobilia GmbH',
  supplier_ref: 'NB-2026-001',
  status: 'draft',
  order_date: null,
  delivery_date: new Date('2026-04-15T00:00:00.000Z'),
  notes: 'Prioritätsbestellung',
  created_by: 'planer-user',
  created_at: new Date('2026-03-01T00:00:00.000Z'),
  updated_at: new Date('2026-03-01T00:00:00.000Z'),
  items: [
    {
      id: 'item-0001',
      purchase_order_id: orderId,
      position: 0,
      sku: 'NB-60-B',
      description: 'Unterschrank 60cm',
      qty: 3,
      unit: 'Stk',
      unit_price_net: 220,
      line_net: 660,
      notes: null,
      created_at: new Date('2026-03-01T00:00:00.000Z'),
      updated_at: new Date('2026-03-01T00:00:00.000Z'),
    },
  ],
}

describe('purchaseOrderRoutes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.$transaction.mockImplementation(async (callback: (tx: typeof prismaMock) => Promise<unknown>) => callback(prismaMock))
  })

  it('creates a purchase order for a project', async () => {
    prismaMock.project.findUnique.mockResolvedValue({ id: projectId, tenant_id: tenantId })
    prismaMock.purchaseOrder.create.mockResolvedValue(sampleOrder)

    const app = Fastify()
    await app.register(purchaseOrderRoutes, { prefix: '/api/v1' })

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/purchase-orders`,
      payload: {
        supplier_name: 'Nobilia GmbH',
        supplier_ref: 'NB-2026-001',
        delivery_date: '2026-04-15T00:00:00.000Z',
        notes: 'Prioritätsbestellung',
        created_by: 'planer-user',
        items: [
          { position: 0, sku: 'NB-60-B', description: 'Unterschrank 60cm', qty: 3, unit_price_net: 220, line_net: 660 },
        ],
      },
    })

    expect(response.statusCode).toBe(201)
    expect(response.json()).toMatchObject({
      id: orderId,
      supplier_name: 'Nobilia GmbH',
      status: 'draft',
    })

    await app.close()
  })

  it('returns 404 when project not found on create', async () => {
    prismaMock.project.findUnique.mockResolvedValue(null)

    const app = Fastify()
    await app.register(purchaseOrderRoutes, { prefix: '/api/v1' })

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/purchase-orders`,
      payload: {
        supplier_name: 'Nobilia GmbH',
        created_by: 'planer-user',
      },
    })

    expect(response.statusCode).toBe(404)

    await app.close()
  })

  it('returns 400 for invalid create payload', async () => {
    const app = Fastify()
    await app.register(purchaseOrderRoutes, { prefix: '/api/v1' })

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/purchase-orders`,
      payload: { supplier_name: '', created_by: 'u' },
    })

    expect(response.statusCode).toBe(400)

    await app.close()
  })

  it('lists purchase orders for a project', async () => {
    prismaMock.project.findUnique.mockResolvedValue({ id: projectId, tenant_id: tenantId })
    prismaMock.purchaseOrder.findMany.mockResolvedValue([sampleOrder])

    const app = Fastify()
    await app.register(purchaseOrderRoutes, { prefix: '/api/v1' })

    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectId}/purchase-orders`,
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toHaveLength(1)
    expect(response.json()[0]).toMatchObject({ id: orderId, supplier_name: 'Nobilia GmbH' })

    await app.close()
  })

  it('returns 404 on list when project not found', async () => {
    prismaMock.project.findUnique.mockResolvedValue(null)

    const app = Fastify()
    await app.register(purchaseOrderRoutes, { prefix: '/api/v1' })

    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectId}/purchase-orders`,
    })

    expect(response.statusCode).toBe(404)

    await app.close()
  })

  it('gets a single purchase order by id', async () => {
    prismaMock.purchaseOrder.findUnique.mockResolvedValue(sampleOrder)

    const app = Fastify()
    await app.register(purchaseOrderRoutes, { prefix: '/api/v1' })

    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/purchase-orders/${orderId}`,
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({ id: orderId, supplier_name: 'Nobilia GmbH' })

    await app.close()
  })

  it('returns 404 for missing single purchase order', async () => {
    prismaMock.purchaseOrder.findUnique.mockResolvedValue(null)

    const app = Fastify()
    await app.register(purchaseOrderRoutes, { prefix: '/api/v1' })

    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/purchase-orders/${orderId}`,
    })

    expect(response.statusCode).toBe(404)

    await app.close()
  })

  it('updates purchase order status and notifies', async () => {
    prismaMock.purchaseOrder.findUnique.mockResolvedValue(sampleOrder)
    prismaMock.purchaseOrder.update.mockResolvedValue({ ...sampleOrder, status: 'sent' })

    const app = Fastify()
    await app.register(purchaseOrderRoutes, { prefix: '/api/v1' })

    const response = await app.inject({
      method: 'PATCH',
      url: `/api/v1/purchase-orders/${orderId}/status`,
      payload: { status: 'sent' },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({ status: 'sent' })

    await app.close()
  })

  it('marks all open orders as delivered for an alternative project', async () => {
    prismaMock.alternative.findFirst.mockResolvedValue({
      id: alternativeId,
      area: { project_id: projectId },
    })
    prismaMock.purchaseOrder.findMany.mockResolvedValue([
      { id: orderId, tenant_id: tenantId, supplier_name: 'Nobilia GmbH' },
      {
        id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
        tenant_id: tenantId,
        supplier_name: 'Blum GmbH',
      },
    ])
    prismaMock.purchaseOrder.updateMany.mockResolvedValue({ count: 2 })

    const app = Fastify()
    app.decorateRequest('tenantId', null)
    app.addHook('preHandler', (request, _reply, done) => {
      request.tenantId = tenantId
      done()
    })
    await app.register(purchaseOrderRoutes, { prefix: '/api/v1' })

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/alternatives/${alternativeId}/orders/mark-delivered`,
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
      updated_count: 2,
      order_ids: [orderId, 'cccccccc-cccc-cccc-cccc-cccccccccccc'],
    })
    expect(prismaMock.purchaseOrder.updateMany).toHaveBeenCalledWith({
      where: {
        tenant_id: tenantId,
        id: {
          in: [orderId, 'cccccccc-cccc-cccc-cccc-cccccccccccc'],
        },
      },
      data: { status: 'delivered' },
    })
    expect(prismaMock.alternative.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: alternativeId,
          area: {
            project: {
              tenant_id: tenantId,
            },
          },
        }),
      }),
    )

    await app.close()
  })

  it('returns 404 when alternative is missing for mark-delivered', async () => {
    prismaMock.alternative.findFirst.mockResolvedValue(null)

    const app = Fastify()
    await app.register(purchaseOrderRoutes, { prefix: '/api/v1' })

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/alternatives/${alternativeId}/orders/mark-delivered`,
    })

    expect(response.statusCode).toBe(404)
    expect(prismaMock.purchaseOrder.updateMany).not.toHaveBeenCalled()

    await app.close()
  })

  it('returns 400 for invalid alternative id on mark-delivered', async () => {
    const app = Fastify()
    await app.register(purchaseOrderRoutes, { prefix: '/api/v1' })

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/alternatives/not-a-uuid/orders/mark-delivered',
    })

    expect(response.statusCode).toBe(400)

    await app.close()
  })

  it('returns zero updates when no open orders exist', async () => {
    prismaMock.alternative.findFirst.mockResolvedValue({
      id: alternativeId,
      area: { project_id: projectId },
    })
    prismaMock.purchaseOrder.findMany.mockResolvedValue([])

    const app = Fastify()
    await app.register(purchaseOrderRoutes, { prefix: '/api/v1' })

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/alternatives/${alternativeId}/orders/mark-delivered`,
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ updated_count: 0, order_ids: [] })
    expect(prismaMock.purchaseOrder.updateMany).not.toHaveBeenCalled()

    await app.close()
  })

  it('returns 400 for invalid status value', async () => {
    const app = Fastify()
    await app.register(purchaseOrderRoutes, { prefix: '/api/v1' })

    const response = await app.inject({
      method: 'PATCH',
      url: `/api/v1/purchase-orders/${orderId}/status`,
      payload: { status: 'unknown_status' },
    })

    expect(response.statusCode).toBe(400)

    await app.close()
  })

  it('updates purchase order fields and replaces items', async () => {
    prismaMock.purchaseOrder.findUnique.mockResolvedValue(sampleOrder)
    prismaMock.purchaseOrderItem.deleteMany.mockResolvedValue({ count: 1 })
    prismaMock.purchaseOrderItem.createMany.mockResolvedValue({ count: 2 })
    prismaMock.purchaseOrder.update.mockResolvedValue({
      ...sampleOrder,
      supplier_ref: 'NB-2026-002',
      items: [],
    })

    const app = Fastify()
    await app.register(purchaseOrderRoutes, { prefix: '/api/v1' })

    const response = await app.inject({
      method: 'PUT',
      url: `/api/v1/purchase-orders/${orderId}`,
      payload: {
        supplier_ref: 'NB-2026-002',
        items: [
          { position: 0, description: 'Hängeschrank 80cm', qty: 2 },
          { position: 1, description: 'Hochschrank 200cm', qty: 1 },
        ],
      },
    })

    expect(response.statusCode).toBe(200)
    expect(prismaMock.purchaseOrderItem.deleteMany).toHaveBeenCalledWith({
      where: { purchase_order_id: orderId },
    })

    await app.close()
  })

  it('deletes a purchase order', async () => {
    prismaMock.purchaseOrder.findUnique.mockResolvedValue(sampleOrder)
    prismaMock.purchaseOrder.delete.mockResolvedValue(sampleOrder)

    const app = Fastify()
    await app.register(purchaseOrderRoutes, { prefix: '/api/v1' })

    const response = await app.inject({
      method: 'DELETE',
      url: `/api/v1/purchase-orders/${orderId}`,
    })

    expect(response.statusCode).toBe(204)

    await app.close()
  })

  it('returns 404 when deleting non-existing order', async () => {
    prismaMock.purchaseOrder.findUnique.mockResolvedValue(null)

    const app = Fastify()
    await app.register(purchaseOrderRoutes, { prefix: '/api/v1' })

    const response = await app.inject({
      method: 'DELETE',
      url: `/api/v1/purchase-orders/${orderId}`,
    })

    expect(response.statusCode).toBe(404)

    await app.close()
  })
})
