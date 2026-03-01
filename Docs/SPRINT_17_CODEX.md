# SPRINT_17_CODEX.md

## Umfang

Umsetzung der Codex-Aufgabe aus Sprint 17:

- TASK-17-C01 – Block-Bewertungsalgorithmus

## Umgesetzte Dateien

- `planner-api/src/services/blockEvaluator.ts`
- `planner-api/src/services/blockEvaluator.test.ts`

## Ergebnis TASK-17-C01

Implementiert wurde:

- `evaluateBlock(priceSummary, block)`
- `findBestBlock(priceSummary, blocks)`
- Tier-Auswahl über höchsten passenden `min_value`
- Basiswert-Berechnung für EK-, VK- und Punktebasis
- Preisvorteil als Netto-Vorteil gegenüber der Standardkalkulation
- Kennzeichnung des besten Blocks über `recommended: true`

Tests abgedeckt:

- mehrere Blockprogramme mit unterschiedlichen Tiers
- kein passender Tier → 0 % Rabatt
- bester Block wird korrekt identifiziert

## DoD-Status Sprint 17

- Blockbewertung ist als isolierte Service-Logik verfügbar
- automatische Bestenauswahl funktioniert deterministisch
- Kernfälle sind mit Unit-Tests abgesichert

## Nächster Sprint

Sprint 19:

- Interop-Regressionstests
- Roundtrip zwischen DXF-Export und DXF-Import
- Robustheit für Einheiten und unbekannte Entities
