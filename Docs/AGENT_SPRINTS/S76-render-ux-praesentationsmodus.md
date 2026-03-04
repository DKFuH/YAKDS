# Sprint 76 - Render-UX & Praesentationsmodus

**Branch:** `feature/sprint-76-render-ux-presentation`
**Gruppe:** B (startbar nach S61 und S74)
**Status:** `planned`
**Abhaengigkeiten:** S14 (3D-Preview), S69 (Panorama), S74 (Split-View)

---

## Ziel

Rendering und Kundenpraesentation vereinfachen: wenige klare
Qualitaetsstufen fuer Bild-/Videoexport, schneller Praesentationsmodus ohne
Editorrauschen und direkte Nutzung vorhandener Kamera-/Tourdaten.

Inspiration: Sweet Home 3D Foto-/Video-Export mit wenigen Presets.

---

## 1. Konfiguration

Bestehende Render- oder Projektsettings um einfache Presets erweitern:

```json
{
  "render_preset": "balanced",
  "presentation_mode": {
    "hide_editor_panels": true,
    "show_branding": true,
    "loop_tour": false
  }
}
```

Erlaubte Render-Presets:

- `draft`
- `balanced`
- `best`

V1 bewusst ohne frei definierbare 30-Parameter-Engine.

---

## 2. Backend

Betroffene Routen:

- `renderJobs.ts`
- optional neue Route `presentation.ts`

Erweiterungen:

- Renderjob kann `preset` entgegennehmen
- serverseitige Ableitung von Samples, Shadow-Qualitaet und Aufloesung
- vorhandene Panorama- oder Kamera-Sets koennen als Quelle genutzt werden

Optionaler Endpoint:

- `POST /projects/:id/presentation-sessions`

liefert ein leichtgewichtiges Payload fuer den Praesentationsmodus mit:

- Projektname
- Branding-Infos
- bevorzugter Kameraeinstieg
- vorhandene Panorama-Touren

---

## 3. Frontend

Neue oder angepasste Dateien:

- `planner-frontend/src/pages/PresentationModePage.tsx`
- `planner-frontend/src/api/presentation.ts`
- Anpassungen in `Preview3D.tsx`, `Editor.tsx`, `renderJobs` UI

Funktionen:

- Toggle `Praesentationsmodus`
- ausgeblendete Sidebars und reduzierte Controls
- Render-Preset-Auswahl: `Schnell`, `Ausgewogen`, `Beste`
- Export-Button fuer Bild und optional Kamerafahrt/Video
- Start aus Split-View oder aus Panorama-Tour

UX:

- Fokus auf Kundenpraesentation statt Bearbeitung
- grosse Controls, wenige Optionen
- Branding nur aus TenantSettings

---

## 4. Qualitaetsmapping

Beispiel:

- `draft`: schnelle Schatten, reduzierte Aufloesung
- `balanced`: Standard fuer Kundenentwuerfe
- `best`: hoehere Samples und Aufloesung, laengerer Export

Die konkrete Rendertechnik bleibt eure Implementierung; wichtig ist die
stabile Produkt-API, nicht ein bestimmter Shader-Ansatz.

---

## 5. Deliverables

- Render-Presets in Backend und Frontend
- Praesentationsmodus-Seite
- vereinfachte Export-UI fuer Bild/Video
- Verknuepfung zu Panorama-Touren oder Visitor-Kameras
- 8-12 Tests
- Frontend-Build gruen

---

## 6. DoD

- Nutzer kann zwischen drei Render-Presets waehlen
- Praesentationsmodus blendet Editorrauschen aus
- Bildexport nutzt das ausgewaehlte Preset sichtbar
- Einstieg aus Split-View oder Tour ist moeglich
- Tenant-Branding wird korrekt uebernommen

