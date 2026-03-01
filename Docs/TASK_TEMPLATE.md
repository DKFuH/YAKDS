# TASK_TEMPLATE.md

## Aufgabenvorlage

```
## TASK-[SPRINT]-[NR] – [Titel]

**Sprint:** [0–19]
**Zuständig:** Claude Code | Codex | Github Companion
**Abhängigkeiten:** [TASK-IDs oder "keine"]
**Priorität:** Muss | Soll | Kann
**Status:** Offen | In Arbeit | Erledigt

### Ziel
[1-2 Sätze was erreicht werden soll]

### Akzeptanzkriterien
- [ ] Kriterium 1
- [ ] Kriterium 2

### Technische Hinweise
[Wichtige Einschränkungen, verwendete Objekte, API-Contracts]

### Nicht in Scope
[Was explizit NICHT gemacht wird]
```

---

## Zuständigkeiten

| Agent | Stärken | Typische Aufgaben |
|---|---|---|
| **Claude Code** | Architektur, API, End-to-End | Repo-Struktur, API-Contracts, Feature-Umsetzung, Datenfluss |
| **Codex** | Algorithmen, isolierte Module | Polygon-Math, Kollision, Preisregeln, BOM, Tests |
| **Github Companion** | Review, Analyse | PR-Review, Dokumentationscheck, Sicherheitsanalyse |

---

## Phase-2 P0/P1 Issue-Vorlagen (direkt nutzbar)

## TASK-20-C01 – Article Pricing & BOM Bridge

**Sprint:** 20 / 21
**Zuständig:** Claude Code | Codex
**Abhängigkeiten:** keine
**Priorität:** Muss
**Status:** Offen

### Ziel
Herstellerartikel aus Phase 2 (`CatalogArticle`/Variante) müssen in BOM und Preislogik korrekt auflösbar und bepreist sein.

### Akzeptanzkriterien
- [ ] `bomCalculator.ts` löst `article_variant_id` belastbar auf.
- [ ] Preisfindung greift auf `ArticlePrice` zurück, Netto-Preis > 0 bei validem Artikeldatensatz.
- [ ] BOM-Zeilen für Herstellerartikel enthalten korrekte `tax_group_id`/MwSt.

### Technische Hinweise
- Fokusdateien: `planner-api/src/services/bomCalculator.ts`, `planner-api/src/services/bomCalculator.test.ts`.
- Verifikation über Unit-Test mit `CatalogArticle`-Placement.

### Nicht in Scope
- Kein Ausbau der BI-Visualisierung.
- Kein Umbau der kompletten PDF-Layoutlogik.

---

## TASK-22-L01 – Fix Rule Engine: 2D World-Collision

**Sprint:** 22
**Zuständig:** Codex
**Abhängigkeiten:** TASK-20-C01
**Priorität:** Muss
**Status:** Offen

### Ziel
Kollisionsprüfung muss wandübergreifend funktionieren (insbesondere 90°-Eckfälle), nicht nur wall-id-lokal.

### Akzeptanzkriterien
- [ ] Alle Placements werden über `getWorldPolygon()` in Weltkoordinaten geprüft.
- [ ] SAT (Separating Axis Theorem) wird für 2D-Überschneidung verwendet.
- [ ] Bei Eckkollision wird `COLL-001` zuverlässig ausgelöst.

### Technische Hinweise
- Fokus auf Validierungs-/Rule-Engine-Pfad (`validateV2`, geometrische Hilfsfunktionen).
- Muss als reproduzierbarer Testfall abgesichert sein: zwei Schränke an 90°-Ecke mit physischer Überlappung.

### Nicht in Scope
- Kein Ausbau weiterer Regelkategorien außerhalb Kollision.

---

## TASK-23-S01 – Security: Tenant Scoping Export/Import

**Sprint:** 23
**Zuständig:** Claude Code
**Abhängigkeiten:** keine
**Priorität:** Muss
**Status:** Offen

### Ziel
Mandantenisolation für Export/Import-Endpunkte durchgängig erzwingen.

### Akzeptanzkriterien
- [ ] `exports.ts` validiert `project.tenant_id` gegen Request-Tenant.
- [ ] `imports.ts` ordnet ImportJobs strikt Request-Tenant zu.
- [ ] Tenant-Routen sind nur mit klarer AuthZ nutzbar (Super-Admin oder tenant-scoped Berechtigung).

### Technische Hinweise
- Cross-Tenant-Aufrufe müssen 403/404 liefern.
- Integrationstests mit Tenant-A/B Szenarien als Pflicht.

### Nicht in Scope
- Keine IdP-Migration (Auth0/Keycloak) in diesem Task.

---

## TASK-21-A01 – Auto-Completion Determinismus

**Sprint:** 21
**Zuständig:** Codex
**Abhängigkeiten:** TASK-20-C01
**Priorität:** Soll
**Status:** Erledigt

### Ziel
Automatisch generierte Langteile (`GeneratedItem`) müssen deterministisch neu aufgebaut und korrekt bepreist werden.

### Akzeptanzkriterien
- [x] `GeneratedItem` fließt in `priceCalculator.ts` ein.
- [x] Rebuild entfernt nur verwaiste generierte Segmente desselben Projekts.
- [x] `is_generated` bleibt über Speichern/Laden stabil.

### Technische Hinweise
- End-to-End-Szenario: Schrank verschieben -> Auto-Completion -> BOM ersetzt alte Segmente durch neue, bepreiste Segmente.

### Nicht in Scope
- Kein Redesign der Auto-Completion-UI.

---

## TASK-20-F01 – Frontend: Varianten-Selector Pro

**Sprint:** 20
**Zuständig:** Claude Code
**Abhängigkeiten:** keine
**Priorität:** Soll
**Status:** Erledigt

### Ziel
Konfigurator für Herstellerartikel um vollständige Options-/Variantenführung und Preis-Preview ergänzen.

### Akzeptanzkriterien
- [x] `ArticleOption` (`enum`) wird dynamisch auf Dropdowns gemappt.
- [x] Auswahl aktualisiert `selectionOptions`/Editor-State deterministisch.
- [x] Variantenpreis wird als Live-Preview im Konfigurator angezeigt.

### Technische Hinweise
- Fokus: `LeftSidebar`, `RightSidebar`/`KonfiguratorPanel`, BOM-Payload-Aufbau im Editor.

### Nicht in Scope
- Kein neuer Katalogmodus außerhalb Standard/Hersteller.

---

## Phase-3 Basis-Taskvorlagen (Sprints 25-30)

## TASK-25-P01 – Projekt-/Aufgabenmanagement

**Sprint:** 25
**Zuständig:** Claude Code | Codex
**Abhängigkeiten:** TASK-23-S01, TASK-24-A01
**Priorität:** Muss
**Status:** Offen

### Ziel
Projekte mit Status, Fristen, Prioritäten und Verantwortlichen teamfähig steuern (Kanban + Gantt).

### Akzeptanzkriterien
- [ ] `Project` enthält `project_status`, `deadline`, `priority`, `assigned_to`, `progress_pct`.
- [ ] Board-API (`/projects/board`) unterstützt Filter nach Status/Branch/Frist.
- [ ] Drag&Drop-Statuswechsel ist persistent und läuft tenant-sicher.
- [ ] 5-10 Tests decken Workflow, Filter und Rechte ab.

### Technische Hinweise
- APIs: `PATCH /projects/:id/status`, `PATCH /projects/:id/assign`, `GET /projects/gantt`.

### Nicht in Scope
- Kein vollwertiges Ressourcen-/Kapazitätsplanungsmodul.

---

## TASK-26-D01 – Dokumentenmanagement

**Sprint:** 26
**Zuständig:** Claude Code
**Abhängigkeiten:** TASK-25-P01
**Priorität:** Muss
**Status:** In Arbeit

### Ziel
Projektbezogene Dokumente zentral speichern, filtern, vorschauen und sicher teilen.

### Akzeptanzkriterien
- [ ] `Document`-Entity inkl. Typ, Tags, Sichtbarkeit und Upload-Metadaten ist vorhanden.
- [ ] Stapel-Upload, Vorschau (PDF/Bild), Suche und Tag-Filter sind im Frontend verfügbar.
- [ ] Quote-PDF, Rendering und CAD-Import werden automatisch als Dokumente angehängt.
- [ ] Dateien liegen tenant-sicher in S3-kompatiblem Object Storage.

### Technische Hinweise
- APIs: `POST/GET/DELETE /projects/:id/documents`.

### Nicht in Scope
- Kein DMS-Versionierungs-Workflow mit Freigabeketten.

---

## TASK-27-C01 – Kontakte / CRM-Light

**Sprint:** 27
**Zuständig:** Claude Code | Codex
**Abhängigkeiten:** TASK-24-A01
**Priorität:** Muss
**Status:** Offen

### Ziel
Kontakte als zentrale CRM-Light-Schicht einführen und mit Projekten verbinden.

### Akzeptanzkriterien
- [ ] `Contact`-Entity inkl. `lead_source` und Basis-Kundendaten ist implementiert.
- [ ] Projekt-Kontakt-Verknüpfung (`/projects/:id/contacts/:contactId`) ist verfügbar.
- [ ] Webplaner-Leads erzeugen automatisch `Contact` + verknüpftes Lead-Projekt.
- [ ] Kontaktübersicht zeigt Projektanzahl und Umsatzkennzahlen.

### Technische Hinweise
- API: `GET/POST /contacts` mit tenant-sicherer Suche.

### Nicht in Scope
- Keine Kampagnen-/Newsletter-Automation.

---

## TASK-28-B01 – Personalisierte Dashboards / KPIs

**Sprint:** 28
**Zuständig:** Claude Code
**Abhängigkeiten:** TASK-23-A01, TASK-25-P01, TASK-27-C01
**Priorität:** Soll
**Status:** Offen

### Ziel
Nutzerspezifische Dashboards mit konfigurierbaren KPI-/Listen-Widgets bereitstellen.

### Akzeptanzkriterien
- [ ] `DashboardConfig` pro User ist speicher- und ladbar.
- [ ] Mindestens 4 Standard-Widgets (`sales_chart`, `current_projects`, `current_contacts`, `kpi_cards`) sind produktiv.
- [ ] Layout kann per Drag&Drop angepasst und persistiert werden.
- [ ] KPI-Werte aktualisieren sich zeitnah bei Projekt-/Quote-Änderungen.

### Technische Hinweise
- APIs: `GET/PUT /dashboards/:userId`, `GET /kpis/sales-chart`.

### Nicht in Scope
- Kein frei programmierbarer Widget-Marktplatz.

---

## TASK-29-I01 – Katalogindexierung & Preisanpassung

**Sprint:** 29
**Zuständig:** Codex
**Abhängigkeiten:** TASK-20-C01
**Priorität:** Muss
**Status:** Offen

### Ziel
Projektbezogene EK-/VK-Indexe einführen, ohne Katalogstammdaten zu verändern.

### Akzeptanzkriterien
- [ ] `CatalogIndex`-Entity ist mit Projekt und Katalog verknüpft.
- [ ] Pricing berücksichtigt `purchase_index` und `sales_index` deterministisch.
- [ ] BOM/Quote zeigen den angewandten Index nachvollziehbar an.
- [ ] Regressionstests schützen die 9-stufige Preislogik.

### Technische Hinweise
- APIs: `POST/GET /projects/:id/catalog-indices`.

### Nicht in Scope
- Kein globales, tenant-weites Überschreiben aller Kataloge ohne Projektbezug.

---

## TASK-30-C01 – Cloud-Sync & Plattform-Features

**Sprint:** 30
**Zuständig:** Claude Code | Codex
**Abhängigkeiten:** TASK-26-D01, TASK-27-C01, TASK-28-B01
**Priorität:** Muss
**Status:** Offen

### Ziel
Cloud-Betrieb mit Auto-Backup, globaler Suche, Benachrichtigungen und Export abschließen.

### Akzeptanzkriterien
- [ ] Tägliche Snapshots für Projekte/Quotes werden automatisiert gesichert.
- [ ] Globale Suche über Projekte/Kontakte/Dokumente funktioniert tenant-sicher.
- [ ] Kritische Projekt-/Dokument-Events erzeugen E-Mail-Benachrichtigungen.
- [ ] CSV/Excel-Exporte für Projekt- und Kontaktlisten sind verfügbar.
- [ ] End-to-End-Test besteht: Lead -> Planung -> Quote -> Projektmanagement -> Abschluss.

### Technische Hinweise
- APIs: `/search`, `/webhooks/email-notifications`, `/projects/export-csv`.

### Nicht in Scope
- Kein Full-ERP-Finanzmodul (FiBu/DATEV/Controlling).
