# ROADMAP.md

Sprint-Planung für MVP (Sprints 0–19), Phase 2 (Sprints 20–24), Phase 3 (Sprints 25–30), Phase 4 (Sprints 31–40), Phase 5 (Sprints 41–45), Phase 6 (Sprints 46–50), Phase 7 (Sprints 51–55), Phase 8 (Sprints 56–60) und Phase 9 (Infrastruktur & Integration) inkl. aktuellem Fortschritt. Stand: 2026-03-03.

---

## Status-Taxonomie

Einheitliche Status-Kennzeichnung für alle Sprints und Snapshots:

| Status | Bedeutung |
|--------|-----------|
| `planned` | Geplant, noch nicht begonnen |
| `in_progress` | In aktiver Umsetzung |
| `blocked` | Blockiert – Abhängigkeit oder Risiko offen |
| `done` | Implementiert, ggf. noch nicht vollständig abgesichert |
| `hardened` | Implementiert + Tests + Regression abgesichert |

---

## MVP - Sprints 0-19

**Zielbild:** Nicht-rechteckige Räume, Dachschrägen, BOM/Preise/Angebote, DXF-Interop, SKP-Referenzimport, externer Render-Worker.

### Sprint-Übersicht

| Sprint | Status | Thema | Deliverables |
|--------|--------|-------|--------------|
| 0 | `hardened` | Architektur & Domänenmodell | ARCHITECTURE.md, Kerndokumente, Monorepo-Struktur |
| 1 | `hardened` | Backend-Grundgerüst | Projekt-CRUD, Postgres-Schema, API-Grundstruktur |
| 2 | `hardened` | Frontend-Grundgerüst | Projektliste, Editor-Layout, Canvas, Sidebars |
| 3 | `hardened` | Polygon-Raumeditor v1 | Punkte setzen, Polygon schließen, Validierung |
| 3.5 | `hardened` | CAD/SKP-Import Grundlagen | Upload-Pipeline, neutrales Austauschformat |
| 4 | `hardened` | Präzisionsbearbeitung | Vertex-Move, numerische Kantenlänge, stabile Wand-IDs |
| 5 | `hardened` | Öffnungen | Türen/Fenster an Wänden, Offset, Brüstungshöhe |
| 6 | `hardened` | Dachschrägen | CeilingConstraints, Höhenberechnung an beliebigem Punkt |
| 7 | `hardened` | Katalog MVP | Schrank-/Gerätetypen, Preisfelder, Warengruppen |
| 7.5 | `hardened` | SKP-Komponenten-Mapping | Referenzmodell, Heuristik, Mapping-Persistenz |
| 8 | `hardened` | Platzierungsengine v1 | wall_id + offset, Innenrichtung, Verschieben |
| 9 | `hardened` | Geometrieprüfung v1 | Kollisionen, Öffnungsblockierung, Mindestabstände |
| 10 | `hardened` | Höhenprüfung | Dachschrägen-Regeln, Preiswirkung (flags) |
| 11 | `hardened` | Stücklisten-Engine v1 | BOM aus Planung, `POST /calculate-bom` |
| 11.5 | `hardened` | DXF-Export v1 | Raumkontur + Möbel als DXF, Layer-Konventionen |
| 12 | `hardened` | Preisengine v1 | 9-stufige Kalkulation, netto/MwSt/brutto/DB |
| 13 | `hardened` | Angebotsmanagement v1 | Angebotsnummer, Versionen, PDF light |
| 14 | `hardened` | Browser-3D-Preview | Three.js, Extrusion, Proxy-Meshes, Orbit |
| 15 | `hardened` | Render-Job-System | Queue, Scene Payload, Worker-Protokoll End-to-End |
| 16 | `hardened` | Business-Sprint | Kundenpreislisten, CRM-Felder light, JSON/CSV-Export |
| 17 | `hardened` | Blockverrechnung | Blockprogramme, automatische Auswahl des besten Blocks |
| 18 | `hardened` | Interop-API | Asynchrone Importjobs, Prüfprotokoll, Mapping-Persistenz |
| 19 | `hardened` | Interop-Härtung | Roundtrip-Tests, Einheitenprüfung, Regressionstests |

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

### Sprint-Metadaten (MVP)

| Sprint | Owner | ETA | Abhängigkeiten | DoD-Kurzfassung |
|--------|-------|-----|----------------|-----------------|
| 0 | Arch-Lead | MVP | – | ARCHITECTURE.md fertig; Team-Alignment über Domänenmodell |
| 1 | Backend-Lead | MVP | S0 | `GET/POST/PATCH/DELETE /projects` mit Postgres-Persistenz |
| 2 | Frontend-Lead | MVP | S0 | Projektliste + Editor-Layout renderbar |
| 3 | Full-Stack | MVP | S1, S2 | Polygon schließbar, validiert, API persistiert |
| 3.5 | Interop-Lead | MVP | S3 | Upload-Endpunkt aktiv, neutrales Format parsebar |
| 4 | Frontend-Lead | MVP | S3 | Vertex verschiebbar, Kantenlänge numerisch eingebbar |
| 5 | Frontend-Lead | MVP | S4 | Tür/Fenster platzierbar, Offset konfigurierbar |
| 6 | Full-Stack | MVP | S5 | CeilingConstraints berechenbar an beliebigem Punkt |
| 7 | Backend-Lead | MVP | S1 | Katalog-CRUD, Preisfelder, Warengruppen aktiv |
| 7.5 | Interop-Lead | MVP | S3.5, S7 | SKP hochladbar, Komponenten gemappt, Mapping persistiert |
| 8 | Full-Stack | MVP | S5, S7 | Möbel wandgebunden platziert und verschiebbar |
| 9 | Backend-Lead | MVP | S8 | Kollisionsprüfung aktiv, Mindestabstände geprüft |
| 10 | Backend-Lead | MVP | S9, S6 | Höhenregeln greifen, Preiswirkung (flags) korrekt |
| 11 | Backend-Lead | MVP | S10 | BOM vollständig via `POST /calculate-bom` |
| 11.5 | Interop-Lead | MVP | S3.5, S11 | DXF-Export Layer-konform und reimportierbar |
| 12 | Backend-Lead | MVP | S11 | 9-stufige Kalkulation korrekt (netto/MwSt/brutto/DB) |
| 13 | Backend-Lead | MVP | S12 | Angebot erstell-/versionierbar, PDF generierbar |
| 14 | Frontend-Lead | MVP | S8 | 3D-Preview vollständig im Browser renderbar |
| 15 | Full-Stack | MVP | S14 | Render-Job End-to-End durchlaufen (queue→done) |
| 16 | Backend-Lead | MVP | S13 | Preislisten, CRM-Felder, JSON/CSV-Export aktiv |
| 17 | Backend-Lead | MVP | S12, S16 | Blockprogramme automatisch ausgewählt, BOM korrekt |
| 18 | Interop-Lead | MVP | S3.5, S7.5 | Import-Jobs asynchron, Prüfprotokoll vollständig |
| 19 | Interop-Lead | MVP | S18 | Roundtrip-Tests grün, Einheitenprüfung abgesichert |

### Interop-Support-Matrix (MVP)

Abgrenzung der im MVP unterstützten und explizit nicht unterstützten Interop-Funktionen:

| Format | Import | Export | Garantie | Anmerkung |
|--------|--------|--------|----------|-----------|
| DXF 2D | ✅ | ✅ | Lossless (Raumkontur + Layer) | `$INSUNITS`-Normierung; unbekannte Codes → `needs_review` |
| DWG 2D | ⚠️ | ❌ | Best-effort (Review-Flag) | Kein nativer Binary-Parser; Job endet mit `needs_review` |
| SKP | ✅ | ❌ | Referenzmodell (kein Roundtrip) | GLTF-Preview; kein Rückschreiben ins Original |
| CSV/JSON (Katalog) | ✅ | ✅ | Vollständig | Herstellerkatalog-Import und BOM-Export |

**Einheiten:** Intern immer Millimeter. DXF-Export: `$INSUNITS=4` (mm). DXF-Import: Einheitenkonvertierung per `$INSUNITS`-Code.

**Nicht im MVP (explizit ausgeschlossen):** Verlustfreier SKP-Roundtrip · Nativer DWG-Binary-Parser · GLTF/GLB-Export · IFC.

Vollständige Interop-Dokumentation: [`Docs/INTEROP.md`](./INTEROP.md)

---

## Phase 2 - Sprints 20-24

**Ausgangslage (Sprint 19):** MVP vollständig. Polygonräume + Placement + BOM + Preis + Angebote + DXF/SKP + Render-Worker alle produktiv.

**Ziel:** Funktionslücken zu etablierten Studiosystemen schließen (Herstellerkataloge, Automatismen, Prüfmodul, Mehrmandantenfähigkeit, Webplaner), ohne die bestehende Architektur zu brechen.

---

### Sprint 20 - Herstellerkatalog & Schrankkonfigurator (Light)

**Meta:** Status: `done` · Owner: Backend-Lead · ETA: Phase 2 · Abhängigkeiten: S19

**Ziel:** 1 Hersteller-Import End-to-End + konfigurierbarer Schrank mit Artikel/Preis/BOM.

**Neues Datenmodell:**
- DB-Tabellen: `manufacturers`, `catalog_articles`, `article_options`, `article_variants`, `article_prices`, `article_rules`
- Domain-Typen: `Manufacturer`, `CatalogArticle`, `ArticleOption`, `ArticleVariant`, `ArticlePrice`, `ArticleRule`

**Deliverables:** Import-Pipeline (CSV/JSON), Konfigurator-UI (Breite/Höhe/Front/Griff), 30 Tests.

**DoD:** 1 Herstellerkatalog importiert, 1 konfigurierbarer Schrank platzierbar, BOM/Pricing aus `CatalogArticle` und `ArticleVariant`.

---

### Sprint 21 - Automatismen (Langteile, Zubehör, Auto-Vervollständigung)

**Meta:** Status: `done` · Owner: Full-Stack · ETA: Phase 2 · Abhängigkeiten: S20

**Ziel:** Automatische BOM-Generierung für Arbeitsplatte, Sockel, Wange, Standardzubehör.

**Scope:**
- `AutoCompletionService`: Worktop- und Sockel-Segmente entlang Cabinet-Cluster
- Autogen-Objekte als `generated` markiert, Rebuild bei Änderungen
- UI: Button "Auto vervollständigen" + Diff-View

**DoD:** Standardzeile erzeugt automatisch Worktop + Sockel in BOM; Änderungen konsistent.

---

### Sprint 22 - Prüf-Engine v2 ("Protect"-Niveau)

**Meta:** Status: `done` · Owner: Backend-Lead · ETA: Phase 2 · Abhängigkeiten: S20, S21

**Ziel:** Konfigurierbares Prüfmodul mit Kategorien, Bericht und Finalprüfung.

**Neues Datenmodell:**
- DB-Tabellen: `rule_definitions`, `rule_runs`, `rule_violations`
- Domain-Typen: `RuleDefinition`, `RuleRun`, `RuleViolationRecord`

**Mindestens 15 Regeln:** Kollision (Tür/Auszug), Abstände, Ergonomie, Vollständigkeit (Arbeitsplatte/Sockel/Blenden), Zubehör.

**DoD:** Konfigurierbarer Prüfbericht mit Filter + Jump-to-Problem + Finalprüfung.

---

### Sprint 23 - Multi-Tenant / BI-Light

**Meta:** Status: `done` · Owner: Backend-Lead · ETA: Phase 2 · Abhängigkeiten: S22

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

**Meta:** Status: `done` · Owner: Full-Stack · ETA: Phase 2 · Abhängigkeiten: S23

**Ziel:** Abgespeckter Endkunden-Webplaner (Lead Gen) mit Übergabe ins Profi-Tool.

**Scope:**
- Vereinfachter Grundriss (rechteckig + Aussparungen), reduzierter Katalog, guided Wizard
- `LeadProject` wird zu `Project` im Profi-Editor promoted
- Consent + Retention Policy

**Domain-Typen:** `LeadProject`, `LeadPlanningPayload`, `LeadPromotionResult`

**DoD:** Endkunde konfiguriert Küche, Lead geht ans Studio, Studio öffnet Projekt im Profi-Editor.

---

### Security & Tenant-Isolation (Phase 2)

**AuthN/AuthZ:** JWT-basiertes Session-Token; Rollen (`admin`, `planner`, `viewer`) werden in der `users`-Tabelle pro Tenant verwaltet. Alle API-Endpunkte prüfen `tenant_id` aus dem Token-Payload gegen die angefragte Ressource.

**Storage-Isolation:** Jede Tenant-Ressource (Dokumente, Exporte) erhält Bucket-Prefix `tenant-{id}/`. Keine Cross-Tenant-Zugriffe über geteilte Endpunkte. Signed URLs für Datei-Downloads; Direktzugriff auf S3-Bucket geblockt.

**Migrations-/Index-Disziplin:** Alle neuen Tabellen aus Sprint 20–24 erhalten `tenant_id NOT NULL` mit FK + Index. Migrations werden im Rahmen des Sprint-DoD als Gate geprüft: Migration schlägt fehl → Sprint gilt nicht als `done`. Rückwärtskompatible Migrationen; kein Löschen bestehender Spalten ohne Deprecation-Vorlauf.

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

| Sprint | Status | Owner | ETA | Hinweis |
|--------|--------|-------|-----|---------|
| 25 | `done` | Full-Stack | Phase 3 | Projektboard/Gantt und Status-/Assign-Pfade aktiv |
| 26 | `done` | Backend-Lead | Phase 3 | Dokumentrouten und Kern-Integration inkl. Auto-Attach/Download aktiv |
| 27 | `done` | Backend-Lead | Phase 3 | Kontakt-API + Projektverknüpfung + CRM-Ansicht mit KPIs aktiv |
| 28 | `done` | Full-Stack | Phase 3 | DashboardConfig + KPI-Endpunkte + Dashboard-UI integriert |
| 29 | `done` | Backend-Lead | Phase 3 | CatalogIndex-API + Pricing-Einfluss + Batch-UI integriert |
| 30 | `done` | Full-Stack | Phase 3 | Suche/Export/Notifications/Backup-Endpunkte und Frontend-Anbindung aktiv |

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

### Security & Tenant-Isolation (Phase 3)

**AuthN/AuthZ:** Tenant-Scope-Middleware (`tenant_id` aus JWT) wird auf alle neuen Routen (Dokumente, Kontakte, Dashboards, Katalog-Index) angewendet. DMS-Zugriffskontrolle: Lesezugriff auf Dokumente erfordert `viewer`-Rolle im jeweiligen Tenant.

**Storage-Isolation:** Dokument-Uploads (Sprint 26) werden unter `tenant-{id}/documents/{doc-id}` gespeichert. Download-URLs sind Signed URLs mit TTL ≤ 1 h. Audit-Log bei Upload/Download/Löschung erforderlich (wer, wann, welches Dokument).

**Migrations-/Index-Disziplin:** Alle neuen Entities (Dokumente, Kontakte, Dashboard-Configs, CatalogIndex) erhalten `tenant_id NOT NULL` + Index als **Gate für Sprint-DoD**. Schema-Änderungen an bestehenden Kern-Tabellen (z. B. `projects`, `quotes`) erfordern separates Migrations-Review.

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

**Meta:** Status: `done` · Owner: Full-Stack · ETA: Phase 4 · Abhängigkeiten: S30

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

**Meta:** Status: `done` · Owner: Full-Stack · ETA: Phase 4 · Abhängigkeiten: S31

**Ziel:** Baumstruktur + globale Kopfdaten pro Alternative – F7 öffnet überall.

**Features:**

- Projekt-View: Baum „Bereiche > Alternativen" (Rechtsklick: Neu/Duplicate/Delete, Doppelklick öffnen).
- Modell-/Indexeinstellungen-Dialog (F7): Küchenmodell, Arbeitsplatte, Sockel/Abdeckboden, Raum.
- `POST /projects/:id/areas`, `POST /projects/:id/areas/:areaId/alternatives`.
- `GET|PUT /alternatives/:id/model-settings`.

**DoD:** Bereich/Alternative anlegen, Modell ändern → Einstellungen persistiert.

---

### Sprint 33 – Onboarding & Lernreise

**Meta:** Status: `done` · Owner: Frontend-Lead · ETA: Phase 4 · Abhängigkeiten: S31, S32

**Ziel:** Neuer User kann sich selbstständig einrichten – mit Tutorials und Helpdesk-Links.

**Features:**

- Onboarding-Wizard: Nach erstem Login → „Erste Schritte": Shop-Setup, erster Katalog, Testprojekt.
- Lernreise-UI: Step-by-Step mit Icons und CTA-Buttons.
- Benachrichtigungen: „Speichern nicht automatisch – jetzt speichern?".

**DoD:** Neuer User durchläuft Wizard, findet Tutorials, öffnet Support-Centre.

---

### Sprint 34 – Workspace-Layout & Projekt-Details

**Meta:** Status: `done` · Owner: Frontend-Lead · ETA: Phase 4 · Abhängigkeiten: S33

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

### Security & Tenant-Isolation (Phase 4)

**AuthN/AuthZ:** Neue Endpunkte (Bereiche, Alternativen, Workspace-Layout) erben Tenant-Scope-Middleware aus Phase 2/3. Workspace-Layouts werden per `user_id + tenant_id` isoliert gespeichert – kein Cross-User-Zugriff.

**Datenisolation:** Bereiche und Alternativen erhalten `tenant_id` in der DB. Projekt-3-Punkte-Aktionen (Duplizieren, Archivieren) prüfen Tenant-Zugehörigkeit, bevor Operationen ausgeführt werden.

**Migrations-/Index-Disziplin:** Neue Tabellen (`areas`, `alternatives`, `model_settings`, `workspace_layouts`) erhalten `tenant_id NOT NULL` + Index als Sprint-DoD-Gate.

### Risiken Phase 4

1. Bereiche/Alternativen müssen konsistent mit bestehender Raum-/Placement-Logik sein.
2. Onboarding darf bestehende Auth-/User-Flows nicht brechen.
3. Workspace-Layout-Persistenz muss per User/Tenant isoliert bleiben.

---

## Phase 5 – Sprints 41–45: Profi-Parität (Profi-Workflow)

**Ausgangslage (nach Sprint 40):** Vollständige Studio-Plattform inkl. Makros, Arbeitsplattenschemas, Annotationen, Raumdekoration, Lichtprofile und manuelle Angebotszeilen.

**Ziel:** Funktionslücken zu professionellen Küchenstudio-Systemen schließen.

---

### Sprint 41 – Planungseffizienz: Passstücke, Höhentypen & Sockeloptionen

**Meta:** Status: `done` · Owner: Full-Stack · ETA: Phase 5 · Abhängigkeiten: S34, S8

**Ziel:** Automatisierte Füllstück-Generierung + farbcodierte Höhenzonierung + flexible Sockeloptionen.

**Features:**

- **Passstücke (Filler pieces):** Verbleibende Wandfläche zwischen Schrankreihe und Wand automatisch mit Passst­ück füllen; Fangpunkt-Korrektur wenn Wandabstand aktiv ist; Passstück-Größe folgt verfügbarer Fläche.
- **Höhentypen (farbcodiert):** Unterscheidung von Unterschrank / Oberschrank / Hochschrank per farblicher Markierung in Grundriss und Seitenansicht; Sonderhöhe frei definierbar.
- **Sockeloptionen:** Konfigurierbare Einrückung des Sockels (z. B. 0 mm = bündig zur Korpusvorderkante); gilt gleichzeitig für alle markierten Schränke; Sockeloption pro Alternative persistiert.

**Neues Datenmodell:**
- `filler_pieces` – generierte Passstücke (wall_id, position, width_mm, height_mm, `generated: true`)
- `height_zones` – Zonendefinition (label, color, height_range_mm) pro Planung
- `plinth_options` – Einrückung pro Alternative/Schrank-Gruppe

**Deliverables:** `FillerService`, Höhentypen-Palette in UI, Sockeloption-Dialog, 20 Tests.

**DoD:** Passstück wird bei freier Wandfläche automatisch vorgeschlagen und platziert; Höhentypen sichtbar; Sockel-Einrückung ändert sich sofort in Ansicht.

---

### Sprint 42 – Angebotsworkflow: Schreibschutz, Aufschläge & EK-Nachtrag

**Meta:** Status: `done` · Owner: Backend-Lead · ETA: Phase 5 · Abhängigkeiten: S41, S13

**Ziel:** Angebotsversand sperrt Alternative; Negativ-Rabatt-Konvention korrekt implementiert; EK nach Auftragsbestätigung nachtragbar.

**Features:**

- **Schreibschutz nach Angebotsversand:** Erster Ausdruck / erster PDF-Export setzt Alternative auf Status `angebot_gesendet` → schreibgeschützt; nachträgliche Änderungen erzwingen neues Alternativ-Objekt (Branch from locked). UI-Hinweis bei Bearbeitungsversuch.
- **Negativ-Rabatt = Aufschlag:** Im Rabattfeld gilt: positiver Wert = prozentualer Abzug, negativer Wert = prozentualer Aufschlag. Reihenfolge bleibt: Artikel → Warengruppe → Gesamtsumme. UI-Label und Tooltip explizit dokumentieren.
- **EK-Preis nach Auftragsbestätigung:** Workflow: Bestellung drucken → AB vom Hersteller abwarten → EK-Preise pro Position nachtragen. Felder initial leer/gesperrt; entsperrbar nach Statuswechsel `bestellt`. Zeigt realen Bruttogewinn und DB nach EK-Eintrag.
- **Preisberechnung-Anzeige:** Einblendbar: EK, Bruttogewinn (€ + %), Deckungsbeitrag. Toggle pro Angebotsansicht.

**Neues Datenmodell:**
- `alternatives.status` erweitern: `draft | angebot_gesendet | bestellt | abgeschlossen`
- `quote_positions.purchase_price` – nullable, befüllbar nach `bestellt`
- Bestehende Rabattlogik: `discount_value` mit Vorzeichen (negativ = Aufschlag)

**Deliverables:** Status-Machine für Alternative, Lock-Guard in API, EK-Eingabe-UI, 25 Tests.

**DoD:** Alternative nach Versand nicht mehr editierbar ohne Branch; negativer Rabatt addiert Aufschlag korrekt; EK-Felder nach `bestellt` befüllbar; DB wird korrekt angezeigt.

---

### Sprint 43 – UX & Eingabe: Taschenrechner, Favoriten & Vorlagen

**Meta:** Status: `done` · Owner: Frontend-Lead · ETA: Phase 5 · Abhängigkeiten: S42

**Ziel:** Alltagskomfort im Planer: Rechenketten in Maßfeldern, Favoriten-Filter, Modellvorlagen.

**Features:**

- **Taschenrechnerfunktion in Maßfeldern:** Überall wo Zahlen frei eingegeben werden (Breite, Höhe, Offset, Abstand) können Rechenketten eingegeben werden (z. B. `2500-1632`, `600+150`). Auswertung on-Blur, Fehlerstate bei ungültigem Ausdruck.
- **Favoriten (Artikel & Modelle):** Artikel und Modelle im Katalog als Favorit markierbar (Stern-Icon). Filter „Nur Favoriten" in Katalog-Sidebar. Favoriten per User persistiert.
- **Vorlagen (Modell-Schnellzugriff):** Häufig genutzte Modell-/Indexkonfigurationen als Vorlage speichern und benennen. Vorlagen-Dropdown im Modell-/Indexeinstellungs-Dialog (F7). Makros passen sich automatisch an Modelleinstellungen an, wenn Hersteller identisch; individuelle Änderungen via „Modell wechseln" bleiben erhalten.
- **Planungspfeil-Steuerung:** Planungspfeil rotierbar in 45°-Schritten via Pfeiltasten; Objekte verschieben entlang Blickrichtung des Planungspfeils (wie Achsenbindung).

**Neues Datenmodell:**
- `user_favorites` – (user_id, entity_type, entity_id)
- `model_templates` – (user_id, name, model_settings JSON)

**Deliverables:** `ExpressionInputField`-Komponente, Favoriten-API + UI, Vorlagen-CRUD, Planungspfeil-Tastatursteuerung, 20 Tests.

**DoD:** `2500-1632` in Maßfeld ergibt 868; Favorit gespeichert; Vorlage laden befüllt F7-Dialog; Planungspfeil dreht per Pfeiltaste.

---

### Sprint 44 – Druck & Export: Batchdruck, S/W-Modus & befristeter Link

**Meta:** Status: `done` · Owner: Full-Stack · ETA: Phase 5 · Abhängigkeiten: S43, S13

**Ziel:** Druckworkflow professionalisieren: mehrere Formulare auf einmal, Schwarz/Weiß, zeitbegrenzte Freigabelinks.

**Features:**

- **Batchdrucke:** Mehrere Ausdrucksformulare (Grundriss, Ansichten, Angebot, Installationsplan, …) in einem einzigen PDF-Job zusammenführen und drucken/exportieren. Konfigurierbare Batch-Profile (welche Formulare, welche Reihenfolge).
- **Schwarz/Weiß Druckmodus:** Pro Ansichtsfenster umschaltbar (Rechtsklick → „Schwarz/Weiß anzeigen"). Exportiert Strichzeichnung statt Farbausdruck – ideal für Montageunterlagen.
- **Zeitlich befristeter Share-Link:** Beim Erstellen eines Freigabe-Links Ablaufdatum in Tagen konfigurierbar. Link nach Ablauf ungültig (HTTP 410); kann verlängert werden.
- **Ausdrucksformulare anpassen:** UI zum Erstellen, Bearbeiten, Löschen von Formulartemplates (welche Fenster, Maße, Positionsnummern, Installationsplan ein/aus). Einstellung in Allgemeine Einstellungen → Ausdrucke.

**Neues Datenmodell:**
- `print_batch_profiles` – (name, form_ids[], user_id)
- `share_links.expires_at` – nullable, timestamp

**Deliverables:** Batch-PDF-Service, S/W-Toggle in Ansicht, Link-Ablauf-Logik, Formular-Template-CRUD, 20 Tests.

**DoD:** Batchdruck erzeugt zusammengeführtes PDF; S/W-Export liefert Strichzeichnung; Share-Link nach Ablauf nicht mehr abrufbar; eigenes Formular-Template anwendbar.

---

### Sprint 45 – Erweiterte Planung: Nischenverkleidung, Abdeckboden & Tiefenkürzung

**Meta:** Status: `done` · Owner: Full-Stack · ETA: Phase 5 · Abhängigkeiten: S44, S33

**Ziel:** Spezielle Schranktypen und Maßanpassungen mit korrekter BOM- und Preiswirkung.

**Features:**

- **Nischenverkleidungen:** Eigener Schranktyp „Nischenverkleidung". Prüfregel: seitlicher Überstand der Arbeitsplatte berücksichtigen (bündig planen). Wenn Nischenverkleidung ein Installationsobjekt überdeckt, wird Wandabstand des Installationsobjekts automatisch so weit erhöht, dass es auf der Verkleidungsfläche sitzt.
- **Abdeckboden:** Automatisch auf Highboard-Schränken gesetzt (konfigurierbar). Bei Eigenschaften-Änderung (z. B. Regal verhindert automatischen Abdeckboden) wird nach Korrektur der korrekte (ggf. größere) Abdeckboden neu generiert und entsprechend bestellt.
- **Tiefenkürzung:** Tiefe einzelner Schränke in den Eigenschaften abweichend einstellbar. Löst Mehrpreis-Flag in BOM aus (Kennzeichnung `custom_depth: true`). Unterscheidung: bauseits (Montagekosten) vs. nicht-bauseits (Herstellerkosten bei Arbeitsplatten/Abdeckboden).
- **Ansichtenschnitt Richtungswechsel:** Rechtsklick auf Ansichtenschnitt-Pfeil → „Richtung wechseln" kehrt Blickrichtung auf andere Seite um.

**Neues Datenmodell:**
- `cabinet_properties.custom_depth_mm` – nullable, löst `surcharge_flag: true` in BOM
- `cabinet_properties.cost_type` – enum `bauseits | nicht_bauseits`
- `cover_panels` – generierte Abdeckböden (auto-rebuild-fähig)

**Deliverables:** Nischenverkleidungs-Typ, Abdeckboden-Service mit Rebuild, Tiefenkürzungs-Eigenschaft + BOM-Flag, Richtungswechsel-Kontextmenü, 25 Tests.

**DoD:** Nischenverkleidung verschiebt Installationsobjekt korrekt; Abdeckboden wird nach Eigenschaftskorrektur neu generiert; Tiefenkürzung erzeugt Mehrpreis-Zeile in BOM; Ansichtenschnitt dreht Richtung.

---

### Meilenstein Phase 5

| Nach Sprint | Ergebnis |
|-------------|----------|
| 45 | Profi-Parität: Passstücke, Angebotsworkflow, Taschenrechner, Favoriten, Batchdruck, Nischenverkleidung |

### Security & Tenant-Isolation (Phase 5)

**AuthN/AuthZ:** Alternativen-Schreibschutz (Sprint 42) ist API-seitig über `alternatives.status`-Prüfung abgesichert – kein Frontend-Only-Lock. Statusübergänge (`draft → angebot_gesendet → bestellt`) sind ausschließlich über autorisierte Endpunkte erlaubt.

**Datenisolation:** `user_favorites` und `model_templates` erhalten `user_id + tenant_id`. Share-Links (Sprint 44) enthalten keinen Tenant-Token; abgelaufene Links geben HTTP 410 zurück ohne Datenleck.

**Migrations-/Index-Disziplin:** `alternatives.status`-Erweiterung per nicht-brechender Migration (neuer Enum-Wert); bestehende `draft`-Datensätze bleiben unverändert. `quote_positions.purchase_price`-Spalte nullable per Default – kein Rewrite bestehender Zeilen.

### Risiken Phase 5

1. Schreibschutz-Status-Machine muss atomar sein – kein Race Condition beim gleichzeitigen Drucken.
2. Taschenrechner-Parser darf keine Sicherheitslücken (eval) einführen – eigene Miniparser-Implementierung.
3. Batchdruck-PDFs können bei großen Planungen sehr groß werden – Streaming/Pagination nötig.
4. Nischenverkleidungs-Automatik hängt von stabiler Wandabstand-API ab (Sprint 8 / Sprint 33).
5. Negativ-Rabatt-Konvention muss in UI klar kommuniziert werden – keine stille Fehlbedienung.

---

## Phase 6 – Sprints 46–50: Vernetzte Branchenlösung (Auftragssteuerung, Mobile, ERP, Compliance)

**Ausgangslage (nach Sprint 45):** Profi-Parität hergestellt. Studio-Tool deckt den vollständigen Planungs- und Angebotsworkflow ab.

**Ziel:** OKP zur vernetzten Branchenlösung ausbauen: Produktionssteuerung, mobiler Außendienst, ERP-Anbindung, erweitertes Reporting, DSGVO/SSO/RBAC.

---

### Sprint 46 – Auftragssteuerung & Produktionsübergabe

**Meta:** Status: `done` · Owner: Backend-Lead · ETA: Phase 6 · Abhängigkeiten: S45, S42 · **Abgeschlossen: 2026-03-02**

**Ziel:** Bestätigtes Angebot erzeugt zwei verknüpfte Entitäten: interne `ProductionOrder` (Produktionsauftrag im Studio) und externe `PurchaseOrder` (Bestellung an den Küchenhersteller).

**Features:**

- **PurchaseOrder (Herstellerbestellung) ✅ PR #10:**
  Bestellschein an den Küchenhersteller mit Positionen (SKU, Menge, Preis).
  Status-Lifecycle: `draft → sent → confirmed → partially_delivered → delivered → cancelled`.
  6 CRUD-Endpunkte inkl. Status-Workflow-Übergänge + Notification-Trigger.

- **ProductionOrder (interner Produktionsauftrag) ✅:**
  Konvertierung des bestätigten Angebots in einen internen Produktionsauftrag; BOM wird eingefroren (Snapshot).
  Status-Lifecycle: `draft → confirmed → in_production → ready → delivered → installed`.
  Statusübergänge mit Zeitstempel und User-Referenz geloggt (Audit-Log).

- **Produktionsübersicht ✅:** Seite `/production-orders` mit Projekt-Filter, Status-Filter, Workflow-Bar, Audit-Log, Drill-down auf verknüpfte Bestellungen.

- **Freeze-Guard ✅:** `isProjectFrozen()`-Helper + `GET /projects/:id/freeze-status`-Endpunkt. UI-Hinweis bei eingefrorener Planung.

- **Verknüpfung ✅:** `PATCH /production-orders/:id/link-purchase-order` verknüpft PurchaseOrder ↔ ProductionOrder.

**Datenmodell:**
- `purchase_orders` ✅ – (id, status, items[], created_at)
- `purchase_order_items` ✅ – (order_id, position, sku, quantity, unit_price)
- `production_orders` ✅ – (quote_id, bom_snapshot JSON, status, frozen_at, created_at)
- `production_order_events` ✅ – Audit-Log (order_id, from_status, to_status, user_id, timestamp)

**Tests:** 17 neue Unit-Tests grün. Gesamt: 297 Tests.

---

### Sprint 47 – Mobile Aufmaß & Baustellenprotokoll

**Meta:** Status: `done` · Owner: Frontend-Lead · ETA: Phase 6 · Abhängigkeiten: S46 · **Abgeschlossen: 2026-03-02**

**Ziel:** Progressive Web App für Außendienst: Aufmaß, Fotos, Installationscheckliste, automatisches Protokoll.

**Features:**

- **Offline-fähige PWA:** Raummaße und Notizen auch ohne Internetverbindung erfassen; Sync beim nächsten Verbindungsaufbau.
- **Foto-Dokumentation:** Kameraintegration im Browser; Fotos werden Projekt/Raum zugeordnet und in S3-kompatiblem Storage abgelegt.
- **Installationscheckliste:** Pro Auftrag konfigurierbare Checkliste (Mängel, Abnahmen); Häkchen + Freitext + Foto je Position.
- **PDF-Protokoll-Generierung:** Abnahmeprotokoll automatisch aus Checkliste + Fotos generieren und als Dokument am Projekt ablegen.

**Neues Datenmodell:**
- `site_surveys` – (project_id, measurements JSON, photos[], notes, synced_at)
- `installation_checklists` – (order_id, items[], completed_at)
- `checklist_items` – (checklist_id, label, checked, photo_url, note)

**Deliverables:** PWA-Manifest + Service Worker, Foto-Upload-Pipeline, Checklisten-CRUD, Protokoll-PDF-Generator, 20 Tests.

**DoD:** Aufmaß offline erfasst und nach Sync am Projekt sichtbar; Protokoll-PDF aus Checkliste generierbar; Fotos abrufbar.

---

### Sprint 48 – ERP-Anbindung & Lieferantenportal

**Meta:** Status: `done` · Owner: Backend-Lead · ETA: Phase 6 · Abhängigkeiten: S47, S46

**Ziel:** Bestehende `PurchaseOrder` (Sprint 46) um ERP-Konnektoren erweitern: automatische Übertragung an externe Systeme, Webhook-Rückmeldung, Lieferantenportal.

**Features:**

- **ERP-Konnektor-Framework:** Konfigurierbare Konnektoren (Endpunkt, Auth, Feldmapping); unterstützt REST + Webhook-Push. Überträgt `PurchaseOrder`-Daten automatisch ins ERP des Herstellers.
- **Artikel-Mapping:** Katalog-Artikelnummer ↔ ERP-Artikelnummer pro Konnektor konfigurierbar.
- **Lieferantenportal (Light):** Eigene Ansicht für Lieferanten: offene `PurchaseOrders` einsehen, Lieferdatum bestätigen, AB hochladen.
- **Status-Rückübermittlung:** ERP liefert AB und Lieferstatus als Webhook zurück → aktualisiert `purchase_order.status` und triggert Notification an Studio.

**Neues Datenmodell:**
- `erp_connectors` – (tenant_id, name, endpoint, auth_config JSON, field_mapping JSON)
- `purchase_orders.erp_order_ref` – nullable, befüllt nach ERP-Übertragung

**Deliverables:** Konnektor-CRUD, ERP-Push-Service, Lieferantenportal-View, Webhook-Empfänger, 25 Tests.

**DoD:** PurchaseOrder wird via Konnektor ins ERP übertragen; AB-Webhook aktualisiert Status; Lieferant sieht offene Bestellungen im Portal.

---

### Sprint 49 – Erweiterte Analytics & individuelle Reports

**Meta:** Status: `done` · Owner: Backend-Lead · ETA: Phase 6 · Abhängigkeiten: S48, S28

**Ziel:** Report-Builder mit Drill-down, Trichteranalyse und geplanter E-Mail-Verteilung.

**Features:**

- **Report-Builder:** Konfigurierbare Dimensionen (Zeitraum, Branch, Verkäufer, Warengruppe) und Metriken (Umsatz, DB, Conversion); Ergebnis als Tabelle oder Chart.
- **5 Standard-Reports:** Umsatz/Zeitraum, Trichter Lead→Angebot→Auftrag, Durchlaufzeiten, Top-Warengruppen, Verkäufer-Ranking.
- **Drill-down:** Klick auf Aggregat öffnet Detailliste der zugehörigen Datensätze.
- **Geplante Verteilung:** Reports per Cron (täglich/wöchentlich/monatlich) als PDF oder Excel per E-Mail versenden.

**Neues Datenmodell:**
- `report_definitions` – (tenant_id, name, dimensions[], metrics[], filters JSON)
- `report_schedules` – (report_id, cron_expression, recipients[], format)
- `report_runs` – (schedule_id, generated_at, file_url)

**Deliverables:** Report-Builder-UI, 5 vordefinierte Report-Templates, Drill-down-Navigation, Schedule-CRUD + Cron-Job, PDF/Excel-Export, 20 Tests.

**DoD:** Custom-Report konfiguriert und gespeichert; Standard-Reports aufrufbar; Drill-down zeigt Einzeldatensätze; Versand per Schedule funktioniert.

---

### Sprint 50 – Compliance, Plattformhärtung & SLA-Management

**Meta:** Status: `done` · Owner: Security-Lead · ETA: Phase 6 · Abhängigkeiten: S49, S23 · **Abgeschlossen: 2026-03-02**

**Ziel:** DSGVO-Tooling, SSO/SAML 2.0, granulares RBAC, SLA-Monitoring.

**Features:**

- **DSGVO-Workflow:** Datenlöschung auf Anfrage (Right to be forgotten): alle personenbezogenen Daten eines Kontakts/Projekts identifizieren, anonymisieren oder löschen; Nachweis-Log.
- **Datenexport (Art. 20 DSGVO):** Alle Daten eines Nutzers/Kontakts als strukturiertes JSON exportierbar.
- **SSO / SAML 2.0:** Konfigurierbare Identity-Provider-Anbindung; Fallback auf lokale Auth falls IdP nicht erreichbar.
- **Granulares RBAC:** Rollen und Berechtigungen auf Branch-Ebene definierbar (z. B. Verkäufer darf nur eigene Projekte sehen).
- **SLA-Monitoring:** Uptime-Indikatoren, Antwortzeit-Tracking pro API-Endpunkt, Alert bei SLA-Verletzung; Dashboard-Widget.

**Neues Datenmodell:**
- `gdpr_deletion_requests` – (contact_id, requested_at, completed_at, performed_by)
- `sso_providers` – (tenant_id, entity_id, sso_url, certificate)
- `role_permissions` – (role, resource, action, branch_id nullable)
- `sla_snapshots` – (endpoint, p50_ms, p95_ms, uptime_pct, recorded_at)

**Deliverables:** DSGVO-Lösch-/Export-Flow, SSO-Konfiguration + Fallback, RBAC-Admin-UI, SLA-Dashboard-Widget, Vollständiges Audit-Log, 30 Tests.

**DoD:** Löschanfrage vollständig anonymisiert Datensätze + Nachweis; SSO-Login mit externem IdP funktioniert; Branch-RBAC greift; SLA-Widget zeigt aktuelle Werte.

---

### Meilenstein Phase 6

| Nach Sprint | Ergebnis |
|-------------|----------|
| 50 | Vernetzte Branchenlösung: Auftragssteuerung, Mobile Feldarbeit, ERP-Anbindung, erweitertes Reporting, DSGVO/SSO/RBAC |

### Risiken Phase 6

1. ERP-Heterogenität: Jedes ERP hat andere Datenmodelle – Konnektor-Framework muss flexibel genug sein ohne unkontrollierbare Komplexität.
2. Offline-Sync-Konflikte in der PWA: Gleichzeitige Bearbeitung am Tablet und im Browser muss deterministisch aufgelöst werden.
3. PDF-Generierung bei großen Reports kann Laufzeit-Probleme erzeugen – asynchrone Job-Queue nötig.
4. Kaskadierende DSGVO-Löschungen können referenzielle Integrität brechen – Anonymisierungs-Strategie statt Hard-Delete bevorzugen.
5. SSO-Fallback-Sicherheit: Lokale Auth darf nicht als Backdoor fungieren – MFA-Pflicht für Fallback.
6. SLA-Snapshot-Datenmenge: Langfristige Retention-Strategie (Aggregation, TTL) für Monitoring-Daten definieren.

---

## Phase 7 – Sprints 51–55: Interoperabilität, Dateiformate & Raumakustik

**Ausgangslage (nach Sprint 50):** Vollständige Branchenlösung mit ERP-Anbindung, Mobile und Compliance. Interop-Stubs (DXF, DWG, SKP) aus dem MVP sind vorhanden aber nicht vollständig implementiert.

**Ziel:** OKP als offene Plattform mit professionellen Datei-Schnittstellen (GLTF, IFC, DWG, SKP), konfigurierbaren Artikeln mit Abhängigkeitslogik (OFML-Parität) und Raumakustik-Visualisierung.

---

### Sprint 51 – GLTF/GLB Export & 3D-Render-Pipeline

**Meta:** Status: `done` · Owner: Frontend-Lead · ETA: Phase 7 · Abhängigkeiten: S50, S14

**Ziel:** Planung als GLTF/GLB exportieren für externe Renderer, AR/VR-Viewer und Kundenvisualisierung.

**Hintergrund:** Three.js (bereits im Frontend) liest GLTF nativ. GLTF/GLB ist der offene Industriestandard für Web-3D (Khronos Group). Ermöglicht Export in AR-Apps, externe Renderer und Kunden-Viewer ohne proprietäre Formate.

**Features:**
- **GLTF-Export:** Planung (Schränke, Wände, Boden) als `.glb` exportieren; Materialien (Farbe, Textur) erhalten
- **LOD-Stufen:** Low-Detail für Web-Preview, High-Detail für Druck/Render
- **Interop-Paket:** `interop-gltf/gltf-export` nach gleichem Muster wie `interop-cad/dxf-export`
- **API-Endpunkt:** `POST /alternatives/:id/export/gltf` – gibt `.glb`-Datei zurück
- **Frontend-Preview:** GLB direkt im Three.js-Viewer laden (keine neue Abhängigkeit)

**Neues Paket:** `interop-gltf/gltf-export` mit `three` + `three/examples/jsm/exporters/GLTFExporter`

**Deliverables:** GLTF-Export-Service, API-Endpunkt, Frontend-Download-Button, 15 Tests.

**DoD:** GLB-Datei enthält alle platzierten Objekte mit korrekter Position und Material; Datei öffnet in Standard-GLTF-Viewern (z. B. gltf.report); Export < 5 Sekunden für typische Planung.

---

### Sprint 52 – IFC Import/Export (BIM-Integration)

**Meta:** Status: `done` · Owner: Interop-Lead · ETA: Phase 7 · Abhängigkeiten: S51, S3.5

**Ziel:** IFC 2×3 und IFC 4 Import/Export für Austausch mit Architekten, Planungsbüros und BIM-Software (Revit, ArchiCAD, Allplan).

**Hintergrund:** IFC (Industry Foundation Classes) ist der offene Standard für BIM (Building Information Modeling). Ermöglicht bidirektionalen Datenaustausch mit Architekturbüros. Bibliothek: `web-ifc` (npm, WASM-basiert, schnell).

**Features:**
- **IFC-Import (IFC2×3, IFC4):** Raumgeometrie (IfcSpace, IfcWall) aus IFC-Datei lesen und als Raum-Grundriss in OKP übernehmen
- **IFC-Export:** Geplante Küche als IfcFurnishingElement-Sammlung exportieren; Wände und Maße als IfcWall
- **Interop-Paket:** `interop-ifc/ifc-import` und `interop-ifc/ifc-export`
- **API-Endpunkte:**
  - `POST /projects/:id/import/ifc` – liest Raumgeometrie aus IFC
  - `POST /alternatives/:id/export/ifc` – exportiert Planung als IFC
- **Mapping:** Katalog-Artikel → `IfcFurnishingElement` mit Name, Maßen, Material

**Abhängigkeit:** `web-ifc` npm-Paket (WASM-Bundle, ~2 MB)

**Deliverables:** IFC-Import-Service, IFC-Export-Service, 2 API-Endpunkte, IFC-Mapping-Tabelle, 20 Tests.

**DoD:** IFC-Datei mit Raumgeometrie importiert und als Grundriss sichtbar; Export enthält alle platzierten Möbel als IfcFurnishingElement; Datei valide laut `web-ifc`-Parser.

---

### Sprint 53 – DWG-Vollimplementierung, SKP-Export & CAD-Parität

**Meta:** Status: `done` · Owner: Interop-Lead · ETA: Phase 7 · Abhängigkeiten: S52, S19

**Ziel:** Bestehende Stubs (DWG, SKP) vollständig implementieren; professionelle CAD-Interop erreichen.

**Hintergrund:** DWG-Stubs (`interop-cad/dwg-import`, `dwg-export`) und SKP-Export-Stub (`interop-sketchup/skp-export`) existieren bereits im Repo ohne Implementierung.

**Features:**
- **DWG-Import:** Grundriss aus DWG-Datei importieren (Wände, Öffnungen); Bibliothek: `@jscad/dxf` oder Open Design Alliance Node Wrapper
- **DWG-Export:** Planung (Wandansichten, Grundriss, Maßketten) als DWG exportieren
- **SKP-Export:** Planung als SKP-kompatiblen Exportpfad ausgeben (`skp-export`-Stub implementieren)
- **DXF-Vollständigkeit:** Bestehenden DXF-Import/Export gegen reale Dateien aus Planungssoftware testen und Lücken schließen
- **Batch-Export:** Alle Formate (DXF, DWG, GLTF, IFC) über einen einzigen `POST /alternatives/:id/export`-Endpunkt mit `format`-Parameter

**Deliverables:** DWG-Import/-Export vollständig, SKP-Export vollständig, Batch-Export-Endpunkt, 25 Tests (inkl. Round-Trip-Tests DXF→OKP→DXF).

**DoD:** DWG-Grundriss importiert und als Raum sichtbar; DWG-Export ist in gängigen CAD-Tools lesbar; SKP-Export ist nutzbar; Batch-Export liefert alle Formate in einem ZIP.

---

### Sprint 54 – Konfigurierbare Artikel & Abhängigkeitslogik (OFML-Parität)

**Meta:** Status: `done` · Owner: Backend-Lead · ETA: Phase 7 · Abhängigkeiten: S53, S20

**Ziel:** Katalog-Artikel erhalten eine Abhängigkeitslogik zwischen Eigenschaften – ähnlich dem OFML-Standard (Office Furniture Modelling Language). Variante A → Preis und verfügbare Optionen ändern sich automatisch.

**Hintergrund:** Im professionellen Planungsbereich haben Artikel konfigurierbare Merkmale mit kaufmännischen Abhängigkeiten (z. B. Korpusfarbe → verfügbare Frontfarben; Breite → Preisgruppe). OKP hat bereits ein Katalogsystem und eine Rule Engine – diese Erweiterung fügt den Dependency-Graph zwischen Artikelmerkmalen hinzu.

**Features:**
- **Merkmals-Abhängigkeitsgraph:** Pro Katalog-Artikel: Merkmale mit Ausprägungen und Abhängigkeitsregeln (wenn Merkmal A = X, dann Merkmal B ∈ {Y, Z}); gespeichert als JSON-Graph in `catalog_articles`
- **Konfiguratorlogik:** Bei Auswahl einer Ausprägung werden abhängige Merkmale live eingeschränkt/vorbelegt; ungültige Kombinationen werden blockiert
- **Preisabhängigkeit:** Preis-Lookup per Merkmalskombination (Preistabelle pro Artikel); ersetzt pauschalem Einzelpreis
- **Profilmanager:** Gespeicherte Merkmalskombinationen (Profile) pro Nutzer/Tenant wiederverwendbar
- **Merkmalsausprägungen übertragen:** Konfiguration eines Artikels auf gleichartige Artikel übertragen (Batch-Apply)

**Erweitertes Datenmodell:**
```
catalog_article_properties  – (article_id, key, label, type, options JSON, depends_on JSON)
catalog_article_price_table – (article_id, property_combination JSON, price NUMERIC)
user_profiles               – (user_id, tenant_id, name, article_id, property_values JSON)
```

**Deliverables:** Abhängigkeitsgraph-Engine, Konfigurator-API, Preistabellen-Lookup, Profilmanager-CRUD, Merkmalsübertragung, 25 Tests.

**DoD:** Abhängige Merkmale schränken korrekt ein; Preis ändert sich bei Variantenwechsel; ungültige Kombination wird blockiert; Profil gespeichert und wiederverwendbar; Merkmale auf mehrere Artikel übertragen.

---

### Sprint 55 – Raumakustik-Plugin (Voxel-Grid Import & Visualisierung)

**Meta:** Status: `done` · Owner: Full-Stack · ETA: Phase 7 · Abhängigkeiten: S54, S14

**Ziel:** Akustische Planung durch Import externer Akustikberechnungen (CNIVG-Format) und Visualisierung als Voxel-Grid in der 2D/3D-Ansicht.

**Hintergrund:** Akustische Berechnungen (Schalldruckpegel, Nachhallzeit T20, STI – Sprachverständlichkeitsindex) werden extern berechnet und als Datei zurückgeliefert. OKP importiert die Ergebnisdatei und stellt sie als überlagerte Falschfarbenkarte dar. Schallquellen (ACOUSTICS_SOURCE) und Schallsenken (ACOUSTICS_RECEIVER) werden als Layer in der Planung definiert.

**Features:**
- **Akustik-Layer:** Sonderlayer `ACOUSTICS_SOURCE` und `ACOUSTICS_RECEIVER` in der Planung; Objekte auf diesen Layern markieren Schallquellen/-senken
- **CNIVG-Import:** `POST /projects/:id/import/acoustics` – importiert CNIVG-Datei, speichert Voxel-Grid-Daten
- **Voxel-Grid-Visualisierung:** Falschfarbenkarte über Grundriss/3D-Ansicht – Darstellungsmodi: Karte (Landkarte) oder Punkte; transparent schaltbar
- **Akustikgröße wählen:** Schalldruckpegel (dB), A-bewerteter Pegel (dBA), Nachhallzeit T20, STI
- **Frequenzband-Filter:** Darstellung für einzelne Frequenzbereiche
- **Querschnittshöhe:** Horizontalschnitt durch das Voxel-Grid in konfigurierbarer Höhe
- **Farblegende:** Automatisch generierte Legende mit Klassen und Farbwerten; Schwellwert, Interpolation und Klassenunterteilung konfigurierbar
- **Layer-Sichtbarkeit:** Akustik-Layer standardmäßig ausgeblendet; nur bei aktivem Akustik-Plugin sichtbar

**Neues Datenmodell:**
```
acoustic_grids – (project_id, alternative_id, grid_data JSONB, source_file, imported_at)
acoustic_layers – (project_id, layer_type VARCHAR, object_refs JSON)
```

**Deliverables:** CNIVG-Import-Parser, Voxel-Grid-Speicherung, Visualisierungs-API (Grid-Daten als GeoJSON/Tile), Akustik-Layer-CRUD, Frontend-Overlay-Komponente, 20 Tests.

**DoD:** CNIVG-Datei importiert und Grid korrekt über Grundriss positioniert; Falschfarbenkarte in 2D-Ansicht sichtbar; Akustikvariable wählbar; Farblegende generierbar; Layer ohne Plugin ausgeblendet.

---

### Meilenstein Phase 7

| Nach Sprint | Ergebnis |
|-------------|----------|
| 51 | GLTF/GLB-Export: Planung als Web-3D-Datei für Renderer und AR/VR |
| 52 | IFC-Integration: BIM-Austausch mit Architekturbüros und Planungssoftware |
| 53 | CAD-Parität: DWG, SKP, DXF vollständig – offene Plattform für alle Dateiformate |
| 54 | OFML-Parität: Konfigurierbare Artikel mit Abhängigkeitslogik und Preistabellen |
| 55 | Raumakustik: Voxel-Grid-Visualisierung für professionelle Akustikplanung |

### Risiken Phase 7

1. `web-ifc` ist WASM-basiert – Node.js-Kompatibilität in Fastify-Serverumgebung prüfen (ggf. Worker Thread nötig).
2. DWG ist proprietär (Autodesk) – Open-Source-Bibliotheken erreichen nicht 100 % Kompatibilität; Einschränkungen dokumentieren.
3. GLTF-Export bei großen Planungen (100+ Objekte) kann speicherintensiv sein – Streaming/Chunking prüfen.
4. IFC-Mapping ist komplex: Nicht alle Katalog-Attribute haben IFC-Entsprechungen – explizite Mapping-Tabelle definieren.
5. SKP-Format ist proprietär und schlecht dokumentiert – Reverse-Engineering-Risiko; Community-Bibliotheken evaluieren.
6. OFML-Abhängigkeitsgraph kann zyklisch werden – Validierung auf Zyklen beim Speichern erforderlich.
7. CNIVG-Format ist proprietär (Akustikpartner) – Format-Spec muss vom Partner bezogen werden; Fallback-Parser für alternatives Format vorsehen.
8. Voxel-Grid-Daten können sehr groß sein (hochauflösende Räume) – Tile-basierte Übertragung und clientseitige LOD nötig.

---

## Phase 8 – Sprints 56–60: Planerqualität & erweiterte Raumdefinition

**Ausgangslage (nach Sprint 55):** Vollständige Interop-Parität, OFML-ähnliche Artikelkonfiguration und Raumakustik vorhanden. Die Werkzeuge für Raumzeichnung, Bemaßung und Katalogtiefe sind jedoch noch deutlich hinter professionellen Studio-Workflows.

**Ziel:** Qualitätssprung im täglichen Planungsworkflow – Wand-Interaktoren für direkte Grundrissbearbeitung, Live-Bemaßung, erweiterte Wandobjekte, Grundriss-Nachzeichnen aus Bildern/DXF und tiefere Katalogstruktur.

**Inspiration:** professionelle Studio-Workflows fuer Wand-Interaktoren, Bemaßung, 2D-Projektionen, Kitchen-Assistants, Live-Dims, Makros, Arbeitsplatten-Modifikationen und Multi-Point-Panoramen.

---

### Sprint 56 – Canvas-Editor UX: Wand-Interaktoren & Live-Bemaßung

**Meta:** Status: `done` · Owner: Full-Stack · ETA: Phase 8 · Abhängigkeiten: S55, S4

**Ziel:** Direktes Bearbeiten von Wänden via Griffe im 2D-Grundriss; Maße aktualisieren sich live beim Verschieben.

**Features:**

- **Wand-Interaktoren:** Endpunkt-Griffe (Kreis) und Mittelpunkt-Griffe (Raute) werden auf jeder Wand-Kante im Select-Modus eingeblendet. Ziehen des Endpunkts verschiebt Vertex; Ziehen des Mittelpunkts verschiebt die gesamte Wand parallel. Visuelles Highlighting beim Hover.
- **Live-Dimensioning:** Beim Ziehen eines Vertex oder Wandgriffs wird die aktuelle Kantenlänge (und ggf. Winkel zur Nachbarkante) als fliegendes Label direkt am Cursor angezeigt. Aktualisierung on-drag, keine Verzögerung.
- **Winkelbemaßung (3-Punkt):** Im Select-Modus: Klick auf Ecke → Winkelanzeige zwischen den angrenzenden Wänden eingeblendet.
- **Stage-Sizing Fix:** Konva-Stage erhält korrekte Höhe (CanvasArea-Höhe abzüglich Toolbar und Info-Bar via ResizeObserver auf innerem Wrapper-Div) – Info-Bar nicht mehr außerhalb des sichtbaren Bereichs.
- **Keyboard-Shortcuts:** `D` = Draw-Modus, `S` = Select-Modus, `Backspace` = markierten Vertex löschen, `Escape` = Auswahl aufheben.

**Neues Datenmodell:** keine neuen DB-Tabellen; nur Frontend-State-Erweiterungen im `usePolygonEditor`.

**Deliverables:** Interaktor-Shapes in `PolygonEditor.tsx`, Live-Dim-Overlay-Komponente, Stage-Sizing-Fix in `CanvasArea.tsx`, Keyboard-Event-Handler, 15 Tests.

**DoD:** Wand-Endpunkt per Drag verschoben → Kantenlänge live aktualisiert; Winkelanzeige korrekt; Stage zeigt Info-Bar vollständig; Shortcuts funktionieren.

---

### Sprint 57 – Erweiterte Wandobjekte (WallAttachments)

**Meta:** Status: `done` · Owner: Full-Stack · ETA: Phase 8 · Abhängigkeiten: S56, S5

**Ziel:** Das `Opening`-Modell zu einem generischen `WallAttachment` ausbauen: Heizkörper, Steckdosen, Schalter, Nischen und generische Wandelemente als eigene Typen mit 2D-Symbolen.

**Hintergrund:** Professionelle Studio-Workflows kennen neben Türen/Fenstern auch Installationsobjekte (Heizkörper, Steckdose, Wasserleitungen), die bei der Schrank-/Platzierungsplanung berücksichtigt werden müssen. Das bestehende `Opening`-Schema ist auf `door/window/pass-through` beschränkt.

**Features:**

- **Neuer Entity-Typ `WallAttachment`:** Ersetzt/erweitert `Opening` um Typen: `door`, `window`, `pass-through`, `radiator`, `socket`, `switch`, `niche`, `pipe`, `custom`.
- **2D-Symbole:** Für jeden Typ ein eigenes Konva-Symbol in `PolygonEditor` (Tür-Schwingbogen, Fenster-Doppellinie, Heizkörper-Raster, Steckdose-Kreis usw.).
- **Tiefenversatz:** `WallAttachment` erhält optionales Feld `wall_offset_depth_mm` – Objekte mit Tiefe (Heizkörper, Nische) können den minimalen Schrankabstand automatisch anpassen.
- **API-Erweiterung:** `opening_type`-Enum in `openings`-Tabelle erweitern; bestehende Einträge bleiben kompatibel.
- **RightSidebar:** Typ-Dropdown, Symbol-Vorschau, Tiefenfeld.

**Neues Datenmodell:**
```
openings.type: enum  door | window | pass-through | radiator | socket | switch | niche | pipe | custom
openings.wall_offset_depth_mm: INTEGER nullable
```

**Deliverables:** Typ-Enum-Migration, Symbol-Renderer in `PolygonEditor`, Tiefenversatz-Logik in Kollisionsprüfung, RightSidebar-Erweiterung, 20 Tests.

**DoD:** Heizkörper platziert → beeinflusst Mindestabstand in Prüf-Engine; Steckdose zeigt korrektes Symbol im Grundriss; bestehende Tür/Fenster-Daten bleiben kompatibel.

---

### Sprint 58 – Grundriss-Nachzeichnen: Bildimport als Canvas-Overlay

**Meta:** Status: `done` · Owner: Full-Stack · ETA: Phase 8 · Abhängigkeiten: S57, S3.5

**Ziel:** Foto oder Scan eines Grundrisses als halbtransparentes Hintergrundbild in den Canvas laden und darüber den Raum nachzeichnen.

**Hintergrund:** Handgezeichnete oder eingescannte Grundrisse sind im Handwerk der häufigste Ausgangspunkt. Bild-Import plus Maßband-Kalibrierung unterstützt diesen Workflow. Eigenes Nachzeichnen spart Zeit gegenüber vollem DXF-Import.

**Features:**

- **Bild-Upload in Canvas:** Button „Grundriss laden" → JPG/PNG/PDF (Seite 1) → wird als Konva-`Image`-Layer unter dem Zeichenlayer gerendert; transparenz-adjustierbar (Slider 20–100 %).
- **Maßstab-Kalibrierung:** Werkzeug „Referenzlinie": 2 Punkte auf dem Bild anklicken → Referenzlänge eingeben (z. B. 3000 mm) → Canvas skaliert automatisch so, dass 1 px = korrekte mm-Anzahl.
- **Bild-Transformationen:** Verschieben (Drag), Drehen (Drehgriff), Skalieren (Eckgriffe) – so dass Bild und Polygonzeichnung übereinander ausgerichtet werden können.
- **Speicherung:** Bild-URL (S3-kompatibel) + Transformationsparameter (x, y, rotation, scale) in `rooms.reference_image` (JSONB) persistiert.
- **DXF-Overlay-Snap:** Wenn bereits ein DXF importiert wurde, können die DXF-Linien als Snap-Ziele für neue Vertices genutzt werden (Fanglinien aus DXF-Layer `0`/`WALLS`).

**Neues Datenmodell:**
```
rooms.reference_image: JSONB nullable  { url, x, y, rotation, scale, opacity }
```

**Deliverables:** Bild-Upload-Endpoint (`POST /rooms/:id/reference-image`), Konva-Overlay-Layer, Kalibrierungs-Werkzeug, Transformations-Griffe, DXF-Snap-Erweiterung, 20 Tests.

**DoD:** Bild geladen, kalibriert und halbtransparent sichtbar; Vertices snappen auf Bild-Linien; Transformationen nach Reload wiederhergestellt.

---

### Sprint 59 – 2D-Bemaßung & Frontansichten

**Meta:** Status: `done` · Owner: Full-Stack · ETA: Phase 8 · Abhängigkeiten: S58, S14

**Ziel:** Bemaßungs-Entity im Grundriss und automatische 2D-Frontansichten für jede Küchenzeile – für professionelle Planungsunterlagen ohne DXF-Export.

**Features:**

- **Bemaßungs-Entity `Dimension`:** Typ `linear` (2 Punkte → Maßkette) und `angular` (3 Punkte → Winkelmaß). Stil-Felder: Einheit (mm/cm), Schriftgröße, Pfeiltyp (offener/geschlossener Pfeil), Abstand der Maßlinie vom Objekt. Interaktoren: Textposition verschieben, Maßlinie-Abstand anpassen.
- **Automatische Raummaße:** Button „Raummaße einfügen" → Bemaßungen aller Wandkanten automatisch generiert (außen umlaufend), anpassbar.
- **2D-Frontansichten generieren:** Pro Wand mit platzierten Schränken: Frontansicht-Button in RightSidebar → Schränke werden orthogonal auf die Wandfläche projiziert, inkl. Höhenbemaßung (Sockel/Unterschrank/Oberschrank/Decke) und Breitenbemaßung. Ergebnis als SVG (direkt im Browser).
- **Export:** Frontansichten + Grundriss (inkl. Bemaßungen) als einzeln wählbare PDF/SVG-Exportseiten im Print-Workflow (Sprint 44).

**Neues Datenmodell:**
```
dimensions: id, room_id, type (linear|angular), points JSON, style JSON, created_at
```

**Deliverables:** `Dimension`-Entity + CRUD-API, Konva-Rendering für Maßketten, Frontansichts-Generator-Service, SVG-Export-Endpunkt, PDF-Integration in Batch-Print, 25 Tests.

**DoD:** Lineare Bemaßung platziert und mit Raummaßen beschriftet; Frontansicht für Zeile korrekt projiziert inkl. Höhen/Breiten; SVG öffnet in Browser ohne Artefakte; PDF-Batch-Print um Frontansicht erweiterbar.

---

### Sprint 60 – Katalog-Hierarchie, Kitchen Assistant & Schnellfilter

**Meta:** Status: `done` · Owner: Full-Stack · ETA: Phase 8 · Abhängigkeiten: S59, S20

**Ziel:** Tiefere Katalogstruktur (Familien/Kollektionen), auto-generierte Layout-Vorschläge (Kitchen Assistant) und schnellere Artikel-Navigation.

**Features:**

- **Katalog-Hierarchie:** `catalog_articles` um Felder `family`, `collection`, `style_tag` erweitern; Katalog-Sidebar zeigt hierarchischen Filter (Kollektion → Familie → Artikel); Breadcrumb-Navigation.
- **Einheitliche Katalog-Quellen:** LeftSidebar-Katalogbereich bündelt intern: Herstellerkataloge, SKP-Referenzen, generische Imports, Nutzerfavoriten – in einer einheitlichen Listenansicht mit Quellenicon.
- **Kitchen Assistant (Light):** Button „Layout vorschlagen" → Analysiert Raumgeometrie (Wandlängen, Ecken, Öffnungen) → Schlägt 2–3 Grundlayouts vor (L-Form, U-Form, Einzeiler, Insel) als Vorschau; Klick übernimmt Schrankreihen-Grundstruktur als Makro.
- **Live-Suche & Schnellfilter:** Suche in Katalog-Sidebar reagiert on-keystroke (< 100 ms); Schnellfilter-Chips: Favoriten, Zuletzt verwendet, Neuheiten (nach `created_at`), Aktionsartikel.
- **Makro-Vorlagen aus Katalog:** Häufig genutzte Zeilen/Inseln als `CatalogMacro` speichern; beim Platzieren als Gruppe einfügen.

**Neues Datenmodell:**
```
catalog_articles.family:      VARCHAR nullable
catalog_articles.collection:  VARCHAR nullable
catalog_articles.style_tag:   VARCHAR nullable
catalog_macros: id, tenant_id, name, positions JSON (wall_id, offset_mm, article_id, dims), created_by
```

**Deliverables:** Migration für Felder, Hierarchie-Filter-UI, Kitchen-Assistant-Service (Regelbasiert), Makro-CRUD + Platzierungs-Handler, Live-Suche mit Debounce, 25 Tests.

**DoD:** Kollektion-Filter zeigt korrekte Artikel-Teilmenge; Kitchen Assistant schlägt L/U/Einzeiler-Layout vor; Makro wird als Gruppe platziert; Suche reagiert < 100 ms.

---

### Meilenstein Phase 8

| Nach Sprint | Ergebnis |
|-------------|----------|
| 56 | Interaktiver Grundriss: direkte Wand-Handles, Live-Maße, Keyboard-Shortcuts |
| 57 | Vollständige Wandobjekte: Heizkörper, Steckdosen, Nischen mit 2D-Symbolen |
| 58 | Nachzeichnen-Workflow: Bild-Import, Kalibrierung, DXF-Snap |
| 59 | Professionelle Planungsunterlagen: Bemaßung + Frontansichten direkt im Tool |
| 60 | Profi-Katalog: Hierarchie, Kitchen Assistant, Makros, Schnellfilter |

### Security & Tenant-Isolation (Phase 8)

**Datenisolation:** `dimensions` und `catalog_macros` erhalten `tenant_id NOT NULL`. `rooms.reference_image` enthält S3-URL mit Tenant-Prefix; Download nur über Signed URL.

**Migrations-/Index-Disziplin:** `catalog_articles.family/collection/style_tag` nullable, kein Rewrite bestehender Zeilen. `dimensions`-Tabelle neu mit `tenant_id + room_id`-Index. `opening_type`-Enum-Erweiterung via nicht-brechender Migration.

### Sprint 56-FS – FengShui-Plugin (Westlich + Östlich, Zonen-Overlay & Findings)

**Meta:** Status: `done` · Owner: Full-Stack · ETA: Phase 8 · Abhängigkeiten: S14 (3D-Preview), S55 (Overlay-Pattern / GeoJSON)

**Ziel:** FengShui-Analyse als Plugin im Küchenplanner – östlich (Bagua-Zonen 3×3 als Overlay + elementbasierte Hinweise) und westlich (Wegeführung / Engstellen / Küchen-Arbeitsdreieck als Findings). Ergebnisse werden persistiert (Prisma) und im Editor als Konva-Overlay visualisiert.

**Features:**

- **Prisma-Modell** `FengShuiAnalysis` + `FengShuiMode`-Enum (west/east/both)
- **Engine** `fengshuiEngine.ts`: Bagua 3×3 (Bounding-Box V1) + West-Findings (Küchen-Arbeitsdreieck)
- **REST-Endpoints:** POST analyze, GET list/meta/zones/findings, DELETE
- **Frontend API** `fengshui.ts` + **Konva-Overlay** `FengShuiOverlay.tsx`

**DoD:** 12 Tests grün; POST erzeugt Analyse mit 9 Bagua-Zonen (east/both); Findings korrekt generiert; Overlay rendert Zonen als Konva-Layer.

---

### Risiken Phase 8

1. Wand-Interaktoren erfordern genaue Konva-Hit-Detection für Handles – Überlappung mit Vertex-Circles bei kurzen Kanten prüfen.
2. Live-Dimensioning darf nicht zu Re-Render-Schleifen führen – Debounce/Throttle auf Drag-Events.
3. Bild-Upload und Kalibrierung sind komplex im mobilen/Touch-Kontext – Desktop-First, Touch-Optimierung als Follow-up.
4. Kitchen-Assistant-Layouts müssen bei ungewöhnlichen Raumformen graceful degradieren – Fallback: „Kein Vorschlag möglich".
5. Frontansichts-Generator muss Dachschrägen-Constraints (Sprint 6) berücksichtigen – Höhenlinien dürfen nicht ignoriert werden.
6. `opening_type`-Enum-Erweiterung muss mit bestehenden Öffnungsdaten und der Prüf-Engine (Sprint 22) abgestimmt werden.

---

## Phase 9 – Infrastruktur & Integration (hotfix/parallel zu Phase 8)

Diese Phase umfasst Infrastruktur-Features, die parallel zu Phase 8 durch GitHub-Copilot-Agenten entstanden und in `main` gemergt wurden.

### Sprint 9-UI – Frontend-Modernisierung

**Meta:** Status: `done` · Owner: Copilot Agent (PR #16) · Datum: 2026-03-02

**Was:** Komplette Überarbeitung der Editor- und Projektlisten-UI.

- **Editor:** Workflow-Steps-Leiste (Aufmaß → Planung → Angebot → Produktion), Nav-Strip mit Schnellzugriff, überarbeitetes Layout
- **Editor:** Flyout-Menü mit kontextbezogenen Aktionen
- **LeftSidebar:** Neue CSS-Module für Kategorieblöcke
- **ProjectList:** Kanban-Board-Ansicht nach Projektstatus, Prioritätslabels, Gantt-Vorbereitung

**Dateien:** `Editor.tsx`, `Editor.module.css`, `ProjectList.tsx`, `ProjectList.module.css`, `LeftSidebar.tsx`, `LeftSidebar.module.css`

---

### Sprint 9-PS – Plugin-System (Branche-Plugins)

**Meta:** Status: `done` · Owner: Copilot Agent (branch: develop-plugins-for-acoustics-fengshui) · Datum: 2026-03-03

**Was:** Zentrales `OkpPlugin`-Interface und Plugin-Registry für erweiterbare Branche-Plugins.

**Architektur:**
```
planner-api/src/plugins/
  pluginRegistry.ts   – registerPlugin / getPlugins / clearPlugins
  index.ts            – bootstrapPlugins() (Raumakustik + FengShui)
  raumakustik.ts      – acousticsRoutes als OkpPlugin
  fengshui.ts         – fengshuiRoutes als OkpPlugin
```

**Vorher:** `acousticsRoutes` und `fengshuiRoutes` direkt in `index.ts` importiert.  
**Nachher:** `bootstrapPlugins()` + `for...of getPlugins()` Loop – neue Plugins ohne `index.ts`-Anpassung registrierbar.

**Tests:** 5 Unit-Tests in `pluginRegistry.test.ts` (immutable snapshot, Duplikat-Guard, etc.)

**DoD:** Plugin-Registry wirft bei doppelter ID; `getPlugins()` gibt unveränderlichen Snapshot zurück; alle Bestandsrouten funktionieren unverändert über Plugin-Loop.

---

### Sprint 9-MCP – MCP-Server für externe Systeme

**Meta:** Status: `done` · Owner: Copilot Agent (branch: entwickeln-mcp-fuer-externe-systeme) · Datum: 2026-03-03

**Was:** JSON-RPC 2.0 MCP-Endpunkt (`/api/v1/mcp`) für KI-basierte externe Integration.

**Ermöglicht:** Claude, Copilot und andere KI-Systeme können als MCP-Client auf den Planner zugreifen.

**MCP-Tools:**
| Tool | Beschreibung |
|------|-------------|
| `list_projects` | Projekte auflisten (mit Paginierung + Tenant-Filter) |
| `get_project` | Einzelnes Projekt mit allen Metadaten |
| `suggest_kitchen_layout` | Küchenlayout vorschlagen (L/U/Einzeiler/Insel) aus Wandsegmenten |
| `get_catalog_articles` | Katalog durchsuchen (Collection, Family, Freitext) |
| `get_bom` | Stückliste eines Projekts abrufen |

**Protokoll:** MCP/1.0 + `protocolVersion: 2024-11-05` (Model Context Protocol)

**Dateien:**
- `planner-api/src/routes/mcp.ts` – JSON-RPC Handler (initialize, tools/list, tools/call)
- `planner-api/src/services/mcpService.ts` – Tool-Definitionen & Implementierungen (307 Zeilen)
- `planner-api/src/routes/mcp.test.ts` – 330 Zeilen Tests

**DoD:** `GET /api/v1/mcp` → Server-Info; `POST /api/v1/mcp` mit `tools/list` → 5 Tools; `tools/call suggest_kitchen_layout` → Vorschläge; Fehler-Handling via JSON-RPC error codes.

---

### Meilenstein Phase 9

| Feature | Ergebnis |
|---------|----------|
| UI-Modernisierung | Editor und Projektliste mit Workflow-UX, Flyout, Kanban |
| Plugin-System | Erweiterbare Plugin-Architektur für Branche-Features |
| MCP-Server | KI-Systeme können Planner-Daten lesen und Layout-Vorschläge abrufen |

---

## Phase 10 – Professionalisierung (Sprints 61–63)

**Ziel:** Vertriebsreife Features — professionelle Kundendokumente und KI-gestützter Planungsassistent.

### Sprint-Übersicht

| Sprint | Status | Thema | Deliverables |
|--------|--------|-------|--------------|
| 61 | `done` | Angebots-PDF mit Firmenprofil | TenantSetting erweitert, PDF mit Absender/Empfänger/Bank/USt, Frontend-Download, Firmenprofil-Seite |
| 62 | `done` | MCP: Claude als Planungsassistent | 10 neue Tools (Read+Write), Räume/Placements/Angebote via MCP, MCP-Info-Seite |
| 63 | `done` | Smarte Bemaßung & Centerlines | Auto-Update-Referenzen für Dimensionen, POST /rooms/:id/dimensions/auto-chain, Centerlines-Routen + Canvas-Layer |

### Sprint-Metadaten

| Sprint | Owner | ETA | Abhängigkeiten | DoD-Kurzfassung |
|--------|-------|-----|----------------|-----------------|
| 61 | Full-Stack | Phase 10 | S13, TenantSetting | PDF mit Firmenbriefkopf downloadbar; Firmenprofil in UI pflegbar |
| 62 | Backend | Phase 10 | S9-MCP | 15 MCP-Tools; Claude kann Projekte, Räume, Placements und Angebote verwalten |
| 63 | Full-Stack | Phase 10 | S59 | Bemaßungs-Update, smarte Maßkette, Centerlines im Grundriss |

### Meilenstein Phase 10

| Nach Sprint | Ergebnis |
|-------------|----------|
| 61 | Angebot als professionelles PDF mit Firmenbranding versendbar |
| 62 | Claude kann als vollwertiger Planungsassistent über MCP arbeiten |
---

## Phase 11 - CAD-Detailtiefe & Produktion (Sprints 63-66)

**Ziel:** Die bestehende Planung in Richtung Ausfuehrungs- und Werkstattqualitaet erweitern:
smarte Bemaßung, Layout-Sheets, Cutlists und pragmatisches CNC-Nesting.

### Sprint-Uebersicht

| Sprint | Status | Thema | Deliverables |
|--------|--------|-------|--------------|
| 63 | `done` | Smarte Bemaßung & Centerlines | Referenzierte Maße, Quick-Dim, Achslinien |
| 64 | `done` | Layout-Sheets & Detail-Views | Zeichnungsblaetter, Detail- und Schnittansichten |
| 65 | `done` | Zuschnittliste (Cutlist) | Teilelisten aus Platzierungen, PDF/CSV-Export |
| 66 | `done` | CNC-Nesting & DXF-Export | Rohplattenbelegung, Verschnitt-KPIs, DXF fuer Werkstatt |

### Sprint-Metadaten

| Sprint | Owner | ETA | Abhaengigkeiten | DoD-Kurzfassung |
|--------|-------|-----|----------------|-----------------|
| 63 | Full-Stack | Phase 11 | S59 | Maße aktualisieren sich bei Geometrieaenderungen automatisch |
| 64 | Full-Stack | Phase 11 | S59, S63 | Tabs fuer Zeichnungsblaetter und Detail-/Schnittansichten vorhanden |
| 65 | Backend | Phase 11 | S11, S60 | Cutlist wird aus Platzierungen erzeugt und als PDF/CSV exportiert |
| 66 | Backend | Phase 11 | S53, S65 | Nesting berechnet Rohplattenbelegung und exportiert DXF |

### Meilenstein Phase 11

| Nach Sprint | Ergebnis |
|-------------|----------|
| 63 | Praxistaugliche, geometriereferenzierte Maßketten im Editor |
| 64 | Mehrblatt-Zeichnungen mit Detail- und Schnittansichten |
| 65 | Werkstatt kann direkte Zuschnittlisten aus dem Planer ziehen |
| 66 | Rohplatten koennen optimiert belegt und als DXF exportiert werden |
 
---
 
## Phase 12 - Parametrik, Plot-Stile & Praesentation (Sprints 67-70)
 
**Ziel:** Nach Werkstatt- und Dokumentenbasis jetzt die naechste Profischicht:
massstabsstabile Zeichnungen, einfache parametrische Regeln, begehbare
Panorama-Touren und standardisierte Werkstatt-/Vertriebspakete.
 
**Aus Benchmarking uebernommen und bewusst priorisiert:**
 
- annotative Masse, Dimension Styles und plotting-orientierte Layouts
- klassische CAD-Systeme: pragmatische Constraints und Driving Dimensions
- Multi-Point-Panoramen fuer Kundenpraesentation
- Spezifikationsblaetter und strukturierte Dokumentmappen
 
**Bewusst noch nicht priorisiert:**

- echte Multi-User-Simultanbearbeitung: mehr Infrastruktur- als Planungsnutzen
- vollwertiger numerischer CAD-Solver: zu teuer fuer den aktuellen ROI
 
### Sprint-Uebersicht
 
| Sprint | Status | Thema | Deliverables |
|--------|--------|-------|--------------|
| 67 | `done` | Annotative Layout-Styles | Tenant-Style-Presets, scale-aware Masse, plot-stabile Symbole |
| 68 | `done` | Constraint-Modus & Driving Dimensions | einfache Geometrie-Constraints, deterministischer Solver, Constraint-Panel |
| 69 | `done` | Panorama Multi-Point & Client-Tour | mehrere Viewpoints, Hotspots, Share-Link fuer Touren |
| 70 | `done` | Spezifikationsblaetter & Werkstattpaket | strukturierte Paket-Generierung aus Quote, BOM, Cutlist, Sheets, Nesting |
 
### Sprint-Metadaten
 
| Sprint | Owner | ETA | Abhaengigkeiten | DoD-Kurzfassung |
|--------|-------|-----|----------------|-----------------|
| 67 | Full-Stack | Phase 12 | S59, S64 | Layout-Styles sind tenantfaehig und scale-aware |
| 68 | Full-Stack | Phase 12 | S63, S65 | Constraint-Modus kann Waende und Placements deterministisch steuern |
| 69 | Full-Stack | Phase 12 | S14, S61 | mehrere Panorama-Punkte sind speicher- und teilbar |
| 70 | Full-Stack | Phase 12 | S44, S61, S65, S66 | Werkstattpaket generiert strukturiertes PDF-/Anlagenpaket |
 
### Meilenstein Phase 12
 
| Nach Sprint | Ergebnis |
|-------------|----------|
| 67 | Zeichnungsblaetter bleiben ueber mehrere Massstaebe hinweg lesbar und konsistent |
| 68 | Wiederkehrende Geometrie kann ueber einfache Regeln statt Handarbeit stabilisiert werden |
| 69 | Kunden koennen sich durch mehrere geplante Standpunkte in der Kueche bewegen |
| 70 | Vertrieb und Werkstatt erhalten standardisierte, projektbezogene Dokumentpakete |

---

## Phase 13 - Gebogene Waende & Bogengeometrie (Sprints 71-73)

**Ziel:** Gebogene Waende als durchgaengige Funktion einfuehren, nicht nur als
Editor-Spielerei. Die Phase trennt bewusst 2D-Kern, Bemaßung/Layout und
3D/Interop, damit das Risiko kontrollierbar bleibt.

**Warum als eigene Kette:**

- Arc-Walls betreffen Editor, Flaechenlogik, Oeffnungen, Bemaßung, 3D und Exporte gleichzeitig
- ein einzelner Sammelsprint wuerde zu viele Regressionen erzeugen
- V1 arbeitet pragmatisch mit segmentierter Approximation statt perfekter CAD-Geometrie

### Sprint-Uebersicht

| Sprint | Status | Thema | Deliverables |
|--------|--------|-------|--------------|
| 71 | `done` | Gebogene Waende im 2D-Kern | Arc-Wall-Typ, Radius-Handles, Snap-Logik, Oeffnungen auf Boegen |
| 72 | `done` | Bogen-Bemaßung & Layout | Radius-, Bogenlaengen- und Sehnenmasse, Arc-Annotations in Sheets |
| 73 | `done` | Gebogene Waende in 3D & Interop | segmentierte Extrusion, GLTF-/IFC-/DXF-Unterstuetzung |

### Sprint-Metadaten

| Sprint | Owner | ETA | Abhaengigkeiten | DoD-Kurzfassung |
|--------|-------|-----|----------------|-----------------|
| 71 | Full-Stack | Phase 13 | S56, S57, S63 | Arc-Waende funktionieren stabil in 2D inkl. Oeffnungen |
| 72 | Full-Stack | Phase 13 | S59, S64, S67, S71 | Arc-Waende sind bemaßbar und in Sheets sauber darstellbar |
| 73 | Full-Stack | Phase 13 | S51, S52, S53, S71, S72 | Arc-Waende erscheinen in 3D und werden im Export sinnvoll approximiert |

### Meilenstein Phase 13

| Nach Sprint | Ergebnis |
|-------------|----------|
| 71 | Gebogene Waende sind als echter Planungsprimitive im 2D-Kern verfuegbar |
| 72 | Gebogene Geometrie ist in Zeichnung und Bemaßung professionell nutzbar |
| 73 | Gebogene Waende funktionieren durchgaengig von 2D ueber 3D bis Interop |
---

## Phase 14 - Planer-UX fuer Split-View, Asset-Import und Praesentation (Sprints 74-76)

**Ziel:** Die bestehende technische Tiefe in eine schnellere, intuitivere
Planer-UX ueberfuehren: Split-View, synchroner Virtual Visitor, einfacher
Asset-Import und klarer Praesentationsmodus.

**Leitidee:**

- Split-View und Virtual Visitor
- schlanker Modell-Import
- Foto-/Videoexport mit wenigen klaren Presets

**Produktregel:**

- keine Fremd-Assets, Icons oder Quellcode uebernehmen
- nur Workflow- und Bedienideen adaptieren
- vollstaendige Eigenimplementierung in React, Konva und Three.js

**Core-vs-Plugin:**

- `S74` bleibt Core
- `S75` wird als Plugin `asset-library` umgesetzt
- `S76` wird als Plugin `presentation` umgesetzt

### Sprint-Uebersicht

| Sprint | Status | Thema | Deliverables |
|--------|--------|-------|--------------|
| 74 | `done` | Split-View & Virtual Visitor | 2D/3D-Split, synchroner Kameravisitor, persistente View-Settings |
| 75 | `done` | Plugin `asset-library`: Modell-Import & Asset-Browser Light | OBJ/DAE-Import, Bounding-Box, Auto-Scale, Asset-Bibliothek |
| 76 | `done` | Plugin `presentation`: Render-UX & Praesentationsmodus | Render-Presets, reduzierter Kundenmodus, vereinfachter Export |

### Sprint-Metadaten

| Sprint | Owner | ETA | Abhaengigkeiten | DoD-Kurzfassung |
|--------|-------|-----|----------------|-----------------|
| 74 | Full-Stack | Phase 14 | S14, S58, S69 | 2D- und 3D-View bleiben synchron, Visitor ist im Grundriss sichtbar |
| 75 | Full-Stack | Phase 14 | S20, S51, S53 | importierte OBJ/DAE-Assets sind such- und platzierbar |
| 76 | Full-Stack | Phase 14 | S14, S69, S74 | drei klare Render-Presets und ein echter Praesentationsmodus existieren |

### Meilenstein Phase 14

| Nach Sprint | Ergebnis |
|-------------|----------|
| 74 | Planen in 2D und Kontrollieren in 3D fuehlt sich simultan statt sequenziell an |
| 75 | Eigene Modelle koennen schnell importiert, skaliert und wiederverwendet werden |
| 76 | Kundenpraesentationen und schnelle Exporte funktionieren mit deutlich weniger UI-Reibung |

---

## Phase 15 - Umwelt, Materialien, Offline & Viewer (Sprints 77-80)

**Ziel:** Die Planer-UX um reale Umgebungsparameter, Materialverwaltung,
Offline-Nutzung und leichtere Sharing-/Exportpfade erweitern.

**Leitidee:**

- Compass und Tageslicht nach Ort/Uhrzeit
- importierte Texturen und Materialbibliotheken
- Offline-Nutzung und Aufmass-Import
- HTML5-Export, Planbild-Export und Side-View-Denke

**Bewusst nicht uebernommen:**

- fremdproduktspezifische Bibliotheksformate
- generische Dachgeneratoren ohne klaren Kuechen-ROI
- direkte GPL-Code- oder Asset-Nutzung

**Core-vs-Plugin:**

- `S77` als Plugin `daylight`
- `S78` als Plugin `materials`
- `S79` hybrid: Core-PWA plus Plugin `survey-import`
- `S80` als Plugin `viewer-export`

### Sprint-Uebersicht

| Sprint | Status | Thema | Deliverables |
|--------|--------|-------|--------------|
| 77 | `done` | Plugin `daylight`: Nordkompass, Sonnenstand & Tageslicht | Umweltmodell, Kompassoverlay, Sonnenpreview, Nordpfeil in Sheets |
| 78 | `done` | Plugin `materials`: Textur- & Materialbibliothek | Materialkatalog, Resolver, Texturzuweisung, Vorschau |
| 79 | `done` | Core + Plugin `survey-import`: Offline-PWA & Aufmass-Import | Manifest, Service Worker, Sync-Queue, Measurement-Import |
| 80 | `done` | Plugin `viewer-export`: HTML-Viewer & Vektor-Exporte | HTML/WebGL-Viewer, SVG-Planexport, SVG-Sheetexport |

### Sprint-Metadaten

| Sprint | Owner | ETA | Abhaengigkeiten | DoD-Kurzfassung |
|--------|-------|-----|----------------|-----------------|
| 77 | Full-Stack | Phase 15 | S14, S67, S76 | Projekt kennt Nordrichtung und Tageslicht wirkt in 3D und Layout |
| 78 | Full-Stack | Phase 15 | S20, S51, S75 | Materialien sind tenantweit verwaltbar und auf Flaechen/Assets anwendbar |
| 79 | Full-Stack | Phase 15 | S47, S58, S74 | zuletzt genutzte Projekte sind offline nutzbar und spaeter synchronisierbar |
| 80 | Full-Stack | Phase 15 | S64, S69, S76 | Viewer- und SVG-Exporte funktionieren fuer externe Weitergabe |

### Meilenstein Phase 15

| Nach Sprint | Ergebnis |
|-------------|----------|
| 77 | Licht- und Ausrichtungswirkung werden fuer Planung und Praesentation realer |
| 78 | Materialien und Texturen sind nicht mehr ad hoc, sondern als Bibliothek nutzbar |
| 79 | Der Planer wird unterwegs und bei instabiler Verbindung belastbar nutzbar |
| 80 | Planungen koennen deutlich leichter als Viewer oder Vektorunterlage geteilt werden |

---

## Phase 16 - Treppen, Levels & vertikale Projektlogik (Sprints 81-83)

**Ziel:** OKP von der Ein-Ebenen-Planung zu echten Mehr-Ebenen-Projekten
weiterentwickeln: Levels, Treppen, Deckenaussparungen, Vertikalschnitte und
levelfaehige Layout-/Exportpfade.

**Leitidee:**

- Levels / mehrere Geschosse
- Treppen-Workflow als Produktidee, nicht als Codevorlage
- Side View / vertikale Ansichten

**Core-vs-Plugin:**

- `S81` bleibt Core
- `S82` wird als Plugin `stairs` umgesetzt
- `S83` wird als Plugin `multilevel-docs` umgesetzt

### Sprint-Uebersicht

| Sprint | Status | Thema | Deliverables |
|--------|--------|-------|--------------|
| 81 | `done` | Mehr-Ebenen-Projektmodell | `BuildingLevel`, Level-CRUD, level-spezifische Raumlogik |
| 82 | `done` | Plugin `stairs`: Treppen & vertikale Verbindungen | Treppengeometrie, Vertikalverbindungen, Deckenaussparungen |
| 83 | `done` | Plugin `multilevel-docs`: Mehr-Ebenen-Layout, Sektionen & Interop | Vertikalschnitte, level-aware Sheets und Exportpfade |

### Plugin-Matrix

| Plugin-ID | Sprint | Bereich | Core-Hooks |
|-----------|--------|---------|------------|
| `asset-library` | 75 | Katalog / Assets | Katalogslots, Placement-Extensions, Upload |
| `presentation` | 76 | Rendering / Kundenmodus | Preview-Slots, Renderjobs, Tourdaten |
| `daylight` | 77 | Umwelt / Licht | Overlay-Slots, 3D-Licht, Sheet-Extensions |
| `materials` | 78 | Materialien / Texturen | Material-Resolver-Hooks, Upload, Preview |
| `survey-import` | 79 | Aufmass / Import | SiteSurvey, Blueprint-Import, Offline-Sync |
| `viewer-export` | 80 | Exporte / Sharing | Export-Registry, Share-Tokens, Document-Pipeline |
| `stairs` | 82 | Vertikale Geometrie | Level-Geometry-Hooks, 2D/3D-Extensions |
| `multilevel-docs` | 83 | Layout / Export | Sheets, Sections, Export-Extensions |

### Sprint-Metadaten

| Sprint | Owner | ETA | Abhaengigkeiten | DoD-Kurzfassung |
|--------|-------|-----|----------------|-----------------|
| 81 | Full-Stack | Phase 16 | S58, S64, S74 | Projekte koennen mehrere Ebenen mit aktiver Sicht-/Bearbeitungslogik fuehren |
| 82 | Full-Stack | Phase 16 | S73, S81 | Treppen verbinden Ebenen plausibel in 2D und 3D |
| 83 | Full-Stack | Phase 16 | S64, S72, S80, S81, S82 | Mehr-Ebenen-Projekte sind in Sheets, Sektionen und Exporten nutzbar |

### Meilenstein Phase 16

| Nach Sprint | Ergebnis |
|-------------|----------|
| 81 | Projekte koennen sauber in Ebenen statt nur in Raeumen organisiert werden |
| 82 | Vertikale Verbindungen wie Treppen werden als echte Planungselemente nutzbar |
| 83 | Mehr-Ebenen-Projekte sind dokumentierbar, praesentierbar und exportierbar |

---

## Phase 17 - Internationalisierung & Sprachpakete (Sprints 84-86)

**Ziel:** OKP bekommt echte Mehrsprachenfaehigkeit fuer UI, Tenant-Terminologie,
Dokumente und Share-/Viewer-Pfade.

**Leitidee:**

- eingebaute UI-Translations
- auswaehlbare Sprache in den Einstellungen
- optionale externe Sprachpakete

### Sprint-Uebersicht

| Sprint | Status | Thema | Deliverables |
|--------|--------|-------|--------------|
| 84 | `done` | i18n-Core & Locale Switcher | Message-Kataloge, Locale-Resolver, Sprachumschalter |
| 85 | `done` | Language Packs & Uebersetzungsverwaltung | verwaltbare Sprachpakete und Tenant-Overrides |
| 86 | `done` | Mehrsprachige Dokumente & Shares | locale-aware PDFs, Viewer und Exporte |

### Sprint-Metadaten

| Sprint | Owner | ETA | Abhaengigkeiten | DoD-Kurzfassung |
|--------|-------|-----|----------------|-----------------|
| 84 | Full-Stack | Phase 17 | S74 optional | UI kann mindestens Deutsch und Englisch nativ umschalten |
| 85 | Full-Stack | Phase 17 | S84 | Tenant-spezifische Sprachpakete und Fachwort-Overrides sind moeglich |
| 86 | Full-Stack | Phase 17 | S61, S80, S84 | Dokumente und Shares koennen sprachspezifisch erzeugt werden |

### Meilenstein Phase 17

| Nach Sprint | Ergebnis |
|-------------|----------|
| 84 | Die Anwendung ist nicht mehr implizit deutschsprachig |
| 85 | Uebersetzungen und Fachterminologie lassen sich strukturiert verwalten |
| 86 | Kundenartefakte werden in der passenden Sprache ausgeliefert |

---

## Phase 18 - Editor-Steuerung, Schutz & CAD-Gruppierung (Sprints 87-90)

**Ziel:** Den Editor bei grossen und komplexen Projekten robuster und
produktiver machen: bessere Navigation, Locking/Sichtbarkeit, geordnete
Browser und CAD-artige Gruppen-/Bauteillogik.

**Leitidee:**

- Middle mouse panning, touchpad navigation, invertierte Achsen
- lockable levels, hidden dimensions, safe edit
- favorite folders und browser filters
- gruppierbare Zeichnungselemente und Auswahlsets

### Sprint-Uebersicht

| Sprint | Status | Thema | Deliverables |
|--------|--------|-------|--------------|
| 87 | `done` | Navigation-UX & Input-Profile | MMB-Pan, Touchpad-Profile, CAD-Navigation |
| 88 | `planned` | Locking, Visibility & Safe-Edit | Lock-/Hide-Logik fuer Level, Maße und Objekte |
| 89 | `planned` | Browser-Favoriten, Ordner & Kollektionen | Favoriten, Unterordner, gespeicherte Filter |
| 90 | `planned` | CAD-Gruppen, Bauteile & Auswahlsets | Gruppen, Auswahlsets, Bauteilbloecke, Batch-Transform |

### Sprint-Metadaten

| Sprint | Owner | ETA | Abhaengigkeiten | DoD-Kurzfassung |
|--------|-------|-----|----------------|-----------------|
| 87 | Frontend | Phase 18 | S74 | Navigation fuehlt sich CAD-nah und konsistent an |
| 88 | Full-Stack | Phase 18 | S63, S81 | gelockte/verborgene Teilmengen sind sicher beherrschbar |
| 89 | Full-Stack | Phase 18 | S75, S78 | grosse Browser bleiben ueber Favoriten und Ordner handhabbar |
| 90 | Full-Stack | Phase 18 | S81, S88 | Zeichnungselemente koennen wie CAD-Gruppen logisch organisiert werden |

### Meilenstein Phase 18

| Nach Sprint | Ergebnis |
|-------------|----------|
| 87 | Editor und 3D-Steuerung fuehlen sich deutlich professioneller an |
| 88 | Komplexe Projekte lassen sich sicherer bearbeiten |
| 89 | Asset- und Materialbibliotheken bleiben auch im Alltag uebersichtlich |
| 90 | Zeichnungsmodelle, Bauteile und Maßgruppen sind als echte Arbeitsstruktur nutzbar |

---

## Phase 19 - Dokumente, Projektsteuerung & kaufmaennische Robustheit (Sprints 91-96)

**Ziel:** Dokumente, Projektstatus, Katalogindizes und kaufmaennische Regeln fuer den Studio- und Handwerksalltag robuster und zentral steuerbar machen.

### Sprint-Uebersicht

| Sprint | Status | Thema | Deliverables |
|--------|--------|-------|--------------|
| 91 | `planned` | Dokumente, PDF-Archiv & Versionssicherung | Dokumententab, PDF-Ablage, Backup-/Versionspruefung |
| 92 | `planned` | Projektarchiv, Kontakte & Shop-Defaults | Archivsicht, Kontaktregister, Standardwerte je Tenant |
| 93 | `planned` | Katalogversionen, Index-Sharing & Lieferantenaufschlaege | parallele Katalogversionen, freigegebene Indizes, Preisaufschlaege |
| 94 | `planned` | Bestellstatus, Positionsnummern & Sperranzeige | Sammel-Lieferstatus, Renummerierung, Lock-Info |
| 95 | `planned` | Raumaufmass-Import & robuste JSON-Interop | Aufmass-JSON, Validierung, Importdiagnostik |
| 96 | `planned` | MwSt-, Skonto- & Zusatzartikel-Profile | Steuerprofile, Rabattlogik, Zusatzartikelgruppen |

### Sprint-Metadaten

| Sprint | Owner | ETA | Abhaengigkeiten | DoD-Kurzfassung |
|--------|-------|-----|----------------|-----------------|
| 91 | Full-Stack | Phase 19 | S61, S70, S79 | Dokumente sind versioniert, archiviert und als PDF nachvollziehbar |
| 92 | Full-Stack | Phase 19 | S47, S49, S84 | Projektarchiv und Kontakte sind tenantweit konsistent verwaltbar |
| 93 | Backend | Phase 19 | S20, S29, S54 | Katalogversionen und Indexregeln sind parallel und freigegeben nutzbar |
| 94 | Full-Stack | Phase 19 | S46, S48, S60 | Bestellstatus, Renummerierung und Locks sind transparent bedienbar |
| 95 | Full-Stack | Phase 19 | S47, S58, S79 | Raumaufmass-Dateien werden robust validiert und importiert |
| 96 | Backend | Phase 19 | S13, S49, S54 | MwSt- und Skontologik ist profilbasiert und reporting-faehig |

### Meilenstein Phase 19

| Nach Sprint | Ergebnis |
|-------------|----------|
| 91 | Dokumente und Exporte sind revisionssicherer organisiert |
| 92 | Projekte, Kontakte und Defaults lassen sich zentral und sauber fuehren |
| 93 | Preis- und Katalogpflege wird fuer groessere Datenstaende beherrschbar |
| 94 | Bestellung und Projektstatus werden operativ transparenter |
| 95 | Survey- und JSON-Importe werden deutlich robuster |
| 96 | Kaufmaennische Regeln sind sauber konfigurierbar statt implizit verdrahtet |

---

## Phase 20 - Aufmass-Formatadapter & Feldimport (Sprint 97)

**Ziel:** Konkrete Aufmassformate als saubere Plugin-Adapter auf den
generischen `survey-import`-Rahmen aufsetzen, statt provider-spezifische
Sonderlogik in Core-Routen zu verteilen.

### Sprint-Uebersicht

| Sprint | Status | Thema | Deliverables |
|--------|--------|-------|--------------|
| 97 | `planned` | POS Aufmassservice-Import | Plugin-Adapter fuer Aufmassservice-Dateien mit Wall-/Door-/Window-/Installation-Mapping |

### Sprint-Metadaten

| Sprint | Owner | ETA | Abhaengigkeiten | DoD-Kurzfassung |
|--------|-------|-----|----------------|-----------------|
| 97 | Full-Stack | Phase 20 | S57, S79 | EGI-Dateien lassen sich ueber `survey-import` mit Preview, Warnings und Mapping auf Raum, Oeffnungen und Installationen importieren |

### Meilenstein Phase 20

| Nach Sprint | Ergebnis |
|-------------|----------|
| 97 | Ein reales strukturiertes Aufmassformat ist als wiederverwendbarer Plugin-Adapter produktiv angebunden |

---

## Phase 21 - Produktstabilisierung vor weiterem Ausbau (Sprint 98)

**Ziel:** Vor weiteren Ausbau-Sprints wird OKP wieder als durchgehend
benutzbare Anwendung stabilisiert. Fokus ist nicht Feature-Breite, sondern ein
sauber integrierter Produktkern.

**Leitidee:**

- Produktpfad vor Featuretiefe
- Goldene Pfade vor neuem Scope
- Stabilisierung entlang von `UX`, `Security`, `Findings`, `Logik`

### Sprint-Uebersicht

| Sprint | Status | Thema | Deliverables |
|--------|--------|-------|--------------|
| 98 | `done` | Stabilisierungsphase | Produktpfad stabilisieren, Kern-Findings abbauen, Goldene Pfade absichern |

### Sprint-Metadaten

| Sprint | Owner | ETA | Abhaengigkeiten | DoD-Kurzfassung |
|--------|-------|-----|----------------|-----------------|
| 98 | Full-Stack | Phase 21 | S61-S81 | Anwendung ist wieder zusammenhaengend benutzbar und die Goldenen Pfade laufen reproduzierbar |

### Fokusbereiche

| Bereich | Inhalt |
|---------|--------|
| UX | Hauptseiten, Navigation, tote Buttons, Encoding, Bedienbarkeit |
| Security | Tenant-Scoping, Plugin-Gating, Fremdzugriffs-Checks |
| Findings | bekannte Review-, Build- und Runtime-Probleme |
| Logik | Datenmodell-, Migrations- und Service-Konsistenz |

### Meilenstein Phase 21

| Nach Sprint | Ergebnis |
|-------------|----------|
| 98 | OKP ist wieder als integrierte Anwendung beurteilbar statt nur als Sammlung einzelner Features |
