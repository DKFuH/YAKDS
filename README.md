# OpenKitchenPlanner (OKP)

OpenKitchenPlanner is a web-based kitchen planning system
for professional carpentry workshops and kitchen studios.

It combines polygonal room modeling, CAD interoperability,
3D rendering, catalog imports and full commercial pricing logic
in one integrated platform.

## Features

- **Polygonal rooms** – non-rectangular floor plans as arbitrary polygons
- **Sloped ceilings** – height constraints per wall for sloped roof sections
- **Doors & windows** – placement on any wall with offset, hinge side and direction
- **Kitchen configurator** – cabinet, front, handle, worktop, accessory
- **BOM & pricing** – automatic BOM calculation with tiered discounts
- **Quote generator** – PDF export with line-item prices
- **Quote lines** – manual line items, pricing groups, custom positions (Sprint 40)
- **Document management** – upload, download, filter/tags, automatic quote-PDF storage
- **CRM-Light** – contacts, project links, lead sources, conversion/revenue metrics
- **Dashboards/KPIs** – saveable widget layouts per user with KPI endpoints
- **Catalog indexing** – project-based purchase/sell indexes with pricing integration
- **Platform features** – global search, CSV export, notification webhooks, tenant backups
- **DXF import/export** – floor plan from CAD and back, using OKP layer naming (`OKP_ROOM`, `OKP_WALLS`, …)
- **SketchUp import** – `.skp` reference model as 3D context
- **IDM/manufacturer import** – XML/IDM/ZIP import path for manufacturer catalogs
- **Render worker** – external renderers register via REST API
- **3D preview** – Three.js in browser, ray tracing via worker queue
- **Wall objects** – doors and windows with hinge side and visibility (Sprint 32)
- **Installations** – sockets, water, gas connections per wall (Sprint 33)
- **Macros** – save and reuse placement sets at project level (Sprint 35)
- **Worktop schemas** – polygon-based worktop definitions with edge types (Sprint 36)
- **Annotations** – measure lines, section lines, comments (Sprint 37)
- **Room decoration** – surface colors, materials, decorative objects (Sprint 38)
- **Lighting profiles** – light sources with position, intensity and color temperature (Sprint 39)

## Current development status (2026-03-04)

- **MVP (Sprints 0–19):** complete
- **Phase 2 (Sprints 20–24):** complete
- **Phase 3 (Sprints 25–30):** complete (documents, contacts, dashboards, catalog indexing, platform routes)
- **Sprints 31–40:** backend complete, frontend implemented
- **Sprint 98 (Stabilization):** core build/test regressions hardened, tenant-scope checks tightened in quote paths

## Tech stack

| Layer        | Technology                                      |
|--------------|-------------------------------------------------|
| Frontend     | React + TypeScript + Vite + Konva.js / Three.js |
| Backend      | Node.js + Fastify + TypeScript                  |
| Database     | PostgreSQL via Prisma ORM                       |
| Validation   | Zod + shared-schemas                            |
| CAD interop  | dxf-parser / dxf-writer                         |
| Testing      | Vitest                                          |

## Monorepo structure

```
open-kitchen-planner/
├── planner-frontend/      # React app
├── planner-api/           # Fastify REST API
├── shared-schemas/        # Zod schemas (shared) – @okp/shared-schemas
├── interop-cad/           # DXF import & export – @okp/dxf-import, @okp/dxf-export
├── interop-sketchup/      # SKP import – @okp/skp-import
└── Docs/                  # Architecture & sprint planning
```

## Quick start (Node.js)

```bash
# Install dependencies
npm install

# Run tests
npm test

# Start frontend
cd planner-frontend && npm run dev

# Start API
cd planner-api && npm run dev
```

## Docker quick start (API + PostgreSQL)

For reproducible setup on remote environments and local onboarding, use Docker
Compose from the repository root.

Prerequisites:

- Docker Desktop (Windows/macOS) or Docker Engine + Compose

```bash
# Build and start database + API
docker-compose up -d --build postgres api

# Apply Prisma schema to the running database
docker-compose exec api npm run db:push

# Follow API logs
docker-compose logs -f api
```

Services:

- API: `http://localhost:3000`
- PostgreSQL: `localhost:5432` (`yakds` / `yakds_dev`, database `yakds`)

Frontend is not part of `docker-compose.yml` and can be started locally:

```bash
npm run dev --workspace planner-frontend
```

Stop/reset:

```bash
# Stop containers
docker-compose down

# Stop and remove PostgreSQL volume data
docker-compose down -v
```

## Documentation

- [Architecture](Docs/ARCHITECTURE.md)
- [Domain models](Docs/DOMAIN_MODELS.md) – room model, pricing logic, quote system
- [Interop](Docs/INTEROP.md) – DXF/DWG, SketchUp, render worker protocol
- [Styling guide](Docs/STYLING_GUIDE_OKP.md) – tokens, component patterns, rollout
- [Roadmap](Docs/ROADMAP.md) – Sprints 0–19 (MVP) + Phase 2 (20–24)
- [Phase-3 DoD & execution plan](Docs/PHASE_3_DOD_AND_EXECUTION_PLAN.md)
- [Status](Docs/STATUS.md) – current implementation status incl. Phase 3

## Contributing

Contributions are welcome – please read [CONTRIBUTING.md](CONTRIBUTING.md) first.

## Code of conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md).

## Security

Please report security vulnerabilities confidentially – see [SECURITY.md](SECURITY.md).

## License

Copyright 2026 Tischlermeister Daniel Klas
Licensed under the [Apache License 2.0](LICENSE).
