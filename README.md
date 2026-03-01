# YAKDS – Yet Another Kitchen Design Software (Business)

Webbasierter Küchenplaner für Tischler- und Küchenstudiobetriebe.
Polygonale Grundrisse, Dachschrägen, CAD-Interop, externe Render-Worker und vollständige kaufmännische Kalkulation in einem System.

## Features

- **Polygonräume** – nicht-rechteckige Grundrisse als beliebige Polygone
- **Dachschrägen** – Height Constraints je Wand für schräge Decken
- **Türen & Fenster** – Platzierung an beliebigen Wänden mit Offset
- **Küchenkonfigurator** – Korpus, Front, Griff, Arbeitsplatte, Zubehör
- **Stückliste & Preise** – automatische BOM-Berechnung mit Rabattstaffeln
- **Angebotsgenerator** – PDF-Export mit Positionspreisen
- **Dokumentenmanagement** – Upload, Download, Filter/Tags, automatische Quote-PDF-Ablage
- **CRM-Light** – Kontakte, Projektverknüpfungen, Lead-Herkunft, Conversion-/Umsatzkennzahlen
- **Dashboards/KPIs** – speicherbare Widget-Layouts pro User mit KPI-Endpunkten
- **Katalogindexierung** – projektbezogene EK/VK-Indexe mit Pricing-Integration
- **Plattform-Features** – globale Suche, CSV-Export, Notification-Webhooks, Tenant-Backups
- **DXF-Import / -Export** – Grundriss aus CAD einlesen und zurückschreiben
- **SketchUp-Import** – `.skp`-Referenzmodell als 3D-Kontext
- **IDM/Herstellerimport** – XML/IDM/ZIP-Importpfad für Herstellerkataloge
- **Render-Worker** – externe Renderer registrieren sich per REST-API
- **3D-Vorschau** – Three.js im Browser, Raytracing über Worker-Queue

## Aktueller Entwicklungsstand (2026-03-01)

- **MVP (Sprints 0-19):** abgeschlossen
- **Phase 2 (Sprints 20-24):** abgeschlossen
- **Phase 3:** technische Umsetzung für Sprints 26-30 ist weit fortgeschritten (Dokumente, Kontakte, Dashboards, Katalogindexierung, Plattform-Routen)
- **Fokus aktuell:** Härtung, End-to-End-Abnahme und Feinschliff der Cloud-/Ops-Aspekte

## Tech-Stack

| Schicht       | Technologie                                     |
|---------------|-------------------------------------------------|
| Frontend      | React + TypeScript + Vite + Konva.js / Three.js |
| Backend       | Node.js + Fastify + TypeScript                  |
| Datenbank     | PostgreSQL via Prisma ORM                       |
| Validierung   | Zod + shared-schemas                            |
| CAD-Interop   | dxf-parser / dxf-writer                         |
| Testen        | Vitest                                          |

## Monorepo-Struktur

```
YAKDS/
├── planner-frontend/   # React-App
├── planner-api/        # Fastify-REST-API
├── shared-schemas/     # Zod-Schemas (geteilt)
├── interop-cad/        # DXF-Import & -Export
├── interop-sketchup/   # SKP-Import
└── Docs/               # Architektur & Sprintplanung
```

## Schnellstart

```bash
# Abhängigkeiten installieren
npm install

# Tests ausführen
npm test

# Frontend starten
cd planner-frontend && npm run dev

# API starten
cd planner-api && npm run dev
```

## Dokumentation

- [Architektur](Docs/ARCHITECTURE.md)
- [Domänenmodelle](Docs/DOMAIN_MODELS.md) – Raummodell, Preislogik, Angebotswesen
- [Interop](Docs/INTEROP.md) – DXF/DWG, SketchUp, Render-Worker-Protokoll
- [Styling Guide (YAKDS)](Docs/STYLING_GUIDE_YAKDS.md) – Tokens, Komponentenmuster, Rollout
- [Roadmap](Docs/ROADMAP.md) – Sprints 0–19 (MVP) + Phase 2 (20–24)
- [Phase-3 DoD & Ausführungsplan](Docs/PHASE_3_DOD_AND_EXECUTION_PLAN.md)
- [Status](Docs/STATUS.md) – aktueller Umsetzungsstand inkl. Phase 3

## Mitmachen

Beiträge sind willkommen – bitte zuerst [CONTRIBUTING.md](CONTRIBUTING.md) lesen.

## Verhaltenskodex

Dieses Projekt folgt dem [Contributor Covenant](CODE_OF_CONDUCT.md).

## Sicherheit

Sicherheitslücken bitte vertraulich melden – siehe [SECURITY.md](SECURITY.md).

## Lizenz

Copyright 2026 Tischlermeister Daniel Klas
Lizenziert unter der [Apache License 2.0](LICENSE).
