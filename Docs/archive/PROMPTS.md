# PROMPTS.md

Archivierte Claude/Copilot-Prompts für Sprint-Implementierungen.

---

## COPILOT_PROMPT_SPRINT_07_CATALOG_PANEL

# COPILOT_PROMPT_SPRINT_07_CATALOG_PANEL.md

## GitHub-Copilot-Prompt

Arbeite im Repo `OKP` und uebernimm eine klar isolierte Sprint-7-Anschlussaufgabe im Frontend.

Ziel:
- Baue eine kleine Katalog-Browser-Komponente auf Basis der bestehenden API
- Vermeide Eingriffe in stark bewegte Editor-Dateien

Vorhandene API:
- `GET /api/v1/catalog/items`
  - Query: `type`, `q`, `limit`, `offset`
- `GET /api/v1/catalog/items/:id`
- Frontend-Client vorhanden in `planner-frontend/src/api/catalog.ts`

Bitte umsetzen:
- Neue Komponente `planner-frontend/src/components/catalog/CatalogBrowser.tsx`
- Optionales Stylesheet `planner-frontend/src/components/catalog/CatalogBrowser.module.css`
- Funktionen:
  - Liste laden ueber `catalogApi.list(...)`
  - Filter fuer `type` und Suchtext
  - Ergebnisliste mit Name, SKU, Typ und Netto-Listenpreis
  - Klick auf ein Element laedt `catalogApi.getById(id)` und zeigt Detaildaten in einem einfachen Detailbereich

Wichtige Grenzen:
- Nicht anfassen:
  - `planner-frontend/src/components/editor/CanvasArea.tsx`
  - `planner-frontend/src/components/editor/LeftSidebar.tsx`
  - `planner-frontend/src/components/editor/RightSidebar.tsx`
  - `planner-frontend/src/editor/PolygonEditor.tsx`
  - `planner-frontend/src/pages/Editor.tsx`
- Kein globaler Refactor
- TypeScript strikt halten
- Stilistisch an bestehende `planner-frontend/src/api/*.ts` anlehnen

Akzeptanz:
- Komponente ist isoliert nutzbar
- Filter und Suche triggern API-Calls
- Detailansicht nutzt `getById`
- Keine Abhaengigkeit von den aktuellen Editor-Diffs anderer Agenten


---

## COPILOT_PROMPT_SPRINT_07_CATALOG_ROUTE

# COPILOT_PROMPT_SPRINT_07_CATALOG_ROUTE.md

## GitHub-Copilot-Prompt

Arbeite im Repo `OKP` und integriere die bereits vorhandene Katalog-Komponente in eine unkritische Frontend-Route.

Bereits vorhanden:

- `planner-frontend/src/components/catalog/CatalogBrowser.tsx`
- `planner-frontend/src/components/catalog/CatalogBrowser.module.css`

Ziel:

- Fuege eine isolierte Katalog-Seite hinzu
- Vermeide Eingriffe in alle Editor-Dateien
- Nutze die bestehende Komponente ohne inhaltlichen Refactor

Bitte umsetzen:

- Neue Seite `planner-frontend/src/pages/CatalogPage.tsx`
  - rendert `CatalogBrowser`
  - einfacher Seitenrahmen mit Ueberschrift und kurzer Beschreibung
- Routing in `planner-frontend/src/main.tsx`
  - neue Route `/catalog`
- Kleine Navigation aus `planner-frontend/src/pages/ProjectList.tsx`
  - unaufdringlicher Link oder Button zur neuen Katalog-Seite
  - bestehendes Projektlisten-Verhalten unveraendert lassen

Wichtige Grenzen:

- Nicht anfassen:
  - `planner-frontend/src/components/editor/CanvasArea.tsx`
  - `planner-frontend/src/components/editor/LeftSidebar.tsx`
  - `planner-frontend/src/components/editor/RightSidebar.tsx`
  - `planner-frontend/src/editor/PolygonEditor.tsx`
  - `planner-frontend/src/pages/Editor.tsx`
- Kein globaler Layout-Refactor
- TypeScript strikt halten
- Bestehende Projektlisten-Interaktion nicht umbauen

Akzeptanz:

- `/catalog` ist direkt im Browser aufrufbar
- `CatalogBrowser` wird dort ohne Fehler gerendert
- Von der Projektliste kommt man zur Katalog-Seite und wieder zurueck


---

## COPILOT_PROMPT_SPRINT_09_VALIDATE_PANEL

# COPILOT_PROMPT_SPRINT_09_VALIDATE_PANEL.md

## GitHub-Copilot-Prompt

Arbeite im Repo `OKP` und uebernimm eine isolierte Frontend-Anschlussaufgabe fuer Sprint 9/10.

Backend-Vertrag:

- `POST /api/v1/projects/:id/validate`
- Body:
  - `user_id: string`
  - `roomPolygon: Point[]`
  - `objects: Array<{ id, type, wall_id, offset_mm, width_mm, depth_mm, height_mm, worldPos? }>`
  - `openings: Opening[]`
  - `walls: Wall[]`
  - `ceilingConstraints: CeilingConstraint[]`
  - `nominalCeilingMm?: number`
  - `minClearanceMm?: number`
- Response:
  - `valid: boolean`
  - `errors: RuleViolation[]`
  - `warnings: RuleViolation[]`
  - `hints: RuleViolation[]`
  - `violations: RuleViolation[]`

Ziel:

- Baue eine isolierte Validierungs-UI ohne Eingriff in die aktiven Editor-Dateien

Bitte umsetzen:

- Neue API-Datei `planner-frontend/src/api/validation.ts`
  - Funktion `validateProject(projectId, payload)`
- Neue Komponente `planner-frontend/src/components/validation/ValidationPanel.tsx`
  - Props fuer `projectId` und vorbereiteten Payload
  - Button zum Ausloesen der Validierung
  - getrennte Anzeige fuer Fehler, Warnungen und Hinweise
  - einfacher Leerzustand und Fehlerzustand
- Optionales Stylesheet `planner-frontend/src/components/validation/ValidationPanel.module.css`

Wichtige Grenzen:

- Nicht anfassen:
  - `planner-frontend/src/components/editor/CanvasArea.tsx`
  - `planner-frontend/src/components/editor/LeftSidebar.tsx`
  - `planner-frontend/src/components/editor/RightSidebar.tsx`
  - `planner-frontend/src/editor/PolygonEditor.tsx`
  - `planner-frontend/src/pages/Editor.tsx`
- Kein globaler Refactor
- TypeScript strikt halten

Akzeptanz:

- Panel ist isoliert renderbar
- API-Client nutzt den neuen projektgebundenen Validate-Endpoint
- Ergebnislisten sind nach `errors`, `warnings` und `hints` getrennt


---

## COPILOT_PROMPT_SPRINT_13_QUOTE_EXPORT_PAGE

# COPILOT_PROMPT_SPRINT_13_QUOTE_EXPORT_PAGE.md

## GitHub-Copilot-Prompt

Arbeite im Repo `OKP` und uebernimm eine isolierte Frontend-Anschlussaufgabe fuer Sprint 13.

Backend-Vertrag:

- `POST /api/v1/projects/:id/create-quote`
- `GET /api/v1/quotes/:id`
- `POST /api/v1/quotes/:id/export-pdf`
  - liefert ein echtes PDF-Attachment mit `application/pdf`

Ziel:

- Baue eine kleine, eigenstaendige Quote-Export-UI ohne Eingriff in die aktiven Editor-Dateien

Bitte umsetzen:

- Neue API-Datei `planner-frontend/src/api/quotes.ts`
  - `createQuote(projectId, payload)`
  - `getQuote(id)`
  - `exportQuotePdf(id)` als Download-Helfer
- Neue Komponente `planner-frontend/src/components/quotes/QuoteExportPanel.tsx`
  - Props mindestens `projectId`
  - Button zum Erzeugen eines Angebots
  - Button zum PDF-Export fuer ein geladenes Angebot
  - einfache Anzeige von Angebotsnummer, Version und Gueltig-bis
- Optionales Stylesheet `planner-frontend/src/components/quotes/QuoteExportPanel.module.css`

Wichtige Grenzen:

- Nicht anfassen:
  - `planner-frontend/src/components/editor/CanvasArea.tsx`
  - `planner-frontend/src/components/editor/LeftSidebar.tsx`
  - `planner-frontend/src/components/editor/RightSidebar.tsx`
  - `planner-frontend/src/editor/PolygonEditor.tsx`
  - `planner-frontend/src/pages/Editor.tsx`
- Kein globaler Refactor
- TypeScript strikt halten

Akzeptanz:

- Panel ist isoliert renderbar
- PDF-Export nutzt den echten Binary-Endpoint und triggert einen Download
- Keine Abhaengigkeit von den gesperrten Editor-Dateien


---

## COPILOT_PROMPT_SPRINT_15_RENDER_MONITOR

# COPILOT_PROMPT_SPRINT_15_RENDER_MONITOR.md

## Ziel

Baue fuer Sprint 15 eine isolierte Frontend-Komponente, die Renderjobs fuer ein Projekt anlegen und pollen kann, ohne die gesperrten Editor-Dateien anzufassen.

## Nicht anfassen

- `planner-frontend/src/components/editor/CanvasArea.tsx`
- `planner-frontend/src/components/editor/LeftSidebar.tsx`
- `planner-frontend/src/components/editor/RightSidebar.tsx`
- `planner-frontend/src/editor/PolygonEditor.tsx`
- `planner-frontend/src/pages/Editor.tsx`

## Umzusetzen

1. Neuer API-Client:
   - Datei: `planner-frontend/src/api/renderJobs.ts`
   - Funktionen:
     - `createRenderJob(projectId: string, payload?: { scene_payload?: unknown })`
     - `getRenderJob(jobId: string)`
   - Nutze den vorhandenen API-Client/Fetch-Stil des Frontends.

2. Neue isolierte Komponente:
   - Datei: `planner-frontend/src/components/render/RenderJobMonitor.tsx`
   - CSS-Modul: `planner-frontend/src/components/render/RenderJobMonitor.module.css`
   - Props:
     - `projectId: string`
     - `scenePayload?: unknown`
   - Verhalten:
     - Button "Render starten" legt via `POST /api/v1/projects/:id/render-jobs` einen Job an.
     - Danach Polling auf `GET /api/v1/render-jobs/:id` im Abstand von ca. 2 Sekunden.
     - Zeigt Status `queued | assigned | running | done | failed`.
     - Wenn `result.image_url` vorhanden ist, Bildvorschau rendern.
     - Bei `failed` die Fehlermeldung anzeigen.
     - Polling bei `done` oder `failed` stoppen.

3. Isolierte Renderbarkeit:
   - Die Komponente muss ohne Editor-Integration nutzbar sein, nur ueber Props.
   - Keine globale State-Einfuehrung.

## Akzeptanzkriterien

- `RenderJobMonitor` ist isoliert renderbar.
- Job kann erstellt werden.
- Statuswechsel werden sichtbar.
- Bildvorschau fuer fertige Jobs wird angezeigt.
- Fehlerzustand ist vorhanden.
- Keine Aenderungen an den oben ausgeschlossenen Editor-Dateien.

## Rueckmeldung

Bitte nur melden:

- welche Dateien neu/geaendert wurden
- ob die betroffenen Dateien fehlerfrei sind
- ob irgendwo bestehende Dateien ausserhalb des erlaubten Scopes angepasst werden mussten


---

## COPILOT_PROMPT_SPRINT_16_BUSINESS_PANEL

# COPILOT_PROMPT_SPRINT_16_BUSINESS_PANEL.md

## Ziel

Baue fuer Sprint 16 eine isolierte Business-/CRM-Komponente im Frontend, die den neuen Business-Snapshot laden, bearbeiten und exportieren kann, ohne die gesperrten Editor-Dateien anzufassen.

## Nicht anfassen

- `planner-frontend/src/components/editor/CanvasArea.tsx`
- `planner-frontend/src/components/editor/LeftSidebar.tsx`
- `planner-frontend/src/components/editor/RightSidebar.tsx`
- `planner-frontend/src/editor/PolygonEditor.tsx`
- `planner-frontend/src/pages/Editor.tsx`

## Backend-API

Verfuegbar sind:

- `GET /api/v1/projects/:id/business-summary`
- `PUT /api/v1/projects/:id/business-summary`
- `GET /api/v1/projects/:id/export/json`
- `GET /api/v1/projects/:id/export/csv`
- `POST /api/v1/projects/:id/export/webhook`

## Umzusetzen

1. Neuer API-Client:
   - Datei: `planner-frontend/src/api/business.ts`
   - Funktionen:
     - `getBusinessSummary(projectId: string)`
     - `updateBusinessSummary(projectId: string, payload: ...)`
     - `exportBusinessJson(projectId: string)`
     - `exportBusinessCsv(projectId: string)`
     - `exportBusinessWebhook(projectId: string, payload: { target_url: string; event?: string })`

2. Neue isolierte Komponente:
   - Datei: `planner-frontend/src/components/business/BusinessPanel.tsx`
   - CSS-Modul: `planner-frontend/src/components/business/BusinessPanel.module.css`
   - Props:
     - `projectId: string`

3. Verhalten:
   - Laedt beim Mount den Business-Snapshot.
   - Editierbar:
     - `lead_status`
     - `quote_value`
     - `close_probability`
   - Zeigt Listen fuer:
     - `customer_price_lists`
     - `customer_discounts`
     - `project_line_items`
   - Ein einfacher Save-Button speichert den vollen Snapshot via `PUT`.
   - Ein Export-Bereich bietet:
     - JSON-Export anzeigen/herunterladen
     - CSV-Export anstossen
     - Webhook-Export per URL-Feld

4. Scope-Regeln:
   - Keine Editor-Integration.
   - Keine globale State-Einfuehrung.
   - Keine Aenderungen an Routing oder gesperrten Editor-Dateien, ausser falls bereits eine freie separate Seite fuer solche Tools existiert.

## Akzeptanzkriterien

- `BusinessPanel` ist isoliert renderbar.
- Snapshot wird geladen und gespeichert.
- CRM-Felder sind bearbeitbar.
- Listen fuer Preislisten, Rabatte und Line Items werden sichtbar dargestellt.
- JSON-, CSV- und Webhook-Aktionen sind vorhanden.
- Keine Aenderungen an den ausgeschlossenen Editor-Dateien.

## Rueckmeldung

Bitte nur melden:

- welche Dateien neu/geaendert wurden
- ob die betroffenen Dateien fehlerfrei sind
- ob ungewollt ausserhalb des erlaubten Scopes etwas angepasst werden musste


---

## COPILOT_PROMPT_SPRINT_17_BLOCK_PROGRAMS

# COPILOT_PROMPT_SPRINT_17_BLOCK_PROGRAMS.md

## Ziel

Baue fuer Sprint 17 eine isolierte Frontend-Verwaltung fuer Blockprogramme und Projektauswertungen, ohne die gesperrten Editor-Dateien anzufassen.

## Nicht anfassen

- `planner-frontend/src/components/editor/CanvasArea.tsx`
- `planner-frontend/src/components/editor/LeftSidebar.tsx`
- `planner-frontend/src/components/editor/RightSidebar.tsx`
- `planner-frontend/src/editor/PolygonEditor.tsx`
- `planner-frontend/src/pages/Editor.tsx`

## Backend-API

Verfuegbar sind:

- `GET /api/v1/block-programs`
- `POST /api/v1/block-programs`
- `GET /api/v1/block-programs/:id`
- `PUT /api/v1/block-programs/:id`
- `POST /api/v1/projects/:projectId/evaluate-blocks`
- `GET /api/v1/projects/:projectId/block-evaluations`

## Umzusetzen

1. Neuer API-Client:
   - Datei: `planner-frontend/src/api/blocks.ts`
   - Funktionen:
     - `listBlockPrograms()`
     - `getBlockProgram(id: string)`
     - `createBlockProgram(payload: ...)`
     - `updateBlockProgram(id: string, payload: ...)`
     - `evaluateProjectBlocks(projectId: string, payload: { program_id: string } | { blocks: ...; price_summary?: ... })`
     - `listProjectBlockEvaluations(projectId: string)`

2. Neue isolierte Komponenten:
   - `planner-frontend/src/components/blocks/BlockProgramManager.tsx`
   - `planner-frontend/src/components/blocks/BlockProgramManager.module.css`
   - optional zusaetzlich:
     - `planner-frontend/src/components/blocks/ProjectBlockEvaluations.tsx`
     - `planner-frontend/src/components/blocks/ProjectBlockEvaluations.module.css`

3. Verhalten:
   - `BlockProgramManager`
     - listet vorhandene Blockprogramme
     - zeigt Details eines gewaehlten Programms
     - erlaubt Anlegen/Bearbeiten von:
       - Name
       - Manufacturer
       - Notes
       - Aktiv-Flag
       - Groups
       - Definitions
       - Conditions
   - `ProjectBlockEvaluations`
     - nimmt `projectId` als Prop
     - kann eine gespeicherte Programmauswertung anstossen
     - listet gespeicherte Projektauswertungen mit `best_block`

4. Scope-Regeln:
   - keine Editor-Integration
   - keine globale State-Einfuehrung
   - keine Aenderungen an den ausgeschlossenen Editor-Dateien

## Akzeptanzkriterien

- Verwaltung ist isoliert renderbar.
- Blockprogramme koennen geladen, angelegt und aktualisiert werden.
- Projektauswertungen koennen angestossen und angezeigt werden.
- Fehler- und Leerzustand sind vorhanden.
- Keine Aenderungen an den ausgeschlossenen Editor-Dateien.

## Rueckmeldung

Bitte nur melden:

- welche Dateien neu/geaendert wurden
- ob die betroffenen Dateien fehlerfrei sind
- ob etwas ausserhalb des erlaubten Scopes angepasst werden musste


---

## COPILOT_PROMPT_SPRINT_18_UPLOAD_UI

# COPILOT_PROMPT_SPRINT_18_UPLOAD_UI.md

## GitHub-Copilot-Prompt

Arbeite im Repo `OKP` und implementiere einen klar abgegrenzten Frontend-Anschluss fuer die bereits vorhandene Import-Job-API.

Ziel:
- Baue einen kleinen, separaten Frontend-Client fuer die neuen Backend-Endpunkte
- Fuege noch keine tiefe Editor-Integration in bestehende stark bewegte Dateien ein
- Liefere nur neue, isolierte Dateien plus optional minimale Verdrahtung an einer unkritischen Stelle

Backend-Vertrag:
- `POST /api/v1/imports/cad`
  - JSON Body:
    - `project_id: string`
    - `source_filename: string`
    - `source_format?: 'dxf' | 'dwg'`
    - `dxf?: string`
    - `file_base64?: string`
    - `layer_mapping?: Record<string, { action: 'imported' | 'ignored' | 'needs_review'; reason?: string }>`
- `POST /api/v1/imports/skp`
  - JSON Body:
    - `project_id: string`
    - `source_filename: string`
    - `file_base64: string`
    - `component_mapping?: Record<string, { target_type: 'cabinet' | 'appliance' | 'reference_object' | 'ignored'; catalog_item_id?: string | null; label?: string | null }>`
- `GET /api/v1/imports/:id`
  - liefert ImportJob mit `status`, `protocol`, `import_asset`, `error_message`

Bitte umsetzen:
- Neue Datei `planner-frontend/src/api/imports.ts`
  - `createCadImportJob(...)`
  - `createSkpImportJob(...)`
  - `getImportJob(id)`
  - Hilfsfunktion fuer Base64-Konvertierung aus `File`
- Neue isolierte Komponente `planner-frontend/src/components/imports/ImportJobPanel.tsx`
  - Dateiauswahl fuer `.dxf`, `.dwg`, `.skp`
  - Upload startet passenden Endpoint
  - Polling fuer `GET /imports/:id` bis `done` oder `failed`
  - Anzeige von Status, Fehlertext und Protocol-Eintraegen
- Optionales Stylesheet `planner-frontend/src/components/imports/ImportJobPanel.module.css`

Wichtige Grenzen:
- Nicht anfassen:
  - `planner-frontend/src/components/editor/CanvasArea.tsx`
  - `planner-frontend/src/components/editor/LeftSidebar.tsx`
  - `planner-frontend/src/components/editor/RightSidebar.tsx`
  - `planner-frontend/src/editor/PolygonEditor.tsx`
  - `planner-frontend/src/pages/Editor.tsx`
- Keine tiefen Refactors
- Bestehende API-Clients in `planner-frontend/src/api/` stilistisch nachvollziehen
- TypeScript strikt halten

Akzeptanz:
- Upload-Client arbeitet nur ueber die neuen Backend-Endpunkte
- `.dxf` nutzt Textinhalt als `dxf`, `.dwg` und `.skp` nutzen `file_base64`
- Polling stoppt sauber bei `done` oder `failed`
- UI zeigt mindestens Dateiname, Status und Protokoll


---

## COPILOT_PROMPT_SPRINT_19_IMPORT_REVIEW

# COPILOT_PROMPT_SPRINT_19_IMPORT_REVIEW.md

## Ziel

Baue eine isolierte Import-Review-Komponente fuer CAD-/SKP-Importjobs, die Status, Protokoll und Mapping-Zustand sichtbar macht, ohne die gesperrten Editor-Dateien anzufassen.

## Nicht anfassen

- `planner-frontend/src/components/editor/CanvasArea.tsx`
- `planner-frontend/src/components/editor/LeftSidebar.tsx`
- `planner-frontend/src/components/editor/RightSidebar.tsx`
- `planner-frontend/src/editor/PolygonEditor.tsx`
- `planner-frontend/src/pages/Editor.tsx`

## Backend-API

Verfuegbar sind:

- `POST /api/v1/imports/cad`
- `POST /api/v1/imports/skp`
- `GET /api/v1/imports/:id`

Importjobs enthalten:

- `status`
- `source_format`
- `source_filename`
- `protocol`
- `import_asset`
- optional `mapping_state`

## Umzusetzen

1. Neuer API-Client oder Erweiterung des bestehenden Import-Clients:
   - Datei: `planner-frontend/src/api/imports.ts`
   - Falls noch nicht vorhanden, sauber typisieren:
     - `ImportJob`
     - `ImportProtocolEntry`
     - `ImportAsset`

2. Neue isolierte Komponente:
   - `planner-frontend/src/components/imports/ImportReviewPanel.tsx`
   - `planner-frontend/src/components/imports/ImportReviewPanel.module.css`

3. Props:
   - `jobId: string`

4. Verhalten:
   - laedt `GET /api/v1/imports/:id`
   - zeigt:
     - Dateiname
     - Format
     - Status
     - Fehler
     - Protokolleintraege getrennt nach `imported`, `ignored`, `needs_review`
   - wenn vorhanden, zeigt Mapping-Zustand:
     - `mapping_state.layers`
     - `mapping_state.components`
   - wenn vorhanden, zeigt Units aus `import_asset.units`
   - hebt `needs_review` sichtbar hervor

5. Scope-Regeln:
   - keine Editor-Integration
   - keine globale State-Einfuehrung
   - keine Aenderungen an den ausgeschlossenen Editor-Dateien

## Akzeptanzkriterien

- Komponente ist isoliert renderbar.
- Importstatus und Protokoll werden sauber angezeigt.
- `needs_review`-Faelle sind klar sichtbar.
- Layer-/Komponenten-Mapping wird dargestellt, falls vorhanden.
- Keine Aenderungen an den ausgeschlossenen Editor-Dateien.

## Rueckmeldung

Bitte nur melden:

- welche Dateien neu/geaendert wurden
- ob die betroffenen Dateien fehlerfrei sind
- ob etwas ausserhalb des erlaubten Scopes angepasst werden musste


---

