# SPRINT_17_CODEX.md

## Umfang

Umsetzung der Codex-Aufgabe aus Sprint 17:

- TASK-17-C01 - Block-Bewertungsalgorithmus

## Umgesetzte Dateien

- `planner-api/src/services/blockEvaluator.ts`
- `planner-api/src/services/blockEvaluator.test.ts`
- `planner-api/src/routes/pricing.ts`
- `planner-api/src/routes/pricing.test.ts`

## Ergebnis

Implementiert wurde:

- `evaluateBlock(priceSummary, block)`
- `findBestBlock(priceSummary, blocks)`
- Tier-Auswahl ueber den hoechsten passenden `min_value`
- Basiswert-Berechnung fuer EK-, VK- und Punktebasis
- Preisvorteil als Netto-Vorteil gegenueber der Standardkalkulation
- Kennzeichnung des besten Blocks ueber `recommended: true`

API-Integration:

- `/api/v1/pricing/block-preview`
  - nimmt eine Preiszusammenfassung plus Blockdefinitionen entgegen
  - liefert alle Einzelbewertungen und den empfohlenen Block in einem Response
  - nutzt dieselbe Blocklogik wie die Service-Ebene

## Testabdeckung

- mehrere Blockprogramme mit unterschiedlichen Tiers
- kein passender Tier fuehrt zu 0 Prozent Rabatt
- bester Block wird korrekt identifiziert
- API-Test fuer Block-Preview und Validierungsfehler bei leerer Blockliste

## DoD-Status Sprint 17

- Blockbewertung ist als Service und als Preview-Endpoint verfuegbar
- automatische Bestenauswahl funktioniert deterministisch
- Kernfaelle sind mit Unit- und Route-Tests abgesichert

## Naechster Sprint

Sprint 19:

- Interop-Regressionstests
- Roundtrip zwischen DXF-Export und DXF-Import
- Robustheit fuer Einheiten und unbekannte Entities
