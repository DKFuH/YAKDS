# ROOM_MODEL.md

## Raummodell – Domänendefinition

**Stand:** Sprint 0

---

## Grundprinzip

Alle Räume sind **Polygone** — kein Sonderfall für Rechtecke.
Platzierungen erfolgen immer relativ zu `wall_id + offset_mm`.
Dachschrägen sind `CeilingConstraints` — keine separate Geometrie.

---

## Kernobjekte

### `Room`

```typescript
interface Room {
  id: string;                      // UUID
  project_id: string;
  name: string;
  boundary: RoomBoundary;
  ceiling_height_mm: number;       // nominelle Raumhöhe (ohne Schrägen)
  ceiling_constraints: CeilingConstraint[];
  openings: Opening[];
  created_at: string;
  updated_at: string;
}
```

---

### `RoomBoundary`

Das Polygon des Raums. Immer geschlossen, gegen den Uhrzeigersinn (CCW).

```typescript
interface RoomBoundary {
  vertices: Vertex[];              // mind. 3, max. 64 Punkte
  wall_segments: WallSegment[];    // automatisch aus Vertices abgeleitet
}
```

**Regel:** `wall_segments[i]` verbindet `vertices[i]` mit `vertices[(i+1) % n]`.

---

### `Vertex`

```typescript
interface Vertex {
  id: string;                      // UUID, stabil
  x_mm: number;                    // Weltkoordinate in mm
  y_mm: number;
  index: number;                   // Position im Polygon
}
```

---

### `WallSegment`

```typescript
interface WallSegment {
  id: string;                      // UUID, stabil — ändert sich nicht beim Vertex-Move
  room_id: string;
  index: number;                   // Reihenfolge im Polygon
  start_vertex_id: string;
  end_vertex_id: string;
  length_mm: number;               // berechnet, nicht gespeichert
  inner_normal: Vector2D;          // zeigt ins Rauminnere
}
```

**Wichtig:** `wall_id` ist stabil. Beim Verschieben eines Vertex bleibt die `wall_id` erhalten.

---

### `Opening`

Türen und Fenster an einer Wand. Immer relativ zur Wand.

```typescript
interface Opening {
  id: string;
  wall_id: string;                 // Referenz auf WallSegment
  type: 'door' | 'window' | 'pass-through';
  offset_mm: number;               // Abstand vom Wandanfang (start_vertex)
  width_mm: number;
  height_mm: number;
  sill_height_mm: number;          // Brüstungshöhe (0 bei Türen)
  source: 'manual' | 'cad_import';
}
```

**Regeln:**
- `offset_mm + width_mm <= wall.length_mm`
- Keine zwei Öffnungen dürfen sich überschneiden
- Objekte dürfen nicht in Öffnungen platziert werden

---

### `CeilingConstraint`

Dachschräge oder sonstige Höheneinschränkung an einer Wand.

```typescript
interface CeilingConstraint {
  id: string;
  room_id: string;
  wall_id: string;                 // Wand, an der die Schräge beginnt
  kniestock_height_mm: number;     // Höhe der Schräge an der Wand
  slope_angle_deg: number;         // Neigungswinkel (0° = flach, 90° = senkrecht)
  depth_into_room_mm: number;      // Tiefe ins Rauminnere bis Schräge endet
}
```

**Berechnung verfügbare Höhe an Punkt `(x, y)`:**
```
d = senkrechter Abstand von (x,y) zur betroffenen Wand
if d >= depth_into_room_mm:
    available_height = ceiling_height_mm  (Schräge endet)
else:
    available_height = kniestock_height_mm + tan(slope_angle_deg) * d
```

Mehrere Constraints: Minimum aller Ergebnisse gilt.

---

## Platzierungsobjekte

### `CabinetInstance`

```typescript
interface CabinetInstance {
  id: string;
  room_id: string;
  catalog_item_id: string;
  wall_id: string;
  offset_mm: number;               // Abstand vom Wandanfang
  width_mm: number;                // kann von Katalogbreite abweichen (Sondermaß)
  height_mm: number;
  depth_mm: number;
  flags: PlacementFlags;
}

interface PlacementFlags {
  requires_customization: boolean;
  height_variant: string | null;   // z.B. "low_version_180cm"
  labor_surcharge: boolean;
  special_trim_needed: boolean;
}
```

---

### `ApplianceInstance`

```typescript
interface ApplianceInstance {
  id: string;
  room_id: string;
  catalog_item_id: string;
  wall_id: string;
  offset_mm: number;
  width_mm: number;
  height_mm: number;
  depth_mm: number;
  flags: PlacementFlags;
}
```

---

### `PlacementResult`

Ergebnis einer Validierung einer Platzierung.

```typescript
interface PlacementResult {
  placement_id: string;
  valid: boolean;
  violations: RuleViolation[];
}
```

---

### `RuleViolation`

```typescript
interface RuleViolation {
  severity: 'error' | 'warning' | 'hint';
  code: RuleCode;
  message: string;
  affected_ids: string[];          // Objekt-IDs
}

type RuleCode =
  | 'OBJECT_OVERLAP'
  | 'OBJECT_OUTSIDE_ROOM'
  | 'OBJECT_BLOCKS_OPENING'
  | 'MIN_CLEARANCE_VIOLATED'
  | 'INVALID_WALL_AREA'
  | 'HEIGHT_EXCEEDED'
  | 'HANGING_CABINET_SLOPE_COLLISION'
  | 'SPECIAL_TRIM_NEEDED'
  | 'SPECIAL_CUT_NEEDED'
  | 'LABOR_SURCHARGE';
```

---

## JSON-Beispiel: Einfacher L-förmiger Raum

```json
{
  "id": "room-001",
  "project_id": "proj-001",
  "name": "Küche EG",
  "ceiling_height_mm": 2500,
  "boundary": {
    "vertices": [
      { "id": "v1", "x_mm": 0,    "y_mm": 0,    "index": 0 },
      { "id": "v2", "x_mm": 5000, "y_mm": 0,    "index": 1 },
      { "id": "v3", "x_mm": 5000, "y_mm": 3000, "index": 2 },
      { "id": "v4", "x_mm": 3000, "y_mm": 3000, "index": 3 },
      { "id": "v5", "x_mm": 3000, "y_mm": 4500, "index": 4 },
      { "id": "v6", "x_mm": 0,    "y_mm": 4500, "index": 5 }
    ],
    "wall_segments": [
      { "id": "wall-1", "index": 0, "start_vertex_id": "v1", "end_vertex_id": "v2" },
      { "id": "wall-2", "index": 1, "start_vertex_id": "v2", "end_vertex_id": "v3" },
      { "id": "wall-3", "index": 2, "start_vertex_id": "v3", "end_vertex_id": "v4" },
      { "id": "wall-4", "index": 3, "start_vertex_id": "v4", "end_vertex_id": "v5" },
      { "id": "wall-5", "index": 4, "start_vertex_id": "v5", "end_vertex_id": "v6" },
      { "id": "wall-6", "index": 5, "start_vertex_id": "v6", "end_vertex_id": "v1" }
    ]
  },
  "ceiling_constraints": [
    {
      "id": "cc-1",
      "wall_id": "wall-6",
      "kniestock_height_mm": 900,
      "slope_angle_deg": 35,
      "depth_into_room_mm": 2200
    }
  ],
  "openings": [
    {
      "id": "op-1",
      "wall_id": "wall-1",
      "type": "door",
      "offset_mm": 800,
      "width_mm": 900,
      "height_mm": 2100,
      "sill_height_mm": 0,
      "source": "manual"
    }
  ]
}
```

---

## Validierungsregeln (Übersicht)

| Regel | Zuständig |
|---|---|
| Polygon geschlossen | Codex |
| Keine Selbstüberschneidung | Codex |
| Mindestkantenlänge 100 mm | Codex |
| Mind. 3, max. 64 Vertices | API (Zod) |
| Öffnung innerhalb Wandgrenzen | Codex |
| Keine überlappenden Öffnungen | Codex |
| Platzierung nicht in Öffnung | Codex |
| Platzierung innerhalb Raum | Codex |
| Keine Objektüberlappung | Codex |
| Höhe vs. CeilingConstraint | Codex |
