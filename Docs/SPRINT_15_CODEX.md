# SPRINT_15_CODEX.md

## Umfang

Umsetzung Sprint 15 (Render-Job-System + externer Render-Worker MVP):

- Renderjob anlegen
- Queue-/Statusfluss
- Worker-Registrierung und Job-Zuweisung
- Ergebnisrückgabe mit Render-Metadaten

## Umgesetzte Dateien

- `planner-api/src/routes/renderJobs.ts`
- `planner-api/src/routes/renderJobs.test.ts`
- `planner-api/src/index.ts`

## Ergebnis Sprint 15

Implementiert wurde:

- `POST /api/v1/projects/:id/render-jobs`
  - erzeugt Renderjob im Status `queued`
  - akzeptiert optionales `scene_payload`

- `GET /api/v1/render-jobs/:id`
  - liefert Jobstatus inkl. Ergebnisobjekt

- `POST /api/v1/render-workers/register`
  - registriert Worker und vergibt `worker_id`

- `POST /api/v1/render-workers/:workerId/fetch-job`
  - weist den ältesten `queued` Job zu (`assigned`)

- `POST /api/v1/render-workers/:workerId/jobs/:jobId/start`
  - setzt Job auf `running`

- `POST /api/v1/render-workers/:workerId/jobs/:jobId/complete`
  - setzt Job auf `done`
  - schreibt/aktualisiert `render_job_results`

- `POST /api/v1/render-workers/:workerId/jobs/:jobId/fail`
  - setzt Job auf `failed` inkl. Fehlermeldung

Statusfluss abgedeckt:

- `queued -> assigned -> running -> done/failed`

## DoD-Status Sprint 15

- Renderjob anlegen: **erfüllt**
- Queue-Status + Worker-Flow: **erfüllt**
- Scene Payload Übergabe: **erfüllt (MVP: passthrough)**
- End-to-End API-Flow Job -> Ergebnis: **erfüllt**

## Verifikation

- Neue Route-Tests in `renderJobs.test.ts` grün
- Relevante Quote-/Pricing-/BOM-Route-Regression grün

## Hinweise

- `render_nodes`-Persistenz ist im aktuellen Prisma-Schema nicht vorhanden; Worker-Registry läuft im MVP in-memory.
- Für horizontale Skalierung ist in Sprint 15+ eine persistente Node-/Lease-Verwaltung der nächste Schritt.

## Nächster Sprint

Sprint 16:

- Business-/Integrations-Sprint
- CRM-Felder und Exporte (JSON/CSV/Webhook)
- kundenbezogene Preis-/Rabatt-Erweiterungen
