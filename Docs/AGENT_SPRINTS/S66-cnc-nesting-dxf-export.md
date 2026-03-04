# Sprint 66 - CNC-Nesting & DXF-Export

**Branch:** `feature/sprint-66-cnc-nesting`
**Gruppe:** B (startbar nach S65)
**Status:** `done`
**Abhaengigkeiten:** S53 (DWG/DXF-Interop), S65 (Cutlist)

---

## Ziel

Aus Zuschnittteilen automatisch Standardplatten belegen, Verschnitt minimieren
und das Ergebnis als Werkstattplan exportieren. Fokus ist ein pragmatischer,
deterministischer First-Fit/Best-Fit-Ansatz fuer Tischler-Workflows, nicht ein
vollstaendiger CAD/CAM-Solver.

---

## 1. Datenmodell

Ans Ende von `planner-api/prisma/schema.prisma` anhaengen:

```prisma
enum NestingJobStatus {
  draft
  calculated
  exported
}

model NestingJob {
  id                String           @id @default(uuid())
  tenant_id         String
  project_id        String
  source_cutlist_id String
  sheet_width_mm    Int
  sheet_height_mm   Int
  kerf_mm           Int              @default(4)
  allow_rotate      Boolean          @default(true)
  status            NestingJobStatus @default(draft)
  result_json       Json             @default("{}")
  created_at        DateTime         @default(now())
  updated_at        DateTime         @updatedAt

  @@index([tenant_id, project_id])
  @@index([source_cutlist_id])
  @@map("nesting_jobs")
}
```

Migration:

- Neue Tabelle `nesting_jobs`
- Enum `NestingJobStatus`
- Keine Rewrite-Migration bestehender Daten

---

## 2. Backend-Service `planner-api/src/services/nestingService.ts`

Implementieren:

```ts
export interface NestingPart {
  id: string
  label: string
  width_mm: number
  height_mm: number
  material_key: string
  quantity: number
}

export interface NestingSheetPlacement {
  part_id: string
  x_mm: number
  y_mm: number
  width_mm: number
  height_mm: number
  rotated: boolean
}

export interface NestingSheet {
  index: number
  width_mm: number
  height_mm: number
  used_area_mm2: number
  waste_area_mm2: number
  placements: NestingSheetPlacement[]
}

export interface NestingResult {
  sheets: NestingSheet[]
  total_parts: number
  placed_parts: number
  waste_pct: number
}

export function nestCutlistParts(
  parts: NestingPart[],
  options: { sheet_width_mm: number; sheet_height_mm: number; kerf_mm: number; allow_rotate: boolean },
): NestingResult
```

Regeln:

- Materialgruppen getrennt verschachteln
- Sortierung: groesste Flaeche zuerst
- Rotation optional
- Kerf zwischen Teilen beruecksichtigen
- Fallback: neue Platte erzeugen, wenn Teil auf keine bestehende Platte passt
- Harte Validierung: Teil groesser als Rohplatte -> Fehler

Tests:

- 8 bis 10 Unit-Tests fuer Rotation, Kerf, Mehrplattenfall, Materialtrennung

---

## 3. DXF-Export fuer Werkstatt

Neue Datei `planner-api/src/services/nestingDxfExporter.ts`:

```ts
export function buildNestingDxf(result: NestingResult): Buffer
```

DXF-Inhalt:

- Rechteck fuer jede Rohplatte
- Rechteck pro Teil
- Textlabel mit Teilname und Groesse
- Layer:
  - `SHEET_BORDER`
  - `CUT_PARTS`
  - `LABELS`

Optional:

- Mehrere Platten untereinander im selben DXF
- Koordinatenursprung je Platte mit Abstand 200 mm

Tests:

- DXF enthaelt `SECTION`, `ENTITIES`, Layernamen und Teiltexte

---

## 4. API-Routen `planner-api/src/routes/nesting.ts`

Unter `/api/v1`:

- `POST /projects/:id/nesting-jobs`
  - Input: `{ source_cutlist_id, sheet_width_mm, sheet_height_mm, kerf_mm?, allow_rotate? }`
  - Fuehrt Nesting aus, speichert `result_json`, liefert Job
- `GET /projects/:id/nesting-jobs`
  - Liste aller Jobs eines Projekts
- `GET /nesting-jobs/:id`
  - Detailansicht mit Kennzahlen
- `GET /nesting-jobs/:id/export/dxf`
  - DXF-Download
- `DELETE /nesting-jobs/:id`
  - Job loeschen

Tests:

- 10 bis 12 API-Tests
- Fehlerfall fuer zu grosse Teile
- Export-Header `application/dxf` oder `application/octet-stream`

---

## 5. Frontend

### API

Neue Datei `planner-frontend/src/api/nesting.ts`

- `createNestingJob`
- `listNestingJobs`
- `getNestingJob`
- `downloadNestingDxf`
- `deleteNestingJob`

### UI

Neue Seite oder Panel `planner-frontend/src/pages/NestingPage.tsx`

Features:

- Auswahl einer Cutlist
- Rohplattenformat:
  - 2800x2070
  - 4100x1300
  - frei definierbar
- Kerf-Feld
- Checkbox `Rotation erlauben`
- Ergebnis-KPIs:
  - Plattenanzahl
  - Verschnitt in %
  - Teile platziert / gesamt
- Einfache 2D-Vorschau pro Platte mit CSS/SVG/Konva
- Button `DXF exportieren`

Optional:

- Materialfilter
- Presets fuer Spanplatte, Multiplex, Kompaktplatte

---

## 6. Dokumentation

Aktualisieren:

- `Docs/ROADMAP.md`
- `Docs/AGENT_SPRINTS/README.md`

Eintragen:

- Sprint 66 geplant
- Phase 11 als Produktionsausbau mit S63-S66

---

## 7. Definition of Done

- Cutlist-Teile koennen in `NestingJob` berechnet werden
- Mehrere Platten werden korrekt angelegt, wenn eine Platte nicht reicht
- Rotation und Kerf werden korrekt beruecksichtigt
- DXF-Export ist in gängigen CAD-Tools importierbar
- Frontend zeigt Vorschau und Kennzahlen
- Mindestens 18 neue Tests gruen

---

## 8. Hinweise fuer den Agent

- Kein perfekter Optimierungsalgorithmus noetig; nachvollziehbarer Heuristik-Ansatz reicht
- Keine CAM-Postprozessoren oder G-Code in diesem Sprint
- DXF simpel halten: Polylines/Rechtecke/Text
- Bestehende DXF-Export-Muster aus Sprint 53 wiederverwenden
