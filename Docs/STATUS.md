# STATUS.md

Projektstatus per 2026-03-02 - MVP, Phase 2, Phase 3 und Phase 4 abgeschlossen. Phase 5 und 6 geplant.

---

## Gesamtstatus (Stand 2026-03-02)

- **Sprints 0-19 (MVP): abgeschlossen**
- **Sprints 20-24 (Phase 2): abgeschlossen**
- **Sprints 25-30 (Phase 3): abgeschlossen**
- **Sprints 31-40 (Phase 4 + Sprints 35-40): abgeschlossen** (PR #8 gemergt 2026-03-02)
- **Sprints 41-45 (Phase 5 – Profi-Parität): geplant**
- **Sprints 46-50 (Phase 6 – Vernetzte Branchenlösung): geplant**

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

## Phase-5 Fortschritt (in Umsetzung)

### Sprint 35 – Bestellverwaltung
- `PurchaseOrder`- und `PurchaseOrderItem`-Modelle im Prisma-Schema verankert.
- CRUD-Routen (`POST/GET /projects/:id/purchase-orders`, `GET/PUT/DELETE /purchase-orders/:id`) aktiv.
- Statuswechsel-Endpunkt (`PATCH /purchase-orders/:id/status`) mit Notification-Integration aktiv.
- 10 Unit-Tests grün.

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

## Phase-4-Abschluss (Sprint 31–40)

- Sprint 31–34 (Projektliste, Bereiche/Alternativen, Onboarding, Workspace-Layout): PR #8 gemergt 2026-03-02.
- Sprints 35–40 (Makros, Arbeitsplattenschemas, Annotationen, Raumdekoration, Lichtprofile, Angebotszeilen): backend complete, frontend implemented.

## Phase-6-Vorarbeit (Sprint 46 – teilweise)

- `PurchaseOrder` + `PurchaseOrderItem` Prisma-Schema implementiert (PR #10, gemergt 2026-03-02).
- 6 CRUD-Routen für Bestellwesen + Status-Workflow-Übergänge + Notification-Trigger aktiv.
- **Aktueller Teststand: 280 Tests grün** (+12 aus PR #10).
- Ausstehend Sprint 46: `ProductionOrder`, Freeze-Guard, Verknüpfung PO↔PurchaseOrder, Produktionsübersicht-UI.

## Nächste Schritte

- Phase 5 (Sprints 41–45) starten: Profi-Parität (Passstücke, Angebotsworkflow, Taschenrechner, Favoriten, Batchdruck, Nischenverkleidung).
- Referenzplanung Phase 5: `Docs/PHASE_5_DOD_AND_EXECUTION_PLAN.md`
- Sprint 46 vervollständigen: `ProductionOrder` + Freeze-Guard + Produktionsübersicht.
- Phase 6 (Sprints 46–50) folgt nach Phase 5: Auftragssteuerung, Mobile PWA, ERP-Anbindung, Analytics, Compliance.
- Referenzplanung Phase 6: `Docs/PHASE_6_DOD_AND_EXECUTION_PLAN.md` (noch zu erstellen)

