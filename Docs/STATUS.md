# STATUS.md

Projektstatus per 2026-03-04 – MVP bis Phase 7 (Sprints 0–51) + Sprint 56 abgeschlossen.

---

## Gesamtstatus (Stand 2026-03-04)

- **Sprints 0-19 (MVP): abgeschlossen** ✅
- **Sprints 20-24 (Phase 2): abgeschlossen** ✅
- **Sprints 25-30 (Phase 3): abgeschlossen** ✅
- **Sprints 31-40 (Phase 4): abgeschlossen** ✅ (PR #8 gemergt 2026-03-02)
- **Sprints 41-45 (Phase 5 – Profi-Parität): abgeschlossen** ✅
- **Sprint 46 (Phase 6 – Auftragssteuerung): abgeschlossen** ✅ (PurchaseOrder + ProductionOrder + Freeze-Guard)
- **Sprint 47 (Mobile Aufmaß & Baustellenprotokoll): abgeschlossen** ✅ (SiteSurvey, InstallationChecklist)
- **Sprint 48 (ERP-Anbindung & Lieferantenportal): abgeschlossen** ✅ (ErpConnector, Push-Service, Webhook, SupplierPortal)
- **Sprint 49 (Analytics & Reports): abgeschlossen** ✅ (ReportDefinition, Schedule, Run, 5 Built-in-Reports)
- **Sprint 50 (Compliance & RBAC): abgeschlossen** ✅ (GDPR, SSO, SLA, Rollen)
- **Sprint 51 (GLTF/GLB-Export): abgeschlossen** ✅ (Three.js BoxGeometry, GLB-Magic-Bytes validiert)
- **Sprint 56 (Canvas-UX): abgeschlossen** ✅ (Wand-Interaktoren, Live-Dims, Stage-Fix, Keyboard-Shortcuts)
- **Sprint 79 (Offline-PWA & Aufmaß-Import): abgeschlossen** ✅ (Offline-Sync/PWA-Fähigkeit und Aufmaß-Import integriert)
- **Sprint 80 (Viewer-Export-Plugin & Vektor-Exporte): in Arbeit** 🚧 (Export-Plugin gestartet, Vektor-Exportpfade in Umsetzung)
- **Sprints 52-55 (IFC, DWG/SKP, OFML, Akustik): geplant** (Specs in Docs/AGENT_SPRINTS/)
- **Sprints 57-60 (WallAttachments, Nachzeichnen, Bemaßung, Kitchen Assistant): geplant**

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

## Phase-6 + Phase-7-Start – Sprints 46–51 + S56 (vollständig)

### Sprint 46 – Auftragssteuerung & Produktionsübergabe ✅
- `PurchaseOrder` + `PurchaseOrderItem` Prisma-Schema implementiert.
- `ProductionOrder` + `ProductionOrderEvent` Prisma-Schema implementiert.
- 8 Routen: CRUD, Status-Lifecycle, Freeze-Guard, Audit-Log, PO↔ProductionOrder-Verknüpfung.
- UI unter `/production-orders`: Workflow-Bar, Audit-Log, verknüpfte Bestellungen.

### Sprint 47 – Mobile Aufmaß & Baustellenprotokoll ✅
- `SiteSurvey`, `InstallationChecklist`, `ChecklistItem` Prisma-Modelle angelegt.
- Routes: `siteSurveys.ts` (7 Endpunkte) + `checklists.ts` (8 Endpunkte) aktiv.
- Frontend: SiteSurveyPage unter `/site-surveys`.

### Sprint 48 – ERP-Anbindung & Lieferantenportal ✅
- `ErpConnector` Prisma-Modell + `erp_order_ref`/`erp_connector_id` auf `PurchaseOrder`.
- `erpPushService.ts`: REST-Push mit Auth-Mapping.
- Routes: `erpConnectors.ts` (CRUD + Push-to-ERP + Webhook).
- Frontend: SupplierPortalPage unter `/supplier-portal`.

### Sprint 49 – Analytics & individuelle Reports ✅
- `ReportDefinition`, `ReportSchedule`, `ReportRun` Prisma-Modelle angelegt.
- `reports.ts`: 5 Built-in-Report-Endpunkte + Schedule-CRUD + manueller Run.
- Frontend: ReportsPage mit 3 Tabs + Inline-SVG-Charts.

### Sprint 50 – Compliance, RBAC & SLA-Management ✅
- `GdprDeletionRequest`, `SsoProvider`, `RolePermission`, `SlaSnapshot` Modelle.
- `compliance.ts`: GDPR-Anonymisierung, Daten-Export, SSO-Upsert, RBAC-CRUD, SLA-Snapshots.
- Frontend: CompliancePage mit 3 Tabs.

### Sprint 51 – GLTF/GLB-Export ✅
- `gltfExporter.ts`: Three.js BoxGeometry für Wände + Platzierungen → GLB-Buffer.
- `POST /alternatives/:id/export/gltf` in `exports.ts` ergänzt.
- GLB-Magic-Bytes (`0x46546C67`) in 5 Unit-Tests verifiziert.
- Frontend: Download-Button in Editor.

### Sprint 56 – Canvas-Editor UX ✅
- Wand-Endpunkt-Griffe (Kreis) + Mittelpunkt-Griffe (Raute) in `PolygonEditor.tsx`.
- Live-Dimensioning: fliegendes Längen-Label beim Drag.
- Stage-Sizing-Fix: ResizeObserver in `CanvasArea.tsx`.
- Keyboard-Shortcuts: `D/S/Backspace/Delete/Escape`.

**Aktueller Teststand: 409 Tests grün** (56 Test-Dateien, 2026-03-02).

## Nächste Schritte

- Sprint 52 (IFC Import/Export): Spec in `Docs/AGENT_SPRINTS/S52-ifc-import-export.md`
- Sprint 53 (DWG/SKP): Spec in `Docs/AGENT_SPRINTS/S53-dwg-skp.md`
- Sprint 54 (OFML-Konfigurator): Spec in `Docs/AGENT_SPRINTS/S54-ofml-konfigurator.md`
- Sprint 55 (Raumakustik): Spec in `Docs/AGENT_SPRINTS/S55-raumakustik.md`
- Sprint 57 (WallAttachments): Spec in `Docs/AGENT_SPRINTS/S57-wall-attachments.md`
- Sprint 58 (Bild-Nachzeichnen): Spec in `Docs/AGENT_SPRINTS/S58-bild-nachzeichnen.md`
- Sprint 59 (2D-Bemaßung): Spec in `Docs/AGENT_SPRINTS/S59-bemassung-frontansicht.md`
- Sprint 60 (Kitchen Assistant): Spec in `Docs/AGENT_SPRINTS/S60-katalog-kitchen-assistant.md`

