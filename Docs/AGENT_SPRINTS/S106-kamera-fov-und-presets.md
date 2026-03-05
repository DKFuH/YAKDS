# Sprint 106 - Kamera-FOV und gespeicherte Kamerapresets

**Branch:** `feature/sprint-106-camera-fov-presets`
**Gruppe:** B
**Status:** `done`
**Abhaengigkeiten:** S74 (Virtual Visitor), S87 (Input/Navigation), S101 (Mobile Status Client)

## Ziel

Kamera-FOV, Pose und Blickrichtung sollen als Presets pro Projekt speicherbar und abrufbar sein, inklusive schnellem Wechsel fuer Praesentation und Dokumentation.

Leitidee: consistent framing across teams.

---

## 1. Scope

In Scope:

- FOV-Setting fuer Perspektivkamera
- Preset CRUD (create/list/update/delete)
- Aktivieren eines Presets im Editor
- optionale Markierung als Standardpreset

Nicht in Scope:

- komplexe Kamerafahrten/Animationstimeline
- Multi-User Live-Kamerasynchronisation

---

## 2. Architektur

Frontend:

- CameraPresetPanel (Liste + Save current view)
- bidirektionale Bindung zwischen Kamera-Controls und Preset-State

Backend:

- persistence als project-scoped JSON records
- tenant-sichere API fuer Presetverwaltung

---

## 3. API

Geplante Endpunkte:

- `GET /projects/:id/camera-presets`
- `POST /projects/:id/camera-presets`
- `PATCH /projects/:id/camera-presets/:presetId`
- `DELETE /projects/:id/camera-presets/:presetId`
- `POST /projects/:id/camera-presets/:presetId/apply` (optional server ack)

Preset-Felder:

- `name`
- `position {x,y,z}`
- `target {x,y,z}`
- `fov`
- `mode` (`orbit`/`visitor`)
- `is_default`

---

## 4. UX-Anforderungen

- 1-Klick "Aktuelle Ansicht speichern"
- Default-Preset beim Projektstart automatisch laden
- Presets in Presentationsmodus nutzbar

---

## 5. Tests

Mindestens:

- 8+ API-Tests fuer Preset-CRUD + Tenant-Scoping
- 6+ Frontend-Tests fuer Save/Apply/Delete
- 3+ Regressionstests fuer bestehende Kamerasteuerung

---

## 6. DoD

- Kamera-Presets sind projektbezogen persistent
- FOV-Wert wird korrekt gespeichert und wiederhergestellt
- Default-Preset-Mechanik funktioniert reproduzierbar
- API/UI-Tests gruen

---

## 7. Nicht Teil von Sprint 106

- keyframebasierte Video-Tour-Erstellung
- Cloud-weit synchronisierte Preset-Sharing-Library

---

## 8. Implementierungsnotiz

- Backend-Endpunkte umgesetzt: `GET/POST/PATCH/DELETE /projects/:id/camera-presets` und `POST /projects/:id/camera-presets/:presetId/apply`
- Persistenz umgesetzt in `project_environments.config_json` unter `camera_presets` und `active_camera_preset_id`
- Editor-UI umgesetzt mit `CameraPresetPanel` (Save current view, Apply, Default, Delete)
- `Preview3D` um steuerbares Kamera-FOV (`fovDeg`) erweitert
- Default-/Active-Preset wird beim Projektstart automatisch geladen und lokal angewendet
- Preset-Auswahl auch im Praesentationsmodus eingebunden
- Testabdeckung ergaenzt: 8 API-Tests backend, 6 Frontend-Unit-Tests fuer Kamera-Preset-State
