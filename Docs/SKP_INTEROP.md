# SKP_INTEROP.md

## SketchUp-Interoperabilität – SKP Import

**Stand:** Sprint 0

---

## Scope (MVP)

| Funktion | MVP | Phase 2 |
|---|---|---|
| SKP-Datei hochladen | ✅ | — |
| Geometrie als Referenzmodell laden | ✅ | — |
| Komponenten erkennen und benennen | ✅ | — |
| Komponenten als Möbelplatzhalter zuordnen | ✅ | — |
| Vollwertiger SKP-Export | ❌ | ✅ |
| Parametrisierter Roundtrip | ❌ | ✅ |

---

## Konzept: SKP als Referenzmodell

Eine `.skp`-Datei wird **nicht** direkt bearbeitet.
Sie wird als **Referenzmodell** ins Projekt geladen:
- Sichtbar im 3D-Preview als Overlay
- Einzelne Komponenten können Möbel-/Gerätepositionen zugeordnet werden
- Keine Rückschreibung ins SKP im MVP

---

## Kernobjekte

### `SkpReferenceModel`

```typescript
interface SkpReferenceModel {
  id: string;
  project_id: string;
  import_job_id: string;
  source_filename: string;
  components: SkpComponent[];
  raw_geometry_url: string;        // GLTF/OBJ für 3D-Preview
  bounding_box: BoundingBox3D;
  created_at: string;
}
```

### `SkpComponent`

Entspricht einer SketchUp-Komponente (Definition + Instance).

```typescript
interface SkpComponent {
  id: string;
  reference_model_id: string;
  skp_component_name: string;      // Name in SketchUp
  skp_instance_guid: string;
  position: Point3D;
  rotation: Rotation3D;
  dimensions: { width_mm: number; height_mm: number; depth_mm: number } | null;
  metadata: Record<string, string>; // AttributeDictionary-Werte aus SKP
  mapping: SkpComponentMapping | null;
}
```

### `SkpComponentMapping`

Zuordnung einer SKP-Komponente zu einem Planer-Konzept.

```typescript
interface SkpComponentMapping {
  component_id: string;
  target_type: 'cabinet' | 'appliance' | 'reference_object' | 'ignored';
  catalog_item_id: string | null;  // wenn target_type cabinet/appliance
  label: string | null;            // Anzeigename im Planer
}
```

---

## Import-Pipeline

```
Datei-Upload (.skp)
        │
        ▼
POST /imports/skp
  → ImportJob (status: queued)
        │
        ▼
Parser (Codex-Modul: interop-sketchup/skp-import)
  - SKP-Format lesen (binär)
  - Komponenten-Definitionen extrahieren
  - Instanzen mit Position/Rotation
  - Metadaten aus AttributeDictionary
  - Geometrie → GLTF/OBJ für Preview-Renderer
        │
        ▼
ImportJob (status: done)
SkpReferenceModel gespeichert
        │
        ▼
Frontend: Komponenten-Liste anzeigen
User ordnet Komponenten zu (Möbel / Gerät / Referenz / Ignorieren)
        │
        ▼
POST /skp-models/:id/mappings
Mappings gespeichert
```

---

## Automatisches Mapping (Heuristik)

Der Parser versucht Komponenten automatisch zuzuordnen anhand:

1. **Name-Matching:** Komponentenname enthält bekannte Schlüsselwörter
   - `"US_"`, `"Unterschrank"` → `cabinet` (Unterschrank)
   - `"HS_"`, `"Hängeschrank"` → `cabinet` (Hängeschrank)
   - `"Kühlschrank"`, `"Herd"`, `"Spüle"` → `appliance`
2. **Dimensionen:** Höhe 720–900 mm + Tiefe ~600 mm → wahrscheinlich Unterschrank
3. **Metadaten:** `AttributeDictionary["Type"]` wenn vorhanden

Unsichere Zuordnungen werden als `needs_review` markiert.

---

## 3D-Preview-Integration

Das `SkpReferenceModel` wird im Browser-3D-Preview (Sprint 14) als separater Layer geladen:

- Format: GLTF 2.0 (konvertiert beim Import)
- Ein-/ausblendbar per Toggle
- Transparenz einstellbar
- Einzelne Komponenten selektierbar (zeigt Mapping-Status)

---

## API-Contracts

```
POST /api/v1/imports/skp
  Body: multipart/form-data { file: File, project_id: string }
  → ImportJob

GET /api/v1/imports/:id
  → ImportJob + SkpReferenceModel (wenn done)

GET /api/v1/skp-models/:id/components
  → SkpComponent[]

POST /api/v1/skp-models/:id/mappings
  Body: SkpComponentMapping[]
  → SkpComponentMapping[]

GET /api/v1/projects/:id/skp-models
  → SkpReferenceModel[]
```

---

## Nicht im MVP

- SKP-Dateien exportieren / zurückschreiben
- Vollständiger parametrisierter Roundtrip
- Bearbeitung von SKP-Entities direkt im Planer
- SketchUp-Plugin / Extension-Schnittstelle
