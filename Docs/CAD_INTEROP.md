# CAD_INTEROP.md

## CAD-Interoperabilität – DWG/DXF Import und Export

**Stand:** Sprint 0

---

## Scope (MVP)

| Format | Import | Export | Scope |
|---|---|---|---|
| DXF 2D | ✅ | ✅ | Linien, Polylinien, Layer |
| DWG 2D | ⚠️ Phase 2 | ⚠️ Phase 2 | via ODA/LibreDWG |
| DWG als Referenz | ✅ (via DXF-Konvertierung) | — | Grundrissbasis |

**MVP-Strategie:** DWG wird clientseitig oder via Tool in DXF konvertiert, dann importiert.
Direktes DWG lesen/schreiben ist Phase 2.

---

## Neutrales Austauschformat

### `ImportAsset`

Das interne Format nach dem Parsen — unabhängig vom Quellformat.

```typescript
interface ImportAsset {
  id: string;
  import_job_id: string;
  source_format: 'dxf' | 'dwg' | 'skp';
  source_filename: string;
  layers: CadLayer[];
  entities: CadEntity[];
  bounding_box: BoundingBox2D;
  units: CadUnits;
  created_at: string;
}

interface CadLayer {
  id: string;
  name: string;                    // z.B. "Grundriss", "Möbel", "Bemaßung"
  color: string | null;
  visible: boolean;
  entity_count: number;
}

interface CadEntity {
  id: string;
  layer_id: string;
  type: CadEntityType;
  geometry: CadGeometry;
}

type CadEntityType = 'line' | 'polyline' | 'arc' | 'circle' | 'text' | 'block_ref';

type CadGeometry =
  | { type: 'line'; start: Point2D; end: Point2D }
  | { type: 'polyline'; points: Point2D[]; closed: boolean }
  | { type: 'arc'; center: Point2D; radius_mm: number; start_angle: number; end_angle: number }
  | { type: 'circle'; center: Point2D; radius_mm: number }
  | { type: 'text'; position: Point2D; content: string; height_mm: number }
  | { type: 'block_ref'; block_name: string; position: Point2D; rotation_deg: number };

interface BoundingBox2D {
  min: Point2D;
  max: Point2D;
}

type CadUnits = 'mm' | 'cm' | 'm' | 'inch' | 'feet';
```

---

## Import-Pipeline

```
Datei-Upload (DXF/DWG)
        │
        ▼
POST /imports/cad
  → ImportJob (status: queued)
        │
        ▼
Parser (Codex-Modul: interop-cad/dxf-import)
  - Parst DXF-Entities
  - Normalisiert Einheiten → mm
  - Erstellt ImportAsset
        │
        ▼
ImportJob (status: done)
ImportAsset gespeichert (DB + Filesystem)
        │
        ▼
Frontend: Layer-Filter anzeigen
User wählt relevante Layer aus
        │
        ▼
Extraktion: Polylinien → RoomBoundary-Kandidaten
             Lücken in Linien → Opening-Kandidaten
        │
        ▼
User bestätigt / korrigiert
Übernahme in Raum: POST /rooms/:id/adopt-cad-boundary
```

---

## Import-Job

```typescript
interface ImportJob {
  id: string;
  project_id: string;
  status: ImportJobStatus;
  source_format: 'dxf' | 'dwg' | 'skp';
  source_filename: string;
  file_size_bytes: number;
  import_asset_id: string | null;
  protocol: ImportProtocolEntry[];
  created_at: string;
  completed_at: string | null;
  error_message: string | null;
}

type ImportJobStatus = 'queued' | 'processing' | 'done' | 'failed';

interface ImportProtocolEntry {
  entity_id: string | null;
  status: 'imported' | 'ignored' | 'needs_review';
  reason: string;
}
```

---

## Export-Pipeline

```
Projekt-Zustand (Raum + Möbel)
        │
        ▼
POST /projects/:id/export-dxf
        │
        ▼
Exporter (Codex-Modul: interop-cad/dxf-export)
  - Raumkontur → Polylinie (Layer: YAKDS_ROOM)
  - Wandlinien → Linien (Layer: YAKDS_WALLS)
  - Öffnungen → Lücken in Wandlinien (Layer: YAKDS_OPENINGS)
  - Möbelkonturen → Rechtecke (Layer: YAKDS_FURNITURE)
        │
        ▼
DXF-Datei → Download-URL
```

---

## Layer-Konventionen (Export)

| Layer-Name | Inhalt | Farbe |
|---|---|---|
| `YAKDS_ROOM` | Raumkontur (Polylinie, geschlossen) | Weiß |
| `YAKDS_WALLS` | Wandmittellinien | Grau |
| `YAKDS_OPENINGS` | Türen/Fenster (Lücken + Symbole) | Cyan |
| `YAKDS_FURNITURE` | Möbelkonturen (Draufsicht) | Gelb |
| `YAKDS_DIMS` | Bemaßungen (optional) | Grün |
| `YAKDS_REF` | Referenzgeometrie aus Import | Magenta |

---

## Einheiten

- **Intern:** immer Millimeter (mm)
- **Export:** DXF-Einheit = mm (`$INSUNITS = 4`)
- **Import:** Einheit wird aus DXF-Header gelesen, normalisiert auf mm

---

## Nicht im MVP

- Verlustfreier Roundtrip (Import → Bearbeitung → Export → Re-Import identisch)
- Vollständige Bearbeitung beliebiger DWG-Spezialobjekte (Hatch, XREF, 3D-Körper)
- DWG direkt lesen/schreiben ohne Konvertierung

---

## API-Contracts

```
POST /api/v1/imports/cad
  Body: multipart/form-data { file: File, project_id: string }
  → ImportJob

GET /api/v1/imports/:id
  → ImportJob + ImportAsset (wenn done)

GET /api/v1/imports/:id/layers
  → CadLayer[]

POST /api/v1/projects/:id/export-dxf
  Body: { include_furniture: boolean, include_dims: boolean }
  → { download_url: string }

POST /api/v1/rooms/:id/adopt-cad-boundary
  Body: { import_asset_id: string, layer_id: string, polyline_entity_id: string }
  → Room (aktualisiert)
```
