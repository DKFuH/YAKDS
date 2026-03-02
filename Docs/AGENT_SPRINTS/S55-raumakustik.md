# Sprint 55 – Raumakustik-Plugin (Voxel-Grid Import & Visualisierung)

**Branch:** `feature/sprint-55-raumakustik`
**Gruppe:** D
**Status:** `done`
**Abhängigkeiten:** S54 (OFML-Konfigurator), S14 (3D-Preview)

---

## Ziel

Akustische Planung durch Import externer Akustikberechnungen (CNIVG-Format) und
Visualisierung als Voxel-Grid-Falschfarbenkarte in der 2D-Ansicht (Konva-Overlay).

---

## 1. Prisma-Schema-Ergänzung

```prisma
// ─────────────────────────────────────────────────────────────────────────
// PHASE 7 – Sprint 55: Raumakustik-Plugin
// ─────────────────────────────────────────────────────────────────────────

model AcousticGrid {
  id             String   @id @default(uuid())
  project_id     String
  tenant_id      String
  filename       String
  variable       AcousticVariable @default(spl_db)
  resolution_mm  Int      @default(500)      // Voxel-Gitter-Auflösung in mm
  origin_x_mm    Float    @default(0)
  origin_y_mm    Float    @default(0)
  slice_height_mm Float   @default(1200)     // Querschnittshöhe
  grid_cols      Int
  grid_rows      Int
  values         Json     // Float-Array [row][col] → dB / T20 / STI-Wert
  min_value      Float
  max_value      Float
  created_at     DateTime @default(now())
  updated_at     DateTime @updatedAt

  @@index([project_id])
  @@map("acoustic_grids")
}

enum AcousticVariable {
  spl_db          // Schalldruckpegel dB
  spl_dba         // A-bewerteter Pegel dBA
  t20_s           // Nachhallzeit T20 in Sekunden
  sti             // Speech Transmission Index 0..1
}

model AcousticLayer {
  id          String   @id @default(uuid())
  project_id  String
  layer_type  AcousticLayerType
  object_refs Json     // Array of { room_id, placement_id?, x_mm, y_mm }
  label       String?
  created_at  DateTime @default(now())

  @@index([project_id])
  @@map("acoustic_layers")
}

enum AcousticLayerType {
  source    // Schallquelle (ACOUSTICS_SOURCE)
  receiver  // Schallsenke (ACOUSTICS_RECEIVER)
}
```

---

## 2. Neuer Service: `planner-api/src/services/cnivgParser.ts`

```typescript
export interface CnivgHeader {
  version: string
  variable: string
  resolution_mm: number
  origin_x_mm: number
  origin_y_mm: number
  slice_height_mm: number
  cols: number
  rows: number
}

export interface CnivgParseResult {
  header: CnivgHeader
  values: number[][]   // [row][col]
  min: number
  max: number
}

/**
 * CNIVG-Format (proprietäres Akustik-Dateiformat):
 * Textbasiertes Format mit Header-Zeilen und Grid-Daten.
 *
 * Beispiel-Header:
 *   CNIVG_VERSION=2.0
 *   VARIABLE=SPL_DB
 *   RESOLUTION_MM=500
 *   ORIGIN_X=0.0
 *   ORIGIN_Y=0.0
 *   SLICE_HEIGHT=1.2
 *   COLS=10
 *   ROWS=8
 *   DATA_START
 *   45.2 46.1 47.3 ...  (ROWS Zeilen mit je COLS Werten)
 *   ...
 *   DATA_END
 *
 * Falls das Format des Partners abweicht: parser anpassen.
 */
export function parseCnivg(content: string): CnivgParseResult {
  const lines = content.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  const header: Partial<CnivgHeader> = {}
  let dataStartIdx = -1

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line === 'DATA_START') { dataStartIdx = i + 1; break }

    const [key, val] = line.split('=', 2)
    if (!key || !val) continue
    switch (key.toUpperCase()) {
      case 'CNIVG_VERSION': header.version = val; break
      case 'VARIABLE': header.variable = val.toLowerCase(); break
      case 'RESOLUTION_MM': header.resolution_mm = parseFloat(val); break
      case 'ORIGIN_X': header.origin_x_mm = parseFloat(val) * 1000; break  // m→mm
      case 'ORIGIN_Y': header.origin_y_mm = parseFloat(val) * 1000; break
      case 'SLICE_HEIGHT': header.slice_height_mm = parseFloat(val) * 1000; break
      case 'COLS': header.cols = parseInt(val, 10); break
      case 'ROWS': header.rows = parseInt(val, 10); break
    }
  }

  if (header.cols == null || header.rows == null) {
    throw new Error('CNIVG: COLS/ROWS fehlen im Header')
  }
  if (dataStartIdx < 0) {
    throw new Error('CNIVG: DATA_START nicht gefunden')
  }

  const values: number[][] = []
  let min = Infinity
  let max = -Infinity

  for (let r = 0; r < header.rows; r++) {
    const line = lines[dataStartIdx + r]
    if (!line || line === 'DATA_END') break
    const row = line.split(/\s+/).map(parseFloat)
    values.push(row)
    for (const v of row) {
      if (!isNaN(v)) { if (v < min) min = v; if (v > max) max = v }
    }
  }

  return {
    header: {
      version: header.version ?? '1.0',
      variable: header.variable ?? 'spl_db',
      resolution_mm: header.resolution_mm ?? 500,
      origin_x_mm: header.origin_x_mm ?? 0,
      origin_y_mm: header.origin_y_mm ?? 0,
      slice_height_mm: header.slice_height_mm ?? 1200,
      cols: header.cols,
      rows: header.rows,
    },
    values,
    min: min === Infinity ? 0 : min,
    max: max === -Infinity ? 0 : max,
  }
}

/** Mapt einen Wert auf eine Falschfarbe [r,g,b] (Jet-Colormap: blau→grün→gelb→rot) */
export function valueToColor(value: number, min: number, max: number): [number, number, number] {
  if (max === min) return [128, 128, 128]
  const t = Math.max(0, Math.min(1, (value - min) / (max - min)))

  // Jet-Colormap-Approximation
  const r = Math.round(255 * Math.min(1, Math.max(0, 1.5 - Math.abs(4 * t - 3))))
  const g = Math.round(255 * Math.min(1, Math.max(0, 1.5 - Math.abs(4 * t - 2))))
  const b = Math.round(255 * Math.min(1, Math.max(0, 1.5 - Math.abs(4 * t - 1))))
  return [r, g, b]
}
```

---

## 3. Neue Datei: `planner-api/src/routes/acoustics.ts`

```typescript
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../db.js'
import { sendBadRequest, sendNotFound } from '../errors.js'
import { parseCnivg, valueToColor } from '../services/cnivgParser.js'

const AcousticLayerBodySchema = z.object({
  layer_type: z.enum(['source', 'receiver']),
  label: z.string().optional(),
  object_refs: z.array(z.object({
    room_id: z.string(),
    placement_id: z.string().optional(),
    x_mm: z.number(),
    y_mm: z.number(),
  })),
})

const GridTileQuerySchema = z.object({
  frequency_band: z.string().optional(), // z.B. "500hz", "1000hz"
})

export async function acousticsRoutes(app: FastifyInstance) {
  // POST /projects/:id/import/acoustics – CNIVG-Datei importieren
  app.post<{ Params: { id: string } }>(
    '/projects/:id/import/acoustics',
    { config: { rawBody: true } },
    async (request, reply) => {
      const project = await prisma.project.findUnique({ where: { id: request.params.id } })
      if (!project) return sendNotFound(reply, 'Project not found')

      const ct = request.headers['content-type'] ?? ''
      if (!ct.includes('text/plain') && !ct.includes('application/octet-stream')) {
        return sendBadRequest(reply, 'Expected Content-Type: text/plain or application/octet-stream')
      }

      const raw = request.rawBody as Buffer
      if (!raw || raw.length === 0) return sendBadRequest(reply, 'Empty body')

      const content = raw.toString('utf-8')
      const filename = (request.headers['x-filename'] as string | undefined) ?? `acoustics-${Date.now()}.cnivg`

      let parsed
      try {
        parsed = parseCnivg(content)
      } catch (err) {
        return sendBadRequest(reply, `CNIVG parse error: ${String(err)}`)
      }

      const variableMap: Record<string, 'spl_db' | 'spl_dba' | 't20_s' | 'sti'> = {
        spl_db: 'spl_db', spl: 'spl_db',
        spl_dba: 'spl_dba', dba: 'spl_dba',
        t20: 't20_s', t20_s: 't20_s',
        sti: 'sti',
      }
      const variable = variableMap[parsed.header.variable] ?? 'spl_db'

      const grid = await prisma.acousticGrid.create({
        data: {
          project_id: request.params.id,
          tenant_id: project.tenant_id,
          filename,
          variable,
          resolution_mm: parsed.header.resolution_mm,
          origin_x_mm: parsed.header.origin_x_mm,
          origin_y_mm: parsed.header.origin_y_mm,
          slice_height_mm: parsed.header.slice_height_mm,
          grid_cols: parsed.header.cols,
          grid_rows: parsed.header.rows,
          values: parsed.values,
          min_value: parsed.min,
          max_value: parsed.max,
        },
      })

      return reply.status(201).send({ grid_id: grid.id, cols: grid.grid_cols, rows: grid.grid_rows, min: grid.min_value, max: grid.max_value })
    },
  )

  // GET /projects/:id/acoustic-grids – alle Grids auflisten
  app.get<{ Params: { id: string } }>(
    '/projects/:id/acoustic-grids',
    async (request, reply) => {
      const project = await prisma.project.findUnique({ where: { id: request.params.id } })
      if (!project) return sendNotFound(reply, 'Project not found')

      const grids = await prisma.acousticGrid.findMany({
        where: { project_id: request.params.id },
        select: { id: true, filename: true, variable: true, resolution_mm: true, grid_cols: true, grid_rows: true, min_value: true, max_value: true, created_at: true },
        orderBy: { created_at: 'desc' },
      })
      return reply.send(grids)
    },
  )

  // GET /acoustic-grids/:id/tiles – Grid als GeoJSON-Feature-Collection (Falschfarbenkarte)
  app.get<{ Params: { id: string }; Querystring: z.infer<typeof GridTileQuerySchema> }>(
    '/acoustic-grids/:id/tiles',
    async (request, reply) => {
      const grid = await prisma.acousticGrid.findUnique({ where: { id: request.params.id } })
      if (!grid) return sendNotFound(reply, 'Acoustic grid not found')

      const values = grid.values as number[][]
      const features: object[] = []

      for (let r = 0; r < grid.grid_rows; r++) {
        for (let c = 0; c < grid.grid_cols; c++) {
          const value = values[r]?.[c]
          if (value == null || isNaN(value)) continue

          const x = grid.origin_x_mm + c * grid.resolution_mm
          const y = grid.origin_y_mm + r * grid.resolution_mm
          const [red, green, blue] = valueToColor(value, grid.min_value, grid.max_value)

          features.push({
            type: 'Feature',
            geometry: {
              type: 'Polygon',
              coordinates: [[
                [x, y],
                [x + grid.resolution_mm, y],
                [x + grid.resolution_mm, y + grid.resolution_mm],
                [x, y + grid.resolution_mm],
                [x, y],
              ]],
            },
            properties: { value, color: `rgb(${red},${green},${blue})` },
          })
        }
      }

      return reply.send({
        type: 'FeatureCollection',
        variable: grid.variable,
        min: grid.min_value,
        max: grid.max_value,
        features,
      })
    },
  )

  // DELETE /acoustic-grids/:id
  app.delete<{ Params: { id: string } }>(
    '/acoustic-grids/:id',
    async (request, reply) => {
      const grid = await prisma.acousticGrid.findUnique({ where: { id: request.params.id } })
      if (!grid) return sendNotFound(reply, 'Acoustic grid not found')
      await prisma.acousticGrid.delete({ where: { id: request.params.id } })
      return reply.status(204).send()
    },
  )

  // POST /projects/:id/acoustic-layers – Schallquelle/Schallsenke anlegen
  app.post<{ Params: { id: string }; Body: z.infer<typeof AcousticLayerBodySchema> }>(
    '/projects/:id/acoustic-layers',
    async (request, reply) => {
      const project = await prisma.project.findUnique({ where: { id: request.params.id } })
      if (!project) return sendNotFound(reply, 'Project not found')

      const parsed = AcousticLayerBodySchema.safeParse(request.body)
      if (!parsed.success) return sendBadRequest(reply, parsed.error.message)

      const layer = await prisma.acousticLayer.create({
        data: {
          project_id: request.params.id,
          layer_type: parsed.data.layer_type,
          label: parsed.data.label,
          object_refs: parsed.data.object_refs,
        },
      })
      return reply.status(201).send(layer)
    },
  )

  // GET /projects/:id/acoustic-layers
  app.get<{ Params: { id: string } }>(
    '/projects/:id/acoustic-layers',
    async (request, reply) => {
      const project = await prisma.project.findUnique({ where: { id: request.params.id } })
      if (!project) return sendNotFound(reply, 'Project not found')
      const layers = await prisma.acousticLayer.findMany({ where: { project_id: request.params.id } })
      return reply.send(layers)
    },
  )
}
```

---

## 4. `planner-api/src/index.ts`

```typescript
import { acousticsRoutes } from './routes/acoustics.js'
await app.register(acousticsRoutes, { prefix: '/api/v1' })
```

---

## 5. Neue Datei: `planner-api/src/routes/acoustics.test.ts`

Mindest-Tests (12):

1. `POST /projects/:id/import/acoustics` mit gültigem CNIVG-Content → 201, grid_id vorhanden
2. `POST /projects/:id/import/acoustics` – min/max korrekt berechnet
3. `POST /projects/:id/import/acoustics` mit fehlendem COLS-Header → 400
4. `POST /projects/:id/import/acoustics` mit leerem Body → 400
5. `POST /projects/:id/import/acoustics` unbekannte project_id → 404
6. `GET /projects/:id/acoustic-grids` → 200 Array
7. `GET /projects/:id/acoustic-grids` unbekannte project_id → 404
8. `GET /acoustic-grids/:id/tiles` → 200 GeoJSON FeatureCollection
9. `GET /acoustic-grids/:id/tiles` – features.length === cols * rows (bei vollständigem Grid)
10. `GET /acoustic-grids/unknown/tiles` → 404
11. `DELETE /acoustic-grids/:id` → 204
12. `POST /projects/:id/acoustic-layers` mit source-Layer → 201

### Test-Boilerplate

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'

const mockPrisma = vi.hoisted(() => ({
  project: { findUnique: vi.fn() },
  acousticGrid: { create: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), delete: vi.fn() },
  acousticLayer: { create: vi.fn(), findMany: vi.fn() },
}))
vi.mock('../db.js', () => ({ prisma: mockPrisma }))

const CNIVG_CONTENT = [
  'CNIVG_VERSION=2.0',
  'VARIABLE=SPL_DB',
  'RESOLUTION_MM=500',
  'ORIGIN_X=0.0',
  'ORIGIN_Y=0.0',
  'SLICE_HEIGHT=1.2',
  'COLS=3',
  'ROWS=2',
  'DATA_START',
  '42.1 45.6 48.3',
  '40.0 43.2 50.1',
  'DATA_END',
].join('\n')
```

---

## 6. Frontend: `planner-frontend/src/api/acoustics.ts`

```typescript
export interface AcousticGridMeta {
  id: string
  filename: string
  variable: 'spl_db' | 'spl_dba' | 't20_s' | 'sti'
  resolution_mm: number
  grid_cols: number
  grid_rows: number
  min_value: number
  max_value: number
  created_at: string
}

export interface GeoJsonGrid {
  type: 'FeatureCollection'
  variable: string
  min: number
  max: number
  features: Array<{
    type: 'Feature'
    geometry: { type: 'Polygon'; coordinates: number[][][] }
    properties: { value: number; color: string }
  }>
}

export const acousticsApi = {
  importCnivg: async (projectId: string, file: File, label?: string): Promise<{ grid_id: string; cols: number; rows: number }> => {
    const text = await file.text()
    const res = await fetch(`/api/v1/projects/${projectId}/import/acoustics`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain', 'X-Filename': file.name },
      body: text,
    })
    if (!res.ok) throw new Error(await res.text())
    return res.json()
  },

  listGrids: (projectId: string): Promise<AcousticGridMeta[]> =>
    fetch(`/api/v1/projects/${projectId}/acoustic-grids`).then(r => r.json()),

  getTiles: (gridId: string): Promise<GeoJsonGrid> =>
    fetch(`/api/v1/acoustic-grids/${gridId}/tiles`).then(r => r.json()),

  deleteGrid: (gridId: string) =>
    fetch(`/api/v1/acoustic-grids/${gridId}`, { method: 'DELETE' }),

  listLayers: (projectId: string) =>
    fetch(`/api/v1/projects/${projectId}/acoustic-layers`).then(r => r.json()),
}
```

## 7. Frontend-Overlay: `planner-frontend/src/pages/AcousticOverlay.tsx`

```tsx
import { useEffect, useState } from 'react'
import { Rect, Group, Text, Layer } from 'react-konva'
import { acousticsApi, type GeoJsonGrid } from '../api/acoustics'

interface Props {
  projectId: string
  gridId: string | null
  opacity: number      // 0..1
  visible: boolean
  stageScale: number
}

export function AcousticOverlay({ projectId, gridId, opacity, visible, stageScale }: Props) {
  const [grid, setGrid] = useState<GeoJsonGrid | null>(null)

  useEffect(() => {
    if (!gridId || !visible) return
    acousticsApi.getTiles(gridId).then(setGrid).catch(console.error)
  }, [gridId, visible])

  if (!visible || !grid) return null

  return (
    <Layer opacity={opacity}>
      {grid.features.map((f, i) => {
        const [[x0, y0]] = f.geometry.coordinates[0]
        const x1 = f.geometry.coordinates[0][1][0]
        const y1 = f.geometry.coordinates[0][2][1]
        return (
          <Rect
            key={i}
            x={x0}
            y={-y0}   // Y-Achse invertiert (Konva vs. Koordinatensystem)
            width={x1 - x0}
            height={y1 - y0}
            fill={f.properties.color}
            listening={false}
          />
        )
      })}
    </Layer>
  )
}
```

Die `AcousticOverlay`-Komponente wird in `Editor.tsx` als optionale Konva-`Layer`-Ebene eingebunden:

```tsx
// In Editor.tsx – nach vorhandenen Layern
{acousticPlugin.active && (
  <AcousticOverlay
    projectId={projectId}
    gridId={acousticPlugin.activeGridId}
    opacity={acousticPlugin.opacity}
    visible={acousticPlugin.active}
    stageScale={stageScale}
  />
)}
```

Akustik-Panel in der rechten Sidebar (Reiter „Akustik"):
- Datei-Upload-Button (CNIVG/Textdatei)
- Dropdown: Akustikgröße (SPL dB / SPL dBA / T20 / STI)
- Slider: Deckkraft 0–100 %
- Liste der importierten Grids mit Löschen-Button
- Farblegende (automatisch generiert: min–max mit 5 Farbstufen)

---

## DoD-Checkliste

- [ ] `npx vitest run src/routes/acoustics.test.ts` → 12+ Tests grün
- [ ] `POST /api/v1/projects/:id/import/acoustics` nimmt CNIVG-Text entgegen → Grid gespeichert
- [ ] `GET /api/v1/acoustic-grids/:id/tiles` → GeoJSON FeatureCollection mit `color`-Property
- [ ] `valueToColor()` Unit-Test: min-Wert → blau, max-Wert → rot
- [ ] `parseCnivg()` Unit-Test: COLS/ROWS korrekt, min/max korrekt
- [ ] Frontend: `AcousticOverlay` rendert in Konva als transparente Layer
- [ ] ROADMAP.md Sprint 55 Status → `done`
- [ ] Commit + PR `feature/sprint-55-raumakustik`
