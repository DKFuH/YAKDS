# REVIEW_EXECUTION_RESULTS_2026-03-01.md

## Ausführungsstatus

Abgearbeitet auf Basis der Vorlagen:

- TASK-3-R01: intern ausgeführt
- TASK-3-R02: intern ausgeführt (code-seitig), API-Route ausstehend
- TASK-5-R01: intern ausgeführt
- TASK-8-R01: intern ausgeführt (algorithmisch), API-Route ausstehend
- TASK-9-R01: intern ausgeführt (algorithmisch), API-Route ausstehend
- TASK-10-R01: intern ausgeführt
- TASK-11-R01: intern ausgeführt (service-seitig), API-Route ausstehend

## Findings (konsolidiert)

### Hoch

1. Keine vollständige Autorisierung in neuer serverseitiger Validierungsroute
   - Datei: `planner-api/src/routes/validate.ts`
   - Risiko: aktuell noch keine Benutzer-/Projektprüfung innerhalb der Route
   - Empfehlung: nach Auth-Stack-Einführung User-zu-Projekt-Check erzwingen

Umgesetzt seit letzter Runde:

- `setEdgeLength`-Guard für `newLengthMm <= 0` ergänzt (`shared-schemas/src/geometry/polygonEditor.ts`)
- serverseitige Basisroute `POST /api/v1/validate` ergänzt (`planner-api/src/routes/validate.ts`, Registration in `planner-api/src/index.ts`)

### Mittel

3. Öffnungskandidaten aus CAD werden nicht gegen Wandlänge normalisiert
   - Datei: `shared-schemas/src/geometry/openingValidator.ts`
   - Risiko: bei fehlerhaften CAD-Koordinaten inkonsistente Gap-Berechnung
   - Empfehlung: Intervalle auf `[0, wallLength_mm]` clampen

4. Offene API-Artefakte für Review-Tasks fehlen
   - fehlende Dateien: `planner-api/src/routes/imports.ts`, `planner-api/src/routes/openings.ts`, `planner-api/src/routes/placements.ts`, `planner-api/src/routes/bom.ts`
   - Risiko: Companion-Reviews nur teilweise möglich, sicherheitskritische Teile nicht prüfbar
   - Empfehlung: Route-Stubs mit Zod-Schemas + TODO-Kommentaren anlegen

5. Height-Checker setzt `labor_surcharge` bei jedem Verstoß pauschal auf `true`
   - Datei: `shared-schemas/src/validation/heightChecker.ts`
   - Risiko: kaufmännische Übermarkierung in Grenzfällen
   - Empfehlung: differenzierte Regel (z. B. erst ab Schwellwert oder Objekttyp)

### Niedrig

6. BOM `surcharge` wird aktuell mit Betrag `0` angelegt
   - Datei: `planner-api/src/services/bomCalculator.ts`
   - Risiko: fachlich unvollständig, aber technisch konsistent
   - Empfehlung: parameterisierbaren Default-Zuschlag einführen

7. Template-/Task-Dateien referenzieren teils (noch) nicht vorhandene Komponenten
   - z. B. `planner-frontend/src/editor/PolygonEditor.tsx`, `planner-frontend/src/editor/PlacementManager.tsx`
   - Risiko: Review-Läufe müssen angepasst werden
   - Empfehlung: bis zur Implementierung mit "Scope-Nicht-Vorhanden" kennzeichnen

## Nächste Umsetzungsschritte (empfohlen)

1. Geometrie-Härtung: `setEdgeLength` Guard + ergänzende Tests
2. Opening-Detection-Härtung: Clamp-Logik + Tests
3. Validierungsroute: Auth/Projektzuordnung ergänzen
4. BOM-Feinschliff: surcharge-Default + Zusatztests
