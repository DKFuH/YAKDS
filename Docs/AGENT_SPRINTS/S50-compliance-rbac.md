# Sprint 50 – Compliance, Plattformhärtung & SLA-Management

**Branch:** `feature/sprint-50-compliance-rbac`
**Gruppe:** B (parallel zu anderen Gruppe-B-Sprints – neue Tabellen, keine Konflikte)
**Status:** `done`

---

## Ziel

DSGVO-Tooling (Löschung + Export), SSO/SAML-Konfiguration (Stub), granulares RBAC,
SLA-Monitoring-Widget.

---

## 1. Prisma-Schema-Ergänzungen

```prisma
// ─────────────────────────────────────────
// PHASE 6 – Sprint 50: Compliance & RBAC
// ─────────────────────────────────────────

model GdprDeletionRequest {
  id           String    @id @default(uuid())
  tenant_id    String
  contact_id   String?
  user_id      String?
  requested_at DateTime  @default(now())
  completed_at DateTime?
  performed_by String
  scope_json   Json      @default("[]") // ["contacts","projects","leads"]
  result_json  Json      @default("{}") // { deleted: {contacts:1, leads:2}, anonymized: {...} }

  @@index([tenant_id])
  @@map("gdpr_deletion_requests")
}

model SsoProvider {
  id          String   @id @default(uuid())
  tenant_id   String   @unique
  entity_id   String   // IdP EntityID (SAML)
  sso_url     String   // IdP SSO-URL
  certificate String   // X.509 Public Key PEM
  enabled     Boolean  @default(false)
  created_at  DateTime @default(now())
  updated_at  DateTime @updatedAt

  @@map("sso_providers")
}

model RolePermission {
  id         String   @id @default(uuid())
  tenant_id  String
  role       String   @db.VarChar(50)   // "admin","sales","planner","viewer"
  resource   String   @db.VarChar(100)  // "projects","quotes","contacts","catalog"
  action     String   @db.VarChar(50)   // "read","write","delete","export"
  branch_id  String?  // null = alle Filialen
  created_at DateTime @default(now())

  @@unique([tenant_id, role, resource, action, branch_id])
  @@index([tenant_id, role])
  @@map("role_permissions")
}

model SlaSnapshot {
  id          String   @id @default(uuid())
  tenant_id   String?
  endpoint    String   @db.VarChar(200)
  p50_ms      Float
  p95_ms      Float
  uptime_pct  Float    @default(100)
  sample_size Int      @default(0)
  recorded_at DateTime @default(now())

  @@index([endpoint, recorded_at])
  @@map("sla_snapshots")
}
```

---

## 2. Neue Datei: `planner-api/src/routes/compliance.ts`

```typescript
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../db.js'
import { sendBadRequest, sendNotFound } from '../errors.js'

const DeletionRequestSchema = z.object({
  contact_id: z.string().uuid().optional(),
  user_id: z.string().uuid().optional(),
  performed_by: z.string().min(1).max(200),
  scope: z.array(z.enum(['contacts', 'projects', 'leads', 'documents'])).min(1),
})

const SsoProviderSchema = z.object({
  entity_id: z.string().min(1).max(500),
  sso_url: z.string().url(),
  certificate: z.string().min(10),
  enabled: z.boolean().optional(),
})

const RolePermissionSchema = z.object({
  role: z.enum(['admin', 'sales', 'planner', 'viewer']),
  resource: z.string().min(1).max(100),
  action: z.enum(['read', 'write', 'delete', 'export']),
  branch_id: z.string().uuid().nullable().optional(),
})

export async function complianceRoutes(app: FastifyInstance) {
  // ─── DSGVO-Löschung ─────────────────────────────────────────────────────

  app.post('/gdpr/deletion-requests', async (request, reply) => {
    const parsed = DeletionRequestSchema.safeParse(request.body)
    if (!parsed.success) return sendBadRequest(reply, parsed.error.errors[0]?.message ?? 'Invalid')

    const tenantId = request.tenantId ?? ''
    const { contact_id, user_id, performed_by, scope } = parsed.data

    const result: Record<string, Record<string, number>> = { deleted: {}, anonymized: {} }

    await prisma.$transaction(async (tx) => {
      if (scope.includes('leads') && contact_id) {
        const { count } = await tx.lead.deleteMany({ where: { contact_id } })
        result.deleted['leads'] = count
      }
      if (scope.includes('contacts') && contact_id) {
        // Anonymisieren statt löschen (DSGVO Art. 17)
        await tx.contact.update({
          where: { id: contact_id },
          data: {
            first_name: '[gelöscht]',
            last_name: '[gelöscht]',
            email: null,
            phone: null,
            notes: null,
            address_json: {},
          },
        })
        result.anonymized['contacts'] = 1
      }
    })

    const req = await prisma.gdprDeletionRequest.create({
      data: {
        tenant_id: tenantId,
        contact_id: contact_id ?? null,
        user_id: user_id ?? null,
        performed_by,
        scope_json: scope,
        result_json: result,
        completed_at: new Date(),
      },
    })

    return reply.status(201).send(req)
  })

  app.get('/gdpr/deletion-requests', async (request, reply) => {
    const tenantId = request.tenantId ?? ''
    const requests = await prisma.gdprDeletionRequest.findMany({
      where: { tenant_id: tenantId },
      orderBy: { requested_at: 'desc' },
      take: 100,
    })
    return reply.send(requests)
  })

  // DSGVO Datenexport (Art. 20)
  app.get<{ Params: { contactId: string } }>('/gdpr/export/:contactId', async (request, reply) => {
    const contact = await prisma.contact.findUnique({
      where: { id: request.params.contactId },
      include: { projects: true, leads: true },
    })
    if (!contact) return sendNotFound(reply, 'Contact not found')

    const exportData = {
      exported_at: new Date().toISOString(),
      contact,
      projects: contact.projects,
      leads: contact.leads,
    }

    reply.header('Content-Type', 'application/json')
    reply.header('Content-Disposition', `attachment; filename="gdpr-export-${contact.id}.json"`)
    return reply.send(exportData)
  })

  // ─── SSO-Provider ───────────────────────────────────────────────────────

  app.post('/sso-providers', async (request, reply) => {
    const parsed = SsoProviderSchema.safeParse(request.body)
    if (!parsed.success) return sendBadRequest(reply, parsed.error.errors[0]?.message ?? 'Invalid')

    const tenantId = request.tenantId ?? ''
    const provider = await prisma.ssoProvider.upsert({
      where: { tenant_id: tenantId },
      create: { tenant_id: tenantId, ...parsed.data },
      update: parsed.data,
    })
    return reply.status(201).send(provider)
  })

  app.get('/sso-providers/current', async (request, reply) => {
    const tenantId = request.tenantId ?? ''
    const provider = await prisma.ssoProvider.findUnique({ where: { tenant_id: tenantId } })
    if (!provider) return sendNotFound(reply, 'No SSO provider configured')
    return reply.send(provider)
  })

  // ─── RBAC ───────────────────────────────────────────────────────────────

  app.post('/role-permissions', async (request, reply) => {
    const parsed = RolePermissionSchema.safeParse(request.body)
    if (!parsed.success) return sendBadRequest(reply, parsed.error.errors[0]?.message ?? 'Invalid')

    const tenantId = request.tenantId ?? ''
    const perm = await prisma.rolePermission.create({
      data: {
        tenant_id: tenantId,
        ...parsed.data,
        branch_id: parsed.data.branch_id ?? null,
      },
    })
    return reply.status(201).send(perm)
  })

  app.get('/role-permissions', async (request, reply) => {
    const tenantId = request.tenantId ?? ''
    const query = request.query as { role?: string }
    const perms = await prisma.rolePermission.findMany({
      where: { tenant_id: tenantId, ...(query.role ? { role: query.role } : {}) },
      orderBy: [{ role: 'asc' }, { resource: 'asc' }],
    })
    return reply.send(perms)
  })

  app.delete<{ Params: { id: string } }>('/role-permissions/:id', async (request, reply) => {
    const existing = await prisma.rolePermission.findUnique({ where: { id: request.params.id } })
    if (!existing) return sendNotFound(reply, 'Permission not found')
    await prisma.rolePermission.delete({ where: { id: request.params.id } })
    return reply.status(204).send()
  })

  // ─── SLA-Snapshots ──────────────────────────────────────────────────────

  app.post('/sla-snapshots', async (request, reply) => {
    const schema = z.object({
      endpoint: z.string().min(1).max(200),
      p50_ms: z.number().min(0),
      p95_ms: z.number().min(0),
      uptime_pct: z.number().min(0).max(100).optional(),
      sample_size: z.number().int().min(0).optional(),
    })
    const parsed = schema.safeParse(request.body)
    if (!parsed.success) return sendBadRequest(reply, parsed.error.errors[0]?.message ?? 'Invalid')

    const snapshot = await prisma.slaSnapshot.create({ data: parsed.data })
    return reply.status(201).send(snapshot)
  })

  app.get('/sla-snapshots', async (request, reply) => {
    const query = request.query as { endpoint?: string; limit?: string }
    const snapshots = await prisma.slaSnapshot.findMany({
      where: query.endpoint ? { endpoint: query.endpoint } : {},
      orderBy: { recorded_at: 'desc' },
      take: Math.min(Number(query.limit ?? 50), 200),
    })
    return reply.send(snapshots)
  })
}
```

---

## 3. Neue Datei: `planner-api/src/routes/compliance.test.ts`

Mindest-Tests (12):
1. `POST /gdpr/deletion-requests` → 201
2. `POST /gdpr/deletion-requests` → 400 leerer scope
3. `GET /gdpr/deletion-requests` → 200 array
4. `GET /gdpr/export/:contactId` → 200 JSON
5. `GET /gdpr/export/:contactId` → 404
6. `POST /sso-providers` → 201
7. `GET /sso-providers/current` → 200
8. `GET /sso-providers/current` → 404
9. `POST /role-permissions` → 201
10. `GET /role-permissions` → 200 array
11. `DELETE /role-permissions/:id` → 204
12. `GET /sla-snapshots` → 200 array

---

## 4. `planner-api/src/index.ts` – Route registrieren

```typescript
import { complianceRoutes } from './routes/compliance.js'
await app.register(complianceRoutes, { prefix: '/api/v1' })
```

---

## 5. Frontend: Compliance-Admin-Page

Erstelle `planner-frontend/src/pages/CompliancePage.tsx` mit 3 Tabs:

**Tab 1: DSGVO**
- Formular: Contact-ID, Scope (Checkboxen), Ausführen
- Tabelle bisheriger Löschanfragen

**Tab 2: RBAC**
- Tabelle aller Rollen-Berechtigungen
- Neue Berechtigung hinzufügen (Rolle + Ressource + Aktion)
- Löschen-Button

**Tab 3: SLA**
- Tabelle der letzten 20 SLA-Snapshots (Endpoint, P50, P95, Uptime)

Route: `<Route path="/compliance" element={<CompliancePage />} />`

---

## DoD-Checkliste

- [ ] `npx vitest run src/routes/compliance.test.ts` → 12+ Tests grün
- [ ] `POST /api/v1/gdpr/deletion-requests` anonymisiert Kontakt in DB
- [ ] `GET /api/v1/gdpr/export/:contactId` gibt JSON-Download zurück
- [ ] `POST /api/v1/role-permissions` speichert Berechtigung
- [ ] ROADMAP.md Sprint 50 Status → `done`
- [ ] Commit + PR `feature/sprint-50-compliance-rbac`
