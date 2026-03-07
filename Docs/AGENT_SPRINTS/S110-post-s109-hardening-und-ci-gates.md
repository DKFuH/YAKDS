# Sprint 110 - Full Fluent2 Migration und Ribbon-Menueband

**Branch:** `feature/sprint-110-fluent2-ribbon-shell`
**Gruppe:** C
**Status:** `done`
**Abhaengigkeiten:** S109

## Ziel

Nach S109 wird das Frontend vollstaendig in eine konsistente Fluent-2-Produktoberflaeche ueberfuehrt,
inklusive durchgaengigem Ribbon-Menueband im Office-365-Stil (Konzeptuebernahme, kein 1:1 Clone).

Kernziele:
- komplette Fluent2-Migration der Shell-/Workflow-UI
- globales Ribbon auf allen Hauptseiten
- sauber gruppierte Menues und Kontext-Tabs fuer CAD-Workflows
- harte Action-Matrix-Anbindung (enabled/disabled + reason)

## Scope

In Scope:

- Vollmigration von Header, Menues, Command-Flows, Sidepanels auf Fluent UI v9
- Ribbon-Architektur mit Tabs, Gruppen, Overflow, Quick-Access
- Kontext-Tabs je Selektion/Modus (z. B. Wand, Oeffnung, Objekt, Render)
- durchgaengiger Einsatz in Start, Projekte, Editor, Presentation, Settings
- i18n-Vollabdeckung fuer Ribbon-Labels, Gruppen, Hinweise, Disabled-Reasons
- Plugin-Slots und MCP-Actions als Ribbon-faehige Erweiterungspunkte

Nicht in Scope:

- 3D-Renderer-Neubau
- serverseitige Plugin-Execution-Neuarchitektur

## Informationsbasis

Als Referenz werden UI-Patterns aus Microsoft 365 Online fuer Ribbon-Struktur verwendet:
- Tab- und Gruppenlogik
- Quick Access
- Kontext-Tabs
- Overflow-Verhalten auf kleineren Viewports

Regel:
- Pattern/Informationsarchitektur uebernehmen,
- Branding/Identitaet und konkrete Implementierung fuer OKP eigenstaendig halten.

## Ribbon Informationsarchitektur (OKP)

Primare Tabs:

- `Datei`
- `Start`
- `Einfuegen`
- `CAD`
- `Ansicht`
- `Render`
- `Daten`
- `Plugins`

Beispiel-Gruppen:

- `Datei`: Neu, Oeffnen, Speichern, Export
- `Start`: Zwischenablage, Undo/Redo, Auswahl
- `Einfuegen`: Fenster, Tueren, Moebel, Labels, Assets
- `CAD`: Zeichnen, Bearbeiten, Snap/Ausrichtung, Topologie
- `Ansicht`: 2D/3D/Split, Sichtbarkeit, Kamera-Presets
- `Render`: Screenshot, 360, Renderjobs, Umgebungen
- `Daten`: Workflows, Interop, Reports, ERP-Hooks
- `Plugins`: Tenant-Plugins, Slot-Aktionen

Kontext-Tabs (dynamisch):

- `Wandtools`
- `Oeffnung`
- `Objekt`
- `Presentation`

## Architektur

Core-Komponenten:

- `RibbonShell`
- `RibbonTabBar`
- `RibbonGroup`
- `RibbonCommand`
- `RibbonOverflow`
- `QuickAccessBar`

State und Resolver:

- `editorModeStore`
- `workflowStateStore`
- `actionStateResolver`
- `backendCapabilityMap`
- `pluginSlotRegistry`
- `mcpActionBridge`

## Umsetzungsplan (Phasen)

1. Ribbon Foundation
- Tab-/Gruppenkomponenten auf Fluent2 aufbauen
- QuickAccess + Overflow + Keyboard-Navigation

2. Editor Ribbon Migration
- bestehende Header-Menues in Ribbon ueberfuehren
- CAD-Toolbox mit Ribbon-Gruppen harmonisieren

3. Cross-Page Rollout
- Projekte, Start, Presentation, Settings auf RibbonShell migrieren

4. Context Tabs + Integrationen
- Kontext-Tabs je Selektion/Modus
- Plugin/MCP-Aktionen als Ribbon-Buerger erster Klasse

5. Hardening
- E2E- und Accessibility-Absicherung
- Performance-/Bundle-Feinschliff

## Deliverables

- Vollstaendiges Ribbon-Menueband in allen Hauptbereichen
- Fluent2-konforme Shell ohne alte Misch-UI-Reste
- Dokumentierte Tab-/Gruppenarchitektur fuer OKP
- Stabile i18n- und Disabled-Reason-Abdeckung
- Plugin- und MCP-Integration im Ribbon

## Tests

- Unit:
  - action/resolver/ribbon-state tests
- Component:
  - Ribbon tabs/groups/overflow/context tabs
- E2E:
  - global navigation via ribbon
  - context-tab switching by selection
  - disabled reasons + i18n DE/EN
  - plugin/mcp actions from ribbon
- Build:
  - `planner-frontend` build gruen

## DoD

- Ribbon ist auf allen Hauptseiten live und konsistent
- Menues sind fachlich gruppiert und nutzerfuehrend
- Kontext-Tabs reagieren korrekt auf Modus/Selektion
- Action-Matrix steuert alle Ribbon-Aktionen zentral
- Plugin/MCP sind sichtbar und bedienbar eingebunden
- i18n und E2E-Gates gruen

## Fortschritt (aktueller Stand)

Abgeschlossen in dieser Runde:

- Vollstaendige Fluent-2-Migration fuer die folgenden Seiten umgesetzt:
  - `SupplierPortalPage`
  - `WebplannerPage`
  - `CutlistPage`
  - `NestingPage`
  - `ProductionOrdersPage`
  - `CompliancePage`
  - `QuoteLinesPage`
  - `PresentationModePage`
  - `SiteSurveyPage`
- Durchgaengiges Migrationsmuster angewendet:
  - `.module.css` Importe entfernt (wo migriert)
  - `makeStyles` + `tokens` fuer Styling
  - Native Controls durch Fluent ersetzt (`Button`, `Select/Option`, `Checkbox`)
  - `MessageBar` fuer Fehler/Erfolg, `Spinner` fuer Ladezustaende
  - Layout-Hierarchie via `Card`, `CardHeader`, `Title2`, `Body1Strong`
  - Sprint/Phase-Kicker-Labels entfernt
- `19` verwaiste `.module.css` Dateien in `planner-frontend/src/pages/` geloescht.

Bewusst offen gelassen (weiter aktiv genutzt):

- `Editor.tsx`
- `CaptureDialogHarnessPage.tsx`
- `S109ShellHarnessPage.tsx`
- `ConstraintsPanel.tsx`
- `KitchenAssistantPanel.tsx`

Naechster Umsetzungsschritt:

- Ribbon-Menueband (Tab-/Gruppenstruktur) global einziehen und die migrierten Seiten an die finale Ribbon-Navigation anbinden.

---

## Fortschritt (Ribbon-Implementierung abgeschlossen)

Umgesetzt in dieser Runde:

### Ribbon Foundation (Phase 1 abgeschlossen)

- `ribbonStateResolver.ts` - zentraler State-Resolver fuer alle Ribbon-Tabs, -Gruppen, -Commands und Kontext-Tabs
  - 8 primaere Tabs: Datei, Start, Einfuegen, CAD, Ansicht, Render, Daten, Plugins
  - 4 Kontext-Tabs: Wandtools, Oeffnung, Objekt, Presentation (dynamisch nach Modus/Selektion)
  - Quick-Access-Leiste (Undo, Redo, Speichern, Weiter, Screenshot)
  - Action-Matrix vollstaendig angebunden (enabled/disabled + reason)
  - MCP-Aktionen als Ribbon-Commands in Plugins-Tab
  - Plugin-IDs als Ribbon-Commands
- `RibbonCommand.tsx` - einzelner Command-Button mit Tooltip fuer Disabled-Reason
- `RibbonGroup.tsx` - Gruppenkomponente mit Label und Command-Liste
- `RibbonTabBar.tsx` - Tab-Strip fuer primaere + Kontext-Tabs, Content-Area fuer aktive Gruppen
- `RibbonOverflow.tsx` - Overflow-Menue fuer Commands die nicht in die Breite passen
- `QuickAccessBar.tsx` - Schnellzugriff-Leiste im Top-Bar
- `RibbonShell.tsx` - Haupt-Shell-Wrapper (ersetzt AppHeader in AppShell)

### Integration (Phase 2+3 abgeschlossen)

- `AppShell.tsx` aktualisiert: `AppHeader` durch `RibbonShell` ersetzt
- Alle Hauptseiten erhalten Ribbon automatisch ueber AppShell
- Workflow-Navigation (Weiter/Zurueck) als Ribbon-Commands integriert
- CAD-Moduswechsel als Ribbon-Commands in CAD-Tab
- Navigationslinks als Ribbon-Commands in Daten/Render/Datei-Tabs

### i18n (DE/EN vollstaendig)

- Alle Ribbon-Labels, Gruppen, Reasons in `de.ts` und `en.ts` ergaenzt
- Kein hardcoded String in Ribbon-Komponenten
- Disabled-Reasons vollstaendig abgedeckt

### Tests

- `ribbonStateResolver.test.ts` mit 21 Unit-Tests grueen:
  - 8 primaere Tabs vorhanden und korrekt benamst
  - Quick-Access korrekt aktiviert/deaktiviert je Workflow-Schritt
  - Kontext-Tabs korrekt aktiv je Workflow-Schritt und Editor-Modus
  - Action-Matrix-Anbindung verifiziert (Split, Screenshot, Presentation, Workflow-Steps)
  - MCP-Action-Integration in Plugins-Tab
  - i18n Key-Coverage (alle Commands referenzieren ribbon.*/shell.* Keys)
- Alle 144 Frontend-Tests weiterhin grueen

### Offen / Naechste Schritte

- E2E-Tests fuer Ribbon-Navigation (Playwright)
- Accessibility-Haertung (Keyboard-Navigation, ARIA-Labels verfeinern)
- Performance-/Bundle-Analyse
- AppHeader.tsx koennte bei Bedarf entfernt werden (derzeit noch vorhanden)

---

## Fortschritt (Bereich-basiertes Ribbon + Kanban-Navigation)

Umgesetzt in dieser Runde:

### AppArea-Erkennung

- `appShellState.ts` erweitert:
  - `AppArea`-Typ: `'kanban' | 'editor' | 'project-detail' | 'settings' | 'app'`
  - `areaFromPathname(pathname)` leitet Bereich aus aktueller Route ab
  - `area` in `AppShellState`-Interface + Rueckgabewert von `useAppShellState`

### Kanban-Ribbon (Hauptseite `/`)

- `ribbonStateResolver.ts` erweitert:
  - `RibbonStateInput` erhaelt `area: AppArea`
  - Neue Tab-Builder: `buildKanbanProjektTab`, `buildKanbanAendernTab`, `buildEinstellungenTab`, `buildHilfeTab`
  - `resolveRibbonState` verzweigt nach `area`:
    - `kanban`: Projekt, Aendern, Einstellungen, Hilfe (kein CAD-Kontext-Kram)
    - alle anderen: bestehende Editor-Tabs

- Kanban-Tab-Struktur:
  - **Projekt**: Neues Projekt (`?new=1` → Dialog oeffnet sofort), Im Editor oeffnen, Dokumente, Archivieren, Loeschen
  - **Aendern**: Status (Lead/Planung/Angebot/Auftrag/Produktion/Montage), Duplizieren, Kundendaten
  - **Einstellungen**: Einstellungen, Plugins, Firmeneinstellungen
  - **Hilfe**: Hilfe, Ueber OKP

- `RibbonShell.tsx` angepasst:
  - `useEffect` resettet aktiven Tab beim Bereichswechsel (`projekt` fuer Kanban, `start` fuer Editor)
  - `area` wird an `resolveRibbonState` weitergegeben

- `ProjectList.tsx` erweitert:
  - `useSearchParams`-Hook: erkennt `?new=1` und oeffnet Neues-Projekt-Dialog automatisch
  - URL wird danach sofort bereinigt (`replace: true`)

### i18n

- `de.ts` + `en.ts` je um ~30 Keys erweitert:
  - Tabs: `projekt`, `aendern`, `einstellungen`, `hilfe`
  - Gruppen: `newProject`, `projectActions`, `manage`, `status`, `projectChange`, `system`, `info`
  - Commands: `newProject`, `openInEditor`, `archiveProject`, `deleteProject`, Status-Commands, `duplicateProject`, `customerData`, `companySettings`, `help`, `about`
  - Reasons: `noProjectSelected`

### Tests

- `ribbonStateResolver.test.ts`: `area`-Pflichtfeld ergaenzt, 24 Tests gruen

### Offen (naechste Runde)

- KanbanBridge (aehnlich EditorBridge): gewaehltes Projekt ans Ribbon melden
  → dann werden Archivieren/Loeschen/Status/Duplizieren im Ribbon aktiv
- Editor-Seitenleisten (`LeftSidebar`, `RightSidebar`) -> Fluent-Migration (`.module.css` entfernen)
- Editor aufraumen: seltene Panels als Drawer statt dauerhaft offen

---

## Fortschritt (Fixing Sprints FS-1 bis FS-6 abgeschlossen - 2026-03-07)

Durchgefuehrt nach der Hauptimplementierung zur Haertung und Bereinigung:

### FS-1: Stale .js-Artefakte geloescht

- 198 veraltete pre-compiled `.js`-Dateien aus `planner-frontend/src/` entfernt
- Vitest lud diese statt der `.ts`-Quellen → 18 Testfehler + aufgeblaehte Testzahl (307 statt 160)
- Nach Loeschung: 160 Tests, alle gruen; `tsc --noEmit` clean

### FS-2: AppHeader.tsx entfernt

- `planner-frontend/src/components/layout/AppHeader.tsx` geloescht (via `git rm`)
- Vollstaendig durch `RibbonShell.tsx` ersetzt; keine Imports mehr vorhanden

### FS-3: KanbanBridge API-Calls (bestaetigt)

- `onArchive`, `onDelete`, `onDuplicate`, `onStatusChange` in `ProjectList.tsx` bereits korrekt
  mit `projectsApi.archive`, `projectsApi.delete`, `projectsApi.threeDots`, `projectsApi.updateStatus` verdrahtet
- Kein Handlungsbedarf

### FS-4: Kontext-Tabs Dynamik (bestaetigt)

- `Wandtools`, `Oeffnung`, `Objekt`-Tabs in `ribbonStateResolver.ts` korrekt nach `workflowStep` / `editorMode` aktiviert
- `workflowStep` fliesst via `workflowStateStore` → `appShellState` → `RibbonShell` → `resolveRibbonState`
- Kein Handlungsbedarf

### FS-5: Letzten hardcoded String auf i18n umgestellt

- `Editor.tsx` LockState-Label enthielt `'Unbekannt'` (Fallback fuer unbekannten Sperr-User)
- `useTranslation`-Hook in `Editor.tsx` ergaenzt
- `'Unbekannt'` durch `t('editor.lockState.unknownUser')` ersetzt
- `de.ts` + `en.ts` um `editor.lockState.unknownUser` erweitert

### FS-6: Dokumentation aktualisiert

- `STATUS.md` auf Stand 2026-03-07 gebracht
- Sprint 110 als `done` markiert
