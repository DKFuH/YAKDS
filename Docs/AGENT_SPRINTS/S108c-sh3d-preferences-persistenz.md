# Zwischensprint S108c - SH3D Preferences Persistenz

**Branch:** `feature/s108c-sh3d-preferences-persistenz`
**Gruppe:** C
**Status:** `done`
**Abhaengigkeiten:** S108a, S108b

## Ziel

SH3D-aehnliche Editor-Praeferenzen persistieren und reproduzierbar laden, statt Werte nur lokal pro Session zu halten.

## Scope

In Scope:
- Persistenzmodell fuer Grid, Magnetismus, Winkelraster und Laengenraster
- Saubere Initialisierung der Defaults plus Migration vorhandener Werte
- Kapselung von Lade-/Speicherlogik in eine zentrale Utility

Nicht in Scope:
- Serverseitige Tenant-Persistenz fuer alle Preferences
- Neue komplexe UI fuer Preset-Management

## Deliverables

- Persistenz Utility fuer Editor-Praeferenzen
- Integration in `planner-frontend/src/editor/usePolygonEditor.ts` und `planner-frontend/src/pages/Editor.tsx`
- Tests fuer Save/Load/Migration

## DoD

- Preferences sind nach Reload stabil wiederhergestellt
- Keine Regression bei bestehenden Editor-Defaults
- Tests und Build sind gruen

## Umsetzung (2026-03-05)

- Neue Persistenz-Utility eingefuehrt:
	- `planner-frontend/src/editor/editorPreferences.ts`
	- zentrale `loadEditorSettings`/`saveEditorSettings` API
- Migration unterstuetzt:
	- legacy key `yakds.polygonEditor.settings` wird auf `okp.polygonEditor.settings.v1` ueberfuehrt
- Integration in `planner-frontend/src/editor/usePolygonEditor.ts`:
	- Laden im Initial-State
	- Speichern bei Settings-Aenderung
- Testabdeckung fuer Save/Load/Migration:
	- `planner-frontend/src/editor/editorPreferences.test.ts`
