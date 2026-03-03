# Sprint 63 – Smarte Bemaßung & Centerlines

**Branch:** `feature/sprint-63-smarte-bemassung`
**Gruppe:** A (unabhängig)
**Status:** `done`
**Abhängigkeiten:** S59 (Bemaßung/Frontansicht), S4 (Präzisionsbearbeitung)

---

## Ziel

CAD-typische Bemaßungs-Features: Maße referenzieren Geometrie-IDs und
aktualisieren sich automatisch beim Verschieben. Quick-Maßkette für
eine Wand auf Knopfdruck. Centerlines für Inseln, Spülen und Fensterachsen.

---

## 1. Auto-updating Dimensions

### Prisma-Schema-Ergänzung

In `model Dimension` (bereits vorhanden aus S59) neue Felder ergänzen:

```prisma
  // Geometrie-Referenzen für Auto-Update
  ref_a_type   String?   // "wall" | "placement" | "opening" | "point"
  ref_a_id     String?   // ID des referenzierten Objekts (Startpunkt)
  ref_b_type   String?   // "wall" | "placement" | "opening" | "point"
  ref_b_id     String?   // ID des referenzierten Objekts (Endpunkt)
  auto_update  Boolean   @default(false)
```

Migration:
```sql
ALTER TABLE "dimensions" ADD COLUMN IF NOT EXISTS "ref_a_type" VARCHAR(20);
ALTER TABLE "dimensions" ADD COLUMN IF NOT EXISTS "ref_a_id"   TEXT;
ALTER TABLE "dimensions" ADD COLUMN IF NOT EXISTS "ref_b_type" VARCHAR(20);
ALTER TABLE "dimensions" ADD COLUMN IF NOT EXISTS "ref_b_id"   TEXT;
ALTER TABLE "dimensions" ADD COLUMN IF NOT EXISTS "auto_update" BOOLEAN NOT NULL DEFAULT false;
```

### Neuer Service: `planner-api/src/services/dimensionResolver.ts`

```typescript
import type { PrismaClient } from '@prisma/client'

export interface ResolvedPoint { x_mm: number; y_mm: number }

/**
 * Löst eine Dimension-Referenz zu einem konkreten Punkt auf.
 * Wird aufgerufen wenn Geometrie geändert wird (Placement bewegt,
 * Wand verschoben etc.) um Dimension-Punkte automatisch zu aktualisieren.
 */
export async function resolveRefPoint(
  db: PrismaClient,
  refType: string,
  refId: string,
  side: 'start' | 'end',
): Promise<ResolvedPoint | null> {
  switch (refType) {
    case 'placement': {
      const p = await db.placement.findUnique({
        where: { id: refId },
        select: { offset_mm: true, wall_id: true, width_mm: true },
      })
      if (!p) return null
      return { x_mm: p.offset_mm + (side === 'end' ? (p.width_mm ?? 0) : 0), y_mm: 0 }
    }
    case 'opening': {
      const o = await db.opening.findUnique({
        where: { id: refId },
        select: { wall_offset_mm: true, width_mm: true },
      })
      if (!o) return null
      return { x_mm: o.wall_offset_mm + (side === 'end' ? o.width_mm : 0), y_mm: 0 }
    }
    case 'wall': {
      const w = await db.wall.findUnique({
        where: { id: refId },
        select: { x0_mm: true, y0_mm: true, x1_mm: true, y1_mm: true },
      })
      if (!w) return null
      return side === 'start'
        ? { x_mm: w.x0_mm, y_mm: w.y0_mm }
        : { x_mm: w.x1_mm, y_mm: w.y1_mm }
    }
    default:
      return null
  }
}

/**
 * Aktualisiert alle auto_update-Dimensionen eines Raums nach Geometrie-Änderung.
 * Aufzurufen nach: Placement-Move, Opening-Update, Wall-Update.
 */
export async function refreshRoomDimensions(db: PrismaClient, roomId: string): Promise<number> {
  const dims = await db.dimension.findMany({
    where: { room_id: roomId, auto_update: true },
  })

  let updated = 0
  for (const dim of dims) {
    const points = dim.points as { x_mm: number; y_mm: number }[]
    if (!points || points.length < 2) continue

    const newPoints = [...points]
    if (dim.ref_a_type && dim.ref_a_id) {
      const pt = await resolveRefPoint(db, dim.ref_a_type, dim.ref_a_id, 'start')
      if (pt) newPoints[0] = pt
    }
    if (dim.ref_b_type && dim.ref_b_id) {
      const pt = await resolveRefPoint(db, dim.ref_b_type, dim.ref_b_id, 'end')
      if (pt) newPoints[1] = pt
    }

    if (JSON.stringify(newPoints) !== JSON.stringify(points)) {
      await db.dimension.update({ where: { id: dim.id }, data: { points: newPoints } })
      updated++
    }
  }
  return updated
}
```

### Integration in bestehende Routes

In `planner-api/src/routes/placements.ts` und `walls.ts` nach erfolgreichem Update aufrufen:

```typescript
import { refreshRoomDimensions } from '../services/dimensionResolver.js'

// Nach Placement-Update:
await refreshRoomDimensions(prisma, placement.room_id)

// Nach Wall-Update:
await refreshRoomDimensions(prisma, wall.room_id)
```

---

## 2. Quick-Maßkette: `POST /rooms/:id/dimensions/auto-chain`

Erzeugt automatisch eine vollständige Maßkette für eine Wand:
alle Placements + Öffnungen werden als Referenz-Dimensionen angelegt.

```typescript
// planner-api/src/routes/dimensions.ts – neuer Endpoint

app.post<{ Params: { id: string }; Body: { wall_id: string; offset_mm?: number } }>(
  '/rooms/:id/dimensions/auto-chain',
  async (request, reply) => {
    const { wall_id, offset_mm = 150 } = request.body

    const wall = await prisma.wall.findUnique({
      where: { id: wall_id },
      include: {
        openings: { orderBy: { wall_offset_mm: 'asc' } },
        placements: { orderBy: { offset_mm: 'asc' } },
      },
    })
    if (!wall) return sendNotFound(reply, 'Wall not found')

    // Alle relevanten Punkte sammeln (Wandstart, Placements, Öffnungen, Wandende)
    type ChainPoint = { x_mm: number; ref_type: string; ref_id: string; side: 'start' | 'end' }
    const chainPoints: ChainPoint[] = [
      { x_mm: 0, ref_type: 'wall', ref_id: wall_id, side: 'start' },
    ]

    for (const o of wall.openings) {
      chainPoints.push({ x_mm: o.wall_offset_mm, ref_type: 'opening', ref_id: o.id, side: 'start' })
      chainPoints.push({ x_mm: o.wall_offset_mm + o.width_mm, ref_type: 'opening', ref_id: o.id, side: 'end' })
    }
    for (const p of wall.placements) {
      chainPoints.push({ x_mm: p.offset_mm, ref_type: 'placement', ref_id: p.id, side: 'start' })
      chainPoints.push({ x_mm: p.offset_mm + (p.width_mm ?? 0), ref_type: 'placement', ref_id: p.id, side: 'end' })
    }

    const wallLength = Math.hypot(wall.x1_mm - wall.x0_mm, wall.y1_mm - wall.y0_mm)
    chainPoints.push({ x_mm: wallLength, ref_type: 'wall', ref_id: wall_id, side: 'end' })

    // Deduplizieren + sortieren
    const sorted = chainPoints
      .sort((a, b) => a.x_mm - b.x_mm)
      .filter((pt, idx, arr) => idx === 0 || Math.abs(pt.x_mm - arr[idx - 1].x_mm) > 5)

    // Paarweise Dimensionen anlegen
    const created = []
    for (let i = 0; i < sorted.length - 1; i++) {
      const from = sorted[i]
      const to = sorted[i + 1]

      const dim = await prisma.dimension.create({
        data: {
          room_id: request.params.id,
          type: 'linear',
          points: [
            { x_mm: wall.x0_mm + from.x_mm, y_mm: wall.y0_mm - offset_mm },
            { x_mm: wall.x0_mm + to.x_mm, y_mm: wall.y0_mm - offset_mm },
          ],
          style: { chain: true, wall_id },
          label: null,
          ref_a_type: from.ref_type,
          ref_a_id: from.ref_id,
          ref_b_type: to.ref_type,
          ref_b_id: to.ref_id,
          auto_update: true,
        },
      })
      created.push(dim.id)
    }

    return reply.status(201).send({ created: created.length, dimension_ids: created })
  },
)
```

---

## 3. Centerlines: `model Centerline`

### Prisma-Schema

```prisma
// Sprint 63: Centerlines / Mittellinien
model Centerline {
  id         String  @id @default(uuid())
  room_id    String
  label      String?
  x0_mm      Float
  y0_mm      Float
  x1_mm      Float
  y1_mm      Float
  style      Json    @default("{}") // { dash: [6,3], color: "#0080ff" }
  ref_type   String? // "placement" | "opening" | null (manuell)
  ref_id     String?
  created_at DateTime @default(now())

  @@index([room_id])
  @@map("centerlines")
}
```

Migration:
```sql
CREATE TABLE "centerlines" (
  "id"         TEXT NOT NULL PRIMARY KEY,
  "room_id"    TEXT NOT NULL,
  "label"      TEXT,
  "x0_mm"      DOUBLE PRECISION NOT NULL,
  "y0_mm"      DOUBLE PRECISION NOT NULL,
  "x1_mm"      DOUBLE PRECISION NOT NULL,
  "y1_mm"      DOUBLE PRECISION NOT NULL,
  "style"      JSONB NOT NULL DEFAULT '{}',
  "ref_type"   TEXT,
  "ref_id"     TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "centerlines_room_id_idx" ON "centerlines"("room_id");
```

### Routes: `planner-api/src/routes/centerlines.ts`

```typescript
// POST /rooms/:id/centerlines – Centerlinie anlegen (manuell oder auto aus Placement)
// GET  /rooms/:id/centerlines – alle Centerlines eines Raums
// DELETE /centerlines/:id

// Auto-Centerline aus Placement-Mittelpunkt:
// POST /rooms/:id/centerlines/from-placement { placement_id }
// → berechnet Mittelpunkt des Placements und legt senkrechte Centerlinie zur Wand an
```

### Frontend

In der Konva-Canvas-Layer als gestrichelte blaue Linie (dash: [6, 3]):

```tsx
// planner-frontend/src/components/canvas/CenterlineLayer.tsx
import { Line, Text, Layer } from 'react-konva'

export function CenterlineLayer({ centerlines }: { centerlines: Centerline[] }) {
  return (
    <Layer>
      {centerlines.map(cl => (
        <>
          <Line
            key={cl.id}
            points={[cl.x0_mm, -cl.y0_mm, cl.x1_mm, -cl.y1_mm]}
            stroke="#2563eb"
            strokeWidth={1}
            dash={[6, 3]}
            listening={false}
          />
          {cl.label && (
            <Text x={cl.x0_mm} y={-cl.y0_mm - 12} text={cl.label} fontSize={10} fill="#2563eb" />
          )}
        </>
      ))}
    </Layer>
  )
}
```

---

## 4. Tests (`planner-api/src/routes/dimensions.test.ts` + neue Dateien)

Mindest-Tests (10):
1. `POST /rooms/:id/dimensions/auto-chain` → 201, mind. 2 Dimensionen erstellt
2. Auto-Chain: Dimensionen haben `auto_update: true` und `ref_a_id` gesetzt
3. Auto-Chain: Duplikat-Punkte werden gefiltert (< 5 mm Abstand)
4. `refreshRoomDimensions()` Unit: Placement verschoben → Dimension-Punkt aktualisiert
5. `refreshRoomDimensions()` Unit: Kein Update wenn Punkt unverändert → returned 0
6. `resolveRefPoint('placement', id, 'start')` → offset_mm korrekt
7. `resolveRefPoint('wall', id, 'end')` → x1_mm/y1_mm korrekt
8. `POST /rooms/:id/centerlines` → 201
9. `GET /rooms/:id/centerlines` → Array mit angelegter Linie
10. `DELETE /centerlines/:id` → 204

---

## DoD-Checkliste

- [ ] Schema: `dimensions` + 5 neue Felder + Migration
- [ ] Schema: `centerlines`-Tabelle + Migration
- [ ] `dimensionResolver.ts`: `resolveRefPoint` + `refreshRoomDimensions`
- [ ] Placements/Walls Routes rufen `refreshRoomDimensions` nach Update auf
- [ ] `POST /rooms/:id/dimensions/auto-chain` → vollständige Maßkette einer Wand
- [ ] `centerlines.ts` Routes: CRUD
- [ ] `CenterlineLayer.tsx`: gestrichelte blaue Linien auf Canvas
- [ ] 10+ Tests grün
- [ ] ROADMAP Sprint 63 → `done`
