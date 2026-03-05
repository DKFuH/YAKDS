# Zwischensprint S108f - SH3D Dimension Assist und Multi-View-Objekte

**Branch:** `feature/s108f-sh3d-dimension-assist-und-multiview`
**Gruppe:** C
**Status:** `done`
**Abhaengigkeiten:** S108a-S108e

## Ziel

Kontextsensitive Bemaessungshilfen und konsistente Objektabbildung ueber Draufsicht, 3D und Wandansicht aufbauen.

## Scope

In Scope:
- Bemaessungsvorschlaege fuer Wandparallelitaet und Oeffnungsabstaende
- Live-Massfeedback in relevanten Edit-Flows
- Synchronisationsgrundlagen fuer Fenster/Tueren als durchgaengige Entities

Nicht in Scope:
- Vollstaendige Layout-Sheet-Neuarchitektur
- Erweiterte Render-Annotationen

## Deliverables

- Dimension-Assist-Logik mit Testabdeckung
- Synchronisationspfade fuer Fenster/Tueren ueber mehrere Views
- UI-Hinweise fuer kontextuelle Messvorschlaege

## DoD

- Bemaessungsvorschlaege sind reproduzierbar und kontextstabil
- Fenster/Tueren zeigen konsistente Kernattribute in den relevanten Views
- Tests und Build sind gruen

## Umsetzung (2026-03-05)

- Dimension-Assist in `planner-frontend/src/editor/roomTopology.ts`:
	- `buildDimensionAssistSegments` erzeugt kontextsensitive Mess-Segmente aus Wandstart/-ende, Oeffnungen und Placements.
	- Deduplizierung naher Markerpunkte fuer stabile Vorschlagsketten.
- UI-Integration in `planner-frontend/src/components/editor/RightSidebar.tsx`:
	- EdgePanel zeigt `Dimension Assist`-Liste mit Segment-Herkunft und Laenge.
	- Neue Styles in `planner-frontend/src/components/editor/RightSidebar.module.css`.
- Multi-View-Konsistenz fuer Oeffnungen:
	- `normalizeOpeningForMultiview` harmonisiert Kernattribute (`offset_mm`, `width_mm`, `height_mm`, `sill_height_mm`) nach Typ.
	- Wird bei Add/Update im Editor-Flow genutzt (`planner-frontend/src/pages/Editor.tsx`).
