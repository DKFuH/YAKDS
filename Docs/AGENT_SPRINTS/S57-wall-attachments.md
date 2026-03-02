# Sprint 57 – Erweiterte Wandobjekte (WallAttachments)

**Branch:** `feature/sprint-57-wall-attachments`
**Gruppe:** B (parallel zu anderen Gruppe-B-Sprints – nur Enum-Extension, kein Tabellenkonflikt)
**Status:** `done`

---

## Ziel

`Opening`-Typen um `radiator`, `socket`, `switch`, `niche`, `pipe`, `custom` erweitern;
2D-Symbole pro Typ in PolygonEditor; Tiefenversatz für Abstands-Guard.

---

## 1. Prisma-Schema-Änderung

In `planner-api/prisma/schema.prisma`:

Die `openings`-Tabelle speichert `type` als String in JSON. Es gibt **kein Prisma-Enum** dafür
(Openings sind als JSON in `rooms.openings` gespeichert, nicht als eigene Tabelle mit Enum).

Prüfe `planner-api/src/routes/openings.ts` – die `type`-Validierung erfolgt via Zod.

**Ändere in `openings.ts` die Zod-Enum-Definition:**

```typescript
// Vorher:
const openingTypeValues = ['door', 'window', 'pass-through'] as const

// Nachher:
const openingTypeValues = [
  'door', 'window', 'pass-through',
  'radiator', 'socket', 'switch', 'niche', 'pipe', 'custom'
] as const
```

Außerdem: Füge optionales Feld `wall_offset_depth_mm` zum Opening-Schema hinzu:

```typescript
// In der Opening-Zod-Schema-Definition:
wall_offset_depth_mm: z.number().int().min(0).max(2000).nullable().optional(),
```

Kein Prisma-Migration notwendig – Openings werden als JSON gespeichert.

---

## 2. `planner-api/src/routes/openings.ts` – Update

Lese die Datei. Suche nach dem Zod-Schema für Opening-Typen.
Ändere:
1. `openingTypeValues` Array um die 6 neuen Typen erweitern (siehe oben)
2. Create/Update-Schema um `wall_offset_depth_mm` Feld erweitern

---

## 3. Frontend-Typen: `planner-frontend/src/api/openings.ts`

Lese die Datei. Suche nach dem `Opening`-Interface/Type.
Erweitere den `type`-Typ:
```typescript
type: 'door' | 'window' | 'pass-through' | 'radiator' | 'socket' | 'switch' | 'niche' | 'pipe' | 'custom'
```

Füge `wall_offset_depth_mm?: number | null` zum Interface hinzu.

---

## 4. `planner-frontend/src/editor/PolygonEditor.tsx` – 2D-Symbole

Ersetze die einfache Farbauswahl `openingColor()` durch eine Funktion, die pro Typ
ein eigenes Symbol rendert.

**Farbzuweisung erweitern:**
```typescript
function openingColor(type: Opening['type'], selected: boolean): string {
  if (selected) return COLOR.openingSelected
  if (type === 'window') return COLOR.openingWindow
  if (type === 'pass-through') return COLOR.openingPassThrough
  if (type === 'radiator') return resolveColor('--status-danger', '#e55')
  if (type === 'socket') return resolveColor('--status-warning', '#fa0')
  if (type === 'switch') return resolveColor('--status-warning', '#fa0')
  if (type === 'niche') return resolveColor('--text-muted', '#888')
  if (type === 'pipe') return resolveColor('--status-info', '#06f')
  return COLOR.openingDoor
}
```

**Symbol-Dicke pro Typ:**
Ergänze im `<Line>` für Openings:
```typescript
strokeWidth={
  selected ? 6 :
  opening.type === 'radiator' ? 6 :
  opening.type === 'niche' ? 8 :
  4
}
dash={
  opening.type === 'pipe' ? [4, 4] :
  opening.type === 'socket' ? [2, 2] :
  undefined
}
```

**Tiefenversatz-Indikator:**
Wenn `opening.wall_offset_depth_mm` gesetzt und > 0, zeige eine dünne parallele Linie
als Abstandsmarke (50px versetzt senkrecht zur Wand):

```tsx
{opening.wall_offset_depth_mm && opening.wall_offset_depth_mm > 0 && (() => {
  const perpDist = worldToCanvas(opening.wall_offset_depth_mm)
  const normX = -(coords.y2 - coords.y1) / Math.hypot(coords.x2 - coords.x1, coords.y2 - coords.y1)
  const normY = (coords.x2 - coords.x1) / Math.hypot(coords.x2 - coords.x1, coords.y2 - coords.y1)
  return (
    <Line
      key={`${opening.id}-depth`}
      points={[
        coords.x1 + normX * perpDist,
        coords.y1 + normY * perpDist,
        coords.x2 + normX * perpDist,
        coords.y2 + normY * perpDist,
      ]}
      stroke={openingColor(opening.type, false)}
      strokeWidth={1}
      dash={[4, 4]}
      opacity={0.5}
    />
  )
})()}
```

---

## 5. RightSidebar / OpeningPanel: Typ-Dropdown erweitern

Suche in `planner-frontend/src/` nach der Komponente, die das Opening-Formular rendert
(wahrscheinlich `components/editor/RightSidebar.tsx` oder ähnlich).

Erweitere das Typ-Dropdown um alle neuen Typen mit deutschen Labels:

```typescript
const TYPE_LABELS = {
  door: 'Tür',
  window: 'Fenster',
  'pass-through': 'Durchgang',
  radiator: 'Heizkörper',
  socket: 'Steckdose',
  switch: 'Schalter',
  niche: 'Nische',
  pipe: 'Rohrleitung',
  custom: 'Benutzerdefiniert',
}
```

Füge ein Eingabefeld für `wall_offset_depth_mm` hinzu (Label: „Tiefenversatz (mm)", Typ: number, min 0).

---

## 6. `planner-api/src/routes/openings.test.ts` – Tests erweitern

Lese die bestehende Test-Datei. Füge hinzu:
- Test: Opening mit `type: 'radiator'` erstellen → 201 ✅
- Test: Opening mit `type: 'niche'` und `wall_offset_depth_mm: 200` erstellen → 201 ✅
- Test: Opening mit unbekanntem `type: 'unknown_type'` → 400 ❌

---

## DoD-Checkliste

- [ ] `openingTypeValues` enthält alle 9 Typen
- [ ] `POST /api/v1/openings` mit `type: 'radiator'` → 201
- [ ] `POST /api/v1/openings` mit `wall_offset_depth_mm: 300` → 201
- [ ] `POST /api/v1/openings` mit unbekanntem Typ → 400
- [ ] PolygonEditor zeigt Heizkörper in Rot, Steckdose gestrichelt in Orange
- [ ] Tiefenversatz-Linie sichtbar wenn `wall_offset_depth_mm > 0`
- [ ] ROADMAP.md Sprint 57 Status → `done`
- [ ] Commit + PR `feature/sprint-57-wall-attachments`
