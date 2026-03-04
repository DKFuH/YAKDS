# Sprint 65 – Zuschnittliste (Cutlist)

**Branch:** `feature/sprint-65-cutlist`
**Gruppe:** B (startbar nach S11 BOM)
**Status:** `done`
**Abhängigkeiten:** S11 (Stücklisten-Engine), S60 (Katalog/Kitchen Assistant)

---

## Ziel

Automatische Zuschnittliste aus Platzierungen: Welche Platte (Material,
Größe) muss wie oft in welcher Dimension zugeschnitten werden?
Export als PDF und CSV für die Werkstatt. Leitidee: strukturierte
Zuschnittlisten und materialorientierte Werkstattunterlagen.

---

## 1. Datenmodell

### Neue Felder in `catalog_articles`

```prisma
// Bereits vorhanden: width_mm, depth_mm, height_mm
// Neu für Cutlist-Berechnung:
  material_code    String?   @db.VarChar(50)   // z.B. "MDF-16", "SPAN-19", "MULT-18"
  material_label   String?   @db.VarChar(100)  // z.B. "MDF 16mm weiß"
  grain_direction  GrainDir? // Faserrichtung (relevant für Furnier/Echtholz)
  cutlist_parts    Json?     // [{ label, width_mm, height_mm, qty_per_unit, material_code }]
  // cutlist_parts Beispiel für einen 60cm-Unterschrank:
  // [
  //   { label: "Seite links",  width_mm: 560, height_mm: 720, qty_per_unit: 1, material_code: "SPAN-19" },
  //   { label: "Seite rechts", width_mm: 560, height_mm: 720, qty_per_unit: 1, material_code: "SPAN-19" },
  //   { label: "Boden",        width_mm: 562, height_mm: 560, qty_per_unit: 1, material_code: "SPAN-19" },
  //   { label: "Rücken",       width_mm: 562, height_mm: 720, qty_per_unit: 1, material_code: "HDF-8"  },
  //   { label: "Türfront",     width_mm: 596, height_mm: 716, qty_per_unit: 1, material_code: "MDF-19" },
  // ]
```

```prisma
enum GrainDir {
  none       // kein Korn / MDF / Span
  length     // Korn in Längsrichtung (Höhe des Teils)
  width      // Korn in Querrichtung
}
```

Migration:
```sql
CREATE TYPE "GrainDir" AS ENUM ('none', 'length', 'width');
ALTER TABLE "catalog_articles"
  ADD COLUMN IF NOT EXISTS "material_code"   VARCHAR(50),
  ADD COLUMN IF NOT EXISTS "material_label"  VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "grain_direction" "GrainDir",
  ADD COLUMN IF NOT EXISTS "cutlist_parts"   JSONB;
```

### `model Cutlist` – persistierte Zuschnittliste

```prisma
model Cutlist {
  id          String   @id @default(uuid())
  project_id  String
  room_id     String?
  generated_at DateTime @default(now())
  parts       Json     // CutlistPart[]
  summary     Json     // { total_parts, by_material: { [code]: { count, area_sqm } } }

  @@index([project_id])
  @@map("cutlists")
}
```

Migration:
```sql
CREATE TABLE "cutlists" (
  "id"           TEXT NOT NULL PRIMARY KEY,
  "project_id"   TEXT NOT NULL,
  "room_id"      TEXT,
  "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "parts"        JSONB NOT NULL,
  "summary"      JSONB NOT NULL
);
CREATE INDEX "cutlists_project_id_idx" ON "cutlists"("project_id");
```

---

## 2. Service: `planner-api/src/services/cutlistService.ts`

```typescript
export interface CutlistPart {
  label: string          // z.B. "Seite links"
  width_mm: number
  height_mm: number
  quantity: number
  material_code: string
  material_label: string
  grain_direction: 'none' | 'length' | 'width'
  article_name: string   // woher kommt das Teil
  article_id: string
  placement_id: string
}

export interface CutlistSummary {
  total_parts: number
  by_material: Record<string, { count: number; area_sqm: number; material_label: string }>
}

export interface CutlistResult {
  parts: CutlistPart[]
  summary: CutlistSummary
}

/**
 * Erzeugt eine Zuschnittliste aus allen Platzierungen eines Raums (oder Projekts).
 * Jede Platzierung × Artikel.cutlist_parts × Quantity ergibt konkrete Teile.
 */
export async function generateCutlist(
  db: import('@prisma/client').PrismaClient,
  projectId: string,
  roomId?: string,
): Promise<CutlistResult> {
  const where = roomId
    ? { room_id: roomId }
    : { room: { project_id: projectId } }

  const placements = await db.placement.findMany({
    where,
    include: {
      catalog_article: {
        select: {
          id: true,
          name: true,
          material_code: true,
          material_label: true,
          grain_direction: true,
          cutlist_parts: true,
          width_mm: true,
          depth_mm: true,
          height_mm: true,
        },
      },
    },
  })

  const parts: CutlistPart[] = []

  for (const placement of placements) {
    const article = placement.catalog_article
    if (!article) continue

    const rawParts = article.cutlist_parts as Array<{
      label: string
      width_mm: number
      height_mm: number
      qty_per_unit: number
      material_code?: string
    }> | null

    if (rawParts && rawParts.length > 0) {
      // Artikel hat definierte Zuschnitt-Teile
      for (const part of rawParts) {
        parts.push({
          label: part.label,
          width_mm: part.width_mm,
          height_mm: part.height_mm,
          quantity: part.qty_per_unit,
          material_code: part.material_code ?? article.material_code ?? 'UNBEKANNT',
          material_label: article.material_label ?? part.material_code ?? 'Unbekanntes Material',
          grain_direction: (article.grain_direction as CutlistPart['grain_direction']) ?? 'none',
          article_name: article.name,
          article_id: article.id,
          placement_id: placement.id,
        })
      }
    } else {
      // Fallback: Artikel selbst als ein Teil (Außenmaß)
      parts.push({
        label: article.name,
        width_mm: placement.width_mm ?? article.width_mm ?? 0,
        height_mm: placement.height_mm ?? article.height_mm ?? 0,
        quantity: 1,
        material_code: article.material_code ?? 'UNBEKANNT',
        material_label: article.material_label ?? 'Unbekanntes Material',
        grain_direction: (article.grain_direction as CutlistPart['grain_direction']) ?? 'none',
        article_name: article.name,
        article_id: article.id,
        placement_id: placement.id,
      })
    }
  }

  // Summary berechnen
  const byMaterial: CutlistSummary['by_material'] = {}
  for (const part of parts) {
    const key = part.material_code
    if (!byMaterial[key]) {
      byMaterial[key] = { count: 0, area_sqm: 0, material_label: part.material_label }
    }
    byMaterial[key].count += part.quantity
    byMaterial[key].area_sqm += (part.width_mm / 1000) * (part.height_mm / 1000) * part.quantity
  }

  return {
    parts,
    summary: { total_parts: parts.reduce((s, p) => s + p.quantity, 0), by_material: byMaterial },
  }
}
```

---

## 3. Routes: `planner-api/src/routes/cutlist.ts`

```typescript
// POST /projects/:id/cutlist/generate – Zuschnittliste berechnen + speichern
// GET  /projects/:id/cutlists          – gespeicherte Listen
// GET  /cutlists/:id                   – einzelne Liste
// GET  /cutlists/:id/export.csv        – CSV-Export für Werkstatt
// GET  /cutlists/:id/export.pdf        – PDF-Export (Tabelle)
// DELETE /cutlists/:id
```

**CSV-Format** (für CNC/Werkstatt):
```
Teile-Nr,Bezeichnung,Breite (mm),Höhe (mm),Anzahl,Material,Korn,Artikel
1,Seite links,560,720,1,SPAN-19,längs,USZ-60-W
2,Seite rechts,560,720,1,SPAN-19,längs,USZ-60-W
...
```

**PDF**: Einfache Tabelle (baut auf `buildQuotePdf`-Basis auf) mit:
- Kopf: Projektname, Datum, Raum
- Tabelle: Nr | Bezeichnung | B×H mm | Anzahl | Material | Korn
- Fußzeile: Gesamt X Teile, Material-Zusammenfassung

---

## 4. Frontend: `planner-frontend/src/pages/CutlistPage.tsx`

```tsx
// Aufruf über Editor-Seitenleiste → "Zuschnittliste" Button oder eigene Seite /projects/:id/cutlist

// Features:
// - "Zuschnittliste generieren" Button
// - Tabelle mit allen Teilen, gruppiert nach Material
// - Filter: nach Raum / nach Material
// - Export-Buttons: CSV + PDF
// - Material-Zusammenfassung: X Teile, Y m² Material-Code
```

---

## 5. Tests (`planner-api/src/services/cutlistService.test.ts` + Route-Tests)

Mindest-Tests (10):
1. `generateCutlist()` Unit: Placement mit `cutlist_parts` → korrekte Teileliste
2. `generateCutlist()` Unit: Artikel ohne `cutlist_parts` → Fallback auf Außenmaß
3. `generateCutlist()` Unit: 2 Placements → summary.total_parts korrekt
4. `generateCutlist()` Unit: Summary by_material area_sqm korrekt berechnet
5. `generateCutlist()` Unit: Kein Placement → leere parts, total_parts = 0
6. `POST /projects/:id/cutlist/generate` → 201, cutlist_id + summary zurück
7. `GET /projects/:id/cutlists` → Array mit gespeicherter Liste
8. `GET /cutlists/:id/export.csv` → 200, Content-Type text/csv
9. `GET /cutlists/:id/export.pdf` → 200, Content-Type application/pdf
10. `DELETE /cutlists/:id` → 204

---

## DoD-Checkliste

- [ ] Schema: `catalog_articles` + 4 neue Felder + `GrainDir`-Enum + Migration
- [ ] Schema: `cutlists`-Tabelle + Migration
- [ ] `cutlistService.ts`: `generateCutlist()` mit Fallback
- [ ] `cutlist.ts` Routes: generate, list, CSV-Export, PDF-Export, delete
- [ ] `index.ts`: cutlistRoutes registriert
- [ ] `CutlistPage.tsx`: Tabelle + Filter + Export-Buttons
- [ ] 10+ Tests grün
- [ ] ROADMAP Sprint 65 → `done`
