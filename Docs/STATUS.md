# STATUS.md

Projektstatus per 2026-03-11.

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
- Sprint 121 (Tenant-Scope und Produktkern-Recovery): geplant
- Sprint 122 (Editor-Goldpfade und Room-Bootstrap): geplant
- Sprint 123 (Browser-CI-Gates und Shell-Regressionen): geplant

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
- Sprint 116: Plugin-Luecken geschlossen - raumakustik & survey-import in Registry, Editor-Guard und Plugins-Seite
- Sprint 121: Tenant-Scope global reparieren, Demo-Fallback enttarnen, Kernpfad gegen echtes Backend stabilisieren
- Sprint 122: Projekt -> Editor -> erster Raum -> produktiver Editor-Flow ohne Sackgasse
- Sprint 123: Playwright-/Browser-Gates an reale Shell und Goldpfade anpassen und wieder hart schalten

---

## Aktueller Fokus

Review-Stand 2026-03-11:

- Browser-Pruefung auf `http://127.0.0.1:5173` zeigt Default-Start im Demo-Modus; reale Backend-Funktion wird dadurch verdeckt.
- Tenant-gebundene Routen (`/tenant/settings`, `/tenant/plugins`, `camera-presets`, `layout-styles`, `acoustic-grids`) liefern im Laufzeitcheck `403 Missing tenant scope`.
- Playwright `planner-frontend` ist nicht gruen: `9 passed`, `4 failed` in den `S109`-Shell-Specs.
- Projektanlage und Editor-Start funktionieren nur teilweise: Editor 1.1 rendert, startet aber fuer neue Projekte ohne Raum und damit nicht DoD-konform produktiv.

Historischer Umsetzungsstand in S111 bis S116 (UI-Qualitaet & Plugin-Infrastruktur):

- **S111**: Alle Ribbon-Kommandos mit Fluent-Icons versehen (Microsoft-Best-Practice-Mapping)
- **S112**: AutoCAD-artige Seitenleisten-Restruktur; Einfuegen-Menue mit DXF/IFC/SketchUp-Eintraegen
- **S113**: `Editor.module.css` -> `makeStyles`/`tokens` migriert (36 Klassen); `handleImportFile` fuer DXF, IFC und SketchUp verdrahtet
- **S114**: Feng Shui Analyse-Plugin (`FengShuiPage`, Route, i18n, Slot-Registry-Eintrag, Plugin-Index)
- **S115**: `PluginsSettingsPage` von flacher Checkbox-Liste zu Rich Cards umgeschrieben (Switch, Kategorie-Gruppen, Active/Inaktiv-Badge, Unsaved-Changes-Banner)
- **S116**: Plugin-Luecken gegenueber Backend-Registry geschlossen: `raumakustik` und `survey-import` in `pluginSlotRegistry`, `Editor.tsx`-Guard und `PluginsSettingsPage.PLUGIN_META` ergaenzt

Plugin-Stand (alle 11 registrierten Plugins vollstaendig verdrahtet):
`presentation`, `viewer-export`, `tischler`, `daylight`, `materials`, `stairs`, `multilevel-docs`, `asset-library`, `feng-shui`, `raumakustik`, `survey-import`

Naechster Fokus:

- `S121` vorziehen und Tenant-Scope / Produktkern reparieren
- `S122` fuer echten Editor-Goldpfad umsetzen
- `S123` als harte Browser-/CI-Absicherung nachziehen

---

## Hinweise

- Die detaillierte Sprintplanung liegt in `Docs/AGENT_SPRINTS/`.
- Der strategische Backlog und die Phasenstruktur liegen in `Docs/ROADMAP.md`.
- Fuer den tagesaktuellen Sprintstand sind `Docs/AGENT_SPRINTS/README.md` und `Docs/ROADMAP.md` die fuehrenden Quellen.

---

## Interop-Stand 2026-03-09

- `S117` ist abgeschlossen:
  - Provider-Schnitt fuer `DXF`, `DWG`, `SKP`, `IFC`
  - Registry
  - Capability-Endpunkt
  - Route-Migration auf den Provider-Layer
- `S118` ist in Arbeit:
  - plugin-faehige Registry aktiv
  - neue Export-Formate `STL`, `STEP`, `OBJ`, `3MF`
  - vereinheitlichte Interop-Jobs/Artefakte als API-Layer
  - persistente Export-Artefakte ueber `Document`

Wichtiger Hinweis:

- `S118` bleibt in Arbeit, ist aber nicht der naechste operative Schwerpunkt, solange Tenant-Scoping und der Kern-Produktpfad im Browser regressiv sind.

Offen in `S118`:

- eigenes persistentes `interop_jobs`-/`interop_artifacts`-Modell
- externe/native Worker-Bridge
- capability-getriebenes Frontend fuer Interop-Dialoge
