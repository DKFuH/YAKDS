# IMPLEMENTATION_TODO_FROM_REVIEWS_2026-03-01.md

## Blocker

- [x] `shared-schemas/src/geometry/polygonEditor.ts`
  - `setEdgeLength`: `newLengthMm <= 0` absichern
  - Tests ergänzen: `0`, negative Werte

- [x] `planner-api/src/routes/validate.ts` neu anlegen
  - Request-Zod-Schema (Objektzahllimit)
  - Projekt-Autorisierung vorbereiten (Folgeschritt offen)
  - Kollisionserkennung serverseitig triggern

## Should-Fix

- [x] `planner-api/src/routes/validate.ts`
  - Benutzer-/Projekt-Autorisierung ergänzen

- [x] `shared-schemas/src/geometry/openingValidator.ts`
  - CAD-Intervalle auf Wandgrenzen clampen
  - Tests mit out-of-range Geometrie ergänzen

- [x] `shared-schemas/src/validation/heightChecker.ts`
  - `labor_surcharge` differenzierter setzen
  - Tests für Grenzschwellen ergänzen

- [x] API-Routen-Stubs anlegen:
  - `planner-api/src/routes/imports.ts`
  - `planner-api/src/routes/openings.ts`
  - `planner-api/src/routes/placements.ts`
  - `planner-api/src/routes/bom.ts`

## Nice-to-Have

- [x] `planner-api/src/services/bomCalculator.ts`
  - parametrisierbaren surcharge-Default ergänzen
  - Test für surcharge-Betragslogik ergänzen
