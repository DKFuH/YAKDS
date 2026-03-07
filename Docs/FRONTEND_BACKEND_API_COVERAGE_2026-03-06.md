# Frontend-Backend API Coverage Report

Stand: 2026-03-06 (statische Code-Analyse)

## Summary

- Frontend API-Module mit Calls: 52
- Core-Backend-Route-Module analysiert: 74
- Core-Module ohne Frontend-Match: 24
- Plugin-Route-Module analysiert: 11

## Frontend -> Backend (pro API-Modul)

| Frontend API-Modul | #Calls | Segmente |
|---|---:|---|
| `planner-frontend/src/api/rooms.ts` | 41 | projects, rooms, wall-objects, walls |
| `planner-frontend/src/api/projects.ts` | 15 | alternatives, projects |
| `planner-frontend/src/api/projectFeatures.ts` | 13 | cutlists, projects |
| `planner-frontend/src/api/reports.ts` | 12 | reports |
| `planner-frontend/src/api/materialLibrary.ts` | 10 | projects, tenant |
| `planner-frontend/src/api/siteSurveys.ts` | 10 | checklists, projects, site-surveys |
| `planner-frontend/src/api/areas.ts` | 9 | alternatives, projects |
| `planner-frontend/src/api/assetLibrary.ts` | 9 | tenant |
| `planner-frontend/src/api/dimensions.ts` | 8 | dimensions, rooms |
| `planner-frontend/src/api/kitchenAssistant.ts` | 8 | catalog, catalog-macros, kitchen-layout-suggestions, rooms |
| `planner-frontend/src/api/productionOrders.ts` | 7 | production-orders, projects |
| `planner-frontend/src/api/compliance.ts` | 6 | gdpr, role-permissions, sla-snapshots |
| `planner-frontend/src/api/imports.ts` | 6 | imports, projects |
| `planner-frontend/src/api/panoramaTours.ts` | 6 | panorama-tours, projects, share |
| `planner-frontend/src/api/tenantSettings.ts` | 6 | tenant |
| `planner-frontend/src/api/acoustics.ts` | 5 | acoustic-grids, projects |
| `planner-frontend/src/api/cameraPresets.ts` | 5 | projects |
| `planner-frontend/src/api/documents.ts` | 5 | projects |
| `planner-frontend/src/api/drawingGroups.ts` | 5 | drawing-groups, projects |
| `planner-frontend/src/api/fengshui.ts` | 5 | fengshui-analyses, projects |
| `planner-frontend/src/api/languagePacks.ts` | 5 | language-packs, language-packs* |
| `planner-frontend/src/api/layoutStyles.ts` | 5 | layout-sheets, tenant |
| `planner-frontend/src/api/levels.ts` | 5 | levels, projects |
| `planner-frontend/src/api/nesting.ts` | 5 | nesting-jobs, projects |
| `planner-frontend/src/api/business.ts` | 4 | projects |
| `planner-frontend/src/api/constraints.ts` | 4 | constraints, rooms |
| `planner-frontend/src/api/openings.ts` | 4 | rooms |
| `planner-frontend/src/api/placements.ts` | 4 | rooms |
| `planner-frontend/src/api/specificationPackages.ts` | 4 | projects, specification-packages |
| `planner-frontend/src/api/verticalConnections.ts` | 4 | projects, vertical-connections |
| `planner-frontend/src/api/bi.ts` | 3 | bi |
| `planner-frontend/src/api/catalog.ts` | 3 | catalog, manufacturers |
| `planner-frontend/src/api/contacts.ts` | 3 | contacts, contacts*, projects |
| `planner-frontend/src/api/dashboards.ts` | 3 | dashboards, kpis |
| `planner-frontend/src/api/ifcInterop.ts` | 3 | alternatives, projects |
| `planner-frontend/src/api/mediaCapture.ts` | 3 | projects |
| `planner-frontend/src/api/offlineSync.ts` | 3 | offline-sync, projects |
| `planner-frontend/src/api/presentation.ts` | 3 | projects, render-jobs |
| `planner-frontend/src/api/projectEnvironment.ts` | 3 | projects |
| `planner-frontend/src/api/quotes.ts` | 3 | projects, quotes |
| `planner-frontend/src/api/supplierPortal.ts` | 3 | erp-connectors, projects, purchase-orders |
| `planner-frontend/src/api/autoCompletion.ts` | 2 | projects |
| `planner-frontend/src/api/cadInterop.ts` | 2 | alternatives, projects |
| `planner-frontend/src/api/catalogIndices.ts` | 2 | projects |
| `planner-frontend/src/api/leads.ts` | 2 | leads |
| `planner-frontend/src/api/renderEnvironment.ts` | 2 | projects |
| `planner-frontend/src/api/validateV2.ts` | 2 | projects |
| `planner-frontend/src/api/visibility.ts` | 2 | projects |
| `planner-frontend/src/api/bom.ts` | 1 | bom |
| `planner-frontend/src/api/centerlines.ts` | 1 | rooms |
| `planner-frontend/src/api/validate.ts` | 1 | projects |
| `planner-frontend/src/api/validation.ts` | 1 | projects |

## Core Backend Module Coverage (aus `planner-api/src/index.ts`)

| Backend Route-Modul | Endpunkte | Gematcht | Nicht gematcht | Coverage |
|---|---:|---:|---:|---:|
| `manufacturers` | 11 | 2 | 9 | 18.2% |
| `articleConfigurator` | 8 | 0 | 8 | 0% |
| `layoutSheets` | 8 | 0 | 8 | 0% |
| `pricing` | 8 | 0 | 8 | 0% |
| `bi` | 7 | 0 | 7 | 0% |
| `integrationHooks` | 7 | 0 | 7 | 0% |
| `masterdata` | 7 | 0 | 7 | 0% |
| `userFavorites` | 7 | 0 | 7 | 0% |
| `workflows` | 7 | 0 | 7 | 0% |
| `erpConnectors` | 7 | 1 | 6 | 14.3% |
| `mobile` | 6 | 0 | 6 | 0% |
| `platform` | 6 | 0 | 6 | 0% |
| `reports` | 16 | 10 | 6 | 62.5% |
| `batchPrint` | 5 | 0 | 5 | 0% |
| `blocks` | 5 | 0 | 5 | 0% |
| `cadInterop` | 5 | 0 | 5 | 0% |
| `exports` | 5 | 0 | 5 | 0% |
| `fillerPieces` | 5 | 0 | 5 | 0% |
| `imports` | 11 | 6 | 5 | 54.5% |
| `processReporting` | 5 | 0 | 5 | 0% |
| `purchaseOrders` | 7 | 2 | 5 | 28.6% |
| `renderJobs` | 7 | 2 | 5 | 28.6% |
| `alternativeWorkflow` | 4 | 0 | 4 | 0% |
| `compliance` | 10 | 6 | 4 | 60% |
| `projects` | 17 | 13 | 4 | 76.5% |
| `validateV2` | 6 | 2 | 4 | 33.3% |
| `ceilingConstraints` | 3 | 0 | 3 | 0% |
| `centerlines` | 4 | 1 | 3 | 25% |
| `coverPanels` | 3 | 0 | 3 | 0% |
| `kitchenAssistant` | 10 | 7 | 3 | 70% |
| `leads` | 5 | 2 | 3 | 40% |
| `locales` | 3 | 0 | 3 | 0% |
| `shareLinks` | 3 | 0 | 3 | 0% |
| `autoCompletion` | 4 | 2 | 2 | 50% |
| `catalog` | 3 | 1 | 2 | 33.3% |
| `documents` | 5 | 3 | 2 | 60% |
| `ifcInterop` | 3 | 1 | 2 | 33.3% |
| `mcp` | 2 | 0 | 2 | 0% |
| `openings` | 6 | 4 | 2 | 66.7% |
| `orders` | 2 | 0 | 2 | 0% |
| `quotes` | 5 | 3 | 2 | 60% |
| `rooms` | 9 | 7 | 2 | 77.8% |
| `visibility` | 4 | 2 | 2 | 50% |
| `workspaceLayout` | 2 | 0 | 2 | 0% |
| `bom` | 2 | 1 | 1 | 50% |
| `business` | 5 | 4 | 1 | 80% |
| `constraints` | 5 | 4 | 1 | 80% |
| `contacts` | 3 | 2 | 1 | 66.7% |
| `drawingGroups` | 5 | 4 | 1 | 80% |
| `layoutStyles` | 5 | 4 | 1 | 80% |
| `levels` | 5 | 4 | 1 | 80% |
| `panoramaTours` | 6 | 5 | 1 | 83.3% |
| `placements` | 5 | 4 | 1 | 80% |
| `roomDecoration` | 5 | 4 | 1 | 80% |
| `specificationPackages` | 5 | 4 | 1 | 80% |
| `validate` | 2 | 1 | 1 | 50% |
| `annotations` | 15 | 15 | 0 | 100% |
| `areas` | 9 | 9 | 0 | 100% |
| `cameraPresets` | 5 | 5 | 0 | 100% |
| `catalogIndices` | 2 | 2 | 0 | 100% |
| `checklists` | 5 | 5 | 0 | 100% |
| `dashboards` | 3 | 3 | 0 | 100% |
| `dimensions` | 7 | 7 | 0 | 100% |
| `lighting` | 3 | 3 | 0 | 100% |
| `macros` | 3 | 3 | 0 | 100% |
| `mediaCapture` | 3 | 3 | 0 | 100% |
| `offlineSync` | 3 | 3 | 0 | 100% |
| `productionOrders` | 7 | 7 | 0 | 100% |
| `quotelines` | 6 | 6 | 0 | 100% |
| `renderEnvironments` | 2 | 2 | 0 | 100% |
| `siteSurveys` | 5 | 5 | 0 | 100% |
| `tenantSettings` | 6 | 6 | 0 | 100% |
| `walls` | 9 | 9 | 0 | 100% |
| `worktops` | 3 | 3 | 0 | 100% |

## Plugin-Route Coverage (zusätzlich zu `index.ts`)

| Plugin | Plugin-Datei | Route-Modul | Endpunkte | Gematcht | Nicht gematcht | Coverage |
|---|---|---|---:|---:|---:|---:|
| `materials` | `materials` | `materialLibrary` | 12 | 7 | 5 | 58.3% |
| `asset-library` | `assetLibrary` | `assetLibrary` | 11 | 7 | 4 | 63.6% |
| `raumakustik` | `raumakustik` | `acoustics` | 6 | 3 | 3 | 50% |
| `tischler` | `tischler` | `cutlist` | 6 | 3 | 3 | 50% |
| `viewer-export` | `viewerExport` | `viewerExports` | 3 | 0 | 3 | 0% |
| `fengshui` | `fengshui` | `fengshui` | 6 | 4 | 2 | 66.7% |
| `survey-import` | `surveyImport` | `surveyImport` | 2 | 0 | 2 | 0% |
| `tischler` | `tischler` | `nesting` | 5 | 5 | 0 | 100% |
| `presentation` | `presentation` | `presentation` | 1 | 1 | 0 | 100% |
| `daylight` | `daylight` | `projectEnvironment` | 3 | 3 | 0 | 100% |
| `stairs` | `stairs` | `verticalConnections` | 4 | 4 | 0 | 100% |

## Backend-Module ohne Frontend-Match (Core)

| Backend Route-Modul | Endpunkte | Hinweis |
|---|---:|---|
| `articleConfigurator` | 8 | aktuell kein direkter Frontend-Call gefunden |
| `layoutSheets` | 8 | aktuell kein direkter Frontend-Call gefunden |
| `pricing` | 8 | aktuell kein direkter Frontend-Call gefunden |
| `bi` | 7 | aktuell kein direkter Frontend-Call gefunden |
| `integrationHooks` | 7 | aktuell kein direkter Frontend-Call gefunden |
| `masterdata` | 7 | aktuell kein direkter Frontend-Call gefunden |
| `userFavorites` | 7 | aktuell kein direkter Frontend-Call gefunden |
| `workflows` | 7 | aktuell kein direkter Frontend-Call gefunden |
| `mobile` | 6 | aktuell kein direkter Frontend-Call gefunden |
| `platform` | 6 | aktuell kein direkter Frontend-Call gefunden |
| `batchPrint` | 5 | aktuell kein direkter Frontend-Call gefunden |
| `blocks` | 5 | aktuell kein direkter Frontend-Call gefunden |
| `cadInterop` | 5 | aktuell kein direkter Frontend-Call gefunden |
| `exports` | 5 | aktuell kein direkter Frontend-Call gefunden |
| `fillerPieces` | 5 | aktuell kein direkter Frontend-Call gefunden |
| `processReporting` | 5 | aktuell kein direkter Frontend-Call gefunden |
| `alternativeWorkflow` | 4 | aktuell kein direkter Frontend-Call gefunden |
| `ceilingConstraints` | 3 | aktuell kein direkter Frontend-Call gefunden |
| `coverPanels` | 3 | aktuell kein direkter Frontend-Call gefunden |
| `locales` | 3 | aktuell kein direkter Frontend-Call gefunden |
| `shareLinks` | 3 | aktuell kein direkter Frontend-Call gefunden |
| `mcp` | 2 | aktuell kein direkter Frontend-Call gefunden |
| `orders` | 2 | aktuell kein direkter Frontend-Call gefunden |
| `workspaceLayout` | 2 | aktuell kein direkter Frontend-Call gefunden |

## Auffälligkeiten

- `languagePacks` Route existiert (`planner-api/src/routes/languagePacks.ts`), ist aber nicht in `planner-api/src/index.ts` oder Plugin-Bootstrap registriert.
- Mehrere Frontend-Calls sind plugin-gated (z. B. `assetLibrary`, `materialLibrary`, `projectEnvironment`, `verticalConnections`, `cutlist`, `nesting`, `viewerExports`).
- Statische Analyse: externe Konsumenten (Webhooks/Mobile/Integrationen) und runtime-bedingte Pfade können bewusst ohne Frontend-Match sein.
