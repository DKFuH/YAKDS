# SPRINT_03_5_CODEX.md

## Umfang

Umsetzung der Codex-Aufgabe aus Sprint 3.5:

- TASK-3-C03 – DXF-Import-Parser

## Umgesetzte Dateien

- `interop-cad/dxf-import/src/dxfParser.ts`
- `interop-cad/dxf-import/src/dxfParser.test.ts`

## Ergebnis TASK-3-C03

Implementiert wurde:

- `parseDxf(dxfString, sourceFilename)`
- Lesen von Layern, Basis-Entities und DXF-Header-Units
- Mapping für `LINE`, `LWPOLYLINE`, `POLYLINE`, `ARC`, `CIRCLE`, `TEXT`, `MTEXT`, `INSERT`
- Normalisierung auf Millimeter anhand von `$INSUNITS`
- Bounding-Box-Berechnung über importierte Geometrie
- Import-Protokoll mit `imported`, `ignored`, `needs_review`
- Ignorieren von 3D-Geometrie mit positiver z-Koordinate

Tests abgedeckt:

- minimales DXF mit einer `LINE`
- unbekannte Entity wird im Protokoll ignoriert
- `INSUNITS=1` (Inch) wird korrekt nach mm umgerechnet

## DoD-Status Sprint 3.5

- DXF-Import für 2D-MVP-Geometrie vorhanden
- neutrales `ImportAsset`-Format wird erzeugt
- Einheiten und Protokollierung sind testbar abgesichert

## Nächster Sprint

Sprint 4 (TASK-4-C01):

- Vertex-Verschiebung
- numerische Kantenlängenanpassung
- CAD-Polyline → RoomBoundary
