# SPRINT_07_CODEX.md

## Umfang

Umsetzung Sprint 7 (Katalog MVP mit kaufmännischen Stammdaten):

- Katalog-API für auswählbare Objekte
- Preisbasisfelder aus dem Datenmodell nutzbar machen
- SKP-Mapping-Endpunkt für Sprint 7.5 vorbereiten

## Umgesetzte Dateien

- `planner-api/src/routes/catalog.ts`
- `planner-api/src/index.ts`

## Ergebnis Sprint 7

Implementiert wurde:

- `GET /api/v1/catalog/items`
  - optionale Filter: `type`, `q`, `limit`, `offset`
  - liefert die Sprint-7-relevanten Preis-/Stammdatenfelder
- `GET /api/v1/catalog/items/:id`
  - Einzelobjekt inkl. Zeitstempel
- `POST /api/v1/catalog/skp-mapping`
  - bewusst als vorbereiteter Stub (`501`) für Sprint 7.5

Bereitgestellte kaufmännische Kernfelder pro Katalogobjekt:

- `list_price_net`
- `dealer_price_net`
- `default_markup_pct`
- `tax_group_id`
- `pricing_group_id`

## DoD-Status Sprint 7

- Katalogobjekte sind per API auswählbar: **erfüllt**
- Objekte tragen Preisbasis: **erfüllt**
- SKP-Mapping-Endpunkt vorbereitet: **erfüllt (Stub für 7.5)**

## Verifikation

- Type-/Problemanalyse für geänderte Dateien: ohne Befund
- Regression (preisnah):
  - `planner-api/src/services/priceCalculator.test.ts` ✅
  - `planner-api/src/services/bomCalculator.test.ts` ✅

## Nächster Sprint

Sprint 13:

- Angebots-/Quote-Flows End-to-End anbinden
- API- und UI-Integration auf Basis der Preis- und BOM-Daten
