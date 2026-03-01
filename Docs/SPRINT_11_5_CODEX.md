# SPRINT_11_5_CODEX.md

## Umfang

Umsetzung der Codex-Aufgabe aus Sprint 11.5:

- TASK-11-C02 – DXF-Schreib-Logik (Export)

## Umgesetzte Dateien

- `interop-cad/dxf-export/src/dxfExporter.ts`
- `interop-cad/dxf-export/src/dxfExporter.test.ts`

## Ergebnis TASK-11-C02

Implementiert wurde:

- `exportToDxf(payload)`
- Exportlayer `YAKDS_ROOM`, `YAKDS_WALLS`, `YAKDS_OPENINGS`, `YAKDS_FURNITURE`
- Raumkontur als geschlossene Polylinie
- Wände und Öffnungen als Liniensegmente
- Möbelkonturen als Rechtecke
- Einheit mm mit `$INSUNITS = 4`

Tests abgedeckt:

- alle Layernamen erscheinen im Export
- DXF-Header enthält mm-Einheiten
- Möbelgeometrie wird optional ausgelassen

## DoD-Status Sprint 11.5

- DXF-Export für den MVP-Interop-Pfad ist vorhanden
- Layer-Konventionen aus `CAD_INTEROP.md` sind umgesetzt
- Export ist testbar und roundtrip-fähig vorbereitet

## Nächster Sprint

Sprint 12:

- 9-stufige Preisberechnung
- globale Rabatte, Zusatzkosten und MwSt
- kaufmännische Rundung und Preiszusammenfassung
