# Sprint 58 – Grundriss-Nachzeichnen: Bildimport als Canvas-Overlay

**Branch:** `feature/sprint-58-bild-nachzeichnen`
**Gruppe:** C
**Status:** `done`

---

## Ziel

JPG/PNG als halbtransparentes Hintergrundbild in den Canvas laden, skalieren,
rotieren und als Referenz zum Nachzeichnen nutzen. Maßstab-Kalibrierung per Referenzlinie.

---

## 1. Prisma-Schema-Änderung

In `planner-api/prisma/schema.prisma`, Modell `Room` (bestehend):

Füge nach `lighting_profiles` folgende Zeile ein:
```prisma
  reference_image     Json?    // { url, x, y, rotation, scale, opacity }
```

---

## 2. Neuer API-Endpunkt: `planner-api/src/routes/rooms.ts` erweitern

Lese `planner-api/src/routes/rooms.ts`. Füge hinzu:

```typescript
const ReferenceImageSchema = z.object({
  url: z.string().url(),
  x: z.number().optional(),
  y: z.number().optional(),
  rotation: z.number().min(-360).max(360).optional(),
  scale: z.number().min(0.01).max(100).optional(),
  opacity: z.number().min(0).max(1).optional(),
})

// PUT /rooms/:id/reference-image
app.put<{ Params: { id: string } }>('/rooms/:id/reference-image', async (request, reply) => {
  const parsed = ReferenceImageSchema.safeParse(request.body)
  if (!parsed.success) return sendBadRequest(reply, parsed.error.errors[0]?.message ?? 'Invalid')

  const room = await prisma.room.findUnique({ where: { id: request.params.id } })
  if (!room) return sendNotFound(reply, 'Room not found')

  const updated = await prisma.room.update({
    where: { id: request.params.id },
    data: { reference_image: parsed.data },
  })
  return reply.send(updated)
})

// DELETE /rooms/:id/reference-image
app.delete<{ Params: { id: string } }>('/rooms/:id/reference-image', async (request, reply) => {
  const room = await prisma.room.findUnique({ where: { id: request.params.id } })
  if (!room) return sendNotFound(reply, 'Room not found')
  const updated = await prisma.room.update({
    where: { id: request.params.id },
    data: { reference_image: null },
  })
  return reply.send(updated)
})
```

---

## 3. Tests in `planner-api/src/routes/rooms.test.ts` erweitern

Füge hinzu:
- `PUT /rooms/:id/reference-image` → 200 mit gültiger URL
- `PUT /rooms/:id/reference-image` → 400 mit ungültiger URL
- `DELETE /rooms/:id/reference-image` → 200 (reference_image = null)

---

## 4. Frontend-Erweiterungen

### 4a. State in `usePolygonEditor.ts` erweitern

Füge zum `EditorState` hinzu:
```typescript
referenceImage: {
  url: string
  x: number; y: number
  rotation: number; scale: number; opacity: number
} | null
```

Default-Wert: `referenceImage: null`

### 4b. `PolygonEditor.tsx` – Bild-Layer

Füge **als erstes Element** im `<Layer>` (unter allen anderen Shapes) hinzu:

```tsx
{/* Referenzbild-Overlay */}
{state.referenceImage && (() => {
  const img = state.referenceImage
  const [image, setImage] = React.useState<HTMLImageElement | null>(null)
  // Bild laden
  React.useEffect(() => {
    const el = new window.Image()
    el.src = img.url
    el.onload = () => setImage(el)
  }, [img.url])

  if (!image) return null
  return (
    <KonvaImage
      image={image}
      x={img.x}
      y={img.y}
      rotation={img.rotation}
      scaleX={img.scale}
      scaleY={img.scale}
      opacity={img.opacity}
      draggable
      onDragEnd={(e) => {
        onReferenceImageUpdate?.({ ...img, x: e.target.x(), y: e.target.y() })
      }}
    />
  )
})()}
```

Importiere `Image as KonvaImage` aus `react-konva`.

Füge `onReferenceImageUpdate?: (img: NonNullable<EditorState['referenceImage']>) => void` zur `Props`-Schnittstelle hinzu.

### 4c. Kalibrierungs-Werkzeug

Füge zum `PolygonEditor.tsx` Toolbar-Bereich einen neuen Modus `calibrate` hinzu:

```tsx
{state.referenceImage && (
  <ToolBtn active={state.tool === 'calibrate'} onClick={() => onSetTool('calibrate')}>
    Kalibrieren
  </ToolBtn>
)}
```

Im `handleStageClick`, für `tool === 'calibrate'`:
```typescript
if (state.tool === 'calibrate') {
  // Ersten und zweiten Klick sammeln
  onCalibrationPoint?.(pos)
  return
}
```

Wenn zwei Punkte gesammelt wurden, zeige ein Prompt-Fenster (einfaches `window.prompt`):
```typescript
const refLengthMm = Number(window.prompt('Referenzlänge in mm eingeben:'))
if (!isNaN(refLengthMm) && refLengthMm > 0 && calibrationPoints.length === 2) {
  const px = Math.hypot(
    calibrationPoints[1].x - calibrationPoints[0].x,
    calibrationPoints[1].y - calibrationPoints[0].y
  )
  // Neuer Scale = aktuelle px / (refLengthMm * SCALE)
  const newCanvasScale = px / (refLengthMm * SCALE)
  onReferenceImageUpdate?.({ ...state.referenceImage!, scale: newCanvasScale })
}
```

### 4d. Opacity-Slider

In der PolygonEditor-Toolbar, wenn `state.referenceImage`:
```tsx
<input
  type="range" min="0.1" max="1" step="0.05"
  value={state.referenceImage.opacity}
  onChange={(e) => onReferenceImageUpdate?.({
    ...state.referenceImage!,
    opacity: Number(e.target.value),
  })}
  title="Transparenz Referenzbild"
  style={{ width: 80 }}
/>
```

### 4e. Bild-Upload-Button in Toolbar

```tsx
<label className={styles.toolBtn} title="Grundriss laden">
  📷 Laden
  <input
    type="file"
    accept="image/*"
    style={{ display: 'none' }}
    onChange={(e) => {
      const file = e.target.files?.[0]
      if (!file) return
      const url = URL.createObjectURL(file)
      onReferenceImageUpdate?.({ url, x: 50, y: 50, rotation: 0, scale: 1, opacity: 0.5 })
    }}
  />
</label>
```

---

## 5. Kein neues DB-Modell außer `rooms.reference_image` (JSON-Feld)

---

## DoD-Checkliste

- [ ] `PUT /api/v1/rooms/:id/reference-image` speichert JSON
- [ ] `DELETE /api/v1/rooms/:id/reference-image` setzt Feld auf null
- [ ] Bild wird als erster Layer unter Polygon gerendert
- [ ] Opacity-Slider ändert Transparenz live
- [ ] Kalibrierungsklicks + Prompt setzt scale korrekt
- [ ] Bild kann per Drag verschoben werden
- [ ] ROADMAP.md Sprint 58 Status → `done`
- [ ] Commit + PR `feature/sprint-58-bild-nachzeichnen`
