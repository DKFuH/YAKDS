# STATUS.md

Projektstatus per 2026-03-04.

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

Aktuell auf `main`:

- Sprint 79: Offline-PWA und Aufmass-Import
- Sprint 80: Viewer-Export-Plugin und Vektor-Exporte
- Sprint 81: Mehr-Ebenen-Projektmodell
- Sprint 82: Treppen und vertikale Verbindungen (`stairs`)
- Sprint 83: Mehr-Ebenen-Layout, Sektionen und Interop (`multilevel-docs`)
- Sprint 84: Core-i18n & Locale Switcher (i18next, `resolveLocale`, `LanguageSwitcher`, `formatters.ts`)
- Sprint 85: Language Packs & Uebersetzungsverwaltung (`language_packs`, Resolver, CRUD, Admin-Seite)
- Sprint 86: Mehrsprachige Dokumente & Shares (`locale_code` fuer Dokumente/Shares, locale-aware PDF/Viewer/Exporte)
- Sprint 87: Navigation-UX & Input-Profile (Navigation-Profile, MMB-Pan, Touchpad-Modi, persistente Input-Settings)
- Sprint 98: Stabilisierungsphase (Kern-Findings behoben, Goldene Pfade abgesichert)

---

## Aktueller Fokus

- Phase 21 (Sprint 98 - Stabilisierungsphase) ist abgeschlossen.
- Behobene Findings: `resolveLocale`-Fallback-Test-Isolation (navigator-Mock), `rooms.ts` reference-image-Clear-Regression (JsonNull → null).
- Alle 987 Tests bestehen; keine kritischen Build-Breaker.
- Naechster Fokus: weiterer Ausbau gemaess ROADMAP.

---

## Hinweise

- Die detaillierte Sprintplanung liegt in `Docs/AGENT_SPRINTS/`.
- Der strategische Backlog und die Phasenstruktur liegen in `Docs/ROADMAP.md`.
- Fuer den tagesaktuellen Sprintstand sind `Docs/AGENT_SPRINTS/README.md` und `Docs/ROADMAP.md` die fuehrenden Quellen.
