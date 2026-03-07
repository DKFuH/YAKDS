# OpenKitchenPlanner (OKP)

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![Status](https://img.shields.io/badge/Status-v0.1.1-green.svg)]()
[![Node](https://img.shields.io/badge/Node-v20%20%7C%20v22-green)](https://nodejs.org/)

[English](#english) | [Deutsch](#deutsch)

---

<a name="english"></a>
## 🇬🇧 English: Project Overview

OpenKitchenPlanner is a web-based planning platform for carpentry workshops and kitchen studios. It combines room modeling, catalog-based CAD workflows, pricing, quote generation, and production export pipelines in a single monorepo — with a Fluent 2 ribbon UI and full MCP integration.

### 🚀 Status
* **Version:** `0.1.1` (2026-03-07)
* **Build:** Green — 160 frontend tests, full tsc + vite build clean.
* **UI:** Fluent 2 Ribbon Shell across all areas (Kanban, Editor, Settings).
* **Backend:** Fastify REST API + PostgreSQL (Prisma).

### 🛠 Core Capabilities
* **Modeling:** Polygonal rooms with wall constraints, sloped ceilings, curved walls, multi-floor support.
* **Business:** Pricing engine, Bill of Materials (BOM), PDF quote generation with custom branding.
* **Project Management:** Kanban board, Gantt timeline, Document Management (DMS), CRM contacts.
* **Production:** Automated cutlists, CNC nesting (DXF export), production order management.
* **Interoperability:** IFC (BIM), DXF/DWG, SketchUp import, GLTF/GLB export for AR/VR.
* **AI Integration:** Native **MCP (Model Context Protocol)** support for AI-assisted planning.

### 🏗 Development Phases
* **Phase 1–4 (Sprints 0–98):** MVP → multi-tenancy → industry features → stabilization.
* **Phase 5 (Sprints 99–110):** Workflow engine, masterdata sync, mobile client, Fluent 2 migration, Ribbon Shell.

---

### 📦 Installation (EN)

#### Prerequisites
* **Node.js:** `20.x` or `22.x` (LTS)
* **npm:** `10+`
* **Database:** PostgreSQL `15+`

#### Option A: Docker
```bash
git clone https://github.com/DKFuH/OKP.git
cd OKP
docker-compose up -d --build
docker-compose exec api npm run db:push
npm install
npm run dev --workspace planner-frontend
```

#### Option B: Local (e.g. Laragon)

1. Create a PostgreSQL database, e.g. `okp` with user `okp` / password `okp_dev`.
2. Create `planner-api/.env`:
   ```dotenv
   DATABASE_URL="postgresql://okp:okp_dev@localhost:5432/okp"
   PORT=3000
   HOST=0.0.0.0
   FRONTEND_URL=http://localhost:5173
   ```
3. Run:
   ```bash
   npm install
   npm run db:push --workspace planner-api
   # Terminal 1
   npm run dev --workspace planner-api
   # Terminal 2
   npm run dev --workspace planner-frontend
   ```
4. Open **http://localhost:5173**

---

<a name="deutsch"></a>
## 🇩🇪 Deutsch: Projektübersicht

OpenKitchenPlanner ist eine webbasierte Planungsplattform für Schreinereien und Küchenstudios. Sie vereint Raumplanung, Katalog-CAD, Kalkulation, Angebotserstellung und Produktions-Export in einem Monorepo — mit Fluent 2 Ribbon-UI und vollständiger MCP-Integration.

### 🚀 Status
* **Version:** `0.1.1` (07.03.2026)
* **Build:** Grün — 160 Frontend-Tests, tsc + vite sauber.
* **UI:** Fluent 2 Ribbon-Shell in allen Bereichen (Kanban, Editor, Einstellungen).
* **Backend:** Fastify REST-API + PostgreSQL (Prisma).

### 🛠 Kernfunktionen
* **Modellierung:** Polygonale Räume mit Wand-Constraints, Dachschrägen, gebogenen Wänden, Mehr-Ebenen.
* **Business:** Kalkulations-Engine, Stücklisten (BOM), PDF-Angebote mit Firmenbranding.
* **Projektmanagement:** Kanban-Board, Gantt-Timeline, Dokumentenmanagement (DMS), Kontakte/CRM.
* **Produktion:** Zuschnittlisten, CNC-Nesting (DXF-Export), Produktionsaufträge.
* **Interop:** IFC (BIM), DXF/DWG, SketchUp-Import, GLTF/GLB-Export für AR/VR.
* **KI-Integration:** Native MCP-Unterstützung (Model Context Protocol) für KI-gestützte Planung.

---

### 📦 Installation (DE)

#### Voraussetzungen
* **Node.js:** `20.x` oder `22.x` (LTS)
* **npm:** `10+`
* **Datenbank:** PostgreSQL `15+`

#### Option A: Docker
```bash
git clone https://github.com/DKFuH/OKP.git
cd OKP
docker-compose up -d --build
docker-compose exec api npm run db:push
npm install
npm run dev --workspace planner-frontend
```

#### Option B: Lokal (z. B. Laragon)

1. PostgreSQL-Datenbank anlegen, z. B. `yakds` / User `yakds` / Passwort `yakds_dev` (oder `okp`/`okp_dev`/`okp`).
2. `planner-api/.env` anlegen:
   ```dotenv
   DATABASE_URL="postgresql://yakds:yakds_dev@localhost:5432/yakds"
   PORT=3000
   HOST=0.0.0.0
   FRONTEND_URL=http://localhost:5173
   ```
3. Starten:
   ```bash
   npm install
   npm run db:push --workspace planner-api
   # Terminal 1
   npm run dev --workspace planner-api
   # Terminal 2
   npm run dev --workspace planner-frontend
   ```
4. **http://localhost:5173** öffnen

---

## 📂 Monorepo-Struktur

```text
OKP/
├── planner-frontend/      # React + Fluent 2 + Konva/Three.js
├── planner-api/           # Fastify REST-API & MCP-Server
├── shared-schemas/        # Gemeinsame Domain-Typen (Zod)
├── interop-cad/           # DXF/DWG Import & Export
├── interop-sketchup/      # SKP-Import
└── Docs/                  # Architektur, Roadmap, Sprint-Docs
```

## 🧪 Tests

```bash
# Alle Tests
npm test

# Nur Frontend
npm run test --workspace planner-frontend
```

## ⚖️ Lizenz / License

Copyright © 2026 Tischlermeister Daniel Klas.
Licensed under the Apache License 2.0.
