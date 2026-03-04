# Sprint 70 - Spezifikationsblaetter & Werkstattpaket

**Branch:** `feature/sprint-70-spec-sheets-workshop-package`
**Gruppe:** B (startbar nach S61, S65, S66)
**Status:** `done`
**Abhaengigkeiten:** S44 (Batchdruck), S61 (PDF/Firmenprofil), S65 (Cutlist), S66 (Nesting)

---

## Ziel

Automatische Spezifikationsblaetter fuer Vertrieb und Werkstatt erzeugen:
eine strukturierte Dokumentmappe aus Angebot, BOM, Cutlist, Nesting,
Layout-Sheets und Montagehinweisen. Batchdruck existiert bereits; hier
geht es um standardisierte, projektbezogene Profidokumente.

Inspiration: ProKitchen Specification Sheets, CARAT/KPS Druckmappen.

---

## 1. Datenmodell

Ans Ende von `planner-api/prisma/schema.prisma` anhaengen:

```prisma
model SpecificationPackage {
  id             String   @id @default(uuid())
  tenant_id      String
  project_id     String
  name           String   @db.VarChar(140)
  config_json    Json     @default("{}")
  generated_at   DateTime?
  artifact_json  Json     @default("{}")
  created_at     DateTime @default(now())
  updated_at     DateTime @updatedAt

  @@index([tenant_id, project_id])
  @@map("specification_packages")
}
```

Beispiel `config_json`:

```json
{
  "sections": ["quote", "bom", "cutlist", "nesting", "layout_sheets", "installation_notes"],
  "include_cover_page": true,
  "include_company_profile": true
}
```

---

## 2. Backend

Neue Datei: `planner-api/src/services/specificationPackageService.ts`

Implementieren:

```ts
export interface SpecificationSectionResult {
  key: string
  title: string
  page_count: number
  artifact_type: 'pdf' | 'csv' | 'dxf' | 'json'
}

export async function generateSpecificationPackage(
  projectId: string,
  packageId: string,
): Promise<{
  merged_pdf: Buffer
  sections: SpecificationSectionResult[]
}>
```

Neue Route: `planner-api/src/routes/specificationPackages.ts`

Endpoints:

- `GET /projects/:id/specification-packages`
- `POST /projects/:id/specification-packages`
- `POST /specification-packages/:id/generate`
- `GET /specification-packages/:id/download`
- `DELETE /specification-packages/:id`

V1:

- merged PDF fuer quote, BOM, cutlist und layout sheets
- optionale Anlagenliste fuer DXF- und Nesting-Artefakte
- Deckblatt mit Firmenprofil und Projektmetadaten

---

## 3. Frontend

Neue Dateien:

- `planner-frontend/src/api/specificationPackages.ts`
- `planner-frontend/src/pages/SpecificationPackagesPage.tsx`

UI:

- Paketliste je Projekt
- Checkboxen pro Abschnitt
- `Generieren` und `Download`
- Vorschau: welche Sections im Paket enthalten sind

Anpassungen:

- `ProjectList.tsx` oder Projektdetail -> Link `Werkstattpakete`
- `SettingsPage.tsx` optional: Default-Package-Template

---

## 4. Tests

Mindestens:

1. `specificationPackages.test.ts`: Paket anlegen, listen, loeschen
2. `specificationPackageService.test.ts`: merged PDF enthaelt gewaehlte Sections
3. `specificationPackageService.test.ts`: fehlende Cutlist- oder Nesting-Section wird sauber uebersprungen
4. Frontend: Paket-Config speicherbar und Download triggerbar

---

## 5. DoD

- Projekt kann Spezifikationspakete konfigurieren und generieren
- Deckblatt nutzt Firmenprofil aus S61
- Quote, BOM, Cutlist und Layout-Sheets koennen als ein Paket ausgeliefert werden
- Nesting und DXF werden als Anlage oder Download-Referenz gelistet
- Batchdruck bleibt intakt und wird nicht ersetzt, sondern ergaenzt

---

## 6. Roadmap-Update

- Sprint 70 in `Docs/ROADMAP.md` als `planned` aufnehmen
- `Docs/AGENT_SPRINTS/README.md` um Sprint 70 erweitern
