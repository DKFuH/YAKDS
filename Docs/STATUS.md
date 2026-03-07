# STATUS.md

Projektstatus per 2026-03-07.

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

Aktuell auf `main`:

- Sprint 84: Core-i18n & Locale Switcher (i18next, `resolveLocale`, `LanguageSwitcher`, `formatters.ts`)
- Sprint 85: Language Packs & Uebersetzungsverwaltung
- Sprint 86: Mehrsprachige Dokumente & Shares
- Sprint 87: Navigation-UX & Input-Profile
- Sprint 98: Stabilisierungsphase
- Sprint 109: Fluent 2 UI Foundation (FluentProvider, AppShell, AppHeader -> RibbonShell)
- Sprint 110: Fluent2-Vollmigration (alle Seiten migriert), Ribbon-Menueband (alle Bereiche), KanbanBridge, EditorBridge

---

## Aktueller Fokus

Sprint 110 ist abgeschlossen. Durchgefuehrt in FS-1 bis FS-6 (Fixing Sprints):

- **FS-1**: 198 veraltete pre-compiled `.js`-Artefakte aus `planner-frontend/src/` geloescht → Testsuite normalisiert (160 Tests, alle gruen)
- **FS-2**: `AppHeader.tsx` entfernt (vollstaendig durch `RibbonShell` ersetzt)
- **FS-3**: `KanbanBridge`-Callbacks (`onArchive`, `onDelete`, `onDuplicate`, `onStatusChange`) bereits mit echten API-Calls verdrahtet (bestaetigt)
- **FS-4**: Kontext-Tabs (`Wandtools`, `Oeffnung`, `Objekt`) bereits korrekt dynamisch ueber `workflowStep` / `editorMode` aktiviert (bestaetigt)
- **FS-5**: Einzigen hardcoded String (`'Unbekannt'` in `Editor.tsx` LockState-Label) auf i18n-Key `editor.lockState.unknownUser` umgestellt
- **FS-6**: `STATUS.md` und Sprint-Doc aktualisiert

Naechster Fokus: E2E-Tests fuer Ribbon-Navigation (Playwright), Editor-Seitenleisten auf Fluent2 migrieren.

---

## Hinweise

- Die detaillierte Sprintplanung liegt in `Docs/AGENT_SPRINTS/`.
- Der strategische Backlog und die Phasenstruktur liegen in `Docs/ROADMAP.md`.
- Fuer den tagesaktuellen Sprintstand sind `Docs/AGENT_SPRINTS/README.md` und `Docs/ROADMAP.md` die fuehrenden Quellen.
