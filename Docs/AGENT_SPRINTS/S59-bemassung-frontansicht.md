# Sprint 59 – 2D-Bemaßung & Frontansichten

**Branch:** `feature/sprint-59-bemassung-frontansicht`
**Gruppe:** C
**Status:** `done`

---

## Ziel

Bemaßungs-Entity (linear + angular) im Grundriss; automatische Frontansichten
für Küchenzeilen als SVG; PDF-Integration.

---

## 1. Prisma-Schema-Ergänzungen

```prisma
// ─────────────────────────────────────────
// PHASE 8 – Sprint 59: 2D-Bemaßung
// ─────────────────────────────────────────

model Dimension {
  id         String   @id @default(uuid())
  room_id    String
  type       DimensionType
  points     Json     // linear: [{x_mm,y_mm},{x_mm,y_mm}]; angular: [{x_mm,y_mm},{x_mm,y_mm},{x_mm,y_mm}]
  style      Json     @default("{}") // { unit:"mm", fontSize:12, arrowType:"open", offset_mm:50 }
  label      String?  // Override-Text; null = auto-berechnet
  created_at DateTime @default(now())
  updated_at DateTime @updatedAt

  @@index([room_id])
  @@map("dimensions")
}

enum DimensionType {
  linear
  angular
}
```

---

## 2. Neue Datei: `planner-api/src/routes/dimensions.ts`

```typescript
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../db.js'
import { sendBadRequest, sendNotFound } from '../errors.js'

const PointSchema = z.object({ x_mm: z.number(), y_mm: z.number() })
const StyleSchema = z.object({
  unit: z.enum(['mm', 'cm']).optional(),
  fontSize: z.number().int().min(6).max(24).optional(),
  arrowType: z.enum(['open', 'closed', 'none']).optional(),
  offset_mm: z.number().min(0).max(1000).optional(),
}).optional()

const CreateDimensionSchema = z.object({
  room_id: z.string().uuid(),
  type: z.enum(['linear', 'angular']),
  points: z.array(PointSchema).min(2).max(3),
  style: StyleSchema,
  label: z.string().max(100).nullable().optional(),
})

export async function dimensionRoutes(app: FastifyInstance) {
  // POST /dimensions
  app.post('/dimensions', async (request, reply) => {
    const parsed = CreateDimensionSchema.safeParse(request.body)
    if (!parsed.success) return sendBadRequest(reply, parsed.error.errors[0]?.message ?? 'Invalid')

    const room = await prisma.room.findUnique({ where: { id: parsed.data.room_id } })
    if (!room) return sendNotFound(reply, 'Room not found')

    if (parsed.data.type === 'angular' && parsed.data.points.length !== 3) {
      return sendBadRequest(reply, 'Angular dimension requires exactly 3 points')
    }

    const dim = await prisma.dimension.create({
      data: {
        room_id: parsed.data.room_id,
        type: parsed.data.type,
        points: parsed.data.points,
        style: parsed.data.style ?? {},
        label: parsed.data.label ?? null,
      },
    })
    return reply.status(201).send(dim)
  })

  // GET /rooms/:id/dimensions
  app.get<{ Params: { id: string } }>('/rooms/:id/dimensions', async (request, reply) => {
    const room = await prisma.room.findUnique({ where: { id: request.params.id } })
    if (!room) return sendNotFound(reply, 'Room not found')

    const dims = await prisma.dimension.findMany({
      where: { room_id: request.params.id },
      orderBy: { created_at: 'asc' },
    })
    return reply.send(dims)
  })

  // DELETE /dimensions/:id
  app.delete<{ Params: { id: string } }>('/dimensions/:id', async (request, reply) => {
    const dim = await prisma.dimension.findUnique({ where: { id: request.params.id } })
    if (!dim) return sendNotFound(reply, 'Dimension not found')
    await prisma.dimension.delete({ where: { id: request.params.id } })
    return reply.status(204).send()
  })

  // POST /rooms/:id/dimensions/auto – Raummaße automatisch generieren
  app.post<{ Params: { id: string } }>('/rooms/:id/dimensions/auto', async (request, reply) => {
    const room = await prisma.room.findUnique({ where: { id: request.params.id } })
    if (!room) return sendNotFound(reply, 'Room not found')

    const boundary = room.boundary as {
      wall_segments?: Array<{ id: string; x0_mm: number; y0_mm: number; x1_mm: number; y1_mm: number }>
    } | null

    if (!boundary?.wall_segments?.length) {
      return sendBadRequest(reply, 'Room has no boundary')
    }

    // Lösche bestehende Auto-Bemaßungen und erstelle neue
    await prisma.dimension.deleteMany({ where: { room_id: request.params.id } })

    const OFFSET_MM = 300 // 300mm außen versetzt
    const created = await Promise.all(
      boundary.wall_segments.map(wall => {
        // Senkrechten Offset berechnen
        const dx = wall.x1_mm - wall.x0_mm
        const dy = wall.y1_mm - wall.y0_mm
        const len = Math.hypot(dx, dy)
        if (len < 50) return null
        return prisma.dimension.create({
          data: {
            room_id: request.params.id,
            type: 'linear',
            points: [
              { x_mm: wall.x0_mm, y_mm: wall.y0_mm },
              { x_mm: wall.x1_mm, y_mm: wall.y1_mm },
            ],
            style: { unit: 'mm', offset_mm: OFFSET_MM },
            label: null,
          },
        })
      }).filter(Boolean),
    )

    return reply.status(201).send(created)
  })

  // GET /rooms/:id/elevation/:wallIndex – Frontansicht als SVG
  app.get<{ Params: { id: string; wallIndex: string } }>(
    '/rooms/:id/elevation/:wallIndex',
    async (request, reply) => {
      const room = await prisma.room.findUnique({ where: { id: request.params.id } })
      if (!room) return sendNotFound(reply, 'Room not found')

      const wallIndex = Number(request.params.wallIndex)
      const boundary = room.boundary as {
        wall_segments?: Array<{ id: string; x0_mm: number; y0_mm: number; x1_mm: number; y1_mm: number }>
      } | null
      const wall = boundary?.wall_segments?.[wallIndex]
      if (!wall) return sendNotFound(reply, 'Wall not found')

      const wallLen = Math.hypot(wall.x1_mm - wall.x0_mm, wall.y1_mm - wall.y0_mm)
      const roomHeight = room.ceiling_height_mm

      // Placements an dieser Wand
      const placements = (room.placements as Array<{ id: string; wall_id: string; offset_mm: number; width_mm: number; depth_mm: number }> ?? [])
        .filter(p => p.wall_id === wall.id)

      const SCALE = 0.1 // 1mm = 0.1px → 5m = 500px
      const svgWidth = Math.round(wallLen * SCALE) + 100
      const svgHeight = Math.round(roomHeight * SCALE) + 80

      let svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}">`

      // Boden-Linie
      svgContent += `<line x1="50" y1="${svgHeight - 30}" x2="${svgWidth - 50}" y2="${svgHeight - 30}" stroke="#333" stroke-width="2"/>`

      // Schränke
      for (const p of placements) {
        const x = 50 + p.offset_mm * SCALE
        const w = p.width_mm * SCALE
        const h = 720 * SCALE // Standard Unterschrankhöhe
        const y = svgHeight - 30 - h
        svgContent += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#e8d5b0" stroke="#8B4513" stroke-width="1"/>`
        svgContent += `<text x="${x + w / 2}" y="${y + h / 2}" text-anchor="middle" font-size="8" fill="#333">${Math.round(p.width_mm)}</text>`
      }

      // Breiten-Bemaßung
      svgContent += `<line x1="50" y1="${svgHeight - 15}" x2="${svgWidth - 50}" y2="${svgHeight - 15}" stroke="#666" stroke-width="1"/>`
      svgContent += `<text x="${svgWidth / 2}" y="${svgHeight - 5}" text-anchor="middle" font-size="10" fill="#666">${Math.round(wallLen)} mm</text>`

      svgContent += '</svg>'

      reply.header('Content-Type', 'image/svg+xml')
      return reply.send(svgContent)
    },
  )
}
```

---

## 3. Neue Datei: `planner-api/src/routes/dimensions.test.ts`

Mindest-Tests (10):
1. `POST /dimensions` linear → 201
2. `POST /dimensions` angular mit 3 Punkten → 201
3. `POST /dimensions` angular mit 2 Punkten → 400
4. `POST /dimensions` unbekannte room_id → 404
5. `GET /rooms/:id/dimensions` → 200 array
6. `DELETE /dimensions/:id` → 204
7. `DELETE /dimensions/:id` (nicht vorhanden) → 404
8. `POST /rooms/:id/dimensions/auto` → 201 erstellt mehrere Bemaßungen
9. `GET /rooms/:id/elevation/:wallIndex` → 200 mit SVG Content-Type
10. `GET /rooms/:id/elevation/99` → 404

---

## 4. `planner-api/src/index.ts`

```typescript
import { dimensionRoutes } from './routes/dimensions.js'
await app.register(dimensionRoutes, { prefix: '/api/v1' })
```

---

## 5. Frontend

### 5a. `planner-frontend/src/api/dimensions.ts`

```typescript
import { api } from './client.js'

export interface Dimension {
  id: string; room_id: string; type: 'linear' | 'angular'
  points: { x_mm: number; y_mm: number }[]; style: Record<string, unknown>
  label: string | null; created_at: string; updated_at: string
}

export const dimensionsApi = {
  list: (roomId: string) => api.get<Dimension[]>(`/rooms/${roomId}/dimensions`),
  create: (data: object) => api.post<Dimension>('/dimensions', data),
  autoGenerate: (roomId: string) => api.post<Dimension[]>(`/rooms/${roomId}/dimensions/auto`, {}),
  delete: (id: string) => api.delete(`/dimensions/${id}`),
  getElevation: (roomId: string, wallIndex: number) =>
    fetch(`/api/v1/rooms/${roomId}/elevation/${wallIndex}`).then(r => r.text()),
}
```

### 5b. Bemaßungs-Rendering in `PolygonEditor.tsx`

Füge `dimensions?: Dimension[]` und `onAddDimension?: ...` zur Props-Schnittstelle hinzu.

Im `<Layer>`, nach den Openings, füge Bemaßungs-Linien hinzu:

```tsx
{dimensions?.map(dim => {
  if (dim.type !== 'linear' || dim.points.length < 2) return null
  const p1 = { x: worldToCanvas(dim.points[0].x_mm), y: worldToCanvas(dim.points[0].y_mm) }
  const p2 = { x: worldToCanvas(dim.points[1].x_mm), y: worldToCanvas(dim.points[1].y_mm) }
  const offsetPx = worldToCanvas((dim.style as { offset_mm?: number }).offset_mm ?? 50)
  const dx = p2.x - p1.x; const dy = p2.y - p1.y
  const len = Math.hypot(dx, dy)
  if (len === 0) return null
  const nx = -dy / len; const ny = dx / len
  const lx1 = p1.x + nx * offsetPx; const ly1 = p1.y + ny * offsetPx
  const lx2 = p2.x + nx * offsetPx; const ly2 = p2.y + ny * offsetPx
  const lengthMm = Math.round(Math.hypot(dim.points[1].x_mm - dim.points[0].x_mm, dim.points[1].y_mm - dim.points[0].y_mm))
  const label = dim.label ?? `${lengthMm} mm`
  return (
    <Group key={dim.id}>
      <Line points={[lx1, ly1, lx2, ly2]} stroke="#444" strokeWidth={1} dash={[4, 2]} />
      <Text x={(lx1 + lx2) / 2 - 20} y={(ly1 + ly2) / 2 - 8} text={label} fontSize={10} fill="#333" />
    </Group>
  )
})}
```

---

## DoD-Checkliste

- [ ] `npx vitest run src/routes/dimensions.test.ts` → 10+ Tests grün
- [ ] `POST /api/v1/dimensions` erstellt lineare Bemaßung
- [ ] `POST /api/v1/rooms/:id/dimensions/auto` generiert Wandbemaßungen
- [ ] `GET /api/v1/rooms/:id/elevation/:wallIndex` gibt valides SVG zurück
- [ ] Bemaßungslinien im Canvas sichtbar
- [ ] ROADMAP.md Sprint 59 Status → `done`
- [ ] Commit + PR `feature/sprint-59-bemassung-frontansicht`
