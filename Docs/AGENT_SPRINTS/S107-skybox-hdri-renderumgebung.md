# Sprint 107 - Skybox/HDRI-Auswahl fuer Render- und Praesentationsmodus

**Branch:** `feature/sprint-107-skybox-hdri-environment`
**Gruppe:** B
**Status:** `done`
**Abhaengigkeiten:** S76 (Render UX), S77 (Daylight), S78 (Materialbibliothek)

## Ziel

Render- und Praesentationsmodus sollen eine konfigurierbare Umgebung erhalten (Skybox/HDRI/Himmel-Boden-Stile), um realistischere und kontrollierte Szenenwirkung zu erzeugen.

Leitidee: environment as first-class render input.

---

## 1. Scope

In Scope:

- Auswahl vordefinierter Environments (studio/daylight/interior)
- projektbezogene Speicherung der Environment-Konfiguration
- Integration in RenderJobs und Live-Preview
- fallback auf existierendes Tageslichtsystem

Nicht in Scope:

- frei hochladbare HDRI-Dateien in V1
- physikalisch vollstaendige Pathtracing-Umgebung

---

## 2. Architektur

Frontend:

- EnvironmentPanel mit Preset-Kacheln
- Parameter: intensity, rotation, groundTint

Backend:

- Erweiterung project environment config
- RenderJob-Payload uebernimmt environment preset id + parameter

---

## 3. API

Geplante Endpunkte/Erweiterungen:

- `GET /projects/:id/render-environments`
- `PATCH /projects/:id/render-environment`
- Erweiterung `POST /render-jobs` um `environment`-Block

---

## 4. UX-Anforderungen

- schneller Wechsel ohne sichtbaren Szenenbruch
- klare Trennung zwischen Licht (Sun) und Umgebung (Skybox/HDRI)
- Presets mit visueller Vorschau

---

## 5. Tests

Mindestens:

- 6+ API-Tests fuer Environment-Konfiguration
- 6+ Frontend-Tests fuer Preset-Wechsel
- 4+ Render-Route-Regressionstests fuer Payload-Kompatibilitaet

---

## 6. DoD

- Environment-Preset ist in Preview und Renderjob wirksam
- Projekt speichert und laedt Environment stabil
- Tageslicht-Fallback funktioniert bei fehlendem Preset
- Tests gruen

---

## 7. Nicht Teil von Sprint 107

- User Upload eigener HDRI-Pakete
- Marketplace fuer Umgebungsbibliotheken

---

## 8. Implementierungsnotiz

- Backend-Endpunkte umgesetzt: `GET /projects/:id/render-environments` und `PATCH /projects/:id/render-environment`
- Persistenz umgesetzt in `project_environments.config_json.render_environment`
- Render-Job API erweitert: `POST /projects/:id/render-jobs` akzeptiert `environment` und schreibt `render_environment` in `scene_payload`
- Fallback umgesetzt: ohne Request-Environment wird Projektkonfiguration genutzt, sonst Default `daylight`
- Editor erweitert um `RenderEnvironmentPanel` (Preset-Kacheln, intensity, rotation, groundTint) mit projektbezogenem Save
- Praesentationsmodus erweitert: gleiche Environment-Steuerung, Preview-Integration und Render-Export mit Environment-Block
- `Preview3D` erweitert um Environment-Look (Sky-/Ground-Farbe, Environment-Lights, Rotationswirkung)
- Tests ergaenzt: 8 API-Tests fuer Environment-Routes, 4 Render-Route-Regressionen, 7 Frontend-Unit-Tests fuer Environment-State
