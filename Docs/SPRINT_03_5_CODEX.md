# SPRINT_03_5_CODEX.md

## Umfang

Umsetzung der Codex-Aufgabe aus Sprint 3.5:

- TASK-3-C03 - DXF-Import-Parser

## Umgesetzte Dateien

- `interop-cad/dxf-import/src/dxfParser.ts`
- `interop-cad/dxf-import/src/dxfParser.test.ts`
- `interop-cad/dxf-import/src/index.ts`
- `interop-cad/dxf-import/package.json`
- `interop-cad/dxf-import/tsconfig.json`
- `planner-api/src/routes/imports.ts`
- `planner-api/src/routes/imports.test.ts`

## Ergebnis

Implementiert wurde:

- `parseDxf(dxfString, sourceFilename)`
- Lesen von Layern, Basis-Entities und DXF-Header-Units
- Mapping fuer `LINE`, `LWPOLYLINE`, `POLYLINE`, `ARC`, `CIRCLE`, `TEXT`, `MTEXT`, `INSERT`
- Normalisierung auf Millimeter anhand von `$INSUNITS`
- Bounding-Box-Berechnung ueber importierte Geometrie
- Import-Protokoll mit `imported`, `ignored`, `needs_review`
- Ignorieren von 3D-Geometrie mit positiver z-Koordinate

API-Integration:

- `/api/v1/imports/preview/dxf`
  - nimmt DXF-Text plus Dateiname entgegen
  - liefert direkt das neutrale `ImportAsset` fuer Preview- und Mapping-Flows zurueck

## Testabdeckung

- minimales DXF mit einer `LINE`
- unbekannte Entity wird im Protokoll ignoriert
- `INSUNITS=1` (Inch) wird korrekt nach mm umgerechnet
- API-Test fuer DXF-Preview-Import

## DoD-Status Sprint 3.5

- DXF-Import fuer 2D-MVP-Geometrie ist als Modul und API-Preview verfuegbar
- neutrales `ImportAsset`-Format wird erzeugt
- Einheiten und Protokollierung sind testbar abgesichert

## Naechster Sprint

Sprint 4 (TASK-4-C01):

- Vertex-Verschiebung
- numerische Kantenlaengenanpassung
- CAD-Polyline zu RoomBoundary
