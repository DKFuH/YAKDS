# Sprint 80 - Viewer-Export-Plugin & Vektor-Exporte

**Branch:** `feature/sprint-80-viewer-export-plugin`
**Gruppe:** B (startbar nach S69 und S76)
**Status:** `planned`
**Abhaengigkeiten:** S64 (Layout-Sheets), S69 (Panorama-Touren), S76 (Praesentationsmodus)

---

## Ziel

Planungen leichter teilen und exportieren: ein eigenstaendiger HTML/WebGL
Viewer fuer Kunden und Partner sowie Vektor-Exporte fuer Grundriss- und
Sheet-Grafiken.

Inspiration: Sweet Home 3D Export to HTML5, Export plan image, Side View.

**Plugin-Zuschnitt:** `viewer-export`

---

## 0. Plugin-Einordnung

Das Plugin kapselt:

- HTML/WebGL-Viewer-Export
- SVG-/Vektor-Export-Aktionen
- Exportseite und Download-UI

Der Core liefert nur:

- Exportjob-/Document-Basis
- Share-/Token-Infrastruktur
- Plugin-Slots in Export- und Projekt-UI

---

## 1. Backend

Neue oder angepasste Dateien:

- `planner-api/src/plugins/viewerExport.ts`
- `planner-api/src/routes/viewerExports.ts`
- `planner-api/src/services/vectorExportService.ts`

Endpoints:

- `POST /projects/:id/export/html-viewer`
- `POST /projects/:id/export/plan-svg`
- `POST /layout-sheets/:id/export/svg`

HTML-Viewer-V1:

- statisches Exportpaket mit Projektmetadaten, Kameraeinstieg und Assets
- lauffaehig im Browser ohne Editor-UI
- optional token-geschuetzter Share-Link

Vektor-Export-V1:

- SVG fuer Grundriss
- SVG fuer Layout-Sheet
- optionale Seitenansicht aus bestehender Geometrie

---

## 2. Frontend

Neue oder angepasste Dateien:

- `planner-frontend/src/plugins/viewerExport/*`
- `planner-frontend/src/api/viewerExports.ts`
- `planner-frontend/src/pages/ExportsPage.tsx`

Funktionen:

- Exportaktionen fuer `HTML Viewer`, `SVG Grundriss`, `SVG Sheet`
- Vorschau/Download der Exportartefakte
- Hinweise zu Einbettung oder Versand an Kunden

---

## 3. Technische Leitplanken

- keine Kopie des kompletten Editors in den Viewer exportieren
- Viewer bekommt nur lesende Daten und definierte Kamera-/Tourdaten
- SVG-Ausgabe soll druckbar und layout-stabil sein
- keine globale Core-Exportseite fuer Plugin-Features

---

## 4. Deliverables

- HTML-Viewer-Export
- SVG-Export fuer Plan und Sheet
- optional einfache Seitenansicht
- Export-UI im Frontend
- Plugin-Registrierung und tenant-aware Aktivierung
- 8-12 Tests

---

## 5. DoD

- Nutzer kann eine Planung als HTML-Viewer exportieren
- Grundriss und Sheet lassen sich als SVG exportieren
- Exportdaten sind ohne Editor verwendbar
- Viewer/Export respektieren Tenant- und Share-Regeln
