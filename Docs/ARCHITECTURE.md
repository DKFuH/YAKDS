# ARCHITECTURE.md

## Webbasierter Küchenplaner – Systemarchitektur

**Tech-Stack:** Node.js + TypeScript
**Stand:** Sprint 0

---

## Systemübersicht

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser (Client)                         │
│                    planner-frontend (React)                     │
└──────────────────────────┬──────────────────────────────────────┘
                           │ HTTPS / REST + JSON
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│                      planner-api                                │
│                  (Node.js + Fastify + TypeScript)               │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────────┐   │
│  │  Geometrie-  │  │  Preis-/BOM- │  │   Angebots-         │   │
│  │  Service     │  │  Service     │  │   Service           │   │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬──────────┘   │
│         │                 │                      │              │
│  ┌──────▼─────────────────▼──────────────────────▼──────────┐  │
│  │                   Datenbank-Layer                         │  │
│  │              (Postgres via Prisma ORM)                    │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌────────────────────┐   ┌──────────────────────────────────┐  │
│  │   Import-Service   │   │   Render-Job-Queue               │  │
│  │  (CAD / SKP)       │   │   (Bull / In-Memory MVP)         │  │
│  └────────┬───────────┘   └────────────────┬─────────────────┘  │
└───────────┼────────────────────────────────┼────────────────────┘
            │                                │ HTTPS (Pull)
            │ Filesystem / Object Storage    │
┌───────────▼──────────┐          ┌──────────▼─────────────────┐
│   interop-cad        │          │   render-worker             │
│   interop-sketchup   │          │   (Node.js + TypeScript)    │
│   (Parser/Exporter)  │          │   extern, registriert sich  │
└──────────────────────┘          └────────────────────────────┘
```

---

## Pakete

### `planner-frontend`
- **Framework:** React + TypeScript + Vite
- **Canvas:** Konva.js (2D-Editor) / Three.js (3D-Preview)
- **State:** Zustand oder React Query
- **Kommunikation:** REST-Calls gegen `planner-api`

### `planner-api`
- **Framework:** Fastify + TypeScript
- **ORM:** Prisma (Postgres)
- **Validierung:** Zod
- **Jobs:** Bull (Redis-backed Queue) oder In-Memory für MVP
- **Dateiupload:** Multipart via `@fastify/multipart`

### `render-worker`
- **Laufzeit:** Node.js + TypeScript (standalone Prozess)
- **Kommunikation:** HTTPS-Pull vom `planner-api`
- **Rendering:** Blender CLI oder Three.js SSR (Phase 2)

### `shared-schemas`
- TypeScript-Typen und Zod-Schemas für alle Kernobjekte
- Wird von `planner-api`, `planner-frontend`, `render-worker` geteilt

### `interop-cad`
- DWG/DXF Import und Export
- Bibliothek: `dxf-parser` (Import) + `dxf-writer` (Export); DWG via ODA/LibreDWG (Phase 2)
- Output: neutrales `ImportAsset`-Format

### `interop-sketchup`
- SKP Import als Referenzmodell
- Bibliothek: `sketchup-parser` oder Ruby-Bridge (TBD)

---

## Schichtenmodell (planner-api)

```
HTTP-Request
    │
    ▼
Router (Fastify Routes)
    │
    ▼
Controller (Request/Response-Mapping, Zod-Validierung)
    │
    ▼
Service (Geschäftslogik, Domänenregeln)
    │
    ▼
Repository (Prisma-Queries)
    │
    ▼
Postgres
```

**Regel:** Algorithmen (Polygon-Math, Kollision, BOM) werden als pure Funktionen in `shared-schemas` oder separaten Util-Modulen gehalten — kein Framework-Code.

---

## Datenbank

- **System:** PostgreSQL 15+
- **ORM:** Prisma
- **Migrationen:** Prisma Migrate
- **Schema-Datei:** `planner-api/prisma/schema.prisma`

### Kern-Tabellen (Sprint 0 Übersicht)

| Tabelle | Beschreibung |
|---|---|
| `users` | Benutzer (light) |
| `projects` | Planungsprojekte |
| `project_versions` | Versionierung |
| `rooms` | Räume mit Polygon-Geometrie |
| `wall_segments` | Wandsegmente eines Raums |
| `openings` | Türen/Fenster an Wänden |
| `ceiling_constraints` | Dachschrägen |
| `catalog_items` | Möbel-/Gerätekatalog |
| `placements` | Platzierte Objekte im Raum |
| `price_lists` | Preislisten |
| `tax_groups` | MwSt-Gruppen |
| `quotes` | Angebote |
| `quote_items` | Angebotspositionen |
| `render_jobs` | Render-Aufträge |
| `import_jobs` | CAD-/SKP-Importjobs |

---

## API-Grundprinzipien

- **Protokoll:** REST + JSON über HTTPS
- **Versionierung:** `/api/v1/...`
- **Authentifizierung:** JWT (Bearer Token) — MVP: einfaches Login
- **Fehlerformat:**
```json
{
  "error": "VALIDATION_ERROR",
  "message": "wall_id must reference an existing wall",
  "details": {}
}
```
- **Erfolg:** HTTP 200/201 + JSON-Body
- **Paginierung:** `?limit=50&offset=0`

---

## Render-Protokoll (Überblick)

Vollständig in [RENDER_PROTOCOL.md](RENDER_PROTOCOL.md).

1. Client löst `POST /projects/:id/render-jobs` aus
2. API legt Job an (`queued`)
3. Worker pollt `GET /render-jobs/next` (mit Auth-Token)
4. API sendet Scene Payload, setzt Status `assigned`
5. Worker rendert, setzt Status `running`
6. Worker lädt Ergebnis hoch (`POST /render-jobs/:id/result`)
7. Status → `done`, Bild-URL verfügbar

---

## CAD/SKP-Interop (Überblick)

Vollständig in [CAD_INTEROP.md](CAD_INTEROP.md) und [SKP_INTEROP.md](SKP_INTEROP.md).

- Import läuft asynchron als `ImportJob`
- Neutrales Zwischenformat: `ImportAsset` (JSON)
- DWG/DXF MVP: Linien, Polylinien, Layer
- SKP MVP: Geometrie + Komponenten als Referenzmodell

---

## Deployment (MVP)

- **lokal:** Docker Compose (Postgres + API + Frontend)
- **Render-Worker:** separater Prozess, kann auf beliebigem Host laufen
- **Dateispeicher:** lokales Filesystem (MVP) → S3-kompatibel (später)
