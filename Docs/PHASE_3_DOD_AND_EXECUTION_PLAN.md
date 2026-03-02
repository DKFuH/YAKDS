# PHASE_3_DOD_AND_EXECUTION_PLAN.md

Stand: 2026-03-01

---

## 1) Executive Summary: Phase-3 Definition of Done (DoD)

- **Plattform-Fokus statt Einzeltool:** OKP erweitert den Planungs- und Angebotskern um Projektsteuerung, Dokumente, Kontakte/CRM, personalisierte Dashboards und Cloud-Workflows.
- **Nahtlose Fortsetzung von Phase 2:** Alle Features bauen auf Multi-Tenant (`Sprint 23`), BI-Light (`Sprint 23`), Quotes (`Sprint 13`) und Webplaner (`Sprint 24`) auf.
- **One-Week-Sprints:** Sprints 25–30 werden als 6 aufeinanderfolgende 1‑Wochen-Inkremente umgesetzt.
- **Verbindlicher End-to-End-Flow:** Lead -> Planung -> Quote -> Projektsteuerung -> Abschluss ist in einem zusammenhängenden Cloud-Workflow testbar.

### Globales DoD für Phase 3

1. **Projekt-/Task-Management produktiv:** Projekte besitzen Status, Fristen, Prioritäten, Verantwortliche und Fortschritt; Kanban und Timeline funktionieren mandantengetrennt.
2. **Dokumentenmanagement produktiv:** Projektdateien (PDF/Bild/CAD/E-Mail/Vertrag) sind uploadbar, filterbar, versionierbar und in S3-kompatiblem Storage sicher abgelegt.
3. **CRM-Light produktiv:** Kontakte sind mit Projekten verknüpft, Webplaner-Leads werden automatisch als Contact + LeadProject angelegt.
4. **Dashboards produktiv:** Nutzer speichern Widget-Layouts und sehen KPI-/Pipeline-Werte mit zeitnahen Updates.
5. **Preisindexierung produktiv:** Projektbezogene Katalogindexe beeinflussen BOM-/Quote-Preise transparent und reproduzierbar.
6. **Cloud-Plattform produktiv:** Suche, Export, Benachrichtigungen und Auto-Backup sind tenant-sicher und end-to-end validiert.

---

## 2) Ausgangslage und Abhängigkeiten

### Technische Ausgangslage

- `Sprint 13`: Angebotslogik (`quotes`) vorhanden.
- `Sprint 23`: Multi-Tenant + BI-Light vorhanden.
- `Sprint 24`: Webplaner/Lead-Handover vorhanden.

### Verbindliche Abhängigkeiten für Phase 3

- Tenant-Scoping bleibt in allen neuen Endpunkten verpflichtend (`tenant_id` erzwungen).
- KPI-/Dashboard-Daten nutzen BI-Light-Strukturen als Datenquelle.
- Dokumente werden an bestehende Projekt-/Quote-/Render-/Import-Objekte angehängt, ohne diese zu duplizieren.
- CRM-Verknüpfung muss bestehende Projekt-Entity erweitern, nicht parallel ersetzen.

---

## 3) Sprint-Backlog (25–30)

### Sprint 25 - Projekt-/Aufgabenmanagement

- **Priorität:** Muss (P1)
- **Ziel:** Projekte mit Status, Frist, Zuständigkeit und Fortschritt steuerbar machen.

**Entity-Erweiterung (`Project`)**

```ts
project_status: 'lead' | 'planning' | 'quoted' | 'contract' | 'production' | 'installed' | 'archived';
deadline: string | null;
priority: 'low' | 'medium' | 'high';
assigned_to: string | null;
progress_pct: number;
```

**API-Contracts**

```http
GET   /projects/board?tenant_id=?&branch_id=?&status_filter=?
PATCH /projects/:id/status
PATCH /projects/:id/assign
GET   /projects/gantt
```

**DoD (Sprint 25)**

- Projekttafel zeigt alle Projekte filterbar und per Drag&Drop verschiebbar.
- Statuswechsel sind persistent und triggern optionale E-Mail-Benachrichtigungen.
- 5–10 Tests decken Kanban-Workflow (Statuswechsel, Filter, Rechte) ab.

---

### Sprint 26 - Dokumentenmanagement

- **Priorität:** Muss (P1)
- **Zuständig:** Claude Code (parallel zu Codex auf Sprint 25)
- **Status:** MVP weit umgesetzt (Härtung offen)
- **Ziel:** Alle Projektdokumente zentral ablegen, suchen und anzeigen.

**Neue Entity (`Document`)**

```ts
interface Document {
  id: string;
  project_id: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  uploaded_by: string;
  uploaded_at: string;
  type: 'quote_pdf' | 'render_image' | 'cad_import' | 'email' | 'contract' | 'other';
  tags: string[];
  is_public: boolean;
}
```

**API-Contracts**

```http
POST   /projects/:id/documents
GET    /projects/:id/documents?type=?&tag=?
DELETE /projects/:id/documents/:id
```

**DoD (Sprint 26)**

- Quote-PDFs, Renderings und Import-Jobs werden automatisch als Dokumente angehängt.
- Frontend bietet Stapel-Upload, Vorschau (PDF/Bild), Download, Suche und Tag-Filter.
- Speicherung erfolgt tenant-sicher in S3-kompatiblem Object Storage.

**Umsetzungsreihenfolge (Startpaket)**

1. `Document`-Schema + Migration inkl. Tenant-Scoping und Projekt-Relation.
2. Upload-/List-/Delete-Routen mit Typ-/Tag-Filter und Rechteprüfung.
3. Storage-Adapter (S3-kompatibel) mit Signatur/Downloadpfad.
4. Auto-Attach-Hooks für Quote-PDF, Render-Output und Import-Job.
5. Frontend-Modul mit Batch-Upload, Vorschau, Suche und Tag-Filter.

**How to verify (Sprint 26)**

- Mehrfach-Upload in ein Projekt erzeugt konsistente `Document`-Einträge.
- Typ-/Tag-Filter liefert erwartete Teilmengen ohne Cross-Tenant-Leaks.
- Löschen entfernt Metadaten und sperrt Downloadzugriff auf die Datei.
- Automatisch erzeugte Quote-/Render-/Import-Artefakte erscheinen ohne manuellen Upload.

---

### Sprint 27 - Kontakte / CRM-Light

- **Priorität:** Muss (P1)
- **Status:** MVP weit umgesetzt (Härtung offen)
- **Ziel:** Kontaktstammdaten und Projektverknüpfungen für Vertrieb und Nachverfolgung.

**Neue Entity (`Contact`)**

```ts
interface Contact {
  id: string;
  tenant_id: string;
  type: 'end_customer' | 'architect' | 'contractor';
  company: string | null;
  first_name: string | null;
  last_name: string;
  email: string | null;
  phone: string | null;
  address: Address;
  lead_source: 'web_planner' | 'showroom' | 'referral' | 'other';
  budget_estimate: number | null;
  notes: string | null;
  projects: Project[];
  created_at: string;
}
```

**API-Contracts**

```http
GET  /contacts?tenant_id=?&search=?
POST /contacts
POST /projects/:id/contacts/:contactId
```

**DoD (Sprint 27)**

- Kontakte sind vollständig mit Projekten (1:n bzw. n:m je nach Modell) verknüpft.
- Webplaner-Leads erzeugen automatisch `Contact` + `LeadProject`.
- Übersicht zeigt pro Kontakt Projektanzahl, Umsatz und Conversion.

---

### Sprint 28 - Personalisierte Dashboards / KPIs

- **Priorität:** Soll (P1)
- **Zuständig:** Claude Code
- **Status:** MVP weit umgesetzt (Härtung offen)
- **Ziel:** Rollen-/nutzerspezifische Steuerungsansichten mit KPI-Widgets.

**Neue Entity (`DashboardConfig`)**

```ts
interface DashboardConfig {
  id: string;
  user_id: string;
  widgets: WidgetConfig[];
  layout: GridLayout;
}
```

**Standard-Widgets (MVP in Sprint 28)**

- `sales_chart` - Umsatzvergleich (aktuell vs. Referenzzeitraum)
- `current_projects` - Offene Projekte nach Status/Branch
- `current_contacts` - Neue Leads/Kontakte
- `kpi_cards` - Angebote, Conversion, Durchschnittsumsatz
- `project_pipeline` - Statusverteilung aus Kanban

**API-Contracts**

```http
GET /dashboards/:userId
PUT /dashboards/:userId
GET /kpis/sales-chart?period=month
```

**DoD (Sprint 28)**

- User können Dashboard konfigurieren, speichern und wiederherstellen.
- Projekt-/Quote-Änderungen aktualisieren KPI-Werte zeitnah.
- 4–5 Standard-Widgets sind produktiv verfügbar.

**Umsetzungsreihenfolge (Startpaket)**

1. `DashboardConfig`-Schema + Migration (pro `user_id`, tenant-sicher).
2. API `GET/PUT /dashboards/:userId` mit Layout-/Widget-Validierung.
3. KPI-Endpunkt `GET /kpis/sales-chart?period=month` auf BI-Light-Daten aufsetzen.
4. Frontend-Container mit persistierbarer Widget-Anordnung implementieren.
5. MVP-Widgets (`sales_chart`, `current_projects`, `current_contacts`, `kpi_cards`, `project_pipeline`) anbinden.

**How to verify (Sprint 28)**

- Widget-Layout ändern -> speichern -> Reload zeigt identische Anordnung.
- KPI-Werte reagieren auf neue/aktualisierte Projekte und Angebote.
- Nutzer A/B sehen eigene Dashboard-Konfigurationen, kein Cross-User-Leak.
- API validiert ungültige Widget-IDs/Layout-Slots mit 400.

---

### Sprint 29 - Katalogindexierung & Preisanpassung

- **Priorität:** Muss (P1)
- **Status:** MVP weit umgesetzt (Härtung offen)
- **Ziel:** Projektbezogene EK/VK-Indexe ohne Katalogmutation unterstützen.

**Neue Entity (`CatalogIndex`)**

```ts
interface CatalogIndex {
  id: string;
  project_id: string;
  catalog_id: string;
  purchase_index: number;
  sales_index: number;
  applied_at: string;
  applied_by: string;
}
```

**API-Contracts**

```http
POST /projects/:id/catalog-indices
GET  /projects/:id/catalog-indices
```

**DoD (Sprint 29)**

- Indexe fließen reproduzierbar in Pricing/BOM/Quote ein.
- UI erlaubt Massen-Indexierung mehrerer Kataloge.
- Regressionstests schützen bestehende 9-stufige Kalkulationslogik.

---

### Sprint 30 - Cloud-Sync & Plattform-Features

- **Priorität:** Muss (P1)
- **Status:** In Umsetzung (Kern-Endpoints integriert)
- **Ziel:** Plattformweite Cloud-Funktionalität inkl. Suche, Export und Notifications.

**Scope**

- Tägliche Backups für Projekte/Quotes in Cloud-Storage.
- Globale Suche über Projekte/Kontakte/Dokumente.
- E-Mail-Integration für kritische Ereignisse.
- CSV/Excel-Export für Listen.
- Tenant-weite Einstellungen (Logo, Templates, Währung).

**API-Contracts**

```http
GET  /search?q=term&type=project|contact|document
POST /webhooks/email-notifications
GET  /projects/export-csv
```

**DoD (Sprint 30)**

- Plattform ist cloud-fähig (Sync, Suche, Export).
- Kritische Events erzeugen E-Mail-Benachrichtigungen.
- End-to-End-Test besteht: Lead -> Planung -> Quote -> Projektmanagement -> Abschluss.

---

## 4) Übersichtstabelle Phase 3

| Sprint | Thema | Schlüsselobjekte | API-Highlights |
|---|---|---|---|
| 25 | Projekt-/Aufgabenmanagement | `project_status`, `deadline`, `priority`, `assigned_to` | `/projects/board`, `/projects/gantt`, `/projects/:id/status` |
| 26 | Dokumentenmanagement | `Document` | `/projects/:id/documents` |
| 27 | Kontakte / CRM-Light | `Contact`, `lead_source` | `/contacts`, `/projects/:id/contacts/:contactId` |
| 28 | Dashboards / KPIs | `DashboardConfig`, `WidgetConfig` | `/dashboards/:userId`, `/kpis/*` |
| 29 | Katalogindexierung | `CatalogIndex` | `/projects/:id/catalog-indices` |
| 30 | Cloud-Sync & Plattform | Backup/Global Search/Notifications | `/search`, `/projects/export-csv`, `/webhooks/email-notifications` |

---

## 5) Reihenfolgeplan (6 Wochen)

### Woche 1 (Sprint 25)

- Projektstatusmodell, Board-API, Kanban-UI, Gantt-Basis.

### Woche 2 (Sprint 26)

- Document-Entity, Upload-/Storage-Pipeline, Frontend-Vorschau/Filter.

### Woche 3 (Sprint 27)

- Contact-Entity, Projekt-Kontakt-Relation, Webplaner-Lead-Mapping.

### Woche 4 (Sprint 28)

- DashboardConfig, Widget-Rendering, KPI-Anbindung.

### Woche 5 (Sprint 29)

- CatalogIndex-Entity, Pricing-Integration, Sichtbarkeit in BOM/Quote.

### Woche 6 (Sprint 30)

- Auto-Backup, globale Suche, Exporte, Notification-Flow, E2E-Abnahme.

---

## 6) Risiken und offene Architekturfragen

1. **Storage/Compliance:** Retention, Zugriffspfade und Public-Links für Dokumente müssen tenant-sicher und DSGVO-konform definiert sein.
2. **Realtime-Anspruch:** "Echtzeit" bei Dashboards braucht klare SLA (Polling vs. Eventing/WebSocket).
3. **Pricing-Stabilität:** Katalogindexierung darf die bestehende 9-stufige Preislogik nicht regressiv beeinflussen.
4. **Suche über Domänen:** Global Search braucht konsistente Indizierungsstrategie über Projekte, Kontakte und Dokumente.
5. **E-Mail-Zuverlässigkeit:** Notification-Webhooks benötigen Retry-/Dead-Letter-Strategie.

---

## 7) Meilenstein nach Phase 3

Nach Sprint 30 ist OKP eine vollständige Studio-Plattform mit End-to-End-Flow von Lead-Erfassung über Planung/Angebot bis Projekt-, Dokumenten- und Kundenmanagement inklusive personalisierter Auswertung und Cloud-Betrieb.