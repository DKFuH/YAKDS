# SPRINT_02_CODEX.md

## Umfang

Abgleich und Abschlussdokumentation für Sprint 2 (Frontend-Grundgerüst):

- Projektliste
- Editor-Layout
- Canvas-Bereich
- linke Sidebar
- rechte Sidebar
- Status-/Summenbereich unten

## Verwendete Dateien

- `planner-frontend/src/main.tsx`
- `planner-frontend/src/pages/ProjectList.tsx`
- `planner-frontend/src/pages/Editor.tsx`
- `planner-frontend/src/components/editor/CanvasArea.tsx`
- `planner-frontend/src/components/editor/LeftSidebar.tsx`
- `planner-frontend/src/components/editor/RightSidebar.tsx`
- `planner-frontend/src/components/editor/StatusBar.tsx`

## Ergebnis Sprint 2

Vorhanden und funktionsfähig:

- Routing zwischen Projektliste und Editor (`/` und `/projects/:id`)
- Projektliste mit Laden/Anlegen/Löschen
- Editor-Shell mit Topbar und 3-Spalten-Workspace
- Zentraler Canvas-Bereich für Raumbearbeitung
- Linke Sidebar für Raumauswahl/-anlage
- Rechte Sidebar für Geometrie-/Auswahldaten
- Untere Statusbar für Projekt-/Raumstatus

## DoD-Status Sprint 2

- Projekt kann im Browser geöffnet werden: **erfüllt**
- UI-Grundstruktur steht: **erfüllt**
- Build-Verifikation (`npm --prefix planner-frontend run build`): **grün**

## Nächster Sprint

Sprint 7:

- Katalog-MVP mit kaufmännischen Stammdaten
- Preisbasis für planbare Objekte sicherstellen
