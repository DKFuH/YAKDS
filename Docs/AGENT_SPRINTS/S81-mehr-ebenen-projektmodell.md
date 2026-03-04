# Sprint 81 - Mehr-Ebenen-Projektmodell

**Branch:** `feature/sprint-81-multi-level-projects`
**Gruppe:** A (startbar nach S74)
**Status:** `planned`
**Abhaengigkeiten:** S58 (Bild-Nachzeichnen), S64 (Layout-Sheets), S74 (Split-View)

---

## Ziel

Ein Projekt soll aus mehreren Ebenen bestehen koennen: Keller, EG, OG,
Galerie oder Podest. Raeume, Waende, Platzierungen und Referenzbilder muessen
einer Ebene zugeordnet werden koennen. V1 fokussiert auf Datenmodell,
Editor-Umschaltung und Grundlogik.

Inspiration: Sweet Home 3D Levels / multiple floors.

---

## 1. Datenmodell

Ans Ende von `planner-api/prisma/schema.prisma` anhaengen:

```prisma
model BuildingLevel {
  id               String   @id @default(uuid())
  tenant_id        String
  project_id       String
  name             String   @db.VarChar(120)
  elevation_mm     Int      @default(0)
  height_mm        Int?
  order_index      Int      @default(0)
  visible          Boolean  @default(true)
  config_json      Json     @default("{}")
  created_at       DateTime @default(now())
  updated_at       DateTime @updatedAt

  @@index([tenant_id, project_id, order_index])
  @@map("building_levels")
}
```

Bestehende Modelle erweitern:

- `Room.level_id String?`
- optional spaeter `Placement.level_id`, falls nicht immer ueber Room aufloesbar

Migrationsregel:

- bestehende Projekte bekommen implizit ein Default-Level `EG`
- vorhandene Raeume werden diesem Level zugeordnet

---

## 2. Backend

Neue oder angepasste Dateien:

- `planner-api/src/routes/levels.ts`
- Erweiterungen in `rooms.ts`, `projects.ts`, `layoutSheets.ts`

Endpoints:

- `GET /projects/:id/levels`
- `POST /projects/:id/levels`
- `PATCH /levels/:id`
- `DELETE /levels/:id`
- `POST /projects/:id/levels/bootstrap`

Anforderungen:

- Level-Reihenfolge und Sichtbarkeit speichern
- Default-Level fuer Altprojekte anlegen
- Room-Listen und Layout-Sheets level-spezifisch filtern koennen

---

## 3. Frontend

Neue oder angepasste Dateien:

- `planner-frontend/src/api/levels.ts`
- `planner-frontend/src/components/editor/LevelsPanel.tsx`
- Anpassungen in `Editor.tsx`, `CanvasArea.tsx`, `RightSidebar.tsx`

Funktionen:

- Ebenenliste mit `EG`, `OG`, `UG`, `Custom`
- aktive Ebene umschalten
- Sichtbarkeit einzelner Ebenen
- neue Raeume auf aktiver Ebene erzeugen
- Referenzbilder und Sheet-Views pro Ebene

---

## 4. Deliverables

- `BuildingLevel` plus Migration
- Level-CRUD
- Default-Level-Migration fuer Altprojekte
- LevelsPanel im Editor
- level-spezifische Raum- und Sheet-Filter
- 10-14 Tests

---

## 5. DoD

- Projekte koennen mehrere Ebenen besitzen
- Raeume sind einer Ebene zugeordnet
- Editor kann aktive Ebene wechseln
- Layout/Sheet-Ansichten koennen nach Ebene filtern
- Altprojekte bleiben lauffaehig

