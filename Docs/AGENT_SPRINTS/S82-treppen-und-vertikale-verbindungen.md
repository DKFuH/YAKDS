# Sprint 82 - Treppen & vertikale Verbindungen

**Branch:** `feature/sprint-82-stairs-vertical-connections`
**Gruppe:** A (startbar nach S81)
**Status:** `planned`
**Abhaengigkeiten:** S71 (Arc-Walls optional), S73 (3D/Interop), S81 (Mehr-Ebenen-Projektmodell)

---

## Ziel

Treppen und vertikale Verbindungen als eigenes Planungselement einfuehren.
V1 konzentriert sich auf gerade und gewendelte Treppen, Treppenaugen,
Aussparungen und die Verknuepfung zwischen zwei Ebenen.

Inspiration: Sweet Home 3D Staircase Generator, Levels-Workflow.

---

## 1. Datenmodell

Ans Ende von `planner-api/prisma/schema.prisma` anhaengen:

```prisma
model VerticalConnection {
  id                 String   @id @default(uuid())
  tenant_id          String
  project_id         String
  from_level_id      String
  to_level_id        String
  kind               String   @db.VarChar(40)
  footprint_json     Json
  stair_json         Json     @default("{}")
  opening_json       Json     @default("{}")
  created_at         DateTime @default(now())
  updated_at         DateTime @updatedAt

  @@index([tenant_id, project_id])
  @@map("vertical_connections")
}
```

`kind` V1:

- `straight_stair`
- `l_stair`
- `u_stair`
- `spiral_stair`
- `void`

---

## 2. Backend

Neue Dateien:

- `planner-api/src/routes/verticalConnections.ts`
- `planner-api/src/services/stairGeometry.ts`

Endpoints:

- `GET /projects/:id/vertical-connections`
- `POST /projects/:id/vertical-connections`
- `PATCH /vertical-connections/:id`
- `DELETE /vertical-connections/:id`

Service:

- Treppengeometrie aus Breite, Steigung, Auftritt, Geschosshoehe ableiten
- Treppenauge/Aussparung fuer Deckenoeffnung berechnen
- Validierung gegen Levelhoehen

---

## 3. Frontend

Neue oder angepasste Dateien:

- `planner-frontend/src/api/verticalConnections.ts`
- `planner-frontend/src/components/editor/StairsPanel.tsx`
- Anpassungen in `CanvasArea.tsx`, `Preview3D.tsx`

Funktionen:

- Treppentyp auswaehlen
- Start- und Zielebene waehlen
- Breite, Steigung, Auftritt, Laufrichtung einstellen
- 2D-Footprint und 3D-Vorschau
- Deckenaussparung sichtbar machen

---

## 4. Deliverables

- `VerticalConnection` plus Migration
- Treppengeometrie-Service
- CRUD fuer vertikale Verbindungen
- StairsPanel im Editor
- 2D- und 3D-Darstellung fuer V1-Treppen
- 10-16 Tests

---

## 5. DoD

- Nutzer kann eine Treppe zwischen zwei Ebenen anlegen
- Geometrie und Deckenaussparung werden automatisch berechnet
- 2D-Footprint und 3D-Darstellung stimmen zusammen
- ungueltige Geschosshoehen oder Parameter liefern klare Fehler

