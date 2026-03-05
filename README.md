# OpenKitchenPlanner (OKP)

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![Status](https://img.shields.io/badge/Status-v0.1.0--rc1-green.svg)]()
[![Node](https://img.shields.io/badge/Node-v20%20%7C%20v22-green)](https://nodejs.org/)

[English](#english) | [Deutsch](#deutsch)

---

<a name="english"></a>
## 🇬🇧 English: Project Overview

OpenKitchenPlanner is a web-based planning platform specifically designed for carpentry workshops and kitchen studios. It combines room modeling, catalog-based CAD workflows, pricing, professional quote generation, and production export pipelines within a single monorepo.

### 🚀 Release Status
* **Current Channel:** `v0.1.0-rc1` (2026-03-04)
* **Stabilization Focus:** Sprint 98 (Core-path hardening, tenant-scope checks, regression cleanup).
* **Verification:** Full build & test suite status: **Green**.

### 🛠 Core Capabilities
* **Modeling:** Advanced polygonal rooms with wall-based constraints, sloped ceilings, and curved walls.
* **Business:** 9-step pricing engine, automatic Bill of Materials (BOM) calculation, and professional PDF quote generation with custom branding.
* **Project Management:** Integrated Kanban boards, Gantt charts, Document Management (DMS), and tenant-aware CRM features.
* **Production:** Automated cutlists, CNC nesting (DXF export), and internal production order management.
* **Interoperability:** Support for IFC (BIM), DXF/DWG, SketchUp import, and GLTF/GLB exports for AR/VR applications.
* **AI Integration:** Native **MCP (Model Context Protocol)** support for AI-assisted planning and automation.

### 🏗 Roadmap Overview
* **Phase 1: MVP (Sprints 0-19):** Basic geometry, catalog system, and initial pricing logic.
* **Phase 2: Professionalization (Sprints 20-60):** Multi-tenancy, high-end room interactions, and floor plan tracing.
* **Phase 3: Industry Excellence (Sprints 61-83):** Multi-floor support, staircase modeling, and room acoustics visualization.
* **Phase 4: Refinement (Sprints 84-98):** Internationalization (i18n), CAD-standard navigation, and deep system stabilization.

---

### 📦 Detailed Installation Guide (EN)

#### 📋 Prerequisites
* **Node.js:** version `20.x` or `22.x` (LTS)
* **Package Manager:** `npm` version `10+`
* **Docker:** Docker Desktop or Engine + Compose (for Option A)
* **Database:** PostgreSQL `15+` (if not using Docker)

#### 🐳 Setup Option A: Docker (Recommended)
The fastest way to get the API and Database running in an isolated environment.

1.  **Clone & Enter:**
    ```bash
    git clone https://github.com/DKFuH/OKP.git
    cd OKP
    ```
2.  **Spin up Services:**
    ```bash
    docker-compose up -d --build
    ```
3.  **Database Migration:**
    ```bash
    # Push the Prisma schema to the Docker-Postgres instance
    docker-compose exec api npm run db:push
    ```
4.  **Start Frontend:**
    The frontend runs locally for better development performance (HMR).
    ```bash
    npm install
    npm run dev --workspace planner-frontend
    ```

#### 💻 Setup Option B: Native Local Development
1.  **Install Dependencies:**
    ```bash
    npm install
    ```
2.  **Environment Configuration:**
    Create a `.env` file in `planner-api/`:
    ```dotenv
    DATABASE_URL="postgresql://okp:okp_dev@localhost:5432/okp?schema=public"
    PORT=3000
    HOST=0.0.0.0
    FRONTEND_URL=http://localhost:5173
    ```
3.  **Initialize Database:**
    ```bash
    npm run db:generate
    npm run db:push --workspace planner-api
    ```
4.  **Run Development Servers:**
    ```bash
    # Terminal 1: API
    npm run dev --workspace planner-api

    # Terminal 2: Frontend
    npm run dev --workspace planner-frontend
    ```

---

<a name="deutsch"></a>
## 🇩🇪 Deutsch: Projektübersicht

OpenKitchenPlanner ist eine webbasierte Planungsplattform für Schreinereien und Küchenstudios. Es vereint Raumplanung, Katalog- und CAD-Workflows, Kalkulation, Angebotserstellung und Export-Pipelines in einem Monorepo.

### 🚀 Release-Status
* **Aktueller Kanal:** `v0.1.0-rc1` (04.03.2026)
* **Stabilisierungsschwerpunkt:** Sprint 98 (Härtung der Kernpfade, Mandanten-Prüfungen, Bereinigung von Regressionen).

### 🛠 Kernfunktionen
* **Modellierung:** Polygonale Räume mit Wand-Constraints, Dachschrägen und gebogenen Wänden.
* **Business:** 9-stufige Kalkulations-Engine, Stücklisten (BOM) und PDF-Angebotserstellung mit Firmenbranding.
* **Projektmanagement:** Kanban-Boards, Gantt-Diagramme, Dokumentenmanagement (DMS) und mandantenfähiges CRM.
* **Produktion:** Zuschnittlisten, CNC-Nesting (DXF-Export) und interne Produktionsaufträge.
* **Interop:** IFC (BIM), DXF/DWG, SketchUp-Import und GLTF/GLB-Exporte für AR/VR.
* **KI-Integration:** Volle MCP-Unterstützung (Model Context Protocol) für KI-gestützte Planung.

---

### 📦 Ausführliche Installationsanweisung (DE)

#### 📋 Voraussetzungen
* **Node.js:** Version `20.x` oder `22.x` (LTS)
* **Package Manager:** `npm` Version `10+`
* **Docker:** Docker Desktop oder Compose (für Option A)
* **Datenbank:** PostgreSQL `15+` (falls Docker nicht genutzt wird)

#### 🐳 Setup Option A: Docker (Empfohlen)
Der schnellste Weg für API und Datenbank in einer isolierten Umgebung.

1.  **Repository klonen:**
    ```bash
    git clone https://github.com/DKFuH/OKP.git
    cd OKP
    ```
2.  **Container starten:**
    ```bash
    docker-compose up -d --build
    ```
3.  **Datenbank-Migration:**
    ```bash
    docker-compose exec api npm run db:push
    ```
4.  **Frontend starten:**
    ```bash
    npm install
    npm run dev --workspace planner-frontend
    ```

#### 💻 Setup Option B: Lokale native Entwicklung
1.  **Abhängigkeiten installieren:**
    ```bash
    npm install
    ```
2.  **Datenbank-Konfiguration:**
    Erstellen Sie eine `.env` Datei in `planner-api/`:
    ```dotenv
    DATABASE_URL="postgresql://okp:okp_dev@localhost:5432/okp?schema=public"
    PORT=3000
    HOST=0.0.0.0
    FRONTEND_URL=http://localhost:5173
    ```
3.  **Prisma initialisieren:**
    ```bash
    npm run db:generate
    npm run db:push --workspace planner-api
    ```
4.  **Server starten:**
    ```bash
    # Terminal 1: API starten
    npm run dev --workspace planner-api

    # Terminal 2: Frontend starten
    npm run dev --workspace planner-frontend
    ```

---

## 📂 Monorepo Structure

```text
OKP/
├── planner-frontend/      # React app (Konva/Three.js)
├── planner-api/           # Fastify REST API & MCP Server
├── shared-schemas/        # Shared domain types (Zod)
├── interop-cad/           # DXF/DWG import & export
├── interop-sketchup/      # SKP import
└── Docs/                  # Architecture, Roadmap, Sprint Docs
```

## 🧪 Testing & Verification

```bash
# Full monorepo tests
npm test

# Security-focused smoke suite
npm run test --workspace planner-api -- src/routes/quotes.test.ts src/routes/tenantSettings.test.ts
```

## ⚖️ License / Lizenz

Copyright © 2026 Tischlermeister Daniel Klas.
Licensed under the Apache License 2.0.
## Contributing

- Contribution guide: [CONTRIBUTING.md](CONTRIBUTING.md)
- Ready starter tasks: [Docs/GOOD_FIRST_ISSUES.md](Docs/GOOD_FIRST_ISSUES.md)
- Use the GitHub issue and PR templates in `.github/`
