# INTEROP.md

CAD-Import/Export (DXF/DWG), SketchUp-Referenzimport und Render-Worker-Protokoll.

---

## Teil 1 – CAD-Interoperabilität (DXF / DWG)

### Scope

| Format | Import | Export | Status |
|--------|--------|--------|--------|
| DXF 2D | ja | ja | produktiver MVP-Pfad |
| DWG 2D | Staging/Review | nein | Binary-Adapter offen |
| SKP | ja | nein | Referenzmodellpfad |

Alle Geometriedaten werden intern in **Millimetern** geführt. Zentrales Format: `ImportAsset` aus `shared-schemas`.

### DXF-Import

Liest: `LINE`, `LWPOLYLINE`, `POLYLINE`, `ARC`, `CIRCLE`, `TEXT`, `MTEXT`, `INSERT`.
Ignoriert: unbekannte Entitäten, Geometrie mit positivem `z`.

Einheitenkonvertierung:
- `$INSUNITS = 1` → inch, `2` → feet, `4` → mm, `5` → cm, `6` → m
- Fehlender oder unbekannter `$INSUNITS`-Code → `needs_review`

Protokollzustände: `imported` | `ignored` | `needs_review`

### DWG-Strategie

`POST /api/v1/imports/cad` mit `source_format=dwg` → Job `done` mit `needs_review`. Kein echter Geometrieparser im MVP.

### Export-Layer-Konventionen

| Layer | Inhalt |
|-------|--------|
| `OKP_ROOM` | geschlossene Raumkontur |
| `OKP_WALLS` | Wandsegmente |
| `OKP_OPENINGS` | Öffnungen |
| `OKP_FURNITURE` | Möbelkonturen (Draufsicht) |

DXF-Export: `$INSUNITS = 4` (mm).

### Roundtrip-Stand (MVP)

- DXF-Export → DXF-Import für Raumkontur: abgesichert
- Einheitenkonvertierung Inch-DXF: abgesichert
- Review-Fälle bei fehlenden Units: abgesichert
- Nativer DWG-Roundtrip: **nicht im MVP**

### API-Endpunkte

```
POST /api/v1/imports/preview/dxf
POST /api/v1/imports/cad
POST /api/v1/exports/dxf
POST /api/v1/projects/:projectId/export-dxf
GET  /api/v1/imports/:id
```

---

## Teil 2 – SketchUp-Interoperabilität (SKP)

### Scope (MVP)

| Funktion | MVP | Phase 2 |
|----------|-----|---------|
| SKP hochladen | ✅ | — |
| Geometrie als Referenzmodell | ✅ | — |
| Komponenten erkennen & mappen | ✅ | — |
| Vollwertiger SKP-Export | ❌ | ✅ |

Eine `.skp`-Datei wird nicht direkt bearbeitet — sie wird als Referenzmodell geladen (3D-Preview als Overlay, keine Rückschreibung im MVP).

### Kernobjekte

```typescript
interface SkpReferenceModel {
  id: string; project_id: string; import_job_id: string;
  source_filename: string;
  components: SkpComponent[];
  raw_geometry_url: string;     // GLTF für 3D-Preview
  bounding_box: BoundingBox3D;
  created_at: string;
}

interface SkpComponent {
  id: string; reference_model_id: string;
  skp_component_name: string; skp_instance_guid: string;
  position: Point3D; rotation: Rotation3D;
  dimensions: { width_mm: number; height_mm: number; depth_mm: number } | null;
  metadata: Record<string, string>;
  mapping: SkpComponentMapping | null;
}

interface SkpComponentMapping {
  component_id: string;
  target_type: 'cabinet' | 'appliance' | 'reference_object' | 'ignored';
  catalog_item_id: string | null;
  label: string | null;
}
```

### Automatisches Mapping (Heuristik)

1. Name enthält `"US_"` / `"Unterschrank"` → `cabinet`
2. Name enthält `"Kühlschrank"` / `"Herd"` / `"Spüle"` → `appliance`
3. Dimensionen: Höhe 720–900 mm + Tiefe ~600 mm → wahrscheinlich Unterschrank
4. `AttributeDictionary["Type"]` wenn vorhanden

Unsichere Zuordnungen: `needs_review`.

### API-Endpunkte

```
POST /api/v1/imports/skp
GET  /api/v1/imports/:id
GET  /api/v1/skp-models/:id/components
POST /api/v1/skp-models/:id/mappings
GET  /api/v1/projects/:id/skp-models
```

---

## Teil 3 – Render-Worker-Protokoll

### Grundprinzip

Der Render-Worker ist ein **externer Prozess** — entkoppelt vom `planner-api`.
Er registriert sich aktiv, pollt Jobs per HTTPS-Pull und liefert Ergebnisse zurück.

### Ablauf

```
Browser → POST /render-jobs → Job: queued
Worker  → GET /render-jobs/next → Job: assigned → rendert → POST /result → Job: done
Browser → GET /render-jobs/:id → { status, image_url }
```

### Job-Status

```
queued → assigned → running → done
                            → failed
queued → failed (Timeout)
assigned → queued (Worker-Disconnect, nach Timeout)
```

### Kernobjekte

```typescript
interface RenderJob {
  id: string; project_id: string;
  status: 'queued' | 'assigned' | 'running' | 'done' | 'failed';
  scene_payload: ScenePayload | null;
  worker_id: string | null;
  assigned_at: string | null; completed_at: string | null;
  error_message: string | null; created_at: string;
}

interface ScenePayload {
  format_version: '1.0';
  room: { boundary: Vertex[]; ceiling_height_mm: number; ceiling_constraints: CeilingConstraint[] };
  objects: SceneObject[];
  camera: CameraSetup;
  render_settings: RenderSettings;
}

interface RenderNode {
  id: string; worker_token: string;
  hostname: string;
  capabilities: ('blender' | 'threejs-ssr' | 'cycles' | 'eevee')[];
  last_heartbeat: string;
  status: 'idle' | 'busy' | 'offline';
}
```

### Timeout-Handling

| Zustand | Timeout | Aktion |
|---------|---------|--------|
| `queued` | 1 h | Worker wird erwartet |
| `assigned` | 5 min | Zurück auf `queued` |
| `running` | 30 min | Auf `failed` setzen |

### Sicherheit

- Worker-Token = signiertes JWT, gehasht in DB
- Kein direkter DB-Zugriff durch Worker
- Scene Payload enthält **keine** Kundendaten

### API-Endpunkte

```
# Client
POST /api/v1/projects/:id/render-jobs
GET  /api/v1/render-jobs/:id

# Worker
POST /api/v1/workers/register
GET  /api/v1/render-jobs/next           (Bearer <worker-token>)
PATCH /api/v1/render-jobs/:id/status
POST /api/v1/render-jobs/:id/result
```
