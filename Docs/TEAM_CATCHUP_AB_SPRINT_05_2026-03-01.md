# TEAM_CATCHUP_AB_SPRINT_05_2026-03-01

## Ziel

Die zwei nachlaufenden Streams (aktuell Sprint 05) sollen auf den aktuellen Stand Sprint 15 nachziehen, ohne Doppelarbeit und ohne Konflikt-Chaos.

## Zielstand (bereits im Repo)

Abgeschlossen und dokumentiert:

- Sprint 06
- Sprint 07
- Sprint 08
- Sprint 09
- Sprint 10
- Sprint 11
- Sprint 12
- Sprint 13
- Sprint 14
- Sprint 15

Zusatzsprints mit vorhandener Doku:

- Sprint 02, 03, 03.5, 04, 05, 07.5, 11.5, 17, 19

## Pflicht-Lesereihenfolge für Nachzieh-Team

1. `Docs/SPRINT_06_CODEX.md`
2. `Docs/SPRINT_07_CODEX.md`
3. `Docs/SPRINT_08_CODEX.md`
4. `Docs/SPRINT_09_CODEX.md`
5. `Docs/SPRINT_10_CODEX.md`
6. `Docs/SPRINT_11_CODEX.md`
7. `Docs/SPRINT_12_CODEX.md`
8. `Docs/SPRINT_13_CODEX.md`
9. `Docs/SPRINT_14_CODEX.md`
10. `Docs/SPRINT_15_CODEX.md`

## Nachzieh-Checkliste (pro Person)

- Branch auf aktuellen Hauptstand rebasen/mergen.
- Lokale Änderungen gegen die oben genannten Sprint-Docs prüfen.
- Keine bereits umgesetzten Features erneut implementieren.
- Offene persönliche Arbeiten nur auf Sprint 16+ fokussieren.

## Technische Verifikation nach Sync

Backend/API-Regressionsblock:

`npm test -- planner-api/src/routes/renderJobs.test.ts planner-api/src/routes/quotes.test.ts planner-api/src/routes/bom.test.ts planner-api/src/routes/pricing.test.ts planner-api/src/services/bomCalculator.test.ts planner-api/src/services/priceCalculator.test.ts`

Frontend-Build + Tests:

`npm --prefix planner-frontend run build`

`npm --prefix planner-frontend test`

Shared-Schemas-Regression:

`npm test -- shared-schemas/src/geometry/validatePolygon.test.ts planner-frontend/src/editor/snapUtils.test.ts shared-schemas/src/geometry/polygonEditor.test.ts shared-schemas/src/geometry/openingValidator.test.ts shared-schemas/src/geometry/ceilingHeight.test.ts shared-schemas/src/geometry/wallPlacement.test.ts shared-schemas/src/validation/collisionDetector.test.ts shared-schemas/src/validation/heightChecker.test.ts planner-api/src/services/bomCalculator.test.ts`

## Ready-Definition für "nachgezogen"

Eine Person gilt als nachgezogen, wenn:

- alle 10 Sprint-Dokus (06–15) gelesen und abgeglichen sind,
- keine Duplikat-Implementierungen offen sind,
- alle drei Test-/Build-Blöcke lokal grün laufen,
- der Fokus auf Sprint 16 verschoben ist.

## Nachrichtenvorlage an die zwei Nachzügler

"Bitte auf Sprint-Stand 15 nachziehen. Reihenfolge: Sprint-Dokus 06 bis 15 lesen/abgleichen, dann die drei Standard-Checks laufen lassen (API-Regression, Frontend-Build+Tests, Shared-Regression). Wenn alles grün ist, kurze Rückmeldung mit Status 'Sprint 15 synced' und nur noch Sprint-16-Tasks annehmen."
