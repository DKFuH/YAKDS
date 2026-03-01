# SPRINT_12_CODEX.md

## Umfang

Umsetzung der Codex-Aufgabe aus Sprint 12:

- TASK-12-C01 - Preisregel-Berechnungen

## Umgesetzte Dateien

- `planner-api/src/services/priceCalculator.ts`
- `planner-api/src/services/priceCalculator.test.ts`
- `planner-api/src/routes/pricing.ts`
- `planner-api/src/routes/pricing.test.ts`

## Ergebnis TASK-12-C01

Implementiert wurde:

- `applyDiscount(value, pct)`
- `calcLineNet(line)`
- `calculatePriceSummary(lines, settings)`
- `POST /api/v1/pricing/preview`
- `POST /api/v1/projects/:projectId/calculate-pricing`
- 9-stufige Preislogik ohne Zwischenrundung
- Verteilung von Rabatten, Zusatzkosten und MwSt auf Projektebene
- `PriceComponent[]` fuer die einzelnen Rechenschritte
- Berechnung von Deckungsbeitrag und Aufschlag

## Tests abgedeckt

- kein Rabatt -> Brutto = Netto x 1.19
- 100-%-Globalrabatt bei verbleibender Fracht und MwSt
- mehrere Steuergruppen
- Endrundung auf 2 Nachkommastellen
- Pricing-Preview-Route mit gueltigen BOM-Daten
- Pricing-Preview-Route validiert fehlerhafte Payloads

## DoD-Status Sprint 12

- Preisengine ist als pure Funktionslogik vorhanden
- kaufmaennische Summenberechnung ist deterministisch
- Grenzfaelle fuer Rabatte und Rundung sind per Unit-Test abgesichert
- Pricing ist ueber eine Preview-API direkt konsumierbar

## Naechster Sprint

Sprint 17:

- Blockverrechnung bewerten
- beste Blockdefinition automatisch auswaehlen
- Preisvorteil gegen Standardkalkulation ausgeben
