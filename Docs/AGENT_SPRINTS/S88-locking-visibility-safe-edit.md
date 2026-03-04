# Sprint 88 - Locking, Visibility & Safe-Edit-Modus

**Branch:** `feature/sprint-88-locking-visibility-safe-edit`
**Gruppe:** A (startbar nach S81)
**Status:** `done`
**Abhaengigkeiten:** S63 (Bemaßung), S81 (Levels), S87 (Navigation optional)

---

## Ziel

OKP bekommt einen professionellen Schutz- und Sichtbarkeitsmodus:
Objekte, Maße, Levels und Gruppen koennen gesperrt oder ausgeblendet werden,
damit komplexe Plaene sicher bearbeitet werden koennen.

Leitidee: sichere Bearbeitung ueber Locking, Sichtbarkeit und Safe-Edit-Modi.

---

## 1. Datenmodell

Bestehende JSON-/Entity-Modelle um Flags erweitern:

- `locked`
- `visible`
- `lock_scope`

Betroffen:

- Levels
- Dimensions
- Placements
- Walls
- spaeter auch Groups aus `S90`

---

## 2. Backend

Neue oder angepasste Dateien:

- `planner-api/src/routes/visibility.ts`
- Erweiterungen in `levels.ts`, `dimensions.ts`, `placements.ts`, `walls.ts`

Endpoints:

- `POST /projects/:id/visibility/apply`
- `POST /projects/:id/locks/apply`

V1:

- Batch-Update fuer sichtbare/gesperrte Objekte
- Guarding gegen Edit auf gelockte Entities

---

## 3. Frontend

Neue oder angepasste Dateien:

- `planner-frontend/src/components/editor/VisibilityPanel.tsx`
- `planner-frontend/src/components/editor/LockPanel.tsx`
- Anpassungen in `CanvasArea.tsx`, `RightSidebar.tsx`

Funktionen:

- Show/Hide fuer Level, Maße, Gruppen, Assets
- Lock/Unlock fuer selektierte Objekte
- Safe-Edit-Modus: nur aktive Teilmenge bearbeitbar
- visuelle Indikatoren fuer gelockte Objekte

---

## 4. Deliverables

- Lock-/Visibility-Flags
- Batch-Routen
- Safe-Edit-UI
- Lock-Guards in zentralen Editpfaden
- 10-14 Tests

---

## 5. DoD

- gelockte Objekte koennen nicht versehentlich veraendert werden
- Sichtbarkeit groesserer Teilmengen ist schnell steuerbar
- Level-Locks funktionieren in Mehr-Ebenen-Projekten
- Safe-Edit reduziert Fehlbedienungen bei grossen Plaenen
