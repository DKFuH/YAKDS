# SweetHome3D Analyse -> OKP Umsetzung (konsolidiert)

Diese Datei ist die kanonische Zusammenfuehrung aus:

- `Docs/SWEETHOME3D_ANALYSE_OKP.md`
- `Docs/SWEETHOME3d_Analyse_OPK.md`

## Scope / analysierte SH3D-Bereiche

Quelle analysiert unter:

- `SWH3D/src/com/eteks/sweethome3d/viewcontroller/PlanController.java`
- `SWH3D/src/com/eteks/sweethome3d/viewcontroller/HomeController.java`
- `SWH3D/src/com/eteks/sweethome3d/viewcontroller/HomeView.java`
- `SWH3D/src/com/eteks/sweethome3d/viewcontroller/WallController.java`
- `SWH3D/src/com/eteks/sweethome3d/viewcontroller/FurnitureController.java`
- `SWH3D/src/com/eteks/sweethome3d/viewcontroller/RoomController.java`
- `SWH3D/src/com/eteks/sweethome3d/model/UserPreferences.java`
- `SWH3D/src/com/eteks/sweethome3d/model/LengthUnit.java`
- `SWH3D/src/com/eteks/sweethome3d/model/Wall.java`
- `SWH3D/src/com/eteks/sweethome3d/model/Room.java`

Ziel: fehlende Basic-Editorfunktionen in OKP strukturiert ergaenzen.

## Beobachtungen aus SH3D

- Magnetismus ist ein kombiniertes System (Winkel, Punkte/Kanten, Laengen).
- Temporaere Modifikatoren waehrend Drag/Zeichnen sind zentral.
- Grid/Magnetismus sind User-Praeferenzen, nicht hart codiert.
- Wall/Room-Operationen sind transaktional gedacht (Undo/Redo, Geometrie-Konsistenz).
- SH3D trennt klar Mode, ActionType und Controller-Orchestrierung.

## In OKP bereits umgesetzt

- Editor-Magnetismus:
  - Fang auf nahe bestehende Punkte beim Zeichnen und Vertex-Verschieben.
  - Konfigurierbare Fangtoleranz im Editor-State (`magnetismToleranceMm`).
- Konfigurierbares Winkelraster:
  - Nicht mehr starr auf 45 Grad.
  - Winkel-Schritt wird als erlaubte Winkelliste erzeugt.
- Modifier (SH3D-inspiriert):
  - `Shift` beim Zeichnen und Vertex-Drag mit Align auf H/V plus Nachbarwand-Winkel.
  - `Alt` deaktiviert Magnetismus temporaer beim Zeichnen/Vertex-Drag.
  - `Ctrl` fuer Feinschritt (halbes Laengenraster) beim numerischen Setzen von Kantenlaengen.
  - Visuelle Toolbar-Badges (`ORTHO`, `MAG OFF`).
- Magnetismus auf Wandachsen/Projektionen:
  - Fang auf naechste Projektion auf bestehende Wandsegmente innerhalb Toleranz.
  - Segment- und Punkt-Magnetismus konkurrieren; naeherer Fangpunkt gewinnt.
  - Zoom-adaptive Fangtoleranz (praeziser bei starkem Zoom, grosszuegiger in Weitansicht).
- Magnetisierte Laengenrasterung:
  - Explizites Setzen von Kantenlaengen wird auf `lengthSnapStepMm` gerundet.
- Toolbar-UX:
  - Getrennte Toggles fuer `Punktfang` und `Achsenfang`.
  - `L-Snap` Feld fuer Laengenraster.
  - `Fang: ...` Live-Anzeige inkl. Tooltip `Basis -> Effektiv` und Warn/Active-Farblogik.
  - Klickbare `Fang`-Anzeige (AUTO/BASIS Modus).
  - `Zoom: ...%` Anzeige plus Klick auf 100 Prozent Reset bei stabilem Viewport-Zentrum.
- Mode-Orchestrierung (Basis):
  - Zentraler `editorModeStore` als erster gemeinsamer Mode-Layer zwischen Workflow-UI und Editor-Toolstate.
  - Workflow-Step-Wechsel (`walls/openings/furniture`) setzt konsistente Editor-Modi (Zeichnen vs. Auswahl).
  - Insert-nahe Flows (`Raum`, `Oeffnung`, `Placement`) schalten auf `selection` zurueck.
- Action-Orchestrierung (Basis):
  - Zentraler `actionStateResolver` fuer Header-/Menue-Aktionen mit `enabled` und `reasonIfDisabled`.
  - Erste Anbindung fuer View-Modi (Split/ELV/SEC), Capture-Aktionen und Mehr-Menue-Operationen.
  - Shortcut-Freigaben (`D`, `S`, `Delete`, `Escape`) im Polygon-Editor zentral ueber Resolver statt Inline-Bedingungen.
  - View-Shortcuts (`1` bis `5`) zentral ueber Resolver (`resolveViewModeShortcut`) statt separater Sonderlogik.
  - Projektabhaengige Menue-Aktionen zentral gegatet (Angebotspositionen, Panorama-Touren, Werkstattpakete, Viewer-Exports, GLB, Alles geliefert).
  - `Bereiche`-Toggle ist konsistent in `Mehr`-Menue und `Toolboxen` ueber zentrale Action-Matrix verdrahtet.
- Editor-Orchestrierung (Konsolidierung):
  - Ein gemeinsamer `actionContext` in `Editor.tsx` ersetzt doppelte Context-Erzeugung fuer Resolver und Shortcuts.
  - `actionStates` werden als Single Source sowohl fuer UI-Buttons als auch Keyboard-Handler genutzt.
- Wall-Topologie Robustheit (S108d):
  - Neue Topologie-Utility `planner-frontend/src/editor/roomTopology.ts` fuer Rebind von wandgebundenen Objekten.
  - Reverse-Erkennung bei umgedrehter Wandrichtung mit gespiegelten Offsets.
  - Nearest-Wall-Rebind fuer Oeffnungen/Placements bei geaenderten Wall-IDs.
- Room-Validation + Auto-Fix (S108e):
  - Save-seitiges Auto-Fix fuer Duplicate-Vertices, Nullkanten und Orientierung (CCW-Normalisierung).
  - Persistierung wird bei verbleibenden kritischen Geometriefehlern abgebrochen.
  - Integration im Save-Flow von `CanvasArea.tsx`.
- Dimension Assist + Multi-View-Konsistenz (S108f):
  - Kontextuelle Messsegment-Vorschlaege aus Wandstart/-ende, Oeffnungen und Placements.
  - Anzeige der Vorschlaege im `RightSidebar`-Kantenpanel.
  - Harmonisierung von Oeffnungs-Kernattributen fuer Plan/3D/Elevation (`normalizeOpeningForMultiview`).

## Geaenderte OKP-Dateien (bisher)

- `planner-frontend/src/editor/snapUtils.ts`
- `planner-frontend/src/editor/snapUtils.js`
- `planner-frontend/src/editor/usePolygonEditor.ts`
- `planner-frontend/src/editor/usePolygonEditor.js`
- `planner-frontend/src/editor/PolygonEditor.tsx`
- `planner-frontend/src/editor/PolygonEditor.js`
- `planner-frontend/src/editor/editorModeStore.ts`
- `planner-frontend/src/editor/workflowStateStore.ts`
- `planner-frontend/src/editor/actionStateResolver.ts`
- `planner-frontend/src/editor/actionStateResolver.js`
- `planner-frontend/src/editor/roomTopology.ts`
- `planner-frontend/src/editor/PolygonEditor.module.css`
- `planner-frontend/src/components/editor/CanvasArea.tsx`
- `planner-frontend/src/components/editor/RightSidebar.tsx`
- `planner-frontend/src/components/editor/RightSidebar.module.css`
- `planner-frontend/src/pages/Editor.tsx`
- `planner-frontend/src/pages/Editor.module.css`
- Tests:
  - `planner-frontend/src/editor/snapUtils.test.ts`
  - `planner-frontend/src/editor/snapUtils.test.js`
  - `planner-frontend/src/editor/usePolygonEditor.test.js`
  - `planner-frontend/src/editor/editorModeStore.test.ts`
  - `planner-frontend/src/editor/workflowStateStore.test.ts`
  - `planner-frontend/src/editor/actionStateResolver.test.ts`
  - `planner-frontend/src/editor/actionStateResolver.test.js`
  - `planner-frontend/src/editor/roomTopology.test.ts`

## Verifikation (zuletzt)

- `npm run -w planner-frontend test -- src/editor`
- `npm run -w planner-frontend test -- src/editor/actionStateResolver.test.ts`
- `npm run -w planner-frontend build`
- `npx tsc -p planner-frontend/tsconfig.json`
- `npx vitest run src/editor/roomTopology.test.ts src/editor/usePolygonEditor.test.js src/editor/snapUtils.test.ts src/editor/actionStateResolver.test.ts src/editor/editorPreferences.test.ts`

## Zerlegung in Zwischensprints (S108a-S108f)

Die offene SH3D-Abarbeitung ist in folgende Zwischensprints zerlegt:

1. `S108a` - Snap und Modifier Hardening
Datei: `Docs/AGENT_SPRINTS/S108a-sh3d-snap-modifier-hardening.md`
2. `S108b` - Mode, Action und Insert-Orchestrierung
Datei: `Docs/AGENT_SPRINTS/S108b-sh3d-mode-action-insert-orchestrierung.md`
3. `S108c` - Preferences Persistenz
Datei: `Docs/AGENT_SPRINTS/S108c-sh3d-preferences-persistenz.md`
4. `S108d` - Wall-Topologie Robustheit
Datei: `Docs/AGENT_SPRINTS/S108d-sh3d-wall-topologie-robustheit.md`
5. `S108e` - Room-Validation und Auto-Fix
Datei: `Docs/AGENT_SPRINTS/S108e-sh3d-room-validation-autofix.md`
6. `S108f` - Dimension Assist und Multi-View-Objekte
Datei: `Docs/AGENT_SPRINTS/S108f-sh3d-dimension-assist-und-multiview.md`

Aktueller Stand: `S108a` bis `S108f` sind auf `done` umgesetzt.

## Priorisierte Reihenfolge

1. `S108a`
2. `S108b`
3. `S108c`
4. `S108d`
5. `S108e`
6. `S108f`

## Risiko / Aufwand

- Niedrig: Snap, Modifier, Preferences
- Mittel: Mode-Orchestrierung, Room-Validation
- Hoeher: Arc-Walls, robuste Wall-Merge/Split-Operationen mit abhaengigen Objekten

## Definition of Done pro Block

- Unit-Tests auf Utility-/Reducer-Ebene
- Mindestens 1 UI-Flow-Test (Draw/Move/Save)
- Keine Geometrie-Regressions im bestehenden `PolygonEditor`-Flow
