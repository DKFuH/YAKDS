# Sprint 117 - CAD-Interop Provider-Schnitt (Phase 1)

**Branch:** `feature/sprint-117-cad-provider-phase1`
**Gruppe:** B
**Status:** `planned`
**Abhaengigkeiten:** S52, S53, S80

## Ziel

Die bestehende CAD-Interop wird aus punktuellen Formatpfaden in eine erste gemeinsame Provider-Schnitt ueberfuehrt, ohne das Produkt per Big-Bang umzubauen.

Der Sprint schafft den Architektur-Schnitt fuer:
- `DXF`
- `DWG`
- `SKP`
- `IFC`

Kernziel ist nicht die Einfuehrung nativer proprietaerer SDKs, sondern die Entkopplung der heutigen Import-/Export- und Review-Workflows von format-spezifischer Direktlogik.

## Problem

Aktuell ist die CAD-Interop funktional, aber technisch verteilt:
- `imports.ts` enthaelt Formatlogik fuer `dxf`, `dwg`, `skp`
- `exports.ts` und `cadInterop.ts` enthalten teilweise ueberlappende Exportpfade
- `IFC` ist separat verdrahtet
- Frontend und Backend kennen teils direkte Endpunkte statt einheitlicher Capabilities

Risiko bei weiterem Wachstum:
- neue Formate wie `STEP`, `STL`, `IGES` verstaerken die Verteilung
- Review-/Asset-/Export-Vertraege driften auseinander
- UI und API muessen pro Format einzeln angepasst werden

## Scope

In Scope:

- ein gemeinsames Backend-Provider-Interface fuer CAD-/BIM-Import und Export
- Registrierung vorhandener Provider fuer `DXF`, `DWG`, `SKP`, `IFC`
- Vereinheitlichung der Format-Capabilities
- Vereinheitlichung der Rueckgabeformen fuer Import- und Export-Jobs
- Migration der bestehenden Routen auf den Provider-Layer, ohne die oeffentlichen Endpunkte zu brechen
- dokumentierte Kennzeichnung von `native`, `fallback`, `review_required`, `script_export`

Nicht in Scope:

- native `DWG`-Binary-Implementierung via `RealDWG` oder `ODA`
- native `SKP`-Binary-Implementierung via SketchUp C API
- Einfuehrung von `STEP`, `STL` oder `IGES`
- kompletter Plugin-Umbau des gesamten Systems
- Frontend-Komplettumbau aller Export- und Importseiten

## Zielbild

Es gibt eine schmale Domänen-Schnitt fuer Interop-Provider:

- `importPreview`
- `importExecute`
- `exportArtifact`
- `getCapabilities`

Die bestehenden API-Routen bleiben erhalten, delegieren aber intern nicht mehr direkt an Formatcode, sondern an einen Registry-/Provider-Layer.

Dadurch kann das System spaeter neue Formate aufnehmen, ohne erneut Routen, Review-Logik und UI-Vertraege duplizieren zu muessen.

## Zielarchitektur

Neue Backend-Bausteine in `planner-api`:

- `src/services/interop/providers/types.ts`
- `src/services/interop/providers/registry.ts`
- `src/services/interop/providers/dxfProvider.ts`
- `src/services/interop/providers/dwgProvider.ts`
- `src/services/interop/providers/skpProvider.ts`
- `src/services/interop/providers/ifcProvider.ts`

Vorgeschlagene Kern-Typen:

```ts
export type InteropFormat = 'dxf' | 'dwg' | 'skp' | 'ifc'

export type InteropCapability = {
  format: InteropFormat
  import_preview: boolean
  import_execute: boolean
  export_artifact: boolean
  native_read: boolean
  native_write: boolean
  review_required_by_default: boolean
  artifact_kind: 'cad' | 'bim' | 'script'
}

export type InteropImportRequest = {
  projectId: string
  filename: string
  payload: Buffer | string
  mode: 'preview' | 'execute'
  mapping?: Record<string, unknown>
}

export type InteropImportResult = {
  format: InteropFormat
  status: 'done' | 'needs_review' | 'failed'
  import_asset: Record<string, unknown> | null
  protocol: Array<{ entity_id: string | null; status: 'imported' | 'ignored' | 'needs_review'; reason: string }>
  warnings: string[]
}

export type InteropExportRequest = {
  projectId: string
  filename?: string
  payload: Record<string, unknown>
}

export type InteropExportArtifact = {
  format: InteropFormat
  content_type: string
  filename: string
  body: Buffer | string
  native: boolean
  fallback_of?: InteropFormat
  note?: string
}

export interface InteropProvider {
  readonly format: InteropFormat
  getCapabilities(): InteropCapability
  importPreview?(request: InteropImportRequest): Promise<InteropImportResult>
  importExecute(request: InteropImportRequest): Promise<InteropImportResult>
  exportArtifact?(request: InteropExportRequest): Promise<InteropExportArtifact>
}
```

## Ausfuehrung

### Phase 1 - Provider-Grundgeruest

- neue Typen und Registry anlegen
- Lookup per `format`
- Fehlerfall standardisieren: unbekanntes Format, nicht unterstuetzte Operation, leere Payload

### Phase 2 - Bestehende Implementierungen kapseln

- `DXF`-Import/Export in `dxfProvider`
- `DWG`-Import auf Basis `parseDwgBuffer` in `dwgProvider`
- `DWG`-Export auf Basis `buildDwgBuffer` als `fallback_of: 'dwg'` markieren
- `SKP`-Import auf Basis `parseSkp` in `skpProvider`
- `SKP`-Export auf Basis `buildSkpRubyScript` als `artifact_kind: script` markieren
- `IFC`-Import in `ifcProvider`

### Phase 3 - Routen umstellen

- `imports.ts` delegiert fuer `dxf`, `dwg`, `skp` an Provider
- `ifcInterop.ts` nutzt denselben Provider-Vertrag fuer Importausfuehrung
- `exports.ts` delegiert `dxf`, `dwg`, `skp`
- bestehende Route-Pfade und Response-Felder bleiben kompatibel

### Phase 4 - Capabilities sichtbar machen

- neuer API-Endpunkt:
  - `GET /api/v1/interop/capabilities`
- Rueckgabe je Format:
  - Import Preview moeglich
  - Import Execute moeglich
  - Export moeglich
  - native/fallback/script

### Phase 5 - Frontend-Anschluss

- `planner-frontend/src/api/imports.ts` liest Capability-Infos optional ein
- `planner-frontend/src/api/cadInterop.ts` nutzt Capabilities fuer Label und Hinweise
- Export-/Import-UI zeigt klar:
  - `DWG Export (DXF-kompatibel)`
  - `SKP Export (Ruby-Skript)`
  - `IFC Import`

## Konkrete Arbeitspakete

### Backend

1. `types.ts` und `registry.ts` erstellen
2. Provider fuer `dxf`, `dwg`, `skp`, `ifc` anlegen
3. Mapping-Helfer fuer gemeinsame `protocol`- und `import_asset`-Form erzeugen
4. `imports.ts` auf Provider delegieren
5. `exports.ts` auf Provider delegieren
6. `cadInterop.ts` nur dort behalten, wo alternative-spezifische Exporte benoetigt werden
7. neuen Capabilities-Endpunkt implementieren

### Frontend

1. kleine Capability-API anlegen
2. Ribbon-/Import-/Export-Texte schaerfen
3. UI-Hinweise fuer `fallback` und `script_export`
4. bestehende Flows nicht brechen

### Tests

1. Unit-Tests fuer Registry und Provider-Capabilities
2. Route-Tests fuer Import/Export ueber Provider
3. Regression-Tests fuer bestehende Pfade:
   - `POST /imports/cad`
   - `POST /imports/skp`
   - `POST /projects/:id/import/ifc`
   - `POST /exports/dxf`
   - `POST /exports/dwg`
   - `POST /exports/skp`
4. Frontend-Tests fuer Capability-Hinweise, soweit vorhanden

## Akzeptanzkriterien

- alle bestehenden oeffentlichen Interop-Endpunkte funktionieren weiter
- Formatlogik sitzt nicht mehr in mehreren Routen verteilt, sondern primär in Providern
- `DWG` ist im System eindeutig als `fallback export` markiert
- `SKP` ist im System eindeutig als `script export` markiert
- `IFC` bleibt echter Importpfad
- Capability-Endpunkt ist vorhanden und dokumentiert
- bestehende Tests bleiben gruen, neue Provider-Tests sind vorhanden

## Deliverables

- Provider-Typen und Registry
- vier konkrete Provider fuer `DXF`, `DWG`, `SKP`, `IFC`
- refaktorierte Import-/Export-Routen
- neuer Capability-Endpunkt
- angepasste UI-Texte fuer Interop-Hinweise
- aktualisierte Testabdeckung

## Risiken

- ueberambitionierte Migration auf einen Schlag
- unbeabsichtigter Bruch bestehender Response-Formate
- Route-Duplikate zwischen `exports.ts` und `cadInterop.ts`
- Verwechslung zwischen `funktional` und `nativ`

## Entscheidungsregeln

- keine nativen proprietaeren SDKs in diesem Sprint
- keine API-Breaks fuer bestehende Route-Pfade
- Fallbacks muessen technisch funktionieren und fachlich klar benannt sein
- lieber schmale erste Entkopplung als halber Big-Bang

## DoD

- Provider-Layer ist produktiv im API-Pfad aktiv
- `imports.ts` und `exports.ts` delegieren ueber Registry
- `DWG`, `DXF`, `SKP`, `IFC` sind als Capabilities abrufbar
- Route- und Provider-Tests sind gruen
- Frontend zeigt die Export-/Import-Art klar und ehrlich an

## Nicht Teil von Sprint 111

- native `DWG`-Binary-Integration
- native `SKP`-Binary-Integration
- `STEP`, `STL`, `IGES`
- mandantenfaehiges Plugin-Deployment fuer proprietaere Provider
