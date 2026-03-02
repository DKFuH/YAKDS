# SPRINT_11_5_CODEX.md

## Umfang

Umsetzung der Codex-Aufgabe aus Sprint 11.5:

- TASK-11-C02 - DXF-Schreib-Logik
- API-Anbindung fuer DXF-Export
- DWG-Export-API als expliziter Staging-/Fallback-Pfad

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
- Exportlayer `OKP_ROOM`, `OKP_WALLS`, `OKP_OPENINGS`, `OKP_FURNITURE`
- Raumkontur als geschlossene Polylinie
- Waende und Oeffnungen als Liniensegmente
- Moebelkonturen als Rechtecke
- Einheit mm mit `$INSUNITS = 4`

API-Integration:

- produktiv:
  - `/api/v1/exports/dxf`
  - `/api/v1/projects/:projectId/export-dxf`

- expliziter DWG-Staging-Pfad:
  - `/api/v1/exports/dwg`
  - `/api/v1/projects/:projectId/export-dwg`
  - liefert standardmaessig `501 DWG_EXPORT_NOT_AVAILABLE`
  - kann mit `allow_dxf_fallback=true` kontrolliert auf einen DXF-Download zurueckfallen

Damit ist die API-Oberflaeche fuer beide Exportpfade vorhanden, ohne falsche native DWG-Dateien auszugeben.

## Testabdeckung

- alle Layernamen erscheinen im Export
- DXF-Header enthaelt mm-Einheiten
- Moebelgeometrie wird optional ausgelassen
- API-Test fuer erfolgreichen DXF-Export und Validierungsfehler
- API-Test fuer DWG-Staging-Fehler
- API-Test fuer kontrollierten DWG->DXF-Fallback

## DoD-Status Sprint 11.5

- DXF-Export fuer den MVP-Interop-Pfad ist als Modul und API-Route verfuegbar
- Layer-Konventionen aus `CAD_INTEROP.md` sind umgesetzt
- Export ist testbar und roundtrip-faehig vorbereitet
- DWG-API ist vorhanden, aber weiterhin nur als Staging-/Fallback-Pfad

## Hinweise

- Nativer DWG-Schreibpfad ist weiterhin offen. Der aktuelle Endpunkt ist absichtlich ehrlich und faellt nur kontrolliert auf DXF zurueck.

## Naechster Sprint

Sprint 12:

- 9-stufige Preisberechnung
- globale Rabatte, Zusatzkosten und MwSt
- kaufmaennische Rundung und Preiszusammenfassung
