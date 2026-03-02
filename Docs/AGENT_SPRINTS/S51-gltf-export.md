# Sprint 51 – GLTF/GLB Export & 3D-Render-Pipeline

**Branch:** `feature/sprint-51-gltf-export`
**Gruppe:** A (sofort startbar – neues Paket, kein DB-Konflikt)
**Status:** `done`

---

## Ziel

Planung (Schränke, Wände) als `.glb` exportieren. Neues interop-Paket + API-Endpunkt.

---

## Kontext

- `planner-api/src/routes/exports.ts` – bestehende Export-Routen (DXF, JSON)
- `shared-schemas/` – enthält Geometry-Typen
- Paket `three` ist bereits in `planner-frontend` vorhanden; für den API-Service müssen wir es in `planner-api` installieren

---

## 1. Neue Abhängigkeit in `planner-api/package.json`

```bash
npm install three @types/three --save --prefix planner-api
```

Alternativ manuell in `planner-api/package.json` unter `dependencies` eintragen:
```json
"three": "^0.171.0"
```

---

## 2. Neue Datei: `planner-api/src/services/gltfExporter.ts`

```typescript
import * as THREE from 'three'
// @ts-ignore – GLTFExporter hat kein offizielles ESM-Export in manchen Three-Versionen
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'

export interface PlacedObject {
  id: string
  wall_id: string
  offset_mm: number
  width_mm: number
  depth_mm: number
  height_mm?: number
  label?: string
}

export interface WallSegment {
  id: string
  x0_mm: number; y0_mm: number
  x1_mm: number; y1_mm: number
}

export interface GltfExportInput {
  walls: WallSegment[]
  placements: PlacedObject[]
  room_height_mm?: number
}

const MM_TO_M = 0.001

export async function exportToGlb(input: GltfExportInput): Promise<Buffer> {
  const scene = new THREE.Scene()
  const roomHeight = (input.room_height_mm ?? 2500) * MM_TO_M

  // Wände als dünne Boxen
  for (const wall of input.walls) {
    const dx = (wall.x1_mm - wall.x0_mm) * MM_TO_M
    const dy = (wall.y1_mm - wall.y0_mm) * MM_TO_M
    const length = Math.hypot(dx, dy)
    if (length < 0.001) continue

    const wallThickness = 0.1 // 100 mm
    const geo = new THREE.BoxGeometry(length, roomHeight, wallThickness)
    const mat = new THREE.MeshStandardMaterial({ color: 0xcccccc })
    const mesh = new THREE.Mesh(geo, mat)

    const mx = ((wall.x0_mm + wall.x1_mm) / 2) * MM_TO_M
    const my = ((wall.y0_mm + wall.y1_mm) / 2) * MM_TO_M
    mesh.position.set(mx, roomHeight / 2, my)
    mesh.rotation.y = -Math.atan2(dy, dx)
    mesh.name = `wall_${wall.id}`
    scene.add(mesh)
  }

  // Platzierungen als Boxen
  for (const p of input.placements) {
    const w = p.width_mm * MM_TO_M
    const d = p.depth_mm * MM_TO_M
    const h = (p.height_mm ?? 720) * MM_TO_M

    const geo = new THREE.BoxGeometry(w, h, d)
    const mat = new THREE.MeshStandardMaterial({ color: 0x8B4513 })
    const mesh = new THREE.Mesh(geo, mat)

    // Vereinfachte Positionierung: Offset entlang X-Achse
    mesh.position.set(p.offset_mm * MM_TO_M + w / 2, h / 2, d / 2)
    mesh.name = p.label ?? `placement_${p.id}`
    scene.add(mesh)
  }

  // Ambient + directional light
  scene.add(new THREE.AmbientLight(0xffffff, 0.8))
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.5)
  dirLight.position.set(5, 10, 5)
  scene.add(dirLight)

  // Export
  return new Promise((resolve, reject) => {
    const exporter = new GLTFExporter()
    exporter.parse(
      scene,
      (result) => {
        if (result instanceof ArrayBuffer) {
          resolve(Buffer.from(result))
        } else {
          resolve(Buffer.from(JSON.stringify(result)))
        }
      },
      (error) => reject(error),
      { binary: true },
    )
  })
}
```

---

## 3. Erweiterung: `planner-api/src/routes/exports.ts`

Lese die bestehende Datei und füge am Ende der Route-Funktion hinzu:

```typescript
// GLTF/GLB Export
app.post<{ Params: { id: string } }>('/alternatives/:id/export/gltf', async (request, reply) => {
  const { exportToGlb } = await import('../services/gltfExporter.js')

  // Alternative-Daten holen (rooms.placements + rooms.boundary aus Area-Alternative)
  const area = await prisma.area.findFirst({
    where: { alternatives: { some: { id: request.params.id } } },
    include: { alternatives: { where: { id: request.params.id } } },
  })

  if (!area) {
    return sendNotFound(reply, 'Alternative not found')
  }

  // Raum-Daten laden (aus project)
  const project = await prisma.project.findFirst({
    where: { areas: { some: { id: area.id } } },
    include: { rooms: { take: 1 } },
  })

  const room = project?.rooms[0]
  const boundary = room?.boundary as { wall_segments?: Array<{ id: string; x0_mm: number; y0_mm: number; x1_mm: number; y1_mm: number }> } | null
  const placements = room?.placements as Array<{ id: string; wall_id: string; offset_mm: number; width_mm: number; depth_mm: number }> | null

  const glbBuffer = await exportToGlb({
    walls: boundary?.wall_segments ?? [],
    placements: placements ?? [],
    room_height_mm: room?.ceiling_height_mm ?? 2500,
  })

  reply.header('Content-Type', 'model/gltf-binary')
  reply.header('Content-Disposition', `attachment; filename="alternative-${request.params.id}.glb"`)
  return reply.send(glbBuffer)
})
```

Importiere `sendNotFound` falls noch nicht vorhanden.

---

## 4. Neue Datei: `planner-api/src/services/gltfExporter.test.ts`

```typescript
import { describe, expect, it } from 'vitest'
import { exportToGlb } from './gltfExporter.js'

describe('gltfExporter', () => {
  it('exports empty scene as GLB buffer', async () => {
    const result = await exportToGlb({ walls: [], placements: [] })
    expect(result).toBeInstanceOf(Buffer)
    expect(result.length).toBeGreaterThan(0)
    // GLB magic bytes: 0x46546C67 = "glTF"
    expect(result.readUInt32LE(0)).toBe(0x46546C67)
  })

  it('exports walls as GLB', async () => {
    const result = await exportToGlb({
      walls: [
        { id: 'w1', x0_mm: 0, y0_mm: 0, x1_mm: 4000, y1_mm: 0 },
        { id: 'w2', x0_mm: 4000, y0_mm: 0, x1_mm: 4000, y1_mm: 3000 },
      ],
      placements: [],
    })
    expect(result).toBeInstanceOf(Buffer)
    expect(result.length).toBeGreaterThan(100)
  })

  it('exports placements as GLB', async () => {
    const result = await exportToGlb({
      walls: [],
      placements: [
        { id: 'p1', wall_id: 'w1', offset_mm: 0, width_mm: 600, depth_mm: 600, height_mm: 720, label: 'Unterschrank' },
      ],
    })
    expect(result).toBeInstanceOf(Buffer)
  })

  it('handles zero-length walls gracefully', async () => {
    const result = await exportToGlb({
      walls: [{ id: 'w1', x0_mm: 100, y0_mm: 100, x1_mm: 100, y1_mm: 100 }],
      placements: [],
    })
    expect(result).toBeInstanceOf(Buffer)
  })

  it('respects custom room height', async () => {
    const result = await exportToGlb({
      walls: [{ id: 'w1', x0_mm: 0, y0_mm: 0, x1_mm: 5000, y1_mm: 0 }],
      placements: [],
      room_height_mm: 3000,
    })
    expect(result).toBeInstanceOf(Buffer)
  })
})
```

---

## 5. Frontend: Download-Button in Editor

In `planner-frontend/src/pages/Editor.tsx` (oder der zugehörigen Toolbar-Komponente):

Füge einen „GLB Export"-Button in der Topbar hinzu, der `GET /api/v1/alternatives/:id/export/gltf` aufruft und die Datei herunterlädt:

```typescript
async function handleGltfExport(alternativeId: string) {
  const response = await fetch(`/api/v1/alternatives/${alternativeId}/export/gltf`, {
    method: 'POST',
  })
  if (!response.ok) { alert('Export fehlgeschlagen'); return }
  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = `planung-${alternativeId}.glb`; a.click()
  URL.revokeObjectURL(url)
}
```

---

## DoD-Checkliste

- [ ] `npm install three @types/three` in `planner-api` erfolgreich
- [ ] `npx vitest run src/services/gltfExporter.test.ts` → 5 Tests grün
- [ ] GLB-Buffer enthält korrekte Magic Bytes (0x46546C67)
- [ ] `POST /api/v1/alternatives/:id/export/gltf` gibt `model/gltf-binary` zurück
- [ ] ROADMAP.md Sprint 51 Status → `done`
- [ ] Commit + PR `feature/sprint-51-gltf-export`
