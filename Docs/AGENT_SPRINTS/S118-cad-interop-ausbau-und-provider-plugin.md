# Sprint 118 - CAD-Interop Ausbau und Provider-Plugin-System

**Branch:** `feature/sprint-118-cad-provider-expansion`
**Gruppe:** B
**Status:** `in_progress`
**Abhaengigkeiten:** S117

## Ziel

Nach dem Provider-Schnitt aus `S117` wird die CAD-/BIM-Interop zu einem ausbaubaren Subsystem weiterentwickelt.

Dieser Sprint ist der grosse Ausbau-Sprint und umfasst:
- neue Zielformate
- optionale native Provider
- externe Worker fuer schwere Interop-Jobs
- Plugin-/Deployment-Modell fuer format- und lizenzabhaengige Provider
- erweitertes Frontend fuer Capabilities, Review, Artefakt-Typen und Fallbacks

Leitidee:
- der Core bleibt schlank und stabil
- schwere oder proprietaere Interop-Implementierungen werden als zuschaltbare Provider behandelt
- Nutzer sehen klar, was `native`, `fallback`, `review`, `script` oder `mesh` ist

## Ausfuehrungsstand 2026-03-09

Bereits umgesetzt:

- plugin-faehige Interop-Registry auf Basis von `S117`
- erweiterte Capability- und Artifact-Deskriptoren
- vereinheitlichte Interop-API fuer:
  - `GET /api/v1/interop/capabilities`
  - `GET /api/v1/projects/:id/interop/jobs`
  - `GET /api/v1/projects/:id/interop/artifacts`
- neue Export-Provider:
  - `STL`
  - `STEP` (ehrlicher V1-Wireframe-Export)
  - `OBJ`
  - `3MF`
- persistente Export-Artefakte ueber `Document` inkl. Download-URL
- standardisierte Export-Descriptor-Endpunkte und Response-Header

Noch offen:

- echtes persistentes `interop_jobs`-/`interop_artifacts`-Datenmodell statt API-Fassade ueber bestehende Tabellen
- externe/native Worker-Bridge fuer schwere oder proprietaere Provider
- Frontend-Ausbau fuer capability-getriebete Export-/Import-Dialoge
- optionale Folgeformate wie `IGES`

## Hintergrund

Nach `S117` existiert bereits ein einheitlicher Provider-Layer fuer:
- `DXF`
- `DWG`
- `SKP`
- `IFC`

Der naechste logische Schritt ist nicht weiteres punktuelles Patchen, sondern eine echte Ausbauphase fuer:
- `STEP/STP`
- `STL`
- optional `IGES/IGS`
- spaetere native `DWG`- und `SKP`-Provider

Ohne diesen Ausbau drohen:
- wachsende Format-Sonderfaelle in API und UI
- unklare Capability-Kommunikation
- schwierige Integration proprietaerer SDKs
- steigende Betriebs- und Testkomplexitaet

## Scope

In Scope:

- Provider-Plugin-System fuer Interop
- Capability- und Artifact-Modell fuer mehrere Formfamilien
- optionale externe Worker fuer schwere und native Provider
- neue Formate `STEP`, `STL` und optional `IGES`
- klarer Unterschied zwischen:
  - `native`
  - `fallback`
  - `script`
  - `mesh`
  - `review-required`
- Frontend-Ausbau fuer Interop-Auswahl, Formatstatus und Artefakt-Downloads
- Betriebsmodell fuer lizenzpflichtige oder plattformabhaengige Provider

Nicht in Scope:

- Vollautomatische native Lizenzbeschaffung fuer Autodesk/ODA/Trimble
- kompletter Umbau des gesamten Plugin-Systems aller Produktbereiche
- CAM/CNC-Postprozessoren
- Vollersatz bestehender DXF-/IFC-Pfade ohne Migrationsschicht

## Zielarchitektur

### 1. Core

Der Core liefert:
- Interop-Provider-Vertrag
- Registry und Capability-Modell
- Job-Orchestrierung
- Artifact- und Review-Modell
- Dokument-/Download-Registrierung
- Security, Tenant-Scope, Auditing

### 2. Provider-Pakete

Provider werden in drei Klassen aufgeteilt:

- `embedded providers`
  - direkt in `planner-api`
  - z. B. `DXF`, `IFC`, `STL`
- `plugin providers`
  - separat registrierbar
  - z. B. `STEP`, `IGES`
- `native worker providers`
  - laufen in separatem Windows-/Linux-Worker
  - z. B. `DWG native`, `SKP native`

### 3. Worker

Schwere Provider werden nicht direkt im API-Prozess ausgefuehrt, sondern ueber Jobs:

- `interop_jobs`
- `interop_artifacts`
- `interop_provider_runs`

Typische Kandidaten:
- native `DWG`
- native `SKP`
- grosse `STEP`-Konvertierungen

### 4. Frontend

Das Frontend wird capability-getrieben:

- welche Formate sind verfuegbar
- welche sind tenant-/deployment-abhaengig
- welche liefern `native`, `fallback`, `script`, `mesh`
- welche benoetigen Review

## Formatstrategie

### DXF

- bleibt Baseline-CAD-Format
- embedded provider
- Import/Export synchron weiter moeglich

### DWG

- kurzfristig weiter als fallback/provider-basiert
- langfristig optionaler nativer Worker-Provider
- klare Kennzeichnung:
  - `read: fallback/native`
  - `write: fallback/native`

### SKP

- kurzfristig `script export`
- langfristig optionaler nativer Worker-Provider
- Import und Export ueber getrennte Capability-Flags

### IFC

- embedded BIM-Provider
- echter Import-/Export-Pfad
- bleibt Referenz fuer semantische Modellinterop

### STEP/STP

- neuer Prioritaetskandidat fuer ernsthaften CAD-Austausch
- vorzugsweise als Provider mit sauberem B-Rep-/Solid-orientierten Export
- Import optional in Phase 2 dieses Sprints

### STL

- Mesh-Export fuer Druck, Preview und einfache Fertigungsabwaertswege
- kein semantischer CAD-Ersatz
- embedded oder Plugin-Provider

### IGES/IGS

- optional, nur wenn Legacy-Kompatibilitaet wirklich benoetigt wird
- niedrigere Prioritaet als `STEP`

## Artefakt-Modell

Das System benoetigt ein ehrliches Artefakt-Modell:

```ts
export type InteropArtifactKind =
  | 'cad'
  | 'bim'
  | 'mesh'
  | 'script'
  | 'document'

export type InteropDeliveryMode =
  | 'native'
  | 'fallback'
  | 'script'
  | 'derived'

export type InteropArtifactDescriptor = {
  format: string
  artifact_kind: InteropArtifactKind
  delivery_mode: InteropDeliveryMode
  filename: string
  content_type: string
  review_required: boolean
  native: boolean
  note?: string
}
```

Damit kann das Frontend sauber kommunizieren:
- `DWG Export (fallback: DXF-kompatibel)`
- `SKP Export (Ruby-Skript fuer SketchUp)`
- `STL Export (Mesh)`
- `STEP Export (native provider)`

## Ausfuehrung

### Phase 1 - Provider-Plugin-System

- Provider aus `S117` auf plugin-faehige Registrierung erweitern
- `embedded` und `external` Provider im selben Registry-Modell fuehren
- Konfiguration pro Deployment:
  - aktiviert
  - deaktiviert
  - experimental
  - tenant-restricted

### Phase 2 - Interop-Jobsystem

- asynchrones Jobmodell fuer schwere Provider
- Status:
  - `queued`
  - `processing`
  - `done`
  - `failed`
  - `review_required`
- Artefakte an Jobs haengen
- retries und Fehlerdiagnostik

### Phase 3 - Neue Formate

- `STEP` Export als erste neue Prioritaet
- `STL` Export als zweiter priorisierter Provider
- `IGES` nur optional hinter Feature-Flag

### Phase 4 - Native Provider-Bridge

- technischer Anschluss fuer externe native Worker:
  - HTTP/gRPC/Queue
  - Request/Artifact-Contract
  - Health und Versioning
- noch keine Pflicht, alle nativen Provider direkt produktiv zu haben
- aber die Architektur muss sie tragen

### Phase 5 - Frontend-Ausbau

- Exportdialog/Importdialog capability-getrieben
- Format-Filter, Hinweise, Status-Badges
- Review-Flow fuer importierte Assets pro Format
- Download-Liste mit Artefakt-Typ und Liefermodus

### Phase 6 - Operations und Governance

- Logging pro Provider
- Metrics pro Format und Laufzeit
- Lizenz-/Feature-Gating
- Audit fuer Exporte und Importe

## Konkrete Arbeitspakete

### Backend-Core

1. `interop_jobs` und `interop_artifacts` modellieren
2. Provider-Registry auf plugin-faehige Registrierung erweitern
3. einheitliche Artifact-Deskriptoren einfuehren
4. generischen Interop-Capability-Endpunkt ausbauen
5. Job-API fuer async Provider einfuehren

### Provider

1. bestehenden `DXF`, `DWG`, `SKP`, `IFC`-Provider nach neuem Descriptor-Modell nachziehen
2. `STEP`-Provider vorbereiten und einhaengen
3. `STL`-Provider vorbereiten und einhaengen
4. optionalen `IGES`-Provider hinter Feature-Flag vorsehen
5. Worker-Bridge fuer native Provider spezifizieren

### Frontend

1. Interop-Capabilities in API konsumieren
2. Export-UI nach Formattyp und Liefermodus darstellen
3. Download-Hinweise und Warntexte je Artefakt anzeigen
4. Review-Panel fuer formatbezogene Hinweise vereinheitlichen
5. Ribbon-/Exports-Seite entsprechend erweitern

### Betrieb

1. Deployment-Config fuer Provider aktivieren
2. Health-Checks fuer externe Worker
3. Telemetrie fuer Laufzeiten, Fehler, Nutzung
4. Lizenz-/Compliance-Dokumentation fuer native Provider vorbereiten

## Akzeptanzkriterien

- Provider koennen embedded oder extern registriert werden
- schwere Interop-Jobs koennen asynchron ausgefuehrt werden
- `STEP` und `STL` sind als neue Formate integrierbar oder integriert
- jedes Artefakt traegt klaren Liefermodus und Artefakt-Typ
- Frontend zeigt ehrlich und konsistent an, was der Nutzer bekommt
- Tenant-/Deployment-Gating fuer Formate ist moeglich
- der Core muss fuer neue Formate nicht erneut strukturell umgebaut werden

## Deliverables

- plugin-faehige Interop-Registry
- erweitertes Job- und Artifact-Modell
- neue Capability- und Descriptor-APIs
- `STEP`-/`STL`-Provider-V1
- Worker-Bridge fuer native Provider
- erweiterte Export-/Import-UI
- Operations-/Governance-Dokumentation

Bereits geliefert in diesem Stand:

- plugin-faehige Registry
- Descriptor-APIs und Capability-API
- `STL`-/`STEP`-/`OBJ`-/`3MF`-Provider-V1
- persistente Export-Dokumente fuer Interop-Artefakte

## Tests

- Unit:
  - Registry
  - Descriptor-Mapping
  - Capability-Resolution
  - Job-State-Machine
- Route:
  - sync provider flows
  - async provider flows
  - capability and artifact endpoints
- Integration:
  - external worker handshake
  - artifact persistence and download
  - tenant/provider gating
- Frontend:
  - capability-driven labels
  - review and artifact badges
  - export dialog behaviour

## Risiken

- zu viel in einem Sprint gleichzeitig
- unklare Verantwortungsgrenzen zwischen Core, Provider und Worker
- API/Frontend driften beim Artefaktmodell auseinander
- native Provider werden fachlich versprochen, bevor sie betrieblich abgesichert sind

## Entscheidungsregeln

- `STEP` vor `IGES`
- ehrliche Kennzeichnung vor Marketing-Begriffen
- native Provider nur ueber tragfaehige Worker-/Lizenzstrategie
- keine Format-Features ohne Capability- und Descriptor-Abdeckung

## DoD

- `S117`-Provider-Schnitt ist erweitert und produktiv tragfaehig
- neue Artefakt- und Jobmodelle sind aktiv
- mindestens ein neuer Nicht-Legacy-Provider ausserhalb des bisherigen Sets ist integriert
- Frontend ist capability-getrieben fuer Interop
- Provider koennen deployment-seitig an- oder abgeschaltet werden
- Tests und Dokumentation decken den erweiterten Interop-Betrieb ab

## Nicht Teil von Sprint 112

- vollstaendige CAM-/CNC-Kette
- automatische semantische Perfektkonvertierung zwischen allen Formaten
- universeller nativer Multi-CAD-Writer im Core-Prozess
