# Sprint 74 - Split-View & Virtual Visitor

**Branch:** `feature/sprint-74-split-view-visitor`
**Gruppe:** A (startbar nach S69)
**Status:** `done`
**Abhaengigkeiten:** S14 (3D-Preview), S58 (Bild-Nachzeichnen), S69 (Panorama-Touren)

---

## Ziel

Den Planungsmodus um eine echte 2D/3D-Split-Ansicht erweitern: links der
Grundriss, rechts die 3D-Ansicht. Beide Views bleiben live synchron. Ein
"Virtual Visitor" zeigt Kamera-Position, Blickrichtung und Augenhoehe direkt
im Grundriss.

Inspiration: Sweet Home 3D Split-View und Virtual Visitor.

Wichtig:

- nur UX/Workflow uebernehmen
- keine Assets, Icons oder GPL-Code aus SH3D verwenden
- komplette Eigenimplementierung in React, Konva und Three.js

---

## 1. Datenmodell

Keine neue Heavy-Tabelle noetig. Bestehende Workspace-/View-Konfiguration um
einen Viewer-Block erweitern, z. B. in `workspace_layouts.layout_json` oder
vergleichbarer UI-Persistenz:

```json
{
  "planner_view": {
    "mode": "split",
    "split_ratio": 0.52,
    "show_virtual_visitor": true,
    "camera_height_mm": 1650
  }
}
```

Optional neue Tabelle nur falls View-Settings tenant-/projektweit geteilt
werden sollen:

```prisma
model PlannerViewPreset {
  id               String   @id @default(uuid())
  tenant_id        String
  name             String   @db.VarChar(120)
  mode             String   @default("split")
  split_ratio      Float    @default(0.5)
  show_visitor     Boolean  @default(true)
  camera_height_mm Int      @default(1650)
  config_json      Json     @default("{}")
  created_at       DateTime @default(now())
  updated_at       DateTime @updatedAt

  @@index([tenant_id])
  @@map("planner_view_presets")
}
```

V1 bevorzugt die JSON-Persistenz ohne neue Migration.

---

## 2. Backend

Nur falls View-Settings serverseitig gespeichert werden:

- `GET /projects/:id/planner-view`
- `PUT /projects/:id/planner-view`

Neue Route optional: `planner-api/src/routes/plannerView.ts`

Validation:

- `mode` nur `floorplan`, `split`, `viewer3d`
- `split_ratio` zwischen `0.25` und `0.75`
- `camera_height_mm` zwischen `900` und `2200`

Tests:

- Persistenz der View-Settings
- Tenant-Isolation
- Defaults fuer Projekte ohne gespeicherte View-Konfiguration

---

## 3. Frontend

Neue oder angepasste Komponenten:

- `planner-frontend/src/pages/Editor.tsx`
- `planner-frontend/src/components/editor/CanvasArea.tsx`
- `planner-frontend/src/components/editor/Preview3D.tsx`
- optional `planner-frontend/src/components/editor/VirtualVisitorOverlay.tsx`

Funktionen:

- Split-View Toggle: `2D`, `Split`, `3D`
- verschiebbarer Divider zwischen Plan und 3D
- Live-Sync von Kamera und Selektionszustand
- Kamera-Position im Grundriss sichtbar als Symbol mit Blickkegel
- Hoehenregler fuer Augenhoehe des Besuchers
- Klick im Grundriss kann die 3D-Kamera repositionieren
- Bewegung in 3D aktualisiert den Visitor im 2D-Plan

UX-V1:

- Desktop first
- mobile fallback ohne Split, nur Modus-Umschaltung
- keine physikalische Kollision, nur freie Kamera

---

## 4. Technische Leitplanken

- Kein zweiter Geometriestack: 2D und 3D lesen dieselben Room-/Placement-Daten
- Keine zwei unabhaengigen Selektionsmodelle
- Kamera-Sync gedrosselt, um Re-Render-Loops zu vermeiden
- Visitor-Icon und Blickkegel muessen auch bei Zoom sauber skalieren

---

## 5. Deliverables

- Split-View im Editor
- persistente View-Settings
- Virtual-Visitor-Anzeige im Grundriss
- Kamera-Hoehenregler
- 8-12 Tests
- Frontend-Build gruen

---

## 6. DoD

- Nutzer kann zwischen 2D, Split und 3D umschalten
- Split-Ratio bleibt pro Projekt erhalten
- 3D-Kamera und 2D-Visitor bleiben synchron
- Augenhoehe beeinflusst die 3D-Kamera sichtbar
- Mobile Ansicht faellt kontrolliert auf Single-View zurueck

