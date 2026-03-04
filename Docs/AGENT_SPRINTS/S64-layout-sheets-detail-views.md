# Sprint 64 – Layout-Sheets & Detail-Views

**Branch:** `feature/sprint-64-layout-sheets`
**Gruppe:** A (unabhängig)
**Status:** `done`
**Abhängigkeiten:** S59 (Bemaßung), S14 (3D-Preview), S63 (Centerlines)

---

## Ziel

Professionelle Planungsunterlagen: mehrere Zeichnungsblätter (Tabs) im Editor,
Detail-Views für komplexe Bereiche, Schnittansichten für Inseln und Hochschränke.
Leitidee: mehrblaettrige Layout-Sheets und mehrere gekoppelte Zeichnungsansichten.

---

## 1. Prisma-Schema: `LayoutSheet`

```prisma
// Sprint 64: Layout-Sheets
model LayoutSheet {
  id          String          @id @default(uuid())
  project_id  String
  name        String          @db.VarChar(100)  // "Grundriss", "Ansichten", "Installationsplan"
  sheet_type  LayoutSheetType @default(floorplan)
  position    Int             @default(0)        // Reihenfolge der Tabs
  config      Json            @default("{}")     // { scale, paper_size, margins, visible_layers }
  created_at  DateTime        @default(now())
  updated_at  DateTime        @updatedAt

  views       LayoutView[]

  @@index([project_id])
  @@map("layout_sheets")
}

enum LayoutSheetType {
  floorplan       // Grundriss (Standard)
  elevations      // Wandansichten / Frontansichten
  installation    // Installationsplan (Steckdosen, Gas, Wasser)
  detail          // Detailblatt (freie Detail-Views)
  section         // Schnittblatt
}

model LayoutView {
  id          String      @id @default(uuid())
  sheet_id    String
  view_type   ViewType
  label       String?
  room_id     String?
  wall_id     String?     // für Wandansicht
  clip_x_mm   Float?      // für Detail-View: Ausschnitt-Ursprung
  clip_y_mm   Float?
  clip_w_mm   Float?
  clip_h_mm   Float?
  scale       Float       @default(1.0)
  x_on_sheet  Float       @default(0)  // Position auf dem Blatt (mm)
  y_on_sheet  Float       @default(0)
  created_at  DateTime    @default(now())

  sheet       LayoutSheet @relation(fields: [sheet_id], references: [id], onDelete: Cascade)

  @@index([sheet_id])
  @@map("layout_views")
}

enum ViewType {
  floorplan   // 2D-Grundriss
  elevation   // Wandansicht (Frontansicht einer Wand)
  section     // Querschnitt
  detail      // vergrößerter Ausschnitt
  isometric   // axonometrische Ansicht
}
```

Migration:
```sql
CREATE TYPE "LayoutSheetType" AS ENUM ('floorplan', 'elevations', 'installation', 'detail', 'section');
CREATE TYPE "ViewType" AS ENUM ('floorplan', 'elevation', 'section', 'detail', 'isometric');

CREATE TABLE "layout_sheets" (
  "id"         TEXT NOT NULL PRIMARY KEY,
  "project_id" TEXT NOT NULL,
  "name"       VARCHAR(100) NOT NULL,
  "sheet_type" "LayoutSheetType" NOT NULL DEFAULT 'floorplan',
  "position"   INTEGER NOT NULL DEFAULT 0,
  "config"     JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "layout_sheets_project_id_idx" ON "layout_sheets"("project_id");

CREATE TABLE "layout_views" (
  "id"          TEXT NOT NULL PRIMARY KEY,
  "sheet_id"    TEXT NOT NULL REFERENCES "layout_sheets"("id") ON DELETE CASCADE,
  "view_type"   "ViewType" NOT NULL,
  "label"       TEXT,
  "room_id"     TEXT,
  "wall_id"     TEXT,
  "clip_x_mm"   DOUBLE PRECISION,
  "clip_y_mm"   DOUBLE PRECISION,
  "clip_w_mm"   DOUBLE PRECISION,
  "clip_h_mm"   DOUBLE PRECISION,
  "scale"       DOUBLE PRECISION NOT NULL DEFAULT 1.0,
  "x_on_sheet"  DOUBLE PRECISION NOT NULL DEFAULT 0,
  "y_on_sheet"  DOUBLE PRECISION NOT NULL DEFAULT 0,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "layout_views_sheet_id_idx" ON "layout_views"("sheet_id");
```

---

## 2. Routes: `planner-api/src/routes/layoutSheets.ts`

```typescript
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../db.js'
import { sendBadRequest, sendNotFound } from '../errors.js'

const SheetBodySchema = z.object({
  name: z.string().min(1).max(100),
  sheet_type: z.enum(['floorplan', 'elevations', 'installation', 'detail', 'section']).default('floorplan'),
  position: z.number().int().default(0),
  config: z.record(z.unknown()).default({}),
})

const ViewBodySchema = z.object({
  view_type: z.enum(['floorplan', 'elevation', 'section', 'detail', 'isometric']),
  label: z.string().optional(),
  room_id: z.string().optional(),
  wall_id: z.string().optional(),
  clip_x_mm: z.number().optional(),
  clip_y_mm: z.number().optional(),
  clip_w_mm: z.number().optional(),
  clip_h_mm: z.number().optional(),
  scale: z.number().positive().default(1.0),
  x_on_sheet: z.number().default(0),
  y_on_sheet: z.number().default(0),
})

export async function layoutSheetRoutes(app: FastifyInstance) {
  // GET /projects/:id/layout-sheets
  app.get<{ Params: { id: string } }>('/projects/:id/layout-sheets', async (request, reply) => {
    const project = await prisma.project.findUnique({ where: { id: request.params.id } })
    if (!project) return sendNotFound(reply, 'Project not found')
    const sheets = await prisma.layoutSheet.findMany({
      where: { project_id: request.params.id },
      include: { views: true },
      orderBy: { position: 'asc' },
    })
    return reply.send(sheets)
  })

  // POST /projects/:id/layout-sheets
  app.post<{ Params: { id: string }; Body: z.infer<typeof SheetBodySchema> }>(
    '/projects/:id/layout-sheets',
    async (request, reply) => {
      const project = await prisma.project.findUnique({ where: { id: request.params.id } })
      if (!project) return sendNotFound(reply, 'Project not found')
      const parsed = SheetBodySchema.safeParse(request.body)
      if (!parsed.success) return sendBadRequest(reply, parsed.error.message)
      const sheet = await prisma.layoutSheet.create({
        data: { project_id: request.params.id, ...parsed.data },
      })
      return reply.status(201).send(sheet)
    },
  )

  // DELETE /layout-sheets/:id
  app.delete<{ Params: { id: string } }>('/layout-sheets/:id', async (request, reply) => {
    const sheet = await prisma.layoutSheet.findUnique({ where: { id: request.params.id } })
    if (!sheet) return sendNotFound(reply, 'Layout sheet not found')
    await prisma.layoutSheet.delete({ where: { id: request.params.id } })
    return reply.status(204).send()
  })

  // POST /layout-sheets/:id/views
  app.post<{ Params: { id: string }; Body: z.infer<typeof ViewBodySchema> }>(
    '/layout-sheets/:id/views',
    async (request, reply) => {
      const sheet = await prisma.layoutSheet.findUnique({ where: { id: request.params.id } })
      if (!sheet) return sendNotFound(reply, 'Layout sheet not found')
      const parsed = ViewBodySchema.safeParse(request.body)
      if (!parsed.success) return sendBadRequest(reply, parsed.error.message)
      const view = await prisma.layoutView.create({
        data: { sheet_id: request.params.id, ...parsed.data },
      })
      return reply.status(201).send(view)
    },
  )

  // DELETE /layout-views/:id
  app.delete<{ Params: { id: string } }>('/layout-views/:id', async (request, reply) => {
    const view = await prisma.layoutView.findUnique({ where: { id: request.params.id } })
    if (!view) return sendNotFound(reply, 'Layout view not found')
    await prisma.layoutView.delete({ where: { id: request.params.id } })
    return reply.status(204).send()
  })

  // POST /projects/:id/layout-sheets/scaffold – Standard-Blätter anlegen
  // Legt automatisch: Grundriss, Ansichten, Installationsplan als 3 Standard-Sheets an
  app.post<{ Params: { id: string } }>(
    '/projects/:id/layout-sheets/scaffold',
    async (request, reply) => {
      const project = await prisma.project.findUnique({ where: { id: request.params.id } })
      if (!project) return sendNotFound(reply, 'Project not found')

      const defaults = [
        { name: 'Grundriss', sheet_type: 'floorplan' as const, position: 0 },
        { name: 'Ansichten', sheet_type: 'elevations' as const, position: 1 },
        { name: 'Installationsplan', sheet_type: 'installation' as const, position: 2 },
      ]

      const created = await Promise.all(
        defaults.map(d => prisma.layoutSheet.create({ data: { project_id: request.params.id, ...d, config: {} } }))
      )
      return reply.status(201).send(created)
    },
  )
}
```

---

## 3. Frontend: Sheet-Tabs im Editor

### `planner-frontend/src/components/editor/LayoutSheetTabs.tsx`

```tsx
import { useEffect, useState } from 'react'
import styles from './LayoutSheetTabs.module.css'

export interface LayoutSheet {
  id: string
  name: string
  sheet_type: string
  position: number
}

interface Props {
  projectId: string
  activeSheetId: string | null
  onSheetChange: (sheetId: string) => void
}

const SHEET_ICONS: Record<string, string> = {
  floorplan: '⊞',
  elevations: '▣',
  installation: '⚡',
  detail: '🔍',
  section: '✂',
}

export function LayoutSheetTabs({ projectId, activeSheetId, onSheetChange }: Props) {
  const [sheets, setSheets] = useState<LayoutSheet[]>([])

  useEffect(() => {
    fetch(`/api/v1/projects/${projectId}/layout-sheets`)
      .then(r => r.json())
      .then(setSheets)
      .catch(console.error)
  }, [projectId])

  return (
    <div className={styles.tabBar}>
      {sheets.map(sheet => (
        <button
          key={sheet.id}
          className={`${styles.tab} ${sheet.id === activeSheetId ? styles.active : ''}`}
          onClick={() => onSheetChange(sheet.id)}
        >
          <span className={styles.icon}>{SHEET_ICONS[sheet.sheet_type] ?? '📄'}</span>
          {sheet.name}
        </button>
      ))}
    </div>
  )
}
```

### `LayoutSheetTabs.module.css`

```css
.tabBar {
  display: flex;
  gap: 2px;
  padding: 4px 8px;
  background: var(--color-surface-2, #f1f3f5);
  border-bottom: 1px solid var(--color-border, #dee2e6);
  overflow-x: auto;
}
.tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  border: 1px solid transparent;
  border-radius: 4px 4px 0 0;
  background: none;
  cursor: pointer;
  font-size: 13px;
  white-space: nowrap;
}
.tab:hover { background: var(--color-surface-3, #e9ecef); }
.tab.active {
  background: white;
  border-color: var(--color-border, #dee2e6);
  border-bottom-color: white;
  font-weight: 500;
}
.icon { font-size: 11px; }
```

---

## 4. Tests (`planner-api/src/routes/layoutSheets.test.ts`)

Mindest-Tests (10):
1. `POST /projects/:id/layout-sheets` → 201, sheet_id zurück
2. `POST /projects/:id/layout-sheets` mit ungültigem sheet_type → 400
3. `GET /projects/:id/layout-sheets` → Array, nach position sortiert
4. `DELETE /layout-sheets/:id` → 204
5. `POST /projects/:id/layout-sheets/scaffold` → 201, genau 3 Sheets (Grundriss/Ansichten/Installationsplan)
6. Scaffold: Sheet-Typen korrekt (floorplan, elevations, installation)
7. `POST /layout-sheets/:id/views` mit view_type 'detail' → 201
8. `POST /layout-sheets/:id/views` mit Clip-Koordinaten → clip_x_mm gespeichert
9. `DELETE /layout-views/:id` → 204
10. `GET /projects/:id/layout-sheets` unbekannte project_id → 404

---

## DoD-Checkliste

- [ ] Schema: `layout_sheets` + `layout_views` + Enums + Migrationen
- [ ] `layoutSheets.ts` Routes: CRUD + scaffold
- [ ] `index.ts`: layoutSheetRoutes registriert
- [ ] `LayoutSheetTabs.tsx` + `.module.css`: Tab-Leiste im Editor
- [ ] 10+ Tests grün
- [ ] ROADMAP Sprint 64 → `done`
