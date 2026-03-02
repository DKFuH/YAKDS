# Sprint 56 – Canvas-Editor UX: Wand-Interaktoren & Live-Bemaßung

**Branch:** `feature/sprint-56-canvas-ux`
**Gruppe:** A (sofort startbar – nur Frontend, kein DB, keine API)
**Status:** `done`

---

## Ziel

Wand-Handles direkt im 2D-Grundriss verschiebbar; Maße aktualisieren sich live;
Stage-Sizing-Bug behoben; Keyboard-Shortcuts.

---

## Kontext (bereits vorhanden)

| Datei | Inhalt |
|-------|--------|
| `planner-frontend/src/editor/PolygonEditor.tsx` | Konva-Stage, Layer, Vertices, Edges, Openings |
| `planner-frontend/src/editor/usePolygonEditor.ts` | State-Hook für Polygon-Editing |
| `planner-frontend/src/components/editor/CanvasArea.tsx` | Wrapper um PolygonEditor |
| `planner-frontend/src/components/editor/CanvasArea.module.css` | CSS |

---

## 1. Stage-Sizing-Fix in `CanvasArea.tsx`

**Problem:** Konva-Stage hat feste oder falsche Höhe → Info-Bar wird abgeschnitten.

**Lösung:** `ResizeObserver` auf dem Container-Div, der die verfügbare Höhe (Container-Höhe abzüglich Toolbar-Höhe) als State hält.

Finde in `CanvasArea.tsx` den Teil, der `width` und `height` an `<PolygonEditor>` übergibt.
Ersetze die statischen Werte durch:

```typescript
const containerRef = useRef<HTMLDivElement>(null)
const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 })

useEffect(() => {
  if (!containerRef.current) return
  const observer = new ResizeObserver(entries => {
    const entry = entries[0]
    if (!entry) return
    setCanvasSize({
      width: Math.floor(entry.contentRect.width),
      height: Math.floor(entry.contentRect.height),
    })
  })
  observer.observe(containerRef.current)
  return () => observer.disconnect()
}, [])
```

Wrape den PolygonEditor-Bereich in ein `<div ref={containerRef} style={{ flex: 1, overflow: 'hidden' }}>` und übergib `canvasSize.width` / `canvasSize.height` an `<PolygonEditor>`.

---

## 2. Wand-Interaktoren in `PolygonEditor.tsx`

Im `select`-Modus: Pro Kante einen Mittelpunkt-Griff (Raute/Diamond) anzeigen.
Ziehen des Mittelpunkt-Griffs verschiebt die gesamte Wand parallel (beide Endpoints gleichzeitig).

Füge in `PolygonEditor.tsx` folgendes in den `<Layer>` ein (nach den bestehenden Edge-Lines, vor den Vertices):

```tsx
{/* Mittelpunkt-Griffe für Wand-Verschiebung */}
{state.closed && state.tool === 'select' && (
  <Group>
    {pts.map((p, i) => {
      const next = pts[(i + 1) % pts.length]
      const mx = (p.x + next.x) / 2
      const my = (p.y + next.y) / 2
      return (
        <Rect
          key={`mid-${state.wallIds[i] ?? i}`}
          x={mx}
          y={my}
          width={10}
          height={10}
          offsetX={5}
          offsetY={5}
          rotation={45}
          fill={COLOR.edgeSelected}
          opacity={0.85}
          draggable
          onDragMove={(e) => {
            // Beide Vertices der Wand um delta verschieben
            const dx = canvasToWorld(e.target.x() - mx)
            const dy = canvasToWorld(e.target.y() - my)
            const iV = i
            const iNext = (i + 1) % state.vertices.length
            const vI = state.vertices[iV]
            const vNext = state.vertices[iNext]
            onMoveVertex(iV, { x_mm: vI.x_mm + dx, y_mm: vI.y_mm + dy })
            onMoveVertex(iNext, { x_mm: vNext.x_mm + dx, y_mm: vNext.y_mm + dy })
            e.target.x(mx)
            e.target.y(my)
          }}
        />
      )
    })}
  </Group>
)}
```

---

## 3. Live-Dimensioning Label in `PolygonEditor.tsx`

Zeige beim Dragging eines Vertex die aktuelle Kantenlänge als fliegendes Label.

Füge State hinzu: `const [dragLabel, setDragLabel] = useState<{ x: number; y: number; text: string } | null>(null)`

In der Vertex-`Circle`-Komponente `onDragMove` ergänzen:
```tsx
onDragMove={(e) => {
  const x = e.target.x()
  const y = e.target.y()
  // Länge zu Nachbarvertex berechnen
  const nextIdx = (i + 1) % pts.length
  const prevIdx = (i - 1 + pts.length) % pts.length
  const toNext = Math.hypot(
    canvasToWorld(pts[nextIdx].x - x),
    canvasToWorld(pts[nextIdx].y - y)
  )
  setDragLabel({
    x: x + 12,
    y: y - 16,
    text: `${Math.round(toNext)} mm`,
  })
}}
onDragEnd={(e) => {
  setDragLabel(null)
  onMoveVertex(i, {
    x_mm: canvasToWorld(e.target.x()),
    y_mm: canvasToWorld(e.target.y()),
  })
}}
```

Füge im `<Layer>` ein Label hinzu (nach allen anderen Shapes):
```tsx
{dragLabel && (
  <Group>
    <Rect
      x={dragLabel.x - 4}
      y={dragLabel.y - 12}
      width={dragLabel.text.length * 7 + 8}
      height={18}
      fill="rgba(0,0,0,0.75)"
      cornerRadius={3}
    />
    <Text
      x={dragLabel.x}
      y={dragLabel.y - 10}
      text={dragLabel.text}
      fill="white"
      fontSize={12}
      fontFamily="monospace"
    />
  </Group>
)}
```

Importiere `Text` aus `react-konva`.

---

## 4. Keyboard-Shortcuts

In `PolygonEditor.tsx` füge einen `useEffect` für Keyboard-Events hinzu:

```typescript
useEffect(() => {
  function handleKey(e: KeyboardEvent) {
    // Nicht triggern wenn User in einem Input tippt
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
    if (e.key === 'd' || e.key === 'D') onSetTool('draw')
    if (e.key === 's' || e.key === 'S') onSetTool('select')
    if ((e.key === 'Backspace' || e.key === 'Delete') && state.selectedIndex !== null) {
      onDeleteVertex(state.selectedIndex)
    }
    if (e.key === 'Escape') {
      onSelectVertex(null)
      onSelectEdge(null)
    }
  }
  window.addEventListener('keydown', handleKey)
  return () => window.removeEventListener('keydown', handleKey)
}, [state.selectedIndex, state.tool, onSetTool, onDeleteVertex, onSelectVertex, onSelectEdge])
```

---

## 5. Info-Bar Hinweis aktualisieren

In der `<div className={styles.info}>` Sektion am Ende von `PolygonEditor.tsx`,
den select-Hinweis erweitern:

```tsx
{state.tool === 'select' && (
  <span>Ziehen: Punkt/Wand verschieben · Doppelklick: löschen · D=Zeichnen · S=Auswählen · Esc=Abwählen</span>
)}
```

---

## 6. Kein neues Backend erforderlich

Dieser Sprint ist rein Frontend. Keine DB-Änderungen, keine API-Änderungen.

---

## DoD-Checkliste

- [ ] Stage-Größe passt sich dynamisch an Container an (Info-Bar vollständig sichtbar)
- [ ] Im Select-Modus: Raute-Griff auf Kantenmitte sichtbar
- [ ] Raute-Griff ziehen → beide Wandvertices bewegen sich parallel
- [ ] Beim Vertex-Drag: Live-Label mit Kantenlänge in mm sichtbar
- [ ] Tastenkürzel funktionieren: `D`=draw, `S`=select, `Backspace`=löschen, `Esc`=abwählen
- [ ] ROADMAP.md Sprint 56 Status → `done`
- [ ] Commit + PR `feature/sprint-56-canvas-ux`
