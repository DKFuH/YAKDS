# STATUS.md

Projektstatus per 2026-03-09.

---

## Gesamtstatus

- Sprints 0-19 (MVP): abgeschlossen
- Sprints 20-24 (Phase 2): abgeschlossen
- Sprints 25-30 (Phase 3): abgeschlossen
- Sprints 31-40 (Phase 4): abgeschlossen
- Sprints 41-45 (Phase 5): abgeschlossen
- Sprint 46: abgeschlossen
- Sprints 47-51: abgeschlossen
- Sprint 56: abgeschlossen
- Sprints 57-87: abgeschlossen
- Sprint 98 (Phase 21 - Stabilisierungsphase): abgeschlossen
- Sprint 109 (Fluent 2 UI Foundation): abgeschlossen
- Sprint 110 (Fluent2-Vollmigration + Ribbon-Menueband): abgeschlossen
- Sprint 111 (Fluent Icons – Ribbon-Kommandos): abgeschlossen
- Sprint 112 (Editor-Sidebar-Restruktur + Einfuegen-Menue): abgeschlossen
- Sprint 113 (Editor.tsx CSS-Migration + Import-Handler): abgeschlossen
- Sprint 114 (Feng Shui Analyse-Plugin): abgeschlossen
- Sprint 115 (Plugins-Seite ueberholt): abgeschlossen
- Sprint 116 (Raumakustik & Survey-Import Plugin-Luecken): abgeschlossen

Aktuell auf `main`:

- Sprint 84: Core-i18n & Locale Switcher (i18next, `resolveLocale`, `LanguageSwitcher`, `formatters.ts`)
- Sprint 85: Language Packs & Uebersetzungsverwaltung
- Sprint 86: Mehrsprachige Dokumente & Shares
- Sprint 87: Navigation-UX & Input-Profile
- Sprint 98: Stabilisierungsphase
- Sprint 109: Fluent 2 UI Foundation (FluentProvider, AppShell, AppHeader -> RibbonShell)
- Sprint 110: Fluent2-Vollmigration (alle Seiten migriert), Ribbon-Menueband (alle Bereiche), KanbanBridge, EditorBridge
- Sprint 111: Fluent Icons auf allen Ribbon-Kommandos (Microsoft-Iconlibrary, Best-Practice-Mapping)
- Sprint 112: AutoCAD-artige Seitenleisten-Restruktur, Einfuegen-Menue mit Import-Eintraegen
- Sprint 113: Editor.tsx CSS-Modul -> makeStyles/tokens migriert; Import-Handler fuer DXF/IFC/SketchUp verdrahtet
- Sprint 114: Feng Shui Analyse-Plugin mit Bagua-Zonen, Befunden, Score und API-Anbindung
- Sprint 115: Plugins-Einstellungsseite komplett ueberholt – Rich Cards, Switch, Kategorie-Badges, Unsaved-Banner
- Sprint 116: Plugin-Luecken geschlossen – raumakustik & survey-import in Registry, Editor-Guard und Plugins-Seite

---

## Aktueller Fokus

Sprint 116 ist abgeschlossen. Durchgefuehrt in S111 bis S116 (UI-Qualitaet & Plugin-Infrastruktur):

- **S111**: Alle Ribbon-Kommandos mit Fluent-Icons versehen (Microsoft-Best-Practice-Mapping)
- **S112**: AutoCAD-artige Seitenleisten-Restruktur; Einfuegen-Menue mit DXF/IFC/SketchUp-Eintraegen
- **S113**: `Editor.module.css` -> `makeStyles`/`tokens` migriert (36 Klassen); `handleImportFile` fuer DXF, IFC und SketchUp verdrahtet
- **S114**: Feng Shui Analyse-Plugin (`FengShuiPage`, Route, i18n, Slot-Registry-Eintrag, Plugin-Index)
- **S115**: `PluginsSettingsPage` von flacher Checkbox-Liste zu Rich Cards umgeschrieben (Switch, Kategorie-Gruppen, Active/Inaktiv-Badge, Unsaved-Changes-Banner)
- **S116**: Plugin-Luecken gegenueber Backend-Registry geschlossen: `raumakustik` und `survey-import` in `pluginSlotRegistry`, `Editor.tsx`-Guard und `PluginsSettingsPage.PLUGIN_META` ergaenzt

Plugin-Stand (alle 11 registrierten Plugins vollstaendig verdrahtet):
`presentation`, `viewer-export`, `tischler`, `daylight`, `materials`, `stairs`, `multilevel-docs`, `asset-library`, `feng-shui`, `raumakustik`, `survey-import`

Naechster Fokus: E2E-Tests fuer Ribbon-Navigation (Playwright), verbleibende CSS-Modul-Migrationen (LeftSidebar, RightSidebar, ConstraintsPanel, KitchenAssistantPanel).

---

## Hinweise

- Die detaillierte Sprintplanung liegt in `Docs/AGENT_SPRINTS/`.
- Der strategische Backlog und die Phasenstruktur liegen in `Docs/ROADMAP.md`.
- Fuer den tagesaktuellen Sprintstand sind `Docs/AGENT_SPRINTS/README.md` und `Docs/ROADMAP.md` die fuehrenden Quellen.
