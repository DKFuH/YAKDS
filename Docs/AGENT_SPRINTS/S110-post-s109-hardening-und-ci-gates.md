# Sprint 110 - Full Fluent2 Migration und Ribbon-Menueband

**Branch:** `feature/sprint-110-fluent2-ribbon-shell`
**Gruppe:** C
**Status:** `planned`
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
