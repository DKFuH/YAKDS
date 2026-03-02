# Sprint 53 – DWG-Vollimplementierung, SKP-Export & Batch-Export

**Branch:** `feature/sprint-53-dwg-skp`
**Gruppe:** D
**Status:** `done`
**Abhängigkeiten:** S52 (IFC fertig), S19 (DXF-Stubs vorhanden)

---

## Ziel

Bestehende Stubs `interop-cad/dwg-import`, `dwg-export` und `interop-sketchup/skp-export`
vollständig implementieren. Einen einheitlichen `POST /alternatives/:id/export`-Batch-Endpunkt
mit `format`-Parameter einführen. Ergebnis: pCon.planner-Interop-Parität.

---

## Hintergrund zu bestehenden Stubs

Die Stubs existieren im Repo unter:
- `planner-api/src/services/interop/dwgImport.ts` (Stub: `throw new Error('not implemented')`)
- `planner-api/src/services/interop/dwgExport.ts` (Stub)
- `planner-api/src/services/interop/skpExport.ts` (Stub)

Falls diese Dateien nicht vorhanden sind, lege sie neu an.

**DWG-Bibliothek:** `@jscad/dxf` liest DWG/DXF-Format; für DWG-Binary-Parse-Fallback wird
`libredwg` (Node.js-Bindings) genutzt. Da DWG proprietär ist, wird Best-Effort mit `needs_review`-Flag implementiert.

---

## 1. Abhängigkeiten installieren

```bash
cd planner-api
npm install @jscad/io
# libredwg-Binding ist optional; Fallback auf DXF-Parser wenn nicht verfügbar
```

---

## 2. Neue / ersetzte Service-Dateien

### `planner-api/src/services/interop/dwgImport.ts`

```typescript
import { z } from 'zod'

export interface DwgImportResult {
  wall_segments: Array<{ x0_mm: number; y0_mm: number; x1_mm: number; y1_mm: number }>
  needs_review: boolean
  warnings: string[]
}

/**
 * Parst DWG/DXF-Buffer und extrahiert Wand-Linien.
 * DXF-Format: Liest LINE-Entities, die auf Layer "WALLS" oder "Wände" liegen.
 * DWG-Format: Versucht DXF-Extraktion via @jscad/io; setzt needs_review=true.
 */
export async function parseDwgBuffer(buffer: Buffer, filename: string): Promise<DwgImportResult> {
  const warnings: string[] = []
  const isDwg = filename.toLowerCase().endsWith('.dwg')
  let dxfText: string

  if (isDwg) {
    // DWG Binary → DXF-Text-Konvertierung (Best-Effort)
    warnings.push('DWG-Binärformat: Konvertierung nach DXF (Best-Effort, needs_review=true)')
    // Vereinfacht: Prüfe ob ACADVER-Kennung im Header vorkommt
    const header = buffer.subarray(0, 6).toString('ascii')
    if (header !== 'AC1015' && header !== 'AC1018' && header !== 'AC1021' && header !== 'AC1024' && header !== 'AC1027' && header !== 'AC1032') {
      throw new Error('Unbekannte DWG-Version oder kein DWG-Format')
    }
    // Für vollständige DWG-Implementierung: libredwg-Wrapper oder Open Design Alliance SDK nutzen
    // Im Stub: gibt leere Wall-Segments zurück mit needs_review
    return { wall_segments: [], needs_review: true, warnings: [...warnings, 'DWG-Binary-Parse nicht vollständig implementiert – bitte DXF verwenden'] }
  }

  // DXF ASCII-Format
  dxfText = buffer.toString('utf-8')
  const wallSegments: Array<{ x0_mm: number; y0_mm: number; x1_mm: number; y1_mm: number }> = []

  // LINE-Entities aus DXF extrahieren
  // Format: 0\nLINE\n8\n<layer>\n10\n<x1>\n20\n<y1>\n11\n<x2>\n21\n<y2>
  const lineRegex = /\s*0\s*\nLINE\s*\n(?:[\s\S]*?)10\s*\n\s*([\d.+-]+)\s*\n\s*20\s*\n\s*([\d.+-]+)\s*\n(?:[\s\S]*?)11\s*\n\s*([\d.+-]+)\s*\n\s*21\s*\n\s*([\d.+-]+)/gm
  let match: RegExpExecArray | null
  while ((match = lineRegex.exec(dxfText)) !== null) {
    const x0 = parseFloat(match[1])
    const y0 = parseFloat(match[2])
    const x1 = parseFloat(match[3])
    const y1 = parseFloat(match[4])
    if (isNaN(x0) || isNaN(y0) || isNaN(x1) || isNaN(y1)) continue
    // $INSUNITS = 4 → mm (kein Faktor); 6 → m → *1000
    wallSegments.push({
      x0_mm: Math.round(x0),
      y0_mm: Math.round(y0),
      x1_mm: Math.round(x1),
      y1_mm: Math.round(y1),
    })
  }

  if (wallSegments.length === 0) {
    warnings.push('Keine LINE-Entities in DXF gefunden')
  }

  return { wall_segments: wallSegments, needs_review: false, warnings }
}
```

### `planner-api/src/services/interop/dwgExport.ts`

```typescript
export interface DwgExportOptions {
  projectName: string
  wall_segments: Array<{ id: string; x0_mm: number; y0_mm: number; x1_mm: number; y1_mm: number }>
  placements: Array<{ offset_mm: number; width_mm: number; depth_mm: number; wall_id: string }>
}

/**
 * Erstellt DXF ASCII-String (exportiert als .dxf, wird aber auch als .dwg akzeptiert
 * von AutoCAD/LibreCAD da DXF und DWG inhaltlich austauschbar sind).
 * Vollständige DWG-Binary-Generierung erfordert proprietäre Bibliothek.
 */
export function buildDwgBuffer(options: DwgExportOptions): Buffer {
  const lines: string[] = [
    '0\nSECTION',
    '2\nHEADER',
    '9\n$ACADVER',
    '1\nAC1015',
    '9\n$INSUNITS',
    '70\n4',
    '0\nENDSEC',
    '0\nSECTION',
    '2\nENTITIES',
  ]

  // Wand-Linien auf Layer WALLS
  for (const seg of options.wall_segments) {
    lines.push(
      '0\nLINE',
      '8\nWALLS',
      `10\n${seg.x0_mm}`,
      `20\n${seg.y0_mm}`,
      `30\n0`,
      `11\n${seg.x1_mm}`,
      `21\n${seg.y1_mm}`,
      `31\n0`,
    )
  }

  // Möbel-Rechtecke auf Layer FURNITURE
  for (const p of options.placements) {
    const wall = options.wall_segments.find(w => w.id === p.wall_id)
    if (!wall) continue
    const dx = wall.x1_mm - wall.x0_mm
    const dy = wall.y1_mm - wall.y0_mm
    const len = Math.hypot(dx, dy)
    if (len === 0) continue
    const nx = dx / len; const ny = dy / len
    const x = wall.x0_mm + nx * p.offset_mm
    const y = wall.y0_mm + ny * p.offset_mm

    lines.push(
      '0\nSOLID',
      '8\nFURNITURE',
      `10\n${Math.round(x)}`,
      `20\n${Math.round(y)}`,
      `30\n0`,
      `11\n${Math.round(x + nx * p.width_mm)}`,
      `21\n${Math.round(y + ny * p.width_mm)}`,
      `31\n0`,
    )
  }

  lines.push('0\nENDSEC', '0\nEOF')
  return Buffer.from(lines.join('\n'), 'utf-8')
}
```

### `planner-api/src/services/interop/skpExport.ts`

```typescript
/**
 * SKP-Export: SketchUp-Format ist proprietär (Trimble).
 * Vollständige Implementierung erfordert SketchUp SDK oder Community-Bibliothek (sketchup-format).
 *
 * Diese Implementierung exportiert einen SketchUp Ruby-Script (.rb) der beim Öffnen
 * in SketchUp die Geometrie aufbaut. Das ist der pragmatischste Weg ohne Binary-Format-Spec.
 */
export interface SkpExportOptions {
  projectName: string
  wall_segments: Array<{ x0_mm: number; y0_mm: number; x1_mm: number; y1_mm: number }>
  placements: Array<{ offset_mm: number; width_mm: number; depth_mm: number; height_mm?: number }>
  ceiling_height_mm: number
}

export function buildSkpRubyScript(options: SkpExportOptions): string {
  const lines = [
    '# OKP Planner – SketchUp Import Script',
    `# Projekt: ${options.projectName}`,
    '# Ausführen in SketchUp: Extensions > OKP Import oder Ruby-Konsole einfügen',
    '',
    'model = Sketchup.active_model',
    'entities = model.active_entities',
    'model.start_operation("OKP Import", true)',
    '',
    '# Einheit: mm -> Inch (SketchUp intern)',
    'MM2INCH = 0.0393701',
    '',
    '# Wände',
  ]

  for (const seg of options.wall_segments) {
    const h = options.ceiling_height_mm
    lines.push(
      `pts = [`,
      `  Geom::Point3d.new(${seg.x0_mm} * MM2INCH, ${seg.y0_mm} * MM2INCH, 0),`,
      `  Geom::Point3d.new(${seg.x1_mm} * MM2INCH, ${seg.y1_mm} * MM2INCH, 0),`,
      `  Geom::Point3d.new(${seg.x1_mm} * MM2INCH, ${seg.y1_mm} * MM2INCH, ${h} * MM2INCH),`,
      `  Geom::Point3d.new(${seg.x0_mm} * MM2INCH, ${seg.y0_mm} * MM2INCH, ${h} * MM2INCH),`,
      `]`,
      `entities.add_face(pts)`,
    )
  }

  lines.push('', '# Möbel')
  for (const p of options.placements) {
    const h = p.height_mm ?? 720
    lines.push(
      `face = entities.add_face([`,
      `  Geom::Point3d.new(${p.offset_mm} * MM2INCH, 0, 0),`,
      `  Geom::Point3d.new(${p.offset_mm + p.width_mm} * MM2INCH, 0, 0),`,
      `  Geom::Point3d.new(${p.offset_mm + p.width_mm} * MM2INCH, 0, ${h} * MM2INCH),`,
      `  Geom::Point3d.new(${p.offset_mm} * MM2INCH, 0, ${h} * MM2INCH),`,
      `])`,
      `face.pushpull(${p.depth_mm} * MM2INCH) if face`,
    )
  }

  lines.push('', 'model.commit_operation', 'puts "OKP Import fertig"')
  return lines.join('\n')
}
```

---

## 3. Neue Datei: `planner-api/src/routes/cadInterop.ts`

```typescript
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../db.js'
import { sendBadRequest, sendNotFound } from '../errors.js'
import { parseDwgBuffer } from '../services/interop/dwgImport.js'
import { buildDwgBuffer } from '../services/interop/dwgExport.js'
import { buildSkpRubyScript } from '../services/interop/skpExport.js'

const BatchExportQuerySchema = z.object({
  format: z.enum(['dxf', 'dwg', 'gltf', 'ifc', 'all']).default('all'),
})

export async function cadInteropRoutes(app: FastifyInstance) {
  // POST /projects/:id/import/dwg – DWG/DXF-Datei hochladen
  app.post<{ Params: { id: string } }>(
    '/projects/:id/import/dwg',
    { config: { rawBody: true } },
    async (request, reply) => {
      const project = await prisma.project.findUnique({ where: { id: request.params.id } })
      if (!project) return sendNotFound(reply, 'Project not found')

      const ct = request.headers['content-type'] ?? ''
      if (!ct.includes('application/octet-stream')) {
        return sendBadRequest(reply, 'Expected Content-Type: application/octet-stream')
      }

      const buffer = request.rawBody as Buffer
      if (!buffer || buffer.length < 6) return sendBadRequest(reply, 'Empty file')

      const filename = (request.headers['x-filename'] as string | undefined) ?? 'upload.dxf'

      let result
      try {
        result = await parseDwgBuffer(buffer, filename)
      } catch (err) {
        return sendBadRequest(reply, `Parse error: ${String(err)}`)
      }

      if (result.wall_segments.length === 0 && !result.needs_review) {
        return sendBadRequest(reply, 'No wall segments found in file')
      }

      const room = await prisma.room.create({
        data: {
          project_id: request.params.id,
          name: `Importiert aus ${filename}`,
          ceiling_height_mm: 2600,
          boundary: { wall_segments: result.wall_segments },
          placements: [],
        },
      })

      return reply.status(201).send({
        room_id: room.id,
        wall_segments_count: result.wall_segments.length,
        needs_review: result.needs_review,
        warnings: result.warnings,
      })
    },
  )

  // POST /alternatives/:id/export/dwg
  app.post<{ Params: { id: string } }>(
    '/alternatives/:id/export/dwg',
    async (request, reply) => {
      const alternative = await prisma.alternative.findUnique({
        where: { id: request.params.id },
        include: { area: { include: { project: true } } },
      })
      if (!alternative) return sendNotFound(reply, 'Alternative not found')

      const rooms = await prisma.room.findMany({ where: { project_id: alternative.area.project.id } })
      const allSegments: Array<{ id: string; x0_mm: number; y0_mm: number; x1_mm: number; y1_mm: number }> = []
      const allPlacements: Array<{ offset_mm: number; width_mm: number; depth_mm: number; wall_id: string }> = []

      for (const room of rooms) {
        const boundary = room.boundary as { wall_segments?: Array<{ id: string; x0_mm: number; y0_mm: number; x1_mm: number; y1_mm: number }> } | null
        if (boundary?.wall_segments) allSegments.push(...boundary.wall_segments)
        const placements = room.placements as Array<{ wall_id: string; offset_mm: number; width_mm: number; depth_mm: number }> ?? []
        allPlacements.push(...placements)
      }

      const buffer = buildDwgBuffer({
        projectName: alternative.area.project.name,
        wall_segments: allSegments,
        placements: allPlacements,
      })

      reply.header('Content-Type', 'application/dxf')
      reply.header('Content-Disposition', `attachment; filename="alternative-${request.params.id}.dxf"`)
      return reply.send(buffer)
    },
  )

  // POST /alternatives/:id/export/skp – SKP Ruby-Script
  app.post<{ Params: { id: string } }>(
    '/alternatives/:id/export/skp',
    async (request, reply) => {
      const alternative = await prisma.alternative.findUnique({
        where: { id: request.params.id },
        include: { area: { include: { project: true } } },
      })
      if (!alternative) return sendNotFound(reply, 'Alternative not found')

      const rooms = await prisma.room.findMany({ where: { project_id: alternative.area.project.id } })
      const allSegments: Array<{ x0_mm: number; y0_mm: number; x1_mm: number; y1_mm: number }> = []
      const allPlacements: Array<{ offset_mm: number; width_mm: number; depth_mm: number }> = []
      let ceilingHeight = 2600

      for (const room of rooms) {
        ceilingHeight = room.ceiling_height_mm
        const boundary = room.boundary as { wall_segments?: Array<{ x0_mm: number; y0_mm: number; x1_mm: number; y1_mm: number }> } | null
        if (boundary?.wall_segments) allSegments.push(...boundary.wall_segments)
        const placements = room.placements as Array<{ offset_mm: number; width_mm: number; depth_mm: number }> ?? []
        allPlacements.push(...placements)
      }

      const script = buildSkpRubyScript({
        projectName: alternative.area.project.name,
        wall_segments: allSegments,
        placements: allPlacements,
        ceiling_height_mm: ceilingHeight,
      })

      reply.header('Content-Type', 'application/ruby')
      reply.header('Content-Disposition', `attachment; filename="alternative-${request.params.id}.rb"`)
      return reply.send(script)
    },
  )

  // POST /alternatives/:id/export – Batch-Export mit format-Parameter
  app.post<{ Params: { id: string }; Querystring: { format?: string } }>(
    '/alternatives/:id/export',
    async (request, reply) => {
      const parsed = BatchExportQuerySchema.safeParse(request.query)
      if (!parsed.success) return sendBadRequest(reply, 'Invalid format parameter')

      const alternative = await prisma.alternative.findUnique({
        where: { id: request.params.id },
        include: { area: { include: { project: true } } },
      })
      if (!alternative) return sendNotFound(reply, 'Alternative not found')

      const { format } = parsed.data

      // Für 'all': Liste der verfügbaren Download-Links zurückgeben
      if (format === 'all') {
        return reply.send({
          formats: ['dxf', 'dwg', 'gltf', 'ifc', 'skp'],
          urls: {
            dxf: `/api/v1/alternatives/${request.params.id}/export/dxf`,
            dwg: `/api/v1/alternatives/${request.params.id}/export/dwg`,
            gltf: `/api/v1/alternatives/${request.params.id}/export/gltf`,
            ifc: `/api/v1/alternatives/${request.params.id}/export/ifc`,
            skp: `/api/v1/alternatives/${request.params.id}/export/skp`,
          },
        })
      }

      // Single-format: Redirect zum Format-Endpunkt
      return reply.redirect(302, `/api/v1/alternatives/${request.params.id}/export/${format}`)
    },
  )
}
```

---

## 4. `planner-api/src/index.ts`

```typescript
import { cadInteropRoutes } from './routes/cadInterop.js'
await app.register(cadInteropRoutes, { prefix: '/api/v1' })
```

---

## 5. Neue Datei: `planner-api/src/routes/cadInterop.test.ts`

Mindest-Tests (12):

1. `POST /projects/:id/import/dwg` mit DXF-Buffer (ASCII) → 201, wall_segments_count > 0
2. `POST /projects/:id/import/dwg` mit DXF-Buffer ohne LINE-Entities → 400 (keine Wände)
3. `POST /projects/:id/import/dwg` mit leerem Body → 400
4. `POST /projects/:id/import/dwg` mit unbekannter project_id → 404
5. `POST /alternatives/:id/export/dwg` → 200, Content-Type enthält `dxf`
6. `POST /alternatives/:id/export/dwg` – Response-Body enthält `ENTITIES` (DXF-Format)
7. `POST /alternatives/:id/export/dwg` unbekannte alternative_id → 404
8. `POST /alternatives/:id/export/skp` → 200, Content-Type `ruby`
9. `POST /alternatives/:id/export/skp` – Response-Body enthält `Sketchup.active_model`
10. `POST /alternatives/:id/export` mit `?format=dxf` → 302 Redirect
11. `POST /alternatives/:id/export` mit `?format=all` → 200 JSON mit urls-Objekt
12. `POST /alternatives/:id/export` mit `?format=invalid` → 400

### Test-Boilerplate

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'

const mockPrisma = vi.hoisted(() => ({
  project: { findUnique: vi.fn() },
  alternative: { findUnique: vi.fn() },
  room: { findMany: vi.fn(), create: vi.fn() },
}))
vi.mock('../db.js', () => ({ prisma: mockPrisma }))

const DXF_CONTENT = '0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1015\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n0\nLINE\n8\nWALLS\n10\n0\n20\n0\n30\n0\n11\n5000\n21\n0\n31\n0\n0\nENDSEC\n0\nEOF\n'
```

---

## 6. Frontend: `planner-frontend/src/api/cadInterop.ts`

```typescript
export const cadInteropApi = {
  importDwg: async (projectId: string, file: File) => {
    const buffer = await file.arrayBuffer()
    const res = await fetch(`/api/v1/projects/${projectId}/import/dwg`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream', 'X-Filename': file.name },
      body: buffer,
    })
    if (!res.ok) throw new Error(await res.text())
    return res.json()
  },

  exportDwg: (alternativeId: string) =>
    window.open(`/api/v1/alternatives/${alternativeId}/export/dwg`, '_blank'),

  exportSkp: (alternativeId: string) =>
    window.open(`/api/v1/alternatives/${alternativeId}/export/skp`, '_blank'),

  getExportUrls: (alternativeId: string) =>
    fetch(`/api/v1/alternatives/${alternativeId}/export?format=all`, { method: 'POST' }).then(r => r.json()),
}
```

---

## DoD-Checkliste

- [ ] `npx vitest run src/routes/cadInterop.test.ts` → 12+ Tests grün
- [ ] `POST /api/v1/projects/:id/import/dwg` mit DXF-Content → Raum angelegt
- [ ] `POST /api/v1/alternatives/:id/export/dwg` → DXF-Buffer mit ENTITIES-Section
- [ ] `POST /api/v1/alternatives/:id/export/skp` → Ruby-Script mit `Sketchup.active_model`
- [ ] `POST /api/v1/alternatives/:id/export?format=all` → JSON mit urls-Objekt
- [ ] ROADMAP.md Sprint 53 Status → `done`
- [ ] Commit + PR `feature/sprint-53-dwg-skp`
