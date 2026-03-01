# SPRINT_12_CODEX.md

## Umfang

Umsetzung der Codex-Aufgabe aus Sprint 12:

- TASK-12-C01 – Preisregel-Berechnungen

## Umgesetzte Dateien

- `planner-api/src/services/priceCalculator.ts`
- `planner-api/src/services/priceCalculator.test.ts`

## Ergebnis TASK-12-C01

Implementiert wurde:

- `applyDiscount(value, pct)`
- `calcLineNet(line)`
- `calculatePriceSummary(lines, settings)`
- 9-stufige Preislogik ohne Zwischenrundung
- Verteilung von Rabatten, Zusatzkosten und MwSt auf Projektebene
- `PriceComponent[]` für die einzelnen Rechenschritte
- Berechnung von Deckungsbeitrag und Aufschlag

Tests abgedeckt:

- kein Rabatt → Brutto = Netto × 1,19
- 100-%-Globalrabatt bei verbleibender Fracht und MwSt
- mehrere Steuergruppen
- Endrundung auf 2 Nachkommastellen

## DoD-Status Sprint 12

- Preisengine ist als pure Funktionslogik vorhanden
- kaufmännische Summenberechnung ist deterministisch
- Grenzfälle für Rabatte und Rundung sind per Unit-Test abgesichert

## Nächster Sprint

Sprint 17:

- Blockverrechnung bewerten
- beste Blockdefinition automatisch auswählen
- Preisvorteil gegen Standardkalkulation ausgeben
