# Sprint 108 - One-click Screenshot und 360-Einzelexport

**Branch:** `feature/sprint-108-screenshot-and-360-export`
**Gruppe:** C
**Status:** `done`
**Abhaengigkeiten:** S69 (Panorama Tour), S80 (Viewer/Exports), S107 (Environment Presets)

## Ziel

Der Editor soll einen sofort nutzbaren Screenshot-Flow erhalten sowie einen standardisierten 360-Einzelexport (Datei/Asset), unabhaengig von einem kompletten Tour-Setup.

Leitidee: capture now, share instantly.

---

## 1. Scope

In Scope:

- One-click Screenshot aus aktiver Ansicht
- Exportoptionen (PNG/JPEG, Aufloesung, transparent background optional)
- 360-Einzelexport als eigenstaendiges Asset/Datei
- Metadatenablage im Dokument-/Exportkontext

Nicht in Scope:

- Videoaufnahme/Screenrecording
- Mehrpunkt-Tourauthoring (bleibt bei Panorama Tours)

---

## 2. Architektur

Frontend:

- Capture-Button in Toolbar (Editor + Praesentationsmodus)
- Exportdialog fuer Format/Qualitaet/Aufloesung

Backend:

- Endpoint fuer Screenshot-Upload/Archivierung
- Endpoint fuer 360-Einzelexport-Job
- Anbindung an bestehende Dokument-/Exportpfade

---

## 3. API

Geplante Endpunkte:

- `POST /projects/:id/screenshot`
- `POST /projects/:id/export-360`
- `GET /projects/:id/export-360/:jobId`

Antworten:

- Download-URL oder Job-ID
- status (`queued`, `done`, `failed`)
- optionale Vorschau-URL

---

## 4. UX-Anforderungen

- maximal 2 Interaktionen bis fertigem Screenshot
- Erfolgsmeldung mit direktem Zugriff auf Datei
- 360-Export klar vom Tour-Feature abgegrenzt

---

## 5. Tests

Mindestens:

- 8+ API-Tests fuer Screenshot/360-Endpoints
- 5+ Frontend-Tests fuer Toolbar-Flow
- 3+ Regressionstests gegen bestehende Export-Routen

---

## 6. DoD

- Screenshot-Flow funktioniert aus plan/3d/split Ansicht
- 360-Einzelexport erzeugt nutzbares Artefakt oder Job-Status
- Exportresultate sind im Projektkontext auffindbar
- API/UI-Tests gruen

---

## 7. Nicht Teil von Sprint 108

- automatische Stapel-Rendering-Pipelines
- komplexes Freigabe-/Review-Workflow fuer Medienassets

---

## 8. Umsetzung (2026-03-05)

- Backend-API implementiert:
	- `POST /projects/:id/screenshot`
	- `POST /projects/:id/export-360`
	- `GET /projects/:id/export-360/:jobId`
- Screenshot-Ablage ueber bestehende Dokument-Registry im Projektkontext.
- 360-Einzelexport als Render-Job mit Status-Polling und Download/Preview-URL.
- Editor-Toolbar erweitert um Screenshot-Optionen (Format, Aufloesung, Qualitaet, Transparenz), Upload und 360-Export.
- Praesentationsmodus erweitert um denselben Capture-/360-Flow inklusive Statusanzeige.
- Tests:
	- Backend: `mediaCapture.test.ts` (10 Tests) plus bestehende Render-Regressionen.
	- Frontend: `screenshotCapture.test.ts` (6 Tests), komplette Frontend-Test-Suite gruen.
