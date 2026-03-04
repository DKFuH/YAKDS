# Sprint 72 - Bogen-Bemassung & Layout-Ansichten

**Branch:** `feature/sprint-72-arc-dimensions-layout`
**Gruppe:** B (startbar nach S71)
**Status:** `done`
**Abhaengigkeiten:** S59 (Bemaßung), S64 (Layout-Sheets), S67 (Annotative Styles), S71 (Arc-Walls)

---

## Ziel

Gebogene Waende in Bemaßung, Zeichnungsblaettern und Detailansichten
professionell darstellen: Radius, Bogenlaenge, Winkel und Sehnenmass.

Inspiration: klassische CAD-Bogenbemaßung, Detail- und Schnittansichten.

---

## 1. Datenmodell

Bestehende `DimensionType`-Logik erweitern:

```prisma
enum DimensionType {
  linear
  angular
  radial
  arc_length
  chord
}
```

Falls `LayoutView` Konfigurationen bestehen, Zusatz:

```json
{
  "show_arc_annotations": true,
  "arc_dimension_style": "radius-first"
}
```

---

## 2. Backend

Neue Datei: `planner-api/src/services/arcDimensionResolver.ts`

Implementieren:

```ts
export function resolveArcRadiusLabel(radiusMm: number): string
export function resolveArcLengthLabel(lengthMm: number): string
export function resolveArcAngleDeg(startRad: number, endRad: number, clockwise: boolean): number
export function buildArcDimensionGeometry(...args: unknown[]): {
  leader_points: Array<{ x_mm: number; y_mm: number }>
  label_point: { x_mm: number; y_mm: number }
}
```

Betroffene Bereiche:

- `dimensions.ts`: neue Dimension-Typen speichern/rendern
- `layoutSheets.ts` / `layout view` Rendering: Arc-Annotations in Floorplan/Detail/Schnitt
- Elevation-/Section-Generator soll Arc-Waende als Segmente approximieren statt zu ignorieren

---

## 3. API

Erweiterungen:

- `POST /rooms/:id/dimensions` fuer `radial`, `arc_length`, `chord`
- `POST /rooms/:id/dimensions/auto-chain?include_arcs=true`
- `GET /layout-sheets/:id/render-svg` gibt Arc-Bemaßung mit aus

---

## 4. Frontend

Anpassungen:

- `PolygonEditor.tsx`: Radius- und Bogenlaengen-Bemaßung erzeugen
- `CanvasArea.tsx`: Arc-Dim-Layer
- `LayoutSheetsPage.tsx`: Arc-Annotation Toggle

UX:

- Arc-Wall anklicken -> Schnellaktionen `Radius`, `Bogenlaenge`, `Sehne`
- annotative Styles aus S67 auch fuer Arc-Masse verwenden

---

## 5. Tests

Mindestens:

1. `arcDimensionResolver.test.ts`: Radius-/Bogenlaengenlabel korrekt
2. `dimensions.test.ts`: `radial` und `arc_length` CRUD
3. `dimensions.test.ts`: `auto-chain?include_arcs=true` erzeugt Arc-Masse
4. `layoutSheets.test.ts`: SVG-Render enthaelt Arc-Annotationen
5. Frontend: Arc-Mass kann angelegt und angezeigt werden

---

## 6. DoD

- Gebogene Waende koennen radial und als Bogenlaenge bemaßt werden
- Layout-Sheets und Detailansichten rendern Arc-Annotations lesbar
- Auto-Chain kann Arc-Segmente optional mit aufnehmen
- Annotative Styles bleiben fuer Arc-Masse konsistent

---

## 7. Roadmap-Update

- Sprint 72 in `Docs/ROADMAP.md` als `planned` aufnehmen
- `Docs/AGENT_SPRINTS/README.md` um Sprint 72 erweitern
