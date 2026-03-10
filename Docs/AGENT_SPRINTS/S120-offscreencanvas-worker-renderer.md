# Sprint 120 - OffscreenCanvas Worker-Renderer 3D-Preview

**Branch:** `main`
**Gruppe:** B
**Status:** `abgeschlossen`
**Abhaengigkeiten:** S119 (WebGPU-Renderer, OffscreenCanvas-Detection)
**Commit:** 75cb928

## Ziel

Verlagere den kompletten Three.js Render-Loop in einen dedizierten Web Worker
via `OffscreenCanvas.transferControlToOffscreen()`, sodass GPU-Arbeit und
Orbit-Controls den Main-Thread nicht blockieren.

## Ausfuehrungsstand 2026-03-10

### Umgesetzt

- **`planner-frontend/src/workers/preview3DWorker.ts`** (neu, ~720 LOC)
  - `EventProxy extends EventTarget` — DOM-Element-Proxy fuer OrbitControls:
    - `getBoundingClientRect()`, `clientWidth/Height`, `ownerDocument -> this`
    - nimmt weitergeleitete Pointer-/Wheel-Events vom Main-Thread entgegen
  - `handleInit()`: baut WebGPURenderer oder WebGLRenderer auf OffscreenCanvas,
    Scene, Camera, OrbitControls, Lights, Geometry; startet Render-Loop
  - `buildGeometry()`: Waende, Boden, Oeffnungen, Moeblierung, Treppenbboxen
    (identische Logik zu Preview3D.tsx, ohne React-Imports)
  - `animate()`: `setTimeout(animate, 0)` statt `requestAnimationFrame`
    (Worker hat kein rAF; OffscreenCanvas-Commit throttelt auf Display-vsync)
  - Dollhouse-Opacity-Animation (smooth lerp) im Worker
  - Camera-Emit via `self.postMessage({ type: 'cameraChanged', state })` max 12.5 Hz

- **Message-Protokoll Worker → Main:**
  - `ready { backend: 'webgpu' | 'webgl' }` — nach Renderer-Init
  - `cameraChanged { state }` — gedrosselt, nur bei Aenderung
  - `error { message }` — bei Renderer-Initialisierungsfehler

- **Message-Protokoll Main → Worker:**
  - `init { canvas, width, height, pixelRatio, rect, input, navigationSettings,
    showReference, fov, sunlight, renderEnvironment, autoDollhouseSettings, cameraState }`
  - `setFov { fov }` / `setSunlight { sunlight }` / `setRenderEnvironment { settings }`
  - `setCameraState { state }` / `setNavigationSettings { settings }`
  - `setAutoDollhouseSettings { settings }`
  - `resize { width, height, rect }`
  - `event { eventKind, eventType, clientX, clientY, ... }` (Pointer + Wheel)
  - `dispose` — stoppt Loop, disposed Renderer

- **`Preview3D.tsx`** (geaendert)
  - `useOffscreenWorker = isOffscreenCanvasSupported()` — nur Chromium-Pfad
  - Worker-useEffect: Canvas-Transfer, Worker-Spawn, Event-Forwarding,
    ResizeObserver, Cleanup via `worker.postMessage({ type: 'dispose' })`
  - Sekundaer-Effects (cameraState, fovDeg, sunlight, renderEnvironment,
    navigationSettings): senden bei aktivem Worker per postMessage ans Worker,
    sonst bisheriger Main-Thread-Pfad
  - JSX: `<canvas ref={canvasRef}>` fuer Worker-Pfad,
    `<div ref={rootRef}>` fuer WebGL-Fallback

### Verifikation

```
165/165 Tests gruen (lokale Ausfuehrung)
2 pre-existing Failures: MaterialBrowser.test.ts, MaterialPanel.test.ts
  (Fluent UI Badge FS-Lesefehler auf OneDrive, unabhaengig von diesem Sprint)
```

## Dateien

- `planner-frontend/src/workers/preview3DWorker.ts` (neu)
- `planner-frontend/src/components/editor/Preview3D.tsx` (geaendert)
- `Docs/AGENT_SPRINTS/S119-webgpu-renderer-3d-preview.md` (Item 1 als erledigt markiert)

## Architektur-Entscheidungen

- **`setTimeout(animate, 0)` statt rAF**: Web Worker hat kein `requestAnimationFrame`.
  `setTimeout(0)` laeuft so schnell wie der Browser erlaubt; die OffscreenCanvas-
  Commit-Mechanik throttelt automatisch auf Display-vsync (~60 fps).
- **`ownerDocument -> this` im EventProxy**: OrbitControls registriert
  `pointermove`/`pointerup` auf `domElement.ownerDocument`. Gibt der Proxy sich
  selbst zurueck, landen alle Events auf demselben EventTarget und werden korrekt
  empfangen — ohne echtes DOM im Worker.
- **Fallback beibehalten**: `useOffscreenWorker` ist `false` in Firefox/Safari
  (kein OffscreenCanvas oder kein Worker-Module-Support). Der bisherige
  Main-Thread-Pfad bleibt vollstaendig erhalten.

## Bekannte Einschraenkungen

- `requestAnimationFrame` nicht verfuegbar im Worker → `setTimeout`-Loop
  koennte bei sehr schwacher Hardware minimal mehr CPU beanspruchen
- Dollhouse-Settings-Aenderungen werden noch nicht live an den Worker gesendet
  (kein separater `setAutoDollhouseSettings`-Effect, nur im `init`)
- `forceWebGL`-UI (S119 Punkt 3) weiterhin offen
