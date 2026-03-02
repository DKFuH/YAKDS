# STATUS.md

Projektstatus per 2026-03-02 - MVP abgeschlossen, Phase 2 umgesetzt, Phase 3 in technischer Umsetzung, Phase 4 implementiert.

---

## Gesamtstatus (Stand 2026-03-02)

- **Sprints 0-19 (MVP): abgeschlossen**
- **Sprints 20-24 (Phase 2): abgeschlossen**
- **Sprints 25-30 (Phase 3): in Umsetzung / große Teile bereits integriert**
- **Sprints 31-34 (Phase 4): implementiert**

Sprint 01 wurde extern bearbeitet. Alle übrigen Sprints lieferten Artefakte in:
- `shared-schemas` - Polygon, Öffnungen, Decken/Wände, Kollision/Höhe
- `planner-frontend` - Snap-Utilities
- `planner-api` - BOM-Kalkulation, Route-Stubs, Autorisierung

**Aktueller Teststand (gezielte Abnahme):**
- Fokus-Suites für die neuen Phase-3-Backends (`manufacturers`, `platform`, `documents`, `projects`, `quotes`, `dashboards`) grün.
- Letzter Durchlauf: **6 Testdateien / 27 Tests grün**.

---

## Review-Ergebnisse

Alle Reviews (TASK-3-R01 bis TASK-11-R01) intern ausgeführt. Alle Findings umgesetzt.

### Behobene Findings

| Priorität | Finding | Datei | Umsetzung |
|-----------|---------|-------|-----------|
| Hoch | Keine Autorisierung in `/validate` | `planner-api/src/routes/validate.ts` | Benutzer-/Projekt-Prüfung ergänzt |
| Hoch | `setEdgeLength` ohne Guard für `<= 0` | `shared-schemas/src/geometry/polygonEditor.ts` | Guard + Tests |
| Mittel | CAD-Intervalle nicht auf Wandgrenzen normalisiert | `shared-schemas/src/geometry/openingValidator.ts` | Clamping auf `[0, wallLength_mm]` |
| Mittel | API-Route-Stubs fehlten | `imports.ts`, `openings.ts`, `placements.ts`, `bom.ts` | Stubs mit Zod-Validierung angelegt |
| Mittel | `labor_surcharge` pauschal bei jedem Verstoß | `shared-schemas/src/validation/heightChecker.ts` | Differenzierte Regel + Grenzschwellen-Tests |
| Niedrig | BOM `surcharge` mit Betrag 0 | `planner-api/src/services/bomCalculator.ts` | Parametrisierbarer Default-Zuschlag |

---

## Phase-3 Fortschritt (neu)

### Sprint 26 - Dokumentenmanagement
- `Document`-Modell und Kernrouten (`POST/GET/DELETE`) aktiv.
- Download-Route und automatische Quote-PDF-Ablage vorhanden.
- Notification-Hooks für Upload/Delete integriert.

### Sprint 27 - Kontakte / CRM-Light
- Kontaktverwaltung und Projektverknüpfung (`/contacts`, `/projects/:id/contacts/:contactId`) aktiv.
- Kontaktübersicht inkl. Kennzahlen (Projektanzahl/Umsatz/Conversion) im Frontend integriert.

### Sprint 28 - Dashboards / KPIs
- `DashboardConfig` inkl. Persistenz-Endpunkte (`GET/PUT /dashboards/:userId`) aktiv.
- KPI-Endpunkt (`GET /kpis/sales-chart`) aktiv.
- Dashboard-UI mit Widget-Auswahl, Layout und Speichern implementiert.

### Sprint 29 - Katalogindexierung
- `CatalogIndex`-Routen (`POST/GET /projects/:id/catalog-indices`) aktiv.
- Pricing-Integration vorhanden (`/projects/:projectId/calculate-pricing`) inkl. angewandter Index-Metadaten.
- UI für Batch-Indexierung und Verlauf in der Katalogseite integriert.

### Sprint 30 - Plattform-Features
- Tenant-sichere Routen für globale Suche, CSV-Export, Notification-Webhook und Daily-Backup aktiv.
- Frontend-Integration für globale Suche und CSV-Exporte umgesetzt.

## Phase-4 Fortschritt (Sprint 31-34)

### Sprint 31 – Projektliste & 3-Punkte-Menü
- `GET /projects?search=…&status_filter=…&sales_rep=…` aktiv.
- `POST /projects` mit Kundendaten aktiv.
- `PATCH /projects/:id/3dots?action=duplicate|archive|unarchive` aktiv.
- Kanban-Board mit Filter, Suche, 3-Punkte-Menü und Status-Drag-Drop im Frontend integriert.

### Sprint 32 – Bereiche / Alternativen & Modellauswahl
- `GET|POST /projects/:id/areas`, `POST /projects/:id/areas/:areaId/alternatives` aktiv.
- `GET|PUT /alternatives/:id/model-settings` (F7-Dialog) aktiv.
- `AreasPanel` mit Baumstruktur, Rechtsklick-Kontextmenü, Doppelklick und F7-Dialog im Editor integriert.

### Sprint 33 – Onboarding & Lernreise
- `OnboardingWizard` (Erster Login → Schritte: Katalog, Projekt, Kontakte) aktiv.
- `LernreisePanel` (Hilfe-Sidebar mit Kursen: Erste Schritte, Projekt vorbereiten, Raum planen, Möbel platzieren) im Editor integriert.
- `SaveNotificationBanner` ("Speichern nicht automatisch – jetzt speichern?") im Editor aktiv.
- In-App-Support-Suche und „Support kontaktieren"-Link im LernreisePanel vorhanden.

### Sprint 34 – Workspace-Layout & Projekt-Details
- `GET|PUT /user/workspace-layout` aktiv.
- `PATCH /projects/:id/advisor` aktiv.
- Workspace-Layout wird beim Editor-Start geladen und kann über den SaveNotificationBanner persistiert werden.
- Fachberater/Sachbearbeiter im Projektboard editierbar (Feld `advisor`).
- Fachberater-Badge im Editor-Topbar sichtbar.

## Offene Punkte

- E2E-Abnahme für den vollständigen Flow `Lead -> Planung -> Quote -> Projektmanagement -> Abschluss` bleibt als finaler Plattform-Checkpoint offen.
- Realtime/SLA-Strategie für KPI-Aktualität (Polling vs. Eventing) final definieren.
- Cloud-Betriebsaspekte (Retry/Dead-Letter für Notifications, Backup-Operationalisierung) weiter härten.

---

## Phase-2 Abschluss / Übergabe in Phase 3

- Sprint 20-24 Kernziele sind in Architektur und Feature-Set verankert (Herstellerkatalog, Auto-Completion, Rule Engine v2, Multi-Tenant, Webplaner-Handover).
- Für verbleibende P0/P1-Lücken wurde ein priorisierter Umsetzungs- und DoD-Plan geführt und schrittweise abgearbeitet.
- Nächster Ausbaupfad verschiebt den Fokus von reiner Planung auf Studio-Workflow und Cloud-Betrieb.

---

## Nächste Schritte

- Phase-3-Funktionen konsolidieren und End-to-End validieren.
- Offene DoD-Punkte aus Sprint 25-30 über gezielte Integrations- und Lasttests schließen.
- Dokumentationspflege laufend synchron zur Auslieferung halten.
- Referenzplanung: `Docs/PHASE_3_DOD_AND_EXECUTION_PLAN.md`

