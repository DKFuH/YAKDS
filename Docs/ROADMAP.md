# ROADMAP.md

Sprint-Planung für MVP (Sprints 0-19), Phase 2 (Sprints 20-24) und Phase 3 (Sprints 25-30) inkl. aktuellem Fortschritt.

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
| 25 | `in_progress` | Full-Stack | Phase 3 | Projektboard/Gantt und Status-/Assign-Pfade bereits vorhanden, weitere Härtung offen |
| 26 | `done` | Backend-Lead | Phase 3 | Dokumentrouten und Kern-Integration inkl. Auto-Attach/Download aktiv |
| 27 | `done` | Backend-Lead | Phase 3 | Kontakt-API + Projektverknüpfung + CRM-Ansicht mit KPIs aktiv |
| 28 | `done` | Full-Stack | Phase 3 | DashboardConfig + KPI-Endpunkte + Dashboard-UI integriert |
| 29 | `done` | Backend-Lead | Phase 3 | CatalogIndex-API + Pricing-Einfluss + Batch-UI integriert |
| 30 | `in_progress` | Full-Stack | Phase 3 | Suche/Export/Notifications/Backup-Endpunkte und Frontend-Anbindung vorhanden |

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

**Meta:** Status: `planned` · Owner: Full-Stack · ETA: Phase 4 · Abhängigkeiten: S30

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

**Meta:** Status: `planned` · Owner: Full-Stack · ETA: Phase 4 · Abhängigkeiten: S31

**Ziel:** Baumstruktur + globale Kopfdaten pro Alternative – F7 öffnet überall.

**Features:**

- Projekt-View: Baum „Bereiche > Alternativen" (Rechtsklick: Neu/Duplicate/Delete, Doppelklick öffnen).
- Modell-/Indexeinstellungen-Dialog (F7): Küchenmodell, Arbeitsplatte, Sockel/Abdeckboden, Raum.
- `POST /projects/:id/areas`, `POST /projects/:id/areas/:areaId/alternatives`.
- `GET|PUT /alternatives/:id/model-settings`.

**DoD:** Bereich/Alternative anlegen, Modell ändern → Einstellungen persistiert.

---

### Sprint 33 – Onboarding & Lernreise

**Meta:** Status: `planned` · Owner: Frontend-Lead · ETA: Phase 4 · Abhängigkeiten: S31, S32

**Ziel:** Neuer User kann sich selbstständig einrichten – mit Tutorials und Helpdesk-Links.

**Features:**

- Onboarding-Wizard: Nach erstem Login → „Erste Schritte": Shop-Setup, erster Katalog, Testprojekt.
- Lernreise-UI: Step-by-Step mit Icons und CTA-Buttons.
- Benachrichtigungen: „Speichern nicht automatisch – jetzt speichern?".

**DoD:** Neuer User durchläuft Wizard, findet Tutorials, öffnet Support-Centre.

---

### Sprint 34 – Workspace-Layout & Projekt-Details

**Meta:** Status: `planned` · Owner: Frontend-Lead · ETA: Phase 4 · Abhängigkeiten: S33

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

**Meta:** Status: `planned` · Owner: Full-Stack · ETA: Phase 5 · Abhängigkeiten: S34, S8

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

**Meta:** Status: `planned` · Owner: Backend-Lead · ETA: Phase 5 · Abhängigkeiten: S41, S13

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

**Meta:** Status: `planned` · Owner: Frontend-Lead · ETA: Phase 5 · Abhängigkeiten: S42

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

**Meta:** Status: `planned` · Owner: Full-Stack · ETA: Phase 5 · Abhängigkeiten: S43, S13

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

**Meta:** Status: `planned` · Owner: Full-Stack · ETA: Phase 5 · Abhängigkeiten: S44, S33

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

**Meta:** Status: `in_progress` · Owner: Backend-Lead · ETA: Phase 6 · Abhängigkeiten: S45, S42

**Ziel:** Bestätigtes Angebot erzeugt zwei verknüpfte Entitäten: interne `ProductionOrder` (Produktionsauftrag im Studio) und externe `PurchaseOrder` (Bestellung an den Küchenhersteller).

> **Stand:** `PurchaseOrder` + `PurchaseOrderItem` + 6 API-Routen bereits implementiert (PR #10, gemergt 2026-03-02, +12 Tests). `ProductionOrder` + Freeze-Guard noch ausstehend.

**Features:**

- **PurchaseOrder (Herstellerbestellung) ✅ PR #10:**
  Bestellschein an den Küchenhersteller mit Positionen (SKU, Menge, Preis).
  Status-Lifecycle: `draft → sent → confirmed → partially_delivered → delivered → cancelled`.
  6 CRUD-Endpunkte inkl. Status-Workflow-Übergänge + Notification-Trigger.

- **ProductionOrder (interner Produktionsauftrag):**
  Konvertierung des bestätigten Angebots in einen internen Produktionsauftrag; BOM wird eingefroren (Snapshot).
  Status-Lifecycle: `draft → confirmed → in_production → ready → delivered → installed`.
  Statusübergänge mit Zeitstempel und User-Referenz geloggt.

- **Produktionsübersicht:** Listenansicht aller Aufträge mit Filter nach Status, Fälligkeit, Sachbearbeiter; Drill-down auf Positionen.

- **Freeze-Guard:** Änderungen an Planung/BOM nach Konvertierung blockiert; UI-Hinweis mit Option auf neue Alternative.

- **Verknüpfung:** `PurchaseOrder` referenziert `ProductionOrder`; Status-Updates der Herstellerbestellung aktualisieren den Produktionsauftrag.

**Datenmodell:**
- `purchase_orders` ✅ – (id, status, items[], created_at) – PR #10
- `purchase_order_items` ✅ – (order_id, position, sku, quantity, unit_price) – PR #10
- `production_orders` – (quote_id, bom_snapshot JSON, status, created_at) – ausstehend
- `production_order_events` – Audit-Log (order_id, from_status, to_status, user_id, timestamp) – ausstehend

**Deliverables (ausstehend):** `ProductionOrderService`, Freeze-Guard in API, Produktionsübersicht-UI, Verknüpfung PO↔PurchaseOrder, 15 weitere Tests.

**DoD:** Angebot → Produktionsauftrag konvertiert; BOM-Snapshot unveränderlich; Planungsänderung nach Freeze blockiert; PurchaseOrder mit ProductionOrder verknüpft; Statuswechsel beider Entitäten geloggt.

---

### Sprint 47 – Mobile Aufmaß & Baustellenprotokoll

**Meta:** Status: `planned` · Owner: Frontend-Lead · ETA: Phase 6 · Abhängigkeiten: S46

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

**Meta:** Status: `planned` · Owner: Backend-Lead · ETA: Phase 6 · Abhängigkeiten: S47, S46

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

**Meta:** Status: `planned` · Owner: Backend-Lead · ETA: Phase 6 · Abhängigkeiten: S48, S28

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

**Meta:** Status: `planned` · Owner: Security-Lead · ETA: Phase 6 · Abhängigkeiten: S49, S23

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

**Meta:** Status: `planned` · Owner: Frontend-Lead · ETA: Phase 7 · Abhängigkeiten: S50, S14

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

**Meta:** Status: `planned` · Owner: Interop-Lead · ETA: Phase 7 · Abhängigkeiten: S51, S3.5

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

**Meta:** Status: `planned` · Owner: Interop-Lead · ETA: Phase 7 · Abhängigkeiten: S52, S19

**Ziel:** Bestehende Stubs (DWG, SKP) vollständig implementieren; pCon.planner-Interop-Parität erreichen.

**Hintergrund:** DWG-Stubs (`interop-cad/dwg-import`, `dwg-export`) und SKP-Export-Stub (`interop-sketchup/skp-export`) existieren bereits im Repo ohne Implementierung.

**Features:**
- **DWG-Import:** Grundriss aus DWG-Datei importieren (Wände, Öffnungen); Bibliothek: `@jscad/dxf` oder Open Design Alliance Node Wrapper
- **DWG-Export:** Planung (Wandansichten, Grundriss, Maßketten) als DWG exportieren
- **SKP-Export:** Planung als SketchUp-Datei exportieren (`skp-export`-Stub implementieren)
- **DXF-Vollständigkeit:** Bestehenden DXF-Import/Export gegen reale Dateien aus Planungssoftware testen und Lücken schließen
- **Batch-Export:** Alle Formate (DXF, DWG, GLTF, IFC) über einen einzigen `POST /alternatives/:id/export`-Endpunkt mit `format`-Parameter

**Deliverables:** DWG-Import/-Export vollständig, SKP-Export vollständig, Batch-Export-Endpunkt, 25 Tests (inkl. Round-Trip-Tests DXF→OKP→DXF).

**DoD:** DWG-Grundriss importiert und als Raum sichtbar; DWG-Export öffnet in AutoCAD/LibreCAD ohne Fehler; SKP-Export öffnet in SketchUp; Batch-Export liefert alle Formate in einem ZIP.

---

### Sprint 54 – Konfigurierbare Artikel & Abhängigkeitslogik (OFML-Parität)

**Meta:** Status: `planned` · Owner: Backend-Lead · ETA: Phase 7 · Abhängigkeiten: S53, S20

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

**Meta:** Status: `planned` · Owner: Full-Stack · ETA: Phase 7 · Abhängigkeiten: S54, S14

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
