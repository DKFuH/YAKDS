# PHASE_2_REVIEW.md

Code-Review Phase 2 (Sprints 20–24) — Stand 2026-03-01

---

## Status-Übersicht

| Sprint | Fokus | Backend | Tests | Frontend-Bridge | Status |
|--------|-------|---------|-------|-----------------|--------|
| 20 | Herstellerkatalog | ✅ | ⚠️ nur Importer | ❌ Legacy UI | Staging |
| 21 | Auto-Completion | ✅ | ❌ | ❌ | Staging |
| 22 | Rule Engine v2 | ✅ | ❌ | ⚠️ Basis Panel | Staging |
| 23 | Multi-Tenant & BI | ✅ | ⚠️ nur Aggregator | ❌ | Staging |
| 24 | Lead Promotion | ✅ | ❌ | ❌ | Staging |

> API-Endpunkte laut Task-History als „erledigt" markiert — Unit- und Integrationstests fehlen jedoch für fast alle neuen Services. Hersteller-Datenstrukturen noch nicht vollständig in Frontend-Anzeige und BOM-Berechnung integriert.

---

## Befunde & Gaps

### 1. BOM / Pricing Bridge (Kritisch)

`bomCalculator.ts` rechnet derzeit nur mit `CatalogItem` (Phase 1).

- Konfigurierte Artikel (`CatalogArticle`) aus Sprint 20 werden ignoriert
- Automatisch generierte Langteile (`GeneratedItem`) aus Sprint 21 fehlen in der Preiszusammenfassung

**Betroffene Datei:** `planner-api/src/services/bomCalculator.ts`

---

### 2. Frontend-Integration (Hoch)

- `LeftSidebar` nutzt weiterhin Legacy-Katalog (Phase 1)
- Hersteller-Auswahl und Artikelliste im Editor nicht möglich
- `KonfiguratorPanel` unterstützt nur Dimensionen — keine Varianten/Optionen (Fronten, Griffe)

**Betroffene Dateien:** `planner-frontend/src/` (Sidebar, catalogApi, KonfiguratorPanel)

---

### 3. Test-Abdeckung (Hoch)

Keine `.test.ts`-Dateien für folgende neuen Routen:

- `planner-api/src/routes/manufacturers.ts`
- `planner-api/src/routes/autoCompletion.ts`
- `planner-api/src/routes/validateV2.ts`
- `planner-api/src/routes/bi.ts`
- `planner-api/src/routes/leads.ts`

Multi-Tenant-Middleware nicht automatisiert geprüft.

---

## Priorisierte Maßnahmen

### Prio 1 — BOM-Integration (Sprint 20/21 Finalisierung)

- [x] `bomCalculator.ts`: `GeneratedItem`-Einbeziehung
- [x] `catalog_article_id` in BOM-Zeilen-Generierung unterstützen

### Prio 2 — Test-Suite Phase 2

- [x] Integrationstests für `manufacturers.ts`
- [x] Integrationstests für `validateV2.ts`
- [x] Integrationstests für `bi.ts` (KPI-Summary, Quotes, Products, Tenant-CRUD)
- [x] Integrationstests für `leads.ts` (Create, List, Promote)
- [x] `tenantMiddleware.test.ts` — Multi-Tenant-Isolation absichern

### Prio 3 — Frontend-Upgrade (Vorbereitung Phase 3)

- [ ] `catalogApi` im Frontend für Hersteller-Zugriffe erweitern
- [ ] Dynamische Optionen (Varianten) im `KonfiguratorPanel`

---

## Nächste Review-Runde

Nach Umsetzung von Prio 1+2: erneuter Review-Lauf mit aktualisierten Testergebnissen.
