# Sprint 60 – Katalog-Hierarchie, Kitchen Assistant & Schnellfilter

**Branch:** `feature/sprint-60-katalog-kitchen-assistant`
**Gruppe:** D
**Status:** `done`
**Abhängigkeiten:** S59 (Bemaßung), S20 (Herstellerkataloge)

---

## Ziel

Tiefere Katalogstruktur (Familien/Kollektionen), auto-generierte Layout-Vorschläge
(Kitchen Assistant Light), Makro-CRUD und Live-Suche mit Debounce (< 100 ms).

---

## 1. Prisma-Schema-Ergänzung

### 1a. Migration der `catalog_articles`-Tabelle

```prisma
// Ergänzung der bestehenden catalog_articles-Tabelle:
// Felder family, collection, style_tag, is_favorite, usage_count hinzufügen
// (als Migration: ALTER TABLE catalog_articles ADD COLUMN ...)

// In schema.prisma – CatalogArticle-Model um folgende Felder erweitern:
//   family        String?
//   collection    String?
//   style_tag     String?
//   is_favorite   Boolean @default(false)
//   usage_count   Int     @default(0)
//
// Diese Felder per Migration ergänzen; KEIN bestehende Felder entfernen.
```

### 1b. Neues `CatalogMacro`-Model

```prisma
// ─────────────────────────────────────────────────────────────────────────
// PHASE 8 – Sprint 60: Kitchen Assistant & Katalog-Hierarchie
// ─────────────────────────────────────────────────────────────────────────

model CatalogMacro {
  id          String   @id @default(uuid())
  tenant_id   String
  name        String
  description String?
  thumbnail   String?  // URL
  positions   Json     // Array<{ wall_id: string | null, offset_mm: number, article_id: string, width_mm: number, depth_mm: number, height_mm: number }>
  created_by  String
  created_at  DateTime @default(now())
  updated_at  DateTime @updatedAt

  @@index([tenant_id])
  @@map("catalog_macros")
}

model KitchenLayoutSuggestion {
  id           String   @id @default(uuid())
  project_id   String
  room_id      String
  layout_type  KitchenLayout
  positions    Json     // gleiche Struktur wie CatalogMacro.positions
  score        Float    @default(0)  // Bewertung: 0..1 (Wandausnutzung, Ergonomie)
  applied      Boolean  @default(false)
  created_at   DateTime @default(now())

  @@index([project_id])
  @@map("kitchen_layout_suggestions")
}

enum KitchenLayout {
  einzeiler     // Single-wall kitchen
  zweizeiler    // Galley kitchen
  l_form        // L-shaped kitchen
  u_form        // U-shaped kitchen
  insel         // Island kitchen
}
```

---

## 2. Migrations-Script (Pseudo-SQL für Prisma Migrate)

```sql
-- Migration: catalog_articles_hierarchy
ALTER TABLE catalog_articles
  ADD COLUMN family      TEXT,
  ADD COLUMN collection  TEXT,
  ADD COLUMN style_tag   TEXT,
  ADD COLUMN is_favorite BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN usage_count INT     NOT NULL DEFAULT 0;

CREATE INDEX idx_catalog_articles_family     ON catalog_articles(family);
CREATE INDEX idx_catalog_articles_collection ON catalog_articles(collection);
CREATE INDEX idx_catalog_articles_tenant_fav ON catalog_articles(tenant_id, is_favorite);
```

---

## 3. Kitchen Assistant Service: `planner-api/src/services/kitchenAssistant.ts`

```typescript
import { z } from 'zod'

export interface WallSegment {
  id: string
  x0_mm: number
  y0_mm: number
  x1_mm: number
  y1_mm: number
  has_opening?: boolean
}

export interface RoomGeometry {
  wall_segments: WallSegment[]
  ceiling_height_mm: number
}

export interface MacroPosition {
  wall_id: string | null
  offset_mm: number
  article_id: string
  width_mm: number
  depth_mm: number
  height_mm: number
}

export interface LayoutSuggestion {
  layout_type: 'einzeiler' | 'zweizeiler' | 'l_form' | 'u_form' | 'insel'
  positions: MacroPosition[]
  score: number
  reason: string
}

const MIN_WALL_MM = 1200    // Mindest-Wandlänge für Küchenzeile
const MODULE_WIDTH = 600    // Standard-Modul-Breite mm
const MODULE_DEPTH = 600    // Standard-Modul-Tiefe mm
const MODULE_HEIGHT = 720   // Standard-Modul-Höhe mm

function wallLength(w: WallSegment): number {
  return Math.hypot(w.x1_mm - w.x0_mm, w.y1_mm - w.y0_mm)
}

function wallAngleDeg(w: WallSegment): number {
  return Math.atan2(w.y1_mm - w.y0_mm, w.x1_mm - w.x0_mm) * (180 / Math.PI)
}

function arePerpendicularWalls(a: WallSegment, b: WallSegment): boolean {
  const diff = Math.abs(wallAngleDeg(a) - wallAngleDeg(b))
  return Math.abs(diff % 180 - 90) < 15
}

function areParallelWalls(a: WallSegment, b: WallSegment): boolean {
  const diff = Math.abs(wallAngleDeg(a) - wallAngleDeg(b))
  return diff < 15 || Math.abs(diff - 180) < 15
}

function buildPositions(wall: WallSegment, count: number): MacroPosition[] {
  const len = wallLength(wall)
  const positions: MacroPosition[] = []
  for (let i = 0; i < count; i++) {
    positions.push({
      wall_id: wall.id,
      offset_mm: i * MODULE_WIDTH,
      article_id: 'placeholder-unterschrank-60',
      width_mm: MODULE_WIDTH,
      depth_mm: MODULE_DEPTH,
      height_mm: MODULE_HEIGHT,
    })
  }
  return positions
}

/**
 * Analysiert Raumgeometrie und schlägt 1–3 Küchenlayouts vor.
 * Regelbasiert (keine KI): Wandlängen, Winkel, Öffnungspositionen.
 */
export function suggestLayouts(room: RoomGeometry): LayoutSuggestion[] {
  const usableWalls = room.wall_segments.filter(w => !w.has_opening && wallLength(w) >= MIN_WALL_MM)

  if (usableWalls.length === 0) {
    return []  // Fallback: kein Vorschlag möglich
  }

  const suggestions: LayoutSuggestion[] = []

  // Längste Wand → Einzeiler
  const longest = [...usableWalls].sort((a, b) => wallLength(b) - wallLength(a))[0]
  const einzeilerCount = Math.floor(wallLength(longest) / MODULE_WIDTH)
  if (einzeilerCount >= 2) {
    suggestions.push({
      layout_type: 'einzeiler',
      positions: buildPositions(longest, einzeilerCount),
      score: Math.min(1, einzeilerCount * MODULE_WIDTH / wallLength(longest)),
      reason: `Längste Wand (${Math.round(wallLength(longest))} mm) – ${einzeilerCount} Module`,
    })
  }

  // L-Form: längste + angrenzende senkrechte Wand
  const perpWalls = usableWalls.filter(w => w.id !== longest.id && arePerpendicularWalls(w, longest))
  if (perpWalls.length > 0) {
    const side = perpWalls.sort((a, b) => wallLength(b) - wallLength(a))[0]
    const countA = Math.floor(wallLength(longest) / MODULE_WIDTH)
    const countB = Math.floor(wallLength(side) / MODULE_WIDTH)
    if (countA >= 2 && countB >= 1) {
      suggestions.push({
        layout_type: 'l_form',
        positions: [...buildPositions(longest, countA), ...buildPositions(side, countB)],
        score: Math.min(1, (countA + countB) * MODULE_WIDTH / (wallLength(longest) + wallLength(side))),
        reason: `L-Form: ${Math.round(wallLength(longest))} mm + ${Math.round(wallLength(side))} mm`,
      })
    }
  }

  // U-Form: 3 Wände (2× parallel + 1× senkrecht)
  const parallelWalls = usableWalls.filter(w => w.id !== longest.id && areParallelWalls(w, longest))
  if (parallelWalls.length >= 1 && perpWalls.length >= 1) {
    const opposite = parallelWalls[0]
    const connWall = perpWalls[0]
    const countA = Math.floor(wallLength(longest) / MODULE_WIDTH)
    const countB = Math.floor(wallLength(connWall) / MODULE_WIDTH)
    const countC = Math.floor(wallLength(opposite) / MODULE_WIDTH)
    if (countA >= 2 && countC >= 2) {
      suggestions.push({
        layout_type: 'u_form',
        positions: [...buildPositions(longest, countA), ...buildPositions(connWall, countB), ...buildPositions(opposite, countC)],
        score: 0.9,
        reason: `U-Form: ${countA + countB + countC} Module an 3 Wänden`,
      })
    }
  }

  // Maximal 3 Vorschläge; sortiert nach score absteigend
  return suggestions.sort((a, b) => b.score - a.score).slice(0, 3)
}
```

---

## 4. Neue Datei: `planner-api/src/routes/kitchenAssistant.ts`

```typescript
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../db.js'
import { sendBadRequest, sendNotFound } from '../errors.js'
import { suggestLayouts, type RoomGeometry } from '../services/kitchenAssistant.js'

// ── Catalog Macro CRUD ──────────────────────────────────────────────────

const MacroBodySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  thumbnail: z.string().url().optional(),
  positions: z.array(z.object({
    wall_id: z.string().nullable(),
    offset_mm: z.number(),
    article_id: z.string(),
    width_mm: z.number().positive(),
    depth_mm: z.number().positive(),
    height_mm: z.number().positive(),
  })).min(1),
  created_by: z.string(),
})

// ── Kitchen Assistant ───────────────────────────────────────────────────

const SuggestBodySchema = z.object({
  room_id: z.string(),
})

const ApplySuggestionBodySchema = z.object({
  suggestion_id: z.string(),
})

// ── Catalog article hierarchy query ────────────────────────────────────

const CatalogHierarchyQuerySchema = z.object({
  collection: z.string().optional(),
  family: z.string().optional(),
  style_tag: z.string().optional(),
  search: z.string().optional(),
  only_favorites: z.coerce.boolean().optional(),
  limit: z.coerce.number().min(1).max(200).default(50),
  offset: z.coerce.number().min(0).default(0),
})

export async function kitchenAssistantRoutes(app: FastifyInstance) {

  // ── Catalog Hierarchy ───────────────────────────────────────────────

  // GET /catalog/hierarchy – verfügbare Collections, Families, Style-Tags
  app.get('/catalog/hierarchy', async (request, reply) => {
    // Distinct collections, families, style_tags aus catalog_articles
    const [collections, families, tags] = await Promise.all([
      prisma.$queryRaw<{ collection: string }[]>`
        SELECT DISTINCT collection FROM catalog_articles
        WHERE collection IS NOT NULL ORDER BY collection`,
      prisma.$queryRaw<{ family: string }[]>`
        SELECT DISTINCT family FROM catalog_articles
        WHERE family IS NOT NULL ORDER BY family`,
      prisma.$queryRaw<{ style_tag: string }[]>`
        SELECT DISTINCT style_tag FROM catalog_articles
        WHERE style_tag IS NOT NULL ORDER BY style_tag`,
    ])
    return reply.send({
      collections: collections.map(r => r.collection),
      families: families.map(r => r.family),
      style_tags: tags.map(r => r.style_tag),
    })
  })

  // GET /catalog/articles – gefilterte Artikel mit Debounce-freundlichem Endpunkt
  app.get<{ Querystring: z.infer<typeof CatalogHierarchyQuerySchema> }>(
    '/catalog/articles',
    async (request, reply) => {
      const parsed = CatalogHierarchyQuerySchema.safeParse(request.query)
      if (!parsed.success) return sendBadRequest(reply, parsed.error.message)

      const { collection, family, style_tag, search, only_favorites, limit, offset } = parsed.data

      const where: Record<string, unknown> = {}
      if (collection) where.collection = collection
      if (family) where.family = family
      if (style_tag) where.style_tag = style_tag
      if (only_favorites) where.is_favorite = true
      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { article_number: { contains: search, mode: 'insensitive' } },
        ]
      }

      const [articles, total] = await Promise.all([
        prisma.catalogArticle.findMany({ where, take: limit, skip: offset, orderBy: { name: 'asc' } }),
        prisma.catalogArticle.count({ where }),
      ])
      return reply.send({ total, articles })
    },
  )

  // PATCH /catalog/articles/:id/favorite – Favorit-Toggle
  app.patch<{ Params: { id: string }; Body: { is_favorite: boolean } }>(
    '/catalog/articles/:id/favorite',
    async (request, reply) => {
      const article = await prisma.catalogArticle.findUnique({ where: { id: request.params.id } })
      if (!article) return sendNotFound(reply, 'Article not found')
      const updated = await prisma.catalogArticle.update({
        where: { id: request.params.id },
        data: { is_favorite: request.body.is_favorite },
      })
      return reply.send(updated)
    },
  )

  // ── Catalog Macros ──────────────────────────────────────────────────

  // POST /catalog-macros
  app.post<{ Body: z.infer<typeof MacroBodySchema> }>(
    '/catalog-macros',
    async (request, reply) => {
      const parsed = MacroBodySchema.safeParse(request.body)
      if (!parsed.success) return sendBadRequest(reply, parsed.error.message)

      const macro = await prisma.catalogMacro.create({
        data: {
          tenant_id: 'default', // TODO: aus JWT-Token
          ...parsed.data,
        },
      })
      return reply.status(201).send(macro)
    },
  )

  // GET /catalog-macros
  app.get('/catalog-macros', async (_request, reply) => {
    const macros = await prisma.catalogMacro.findMany({ orderBy: { name: 'asc' } })
    return reply.send(macros)
  })

  // GET /catalog-macros/:id
  app.get<{ Params: { id: string } }>('/catalog-macros/:id', async (request, reply) => {
    const macro = await prisma.catalogMacro.findUnique({ where: { id: request.params.id } })
    if (!macro) return sendNotFound(reply, 'Macro not found')
    return reply.send(macro)
  })

  // DELETE /catalog-macros/:id
  app.delete<{ Params: { id: string } }>('/catalog-macros/:id', async (request, reply) => {
    const macro = await prisma.catalogMacro.findUnique({ where: { id: request.params.id } })
    if (!macro) return sendNotFound(reply, 'Macro not found')
    await prisma.catalogMacro.delete({ where: { id: request.params.id } })
    return reply.status(204).send()
  })

  // ── Kitchen Assistant ───────────────────────────────────────────────

  // POST /rooms/:id/suggest-layout – Layout vorschlagen
  app.post<{ Params: { id: string } }>(
    '/rooms/:id/suggest-layout',
    async (request, reply) => {
      const room = await prisma.room.findUnique({ where: { id: request.params.id } })
      if (!room) return sendNotFound(reply, 'Room not found')

      const boundary = room.boundary as { wall_segments?: Array<{ id: string; x0_mm: number; y0_mm: number; x1_mm: number; y1_mm: number; has_opening?: boolean }> } | null

      if (!boundary?.wall_segments || boundary.wall_segments.length === 0) {
        return sendBadRequest(reply, 'Room has no wall segments – cannot suggest layout')
      }

      const geometry: RoomGeometry = {
        wall_segments: boundary.wall_segments,
        ceiling_height_mm: room.ceiling_height_mm,
      }

      const suggestions = suggestLayouts(geometry)

      if (suggestions.length === 0) {
        return reply.send({ suggestions: [], message: 'Kein Layout-Vorschlag möglich für diese Raumgeometrie' })
      }

      // Vorschläge in DB speichern
      const saved = await Promise.all(
        suggestions.map(s =>
          prisma.kitchenLayoutSuggestion.create({
            data: {
              project_id: room.project_id,
              room_id: room.id,
              layout_type: s.layout_type,
              positions: s.positions,
              score: s.score,
            },
          }),
        ),
      )

      return reply.status(201).send({ suggestions: saved.map((s, i) => ({ ...s, reason: suggestions[i].reason })) })
    },
  )

  // POST /kitchen-layout-suggestions/:id/apply – Layout in Raumplacements übernehmen
  app.post<{ Params: { id: string } }>(
    '/kitchen-layout-suggestions/:id/apply',
    async (request, reply) => {
      const suggestion = await prisma.kitchenLayoutSuggestion.findUnique({ where: { id: request.params.id } })
      if (!suggestion) return sendNotFound(reply, 'Suggestion not found')

      if (suggestion.applied) {
        return sendBadRequest(reply, 'Suggestion already applied')
      }

      const room = await prisma.room.findUnique({ where: { id: suggestion.room_id } })
      if (!room) return sendNotFound(reply, 'Room not found')

      // Positionen als neue Placements einfügen
      const existing = (room.placements as unknown[]) ?? []
      const newPlacements = [
        ...existing,
        ...(suggestion.positions as object[]),
      ]

      await prisma.room.update({
        where: { id: room.id },
        data: { placements: newPlacements },
      })

      await prisma.kitchenLayoutSuggestion.update({
        where: { id: suggestion.id },
        data: { applied: true },
      })

      return reply.send({ applied: true, placements_added: (suggestion.positions as unknown[]).length })
    },
  )

  // GET /rooms/:id/layout-suggestions – vorhandene Vorschläge
  app.get<{ Params: { id: string } }>(
    '/rooms/:id/layout-suggestions',
    async (request, reply) => {
      const room = await prisma.room.findUnique({ where: { id: request.params.id } })
      if (!room) return sendNotFound(reply, 'Room not found')

      const suggestions = await prisma.kitchenLayoutSuggestion.findMany({
        where: { room_id: request.params.id },
        orderBy: { score: 'desc' },
      })
      return reply.send(suggestions)
    },
  )
}
```

---

## 5. `planner-api/src/index.ts`

```typescript
import { kitchenAssistantRoutes } from './routes/kitchenAssistant.js'
await app.register(kitchenAssistantRoutes, { prefix: '/api/v1' })
```

---

## 6. Neue Datei: `planner-api/src/routes/kitchenAssistant.test.ts`

Mindest-Tests (14):

1. `GET /catalog/hierarchy` → 200, { collections, families, style_tags }
2. `GET /catalog/articles?search=Unterschrank` → 200, { total, articles }
3. `GET /catalog/articles?only_favorites=true` → 200, nur is_favorite=true
4. `GET /catalog/articles?collection=Luca&limit=10` → 200 ≤ 10 Artikel
5. `PATCH /catalog/articles/:id/favorite` mit `{ is_favorite: true }` → 200
6. `PATCH /catalog/articles/unknown/favorite` → 404
7. `POST /catalog-macros` mit gültigen Daten → 201
8. `POST /catalog-macros` mit leerem positions-Array → 400
9. `GET /catalog-macros` → 200 Array
10. `DELETE /catalog-macros/:id` → 204
11. `POST /rooms/:id/suggest-layout` mit Raum + Wandsegmenten → 201, suggestions.length >= 1
12. `POST /rooms/:id/suggest-layout` ohne Wandsegmente → 400
13. `POST /kitchen-layout-suggestions/:id/apply` → 200, applied: true
14. `POST /kitchen-layout-suggestions/:id/apply` zweimal → 400 (already applied)

### Test-Boilerplate

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'

const mockPrisma = vi.hoisted(() => ({
  $queryRaw: vi.fn(),
  catalogArticle: { findMany: vi.fn(), findUnique: vi.fn(), count: vi.fn(), update: vi.fn() },
  catalogMacro: { create: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), delete: vi.fn() },
  room: { findUnique: vi.fn(), update: vi.fn() },
  kitchenLayoutSuggestion: { create: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
}))
vi.mock('../db.js', () => ({ prisma: mockPrisma }))

const ROOM_WITH_WALLS = {
  id: 'room-1',
  project_id: 'proj-1',
  name: 'Küche',
  ceiling_height_mm: 2600,
  placements: [],
  boundary: {
    wall_segments: [
      { id: 'w1', x0_mm: 0, y0_mm: 0, x1_mm: 4200, y1_mm: 0 },
      { id: 'w2', x0_mm: 4200, y0_mm: 0, x1_mm: 4200, y1_mm: 3600 },
      { id: 'w3', x0_mm: 4200, y0_mm: 3600, x1_mm: 0, y1_mm: 3600 },
      { id: 'w4', x0_mm: 0, y0_mm: 3600, x1_mm: 0, y1_mm: 0 },
    ],
  },
}
```

---

## 7. Frontend: `planner-frontend/src/api/kitchenAssistant.ts`

```typescript
export interface CatalogMacro {
  id: string
  name: string
  description?: string
  thumbnail?: string
  positions: MacroPosition[]
}

export interface MacroPosition {
  wall_id: string | null
  offset_mm: number
  article_id: string
  width_mm: number
  depth_mm: number
  height_mm: number
}

export interface LayoutSuggestion {
  id: string
  layout_type: 'einzeiler' | 'zweizeiler' | 'l_form' | 'u_form' | 'insel'
  positions: MacroPosition[]
  score: number
  reason?: string
  applied: boolean
}

export const kitchenAssistantApi = {
  getHierarchy: () => fetch('/api/v1/catalog/hierarchy').then(r => r.json()),

  searchArticles: (params: {
    collection?: string; family?: string; search?: string; only_favorites?: boolean; limit?: number
  }) => {
    const q = new URLSearchParams()
    if (params.collection) q.set('collection', params.collection)
    if (params.family) q.set('family', params.family)
    if (params.search) q.set('search', params.search)
    if (params.only_favorites) q.set('only_favorites', 'true')
    if (params.limit) q.set('limit', String(params.limit))
    return fetch(`/api/v1/catalog/articles?${q}`).then(r => r.json())
  },

  toggleFavorite: (articleId: string, isFavorite: boolean) =>
    fetch(`/api/v1/catalog/articles/${articleId}/favorite`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_favorite: isFavorite }),
    }).then(r => r.json()),

  listMacros: (): Promise<CatalogMacro[]> =>
    fetch('/api/v1/catalog-macros').then(r => r.json()),

  createMacro: (data: Omit<CatalogMacro, 'id'> & { created_by: string }) =>
    fetch('/api/v1/catalog-macros', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(r => r.json()),

  deleteMacro: (id: string) =>
    fetch(`/api/v1/catalog-macros/${id}`, { method: 'DELETE' }),

  suggestLayouts: (roomId: string): Promise<{ suggestions: LayoutSuggestion[]; message?: string }> =>
    fetch(`/api/v1/rooms/${roomId}/suggest-layout`, { method: 'POST' }).then(r => r.json()),

  applyLayout: (suggestionId: string) =>
    fetch(`/api/v1/kitchen-layout-suggestions/${suggestionId}/apply`, { method: 'POST' }).then(r => r.json()),

  listSuggestions: (roomId: string): Promise<LayoutSuggestion[]> =>
    fetch(`/api/v1/rooms/${roomId}/layout-suggestions`).then(r => r.json()),
}
```

---

## 8. Frontend-Seite: `planner-frontend/src/pages/KitchenAssistantPanel.tsx`

Eingebunden als Panel in der rechten Sidebar des Editors (Reiter „Assistent"):

```tsx
// Haupt-Bestandteile:
// 1. Katalog-Hierarchie-Filter:
//    - Dropdown „Kollektion" (aus getHierarchy())
//    - Dropdown „Familie" (gefiltert nach Kollektion)
//    - Suchfeld (onInput mit 150ms setTimeout Debounce → searchArticles)
//    - Chips: ⭐ Favoriten | 🕐 Zuletzt | 🆕 Neu
//
// 2. Artikel-Liste:
//    - Virtuelle Liste (window.IntersectionObserver für infinite scroll)
//    - Pro Artikel: Artikelnummer + Name + Preis + ❤-Button
//    - Doppelklick → Platzieren (dispatch an Editor-State)
//
// 3. Makros:
//    - Makro-Liste mit Vorschau-Thumbnail
//    - „Makro platzieren" Button
//    - „Aus Selektion speichern" Button
//
// 4. Kitchen Assistant:
//    - Button „Layout vorschlagen"
//    - Vorschlag-Karten: L-Form / U-Form / Einzeiler mit score-Balken
//    - „Übernehmen"-Button pro Vorschlag
```

Live-Suche Debounce Pattern:

```tsx
const [query, setQuery] = useState('')
const [results, setResults] = useState([])

useEffect(() => {
  const timer = setTimeout(async () => {
    if (query.length < 2) return
    const data = await kitchenAssistantApi.searchArticles({ search: query, limit: 50 })
    setResults(data.articles)
  }, 150)  // < 100ms wahrgenommene Latenz bei normaler Verbindung
  return () => clearTimeout(timer)
}, [query])
```

---

## DoD-Checkliste

- [ ] `npx vitest run src/routes/kitchenAssistant.test.ts` → 14+ Tests grün
- [ ] `suggestLayouts()` Unit-Test: 4200×3600-Raum → mindestens `einzeiler` + `l_form` zurück
- [ ] `GET /api/v1/catalog/hierarchy` gibt collections/families/style_tags zurück
- [ ] `GET /api/v1/catalog/articles?search=...` antwortet in < 100 ms (Datenbankindex nötig)
- [ ] `POST /api/v1/rooms/:id/suggest-layout` speichert Vorschläge in DB
- [ ] `POST /api/v1/kitchen-layout-suggestions/:id/apply` überträgt Positionen in room.placements
- [ ] Makro CRUD vollständig (POST/GET/DELETE)
- [ ] Migration für catalog_articles-Felder family/collection/style_tag/is_favorite/usage_count
- [ ] ROADMAP.md Sprint 60 Status → `done`
- [ ] Commit + PR `feature/sprint-60-katalog-kitchen-assistant`
