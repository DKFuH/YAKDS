# SPRINT_10_CODEX.md

## Umfang

Umsetzung der Codex-Aufgabe aus Sprint 10:

- TASK-10-C01 - Hoehenpruefung gegen Dachschraegen

## Umgesetzte Dateien

- `shared-schemas/src/validation/heightChecker.ts`
- `shared-schemas/src/validation/heightChecker.test.ts`
- `planner-api/src/routes/validate.ts`
- `planner-api/src/routes/validate.test.ts`

## Ergebnis

Implementierte Funktionen:

- `checkObjectHeight(obj, constraints, nominalCeilingMm)`
  - nutzt `getAvailableHeight` aus `ceilingHeight.ts`
  - erzeugt eine Violation bei Hoehenueberschreitung
  - Codes:
    - `HEIGHT_EXCEEDED` fuer hohe Objekte
    - `HANGING_CABINET_SLOPE_COLLISION` fuer Haengeschraenke
  - setzt Flags fuer Anpassung, Niedrigvariante und Montagezuschlag

- `checkAllObjects(objects, constraints, nominalCeilingMm)`
  - wertet mehrere Objekte gesammelt aus
  - gibt nur echte Violations zurueck

API-Integration:

- `/api/v1/validate`
  - akzeptiert zusaetzlich `ceilingConstraints` und `nominalCeilingMm`
  - kombiniert Sprint-9-Kollisionspruefungen mit Sprint-10-Hoehenpruefung
  - gibt Hoehenverletzungen inklusive Flags im bestehenden Validierungsformat zurueck

## Testabdeckung

- Objekt passt unter die verfuegbare Hoehe
- Kollision fuer Haengeschranktyp
- Flag-Setzung bei Ueberschreitung
- Sammelpruefung mehrerer Objekte
- API-Test fuer Dachschraegen im Validate-Endpoint

## DoD-Status Sprint 10

- Dachschraegen beeinflussen jetzt sowohl die Fachlogik als auch die API-Validierung
- Folgeflags fuer Anpassung und Zuschlag werden bis in den API-Response durchgereicht

## Naechster Sprint

Sprint 11 (TASK-11-C01):

- BOM-Berechnung
- Summenfunktion
- Unit-Tests
- Sprint-Dokumentation
