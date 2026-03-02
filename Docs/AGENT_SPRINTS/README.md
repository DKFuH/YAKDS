# AGENT_SPRINTS – Abschluss-Dokumentation

Alle Sprints S47–S60 sind implementiert und in `main` gemergt.
Die Spec-Dateien dienen als Referenz und Abnahme-Dokumentation.

Stand: 2026-03-02 · Teststand: **501 Tests grün**

---

## Sprint-Übersicht

| Sprint | Datei | Status | Commit | Tests |
|--------|-------|--------|--------|-------|
| 47 | `S47-mobile-aufmass.md` | ✅ done | `ab83788` | +15 |
| 48 | `S48-erp-connector.md` | ✅ done | `ab83788` | +10 |
| 49 | `S49-analytics-reports.md` | ✅ done | `ab83788` | +15 |
| 50 | `S50-compliance-rbac.md` | ✅ done | `ab83788` | +12 |
| 51 | `S51-gltf-export.md` | ✅ done | `ab83788` | +5 |
| 52 | `S52-ifc-import-export.md` | ✅ done | `a7f8758` | +10 |
| 53 | `S53-dwg-skp.md` | ✅ done | `b4e7db7` | +12 |
| 54 | `S54-ofml-konfigurator.md` | ✅ done | `b4e7db7` | +22 |
| 55 | `S55-raumakustik.md` | ✅ done | `27f3f69` | +14 |
| 56 | `S56-canvas-ux.md` | ✅ done | `ab83788` | Frontend |
| 57 | `S57-wall-attachments.md` | ✅ done | `def4c96` | +5 |
| 58 | `S58-bild-nachzeichnen.md` | ✅ done | `411028b` | +3 |
| 59 | `S59-bemassung-frontansicht.md` | ✅ done | `299276a` | +10 |
| 60 | `S60-katalog-kitchen-assistant.md` | ✅ done | `299276a` | +15 |

---

## Technische Rahmenbedingungen (Referenz)

- **Backend:** Fastify v5, Prisma 5, Zod, TypeScript, Vitest
- **Frontend:** React 18, React Router v6, CSS Modules, Konva (Canvas)
- **API-Prefix:** `/api/v1`
- **Error-Helpers:** `sendBadRequest(reply, msg)`, `sendNotFound(reply, msg)` aus `../errors.js`
- **Prisma-Client:** `import { prisma } from '../db.js'`
- **API-Client (Frontend):** `import { api } from './client.js'`
