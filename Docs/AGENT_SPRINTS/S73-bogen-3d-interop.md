# Sprint 73 - Gebogene Waende in 3D & Interop

**Branch:** `feature/sprint-73-arc-walls-3d-interop`
**Gruppe:** B (startbar nach S71)
**Status:** `done`
**Abhaengigkeiten:** S51 (GLTF), S52 (IFC), S53 (DWG/SKP), S71 (Arc-Walls), S72 (Arc-Bemaßung)

---

## Ziel

Gebogene Waende nicht nur im 2D-Kern, sondern auch in 3D, Export und
Import tragfaehig machen. V1 arbeitet mit segmentierter Approximation,
nicht mit perfekter NURBS-/BRep-Geometrie.

Inspiration: pCon/Chief curved walls, pragmatische CAD-Interop.

---

## 1. Backend / 3D

Neue Datei: `planner-api/src/services/arcWallMesher.ts`

Implementieren:

```ts
export interface ArcMeshOptions {
  max_segment_angle_deg?: number
  wall_height_mm: number
}

export function tessellateArcWall(
  wall: {
    start: { x_mm: number; y_mm: number }
    end: { x_mm: number; y_mm: number }
    center: { x_mm: number; y_mm: number }
    radius_mm: number
    clockwise: boolean
    thickness_mm: number
  },
  options?: ArcMeshOptions,
): {
  footprint: Array<{ x_mm: number; y_mm: number }>
  triangles: number[][]
}
```

Anforderungen:

- GLTF-/3D-Preview nutzt segmentierte Arc-Wall-Meshes
- Segmentzahl deterministisch aus Winkel/Radius ableiten
- bestehende lineare Waende bleiben unveraendert

---

## 2. IFC / CAD / Export

Betroffene Services:

- `ifcEngine.ts`
- `interop/dwgExport.ts`
- `interop/dwgImport.ts`
- `gltfExporter.ts`

V1-Regeln:

- IFC-Export: Arc-Waende als approximierte Polyline/Segmente
- DXF/DWG-Export: wenn moeglich `ARC`, sonst segmentierte `LWPOLYLINE`
- DXF-Import: `ARC`-Entities in Arc-Wall-Segmente uebernehmen
- SKP/GLTF: segmentierte Geometrie akzeptabel

Neue Datei:

- `planner-api/src/services/arcInterop.ts`

---

## 3. Frontend

Anpassungen:

- 3D-Preview zeigt Arc-Waende sauber extrudiert
- Import-Review markiert erkannte Arc-Waende
- Export-Hinweis: segmentierte Genauigkeit bei IFC/DXF konfigurierbar

Optional:

- `ArcWallToleranceSelect` fuer Preview/Export-Qualitaet

---

## 4. Tests

Mindestens:

1. `arcWallMesher.test.ts`: Segmentierung eines Bogens
2. `gltfExporter.test.ts`: Arc-Wall landet im GLTF-Footprint
3. `ifcEngine.test.ts`: Arc-Wall wird exportiert/importiert
4. `cadInterop.test.ts`: DXF-ARC wird erkannt
5. Frontend: 3D-Preview rendert Arc-Wall ohne Crash

---

## 5. DoD

- Arc-Waende erscheinen in 3D-Preview und GLTF-Export
- IFC/DXF/DWG koennen Arc-Waende in V1 zumindest approximiert transportieren
- Import erkennt Arc-Geometrie und mappt sie auf das interne Modell
- Segmentierung ist konfigurierbar, aber deterministisch

---

## 6. Roadmap-Update

- Sprint 73 in `Docs/ROADMAP.md` als `done` markieren
- `Docs/AGENT_SPRINTS/README.md` um Sprint 73 erweitern
