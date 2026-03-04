# Sprint 75 - Modell-Import & Asset-Browser Light

**Branch:** `feature/sprint-75-model-import-browser`
**Gruppe:** B (startbar nach S51 oder parallel zu S74)
**Status:** `planned`
**Abhaengigkeiten:** S20 (Katalog), S51 (GLTF/GLB), S53 (DWG/SKP Interop)

---

## Ziel

Einen einfachen Asset-Workflow schaffen: importierte 3D-Modelle koennen als
Bibliothekseintraege mit Vorschau, Kategorie und automatischer Skalierung
genutzt werden. Fokus auf pragmatischen Import von OBJ/DAE mit Bounding-Box,
Auto-Scale und einfacher Platzierung.

Inspiration: Sweet Home 3D Model Import Wizard und einfacher Moebelbrowser.

Wichtig:

- kein Kopieren von SH3D-Bibliotheken oder Assets
- keine Uebernahme des SH3F-Formats
- nur UX-Ideen, eigene Implementierung

---

## 1. Datenmodell

Ans Ende von `planner-api/prisma/schema.prisma` anhaengen:

```prisma
model AssetLibraryItem {
  id                 String   @id @default(uuid())
  tenant_id          String
  name               String   @db.VarChar(180)
  category           String   @db.VarChar(80)
  source_format      String   @db.VarChar(20)
  file_url           String
  preview_url        String?
  bbox_json          Json     @default("{}")
  default_scale_json Json     @default("{}")
  tags_json          Json     @default("[]")
  created_at         DateTime @default(now())
  updated_at         DateTime @updatedAt

  @@index([tenant_id, category])
  @@map("asset_library_items")
}
```

`bbox_json` V1:

```json
{ "width_mm": 600, "height_mm": 720, "depth_mm": 560 }
```

---

## 2. Backend

Neue Dateien:

- `planner-api/src/routes/assetLibrary.ts`
- `planner-api/src/services/modelImportService.ts`

Endpoints:

- `GET /tenant/assets`
- `POST /tenant/assets/import`
- `PATCH /tenant/assets/:id`
- `DELETE /tenant/assets/:id`

Service-Aufgaben:

- OBJ/DAE-Datei validieren
- Bounding-Box aus Meshdaten berechnen
- Auto-Scale fuer mm-basierte Platzierung ableiten
- Preview-Metadaten erzeugen

V1 reicht:

- OBJ und DAE
- keine Materialbearbeitung
- keine Hierarchie-Editierung

---

## 3. Frontend

Neue oder angepasste Dateien:

- `planner-frontend/src/api/assetLibrary.ts`
- `planner-frontend/src/components/catalog/AssetBrowser.tsx`
- `planner-frontend/src/components/catalog/AssetImportDialog.tsx`

Funktionen:

- Kategorienliste links
- Suche nach Name und Tags
- Kartenansicht mit Preview, Groesse, Format
- Import-Dialog mit Name, Kategorie, Scale-Vorschlag
- Platzieren eines AssetLibraryItem als Placement oder Katalogobjekt

UX-V1:

- Kategorien: `base`, `wall`, `appliance`, `decor`, `custom`
- Upload-Wizard in 2-3 Schritten
- klarer Hinweis, wenn Bounding-Box ungueltig ist

---

## 4. Interop-Regeln

- importierte Modelle bleiben tenant-spezifisch
- Speicherung nur als Referenz plus Metadaten, kein eigener proprietaerer Blob-Standard
- spaeterer GLTF-Konvertierungspfad darf folgen, ist aber nicht Teil von V1

---

## 5. Deliverables

- Prisma-Modell plus Migration
- OBJ/DAE-Importservice
- Asset-Library-CRUD
- Asset-Browser-Light im Frontend
- Importdialog mit Bounding-Box/Auto-Scale
- 10-14 Tests

---

## 6. DoD

- Nutzer kann OBJ/DAE importieren
- Bounding-Box und Default-Scale werden automatisch ermittelt
- importierte Assets erscheinen in einer filterbaren Bibliothek
- Assets koennen anschliessend platziert werden
- fehlerhafte Dateien liefern klare Fehlermeldungen

