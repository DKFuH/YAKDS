# TASK_HISTORY.md

Archivierte Task-Listen für MVP (Phase 1) und Phase 2.

---

## Quelle: TASKS_CLAUDE_CODE

# TASKS_CLAUDE_CODE.md

## Aufgaben für Claude Code

**Zuständigkeit:** Architektur, API-Struktur, größere Refactorings, End-to-End-Features, Datenfluss Frontend ↔ API ↔ Worker ↔ Interop

> Stand 2026-03-01: Die Sprintliste ist für den aktuellen MVP-Stand abgeschlossen. Dokumentierte Restpunkte betreffen vor allem native DWG-Binary-Pfade; der produktive Interop-Pfad ist aktuell DXF-basiert.

---

## TASK-0-01 – Repo-Struktur und Grundgerüst anlegen

**Sprint:** 0
**Zuständig:** Claude Code
**Abhängigkeiten:** keine
**Priorität:** Muss
**Status:** Erledigt (MVP, 2026-03-01)

### Ziel
Repo-Struktur gemäß Plan anlegen, Grundpakete initialisieren.

### Akzeptanzkriterien
- [x] Verzeichnisse `planner-frontend/`, `planner-api/`, `render-worker/`, `shared-schemas/`, `interop-cad/`, `interop-sketchup/` angelegt
- [x] Basis-Package-Files je Paket vorhanden
- [x] `docs/` mit Platzhalter-Dokumenten befüllt

### Nicht in Scope
Echte Implementierung — nur Strukturgerüst

---

## TASK-0-02 – ARCHITECTURE.md verfassen

**Sprint:** 0
**Zuständig:** Claude Code
**Abhängigkeiten:** TASK-0-01
**Priorität:** Muss
**Status:** Erledigt (MVP, 2026-03-01)

### Ziel
Technische Architektur dokumentieren: Schichten, Kommunikationswege, Tech-Stack.

### Akzeptanzkriterien
- [x] Frontend ↔ API ↔ Worker ↔ Interop beschrieben
- [x] Datenbankstrategie (Postgres) festgehalten
- [x] Render-Protokoll-Überblick vorhanden
- [x] CAD/SKP-Interop-Strategie skizziert

---

## TASK-0-03 – ROOM_MODEL.md verfassen

**Sprint:** 0
**Zuständig:** Claude Code
**Abhängigkeiten:** TASK-0-02
**Priorität:** Muss
**Status:** Erledigt (MVP, 2026-03-01)

### Ziel
Domänenmodell für Räume, Wände, Öffnungen, Dachschrägen definieren.

### Akzeptanzkriterien
- [x] `Room`, `RoomBoundary`, `Vertex`, `WallSegment`, `Opening`, `CeilingConstraint` beschrieben
- [x] JSON-Beispielstruktur vorhanden
- [x] Platzierungskonzept `wall_id + offset` erklärt

---

## TASK-0-04 – PRICING_MODEL.md und QUOTE_MODEL.md verfassen

**Sprint:** 0
**Zuständig:** Claude Code
**Abhängigkeiten:** TASK-0-02
**Priorität:** Muss
**Status:** Erledigt (MVP, 2026-03-01)

### Ziel
Kaufmännische Kernobjekte und Berechnungsreihenfolge dokumentieren.

### Akzeptanzkriterien
- [x] 9-stufige Preislogik beschrieben (Listenpreis → Rundung)
- [x] `BOMLine`, `PriceComponent`, `PriceSummary`, `Quote`, `QuoteItem` definiert
- [x] API-Contracts für Pricing und Quote grob festgelegt

---

## TASK-0-05 – RENDER_PROTOCOL.md, CAD_INTEROP.md, SKP_INTEROP.md verfassen

**Sprint:** 0
**Zuständig:** Claude Code
**Abhängigkeiten:** TASK-0-02
**Priorität:** Muss
**Status:** Erledigt (MVP, 2026-03-01)

### Akzeptanzkriterien
- [x] Render-Job-Protokoll: Worker-Registrierung, Job-Fetch, Ergebnis-Upload beschrieben
- [x] CAD-Interop: neutrales internes Austauschformat, Layer-Strategie, Scope DWG/DXF 2D
- [x] SKP-Interop: Referenzmodell-Konzept, Mapping-Strategie

---

## TASK-1-01 – Backend-Grundgerüst (planner-api)

**Sprint:** 1
**Zuständig:** Claude Code
**Abhängigkeiten:** TASK-0-02
**Priorität:** Muss
**Status:** Erledigt (MVP, 2026-03-01)

### Ziel
Lauffähiges Backend mit Postgres-Schema und erstem Projekt-CRUD.

### Akzeptanzkriterien
- [x] Tabellen: `users`, `projects`, `project_versions`, `rooms`, `price_lists`, `tax_groups`, `quote_settings`
- [x] API-Endpunkte: `POST /projects`, `GET /projects/:id`, `PUT /projects/:id`, `DELETE /projects/:id`
- [x] Backend lokal startbar und testbar

---

## TASK-2-01 – Frontend-Grundgerüst (planner-frontend)

**Sprint:** 2
**Zuständig:** Claude Code
**Abhängigkeiten:** TASK-1-01
**Priorität:** Muss
**Status:** Erledigt (MVP, 2026-03-01)

### Ziel
Web-App-Hülle mit Editor-Layout bereitstellen.

### Akzeptanzkriterien
- [x] Projektliste zeigt Projekte aus API
- [x] Editor-Layout: Canvas-Bereich, linke Sidebar, rechte Sidebar, Status-/Summenbereich
- [x] Projekt öffnen navigiert in Editor-Ansicht

---

## TASK-3-01 – Polygon-Raumeditor Datenmodell und API

**Sprint:** 3
**Zuständig:** Claude Code
**Abhängigkeiten:** TASK-1-01, TASK-0-03
**Priorität:** Muss
**Status:** Erledigt (MVP, 2026-03-01)

### Ziel
Räume als Polygon speichern und laden – Datenfluss Backend ↔ Frontend.

### Akzeptanzkriterien
- [x] API: `POST /rooms`, `PUT /rooms/:id`, `GET /rooms/:id`
- [x] Polygon wird als `Vertex[]` + `WallSegment[]` persistiert
- [x] Frontend zeigt Polygon auf Canvas (Codex liefert Render-Logik)
- [x] Snap-Optionen konfigurierbar (0/45/90°, Raster)

---

## TASK-3-02 – CAD/SKP Import-Pipeline definieren (Sprint 3.5)

**Sprint:** 3.5
**Zuständig:** Claude Code
**Abhängigkeiten:** TASK-0-05, TASK-1-01
**Priorität:** Muss
**Status:** Erledigt (MVP, 2026-03-01)

### Ziel
Upload-Endpunkte und internes Austauschformat festlegen; Codex implementiert Parser.

### Akzeptanzkriterien
- [x] API: `POST /imports/cad` (DWG/DXF), `POST /imports/skp`
- [x] Neutrales internes Format (`ImportAsset`, `CadLayer`, `ReferenceGeometry`) definiert
- [x] Datei wird gespeichert, Import-Job angelegt, Status abrufbar
- [x] Frontend: Datei-Upload-UI vorhanden

---

## TASK-4-01 – Präzisionsbearbeitung Raumgeometrie (End-to-End)

**Sprint:** 4
**Zuständig:** Claude Code
**Abhängigkeiten:** TASK-3-01
**Priorität:** Muss
**Status:** Erledigt (MVP, 2026-03-01)

### Ziel
Vertex-Verschiebung und numerische Kantenlängenänderung durchgängig verbinden.

### Akzeptanzkriterien
- [x] Vertex-Move sendet PATCH an API, stable `wall_id` bleibt erhalten
- [x] Kantenlänge per Eingabefeld änderbar
- [x] CAD-Raumkontur-Übernahme: Polylinie → `RoomBoundary` Konvertierungsendpunkt
- [x] Layer-Filter-UI vorhanden

---

## TASK-5-01 – Öffnungen Datenmodell und API

**Sprint:** 5
**Zuständig:** Claude Code
**Abhängigkeiten:** TASK-3-01
**Priorität:** Muss
**Status:** Erledigt (MVP, 2026-03-01)

### Ziel
Türen/Fenster an Wänden persistieren und anzeigen.

### Akzeptanzkriterien
- [x] API: `POST /openings`, `PUT /openings/:id`, `DELETE /openings/:id`
- [x] `Opening` trägt: `wall_id`, `offset_mm`, `width_mm`, `height_mm`, `sill_height_mm`
- [x] Öffnungen aus CAD-Import übernehmbar (Endpunkt zur Übernahme)

---

## TASK-6-01 – Height Constraints Datenmodell und API

**Sprint:** 6
**Zuständig:** Claude Code
**Abhängigkeiten:** TASK-3-01
**Priorität:** Muss
**Status:** Erledigt (MVP, 2026-03-01)

### Akzeptanzkriterien
- [x] API: `POST /ceiling-constraints`, `PUT /ceiling-constraints/:id`
- [x] `CeilingConstraint`: `wall_id`, `kniestock_height_mm`, `slope_angle_deg`, `depth_into_room_mm`
- [x] Endpunkt `GET /rooms/:id/available-height?x=&y=` ruft Codex-Berechnung ab

---

## TASK-7-01 – Katalog-API und Datenmodell

**Sprint:** 7
**Zuständig:** Claude Code
**Abhängigkeiten:** TASK-1-01
**Priorität:** Muss
**Status:** Erledigt (MVP, 2026-03-01)

### Akzeptanzkriterien
- [x] Tabellen: `catalog_items`, `pricing_groups`, `tax_groups`
- [x] Felder: `list_price_net`, `dealer_price_net`, `default_markup_pct`, `tax_group_id`, `pricing_group_id`
- [x] API: `GET /catalog/items`, `GET /catalog/items/:id`
- [x] SKP-Mapping-Endpunkt vorbereitet (Sprint 7.5)

---

## TASK-8-01 – Wandbasierte Platzierungsengine (End-to-End)

**Sprint:** 8
**Zuständig:** Claude Code
**Abhängigkeiten:** TASK-3-01, TASK-7-01
**Priorität:** Muss
**Status:** Erledigt (MVP, 2026-03-01)

### Ziel
Objekte an Wänden platzieren, verschieben, löschen – Full Stack.

### Akzeptanzkriterien
- [x] API: `POST /placements`, `PUT /placements/:id`, `DELETE /placements/:id`
- [x] `CabinetInstance`/`ApplianceInstance` mit `wall_id + offset_mm`
- [x] Frontend: Drag-along-wall mit Codex-Algorithmus verbunden
- [x] Innenrichtung der Wand korrekt aus Polygon abgeleitet

---

## TASK-9-01 – Geometrieprüfungs-Framework (End-to-End)

**Sprint:** 9
**Zuständig:** Claude Code
**Abhängigkeiten:** TASK-8-01
**Priorität:** Muss
**Status:** Erledigt (MVP, 2026-03-01)

### Ziel
Prüf-API aufbauen; Codex implementiert Kollisionslogik.

### Akzeptanzkriterien
- [x] API: `POST /projects/:id/validate`
- [x] Response: `{ errors: RuleViolation[], warnings: RuleViolation[], hints: RuleViolation[] }`
- [x] Frontend: Prüfpanel zeigt Ergebnisse
- [x] Kostenhinweise (Sonderblende, Sonderzuschnitt) als `hints` konfigurierbar

---

## TASK-10-01 – Höhenprüfung Dachschrägen (End-to-End)

**Sprint:** 10
**Zuständig:** Claude Code
**Abhängigkeiten:** TASK-6-01, TASK-9-01
**Priorität:** Muss
**Status:** Erledigt (MVP, 2026-03-01)

### Akzeptanzkriterien
- [x] Höhenprüfung in `POST /projects/:id/validate` integriert
- [x] Flags `requires_customization`, `height_variant`, `labor_surcharge` in `RuleViolation`
- [x] Frontend zeigt Höhenkonflikte visuell an

---

## TASK-11-01 – BOM-API Endpunkt

**Sprint:** 11
**Zuständig:** Claude Code
**Abhängigkeiten:** TASK-8-01, TASK-7-01
**Priorität:** Muss
**Status:** Erledigt (MVP, 2026-03-01)

### Akzeptanzkriterien
- [x] API: `POST /projects/:id/calculate-bom`
- [x] Response: strukturierte `BOMLine[]` als JSON
- [x] Positionen: Möbel, Geräte, Zubehör, Zuschläge, Montage, Fracht
- [x] Codex-BOM-Logik über Service-Schicht eingebunden

---

## TASK-11-02 – CAD/DXF Export-Pipeline (Sprint 11.5)

**Sprint:** 11.5
**Zuständig:** Claude Code
**Abhängigkeiten:** TASK-3-02, TASK-8-01
**Priorität:** Muss
**Status:** Erledigt (MVP, 2026-03-01)

### Akzeptanzkriterien
- [x] API: `POST /projects/:id/export-dwg`, `POST /projects/:id/export-dxf`
- [x] Export enthält: Raumkontur, Wandlinien, Öffnungen, Möbelkonturen
- [x] Layer-Struktur und Einheiten/Skalierung definiert
- [x] Codex implementiert DWG/DXF-Schreib-Logik; Claude Code verbindet API ↔ Codex-Modul

---

## TASK-12-01 – Preisengine API

**Sprint:** 12
**Zuständig:** Claude Code
**Abhängigkeiten:** TASK-11-01, TASK-7-01
**Priorität:** Muss
**Status:** Erledigt (MVP, 2026-03-01)

### Akzeptanzkriterien
- [x] API: `POST /projects/:id/calculate-pricing`, `GET /projects/:id/price-summary`
- [x] Response: `{ net, vat, gross, contribution_margin, markup_pct }`
- [x] Codex-Preisregeln über Service-Schicht eingebunden

---

## TASK-13-01 – Angebotsmanagement (End-to-End)

**Sprint:** 13
**Zuständig:** Claude Code
**Abhängigkeiten:** TASK-12-01
**Priorität:** Muss
**Status:** Erledigt (MVP, 2026-03-01)

### Akzeptanzkriterien
- [x] Tabellen: `quotes`, `quote_items`
- [x] API: `POST /projects/:id/create-quote`, `GET /quotes/:id`, `POST /quotes/:id/export-pdf`
- [x] Angebot enthält: Nummer, Gültig-bis, Freitext, Versionen
- [x] PDF light generierbar

---

## TASK-14-01 – Browser-3D-Preview (End-to-End)

**Sprint:** 14
**Zuständig:** Claude Code
**Abhängigkeiten:** TASK-8-01, TASK-3-02
**Priorität:** Soll
**Status:** Erledigt (MVP, 2026-03-01)

### Akzeptanzkriterien
- [x] Three.js/Babylon.js-Integration in Frontend
- [x] Floor-Polygon → trianguliert → gerendert
- [x] Wände extrudiert, Proxy-Meshes für Möbel
- [x] Orbit/Zoom/Pan funktioniert
- [x] DWG-/SKP-Referenzgeometrie ein-/ausblendbar
- [x] Preis-/Objektinfo beim Selektieren

---

## TASK-15-01 – Render-Job-System (End-to-End)

**Sprint:** 15
**Zuständig:** Claude Code
**Abhängigkeiten:** TASK-13-01
**Priorität:** Muss
**Status:** Erledigt (MVP, 2026-03-01)

### Ziel
Render-Worker-Protokoll implementieren; Job-Queue und Worker-Kommunikation.

### Akzeptanzkriterien
- [x] Tabellen: `render_jobs`, `render_job_results`, `render_nodes`
- [x] API: Job anlegen, Status abfragen, Worker-Registrierung, Job-Fetch (HTTPS), Ergebnis-Upload
- [x] Status-Flow: `queued → assigned → running → done/failed`
- [x] Scene Payload erzeugen und an Worker übergeben
- [x] End-to-End: Planung → Job → Bild zurück

---

## TASK-16-01 – Business-/Integrations-Sprint

**Sprint:** 16
**Zuständig:** Claude Code
**Abhängigkeiten:** TASK-12-01, TASK-13-01
**Priorität:** Soll
**Status:** Erledigt (MVP, 2026-03-01)

### Akzeptanzkriterien
- [x] Tabellen: `customer_price_lists`, `customer_discounts`, `project_line_items`
- [x] CRM-Felder: `lead_status`, `quote_value`, `close_probability`
- [x] Exports: JSON, CSV, Webhook-Integration

---

## TASK-17-01 – Blockverrechnung API-Rahmen

**Sprint:** 17
**Zuständig:** Claude Code
**Abhängigkeiten:** TASK-12-01
**Priorität:** Soll
**Status:** Erledigt (MVP, 2026-03-01)

### Akzeptanzkriterien
- [x] Tabellen: `block_programs`, `block_definitions`, `block_groups`, `block_conditions`, `project_block_evaluations`
- [x] API: Block-Programme verwalten, Bewertungsendpunkt `POST /projects/:id/evaluate-blocks`
- [x] Codex implementiert Bewertungsalgorithmus; Claude Code verbindet

---

## TASK-18-01 – Import-Job-System (asynchron)

**Sprint:** 18
**Zuständig:** Claude Code
**Abhängigkeiten:** TASK-3-02
**Priorität:** Soll
**Status:** Erledigt (MVP, 2026-03-01)

### Akzeptanzkriterien
- [x] Asynchrone Importjobs für große DWG-/SKP-Dateien
- [x] API: `POST /imports/cad`, `POST /imports/skp`, `GET /imports/:id`
- [x] Prüfprotokoll: importiert / ignoriert / manuelle Nacharbeit
- [x] Layer-/Komponenten-Mapping speicherbar

---

## TASK-19-01 – Interop-Härtung und Regressionstests (Koordination)

**Sprint:** 19
**Zuständig:** Claude Code
**Abhängigkeiten:** TASK-18-01, TASK-11-02
**Priorität:** Kann
**Status:** Erledigt (MVP, 2026-03-01)

### Akzeptanzkriterien
- [x] Import-/Export-Regressionstests orchestriert (Codex schreibt Tests)
- [x] Einheiten-/Skalierungsprüfung implementiert
- [x] Layer-Konventionen in `CAD_INTEROP.md` dokumentiert
- [x] Basis-Roundtrip DWG: Import → Bearbeitung → Export funktioniert


---

## Quelle: TASKS_CODEX

# TASKS_CODEX.md

## Aufgaben für Codex

**Zuständigkeit:** Polygonalgorithmen, Kollisionserkennung, Validatoren, Preisregeln, BOM-Berechnung, Import-/Export-Mapping, Tests, kleine isolierte Module

> Stand 2026-03-01: Die gelisteten Codex-Tasks sind im aktuellen MVP-Stand umgesetzt. Interop-Restpunkte betreffen weiterhin native DWG-Binary-Pfade außerhalb des DXF-basierten Produktionspfads.

> **Hinweis zu Prompts:** Jeden Prompt als erstes in Codex eingeben. Danach relevante Dateien aus `shared-schemas/src/` und `Docs/ROOM_MODEL.md` als Kontext anhängen.

---

## TASK-3-C01 – Polygon-Validierung

**Sprint:** 3 | **Zuständig:** Codex | **Priorität:** Muss | **Status:** Erledigt (MVP, 2026-03-01)

### Akzeptanzkriterien
- [x] Selbstüberschneidungs-Check (Segment-Segment-Intersection)
- [x] Mindestkantenlänge prüfen (konfigurierbar, z. B. 100 mm)
- [x] Geschlossener Ring validieren (erster = letzter Punkt)
- [x] Funktion: `validatePolygon(vertices: Vertex[]): ValidationResult`
- [x] Unit-Tests für alle Fehlerfälle

### Codex-Prompt
```
Du implementierst ein isoliertes TypeScript-Modul für einen webbasierten Küchenplaner.

Aufgabe: Polygon-Validierung in `shared-schemas/src/geometry/validatePolygon.ts`

Typen (bereits vorhanden in shared-schemas/src/types.ts):
  interface Vertex { id: string; x_mm: number; y_mm: number; index: number }
  interface ValidationResult { valid: boolean; errors: string[] }

Implementiere:
1. validatePolygon(vertices: Vertex[], minEdgeLengthMm = 100): ValidationResult
   - Prüfe: mind. 3 Punkte
   - Prüfe: kein Segment schneidet ein anderes (Segment-Intersection-Algorithmus)
   - Prüfe: alle Kantenlängen >= minEdgeLengthMm
   - Prüfe: Polygon ist geschlossen (letzter Punkt = erster Punkt ODER wird automatisch geschlossen)

2. Unit-Tests in validatePolygon.test.ts (vitest):
   - Valides Rechteck
   - Valides L-förmiges Polygon (6 Ecken)
   - Selbstüberschneidendes Polygon → Fehler
   - Zu kurze Kante → Fehler
   - Nur 2 Punkte → Fehler

Keine Abhängigkeiten außer Vanilla TypeScript. Keine Klassen, nur pure Funktionen.
```

---

## TASK-3-C02 – Polygon-Rendering auf Canvas

**Sprint:** 3 | **Zuständig:** Codex | **Priorität:** Muss | **Status:** Erledigt (MVP, 2026-03-01)

### Akzeptanzkriterien
- [x] Polygon aus `Vertex[]` rendern (Konva.js oder reines Canvas)
- [x] Snap auf 0°/45°/90° beim Punkte setzen
- [x] Raster-Snap (konfigurierbarer Abstand)
- [x] Unit-Tests für Snap-Funktionen

### Codex-Prompt
```
Du implementierst Hilfsmodule für den 2D-Canvas-Editor eines Küchenplaners (React + Konva.js).

Aufgabe: Snap-Logik in `planner-frontend/src/editor/snapUtils.ts`

Implementiere (pure Funktionen, kein React/Konva-Import):
1. snapToAngle(point: Point2D, origin: Point2D, allowedAngles: number[]): Point2D
   - Projiziert `point` auf den nächstgelegenen erlaubten Winkel (0, 45, 90, 135, 180, 225, 270, 315°)
   - Gibt den projizierten Punkt zurück

2. snapToGrid(point: Point2D, gridSizeMm: number): Point2D
   - Rundet x_mm und y_mm auf nächsten Gitterpunkt

3. snapPoint(point: Point2D, origin: Point2D | null, gridSizeMm: number, angleSnap: boolean): Point2D
   - Kombiniert snapToGrid und snapToAngle (angleSnap nur wenn origin vorhanden)

Typen:
  interface Point2D { x_mm: number; y_mm: number }

Unit-Tests in snapUtils.test.ts (vitest):
- snapToAngle: Punkt bei 47° → snapped auf 45°
- snapToGrid: 1234 mm → 1200 mm bei 100mm Raster
- Kombination beider Snaps
```

---

## TASK-4-C01 – Vertex-Verschiebung und Kantenlängenberechnung

**Sprint:** 4 | **Zuständig:** Codex | **Priorität:** Muss | **Status:** Erledigt (MVP, 2026-03-01)

### Akzeptanzkriterien
- [x] `moveVertex(polygon, index, newPos): Polygon`
- [x] `setEdgeLength(polygon, edgeIndex, lengthMm): Polygon`
- [x] `polylineToRoomBoundary(polyline): RoomBoundary`
- [x] Unit-Tests

### Codex-Prompt
```
Du implementierst Geometrie-Editierfunktionen für einen Küchenplaner.
Datei: `shared-schemas/src/geometry/polygonEditor.ts`

Kontext: Raummodell siehe Docs/ROOM_MODEL.md (Vertices sind mm-Koordinaten, wall_id ist stabil).

Implementiere:
1. moveVertex(vertices: Vertex[], index: number, newPos: Point2D): Vertex[]
   - Verschiebt Vertex an Position index
   - Alle anderen Vertices bleiben unverändert
   - Gibt neues Array zurück (immutabel)

2. setEdgeLength(vertices: Vertex[], edgeIndex: number, newLengthMm: number): Vertex[]
   - Ändert Länge der Kante zwischen vertices[edgeIndex] und vertices[edgeIndex+1]
   - Verschiebt den END-Vertex entlang der Kantenrichtung
   - Alle anderen Vertices bleiben unverändert

3. polylineToRoomBoundary(points: Point2D[]): { vertices: Vertex[]; }
   - Konvertiert eine CAD-Polylinie in Vertex-Array
   - Generiert stabile UUIDs (crypto.randomUUID())
   - Schließt den Ring wenn nötig (letzter Punkt ≠ erster Punkt → Punkt hinzufügen)

Unit-Tests (vitest) für alle 3 Funktionen inklusive Edge Cases.
Pure Funktionen, kein Framework.
```

---

## TASK-5-C01 – Öffnungs-Validierung

**Sprint:** 5 | **Zuständig:** Codex | **Priorität:** Muss | **Status:** Erledigt (MVP, 2026-03-01)

### Akzeptanzkriterien
- [x] `validateOpening(wall, opening): ValidationResult`
- [x] `detectOpeningsFromCad(cadLayer): OpeningCandidate[]`
- [x] Unit-Tests

### Codex-Prompt
```
Du implementierst Öffnungsvalidierung für einen Küchenplaner.
Datei: `shared-schemas/src/geometry/openingValidator.ts`

Typen (aus Docs/ROOM_MODEL.md):
  interface WallSegment { id: string; length_mm: number; ... }
  interface Opening { id: string; wall_id: string; offset_mm: number; width_mm: number; ... }
  interface ValidationResult { valid: boolean; errors: string[] }
  interface CadEntity { type: string; geometry: any; }
  interface OpeningCandidate { offset_mm: number; width_mm: number; confidence: 'high'|'low'; }

Implementiere:
1. validateOpening(wall: WallSegment, opening: Opening, existingOpenings: Opening[]): ValidationResult
   - Regel: offset_mm >= 0
   - Regel: offset_mm + width_mm <= wall.length_mm
   - Regel: Öffnung überschneidet keine existierende Öffnung (1D-Intervall-Check)

2. detectOpeningsFromCad(entities: CadEntity[], wallLength_mm: number): OpeningCandidate[]
   - Sucht Lücken zwischen Liniensegmenten auf einer Wand
   - Lücken zwischen Linien-Endpoints gelten als Öffnungskandidaten
   - Mindestbreite 500 mm, Maximalbreite 3000 mm

Unit-Tests (vitest) für beide Funktionen.
```

---

## TASK-6-C01 – Höhenberechnung (Dachschrägen)

**Sprint:** 6 | **Zuständig:** Codex | **Priorität:** Muss | **Status:** Erledigt (MVP, 2026-03-01)

### Akzeptanzkriterien
- [x] `getAvailableHeight(constraints, point): number`
- [x] Mehrere Constraints → Minimum
- [x] Unit-Tests mit verschiedenen Dachgeometrien

### Codex-Prompt
```
Du implementierst Dachschrägen-Höhenberechnung für einen Küchenplaner.
Datei: `shared-schemas/src/geometry/ceilingHeight.ts`

Typen:
  interface CeilingConstraint {
    wall_id: string;
    wall_start: Point2D;   // Weltkoordinate des Wandanfangs
    wall_end: Point2D;     // Weltkoordinate des Wandendes
    kniestock_height_mm: number;
    slope_angle_deg: number;
    depth_into_room_mm: number;
  }
  interface Point2D { x_mm: number; y_mm: number }

Formel (aus Docs/ROOM_MODEL.md):
  d = senkrechter Abstand von point zur Wand
  if d >= depth_into_room_mm: available = nominal_ceiling_height
  else: available = kniestock_height_mm + tan(slope_angle_deg_in_rad) * d

Implementiere:
1. getHeightAtPoint(constraint: CeilingConstraint, point: Point2D, nominalCeilingMm: number): number
   - Berechnet verfügbare Höhe für eine einzelne Schräge

2. getAvailableHeight(constraints: CeilingConstraint[], point: Point2D, nominalCeilingMm: number): number
   - Gibt Minimum über alle Constraints zurück
   - Wenn keine Constraints: gibt nominalCeilingMm zurück

Unit-Tests (vitest):
- Punkt direkt an Wand (Kniestock)
- Punkt jenseits der Tiefe (volle Höhe)
- Punkt in der Mitte (interpoliert)
- Mehrere Schrägen: Minimum korrekt
```

---

## TASK-8-C01 – Wandbasierte Platzierungsalgorithmen

**Sprint:** 8 | **Zuständig:** Codex | **Priorität:** Muss | **Status:** Erledigt (MVP, 2026-03-01)

### Akzeptanzkriterien
- [x] `getWallInnerDirection(wall, polygon): Vector2D`
- [x] `snapToWall(dragPos, wall): number`
- [x] `getPlacementPosition(wall, offsetMm): Point2D`
- [x] `canPlaceOnWall(wall, offset, width, existingPlacements): boolean`
- [x] Unit-Tests für gerade und schräge Wände

### Codex-Prompt
```
Du implementierst die Platzierungs-Mathematik für einen Küchenplaner.
Datei: `shared-schemas/src/geometry/wallPlacement.ts`

Kontext: Objekte werden an Wänden platziert via wall_id + offset_mm.
Die Wand hat einen Anfang (start) und ein Ende (end) als 2D-Weltkoordinaten.
Das Polygon ist CCW orientiert, daher zeigt die Innenrichtung nach rechts von start→end.

Implementiere:
1. getWallDirection(wall: WallSegment2D): Vector2D
   - Normalisierter Richtungsvektor start → end

2. getWallInnerNormal(wall: WallSegment2D, polygon: Point2D[]): Vector2D
   - Berechnet Innenrichtung (Normale, die ins Polygon zeigt)
   - Test: Mittelpunkt + Normal * 10mm muss innerhalb des Polygons liegen (Point-in-Polygon)

3. getPlacementWorldPos(wall: WallSegment2D, offsetMm: number): Point2D
   - Weltkoordinate des Objektmittelpunkts an offset auf der Wand

4. snapToWall(dragWorldPos: Point2D, wall: WallSegment2D): number
   - Projiziert dragWorldPos auf die Wand → gibt Offset in mm zurück
   - Geclampt auf [0, wall.length_mm]

5. canPlaceOnWall(wall: WallSegment2D, offsetMm: number, widthMm: number, existing: PlacedItem[]): boolean
   - Prüft ob [offset, offset+width] frei ist (keine Überlappung mit existing)

Typen selbst minimal definieren.
Unit-Tests (vitest) für alle 5 Funktionen.
```

---

## TASK-9-C01 – Kollisionsdetektions-Algorithmen

**Sprint:** 9 | **Zuständig:** Codex | **Priorität:** Muss | **Status:** Erledigt (MVP, 2026-03-01)

### Akzeptanzkriterien
- [x] Object-vs-Object, Object-außerhalb-Raum, Object-vs-Opening
- [x] Mindestabstände, ungültiger Wandbereich
- [x] Hinweise: Sonderblende, Sonderzuschnitt, Montageaufwand
- [x] Unit-Tests für alle Kollisionstypen

### Codex-Prompt
```
Du implementierst Kollisionserkennung für einen Küchenplaner.
Datei: `shared-schemas/src/validation/collisionDetector.ts`

Typen (vereinfacht):
  interface PlacedObject { id: string; wall_id: string; offset_mm: number; width_mm: number; depth_mm: number; height_mm: number; }
  interface Opening { wall_id: string; offset_mm: number; width_mm: number; }
  interface RuleViolation { severity: 'error'|'warning'|'hint'; code: string; message: string; affected_ids: string[]; }

Implementiere als pure Funktionen:
1. checkObjectOverlap(a: PlacedObject, b: PlacedObject): RuleViolation | null
   - Nur für Objekte an derselben Wand: 1D-Intervall-Overlap
   - code: 'OBJECT_OVERLAP'

2. checkObjectInRoom(obj: PlacedObject, roomPolygon: Point2D[]): RuleViolation | null
   - Prüft ob Objektfußpunkt im Polygon liegt (Point-in-Polygon)
   - code: 'OBJECT_OUTSIDE_ROOM'

3. checkObjectVsOpening(obj: PlacedObject, openings: Opening[]): RuleViolation | null
   - Prüft ob Objekt eine Öffnung blockiert (gleiche Wand, Intervall-Overlap)
   - code: 'OBJECT_BLOCKS_OPENING'

4. checkMinClearance(obj: PlacedObject, others: PlacedObject[], minMm: number): RuleViolation | null
   - Mindestabstand zwischen Objektenden
   - code: 'MIN_CLEARANCE_VIOLATED'

5. detectCostHints(obj: PlacedObject, wall: WallSegment2D, openings: Opening[]): RuleViolation[]
   - Hint: Sonderblende nötig (Objekt endet nicht bündig mit Wand/Nachbarobjekt)
   - Hint: erhöhter Montageaufwand (schräge Wand, Winkel > 10° von 90°)
   - severity: 'hint'

Unit-Tests (vitest) für alle 5 Funktionen inkl. Grenzfälle.
```

---

## TASK-10-C01 – Höhenprüfung gegen Dachschrägen

**Sprint:** 10 | **Zuständig:** Codex | **Priorität:** Muss | **Status:** Erledigt (MVP, 2026-03-01)

### Akzeptanzkriterien
- [x] `checkHeightVsConstraints(obj, constraints): HeightViolation[]`
- [x] Flags: `requires_customization`, `height_variant`, `labor_surcharge`
- [x] Unit-Tests

### Codex-Prompt
```
Du implementierst Höhenprüfung gegen Dachschrägen für einen Küchenplaner.
Datei: `shared-schemas/src/validation/heightChecker.ts`

Nutze die Funktion getAvailableHeight aus TASK-6-C01 (shared-schemas/src/geometry/ceilingHeight.ts).

Typen:
  interface PlacedObject { id: string; type: 'base'|'wall'|'tall'|'appliance'; height_mm: number; worldPos: Point2D; }
  interface HeightViolation extends RuleViolation {
    available_mm: number;
    required_mm: number;
    flags: { requires_customization: boolean; height_variant: string|null; labor_surcharge: boolean; }
  }

Implementiere:
1. checkObjectHeight(obj: PlacedObject, constraints: CeilingConstraint[], nominalCeilingMm: number): HeightViolation | null
   - Berechnet verfügbare Höhe am Objektstandort (getAvailableHeight)
   - Wenn obj.height_mm > available: Violation erzeugen
   - code: 'HEIGHT_EXCEEDED' für Hochschränke
   - code: 'HANGING_CABINET_SLOPE_COLLISION' für Hängeschränke
   - Flags setzen:
     * requires_customization: true wenn Höhe > 50mm überschritten
     * height_variant: 'low_version' wenn Alternative sinnvoll (< 200mm Überschreitung)
     * labor_surcharge: true wenn Anpassung vor Ort nötig

2. checkAllObjects(objects: PlacedObject[], constraints: CeilingConstraint[], nominalCeilingMm: number): HeightViolation[]

Unit-Tests (vitest) mit verschiedenen Szenarien.
```

---

## TASK-11-C01 – BOM-Berechnungslogik

**Sprint:** 11 | **Zuständig:** Codex | **Priorität:** Muss | **Status:** Erledigt (MVP, 2026-03-01)

### Akzeptanzkriterien
- [x] `calculateBOM(project): BOMLine[]`
- [x] Alle Positionstypen: Möbel, Geräte, Zubehör, Zuschläge, Montage, Fracht
- [x] Unit-Tests mit Beispielprojekt

### Codex-Prompt
```
Du implementierst die Stücklistenberechnung (BOM) für einen Küchenplaner.
Datei: `planner-api/src/services/bomCalculator.ts`

Typen aus Docs/PRICING_MODEL.md:
  BOMLine, BOMLineType — genau wie dort definiert implementieren.

Input-Typen (vereinfacht):
  interface ProjectSnapshot {
    cabinets: PlacedCabinet[];    // mit catalog_item, flags
    appliances: PlacedAppliance[]; // mit catalog_item, flags
    priceListItems: PriceListItem[]; // list_price_net, dealer_price_net je catalog_item_id
    taxGroups: TaxGroup[];
    quoteSettings: { freight_flat_rate: number; assembly_rate_per_item: number; }
  }

Implementiere:
1. calculateBOM(project: ProjectSnapshot): BOMLine[]
   - Je PlacedCabinet → BOMLine type:'cabinet'
   - Je PlacedAppliance → BOMLine type:'appliance'
   - Je flags.special_trim_needed → BOMLine type:'surcharge' (Sonderblende)
   - Je flags.labor_surcharge → BOMLine type:'assembly' (Montagezuschlag)
   - Fracht pauschal → BOMLine type:'freight' (1x)
   - variant_surcharge und object_surcharges aus flags befüllen

2. sumBOMLines(lines: BOMLine[]): { total_list_net: number; total_net_after_discounts: number }

Unit-Tests (vitest):
- Leeres Projekt → nur Fracht
- 3 Unterschränke + 1 Herd → korrekte Zeilen
- Sonderzuschlag-Flag → zusätzliche BOMLine
```

---

## TASK-11-C02 – DXF-Schreib-Logik (Export)

**Sprint:** 11.5 | **Zuständig:** Codex | **Priorität:** Muss | **Status:** Erledigt (MVP, 2026-03-01)

### Akzeptanzkriterien
- [x] `exportToDxf(project): string`
- [x] Layer-Struktur gemäß CAD_INTEROP.md
- [x] Integrations-Test mit Referenz-DXF

### Codex-Prompt
```
Du implementierst DXF-Export für einen Küchenplaner.
Datei: `interop-cad/dxf-export/src/dxfExporter.ts`
Bibliothek: `dxf-writer` (npm)

Layer-Konventionen aus Docs/CAD_INTEROP.md:
  YAKDS_ROOM, YAKDS_WALLS, YAKDS_OPENINGS, YAKDS_FURNITURE

Input:
  interface ExportPayload {
    room: { boundary: Vertex[]; }
    wallSegments: WallSegment2D[];
    openings: Opening[];
    furniture: PlacedObjectBounds[]; // { id, footprintRect: Rect2D }
    includeFurniture: boolean;
  }

Implementiere:
1. exportToDxf(payload: ExportPayload): string
   - DXF-String mit korrekten Layern
   - Raumkontur als geschlossene Polylinie auf YAKDS_ROOM
   - Wandlinien auf YAKDS_WALLS
   - Öffnungen als Linien auf YAKDS_OPENINGS
   - Möbelkonturen als Rechtecke auf YAKDS_FURNITURE (wenn includeFurniture)
   - Einheit: mm ($INSUNITS = 4)

2. Integrationstest: exportToDxf → output enthält alle Layer-Namen als Strings

Keine anderen Deps außer dxf-writer.
```

---

## TASK-12-C01 – Preisregel-Berechnungen

**Sprint:** 12 | **Zuständig:** Codex | **Priorität:** Muss | **Status:** Erledigt (MVP, 2026-03-01)

### Akzeptanzkriterien
- [x] Alle 9 Preisstufen als pure Funktionen
- [x] `calculatePriceSummary(bomLines, settings): PriceSummary`
- [x] Unit-Tests inkl. Grenzfälle (0-Rabatt, 100%-Rabatt)

### Codex-Prompt
```
Du implementierst die 9-stufige Preisberechnung für einen Küchenplaner.
Datei: `planner-api/src/services/priceCalculator.ts`

Exakte Typen aus Docs/PRICING_MODEL.md übernehmen: BOMLine, PriceSummary, PriceComponent, GlobalDiscountSettings.

Implementiere als pure Funktionen (KEIN Rounding zwischen Schritten — nur Endrundung):

1. applyDiscount(value: number, pct: number): number
   - value * (1 - pct/100)

2. calcLineNet(line: BOMLine): number
   - Stufen 1–5 auf Zeilenebene:
     (list_price_net + variant_surcharge + object_surcharges)
     × qty
     nach position_discount_pct
     nach pricing_group_discount_pct

3. calculatePriceSummary(lines: BOMLine[], settings: GlobalDiscountSettings): PriceSummary
   - Stufe 6: Global-Rabatt auf Summe aller calcLineNet
   - Stufe 7: Extra-Kosten addieren
   - Stufe 8: MwSt (gruppiert nach tax_group_id)
   - Stufe 9: kaufmännische Rundung auf 2 Dezimalen
   - PriceComponent[] für jeden Schritt befüllen
   - contribution_margin_net und markup_pct berechnen

Unit-Tests (vitest):
- Kein Rabatt → Brutto = Netto * 1.19
- 100% Rabatt → Netto 0, trotzdem Fracht und MwSt
- Mehrere Steuergruppen
- Rundung korrekt
```

---

## TASK-3-C03 – DXF-Import-Parser

**Sprint:** 3.5 | **Zuständig:** Codex | **Priorität:** Muss | **Status:** Erledigt (MVP, 2026-03-01)

### Akzeptanzkriterien
- [x] DXF lesen: Linien, Polylinien, Layer
- [x] Output: `ImportAsset`-Format gemäß CAD_INTEROP.md
- [x] Unit-Tests mit Beispiel-DXF

### Codex-Prompt
```
Du implementierst den DXF-Import-Parser für einen Küchenplaner.
Datei: `interop-cad/dxf-import/src/dxfParser.ts`
Bibliothek: `dxf-parser` (npm)

Output-Format: ImportAsset aus Docs/CAD_INTEROP.md (genau implementieren).

Implementiere:
1. parseDxf(dxfString: string, sourceFilename: string): ImportAsset
   - Liest Layer (Name, Farbe, Sichtbarkeit)
   - Liest Entities: LINE, LWPOLYLINE, POLYLINE, ARC, CIRCLE, TEXT, INSERT
   - Normalisiert Koordinaten auf mm (aus $INSUNITS Header)
   - Ignoriert 3D-Objekte (z-Koordinate > 0), protokolliert als 'ignored'
   - Gibt BoundingBox2D aller Entities zurück

2. ImportProtocolEntry für jede Entität: 'imported' | 'ignored' | 'needs_review'
   - needs_review: Entity-Typ unbekannt oder Geometrie unvollständig

Unit-Tests (vitest):
- Minimales DXF-String mit einer LINE → korrekte CadEntity
- Unbekannte Entity → 'ignored' in Protocol
- INSUNITS=1 (Inch) → Koordinaten in mm konvertiert
```

---

## TASK-7-C01 – SKP-Import-Parser

**Sprint:** 7.5 | **Zuständig:** Codex | **Priorität:** Kann | **Status:** Erledigt (MVP, 2026-03-01)

### Akzeptanzkriterien
- [x] SKP Komponenten + Metadaten extrahieren
- [x] Output: `SkpReferenceModel`
- [x] Unit-Tests mit Beispiel-SKP

### Codex-Prompt
```
Du implementierst den SketchUp-Import-Parser für einen Küchenplaner.
Datei: `interop-sketchup/skp-import/src/skpParser.ts`

Hinweis: SKP ist ein binäres Format. Nutze die Bibliothek `sketchup-file-reader` (npm)
oder alternativ: Konvertierung via `open3d` / externe CLI nach GLTF als Fallback dokumentieren.

Output-Format: SkpReferenceModel aus Docs/SKP_INTEROP.md (genau implementieren).

Implementiere:
1. parseSkp(fileBuffer: Buffer, sourceFilename: string): SkpReferenceModel
   - Extrahiert Komponenten-Definitionen (Name, GUID)
   - Extrahiert Instanzen (Position, Rotation als 3D-Transformation)
   - Liest AttributeDictionary-Werte als metadata
   - Schätzt Bounding Box je Komponente (aus Vertices)
   - Konvertiert Geometrie → GLTF-kompatibles Format (raw_geometry als Base64 oder URL-Platzhalter)

2. autoMapComponent(component: SkpComponent): SkpComponentMapping
   - Heuristik-Mapping via Name-Keywords (aus Docs/SKP_INTEROP.md)
   - Unbekannte Komponenten → target_type: 'reference_object'

Unit-Tests (vitest) mit Mock-Daten (kein echtes SKP nötig für Tests).
```

---

## TASK-17-C01 – Block-Bewertungsalgorithmus

**Sprint:** 17 | **Zuständig:** Codex | **Priorität:** Soll | **Status:** Erledigt (MVP, 2026-03-01)

### Akzeptanzkriterien
- [x] `evaluateBlock(project, block): BlockEvaluation`
- [x] `findBestBlock(project, blocks): BlockEvaluation`
- [x] Unit-Tests mit mehreren Blockmodellen

### Codex-Prompt
```
Du implementierst die Blockverrechnung für einen Küchenplaner.
Datei: `planner-api/src/services/blockEvaluator.ts`

Kontext: Hersteller bieten "Blockprogramme" an — Staffelrabatte basierend auf Umsatz/Punkten.
Mehrere Blöcke werden verglichen, der vorteilhafteste wird übernommen.

Typen:
  interface BlockDefinition {
    id: string;
    name: string;
    basis: 'purchase_price' | 'sell_price' | 'points';
    tiers: BlockTier[];  // { min_value: number; discount_pct: number }[]
  }
  interface BlockEvaluation {
    block_id: string;
    block_name: string;
    basis_value: number;       // berechneter Gesamtwert (EK-Summe, VK-Summe oder Punkte)
    applied_discount_pct: number;
    price_advantage_net: number;  // Vorteil gegenüber Standardkalkulation
    recommended: boolean;
  }

Implementiere:
1. evaluateBlock(priceSummary: PriceSummary, block: BlockDefinition): BlockEvaluation
   - Berechnet basis_value je nach block.basis
   - Findet passende Tier (höchste min_value <= basis_value)
   - Berechnet price_advantage_net = standard_net - net_with_block_discount

2. findBestBlock(priceSummary: PriceSummary, blocks: BlockDefinition[]): BlockEvaluation
   - Evaluiert alle Blocks
   - Gibt denjenigen mit höchstem price_advantage_net zurück
   - Setzt recommended: true nur beim Besten

Unit-Tests (vitest):
- 3 Blockprogramme, unterschiedliche Tiers
- Kein passender Tier → discount_pct: 0
- Bester Block korrekt identifiziert
```

---

## TASK-19-C01 – Import-/Export-Regressionstests

**Sprint:** 19 | **Zuständig:** Codex | **Priorität:** Kann | **Status:** Erledigt (MVP, 2026-03-01)

### Codex-Prompt
```
Du erstellst Regressionstests für den DXF-Import/Export-Roundtrip eines Küchenplaners.
Datei: `tests/integration/cadRoundtrip.test.ts`

Nutze: vitest + die Module aus TASK-3-C03 (dxfParser) und TASK-11-C02 (dxfExporter).

Testfälle:
1. Roundtrip-Basis:
   - Erstelle ExportPayload mit bekannten Koordinaten
   - exportToDxf → DXF-String
   - parseDxf → ImportAsset
   - Vergleiche: alle Raum-Vertices im ImportAsset vorhanden (Toleranz: ±1mm)

2. Einheiten-Check:
   - DXF mit INSUNITS=1 (Inch) importieren → Koordinaten in mm korrekt

3. Layer-Check:
   - Exportiertes DXF enthält alle 4 YAKDS-Layer

4. Robustheit:
   - Leeres DXF → kein Crash, leeres ImportAsset
   - DXF mit unbekannten Entities → nur bekannte werden importiert
```


---

## Quelle: TASKS_GITHUB_COMPANION

# TASKS_GITHUB_COMPANION.md

## Aufgaben für Github Companion

**Zuständigkeit:** Code-Review auf PRs, Architektur-Review, Dokumentationsanalyse, Sicherheitsanalyse, Testabdeckungs-Check

**Beteiligte Modelle:**
| Modell | Schwerpunkt |
|---|---|
| **Claude** | Architektur-Review, API-Konsistenz, Datenmodell-Analyse |
| **GPT** | Dokumentations-Review, Kommentarqualität, Codelesbarkeit |
| **GROK** | Kritische Code-Analyse, Logikfehler, Edge Cases |
| **Raptor** | Sicherheitsanalyse, Dependency-Check, Performance-Hinweise |

> **Prompt-Nutzung:** Jeden Prompt direkt im PR-Kommentar oder im Github Companion Chat eingeben. Betroffene Dateien als Kontext anhängen.

---

## TASK-0-R01 – Review: Architekturdokumente (Sprint 0)

**Sprint:** 0 | **Zuständig:** Claude + GPT | **Status:** Offen

### Claude-Prompt
```
Reviewe die Architekturdokumente eines neuen Webprojekts (Küchenplaner, Node.js + TypeScript).

Prüfe folgende Dateien: ARCHITECTURE.md, ROOM_MODEL.md, PRICING_MODEL.md, QUOTE_MODEL.md, RENDER_PROTOCOL.md, CAD_INTEROP.md, SKP_INTEROP.md

Fokus:
1. Sind alle API-Contracts vollständig und widerspruchsfrei?
2. Sind die Domänenobjekte konsistent über alle Dokumente hinweg (gleiche Feldnamen, gleiche Typen)?
3. Deckt das Render-Protokoll alle Status-Übergänge ab (queued → done/failed)?
4. Ist die CAD/SKP-Interop-Strategie realistisch für den MVP-Scope?
5. Gibt es ungelöste Abhängigkeiten zwischen den Dokumenten?

Antworte mit: Befunde (konkret mit Datei:Zeile), Empfehlungen, offene Fragen.
```

### GPT-Prompt
```
Reviewe Architekturdokumente für ein Softwareprojekt auf Verständlichkeit und Vollständigkeit.

Dateien: ARCHITECTURE.md, ROOM_MODEL.md, PRICING_MODEL.md, QUOTE_MODEL.md

Fokus:
1. Sind die Dokumente für einen neuen Entwickler ohne Vorkenntnisse verständlich?
2. Werden Fachbegriffe (Kniestock, Dachschräge, Blockverrechnung) erklärt?
3. Sind JSON-Beispielstrukturen vorhanden und korrekt?
4. Fehlen wichtige Abschnitte (z.B. Fehlerszenarien, Definitionen)?

Antworte mit konkreten Verbesserungsvorschlägen je Dokument.
```

---

## TASK-1-R01 – Review: Backend-Grundgerüst PR (Sprint 1)

**Sprint:** 1 | **Zuständig:** Raptor + GROK | **Status:** Offen

### Raptor-Prompt
```
Führe eine Sicherheitsanalyse für ein neues Node.js/Fastify-Backend durch.

Betroffene Dateien: planner-api/src/, planner-api/prisma/schema.prisma

Prüfe:
1. SQL-Injection: Werden alle DB-Queries parametrisiert (Prisma ORM)? Gibt es Raw-Queries?
2. Passwort-Handling: Werden Passwörter gehasht (bcrypt/argon2)? Keine Klartextpasswörter?
3. Credentials: Keine Secrets, API-Keys oder Passwörter im Code oder in git-trackten Dateien?
4. Dependencies: Gibt es bekannte CVEs in package.json (npm audit)?
5. Input-Validation: Wird jeder API-Eingang mit Zod oder ähnlichem validiert?

Antworte mit: Schweregrad (kritisch/hoch/mittel/niedrig), betroffene Datei, konkrete Empfehlung.
```

### GROK-Prompt
```
Analysiere ein Datenbankschema und erste API-Routen auf Korrektheit und Robustheit.

Betroffene Dateien: planner-api/prisma/schema.prisma, planner-api/src/routes/

Prüfe:
1. Ist das DB-Schema normalisiert (3NF)? Gibt es Redundanzen?
2. Sind alle Fremdschlüssel und CASCADE-Rules sinnvoll gesetzt?
3. Fehlerbehandlung: Werden DB-Fehler (z.B. UniqueConstraint-Violation) korrekt abgefangen und als HTTP-Fehler zurückgegeben?
4. Werden Transaktionen verwendet, wo atomare Operationen nötig sind (z.B. Projekt + Room anlegen)?
5. Gibt es N+1-Query-Probleme in den Routen?

Liste konkrete Probleme mit Datei und Zeilennummer.
```

---

## TASK-2-R01 – Review: Frontend-Grundgerüst PR (Sprint 2)

**Sprint:** 2 | **Zuständig:** GPT + GROK | **Status:** Offen

### GPT-Prompt
```
Reviewe die initiale Struktur einer React + TypeScript Frontend-Anwendung.

Betroffene Dateien: planner-frontend/src/

Fokus:
1. Ist die Komponentenstruktur sauber (Trennung von UI, State, API-Calls)?
2. Ist der State-Management-Ansatz dokumentiert und konsistent?
3. Sind Komponenten-Props typisiert (keine `any`)?
4. Gibt es fehlende Accessibility-Attribute (aria-label, role)?
5. Sind Komponentennamen und Dateinamen konsistent (PascalCase)?

Antworte mit konkreten Verbesserungsvorschlägen.
```

### GROK-Prompt
```
Analysiere die API-Integration und asynchrone Logik eines React-Frontends auf Fehler.

Betroffene Dateien: planner-frontend/src/api/, planner-frontend/src/hooks/

Prüfe:
1. Werden API-Fehler überall abgefangen und dem User angezeigt?
2. XSS-Risiken: Werden User-Inhalte mit dangerouslySetInnerHTML gerendert?
3. Gibt es Race Conditions bei parallelen API-Calls (z.B. schnell wechselnde Projekte)?
4. Werden AbortController verwendet um API-Calls bei Unmount abzubrechen?
5. Werden sensible Daten (Token) im localStorage oder nur im Memory gehalten?

Liste konkrete Risiken mit Datei und Erklärung.
```

---

## TASK-3-R01 – Review: Polygon-Editor PR (Sprint 3)

**Sprint:** 3 | **Zuständig:** GROK + Claude | **Status:** Erledigt (intern, 2026-03-01)

### GROK-Prompt
```
Analysiere einen Polygon-Editor für einen Küchenplaner auf Korrektheit und Robustheit.

Betroffene Dateien:
- shared-schemas/src/geometry/validatePolygon.ts
- shared-schemas/src/geometry/snapUtils.ts
- planner-frontend/src/editor/PolygonEditor.tsx

Prüfe:
1. Deckt die Polygon-Validierung alle Edge Cases ab?
   - Degeneriertes Polygon (alle Punkte auf einer Linie)
   - Sehr kleine Polygone (< 100mm Seitenlänge)
   - Polygon mit doppelten Punkten
2. Ist die Snap-Logik numerisch stabil? (Floating-Point-Fehler bei 45°-Snap?)
3. Werden Canvas-Event-Handler (mousedown, mousemove, mouseup) korrekt entfernt (Memory Leak)?
4. Können Koordinaten vom User so manipuliert werden, dass ungültige Werte in die DB gelangen?

Konkrete Befunde mit Datei und Zeilennummer.
```

### Claude-Prompt
```
Reviewe die Datenfluss-Implementierung eines Polygon-Raum-Editors.

Betroffene Dateien:
- planner-api/src/routes/rooms.ts
- planner-api/src/services/roomService.ts
- planner-frontend/src/api/roomsApi.ts

Prüfe:
1. Ist der Datenfluss Frontend → API → DB konsistent mit dem Raummodell in Docs/ROOM_MODEL.md?
2. Bleiben wall_id-Werte stabil, wenn ein Vertex verschoben wird? (Kritisch für Platzierungsreferenzen)
3. Sind die API-Responses vollständig (alle benötigten Felder für das Frontend)?
4. Gibt es fehlende Validierungen auf API-Ebene (z.B. max. 64 Vertices)?

Antworte mit Ja/Nein je Punkt + konkreten Befunden.
```

---

## TASK-3-R02 – Review: CAD/SKP Import-Pipeline PR (Sprint 3.5)

**Sprint:** 3.5 | **Zuständig:** Raptor + Claude | **Status:** Erledigt (intern, 2026-03-01)

### Raptor-Prompt
```
Führe eine Sicherheitsanalyse für einen Datei-Upload-Endpunkt durch (CAD-Dateien).

Betroffene Dateien:
- planner-api/src/routes/imports.ts
- interop-cad/dxf-import/src/dxfParser.ts

Prüfe:
1. Dateigrößen-Limit: Gibt es ein Maximum (z.B. 50 MB)?
2. Dateitype-Validierung: Wird MIME-Type UND Magic Bytes geprüft (nicht nur Dateiendung)?
3. Pfadtraversierung: Kann der Dateiname Pfade enthalten (../../etc/passwd)?
4. DXF/DWG-spezifisch: Gibt es External-Reference-Angriffe (XREF auf externe Hosts)?
5. Upload-Zielverzeichnis: Liegt es außerhalb des Web-Roots? Nicht direkt erreichbar?
6. Parser-DoS: Kann eine manipulierte DXF-Datei den Parser in eine Endlosschleife treiben?

Schweregrad + konkrete Empfehlung je Befund.
```

### Claude-Prompt
```
Reviewe die Import-Pipeline-Implementierung auf Korrektheit und Vollständigkeit.

Betroffene Dateien:
- planner-api/src/routes/imports.ts
- planner-api/src/services/importService.ts
- interop-cad/dxf-import/src/dxfParser.ts

Prüfe anhand von Docs/CAD_INTEROP.md:
1. Entspricht das ImportAsset-Format exakt der Spezifikation?
2. Werden ImportJob-Status-Übergänge korrekt persistiert?
3. Ist die Einheiten-Normalisierung (INSUNITS → mm) implementiert?
4. Gibt es einen Endpunkt um Layer anzuzeigen und Raumkonturen zu übernehmen?

Antworte mit konkreten Abweichungen von der Spec.
```

---

## TASK-5-R01 – Review: Öffnungen PR (Sprint 5)

**Sprint:** 5 | **Zuständig:** GROK | **Status:** Erledigt (intern, 2026-03-01)

### GROK-Prompt
```
Analysiere die Öffnungs-Implementierung (Türen/Fenster) eines Küchenplaners.

Betroffene Dateien:
- shared-schemas/src/geometry/openingValidator.ts
- planner-api/src/routes/openings.ts

Prüfe:
1. Schlägt die Validierung für alle ungültigen Positionen fehl?
   - offset_mm < 0
   - offset_mm + width_mm > wall.length_mm (exakt auf Grenze)
   - Zwei Öffnungen mit 0mm Abstand (direkt aneinander)
2. Ist der Überschneidungs-Check performant bei n Öffnungen? (O(n²) akzeptabel bis n=20)
3. Ist die Öffnungs-Übernahme aus CAD-Daten auf Plausibilität geprüft?
   (z.B. Breite < 200mm oder > 3000mm → ignorieren)
4. Können Öffnungen über API ohne room_id angelegt werden? (Daten-Inkonsistenz)
```

---

## TASK-8-R01 – Review: Platzierungsengine PR (Sprint 8)

**Sprint:** 8 | **Zuständig:** GROK + Claude | **Status:** Erledigt (intern, 2026-03-01)

### GROK-Prompt
```
Analysiere die wandbasierte Platzierungsengine auf Mathematik-Korrektheit.

Betroffene Dateien:
- shared-schemas/src/geometry/wallPlacement.ts
- planner-api/src/services/placementService.ts

Prüfe:
1. Ist die Innenrichtungsberechnung für alle Polygonformen korrekt?
   - Konkave Polygone (L-Form, U-Form)
   - Wände mit Winkel < 45° oder > 135° zum Nachbarsegment
2. Numerische Stabilität: Was passiert bei Wandlänge = 0 mm? Division by Zero?
3. Concurrency: Können zwei gleichzeitige API-Calls denselben Wandbereich belegen?
   (optimistic locking oder DB-Constraint nötig?)
4. Kann offset_mm negativ oder größer als wall.length_mm über die API gesetzt werden?
```

### Claude-Prompt
```
Reviewe die API-Vollständigkeit der Platzierungsengine.

Betroffene Dateien:
- planner-api/src/routes/placements.ts
- planner-frontend/src/editor/PlacementManager.tsx

Prüfe anhand von Docs/ROOM_MODEL.md:
1. Sind alle CRUD-Endpunkte für Placements implementiert?
2. Werden Placements atomar persistiert (kein Halbzustand bei Fehler)?
3. Gibt das Frontend korrekte wall_id + offset_mm an die API?
4. Wird nach Platzierung automatisch eine Validierung ausgelöst (POST /validate)?
```

---

## TASK-9-R01 – Review: Kollisionserkennung PR (Sprint 9)

**Sprint:** 9 | **Zuständig:** GROK + Raptor | **Status:** Erledigt (intern, 2026-03-01)

### GROK-Prompt
```
Analysiere die Kollisionserkennungs-Implementierung auf Vollständigkeit und Performance.

Betroffene Dateien:
- shared-schemas/src/validation/collisionDetector.ts
- planner-api/src/routes/validate.ts

Prüfe:
1. Werden alle 5 Kollisionstypen getestet (Objekt-Overlap, außerhalb Raum, Öffnung, Mindestabstand, ungültiger Bereich)?
2. Performance: O(n²) bei checkObjectOverlap — akzeptabel bis n=50?
3. Sind die Hinweis-Flags (Sonderblende, Montageaufwand) korrekt gesetzt?
4. Gibt es Grenzfall: Objekt genau an Raumgrenze (0mm Abstand) → Error oder OK?
5. Wird die Validierung auch auf Server-Seite erzwungen (nicht nur Client)?
```

### Raptor-Prompt
```
Prüfe den Validierungs-Endpunkt auf Missbrauchspotenzial.

Betroffene Datei: planner-api/src/routes/validate.ts

Prüfe:
1. Kann der Endpunkt mit einem sehr großen Projekt (1000 Objekte) für DoS genutzt werden?
   → Rate-Limiting vorhanden? Komplexitätslimit?
2. Wird geprüft, ob der anfragende User zum Projekt gehört (Autorisierung)?
3. Werden Eingaben vor der Algorithmus-Ausführung validiert (malformed room polygon)?
```

---

## TASK-11-R01 – Review: BOM-Engine PR (Sprint 11)

**Sprint:** 11 | **Zuständig:** Claude + GROK | **Status:** Erledigt (intern, 2026-03-01)

### Claude-Prompt
```
Reviewe die BOM-Implementierung auf Vollständigkeit und Spec-Konformität.

Betroffene Dateien:
- planner-api/src/services/bomCalculator.ts
- planner-api/src/routes/bom.ts

Prüfe anhand von Docs/PRICING_MODEL.md:
1. Werden alle BOMLineTypes erzeugt (cabinet, appliance, accessory, surcharge, assembly, freight, extra)?
2. Enthält jede BOMLine alle Pflichtfelder laut Spec (list_price_net, variant_surcharge, etc.)?
3. Ist die API-Response (POST /calculate-bom) konsistent mit PriceSummary-Format?
4. Werden Flags aus PlacedObject (requires_customization, labor_surcharge) korrekt in BOMLines übersetzt?
```

### GROK-Prompt
```
Prüfe die BOM-Berechnung auf numerische Korrektheit und Edge Cases.

Betroffene Datei: planner-api/src/services/bomCalculator.ts

Prüfe:
1. Rundungsfehler: Werden Zwischenergebnisse mit ausreichender Präzision berechnet?
   (Kein voreiliges Runden auf 2 Dezimalen)
2. Edge Case: Projekt ohne Objekte → Nur Fracht-BOMLine?
3. Edge Case: Objekt ohne Katalog-Zuweisung → Fehler oder ignorieren?
4. Qty > 0 für alle Zeilen erzwungen? (qty=0 ergibt sinnlose Zeile)
```

---

## TASK-12-R01 – Review: Preisengine PR (Sprint 12)

**Sprint:** 12 | **Zuständig:** GROK + Claude | **Status:** Erledigt (intern, 2026-03-01)

### GROK-Prompt
```
Analysiere die 9-stufige Preisberechnung auf Korrektheit.

Betroffene Datei: planner-api/src/services/priceCalculator.ts

Prüfe:
1. Werden die 9 Stufen in exakt der richtigen Reihenfolge angewendet (laut Docs/PRICING_MODEL.md)?
2. Floating-Point-Fehler: Wird mit Number (float64) oder Decimal-Bibliothek gerechnet?
   → Bei Geldbeträgen ist Decimal.js oder big.js empfohlen.
3. Negative Preise: Kann ein Globalrabatt > 100% zu negativem Netto führen?
4. MwSt-Gruppen: Werden gemischte Steuersätze (7% + 19%) korrekt aggregiert?
5. Rundung nur am Ende (Stufe 9) — nicht zwischen den Stufen?
```

### Claude-Prompt
```
Reviewe die kaufmännische Korrektheit der Preisengine.

Betroffene Dateien:
- planner-api/src/services/priceCalculator.ts
- planner-api/src/routes/pricing.ts

Prüfe:
1. Ist contribution_margin_net = subtotal_net - dealer_price_net korrekt berechnet?
2. Ist markup_pct = (margin / dealer_price) × 100 — nicht margin/list_price?
3. Werden Extra-Kosten (Fracht) in die MwSt-Berechnung einbezogen?
4. Ist der GET /price-summary Endpunkt ein Snapshot (kein Live-Recalculate)?
```

---

## TASK-13-R01 – Review: Angebotsmanagement PR (Sprint 13)

**Sprint:** 13 | **Zuständig:** Raptor + GPT | **Status:** Erledigt (intern, 2026-03-01)

### Raptor-Prompt
```
Sicherheitsanalyse für die Angebots- und PDF-Generierung.

Betroffene Dateien:
- planner-api/src/routes/quotes.ts
- planner-api/src/services/pdfGenerator.ts

Prüfe:
1. PDF-Injection: Wird Freitext-Input sanitized bevor er ins PDF gelangt?
   (Gefahr: LaTeX-Injection, HTML-Injection in PDF-Libs wie Puppeteer/PDFKit)
2. Enthält das PDF keine internen Daten (DB-IDs, Server-Pfade, Debug-Infos)?
3. Zugriffskontrolle: Kann User A das Angebot von User B abrufen (IDOR)?
4. PDF-URL: Ist sie nicht ratebar (kein /quotes/1.pdf, /quotes/2.pdf)?
5. Versionierung: Kann eine alte Angebotsversion überschrieben werden?
```

### GPT-Prompt
```
Reviewe das Angebots-PDF auf professionellen Aufbau und Vollständigkeit.

Betroffene Datei: planner-api/src/services/pdfGenerator.ts

Prüfe:
1. Enthält das PDF alle Pflichtfelder laut Docs/QUOTE_MODEL.md (Angebotsnummer, Gültig-bis, Positionen, Summen)?
2. Ist der Summenblock korrekt: Zwischensumme netto | MwSt | Brutto?
3. Positionen mit show_on_quote: false erscheinen NICHT im PDF?
4. Ist der Freitext-Bereich korrekt escaped (keine HTML-Sonderzeichen im PDF)?
5. Layout: Umbricht die Tabelle korrekt bei vielen Positionen (> 1 Seite)?
```

---

## TASK-15-R01 – Review: Render-Job-System PR (Sprint 15)

**Sprint:** 15 | **Zuständig:** Raptor + GROK | **Status:** Erledigt (intern, 2026-03-01)

### Raptor-Prompt
```
Sicherheitsanalyse des Render-Worker-Protokolls.

Betroffene Dateien:
- planner-api/src/routes/renderJobs.ts
- planner-api/src/routes/workers.ts

Prüfe anhand von Docs/RENDER_PROTOCOL.md:
1. Worker-Authentifizierung: Ist GET /render-jobs/next ohne gültigen Worker-Token erreichbar?
2. Token-Speicherung: Wird der Worker-Token gehasht gespeichert (nicht im Klartext)?
3. Scene Payload: Enthält er Kundennamen, Preise oder andere sensitive Daten?
4. Ergebnis-Upload: Kann ein Worker Jobs von anderen Workern übernehmen?
5. Bild-URL: Ist sie nicht öffentlich ratebar (/results/1.jpg, /results/2.jpg)?
```

### GROK-Prompt
```
Analysiere die Job-Queue-Implementierung auf Korrektheit und Fehlerresistenz.

Betroffene Dateien:
- planner-api/src/services/renderJobService.ts
- planner-api/src/routes/renderJobs.ts

Prüfe:
1. Status-Übergänge: Werden ungültige Übergänge verhindert (z.B. done → running)?
2. Atomarität: Können zwei Worker denselben Job gleichzeitig holen?
   (SELECT + UPDATE muss atomar sein — DB-Lock oder CAS-Update?)
3. Timeout-Handling: Werden Jobs aus 'assigned' zurück zu 'queued' nach 5 min (laut Spec)?
4. Heartbeat: Falls Worker abstürzt, wie lange bis Job freigegeben wird?
```

---

## TASK-17-R01 – Review: Blockverrechnung PR (Sprint 17)

**Sprint:** 17 | **Zuständig:** Claude + GROK | **Status:** Erledigt (intern, 2026-03-01)

### Claude-Prompt
```
Reviewe die Blockverrechnung auf kaufmännische Korrektheit.

Betroffene Dateien:
- planner-api/src/services/blockEvaluator.ts
- planner-api/src/routes/blocks.ts

Prüfe:
1. Deckt das BlockDefinition-Datenmodell alle gängigen Hersteller-Modelle ab (EK-Basis, VK-Basis, Punkte)?
2. Ist die Beste-Block-Auswahl nach price_advantage_net korrekt (nicht nach discount_pct)?
3. Wird der übernommene Blockrabatt korrekt ins Angebot übertragen?
4. Gleichstand zweier Blöcke: Welcher wird gewählt? Deterministisch?
```

### GROK-Prompt
```
Prüfe den Block-Algorithmus auf Edge Cases und Performance.

Betroffene Datei: planner-api/src/services/blockEvaluator.ts

Prüfe:
1. Kein passender Tier (basis_value unter allen min_values): discount_pct = 0, kein Fehler?
2. Leere Blocks-Liste übergeben: Kein Absturz, leeres Ergebnis?
3. Performance: Bei 50 Blockprogrammen mit je 10 Tiers — Laufzeit akzeptabel?
4. Werden negative price_advantage_net Werte (Block schlechter als Standard) korrekt ausgefiltert?
```

---

## TASK-19-R01 – Review: Interop-Härtung PR (Sprint 19)

**Sprint:** 19 | **Zuständig:** Alle Modelle | **Status:** Offen

### Claude-Prompt
```
Reviewe die CAD-Interop-Härtung auf Spec-Konformität und Dokumentationsvollständigkeit.

Betroffene Dateien: Docs/CAD_INTEROP.md, tests/integration/cadRoundtrip.test.ts

Prüfe:
1. Ist der DWG-Roundtrip (Import → Bearbeitung → Export) vollständig dokumentiert?
2. Sind Layer-Konventionen in CAD_INTEROP.md final und vollständig?
3. Decken die Regressionstests alle dokumentierten Layer und Einheiten-Fälle ab?
```

### GROK-Prompt
```
Prüfe die Roundtrip-Tests auf Robustheit.

Betroffene Datei: tests/integration/cadRoundtrip.test.ts

Prüfe:
1. Werden Koordinaten mit Toleranz verglichen (±1mm) statt exakt (Float-Vergleich)?
2. Werden verschiedene DXF-Versionen getestet (R2010, R2013, R2018)?
3. Leeres DXF als Grenzfall vorhanden?
4. Werden alle 4 YAKDS-Layer im Export geprüft?
```

### Raptor-Prompt
```
Prüfe den Export-Endpunkt auf neue Sicherheitsrisiken nach der Härtung.

Betroffene Datei: planner-api/src/routes/exports.ts

Prüfe:
1. Können exportierte DXF-Dateien Metadaten enthalten, die interne Infos leaken (Server-Pfade, Nutzernamen)?
2. Ist die Download-URL zeitlich begrenzt (signierte URL, Ablaufzeit)?
```

### GPT-Prompt
```
Prüfe die Interop-Dokumentation auf Aktualität und Vollständigkeit.

Betroffene Dateien: Docs/CAD_INTEROP.md, Docs/SKP_INTEROP.md

Prüfe:
1. Stimmen die dokumentierten Layer-Namen mit der tatsächlichen Implementierung überein?
2. Sind alle Nicht-MVP-Punkte als solche markiert?
3. Gibt es neue Features aus Sprint 18/19, die noch nicht dokumentiert sind?
```


---

## Quelle: PHASE_2_TASKS_CLAUDE

# PHASE_2_TASKS_CLAUDE.md

## Zuständigkeit: Claude (Antigravity / Claude Code)
**Fokus:** Architektur, API-Endpunkte, Datenbank-Schema, Multi-Tenant-Isolation, System-Integration.

---

## TASK-20-A01 – Herstellerkatalog & Konfigurator (Backend)
**Sprint:** 20 | **Zuständig:** Claude | **Priorität:** Muss
**Abhängigkeiten:** keine (Phase 2 Start)

### Ziel
Datenmodell für Herstellerkataloge und Schrankoptionen implementieren.

### Akzeptanzkriterien
- [x] Schema-Migration für `manufacturer`, `catalog_article`, `article_option`, `article_variant`, `article_price`.
- [x] CRUD Endpunkte für Katalog-Management.
- [x] API-Endpoint für Konfigurator-Snapshots (CabinetInstance mit Referenz auf CatalogArticle).

---

## TASK-21-A01 – AutoCompletionService (Core)
**Sprint:** 21 | **Zuständig:** Claude | **Priorität:** Muss
**Abhängigkeiten:** TASK-20-A01

### Ziel
Service-Schicht zur automatischen Generierung von Langteilen.

### Akzeptanzkriterien
- [x] Tabelle `generated_items` mit `source_links` zur Verknüpfung von Schrank -> Arbeitsplatte/Sockel.
- [x] `AutoCompletionService` im Backend, der auf Änderungen reagiert und Rebuild-Events triggert.

---

## TASK-22-A01 – Rule Engine v2 ("Protect" Framework)
**Sprint:** 22 | **Zuständig:** Claude | **Priorität:** Muss
**Abhängigkeiten:** TASK-21-A01

### Ziel
Skalierbares Framework für Projektprüfungen.

### Akzeptanzkriterien
- [x] Datenmodell für `rule_definitions`, `rule_runs` und `rule_violations`.
- [x] API `POST /projects/:id/validate-v2` zur Orchestrierung aller Einzelprüfungen.
- [x] Persistenz der Prüfungshistorie für "Finalfreigabe".

---

## TASK-23-A01 – Multi-Tenant & BI Endpoints
**Sprint:** 23 | **Zuständig:** Claude | **Priorität:** Muss
**Abhängigkeiten:** TASK-1-01 (Phase 1)

### Ziel
Sichere Trennung der Daten und Bereitstellung von KPI-Exporten.

### Akzeptanzkriterien
- [x] API-Middleware zur Durchsetzung von `tenant_id` Scoping.
- [x] BI-Endpunkte: `/bi/summary`, `/bi/quotes`, `/bi/products` (JSON-Schnittstellen).

---

## TASK-24-A01 – Webplanner Promotion-Logik
**Sprint:** 24 | **Zuständig:** Claude | **Priorität:** Soll
**Abhängigkeiten:** TASK-20-A01

### Ziel
Konvertierung eines Webplanner-Leads in ein vollwertiges Projekt.

### Akzeptanzkriterien
- [x] API `/leads/promote` zum Mapping von vereinfachten Web-Daten in Profi-Strukturen.
- [x] CRM-Integration der Kontaktdaten.


---

## Quelle: PHASE_2_TASKS_CODEX

# PHASE_2_TASKS_CODEX.md

## Zuständigkeit: Codex
**Fokus:** Algorithmen, Validatoren, Importer/Parser, KPI-Aggregation, Geometrie-Transformationen.

---

## TASK-20-C01 – Katalog-Importer (CSV/JSON Parser)
**Sprint:** 20 | **Zuständig:** Codex | **Priorität:** Muss
**Abhängigkeiten:** keine

### Codex-Prompt
```
Du implementierst einen Katalog-Importer für einen Küchenplaner.
Datei: `planner-api/src/services/catalogImporter.ts`

Typen (siehe PHASE_2_SPRINTS_20_24.md):
  manufacturer(id, name, code)
  catalog_article(id, manufacturer_id, sku, ...)
  article_option, article_variant

Implementiere (pure Funktionen):
1. parseCatalogFile(fileBuffer: Buffer, format: 'csv'|'json'): RawArticle[]
2. validateCatalogSet(set: CatalogArticleImportSet): ValidationResult
   - Prüfe auf Duplikate und Pflichtfelder (SKU, Name, Listpreis)
3. mapToInternalSchema(raw: RawArticle[]): CatalogArticleImportSet
   - Extraktion von Optionen (Farbe, Griff) und Varianten (Breite, Tiefe)

Unit-Tests in catalogImporter.test.ts (vitest).
```

---

## TASK-21-C01 – Langteile-Geometrie-Generator
**Sprint:** 21 | **Zuständig:** Codex | **Priorität:** Muss
**Abhängigkeiten:** keine

### Codex-Prompt
```
Du implementierst die Geometrieberechnung für Auto-Langteile.
Datei: `shared-schemas/src/geometry/autoLongParts.ts`

Logik (aus PHASE_2_SPRINTS_20_24.md):
- Erzeuge Worktop-Segmente entlang zusammenhängender Cabinet-Cluster pro Wand.
- Parameter: Überstand vorne/seitlich (mm), Stoß-Regeln bei Längenlimit.

Implementiere:
1. clusterCabinetsByWall(cabinets: PlacedCabinet[]): CabinetCluster[]
2. calculateWorktopSegments(cluster: CabinetCluster, params: WorktopParams): WorktopSegment[]
   - Berechne Länge basiert auf Clustern plus Überständen.
   - Beachte L-Form Stöße (minimal).
3. calculatePlinthSegments(cluster: CabinetCluster, params: PlinthParams): PlinthSegment[]

Unit-Tests für gerade Zeilen und L-Konfigurationen.
```

---

## TASK-22-C02 – Protect-Regelbibliothek v2
**Sprint:** 22 | **Zuständig:** Codex | **Priorität:** Muss
**Abhängigkeiten:** keine

### Codex-Prompt
```
Du implementierst die erweiterte Regelbibliothek v2.
Datei: `shared-schemas/src/validation/rules_v2.ts`

Implementiere mind. 15 Regeln als pure Funktionen:
1. checkDoorSlam(obj: PlacedObject, others: PlacedObject[]): RuleViolation | null
2. checkErgonomicClearance(floorObj: PlacedObject, wallObj: PlacedObject): RuleViolation | null
3. checkCompleteness(project: Project): RuleViolation[]
   - Warnung bei fehlender Arbeitsplatte/Sockel/Endblenden.
4. checkHeightConstraints(obj: PlacedObject, constraints: CeilingConstraint[]): RuleViolation | null

Unit-Tests für jede Regel einzeln.
```

---

## TASK-23-C02 – KPI Aggregation & BI-Logik
**Sprint:** 23 | **Zuständig:** Codex | **Priorität:** Soll
**Abhängigkeiten:** keine

### Codex-Prompt
```
Du implementierst die Aggregationslogik für Business-KPIs.
Datei: `planner-api/src/services/biAggregator.ts`

Implementiere:
1. aggregateQuoteKPIs(quotes: QuoteSnapshot[], range: DateRange): QuoteSummary
   - Summe Netto, Anzahl, Durchschnittswert, CM-Ranking.
2. calculateConversionRatio(leads: Lead[], wins: WonQuote[]): number
3. getProductPerformance(quoteItems: QuoteItem[]): Map<string, PerformanceStats>

Unit-Tests mit Mock-DB-Dumps.
```

---

## TASK-24-C02 – Webplanner Geometrie-Wizard-Hilfslogik
**Sprint:** 24 | **Zuständig:** Codex | **Priorität:** Soll
**Abhängigkeiten:** keine

### Codex-Prompt
```
Du implementierst Geometrie-Hilfsfunktionen für den Webplanner-Wizard.
Datei: `shared-schemas/src/geometry/webplannerUtils.ts`

Implementiere:
1. simplifyPolygonToWebplanner(vertices: Vertex[]): SimplifiedRoom
   - Reduzierung komplexer Formen auf rechteckige Grundformen oder L-Formen für Web-UX.
2. isCompatibleForWizard(vertices: Vertex[]): boolean
   - Filtert Räume aus, die zu komplex für den schnellen Web-Handover sind.

Unit-Tests.
```


---

## Quelle: PHASE_2_TASKS_GITHUB_COMPANION

# PHASE_2_TASKS_GITHUB_COMPANION.md

## Zuständigkeit: GitHub Companion (Reviewer)
**Fokus:** Architektur-Review, API-Konsistenz, Security-Audit, Datenisolations-Check, UX-Konsistenz.

---

## TASK-20-R01 – Review: Katalog-Datenmodell & Importer
**Sprint:** 20 | **Zuständig:** Claude (+ GROK) | **Priorität:** Muss

### Claude-Prompt (Review)
```
Reviewe das neue Katalog-Datenmodell und die Importer-Logik.
Dateien: `planner-api/prisma/schema.prisma`, `planner-api/src/services/catalogImporter.ts`

Prüfe:
1. Sind die Tabellen `catalog_article`, `article_option` und `article_variant` normalisiert?
2. Deckt die Importer-Validierung Preislisten-Edge-Cases (0-Preis, leere Währung) ab?
3. Ist die Variantenlogik (dims_override_json) stabil gegen ungültige Dimensionen?
4. Werden Hersteller-Codes (SKU) weltweit eindeutig behandelt?

Ergebnis: Befunde je Datei und Empfehlungen zur Schema-Optimierung.
```

---

## TASK-21-R01 – Review: AutoCompletion-Validierung
**Sprint:** 21 | **Zuständig:** GROK (+ Raptor) | **Priorität:** Muss

### GROK-Prompt (Review)
```
Prüfe die automatische Langteile-Generierung (Arbeitsplatten & Sockel) auf mathematische Fehler.
Dateien: `shared-schemas/src/geometry/autoLongParts.ts`, `planner-api/src/services/AutoCompletionService.ts`

Prüfe:
1. Corner-Cases: Was passiert bei sich überschneidenden Schränken oder 180°-Winkeln?
2. Persistenz: Sind die `source_links` bidirektional stabil?
3. Race-Conditions: Was passiert bei parallelen Schrank-Löschungen wärend des Rebuilds?
4. DoS-Risiko: Kann ein sehr komplexes Schrank-Geflecht den Server blockieren?

Konkrete Verbesserungsvorschläge zur Geometrie-Robustheit.
```

---

## TASK-22-R01 – Review: "Protect" Engine v2 Sicherheit
**Sprint:** 22 | **Zuständig:** Raptor (+ Claude) | **Priorität:** Muss

### Raptor-Prompt (Audit)
```
Führe einen Sicherheits-Audit für die neue Prüf-Engine (RuleEngine v2) durch.
Dateien: `planner-api/src/routes/validateV2.ts`, `shared-schemas/src/validation/rules_v2.ts`

Fokus:
1. Injektions-Risiko: Können Regulierungs-Parameter (params_json) schädlichen Code ausführen?
2. DoS: Kann ein User ein Projekt mit 5000 fiktiven Objekten validieren lassen? (Rate Limiting?)
3. Resource-Leaks: Werden RuleRuns und Violations sauber gecleant?
4. Berechtigung: Prüft `POST /validate-v2` den Projektbesitz (Tenant-Scope)?

Sicherheitsbefunde nach Schweregrad (Kritisch/Hoch/Mittel/Niedrig).
```

---

## TASK-23-R01 – Review: Multi-Tenant Datenisolation
**Sprint:** 23 | **Zuständig:** Claude (+ GROK) | **Priorität:** Kritisch

### Claude-Prompt (Isolation Check)
```
Führe einen gründlichen Review der Tenant-Isolations-Middleware durch.
Dateien: `planner-api/src/middleware/tenantScope.ts`, `planner-api/src/services/biService.ts`

Checkliste:
1. Enforce ID: Wird `tenant_id` in JEDER Anfrage (GET/POST/PUT/DELETE) erzwungen?
2. BI Leaks: Liefern die BI-KPI-Endpunkte wirklich nur Daten des aktuellen Mandanten?
3. Join-Attacks: Können cross-tenant Joins via manipulierter IDs provoziert werden?
4. Testing: Gibt es Integrationstests, die versuchen, mit Token A auf Projekt B zuzugreifen?

Antworte mit: Ja/Nein je Check + detaillierte Fehlerfunde.
```

---

## TASK-24-R01 – Review: Webplanner Handover & Datenschutz
**Sprint:** 24 | **Zuständig:** Raptor (+ GPT) | **Priorität:** Soll

### Raptor-Prompt (GDPR/Privacy Audit)
```
Prüfe den Lead-Promotion-Prozess (Webplanner -> Profi) auf Datenschutzkonformität (DSGVO).
Dateien: `planner-api/src/routes/leads.ts`, `planner-frontend/src/webplanner/LeadWizard.tsx`

Prüfe:
1. Consent: Wird das Einverständnis korrekt mit dem Lead-Datensatz gespeichert?
2. Retention: Gibt es eine automatische Löschroutine für nicht-promotete Leads nach X Tagen?
3. Sanatization: Werden Kundendaten vor der Promotion gesäubert (XSS-Schutz im CRM)?
4. Minimalisierung: Werden nur benötigte Felder an das Profi-System übergeben?

Empfehlungen zur Einhaltung der Datenschutzrichtlinien.
```


---

## TASK-25-F01 – Frontend-Upgrade: Herstellerkatalog & Konfigurator (Phase 2 Bridge)
**Sprint:** 25 | **Zuständig:** Antigravity (Claude) | **Priorität:** Hoch | **Status:** Erledigt ✅

### Zusammenfassung
Upgrade des Frontends zur Unterstützung der in Phase 2 eingeführten Herstellerstrukturen.

### Durchgeführte Arbeiten:
1.  **API Integration**: `catalogApi` um Hersteller- und Artikel-Typen sowie entsprechende Fetch-Methoden erweitert.
2.  **LeftSidebar Upgrade**: 
    - Toggle zwischen Standard-Katalog und Hersteller-Katalog hinzugefügt.
    - Hersteller-Auswahl und gefilterte Artikelliste implementiert.
    - Unterstützung für `CatalogArticle` (Phase 2) neben legacy `CatalogItem`.
3.  **RightSidebar / Konfigurator**:
    - `KonfiguratorPanel` erweitert zur Anzeige dynamischer Optionen (`ArticleOption`).
    - Unterstützung für Enum-Optionen (Dropdown) und Text/Dimensions-Optionen direkt im Panel.
    - Zustandsverwaltung für `chosenOptions` im `Editor.tsx` integriert.
4.  **Styling**: Definition moderner UI-Elemente für den Modus-Switch und das Optionen-Raster in Vanilla CSS (CSS Modules).

### Ergebnis
Der Editor ist nun technisch bereit, herstellerspezifische Artikel mit individuellen Optionen (z.B. Fronten, Griffe, Maße) zu verarbeiten und anzuzeigen. Der Build (TSC + Vite) wurde erfolgreich verifiziert.

---

## TASK-26-P01 – Phase-2 P0/P1 Execution Checklist (Bridge zu DoD)
**Sprint:** 26 | **Zuständig:** Core Team (Claude + Codex) | **Priorität:** Kritisch | **Status:** In Arbeit

### Ziel
Die offenen P0/P1-Lücken aus Phase 2 in eine verbindliche, sprintfähige Abarbeitungsreihenfolge überführen.

### Priorisierte Checkliste

- [ ] **TASK-23-S01 (P1 Security):** Tenant-Scoping für `exports.ts` und `imports.ts` vollständig erzwingen.
- [ ] **TASK-22-L01 (P0 Logic):** Kollision über Eck mit World-Polygon + SAT stabil lösen (`COLL-001`).
- [ ] **TASK-20-C01 (P0 Price):** `CatalogArticle`/`article_variant_id` in BOM + Preisfindung > 0 EUR integrieren.
- [ ] **TASK-21-A01 (P1 Auto-Completion):** Deterministischer Rebuild + Preisintegration für `GeneratedItem` absichern.
- [ ] **TASK-20-F01 (P1 Frontend):** Varianten-Selector mit dynamischem Options-Mapping + Preis-Preview finalisieren.

### Definition of Ready (DoR)

- [ ] Testdaten für mindestens einen Hersteller inkl. Varianten-/Preisstruktur sind fixiert.
- [ ] Security-Testfälle (Tenant A/B) sind als reproduzierbare Integrationstests vorbereitet.
- [ ] Entscheidung zur PDF-Darstellung von `is_generated` (Einzelposition vs. Pauschale) ist dokumentiert.

### Definition of Done (DoD)

- [ ] Alle fünf Tasks liefern grüne Unit-/Integrationstests.
- [ ] Keine Cross-Tenant-Lesepfade in Import/Export nachweisbar.
- [ ] BOM für Herstellerartikel enthält valide Preise und korrekte MwSt.
- [ ] Rule-Engine erkennt 90°-Eckkollisionen reproduzierbar.
- [ ] Auto-Completion aktualisiert Langteile ohne verwaiste Altsegmente.

