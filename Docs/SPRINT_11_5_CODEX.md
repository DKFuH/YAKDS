# SPRINT_11_5_CODEX.md

## Umfang

Umsetzung der Codex-Aufgabe aus Sprint 11.5:

- TASK-11-C02 - DXF-Schreib-Logik (Export)

## Umgesetzte Dateien

- `interop-cad/dxf-export/src/dxfExporter.ts`
- `interop-cad/dxf-export/src/dxfExporter.test.ts`
- `interop-cad/dxf-export/src/index.ts`
- `interop-cad/dxf-export/package.json`
- `interop-cad/dxf-export/tsconfig.json`
- `planner-api/src/routes/exports.ts`
- `planner-api/src/routes/exports.test.ts`
- `planner-api/src/index.ts`

## Ergebnis

Implementiert wurde:

- `exportToDxf(payload)`
- Exportlayer `YAKDS_ROOM`, `YAKDS_WALLS`, `YAKDS_OPENINGS`, `YAKDS_FURNITURE`
- Raumkontur als geschlossene Polylinie
- Waende und Oeffnungen als Liniensegmente
- Moebelkonturen als Rechtecke
- Einheit mm mit `$INSUNITS = 4`

API-Integration:

- `/api/v1/exports/dxf`
- `/api/v1/projects/:projectId/export-dxf`
  - nehmen einen Export-Payload plus optionalen Dateinamen entgegen
  - liefern den DXF-Inhalt direkt als `application/dxf`-Attachment zurueck

## Testabdeckung

- alle Layernamen erscheinen im Export
- DXF-Header enthaelt mm-Einheiten
- Moebelgeometrie wird optional ausgelassen
- API-Test fuer erfolgreichen DXF-Export und Validierungsfehler

## DoD-Status Sprint 11.5

- DXF-Export fuer den MVP-Interop-Pfad ist als Modul und API-Route verfuegbar
- Layer-Konventionen aus `CAD_INTEROP.md` sind umgesetzt
- Export ist testbar und roundtrip-faehig vorbereitet

## Naechster Sprint

Sprint 12:

- 9-stufige Preisberechnung
- globale Rabatte, Zusatzkosten und MwSt
- kaufmaennische Rundung und Preiszusammenfassung
