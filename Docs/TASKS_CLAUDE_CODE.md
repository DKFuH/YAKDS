# TASKS_CLAUDE_CODE.md

## Aufgaben für Claude Code

**Zuständigkeit:** Architektur, API-Struktur, größere Refactorings, End-to-End-Features, Datenfluss Frontend ↔ API ↔ Worker ↔ Interop

---

## TASK-0-01 – Repo-Struktur und Grundgerüst anlegen

**Sprint:** 0
**Zuständig:** Claude Code
**Abhängigkeiten:** keine
**Priorität:** Muss
**Status:** Offen

### Ziel
Repo-Struktur gemäß Plan anlegen, Grundpakete initialisieren.

### Akzeptanzkriterien
- [ ] Verzeichnisse `planner-frontend/`, `planner-api/`, `render-worker/`, `shared-schemas/`, `interop-cad/`, `interop-sketchup/` angelegt
- [ ] Basis-Package-Files je Paket vorhanden
- [ ] `docs/` mit Platzhalter-Dokumenten befüllt

### Nicht in Scope
Echte Implementierung — nur Strukturgerüst

---

## TASK-0-02 – ARCHITECTURE.md verfassen

**Sprint:** 0
**Zuständig:** Claude Code
**Abhängigkeiten:** TASK-0-01
**Priorität:** Muss
**Status:** Offen

### Ziel
Technische Architektur dokumentieren: Schichten, Kommunikationswege, Tech-Stack.

### Akzeptanzkriterien
- [ ] Frontend ↔ API ↔ Worker ↔ Interop beschrieben
- [ ] Datenbankstrategie (Postgres) festgehalten
- [ ] Render-Protokoll-Überblick vorhanden
- [ ] CAD/SKP-Interop-Strategie skizziert

---

## TASK-0-03 – ROOM_MODEL.md verfassen

**Sprint:** 0
**Zuständig:** Claude Code
**Abhängigkeiten:** TASK-0-02
**Priorität:** Muss
**Status:** Offen

### Ziel
Domänenmodell für Räume, Wände, Öffnungen, Dachschrägen definieren.

### Akzeptanzkriterien
- [ ] `Room`, `RoomBoundary`, `Vertex`, `WallSegment`, `Opening`, `CeilingConstraint` beschrieben
- [ ] JSON-Beispielstruktur vorhanden
- [ ] Platzierungskonzept `wall_id + offset` erklärt

---

## TASK-0-04 – PRICING_MODEL.md und QUOTE_MODEL.md verfassen

**Sprint:** 0
**Zuständig:** Claude Code
**Abhängigkeiten:** TASK-0-02
**Priorität:** Muss
**Status:** Offen

### Ziel
Kaufmännische Kernobjekte und Berechnungsreihenfolge dokumentieren.

### Akzeptanzkriterien
- [ ] 9-stufige Preislogik beschrieben (Listenpreis → Rundung)
- [ ] `BOMLine`, `PriceComponent`, `PriceSummary`, `Quote`, `QuoteItem` definiert
- [ ] API-Contracts für Pricing und Quote grob festgelegt

---

## TASK-0-05 – RENDER_PROTOCOL.md, CAD_INTEROP.md, SKP_INTEROP.md verfassen

**Sprint:** 0
**Zuständig:** Claude Code
**Abhängigkeiten:** TASK-0-02
**Priorität:** Muss
**Status:** Offen

### Akzeptanzkriterien
- [ ] Render-Job-Protokoll: Worker-Registrierung, Job-Fetch, Ergebnis-Upload beschrieben
- [ ] CAD-Interop: neutrales internes Austauschformat, Layer-Strategie, Scope DWG/DXF 2D
- [ ] SKP-Interop: Referenzmodell-Konzept, Mapping-Strategie

---

## TASK-1-01 – Backend-Grundgerüst (planner-api)

**Sprint:** 1
**Zuständig:** Claude Code
**Abhängigkeiten:** TASK-0-02
**Priorität:** Muss
**Status:** Offen

### Ziel
Lauffähiges Backend mit Postgres-Schema und erstem Projekt-CRUD.

### Akzeptanzkriterien
- [ ] Tabellen: `users`, `projects`, `project_versions`, `rooms`, `price_lists`, `tax_groups`, `quote_settings`
- [ ] API-Endpunkte: `POST /projects`, `GET /projects/:id`, `PUT /projects/:id`, `DELETE /projects/:id`
- [ ] Backend lokal startbar und testbar

---

## TASK-2-01 – Frontend-Grundgerüst (planner-frontend)

**Sprint:** 2
**Zuständig:** Claude Code
**Abhängigkeiten:** TASK-1-01
**Priorität:** Muss
**Status:** Offen

### Ziel
Web-App-Hülle mit Editor-Layout bereitstellen.

### Akzeptanzkriterien
- [ ] Projektliste zeigt Projekte aus API
- [ ] Editor-Layout: Canvas-Bereich, linke Sidebar, rechte Sidebar, Status-/Summenbereich
- [ ] Projekt öffnen navigiert in Editor-Ansicht

---

## TASK-3-01 – Polygon-Raumeditor Datenmodell und API

**Sprint:** 3
**Zuständig:** Claude Code
**Abhängigkeiten:** TASK-1-01, TASK-0-03
**Priorität:** Muss
**Status:** Offen

### Ziel
Räume als Polygon speichern und laden – Datenfluss Backend ↔ Frontend.

### Akzeptanzkriterien
- [ ] API: `POST /rooms`, `PUT /rooms/:id`, `GET /rooms/:id`
- [ ] Polygon wird als `Vertex[]` + `WallSegment[]` persistiert
- [ ] Frontend zeigt Polygon auf Canvas (Codex liefert Render-Logik)
- [ ] Snap-Optionen konfigurierbar (0/45/90°, Raster)

---

## TASK-3-02 – CAD/SKP Import-Pipeline definieren (Sprint 3.5)

**Sprint:** 3.5
**Zuständig:** Claude Code
**Abhängigkeiten:** TASK-0-05, TASK-1-01
**Priorität:** Muss
**Status:** Offen

### Ziel
Upload-Endpunkte und internes Austauschformat festlegen; Codex implementiert Parser.

### Akzeptanzkriterien
- [ ] API: `POST /imports/cad` (DWG/DXF), `POST /imports/skp`
- [ ] Neutrales internes Format (`ImportAsset`, `CadLayer`, `ReferenceGeometry`) definiert
- [ ] Datei wird gespeichert, Import-Job angelegt, Status abrufbar
- [ ] Frontend: Datei-Upload-UI vorhanden

---

## TASK-4-01 – Präzisionsbearbeitung Raumgeometrie (End-to-End)

**Sprint:** 4
**Zuständig:** Claude Code
**Abhängigkeiten:** TASK-3-01
**Priorität:** Muss
**Status:** Offen

### Ziel
Vertex-Verschiebung und numerische Kantenlängenänderung durchgängig verbinden.

### Akzeptanzkriterien
- [ ] Vertex-Move sendet PATCH an API, stable `wall_id` bleibt erhalten
- [ ] Kantenlänge per Eingabefeld änderbar
- [ ] CAD-Raumkontur-Übernahme: Polylinie → `RoomBoundary` Konvertierungsendpunkt
- [ ] Layer-Filter-UI vorhanden

---

## TASK-5-01 – Öffnungen Datenmodell und API

**Sprint:** 5
**Zuständig:** Claude Code
**Abhängigkeiten:** TASK-3-01
**Priorität:** Muss
**Status:** Offen

### Ziel
Türen/Fenster an Wänden persistieren und anzeigen.

### Akzeptanzkriterien
- [ ] API: `POST /openings`, `PUT /openings/:id`, `DELETE /openings/:id`
- [ ] `Opening` trägt: `wall_id`, `offset_mm`, `width_mm`, `height_mm`, `sill_height_mm`
- [ ] Öffnungen aus CAD-Import übernehmbar (Endpunkt zur Übernahme)

---

## TASK-6-01 – Height Constraints Datenmodell und API

**Sprint:** 6
**Zuständig:** Claude Code
**Abhängigkeiten:** TASK-3-01
**Priorität:** Muss
**Status:** Offen

### Akzeptanzkriterien
- [ ] API: `POST /ceiling-constraints`, `PUT /ceiling-constraints/:id`
- [ ] `CeilingConstraint`: `wall_id`, `kniestock_height_mm`, `slope_angle_deg`, `depth_into_room_mm`
- [ ] Endpunkt `GET /rooms/:id/available-height?x=&y=` ruft Codex-Berechnung ab

---

## TASK-7-01 – Katalog-API und Datenmodell

**Sprint:** 7
**Zuständig:** Claude Code
**Abhängigkeiten:** TASK-1-01
**Priorität:** Muss
**Status:** Offen

### Akzeptanzkriterien
- [ ] Tabellen: `catalog_items`, `pricing_groups`, `tax_groups`
- [ ] Felder: `list_price_net`, `dealer_price_net`, `default_markup_pct`, `tax_group_id`, `pricing_group_id`
- [ ] API: `GET /catalog/items`, `GET /catalog/items/:id`
- [ ] SKP-Mapping-Endpunkt vorbereitet (Sprint 7.5)

---

## TASK-8-01 – Wandbasierte Platzierungsengine (End-to-End)

**Sprint:** 8
**Zuständig:** Claude Code
**Abhängigkeiten:** TASK-3-01, TASK-7-01
**Priorität:** Muss
**Status:** Offen

### Ziel
Objekte an Wänden platzieren, verschieben, löschen – Full Stack.

### Akzeptanzkriterien
- [ ] API: `POST /placements`, `PUT /placements/:id`, `DELETE /placements/:id`
- [ ] `CabinetInstance`/`ApplianceInstance` mit `wall_id + offset_mm`
- [ ] Frontend: Drag-along-wall mit Codex-Algorithmus verbunden
- [ ] Innenrichtung der Wand korrekt aus Polygon abgeleitet

---

## TASK-9-01 – Geometrieprüfungs-Framework (End-to-End)

**Sprint:** 9
**Zuständig:** Claude Code
**Abhängigkeiten:** TASK-8-01
**Priorität:** Muss
**Status:** Offen

### Ziel
Prüf-API aufbauen; Codex implementiert Kollisionslogik.

### Akzeptanzkriterien
- [ ] API: `POST /projects/:id/validate`
- [ ] Response: `{ errors: RuleViolation[], warnings: RuleViolation[], hints: RuleViolation[] }`
- [ ] Frontend: Prüfpanel zeigt Ergebnisse
- [ ] Kostenhinweise (Sonderblende, Sonderzuschnitt) als `hints` konfigurierbar

---

## TASK-10-01 – Höhenprüfung Dachschrägen (End-to-End)

**Sprint:** 10
**Zuständig:** Claude Code
**Abhängigkeiten:** TASK-6-01, TASK-9-01
**Priorität:** Muss
**Status:** Offen

### Akzeptanzkriterien
- [ ] Höhenprüfung in `POST /projects/:id/validate` integriert
- [ ] Flags `requires_customization`, `height_variant`, `labor_surcharge` in `RuleViolation`
- [ ] Frontend zeigt Höhenkonflikte visuell an

---

## TASK-11-01 – BOM-API Endpunkt

**Sprint:** 11
**Zuständig:** Claude Code
**Abhängigkeiten:** TASK-8-01, TASK-7-01
**Priorität:** Muss
**Status:** Offen

### Akzeptanzkriterien
- [ ] API: `POST /projects/:id/calculate-bom`
- [ ] Response: strukturierte `BOMLine[]` als JSON
- [ ] Positionen: Möbel, Geräte, Zubehör, Zuschläge, Montage, Fracht
- [ ] Codex-BOM-Logik über Service-Schicht eingebunden

---

## TASK-11-02 – CAD/DXF Export-Pipeline (Sprint 11.5)

**Sprint:** 11.5
**Zuständig:** Claude Code
**Abhängigkeiten:** TASK-3-02, TASK-8-01
**Priorität:** Muss
**Status:** Offen

### Akzeptanzkriterien
- [ ] API: `POST /projects/:id/export-dwg`, `POST /projects/:id/export-dxf`
- [ ] Export enthält: Raumkontur, Wandlinien, Öffnungen, Möbelkonturen
- [ ] Layer-Struktur und Einheiten/Skalierung definiert
- [ ] Codex implementiert DWG/DXF-Schreib-Logik; Claude Code verbindet API ↔ Codex-Modul

---

## TASK-12-01 – Preisengine API

**Sprint:** 12
**Zuständig:** Claude Code
**Abhängigkeiten:** TASK-11-01, TASK-7-01
**Priorität:** Muss
**Status:** Offen

### Akzeptanzkriterien
- [ ] API: `POST /projects/:id/calculate-pricing`, `GET /projects/:id/price-summary`
- [ ] Response: `{ net, vat, gross, contribution_margin, markup_pct }`
- [ ] Codex-Preisregeln über Service-Schicht eingebunden

---

## TASK-13-01 – Angebotsmanagement (End-to-End)

**Sprint:** 13
**Zuständig:** Claude Code
**Abhängigkeiten:** TASK-12-01
**Priorität:** Muss
**Status:** Offen

### Akzeptanzkriterien
- [ ] Tabellen: `quotes`, `quote_items`
- [ ] API: `POST /projects/:id/create-quote`, `GET /quotes/:id`, `POST /quotes/:id/export-pdf`
- [ ] Angebot enthält: Nummer, Gültig-bis, Freitext, Versionen
- [ ] PDF light generierbar

---

## TASK-14-01 – Browser-3D-Preview (End-to-End)

**Sprint:** 14
**Zuständig:** Claude Code
**Abhängigkeiten:** TASK-8-01, TASK-3-02
**Priorität:** Soll
**Status:** Offen

### Akzeptanzkriterien
- [ ] Three.js/Babylon.js-Integration in Frontend
- [ ] Floor-Polygon → trianguliert → gerendert
- [ ] Wände extrudiert, Proxy-Meshes für Möbel
- [ ] Orbit/Zoom/Pan funktioniert
- [ ] DWG-/SKP-Referenzgeometrie ein-/ausblendbar
- [ ] Preis-/Objektinfo beim Selektieren

---

## TASK-15-01 – Render-Job-System (End-to-End)

**Sprint:** 15
**Zuständig:** Claude Code
**Abhängigkeiten:** TASK-13-01
**Priorität:** Muss
**Status:** Offen

### Ziel
Render-Worker-Protokoll implementieren; Job-Queue und Worker-Kommunikation.

### Akzeptanzkriterien
- [ ] Tabellen: `render_jobs`, `render_job_results`, `render_nodes`
- [ ] API: Job anlegen, Status abfragen, Worker-Registrierung, Job-Fetch (HTTPS), Ergebnis-Upload
- [ ] Status-Flow: `queued → assigned → running → done/failed`
- [ ] Scene Payload erzeugen und an Worker übergeben
- [ ] End-to-End: Planung → Job → Bild zurück

---

## TASK-16-01 – Business-/Integrations-Sprint

**Sprint:** 16
**Zuständig:** Claude Code
**Abhängigkeiten:** TASK-12-01, TASK-13-01
**Priorität:** Soll
**Status:** Offen

### Akzeptanzkriterien
- [ ] Tabellen: `customer_price_lists`, `customer_discounts`, `project_line_items`
- [ ] CRM-Felder: `lead_status`, `quote_value`, `close_probability`
- [ ] Exports: JSON, CSV, Webhook-Integration

---

## TASK-17-01 – Blockverrechnung API-Rahmen

**Sprint:** 17
**Zuständig:** Claude Code
**Abhängigkeiten:** TASK-12-01
**Priorität:** Soll
**Status:** Offen

### Akzeptanzkriterien
- [ ] Tabellen: `block_programs`, `block_definitions`, `block_groups`, `block_conditions`, `project_block_evaluations`
- [ ] API: Block-Programme verwalten, Bewertungsendpunkt `POST /projects/:id/evaluate-blocks`
- [ ] Codex implementiert Bewertungsalgorithmus; Claude Code verbindet

---

## TASK-18-01 – Import-Job-System (asynchron)

**Sprint:** 18
**Zuständig:** Claude Code
**Abhängigkeiten:** TASK-3-02
**Priorität:** Soll
**Status:** Offen

### Akzeptanzkriterien
- [ ] Asynchrone Importjobs für große DWG-/SKP-Dateien
- [ ] API: `POST /imports/cad`, `POST /imports/skp`, `GET /imports/:id`
- [ ] Prüfprotokoll: importiert / ignoriert / manuelle Nacharbeit
- [ ] Layer-/Komponenten-Mapping speicherbar

---

## TASK-19-01 – Interop-Härtung und Regressionstests (Koordination)

**Sprint:** 19
**Zuständig:** Claude Code
**Abhängigkeiten:** TASK-18-01, TASK-11-02
**Priorität:** Kann
**Status:** Offen

### Akzeptanzkriterien
- [ ] Import-/Export-Regressionstests orchestriert (Codex schreibt Tests)
- [ ] Einheiten-/Skalierungsprüfung implementiert
- [ ] Layer-Konventionen in `CAD_INTEROP.md` dokumentiert
- [ ] Basis-Roundtrip DWG: Import → Bearbeitung → Export funktioniert
