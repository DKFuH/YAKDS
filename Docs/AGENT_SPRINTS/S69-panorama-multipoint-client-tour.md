# Sprint 69 - Panorama Multi-Point & Client-Tour

**Branch:** `feature/sprint-69-panorama-multipoint`
**Gruppe:** A (startbar nach S14)
**Status:** `done`
**Abhaengigkeiten:** S14 (3D-Preview), S61 (PDF/Firmenprofil), S62 (MCP optional)

---

## Ziel

Aus einer Planung mehrere verknuepfte Panorama-Viewpoints erzeugen, damit
Kunden durch die Kueche navigieren koennen. Fokus ist eine browserfaehige,
leichte Tour statt vollwertiger VR.

Inspiration: 2020 Design Multi-Point Panorama, ProKitchen Online Walkthroughs.

---

## 1. Datenmodell

Ans Ende von `planner-api/prisma/schema.prisma` anhaengen:

```prisma
model PanoramaTour {
  id            String   @id @default(uuid())
  tenant_id     String
  project_id    String
  name          String   @db.VarChar(140)
  points_json   Json     @default("[]")
  share_token   String?  @unique
  expires_at    DateTime?
  created_at    DateTime @default(now())
  updated_at    DateTime @updatedAt

  @@index([tenant_id, project_id])
  @@map("panorama_tours")
}
```

`points_json` V1:

```json
[
  {
    "id": "point-1",
    "label": "Eingang",
    "camera": { "x": 0, "y": 1600, "z": 0, "yaw": 90, "pitch": 0 },
    "hotspots": [{ "target_point_id": "point-2", "label": "Zur Insel" }]
  }
]
```

---

## 2. Backend

Neue Route: `planner-api/src/routes/panoramaTours.ts`

Endpoints:

- `GET /projects/:id/panorama-tours`
- `POST /projects/:id/panorama-tours`
- `PUT /panorama-tours/:id`
- `DELETE /panorama-tours/:id`
- `POST /panorama-tours/:id/share`
- `GET /share/panorama/:token`

Neue Datei: `planner-api/src/services/panoramaTourService.ts`

Aufgaben:

- Viewpoints validieren
- Share-Token erzeugen
- Ablaufdatum pruefen
- Optional Thumbnail- oder Preview-Metadaten berechnen

V1 bewusst ohne serverseitiges Heavy-Rendering:

- bestehende 3D-Preview-Kamera nutzen
- Tour speichert Kamerapunkte und Hotspots
- Frontend rendert Navigation clientseitig

---

## 3. Frontend

Neue Dateien:

- `planner-frontend/src/api/panoramaTours.ts`
- `planner-frontend/src/pages/PanoramaToursPage.tsx`
- `planner-frontend/src/pages/PublicPanoramaTourPage.tsx`

Anpassungen:

- `main.tsx`: private und Share-Route
- `Editor.tsx`: Button `Tourpunkt speichern`
- 3D-Preview: aktuelle Kamera als Tourpunkt uebernehmen

UI:

- Liste der Touren je Projekt
- Tour-Editor mit Reihenfolge der Punkte
- Hotspot-Links zwischen Punkten
- Share-Link mit Ablaufdatum

---

## 4. Tests

Mindestens:

1. `panoramaTours.test.ts`: Tour anlegen, listen, updaten, loeschen
2. `panoramaTours.test.ts`: Share-Token erzeugen
3. `panoramaTours.test.ts`: abgelaufener Token liefert 410 oder 404
4. Frontend: Tourpunkt kann aus aktueller Kamera gespeichert werden

---

## 5. DoD

- Ein Projekt kann mehrere Panorama-Touren speichern
- Tour besteht aus mehreren Viewpoints mit Hotspots
- Share-Link ist oeffentlich abrufbar und optional ablaufbar
- Nutzer kann zwischen Punkten navigieren
- Keine bestehende Share-Link-Logik regressiert

---

## 6. Roadmap-Update

- Sprint 69 in `Docs/ROADMAP.md` als `planned` aufnehmen
- `Docs/AGENT_SPRINTS/README.md` um Sprint 69 erweitern
