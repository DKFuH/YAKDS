# Sprint 83 - Mehr-Ebenen-Layout, Sektionen & Interop

**Branch:** `feature/sprint-83-multilevel-layout-sections`
**Gruppe:** B (startbar nach S81, sinnvoll nach S82)
**Status:** `planned`
**Abhaengigkeiten:** S64 (Layout-Sheets), S72 (Bogen-Bemaßung), S80 (Vektor-Exporte), S81 (Levels), S82 (Treppen)

---

## Ziel

Mehr-Ebenen-Projekte professionell darstellen und exportieren:
level-spezifische Sheets, vertikale Schnitte, Treppendarstellung und
grundlegende Mehr-Ebenen-Daten in Exporten.

Inspiration: Sweet Home 3D Side View, more levels, export thinking.

---

## 1. Backend

Neue oder angepasste Dateien:

- `planner-api/src/routes/sections.ts`
- Erweiterungen in `layoutSheets.ts`, `exports.ts`, `cadInterop.ts`, `ifcInterop.ts`

Funktionen:

- vertikale Schnittdefinitionen speichern
- Level-gebundene Layout-Sheets
- Exporte mit Level-Metadaten
- einfache Seiten-/Schnittansicht fuer Treppen und Raumstapel

---

## 2. Datenmodell

Ans Ende von `planner-api/prisma/schema.prisma` anhaengen:

```prisma
model SectionView {
  id               String   @id @default(uuid())
  tenant_id        String
  project_id       String
  level_id         String?
  name             String   @db.VarChar(120)
  cutline_json     Json
  config_json      Json     @default("{}")
  created_at       DateTime @default(now())
  updated_at       DateTime @updatedAt

  @@index([tenant_id, project_id])
  @@map("section_views")
}
```

---

## 3. Frontend

Neue oder angepasste Dateien:

- `planner-frontend/src/api/sections.ts`
- `planner-frontend/src/components/editor/SectionPanel.tsx`
- Anpassungen in `LayoutSheetTabs.tsx`, `ExportsPage.tsx`

Funktionen:

- Schnittlinie im Plan setzen
- Seiten-/Schnittansicht generieren
- Sheets nach Ebene und Section filtern
- Export von Level- und Schnittansichten

---

## 4. Deliverables

- `SectionView` plus Migration
- Section-CRUD
- level-aware Layout-Sheets
- einfache Vertikalschnitte
- Export- und Interop-Erweiterungen fuer Mehr-Ebenen-Metadaten
- 10-14 Tests

---

## 5. DoD

- Mehr-Ebenen-Projekte koennen in Sheets pro Ebene dargestellt werden
- vertikale Schnittansichten sind speicher- und exportierbar
- Treppen und Deckenaussparungen erscheinen sinnvoll in Layout und Export
- Level-Metadaten gehen in Exportpfaden nicht verloren

