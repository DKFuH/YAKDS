# Sprint 78 - Materials-Plugin: Textur- und Materialbibliothek

**Branch:** `feature/sprint-78-materials-plugin`
**Gruppe:** B (startbar nach S75)
**Status:** `planned`
**Abhaengigkeiten:** S20 (Katalog), S51 (GLTF/GLB), S75 (Asset-Browser Light)

---

## Ziel

Oberflaechen systematisch verwalten: Boeden, Waende, Fronten und importierte
Modelle erhalten eine einfache Textur- und Materialbibliothek mit Kategorien,
Vorschau und Wiederverwendung ueber Projekte hinweg.

Inspiration: Sweet Home 3D imported textures und TexturesLibraryEditor.

**Plugin-Zuschnitt:** `materials`

---

## 0. Plugin-Einordnung

Das Plugin kapselt:

- Materialbibliothek
- Resolver fuer Textur-/Materialzuweisung
- Materialbrowser und Materialpanel
- Materialzuweisung fuer Flaechen und Assets

Der Core liefert nur:

- Rendering-Schnittstellen fuer Materialien
- Plugin-Slots im Editor und Katalog
- gemeinsame Upload-/Storage-Bausteine

---

## 1. Datenmodell

Ans Ende von `planner-api/prisma/schema.prisma` anhaengen:

```prisma
model MaterialLibraryItem {
  id                String   @id @default(uuid())
  tenant_id         String
  name              String   @db.VarChar(140)
  category          String   @db.VarChar(60)
  texture_url       String?
  preview_url       String?
  scale_x_mm        Float?
  scale_y_mm        Float?
  rotation_deg      Float    @default(0)
  roughness         Float?
  metallic          Float?
  config_json       Json     @default("{}")
  created_at        DateTime @default(now())
  updated_at        DateTime @updatedAt

  @@index([tenant_id, category])
  @@map("material_library_items")
}
```

Zu bestehenden Flaechen-/Placement-Daten nur Referenzen speichern:

```json
{
  "material_item_id": "...",
  "uv_scale": { "x": 1, "y": 1 }
}
```

---

## 2. Backend

Neue Dateien:

- `planner-api/src/plugins/materials.ts`
- `planner-api/src/routes/materialLibrary.ts`
- `planner-api/src/services/materialResolver.ts`

Endpoints:

- `GET /tenant/materials`
- `POST /tenant/materials`
- `PATCH /tenant/materials/:id`
- `DELETE /tenant/materials/:id`
- `POST /projects/:id/material-assignments`

Resolver:

- Materialdaten fuer 2D- und 3D-Darstellung vereinheitlichen
- Texturscale und Rotation aufloesen
- Defaults liefern, wenn ein Material fehlt

---

## 3. Frontend

Neue oder angepasste Dateien:

- `planner-frontend/src/plugins/materials/*`
- `planner-frontend/src/api/materialLibrary.ts`
- `planner-frontend/src/components/catalog/MaterialBrowser.tsx`
- `planner-frontend/src/components/editor/MaterialPanel.tsx`

Funktionen:

- Materialbibliothek mit Kategorien `floor`, `wall`, `front`, `worktop`, `custom`
- Bildvorschau und Suchfunktion
- Material auf Wand, Boden, Decke, Placement oder Asset anwenden
- einfache Parameter: Rotation, Skalierung, Wiederholung
- Plugin-Sichtbarkeit tenant- und route-aware

---

## 4. Deliverables

- `MaterialLibraryItem` plus Migration
- CRUD fuer Materialien
- Resolver fuer 2D/3D
- Materialbrowser und Zuweisungspanel
- Plugin-Registrierung und tenant-aware Aktivierung
- 10-14 Tests

---

## 5. DoD

- Nutzer kann Materialien hochladen und verwalten
- Materialien lassen sich auf Flaechen und Objekte anwenden
- Vorschau in 2D/3D bleibt konsistent
- fehlende Texturen brechen die Szene nicht
