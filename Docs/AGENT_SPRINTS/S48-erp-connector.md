# Sprint 48 – ERP-Anbindung & Lieferantenportal

**Branch:** `feature/sprint-48-erp-connector`
**Gruppe:** B (startbar nach S46 ✅ oder parallel zu anderen Gruppe-B-Sprints)
**Status:** `done`
**Abhängigkeit:** PurchaseOrder (Sprint 46, bereits gemergt)

---

## Ziel

PurchaseOrder um ERP-Konnektoren erweitern: automatische Übertragung ans Hersteller-ERP,
Webhook-Rückmeldung, Lieferantenportal-View.

---

## 1. Prisma-Schema-Ergänzungen

Ans **Ende** von `planner-api/prisma/schema.prisma` anhängen:

```prisma
// ─────────────────────────────────────────
// PHASE 6 – Sprint 48: ERP-Anbindung
// ─────────────────────────────────────────

model ErpConnector {
  id             String   @id @default(uuid())
  tenant_id      String
  name           String   @db.VarChar(200)
  endpoint       String   // REST-Endpunkt des ERP
  auth_config    Json     @default("{}") // { type: "bearer", token: "..." } oder { type: "basic", ... }
  field_mapping  Json     @default("{}") // { supplier_ref: "erp_order_number", ... }
  enabled        Boolean  @default(true)
  created_at     DateTime @default(now())
  updated_at     DateTime @updatedAt

  @@index([tenant_id])
  @@map("erp_connectors")
}
```

Außerdem in `model PurchaseOrder` (bestehend) folgende Zeile ergänzen (nach `production_order_id`):
```prisma
  erp_order_ref       String?   // befüllt nach ERP-Übertragung
  erp_connector_id    String?   // welcher Konnektor verwendet wurde
```

---

## 2. Neue Datei: `planner-api/src/services/erpPushService.ts`

```typescript
// Stub-Implementierung: sendet PurchaseOrder an ERP-Endpunkt via REST
export interface ErpConnector {
  id: string
  endpoint: string
  auth_config: { type: 'bearer'; token: string } | { type: 'basic'; username: string; password: string } | Record<string, unknown>
  field_mapping: Record<string, string>
}

export interface ErpPushResult {
  success: boolean
  erp_order_ref: string | null
  error: string | null
}

export async function pushToErp(
  connector: ErpConnector,
  purchaseOrder: { id: string; supplier_name: string; supplier_ref?: string | null; items: unknown[] },
): Promise<ErpPushResult> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }

  if (connector.auth_config.type === 'bearer') {
    headers['Authorization'] = `Bearer ${(connector.auth_config as { type: 'bearer'; token: string }).token}`
  } else if (connector.auth_config.type === 'basic') {
    const cfg = connector.auth_config as { type: 'basic'; username: string; password: string }
    headers['Authorization'] = `Basic ${Buffer.from(`${cfg.username}:${cfg.password}`).toString('base64')}`
  }

  // Feld-Mapping anwenden
  const payload: Record<string, unknown> = { ...purchaseOrder }
  for (const [localKey, erpKey] of Object.entries(connector.field_mapping)) {
    if (payload[localKey] !== undefined) {
      payload[erpKey] = payload[localKey]
    }
  }

  try {
    const res = await fetch(connector.endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText)
      return { success: false, erp_order_ref: null, error: `ERP returned ${res.status}: ${text}` }
    }

    const data = await res.json().catch(() => ({})) as Record<string, unknown>
    const erpRef = (data['order_id'] ?? data['erp_order_ref'] ?? data['id'] ?? null) as string | null
    return { success: true, erp_order_ref: erpRef ? String(erpRef) : null, error: null }
  } catch (err) {
    return { success: false, erp_order_ref: null, error: err instanceof Error ? err.message : 'Network error' }
  }
}
```

---

## 3. Neue Datei: `planner-api/src/routes/erpConnectors.ts`

```typescript
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../db.js'
import { sendBadRequest, sendNotFound } from '../errors.js'
import { pushToErp } from '../services/erpPushService.js'

const CreateConnectorSchema = z.object({
  name: z.string().min(1).max(200),
  endpoint: z.string().url(),
  auth_config: z.record(z.unknown()).optional(),
  field_mapping: z.record(z.string()).optional(),
  enabled: z.boolean().optional(),
})

const UpdateConnectorSchema = CreateConnectorSchema.partial()

export async function erpConnectorRoutes(app: FastifyInstance) {
  // POST /erp-connectors
  app.post('/erp-connectors', async (request, reply) => {
    const parsed = CreateConnectorSchema.safeParse(request.body)
    if (!parsed.success) return sendBadRequest(reply, parsed.error.errors[0]?.message ?? 'Invalid payload')

    const tenantId = request.tenantId ?? ''
    const connector = await prisma.erpConnector.create({
      data: {
        tenant_id: tenantId,
        name: parsed.data.name,
        endpoint: parsed.data.endpoint,
        auth_config: parsed.data.auth_config ?? {},
        field_mapping: parsed.data.field_mapping ?? {},
        enabled: parsed.data.enabled ?? true,
      },
    })
    return reply.status(201).send(connector)
  })

  // GET /erp-connectors
  app.get('/erp-connectors', async (request, reply) => {
    const tenantId = request.tenantId ?? ''
    const connectors = await prisma.erpConnector.findMany({
      where: { tenant_id: tenantId },
      orderBy: { name: 'asc' },
    })
    return reply.send(connectors)
  })

  // GET /erp-connectors/:id
  app.get<{ Params: { id: string } }>('/erp-connectors/:id', async (request, reply) => {
    const connector = await prisma.erpConnector.findUnique({ where: { id: request.params.id } })
    if (!connector) return sendNotFound(reply, 'ERP connector not found')
    return reply.send(connector)
  })

  // PUT /erp-connectors/:id
  app.put<{ Params: { id: string } }>('/erp-connectors/:id', async (request, reply) => {
    const parsed = UpdateConnectorSchema.safeParse(request.body)
    if (!parsed.success) return sendBadRequest(reply, parsed.error.errors[0]?.message ?? 'Invalid payload')

    const existing = await prisma.erpConnector.findUnique({ where: { id: request.params.id } })
    if (!existing) return sendNotFound(reply, 'ERP connector not found')

    const connector = await prisma.erpConnector.update({
      where: { id: request.params.id },
      data: parsed.data,
    })
    return reply.send(connector)
  })

  // DELETE /erp-connectors/:id
  app.delete<{ Params: { id: string } }>('/erp-connectors/:id', async (request, reply) => {
    const existing = await prisma.erpConnector.findUnique({ where: { id: request.params.id } })
    if (!existing) return sendNotFound(reply, 'ERP connector not found')
    await prisma.erpConnector.delete({ where: { id: request.params.id } })
    return reply.status(204).send()
  })

  // POST /purchase-orders/:id/push-to-erp
  app.post<{ Params: { id: string } }>('/purchase-orders/:id/push-to-erp', async (request, reply) => {
    const bodySchema = z.object({ connector_id: z.string().uuid() })
    const parsed = bodySchema.safeParse(request.body)
    if (!parsed.success) return sendBadRequest(reply, 'connector_id required')

    const purchaseOrder = await prisma.purchaseOrder.findUnique({
      where: { id: request.params.id },
      include: { items: true },
    })
    if (!purchaseOrder) return sendNotFound(reply, 'Purchase order not found')

    const connector = await prisma.erpConnector.findUnique({ where: { id: parsed.data.connector_id } })
    if (!connector) return sendNotFound(reply, 'ERP connector not found')
    if (!connector.enabled) return sendBadRequest(reply, 'ERP connector is disabled')

    const result = await pushToErp(
      connector as Parameters<typeof pushToErp>[0],
      {
        id: purchaseOrder.id,
        supplier_name: purchaseOrder.supplier_name,
        supplier_ref: purchaseOrder.supplier_ref,
        items: purchaseOrder.items,
      },
    )

    if (result.success && result.erp_order_ref) {
      await prisma.purchaseOrder.update({
        where: { id: request.params.id },
        data: { erp_order_ref: result.erp_order_ref, erp_connector_id: connector.id },
      })
    }

    return reply.send(result)
  })

  // POST /erp-webhook/:connectorId – ERP sendet Status-Update zurück
  app.post<{ Params: { connectorId: string } }>('/erp-webhook/:connectorId', async (request, reply) => {
    const body = request.body as { erp_order_ref?: string; status?: string } | null
    if (!body?.erp_order_ref || !body?.status) {
      return sendBadRequest(reply, 'erp_order_ref and status required')
    }

    // Passende PurchaseOrder finden
    const order = await prisma.purchaseOrder.findFirst({
      where: { erp_order_ref: body.erp_order_ref, erp_connector_id: request.params.connectorId },
    })

    if (order) {
      // Status-Mapping: ERP-Status → PurchaseOrder-Status
      const statusMap: Record<string, string> = {
        confirmed: 'confirmed',
        shipped: 'partially_delivered',
        delivered: 'delivered',
        cancelled: 'cancelled',
      }
      const newStatus = statusMap[body.status.toLowerCase()]
      if (newStatus) {
        await prisma.purchaseOrder.update({
          where: { id: order.id },
          data: { status: newStatus as Parameters<typeof prisma.purchaseOrder.update>[0]['data']['status'] },
        })
      }
    }

    return reply.status(200).send({ received: true })
  })
}
```

---

## 4. Neue Datei: `planner-api/src/routes/erpConnectors.test.ts`

Mindest-Tests (10):
1. `POST /erp-connectors` → 201
2. `POST /erp-connectors` → 400 (invalid URL)
3. `GET /erp-connectors` → 200 array
4. `GET /erp-connectors/:id` → 200
5. `GET /erp-connectors/:id` → 404
6. `PUT /erp-connectors/:id` → 200
7. `DELETE /erp-connectors/:id` → 204
8. `POST /purchase-orders/:id/push-to-erp` → 404 (no purchase order)
9. `POST /purchase-orders/:id/push-to-erp` → 400 (disabled connector)
10. `POST /erp-webhook/:connectorId` → 200 (mit erp_order_ref + status)

Mock: `prisma.erpConnector.*`, `prisma.purchaseOrder.*`
Mock `pushToErp` via `vi.mock('../services/erpPushService.js', () => ({ pushToErp: vi.fn().mockResolvedValue({ success: true, erp_order_ref: 'ERP-001', error: null }) }))`

---

## 5. `planner-api/src/index.ts` – Route registrieren

```typescript
import { erpConnectorRoutes } from './routes/erpConnectors.js'
// ...
await app.register(erpConnectorRoutes, { prefix: '/api/v1' })
```

---

## 6. Frontend: Lieferantenportal-View

Erstelle `planner-frontend/src/pages/SupplierPortalPage.tsx` mit:
- Tabelle aller offenen PurchaseOrders (status = draft | sent | confirmed)
- Spalten: Lieferant, Referenz, Positionen (count), Status, Erstellt
- Filter: nach Status
- ERP-Push-Button: wählt Konnektor aus (Dropdown) und ruft `POST /purchase-orders/:id/push-to-erp` auf

Route: `<Route path="/supplier-portal" element={<SupplierPortalPage />} />`

---

## DoD-Checkliste

- [ ] `npx vitest run src/routes/erpConnectors.test.ts` → 10+ Tests grün
- [ ] `POST /api/v1/erp-connectors` erstellt Konnektor
- [ ] `POST /api/v1/purchase-orders/:id/push-to-erp` ruft ERP auf und speichert `erp_order_ref`
- [ ] `POST /api/v1/erp-webhook/:connectorId` aktualisiert PurchaseOrder-Status
- [ ] ROADMAP.md Sprint 48 Status → `done`
- [ ] Commit + PR `feature/sprint-48-erp-connector`
