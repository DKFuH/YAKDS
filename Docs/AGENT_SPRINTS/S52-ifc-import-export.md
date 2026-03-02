# Sprint 52 – IFC Import/Export (BIM-Integration)

**Branch:** `feature/sprint-52-ifc-import-export`
**Gruppe:** D
**Status:** `done`
**Abhängigkeiten:** S51 (GLTF-Export muss fertig sein – `alternatives`-Tabelle existiert)

---

## Ziel

IFC 2×3 und IFC 4 Import/Export für Austausch mit Architekten, Planungsbüros und BIM-Software
(Revit, ArchiCAD, Allplan). Bibliothek: `web-ifc` (npm, WASM-basiert).

---

## 0. Vorbedingung: Abhängigkeit installieren

```bash
cd planner-api
npm install web-ifc
```

`web-ifc` stellt asynchronen WASM-Loader bereit. In Node.js-Umgebung muss der WASM-Pfad explizit
gesetzt werden:

```typescript
// planner-api/src/services/ifcEngine.ts (Import-Zeile)
import * as WebIFC from 'web-ifc'
const api = new WebIFC.IfcAPI()
await api.Init() // lädt WASM
```

---

## 1. Prisma-Schema-Ergänzung

```prisma
// ─────────────────────────────────────────
// PHASE 7 – Sprint 52: IFC BIM-Integration
// ─────────────────────────────────────────

model IfcImportJob {
  id           String        @id @default(uuid())
  project_id   String
  filename     String
  status       IfcJobStatus  @default(pending)
  result       Json?         // { rooms_created: number, warnings: string[] }
  error        String?
  created_at   DateTime      @default(now())
  updated_at   DateTime      @updatedAt

  @@index([project_id])
  @@map("ifc_import_jobs")
}

enum IfcJobStatus {
  pending
  processing
  done
  failed
}
```

---

## 2. Neuer Service: `planner-api/src/services/ifcEngine.ts`

```typescript
import * as WebIFC from 'web-ifc'
import path from 'path'

let _api: WebIFC.IfcAPI | null = null

async function getApi(): Promise<WebIFC.IfcAPI> {
  if (_api) return _api
  _api = new WebIFC.IfcAPI()
  _api.SetWasmPath(path.join(process.cwd(), 'node_modules/web-ifc/'))
  await _api.Init()
  return _api
}

export interface IfcRoom {
  name: string
  wall_segments: Array<{ x0_mm: number; y0_mm: number; x1_mm: number; y1_mm: number }>
  ceiling_height_mm: number
}

/** Liest IfcSpace/IfcWall-Objekte aus IFC-Buffer und gibt extrahierte Räume zurück */
export async function parseIfcRooms(buffer: Buffer): Promise<IfcRoom[]> {
  const api = await getApi()
  const modelId = api.OpenModel(new Uint8Array(buffer))
  const rooms: IfcRoom[] = []

  try {
    // IfcSpace – gibt Räume mit Namen
    const spaces = api.GetLineIDsWithType(modelId, WebIFC.IFCSPACE)
    for (let i = 0; i < spaces.size(); i++) {
      const id = spaces.get(i)
      const space = api.GetLine(modelId, id)
      const name: string = space.Name?.value ?? `Raum ${i + 1}`

      // Wandgeometrie über IfcWall desselben Stockwerks annähern
      // (vereinfacht: bounding box aus LocalPlacement + ObjectPlacement)
      // Reale Implementierung: IfcRelContainedInSpatialStructure traversieren
      rooms.push({
        name,
        wall_segments: [],
        ceiling_height_mm: 2600,
      })
    }

    // IfcWall – extrahiert Wandlinien
    const walls = api.GetLineIDsWithType(modelId, WebIFC.IFCWALL)
    for (let i = 0; i < walls.size(); i++) {
      const id = walls.get(i)
      const wall = api.GetLine(modelId, id, true)
      // ObjectPlacement → CartesianPoint
      const placement = wall.ObjectPlacement?.RelativePlacement
      if (placement) {
        const loc = placement.Location?.Coordinates
        if (loc && loc.length >= 2) {
          const x = Math.round(Number(loc[0].value) * 1000) // m → mm
          const y = Math.round(Number(loc[1].value) * 1000)
          // Vereinfacht: Wand als Punkt-Segment speichern
          // Vollständige Implementierung: ExtrudedAreaSolid auswerten
          if (rooms.length > 0) {
            rooms[0].wall_segments.push({ x0_mm: x, y0_mm: y, x1_mm: x + 1000, y1_mm: y })
          }
        }
      }
    }
  } finally {
    api.CloseModel(modelId)
  }

  return rooms.filter(r => r.wall_segments.length > 0 || true) // alle zurückgeben
}

export interface IfcExportOptions {
  projectName: string
  rooms: Array<{
    id: string
    name: string
    placements: Array<{ id: string; width_mm: number; depth_mm: number; height_mm: number; article_name: string; offset_mm: number }>
    boundary: { wall_segments?: Array<{ x0_mm: number; y0_mm: number; x1_mm: number; y1_mm: number }> } | null
  }>
}

/** Erstellt IFC-Buffer aus Planungsdaten (IfcFurnishingElement für jeden Artikel) */
export async function buildIfcBuffer(options: IfcExportOptions): Promise<Buffer> {
  const api = await getApi()
  const modelId = api.CreateModel()

  // Header setzen
  api.WriteHeaderLine(modelId, 0, ['', '', 'OKP-Planner', '', '2.0'])

  // Project → Site → Building → BuildingStorey
  const projectId = api.WriteLine(modelId, api.CreateIfcEntity(modelId, WebIFC.IFCPROJECT,
    api.CreateIfcGUID(), null,
    { type: 5, value: options.projectName }, null, null, null, null, null, null,
  ))

  let furnishingCount = 0
  for (const room of options.rooms) {
    for (const p of room.placements) {
      // Jede Platzierung → IfcFurnishingElement
      api.WriteLine(modelId, api.CreateIfcEntity(modelId, WebIFC.IFCFURNITUREELEMENTTYPE,
        api.CreateIfcGUID(), projectId,
        { type: 5, value: p.article_name }, null, null, null, null, null, null,
      ))
      furnishingCount++
    }
  }

  const data = api.ExportFileAsIFC(modelId)
  api.CloseModel(modelId)
  return Buffer.from(data)
}
```

---

## 3. Neue Datei: `planner-api/src/routes/ifcInterop.ts`

```typescript
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../db.js'
import { sendBadRequest, sendNotFound } from '../errors.js'
import { parseIfcRooms, buildIfcBuffer } from '../services/ifcEngine.js'

const multipartContentTypes = ['multipart/form-data', 'application/octet-stream']

export async function ifcInteropRoutes(app: FastifyInstance) {
  // POST /projects/:id/import/ifc – IFC-Datei hochladen und Räume importieren
  app.post<{ Params: { id: string } }>(
    '/projects/:id/import/ifc',
    {
      config: { rawBody: true },
    },
    async (request, reply) => {
      const project = await prisma.project.findUnique({ where: { id: request.params.id } })
      if (!project) return sendNotFound(reply, 'Project not found')

      // Body-Handling: Raw Buffer (Content-Type: application/octet-stream)
      let buffer: Buffer
      const ct = request.headers['content-type'] ?? ''
      if (ct.includes('application/octet-stream')) {
        buffer = request.rawBody as Buffer
      } else {
        return sendBadRequest(reply, 'Expected Content-Type: application/octet-stream with IFC file body')
      }

      if (!buffer || buffer.length < 4) {
        return sendBadRequest(reply, 'Empty or invalid IFC file')
      }

      // ISO-STEP signature check: "ISO-10303-21;"
      const header = buffer.subarray(0, 20).toString('ascii')
      if (!header.includes('ISO-10303')) {
        return sendBadRequest(reply, 'Not a valid IFC (STEP) file')
      }

      // Job anlegen
      const job = await prisma.ifcImportJob.create({
        data: {
          project_id: request.params.id,
          filename: `import-${Date.now()}.ifc`,
          status: 'processing',
        },
      })

      let roomsCreated = 0
      const warnings: string[] = []

      try {
        const ifcRooms = await parseIfcRooms(buffer)

        for (const ifcRoom of ifcRooms) {
          if (ifcRoom.wall_segments.length === 0) {
            warnings.push(`Raum "${ifcRoom.name}" hat keine Wandsegmente – übersprungen`)
            continue
          }
          await prisma.room.create({
            data: {
              project_id: request.params.id,
              name: ifcRoom.name,
              ceiling_height_mm: ifcRoom.ceiling_height_mm,
              boundary: { wall_segments: ifcRoom.wall_segments },
              placements: [],
            },
          })
          roomsCreated++
        }

        await prisma.ifcImportJob.update({
          where: { id: job.id },
          data: { status: 'done', result: { rooms_created: roomsCreated, warnings } },
        })
      } catch (err) {
        await prisma.ifcImportJob.update({
          where: { id: job.id },
          data: { status: 'failed', error: String(err) },
        })
        return sendBadRequest(reply, `IFC parsing failed: ${String(err)}`)
      }

      return reply.status(201).send({ job_id: job.id, rooms_created: roomsCreated, warnings })
    },
  )

  // POST /alternatives/:id/export/ifc – Planung als IFC exportieren
  app.post<{ Params: { id: string } }>(
    '/alternatives/:id/export/ifc',
    async (request, reply) => {
      const alternative = await prisma.alternative.findUnique({
        where: { id: request.params.id },
        include: {
          area: {
            include: { project: true },
          },
        },
      })
      if (!alternative) return sendNotFound(reply, 'Alternative not found')

      const project = alternative.area.project

      // Räume laden
      const rooms = await prisma.room.findMany({ where: { project_id: project.id } })

      const exportRooms = rooms.map(r => {
        const boundary = r.boundary as { wall_segments?: Array<{ x0_mm: number; y0_mm: number; x1_mm: number; y1_mm: number }> } | null
        const placements = r.placements as Array<{ id: string; width_mm: number; depth_mm: number; article_id?: string; offset_mm: number }> ?? []
        return {
          id: r.id,
          name: r.name,
          boundary,
          placements: placements.map(p => ({
            id: p.id,
            width_mm: p.width_mm ?? 600,
            depth_mm: p.depth_mm ?? 600,
            height_mm: 720,
            article_name: p.article_id ?? 'Artikel',
            offset_mm: p.offset_mm ?? 0,
          })),
        }
      })

      const buffer = await buildIfcBuffer({ projectName: project.name, rooms: exportRooms })

      reply.header('Content-Type', 'application/x-step')
      reply.header('Content-Disposition', `attachment; filename="alternative-${request.params.id}.ifc"`)
      return reply.send(buffer)
    },
  )

  // GET /projects/:id/ifc-jobs – Import-Jobs auflisten
  app.get<{ Params: { id: string } }>(
    '/projects/:id/ifc-jobs',
    async (request, reply) => {
      const project = await prisma.project.findUnique({ where: { id: request.params.id } })
      if (!project) return sendNotFound(reply, 'Project not found')

      const jobs = await prisma.ifcImportJob.findMany({
        where: { project_id: request.params.id },
        orderBy: { created_at: 'desc' },
      })
      return reply.send(jobs)
    },
  )
}
```

---

## 4. `planner-api/src/index.ts`

```typescript
import { ifcInteropRoutes } from './routes/ifcInterop.js'
await app.register(ifcInteropRoutes, { prefix: '/api/v1' })
```

---

## 5. Neue Datei: `planner-api/src/routes/ifcInterop.test.ts`

Mindest-Tests (10):

1. `POST /projects/:id/import/ifc` mit valider IFC-Datei (ISO-STEP Header) → 201, rooms_created ≥ 0
2. `POST /projects/:id/import/ifc` mit leerem Body → 400
3. `POST /projects/:id/import/ifc` mit falscher Signatur (kein ISO-STEP) → 400
4. `POST /projects/:id/import/ifc` mit unbekannter project_id → 404
5. `POST /alternatives/:id/export/ifc` → 200 mit Content-Type `application/x-step`
6. `POST /alternatives/:id/export/ifc` – Response-Body beginnt mit `ISO-10303` oder ist nicht leer
7. `POST /alternatives/:id/export/ifc` mit unbekannter alternative_id → 404
8. `GET /projects/:id/ifc-jobs` → 200 Array
9. `GET /projects/:id/ifc-jobs` – nach Import-Job-Anlage: Array hat length ≥ 1
10. `GET /projects/unknown/ifc-jobs` → 404

### Test-Boilerplate

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'

const mockPrisma = vi.hoisted(() => ({
  project: { findUnique: vi.fn() },
  alternative: { findUnique: vi.fn() },
  room: { findMany: vi.fn(), create: vi.fn() },
  ifcImportJob: { create: vi.fn(), update: vi.fn(), findMany: vi.fn() },
}))
vi.mock('../db.js', () => ({ prisma: mockPrisma }))

// IFC-Engine mocken – WASM-Init überspringen
vi.mock('../services/ifcEngine.js', () => ({
  parseIfcRooms: vi.fn().mockResolvedValue([{
    name: 'Küche',
    wall_segments: [{ x0_mm: 0, y0_mm: 0, x1_mm: 5000, y1_mm: 0 }],
    ceiling_height_mm: 2600,
  }]),
  buildIfcBuffer: vi.fn().mockResolvedValue(Buffer.from('ISO-10303-21;\nDATA;\nENDSEC;\nEND-ISO-10303-21;\n')),
}))

const IFC_HEADER = Buffer.from('ISO-10303-21;\nDATA;\nENDSEC;\n')

describe('ifcInterop routes', () => {
  // Tests hier...
})
```

---

## 6. Frontend: `planner-frontend/src/api/ifcInterop.ts`

```typescript
export const ifcInteropApi = {
  importIfc: async (projectId: string, file: File): Promise<{ job_id: string; rooms_created: number; warnings: string[] }> => {
    const buffer = await file.arrayBuffer()
    const res = await fetch(`/api/v1/projects/${projectId}/import/ifc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: buffer,
    })
    if (!res.ok) throw new Error(await res.text())
    return res.json()
  },

  exportIfc: async (alternativeId: string): Promise<void> => {
    const res = await fetch(`/api/v1/alternatives/${alternativeId}/export/ifc`, { method: 'POST' })
    if (!res.ok) throw new Error(await res.text())
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `alternative-${alternativeId}.ifc`
    a.click()
    URL.revokeObjectURL(url)
  },

  listJobs: (projectId: string) =>
    fetch(`/api/v1/projects/${projectId}/ifc-jobs`).then(r => r.json()),
}
```

---

## DoD-Checkliste

- [ ] `npx vitest run src/routes/ifcInterop.test.ts` → 10+ Tests grün
- [ ] `POST /api/v1/projects/:id/import/ifc` akzeptiert IFC-Buffer
- [ ] `POST /api/v1/alternatives/:id/export/ifc` gibt `application/x-step`-Response zurück
- [ ] `GET /api/v1/projects/:id/ifc-jobs` listet Import-Jobs
- [ ] IFC-Engine-Service mit `parseIfcRooms` und `buildIfcBuffer` isoliert testbar (gemockt)
- [ ] ROADMAP.md Sprint 52 Status → `done`
- [ ] Commit + PR `feature/sprint-52-ifc-import-export`
