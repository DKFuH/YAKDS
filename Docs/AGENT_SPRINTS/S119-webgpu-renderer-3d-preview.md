# Sprint 119 - WebGPU Renderer Integration 3D-Preview

**Branch:** `copilot/improve-3d-graphics-performance`
**Gruppe:** B
**Status:** `abgeschlossen`
**Abhaengigkeiten:** S107 (Skybox/HDRI), S108 (Screenshot/360-Export)
**Merged:** 2026-03-10 via PR #35

## Ziel

Ersetze den synchronen `WebGLRenderer` in der 3D-Preview durch Three.js `WebGPURenderer`
mit automatischem Fallback auf WebGL 2 fuer nicht-WebGPU-Umgebungen.

Leitidee:
- bessere Renderperformance in grossen Szenen fuer Chromium-basierte Browser
- kein Breaking-Change fuer Firefox, Safari oder Altgeraete
- saubere Capability-Detection als eigenstaendiges Modul
- Grundlage fuer kuenftige OffscreenCanvas-Worker-Architektur

## Ausfuehrungsstand 2026-03-10

### Umgesetzt (gemergt mit PR #35)

- **`rendererCapabilities.ts`** (neu)
  - `isWebGPUSupported()` - synchrone, allokationsfreie Pruefung via `navigator.gpu`
  - `isOffscreenCanvasSupported()` - Verfuegbarkeitspruefung fuer Worker-Rendering
  - `detectRendererCapabilities()` - kombinierter Capability-Snapshot
  - `createSceneRenderer()` - Factory-Funktion mit dynamischem `three/webgpu`-Import
    und automatischem WebGL-Fallback via `forceWebGL`-Option
  - `forceWebGL`-Option fuer Debug-/Kompatibilitaetsszenarien

- **`Preview3D.tsx`** (geaendert)
  - async Renderer-Initialisierung via `initRenderer()` / `setupScene()`
  - `disposed`-Flag-Guard gegen Race-Condition bei schnellem Mount/Unmount
  - `rendererBackend`-State zeigt aktives Backend (WebGPU / WebGL) in der Toolbar
  - Fallback-Cleanup wenn `setupScene` nie ausgefuehrt wurde

- **`rendererCapabilities.test.ts`** (neu)
  - 9 Unit-Tests fuer WebGPU-Detection, OffscreenCanvas und Capability-Snapshot
  - alle Tests gruen (165 gesamt)

- **Bundle**
  - `three/webgpu` wird per dynamischem Import als separater Chunk geladen (540 kB raw / 153 kB gzip)

### Noch offen

**1. OffscreenCanvas Worker-Rendering** (Prio: mittel) → **umgesetzt in S120**
  - `preview3DWorker.ts` implementiert; `Preview3D.tsx` nutzt Worker-Pfad wenn OffscreenCanvas verfuegbar

**2. `renderer.init()` in `createSceneRenderer` verlagern** (Prio: niedrig, Cleanuparbeit)
  - aktuell muss der Aufrufer `await renderer.init()` manuell aufrufen nach `createSceneRenderer()`
  - fuehrt zu Fehler wenn Caller `init()` vergisst
  - sauberere API: Factory erledigt `init()` intern, gibt fertigen Renderer zurueck

**3. `forceWebGL`-Flag fuer den Nutzer exponieren** (Prio: niedrig)
  - aktuell nur als Code-Option in `CreateRendererOptions`
  - kein UI-Fallback wenn WebGPU im Browser instabil oder buggy ist
  - moegliche Loesung: Setting in Editor-Preferences oder URL-Parameter

**4. Error-Boundary fuer `renderer.init()` Fehler** (Prio: niedrig)
  - aktuell: `initRenderer().catch((err) => console.error(...))`
  - kein Nutzerfeedback bei Renderer-Initialisierungsfehler
  - sollte sichtbare Fehlermeldung im Preview-Bereich ausloesen

**5. `rendererBackend`-State bei Remount zuruecksetzen** (Prio: kosmetisch)
  - nach Unmount und erneutem Mount zeigt die Toolbar kurz das alte Backend
  - tritt auf wenn die `useEffect`-Abhaengigkeiten einen Rerender ausloesen
  - Loesung: `setRendererBackend(null)` am Anfang des Effect-Cleanup

**6. Bundle-Optimierung: three/webgpu nur fuer WebGPU-Browser laden** (Prio: langfristig)
  - der 153 kB gzip-Chunk wird aktuell bei jedem Preview-Aufruf geladen
  - auch fuer Browser ohne WebGPU-Unterstuetzung (WebGL-Fallback)
  - moegliche Loesung: fruehe Capability-Detection vor dem dynamischen Import,
    bei `webgpu: false` direkt `THREE.WebGLRenderer` laden statt `three/webgpu`

## Dateien

- `planner-frontend/src/components/editor/rendererCapabilities.ts` (neu)
- `planner-frontend/src/components/editor/rendererCapabilities.test.ts` (neu)
- `planner-frontend/src/components/editor/Preview3D.tsx` (geaendert)
- `package-lock.json` (peer-Flag-Bereinigungen)

## Verifikation

```
cd planner-frontend && npx vitest run src/components/editor/rendererCapabilities.test.ts
```

157 Tests bestanden (Copilot-CI) / 165 Tests bestanden (lokal, inkl. neuer Tests)

## Bekannte Pre-existing Failures (nicht durch diesen Sprint verursacht)

- `src/components/catalog/MaterialBrowser.test.ts` - Fluent UI Badge FS-Lesefehler
- `src/components/editor/MaterialPanel.test.ts` - Fluent UI Badge FS-Lesefehler

Beide Failures existieren auf `main` unabhaengig von diesem Sprint.

## Risiken

- WebGPU ist in Chromium stabil, in Firefox und Safari noch experimentell/begrenzt
- Fallback auf WebGL funktioniert, aber `three/webgpu` wird trotzdem immer geladen (Punkt 6)
- async Initialisierung erfordert sorgfaeltiges Cleanup (Punkt 2, aktuell durch `disposed`-Flag geloest)

## Naechster Fokus (Folge-Sprint)

- OffscreenCanvas Worker-Rendering (Punkt 1)
- Bundle-Optimierung WebGPU-Chunk (Punkt 6)
