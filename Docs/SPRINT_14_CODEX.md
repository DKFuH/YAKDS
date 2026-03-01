# SPRINT_14_CODEX.md

## Umfang

Umsetzung Sprint 14 (Browser-3D-Preview) im bestehenden Editor-Flow:

- 3D-Vorschau für Raumgrundriss
- extrudierte Wände
- Proxy-Meshes für Möbelplatzhalter
- Orbit/Zoom/Pan
- Referenzgeometrie ein-/ausblendbar

## Umgesetzte Dateien

- `planner-frontend/src/components/editor/Preview3D.tsx`
- `planner-frontend/src/components/editor/Preview3D.module.css`
- `planner-frontend/src/pages/Editor.tsx`
- `planner-frontend/package.json`

## Ergebnis Sprint 14

Implementiert wurde:

- neuer 3D-Preview-View auf Basis `three` + `OrbitControls`
- Umschaltung im Editor zwischen `2D Editor` und `3D Preview`
- Bodenfläche aus Raum-Polygon (`ShapeGeometry` / Triangulation)
- Wände als 3D-Volumen (Box-Geometrie entlang Wandsegmente)
- Platzierungen als Proxy-Meshes (Boxen) aus `room.placements`
- Referenz-Overlay (Wandlinien + Öffnungsmarker) per Toggle ein-/ausblendbar

## DoD-Status Sprint 14

- Floor-Polygon trianguliert und gerendert: **erfüllt**
- Wände extrudiert: **erfüllt**
- Proxy-Meshes für Möbel: **erfüllt**
- Orbit/Zoom/Pan: **erfüllt**
- Referenzgeometrie ein-/ausblendbar: **erfüllt**

## Verifikation

- Frontend Build (`npm --prefix planner-frontend run build`) erfolgreich
- TypeScript-Fehler zu Three.js durch `@types/three` behoben

## Hinweise

- Vite meldet ein großes Bundle-Chunck-Warning (>500 kB) durch 3D-Abhängigkeit.
- Funktional ist der Build grün; optional kann später per Lazy-Loading code-gesplittet werden.

## Nächster Sprint

Sprint 15:

- Render-Job-System (Queue/Worker-Anbindung)
- Job-Status-Tracking
- Ergebnisbilder an Projekt/Angebot anbinden
