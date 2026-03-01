# SPRINT_11_CODEX.md

## Umfang

Umsetzung der Codex-Aufgabe aus Sprint 11:

- TASK-11-C01 - BOM-Berechnungslogik

## Umgesetzte Dateien

- `planner-api/src/services/bomCalculator.ts`
- `planner-api/src/services/bomCalculator.test.ts`
- `planner-api/src/routes/bom.ts`
- `planner-api/src/routes/bom.test.ts`

## Ergebnis

Implementierte Funktionen:

- `calculateBOM(project, options)`
  - erzeugt BOM-Zeilen fuer:
    - `cabinet`
    - `appliance`
    - `accessory` (falls vorhanden)
    - `surcharge` bei `special_trim_needed`
    - `assembly` bei `labor_surcharge`
    - `freight` pauschal (immer 1x)
  - uebernimmt Preisbasis aus `priceListItems`
  - uebertraegt `variant_surcharge` und `object_surcharges` aus Flags
  - berechnet `line_net_after_discounts` aus Positions- und Gruppenrabatt
  - unterstuetzt konfigurierbaren Default fuer Sonderblenden-Zuschlag

- `sumBOMLines(lines)`
  - summiert Listenpreis-basierten Nettowert
  - summiert Nettowert nach Rabatten

- BOM-Preview-API
  - `POST /api/v1/bom/preview`
  - `POST /api/v1/projects/:projectId/calculate-bom`
  - nimmt einen inline `ProjectSnapshot` an
  - liefert `lines` und `totals` direkt aus dem Service zurueck

## Testabdeckung

- leeres Projekt -> nur Frachtzeile
- 3 Unterschraenke + 1 Geraet -> korrekte Hauptzeilentypen
- `special_trim_needed` -> zusaetzliche Zuschlagszeile
- konfigurierbarer Sonderblenden-Zuschlag
- Summenfunktion geprueft
- BOM-Preview-Route mit gueltigem Snapshot
- BOM-Preview-Route validiert fehlerhafte Payloads

## DoD-Status Sprint 11

- Stuecklisten-Engine v1 als isoliertes Service-Modul vorhanden
- kaufmaennische Basisfelder fuer nachgelagerte Preisengine nutzbar
- BOM ist ueber eine Preview-API direkt konsumierbar

## Naechster Schritt

Sprint 12:

- Preisberechnung auf BOM-Basis
- Rabatte, Zusatzkosten und MwSt
- Preview-API fuer Pricing
