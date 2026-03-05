# Zwischensprint S108d - SH3D Wall-Topologie Robustheit

**Branch:** `feature/s108d-sh3d-wall-topologie-robustheit`
**Gruppe:** C
**Status:** `done`
**Abhaengigkeiten:** S108a, S108b

## Ziel

Wandoperationen topologisch robust machen (`split`, `join`, `reverse`, `move`) inklusive konsistenter Nachbar- und Oeffnungsbeziehungen.

## Scope

In Scope:
- Split/Join-Operationen mit stabiler Geometrie und Referenzuebernahme
- Reverse/Move ohne Verlust von Beziehungen
- Oeffnungs-Rebind bei Wandumbauten

Nicht in Scope:
- Vollstaendige Arc-Wall-Einfuehrung
- IFC-spezifische Topologieabgleiche

## Deliverables

- Robuste Wand-Operationen in den relevanten Editor-/Model-Pfaden
- Rebind-Strategie fuer Oeffnungen
- Regressionstests fuer typische Umbau-Sequenzen

## DoD

- Keine inkonsistenten Nachbarverweise nach Split/Join
- Oeffnungen bleiben nach Wandoperationen valide zugeordnet
- Tests und Build sind gruen

## Umsetzung (2026-03-05)

- Neue Topologie-Utility in `planner-frontend/src/editor/roomTopology.ts`:
	- Rebind fuer wandgebundene Objekte (`Opening`, `Placement`) bei geaenderter Wall-Topologie.
	- Reverse-Erkennung fuer gleichbleibende Wall-IDs mit gespiegelter Offset-Berechnung.
	- Nearest-Wall-Rebind bei geaenderten/neu erzeugten Wall-IDs (Split/Join-aehnliche Umbauten).
- Integration in Save-Flow in `planner-frontend/src/components/editor/CanvasArea.tsx`:
	- Rebind wird nach Boundary-Speicherung automatisch ausgefuehrt.
	- Geaenderte Oeffnungen/Placements werden an den Editor zur Persistenz zurueckgemeldet.
- Stabilisierung der Wall-ID-Persistenz in `planner-frontend/src/editor/usePolygonEditor.ts`:
	- Neuer `LOAD_BOUNDARY`-Pfad mit expliziten `wallIds`.
	- Verhindert ID-Drift zwischen Canvas-State und persistierter Boundary.
