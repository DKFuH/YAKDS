# SPRINT_19_CODEX.md

## Umfang

Umsetzung Sprint 19 fuer Interop-Haertung und Regressionen:

- DXF Import-/Export-Regressionen
- Einheiten-/Skalierungspruefung im Parser
- Layer-Konventionen zentralisiert
- CAD-Interop-Doku auf realen Stand gezogen

## Umgesetzte Dateien

- `interop-cad/dxf-import/src/dxfParser.ts`
- `interop-cad/dxf-import/src/dxfParser.test.ts`
- `interop-cad/dxf-export/src/dxfExporter.ts`
- `interop-cad/dxf-export/src/dxfExporter.test.ts`
- `tests/integration/cadRoundtrip.test.ts`
- `Docs/CAD_INTEROP.md`

## Ergebnis

Implementiert wurde:

- zentrale DXF-Exportlayer als Code-Konstanten:
  - `OKP_ROOM`
  - `OKP_WALLS`
  - `OKP_OPENINGS`
  - `OKP_FURNITURE`

- Unit-/Scale-Review im DXF-Parser:
  - fehlendes `$INSUNITS` erzeugt `needs_review`
  - unbekannter `INSUNITS`-Code erzeugt `needs_review`
  - bekannte Nicht-mm-Einheiten werden explizit als nach mm normalisiert protokolliert

- Regressionen:
  - Exportlayer werden ueber dieselben Konstanten in Export- und Integrationstests abgesichert
  - Roundtrip-Test deckt fehlende Units jetzt ebenfalls ab
  - Parser-Test deckt Unit-Review und Unsupported-Entity-Mix ab

- Dokumentation:
  - `CAD_INTEROP.md` beschreibt jetzt den realen API- und MVP-Stand statt der urspruenglichen Planannahmen

## DoD-Status Sprint 19

- Import-/Export-Regressionstests orchestriert: **erfuellt**
- Einheiten-/Skalierungspruefung implementiert: **erfuellt**
- Layer-Konventionen dokumentiert: **erfuellt**
- Basis-Roundtrip DXF: **erfuellt**
- nativer DWG-Roundtrip: **noch nicht erfuellt**

## Verifikation

- `npm test -- --run interop-cad/dxf-import/src/dxfParser.test.ts interop-cad/dxf-export/src/dxfExporter.test.ts tests/integration/cadRoundtrip.test.ts`
- `npx tsc -p interop-cad/dxf-import/tsconfig.json`
- `npx tsc -p interop-cad/dxf-export/tsconfig.json`

## Hinweise

- Der Sprint haertet den DXF-Pfad produktiv ab. DWG bleibt weiterhin ein Review-/Staging-Pfad ohne nativen Binary-Parser.
- Die neue Scale-Pruefung blockiert keine Importe, markiert aber riskante Dateien explizit fuer manuelle Nacharbeit.

## Naechster Fokus

- Git-Sync / selektiver Commit der Backend- und Interop-Aenderungen
- optionaler UI-Anschluss fuer Layer-/Mapping-Review
