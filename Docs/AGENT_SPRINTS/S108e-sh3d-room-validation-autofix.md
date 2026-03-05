# Zwischensprint S108e - SH3D Room-Validation und Auto-Fix

**Branch:** `feature/s108e-sh3d-room-validation-autofix`
**Gruppe:** C
**Status:** `done`
**Abhaengigkeiten:** S108d

## Ziel

Raumgeometrie robust validieren und haeufige Fehlerbilder optional automatisch korrigieren.

## Scope

In Scope:
- Validierung auf Selbstueberschneidung, Doppelpunkte, Nullkanten, Orientierung
- Auto-Fix fuer klar behebbare Faelle
- Nutzerverstaendliche Fehlermeldungen und klare Korrekturvorschlaege

Nicht in Scope:
- Vollautomatische Korrektur stark fehlerhafter Freiformgrundrisse
- Komplexe interaktive Repair-UI

## Deliverables

- Validierungs-/Fix-Utilities fuer Raumkonturen
- Integration in Save- und relevante Edit-Pfade
- Unit-Tests fuer typische Fehlerfaelle

## DoD

- Kritische Geometriefehler werden vor Persistierung erkannt
- Auto-Fix funktioniert fuer definierte Standardfaelle reproduzierbar
- Tests und Build sind gruen

## Umsetzung (2026-03-05)

- Neue Auto-Fix-/Validierungslogik in `planner-frontend/src/editor/roomTopology.ts`:
	- Entfernt Duplicate-Closure / doppelte aufeinanderfolgende Punkte.
	- Entfernt Nullkanten (degenerierte Kantenlaengen).
	- Erzwingt konsistente CCW-Orientierung.
	- Fuehrt anschliessend `validatePolygon` aus und liefert Fehlerliste fuer Save-Gating.
- Save-Integration in `planner-frontend/src/components/editor/CanvasArea.tsx`:
	- Vor Persistierung wird `autofixBoundaryVertices` ausgefuehrt.
	- Persistierung stoppt bei verbleibenden kritischen Validierungsfehlern.
	- Boundary wird mit normalisierten Vertices/Wall-Segmenten gespeichert.
- Testabdeckung:
	- Neue Suite `planner-frontend/src/editor/roomTopology.test.ts` deckt Auto-Fix-Faelle ab.
