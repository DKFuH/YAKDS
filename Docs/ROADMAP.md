# ROADMAP.md

Sprint-Planung für MVP (Sprints 0-19), Phase 2 (Sprints 20-24) und Phase 3 (Sprints 25-30) inkl. aktuellem Fortschritt.

---

## MVP - Sprints 0-19

**Zielbild:** Nicht-rechteckige Räume, Dachschrägen, BOM/Preise/Angebote, DXF-Interop, SKP-Referenzimport, externer Render-Worker.

### Sprint-Übersicht

| Sprint | Thema | Deliverables |
|--------|-------|--------------|
| 0 | Architektur & Domänenmodell | ARCHITECTURE.md, Kerndokumente, Monorepo-Struktur |
| 1 | Backend-Grundgerüst | Projekt-CRUD, Postgres-Schema, API-Grundstruktur |
| 2 | Frontend-Grundgerüst | Projektliste, Editor-Layout, Canvas, Sidebars |
| 3 | Polygon-Raumeditor v1 | Punkte setzen, Polygon schließen, Validierung |
| 3.5 | CAD/SKP-Import Grundlagen | Upload-Pipeline, neutrales Austauschformat |
| 4 | Präzisionsbearbeitung | Vertex-Move, numerische Kantenlänge, stabile Wand-IDs |
| 5 | Öffnungen | Türen/Fenster an Wänden, Offset, Brüstungshöhe |
| 6 | Dachschrägen | CeilingConstraints, Höhenberechnung an beliebigem Punkt |
| 7 | Katalog MVP | Schrank-/Gerätetypen, Preisfelder, Warengruppen |
| 7.5 | SKP-Komponenten-Mapping | Referenzmodell, Heuristik, Mapping-Persistenz |
| 8 | Platzierungsengine v1 | wall_id + offset, Innenrichtung, Verschieben |
| 9 | Geometrieprüfung v1 | Kollisionen, Öffnungsblockierung, Mindestabstände |
| 10 | Höhenprüfung | Dachschrägen-Regeln, Preiswirkung (flags) |
| 11 | Stücklisten-Engine v1 | BOM aus Planung, `POST /calculate-bom` |
| 11.5 | DXF-Export v1 | Raumkontur + Möbel als DXF, Layer-Konventionen |
| 12 | Preisengine v1 | 9-stufige Kalkulation, netto/MwSt/brutto/DB |
| 13 | Angebotsmanagement v1 | Angebotsnummer, Versionen, PDF light |
| 14 | Browser-3D-Preview | Three.js, Extrusion, Proxy-Meshes, Orbit |
| 15 | Render-Job-System | Queue, Scene Payload, Worker-Protokoll End-to-End |
| 16 | Business-Sprint | Kundenpreislisten, CRM-Felder light, JSON/CSV-Export |
| 17 | Blockverrechnung | Blockprogramme, automatische Auswahl des besten Blocks |
| 18 | Interop-API | Asynchrone Importjobs, Prüfprotokoll, Mapping-Persistenz |
| 19 | Interop-Härtung | Roundtrip-Tests, Einheitenprüfung, Regressionstests |

### Meilensteine

| Nach Sprint | Ergebnis |
|-------------|----------|
| 6 | Echte Polygonräume mit Öffnungen und Dachschrägen |
| 8 | Erste wandbasierte Küchenplanung |
| 13 | Internes Angebots-MVP |
| 15 | Renderworkflow produktiv nutzbar |
| 19 | Vollständiges MVP: Interop + Business + Planung |

### Nicht im MVP

- Komplexe Eckschrank-Automatik, freie Rundungen
- Vollständige Dachgeometrie als CAD
- Echtzeit-Multiuser, vollwertiges ERP
- Verlustfreier SKP-Roundtrip, nativer DWG-Binary-Parser

---

## Phase 2 - Sprints 20-24

**Ausgangslage (Sprint 19):** MVP vollständig. Polygonräume + Placement + BOM + Preis + Angebote + DXF/SKP + Render-Worker alle produktiv.

**Ziel:** Funktionslücken zu etablierten Studiosystemen schließen (Herstellerkataloge, Automatismen, Prüfmodul, Mehrmandantenfähigkeit, Webplaner), ohne die bestehende Architektur zu brechen.

---

### Sprint 20 - Herstellerkatalog & Schrankkonfigurator (Light)

**Ziel:** 1 Hersteller-Import End-to-End + konfigurierbarer Schrank mit Artikel/Preis/BOM.

**Neues Datenmodell:**
- DB-Tabellen: `manufacturers`, `catalog_articles`, `article_options`, `article_variants`, `article_prices`, `article_rules`
- Domain-Typen: `Manufacturer`, `CatalogArticle`, `ArticleOption`, `ArticleVariant`, `ArticlePrice`, `ArticleRule`

**Deliverables:** Import-Pipeline (CSV/JSON), Konfigurator-UI (Breite/Höhe/Front/Griff), 30 Tests.

**DoD:** 1 Herstellerkatalog importiert, 1 konfigurierbarer Schrank platzierbar, BOM/Pricing aus `CatalogArticle` und `ArticleVariant`.

---

### Sprint 21 - Automatismen (Langteile, Zubehör, Auto-Vervollständigung)

**Ziel:** Automatische BOM-Generierung für Arbeitsplatte, Sockel, Wange, Standardzubehör.

**Scope:**
- `AutoCompletionService`: Worktop- und Sockel-Segmente entlang Cabinet-Cluster
- Autogen-Objekte als `generated` markiert, Rebuild bei Änderungen
- UI: Button "Auto vervollständigen" + Diff-View

**DoD:** Standardzeile erzeugt automatisch Worktop + Sockel in BOM; Änderungen konsistent.

---

### Sprint 22 - Prüf-Engine v2 ("Protect"-Niveau)

**Ziel:** Konfigurierbares Prüfmodul mit Kategorien, Bericht und Finalprüfung.

**Neues Datenmodell:**
- DB-Tabellen: `rule_definitions`, `rule_runs`, `rule_violations`
- Domain-Typen: `RuleDefinition`, `RuleRun`, `RuleViolationRecord`

**Mindestens 15 Regeln:** Kollision (Tür/Auszug), Abstände, Ergonomie, Vollständigkeit (Arbeitsplatte/Sockel/Blenden), Zubehör.

**DoD:** Konfigurierbarer Prüfbericht mit Filter + Jump-to-Problem + Finalprüfung.

---

### Sprint 23 - Multi-Tenant / BI-Light

**Ziel:** Vom Single-Studio zu Multi-Tenant mit KPI-Endpunkten.

**Scope:**
- `tenants`, `branches`; `tenant_id` in allen relevanten Tabellen
- API-Middleware: tenant-scope enforced
- KPI-Endpunkte: Angebote/Zeitraum, Conversion, Top-Warengruppen
- Minimal-Dashboard: KPI Cards + Zeitraumfilter

**Domain-Typen:** `Tenant`, `Branch`, `ProjectKpiSnapshot`, `KpiQuery`

**DoD:** 2 Tenants sauber getrennt, KPI-Endpunkte plausibel, Basis-Dashboard.

---

### Sprint 24 - Online-Webplaner MVP + Handover

**Ziel:** Abgespeckter Endkunden-Webplaner (Lead Gen) mit Übergabe ins Profi-Tool.

**Scope:**
- Vereinfachter Grundriss (rechteckig + Aussparungen), reduzierter Katalog, guided Wizard
- `LeadProject` wird zu `Project` im Profi-Editor promoted
- Consent + Retention Policy

**Domain-Typen:** `LeadProject`, `LeadPlanningPayload`, `LeadPromotionResult`

**DoD:** Endkunde konfiguriert Küche, Lead geht ans Studio, Studio öffnet Projekt im Profi-Editor.

---

## Risiken Phase 2

1. Herstellerkatalogtiefe professioneller Systeme ist ohne langfristige Datenpflege nicht erreichbar.
2. Automatismen müssen deterministisch und testbar sein, sonst zerlegt es Pricing/BOM.
3. Prüf-Engine braucht klare DoD, sonst entsteht Rule-Spaghetti.
4. Multi-Tenant muss früh mit Migrations- und Index-Disziplin kommen.
5. Webplaner ist ein anderes Produkt: guided UX, kein Profi-Editor.

---

## Phase 3 - Sprints 25-30

**Ausgangslage (nach Sprint 24):** Kern-Planung, Preis/BOM, Angebote, Multi-Tenant, BI-Light und Lead-Handover sind vorhanden.

**Ziel:** Entwicklung zur vollwertigen Studio-Plattform mit Projektsteuerung, Dokumentenmanagement, CRM-Light, personalisierten Dashboards, Katalogindexierung und Cloud-Workflow.

### Fortschrittssnapshot (Stand 2026-03-01)

| Sprint | Status | Hinweis |
|--------|--------|---------|
| 25 | In Arbeit | Projektboard/Gantt und Status-/Assign-Pfade bereits vorhanden, weitere Härtung offen |
| 26 | Weit umgesetzt | Dokumentrouten und Kern-Integration inkl. Auto-Attach/Download aktiv |
| 27 | Weit umgesetzt | Kontakt-API + Projektverknüpfung + CRM-Ansicht mit KPIs aktiv |
| 28 | Weit umgesetzt | DashboardConfig + KPI-Endpunkte + Dashboard-UI integriert |
| 29 | Weit umgesetzt | CatalogIndex-API + Pricing-Einfluss + Batch-UI integriert |
| 30 | In Umsetzung | Suche/Export/Notifications/Backup-Endpunkte und Frontend-Anbindung vorhanden |

### Sprint-Übersicht

| Sprint | Thema | Deliverables |
|--------|-------|--------------|
| 25 | Projekt-/Aufgabenmanagement | `project_status`, Kanban-Board, Gantt-Basis, Status-/Assign-APIs |
| 26 | Dokumentenmanagement | `Document`-Entity, Upload/Preview/Filter, S3-kompatibles Storage |
| 27 | Kontakte / CRM-Light | `Contact`-Entity, Projektverknüpfung, Webplaner-Lead-Automation |
| 28 | Personalisierte Dashboards / KPIs | `DashboardConfig`, Widget-Layout, KPI-Endpunkte |
| 29 | Katalogindexierung & Preisanpassung | `CatalogIndex`, EK/VK-Indizes, Pricing-Integration |
| 30 | Cloud-Sync & Plattform-Features | Global Search, Export, Notification-Webhooks, Auto-Backup |

### Meilenstein

| Nach Sprint | Ergebnis |
|-------------|----------|
| 30 | End-to-End-Plattform: Lead -> Planung -> Quote -> Projektmanagement -> Abschluss |

### Referenz

- Detailplanung und DoD: `Docs/PHASE_3_DOD_AND_EXECUTION_PLAN.md`

### Risiken Phase 3

1. Dokumenten-Storage und Zugriffskontrolle müssen tenant-sicher und revisionsfähig sein.
2. KPI-/Dashboard-Updates brauchen klare Latenz- und Konsistenzstrategie.
3. Preisindexierung darf die bestehende 9-stufige Kalkulation nicht regressiv beeinflussen.
4. Globale Suche benötigt robuste, domänenübergreifende Indexpflege.
5. E-Mail-/Webhook-Zustellung braucht Retry- und Fehlertoleranzkonzept.

---

## Phase 4 – Sprints 31–34: Absolute Basics & Onboarding

**Ausgangslage (nach Sprint 30):** End-to-End-Plattform vorhanden. Jetzt fehlende Grundfunktionen für den täglichen Studio-Einsatz nachrüsten.

**Ziel:** Projektsteuerung auf Dashboard-Niveau, Bereiche/Alternativen-Baumstruktur, Onboarding-Assistent und anpassbares Workspace-Layout.

---

### Sprint 31 – Projektliste & 3-Punkte-Menü

**Ziel:** Dashboard-ähnliche Projektliste mit Filtern, Suche, 3-Punkte-Menü.

**Features:**

- Projektliste-View: Filter (Status/Branch/Verkäufer), Suche.
- „Neues Projekt"-Button → Dialog: Kundenname, Adresse, Kontaktperson, Lead-Quelle.
- 3-Punkte-Menü pro Projekt (Edit, Duplicate, Delete, Archive).
- `PATCH /projects/:id/3dots?action=duplicate|archive|unarchive`.
- `GET /projects?search=…&status_filter=…&sales_rep=…`.

**DoD:** 10 Projekte anlegen, filtern/suchen, Status ändern, 3-Punkte-Menü öffnet Optionen.

---

### Sprint 32 – Bereiche / Alternativen & Modellauswahl

**Ziel:** Baumstruktur + globale Kopfdaten pro Alternative – F7 öffnet überall.

**Features:**

- Projekt-View: Baum „Bereiche > Alternativen" (Rechtsklick: Neu/Duplicate/Delete, Doppelklick öffnen).
- Modell-/Indexeinstellungen-Dialog (F7): Küchenmodell, Arbeitsplatte, Sockel/Abdeckboden, Raum.
- `POST /projects/:id/areas`, `POST /projects/:id/areas/:areaId/alternatives`.
- `GET|PUT /alternatives/:id/model-settings`.

**DoD:** Bereich/Alternative anlegen, Modell ändern → Einstellungen persistiert.

---

### Sprint 33 – Onboarding & Lernreise

**Ziel:** Neuer User kann sich selbstständig einrichten – mit Tutorials und Helpdesk-Links.

**Features:**

- Onboarding-Wizard: Nach erstem Login → „Erste Schritte": Shop-Setup, erster Katalog, Testprojekt.
- Lernreise-UI: Step-by-Step mit Icons und CTA-Buttons.
- Benachrichtigungen: „Speichern nicht automatisch – jetzt speichern?".

**DoD:** Neuer User durchläuft Wizard, findet Tutorials, öffnet Support-Centre.

---

### Sprint 34 – Workspace-Layout & Projekt-Details

**Ziel:** Layout anpassbar + Projekt-Details erweitern.

**Features:**

- Workspace-Layout: Speichern/Laden pro User.
- Projekt-Details: Fachberater/Sachbearbeiter zuweisen, Verkäufer (sales_rep) pflegen.
- `PUT /user/workspace-layout`, `PATCH /projects/:id/advisor`.

**DoD:** Berater zuweisen, Workspace-Layout speichern.

---

### Meilenstein Phase 4

| Nach Sprint | Ergebnis |
|-------------|----------|
| 34 | Volle Studio-Praxis: Onboarding, Bereiche, Modellauswahl, Workspace-Layout |

### Risiken Phase 4

1. Bereiche/Alternativen müssen konsistent mit bestehender Raum-/Placement-Logik sein.
2. Onboarding darf bestehende Auth-/User-Flows nicht brechen.
3. Workspace-Layout-Persistenz muss per User/Tenant isoliert bleiben.
