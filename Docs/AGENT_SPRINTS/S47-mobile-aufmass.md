# Sprint 47 – Mobile Aufmaß & Baustellenprotokoll

**Branch:** `feature/sprint-47-mobile-aufmass`
**Gruppe:** A (sofort startbar, keine Konflikte mit anderen Gruppe-A-Sprints)
**Status:** `done`

---

## Ziel

Progressive Web App für Außendienst: Aufmaß erfassen, Fotos dokumentieren,
Installationscheckliste abarbeiten, automatisches Abnahmeprotokoll generieren.

---

## 1. Prisma-Schema-Ergänzungen

Ans **Ende** von `planner-api/prisma/schema.prisma` anhängen:

```prisma
// ─────────────────────────────────────────
// PHASE 6 – Sprint 47: Mobile Aufmaß & Baustellenprotokoll
// ─────────────────────────────────────────

model SiteSurvey {
  id          String   @id @default(uuid())
  project_id  String
  tenant_id   String
  measurements Json    @default("{}") // { rooms: [{ name, width_mm, depth_mm, height_mm }] }
  photos      Json     @default("[]") // [{ url, caption, room_id, taken_at }]
  notes       String?
  synced_at   DateTime?
  created_by  String
  created_at  DateTime @default(now())
  updated_at  DateTime @updatedAt

  project     Project  @relation(fields: [project_id], references: [id], onDelete: Cascade)

  @@index([project_id])
  @@index([tenant_id])
  @@map("site_surveys")
}

model InstallationChecklist {
  id                  String            @id @default(uuid())
  production_order_id String?
  project_id          String
  tenant_id           String
  title               String            @default("Abnahmeprotokoll")
  completed_at        DateTime?
  created_by          String
  created_at          DateTime          @default(now())
  updated_at          DateTime          @updatedAt

  items               ChecklistItem[]

  @@index([project_id])
  @@index([production_order_id])
  @@map("installation_checklists")
}

model ChecklistItem {
  id            String                @id @default(uuid())
  checklist_id  String
  position      Int                   @default(0)
  label         String
  checked       Boolean               @default(false)
  photo_url     String?
  note          String?
  created_at    DateTime              @default(now())
  updated_at    DateTime              @updatedAt

  checklist     InstallationChecklist @relation(fields: [checklist_id], references: [id], onDelete: Cascade)

  @@index([checklist_id])
  @@map("checklist_items")
}
```

Außerdem in `model Project` (bestehend) folgende Zeile zur `purchase_orders`-Zeile hinzufügen:
```prisma
  site_surveys      SiteSurvey[]      // Phase 6 – Sprint 47: Aufmaß
```

---

## 2. Neue Datei: `planner-api/src/routes/siteSurveys.ts`

```typescript
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../db.js'
import { sendBadRequest, sendNotFound } from '../errors.js'

const MeasurementSchema = z.object({
  rooms: z.array(z.object({
    name: z.string().min(1).max(100),
    width_mm: z.number().positive(),
    depth_mm: z.number().positive(),
    height_mm: z.number().positive().optional(),
  })).optional(),
})

const PhotoSchema = z.object({
  url: z.string().url(),
  caption: z.string().max(500).optional(),
  room_id: z.string().optional(),
  taken_at: z.string().datetime().optional(),
})

const CreateSurveySchema = z.object({
  measurements: MeasurementSchema.optional(),
  photos: z.array(PhotoSchema).optional(),
  notes: z.string().max(2000).nullable().optional(),
  created_by: z.string().min(1).max(200),
})

const UpdateSurveySchema = z.object({
  measurements: MeasurementSchema.optional(),
  photos: z.array(PhotoSchema).optional(),
  notes: z.string().max(2000).nullable().optional(),
  synced_at: z.string().datetime().optional(),
})

export async function siteSurveyRoutes(app: FastifyInstance) {
  // POST /projects/:id/site-surveys
  app.post<{ Params: { id: string } }>('/projects/:id/site-surveys', async (request, reply) => {
    const parsed = CreateSurveySchema.safeParse(request.body)
    if (!parsed.success) return sendBadRequest(reply, parsed.error.errors[0]?.message ?? 'Invalid payload')

    const project = await prisma.project.findUnique({ where: { id: request.params.id } })
    if (!project) return sendNotFound(reply, 'Project not found')

    const tenantId = project.tenant_id ?? request.tenantId ?? ''
    const survey = await prisma.siteSurvey.create({
      data: {
        project_id: request.params.id,
        tenant_id: tenantId,
        measurements: parsed.data.measurements ?? {},
        photos: parsed.data.photos ?? [],
        notes: parsed.data.notes ?? null,
        created_by: parsed.data.created_by,
      },
    })
    return reply.status(201).send(survey)
  })

  // GET /projects/:id/site-surveys
  app.get<{ Params: { id: string } }>('/projects/:id/site-surveys', async (request, reply) => {
    const project = await prisma.project.findUnique({ where: { id: request.params.id } })
    if (!project) return sendNotFound(reply, 'Project not found')

    const surveys = await prisma.siteSurvey.findMany({
      where: { project_id: request.params.id },
      orderBy: { created_at: 'desc' },
    })
    return reply.send(surveys)
  })

  // GET /site-surveys/:id
  app.get<{ Params: { id: string } }>('/site-surveys/:id', async (request, reply) => {
    const survey = await prisma.siteSurvey.findUnique({ where: { id: request.params.id } })
    if (!survey) return sendNotFound(reply, 'Survey not found')
    return reply.send(survey)
  })

  // PUT /site-surveys/:id
  app.put<{ Params: { id: string } }>('/site-surveys/:id', async (request, reply) => {
    const parsed = UpdateSurveySchema.safeParse(request.body)
    if (!parsed.success) return sendBadRequest(reply, parsed.error.errors[0]?.message ?? 'Invalid payload')

    const existing = await prisma.siteSurvey.findUnique({ where: { id: request.params.id } })
    if (!existing) return sendNotFound(reply, 'Survey not found')

    const survey = await prisma.siteSurvey.update({
      where: { id: request.params.id },
      data: {
        ...(parsed.data.measurements !== undefined && { measurements: parsed.data.measurements }),
        ...(parsed.data.photos !== undefined && { photos: parsed.data.photos }),
        ...(parsed.data.notes !== undefined && { notes: parsed.data.notes }),
        ...(parsed.data.synced_at !== undefined && { synced_at: new Date(parsed.data.synced_at) }),
      },
    })
    return reply.send(survey)
  })

  // DELETE /site-surveys/:id
  app.delete<{ Params: { id: string } }>('/site-surveys/:id', async (request, reply) => {
    const existing = await prisma.siteSurvey.findUnique({ where: { id: request.params.id } })
    if (!existing) return sendNotFound(reply, 'Survey not found')
    await prisma.siteSurvey.delete({ where: { id: request.params.id } })
    return reply.status(204).send()
  })
}
```

---

## 3. Neue Datei: `planner-api/src/routes/checklists.ts`

```typescript
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../db.js'
import { sendBadRequest, sendNotFound } from '../errors.js'

const ChecklistItemSchema = z.object({
  position: z.number().int().min(0),
  label: z.string().min(1).max(500),
  checked: z.boolean().optional(),
  photo_url: z.string().url().nullable().optional(),
  note: z.string().max(1000).nullable().optional(),
})

const CreateChecklistSchema = z.object({
  project_id: z.string().uuid(),
  production_order_id: z.string().uuid().optional(),
  title: z.string().min(1).max(200).optional(),
  created_by: z.string().min(1).max(200),
  items: z.array(ChecklistItemSchema).optional(),
})

const UpdateItemSchema = z.object({
  checked: z.boolean().optional(),
  photo_url: z.string().url().nullable().optional(),
  note: z.string().max(1000).nullable().optional(),
})

export async function checklistRoutes(app: FastifyInstance) {
  // POST /checklists
  app.post('/checklists', async (request, reply) => {
    const parsed = CreateChecklistSchema.safeParse(request.body)
    if (!parsed.success) return sendBadRequest(reply, parsed.error.errors[0]?.message ?? 'Invalid payload')

    const project = await prisma.project.findUnique({ where: { id: parsed.data.project_id } })
    if (!project) return sendNotFound(reply, 'Project not found')

    const tenantId = project.tenant_id ?? request.tenantId ?? ''
    const checklist = await prisma.installationChecklist.create({
      data: {
        project_id: parsed.data.project_id,
        tenant_id: tenantId,
        production_order_id: parsed.data.production_order_id ?? null,
        title: parsed.data.title ?? 'Abnahmeprotokoll',
        created_by: parsed.data.created_by,
        items: parsed.data.items
          ? {
              create: parsed.data.items.map(item => ({
                position: item.position,
                label: item.label,
                checked: item.checked ?? false,
                photo_url: item.photo_url ?? null,
                note: item.note ?? null,
              })),
            }
          : undefined,
      },
      include: { items: { orderBy: { position: 'asc' } } },
    })
    return reply.status(201).send(checklist)
  })

  // GET /projects/:id/checklists
  app.get<{ Params: { id: string } }>('/projects/:id/checklists', async (request, reply) => {
    const project = await prisma.project.findUnique({ where: { id: request.params.id } })
    if (!project) return sendNotFound(reply, 'Project not found')

    const checklists = await prisma.installationChecklist.findMany({
      where: { project_id: request.params.id },
      include: { items: { orderBy: { position: 'asc' } } },
      orderBy: { created_at: 'desc' },
    })
    return reply.send(checklists)
  })

  // GET /checklists/:id
  app.get<{ Params: { id: string } }>('/checklists/:id', async (request, reply) => {
    const checklist = await prisma.installationChecklist.findUnique({
      where: { id: request.params.id },
      include: { items: { orderBy: { position: 'asc' } } },
    })
    if (!checklist) return sendNotFound(reply, 'Checklist not found')
    return reply.send(checklist)
  })

  // PATCH /checklists/:checklistId/items/:itemId
  app.patch<{ Params: { checklistId: string; itemId: string } }>(
    '/checklists/:checklistId/items/:itemId',
    async (request, reply) => {
      const parsed = UpdateItemSchema.safeParse(request.body)
      if (!parsed.success) return sendBadRequest(reply, parsed.error.errors[0]?.message ?? 'Invalid payload')

      const checklist = await prisma.installationChecklist.findUnique({ where: { id: request.params.checklistId } })
      if (!checklist) return sendNotFound(reply, 'Checklist not found')

      const item = await prisma.checklistItem.findUnique({ where: { id: request.params.itemId } })
      if (!item || item.checklist_id !== request.params.checklistId) return sendNotFound(reply, 'Item not found')

      const updated = await prisma.checklistItem.update({
        where: { id: request.params.itemId },
        data: {
          ...(parsed.data.checked !== undefined && { checked: parsed.data.checked }),
          ...(parsed.data.photo_url !== undefined && { photo_url: parsed.data.photo_url }),
          ...(parsed.data.note !== undefined && { note: parsed.data.note }),
        },
      })

      // Wenn alle Items gecheckt: completed_at setzen
      const allItems = await prisma.checklistItem.findMany({ where: { checklist_id: request.params.checklistId } })
      if (allItems.every(i => i.id === updated.id ? updated.checked : i.checked)) {
        await prisma.installationChecklist.update({
          where: { id: request.params.checklistId },
          data: { completed_at: new Date() },
        })
      }

      return reply.send(updated)
    },
  )

  // DELETE /checklists/:id
  app.delete<{ Params: { id: string } }>('/checklists/:id', async (request, reply) => {
    const existing = await prisma.installationChecklist.findUnique({ where: { id: request.params.id } })
    if (!existing) return sendNotFound(reply, 'Checklist not found')
    await prisma.installationChecklist.delete({ where: { id: request.params.id } })
    return reply.status(204).send()
  })
}
```

---

## 4. Neue Datei: `planner-api/src/routes/siteSurveys.test.ts`

Erstelle Tests für alle 5 siteSurvey-Endpunkte (create, list, get, update, delete) + 2 Fehlerfall-Tests.
Mindest-Anforderungen:
- Mock `prisma.project.findUnique`, `prisma.siteSurvey.*`
- 7 Tests: create-201, create-404-no-project, create-400-invalid, list-200, get-200, get-404, delete-204

Muster wie in `planner-api/src/routes/purchaseOrders.test.ts`.

---

## 5. Neue Datei: `planner-api/src/routes/checklists.test.ts`

Erstelle Tests für alle Checklist-Endpunkte.
Mindest-Anforderungen (8 Tests):
- create-201 (mit items), create-404, list-200, get-200, get-404, patch-item-200, patch-item-404, delete-204

---

## 6. `planner-api/src/index.ts` – Route registrieren

Einfügen nach `// Phase 6 Routes`:
```typescript
import { siteSurveyRoutes } from './routes/siteSurveys.js'
import { checklistRoutes } from './routes/checklists.js'
```

Und registrieren:
```typescript
await app.register(siteSurveyRoutes, { prefix: '/api/v1' })
await app.register(checklistRoutes, { prefix: '/api/v1' })
```

---

## 7. Frontend-API: `planner-frontend/src/api/siteSurveys.ts`

```typescript
import { api } from './client.js'

export interface SiteSurvey {
  id: string; project_id: string; tenant_id: string
  measurements: Record<string, unknown>; photos: unknown[]
  notes: string | null; synced_at: string | null
  created_by: string; created_at: string; updated_at: string
}

export interface ChecklistItem {
  id: string; checklist_id: string; position: number; label: string
  checked: boolean; photo_url: string | null; note: string | null
  created_at: string; updated_at: string
}

export interface InstallationChecklist {
  id: string; project_id: string; tenant_id: string
  production_order_id: string | null; title: string
  completed_at: string | null; created_by: string
  created_at: string; updated_at: string; items: ChecklistItem[]
}

export const siteSurveysApi = {
  list: (projectId: string) => api.get<SiteSurvey[]>(`/projects/${projectId}/site-surveys`),
  get: (id: string) => api.get<SiteSurvey>(`/site-surveys/${id}`),
  create: (projectId: string, data: object) => api.post<SiteSurvey>(`/projects/${projectId}/site-surveys`, data),
  update: (id: string, data: object) => api.put<SiteSurvey>(`/site-surveys/${id}`, data),
  delete: (id: string) => api.delete(`/site-surveys/${id}`),
}

export const checklistsApi = {
  list: (projectId: string) => api.get<InstallationChecklist[]>(`/projects/${projectId}/checklists`),
  get: (id: string) => api.get<InstallationChecklist>(`/checklists/${id}`),
  create: (data: object) => api.post<InstallationChecklist>('/checklists', data),
  updateItem: (checklistId: string, itemId: string, data: object) =>
    api.patch<ChecklistItem>(`/checklists/${checklistId}/items/${itemId}`, data),
  delete: (id: string) => api.delete(`/checklists/${id}`),
}
```

---

## 8. Frontend-Seite: `planner-frontend/src/pages/SiteSurveyPage.tsx`

Erstelle eine Seite `/site-surveys` mit:
- Projektauswahl (Dropdown)
- Liste der Aufmaße für gewähltes Projekt
- Detailansicht: Messungen-JSON als formatierte Tabelle, Fotos als Grid, Notizen
- Checklisten-Tab: Items mit Checkbox + Notiz-Feld, Fortschrittsanzeige (X/N erledigt)
- Neues Aufmaß anlegen (Formular: created_by + notes)

Route in `main.tsx` registrieren: `<Route path="/site-surveys" element={<SiteSurveyPage />} />`

---

## DoD-Checkliste

- [ ] `npx vitest run src/routes/siteSurveys.test.ts` → alle Tests grün
- [ ] `npx vitest run src/routes/checklists.test.ts` → alle Tests grün
- [ ] Prisma-Schema enthält `SiteSurvey`, `InstallationChecklist`, `ChecklistItem`
- [ ] Route `/api/v1/projects/:id/site-surveys` antwortet 201 auf POST
- [ ] Route `/api/v1/checklists/:id/items/:itemId` antwortet 200 auf PATCH
- [ ] `completed_at` wird gesetzt wenn alle Items gecheckt
- [ ] ROADMAP.md Sprint 47 Status → `done`
- [ ] Commit + PR `feature/sprint-47-mobile-aufmass`
