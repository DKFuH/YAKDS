# Sprint 71 - Gebogene Waende im 2D-Kern

**Branch:** `feature/sprint-71-arc-walls-core`
**Gruppe:** A (startbar nach S63)
**Status:** `done`
**Abhaengigkeiten:** S56 (Canvas-UX), S57 (WallAttachments), S63 (Centerlines)

---

## Ziel

Gebogene Waende als echten Geometrietyp im 2D-Kern einfuehren. V1 fokussiert
auf Editor, Raumgeometrie, Snap-Verhalten und einfache Oeffnungen auf Boegen.
3D, Layout-Bemaßung und Interop folgen bewusst erst in den Folgesprints.

Inspiration: pCon.planner Arc Walls, Chief Architect Curved Walls.

---

## 1. Datenmodell

Bestehende Wall-/Room-Geometrie um Arc-Segmente erweitern.

Falls Wandssegmente aktuell JSON-basiert gespeichert werden, neue Form:

```json
{
  "id": "wall-arc-1",
  "kind": "arc",
  "start": { "x_mm": 0, "y_mm": 0 },
  "end": { "x_mm": 3200, "y_mm": 0 },
  "center": { "x_mm": 1600, "y_mm": -1400 },
  "radius_mm": 2126,
  "clockwise": true,
  "thickness_mm": 100
}
```

Falls Prisma-Modelle fuer Waende existieren, minimal noetige Felder:

```prisma
enum WallGeometryKind {
  line
  arc
}
```

und Zusatzfelder fuer `center_x_mm`, `center_y_mm`, `radius_mm`, `clockwise`.

Migration:

- Arc-Felder nullable einfuehren
- Bestehende lineare Waende unveraendert kompatibel halten

---

## 2. Backend-Geometrie

Neue Datei: `planner-api/src/services/arcWallGeometry.ts`

Implementieren:

```ts
export interface ArcWallSegment {
  id: string
  kind: 'arc'
  start: { x_mm: number; y_mm: number }
  end: { x_mm: number; y_mm: number }
  center: { x_mm: number; y_mm: number }
  radius_mm: number
  clockwise: boolean
  thickness_mm?: number
}

export function arcLengthMm(wall: ArcWallSegment): number
export function pointOnArc(wall: ArcWallSegment, t: number): { x_mm: number; y_mm: number }
export function nearestPointOnArc(wall: ArcWallSegment, point: { x_mm: number; y_mm: number }): { x_mm: number; y_mm: number; t: number }
export function offsetArc(wall: ArcWallSegment, offsetMm: number): ArcWallSegment
```

Raum- und Wandlogik anpassen:

- Raumumfang und Flaechenberechnung koennen Arc-Segmente approximieren
- Oeffnungen erhalten `wall_offset_mm` auch fuer Boegen
- Snap-Logik erkennt Start, Ende, Mittelpunkt und Tangentenrichtung

---

## 3. API

Betroffene Routen:

- `rooms.ts`
- `walls.ts`
- `openings.ts`

Anforderungen:

- Arc-Waende koennen gespeichert und geladen werden
- Validation erlaubt `kind: 'arc'`
- Oeffnungen auf Arc-Waenden speichern ihre Position entlang der Bogenlaenge

---

## 4. Frontend

Anpassungen:

- `PolygonEditor.tsx`: Arc-Wall-Erstellung und Radius-Handle
- `CanvasArea.tsx`: Bogenrendering, Mittelpunkt-Handle, Tangenten-Snapping
- `RightSidebar.tsx`: Wall-Inspector mit Radius, Mittelpunkt, Richtung

UX V1:

- Line/Arc Toggle im Wandmodus
- bestehende zwei Endpunkte setzen
- dritter Handle oder Radius-Wert definiert Kruemmung
- Arc kann wieder in Linie umgewandelt werden

---

## 5. Tests

Mindestens:

1. `arcWallGeometry.test.ts`: Laenge eines Bogens
2. `arcWallGeometry.test.ts`: `pointOnArc()` und `nearestPointOnArc()`
3. `walls.test.ts`: Arc-Wall speichern/laden
4. `openings.test.ts`: Oeffnung auf Arc-Wall mit Offset
5. Frontend: Arc-Wall kann erstellt und verschoben werden

---

## 6. DoD

- Arc-Waende existieren als eigener Geometrietyp im Editor
- Arc-Waende werden serverseitig validiert und persistiert
- Raumgeometrie bleibt mit gemischten line/arc-Waenden stabil
- Oeffnungen koennen auf Arc-Waenden sitzen
- Keine Regression fuer lineare Waende

---

## 7. Roadmap-Update

- Sprint 71 in `Docs/ROADMAP.md` als `planned` aufnehmen
- `Docs/AGENT_SPRINTS/README.md` um Sprint 71 erweitern
