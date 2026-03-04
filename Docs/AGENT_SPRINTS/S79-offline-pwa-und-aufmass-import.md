# Sprint 79 - Offline-PWA & Aufmass-Import

**Branch:** `feature/sprint-79-offline-pwa-measure-import`
**Gruppe:** A (startbar nach S47 und S74)
**Status:** `completed`
**Abhaengigkeiten:** S47 (Mobile Aufmass), S58 (Bild-Nachzeichnen), S74 (Split-View)

---

## Ziel

Den Planer und den Aufmass-Workflow offline-faehig machen. Projekte,
Referenzbilder und zentrale Katalog-/Planungsdaten sollen lokal nutzbar
bleiben. Zusaetzlich wird ein einfacher Importpfad fuer mobile
Aufmass-/Blueprint-Daten vorbereitet.

Leitidee: Offline-Nutzung und strukturierter Aufmass-Import fuer mobile Workflows.

**Architekturregel:** hybrid

- Offline-/PWA-Basis bleibt Core
- Aufmass-/Measurement-Import wird als Plugin `survey-import` umgesetzt

---

## 0. Core-vs-Plugin-Schnitt

Core:

- Manifest
- Service Worker
- Offline-Projektbundle
- Sync-Status und Grundcache

Plugin `survey-import`:

- Measurement-Import-Endpunkt
- Import-Dialog fuer aufgemessene Punkte / Segmentlaengen
- Uebergang in SiteSurvey- und Blueprint-Workflows

---

## 1. Frontend/PWA-Basis

Ergaenzungen:

- Web App Manifest
- Service Worker
- lokale Cache-Strategie fuer App-Shell und Kernassets
- Offline-Hinweis und Sync-Status im UI

V1:

- Desktop und Tablet first
- keine volle conflict resolution
- nur zuletzt verwendete Projekte offline halten

---

## 2. Datenmodell

Optionale Queue-Tabelle fuer Sync-Konflikte:

```prisma
model OfflineSyncJob {
  id            String   @id @default(uuid())
  tenant_id     String
  project_id    String?
  entity_type   String   @db.VarChar(80)
  payload_json  Json
  status        String   @default("pending")
  created_at    DateTime @default(now())
  updated_at    DateTime @updatedAt

  @@index([tenant_id, status])
  @@map("offline_sync_jobs")
}
```

Zusatzpfad fuer Aufmassimport:

- Referenzbild
- erkannte Ecken/Punkte
- optional gemessene Segmentlaengen

---

## 3. Backend

Neue oder angepasste Dateien:

- `planner-api/src/plugins/surveyImport.ts`
- `planner-api/src/routes/offlineSync.ts`
- Erweiterungen in `siteSurveys.ts` oder `rooms.ts`

Endpoints:

- `GET /projects/:id/offline-bundle`
- `POST /offline-sync`
- `POST /rooms/:id/measurement-import`

---

## 4. Frontend

Neue oder angepasste Dateien:

- `planner-frontend/src/pwa/*`
- `planner-frontend/src/plugins/surveyImport/*`
- `planner-frontend/src/api/offlineSync.ts`
- `planner-frontend/src/pages/SiteSurveyPage.tsx`
- `planner-frontend/src/pages/Editor.tsx`

Funktionen:

- App installierbar
- Offline-Badge/Status
- lokale Speicherung zuletzt geoeffneter Projekte
- Aufmass-/Blueprint-Import in den Nachzeichnen-Workflow
- Import-UI nur bei aktivem Plugin

---

## 5. Deliverables

- Manifest und Service Worker
- Offline-Projektbundle
- Sync-Queue fuer Aenderungen
- Measurement-Import-Endpunkt
- Offline-Status im Frontend
- Plugin-Registrierung fuer Aufmassimport
- 10-16 Tests

---

## 6. DoD

- App startet offline mit vorhandenen Projektdaten
- Nutzer sieht klar, ob online/offline gearbeitet wird
- lokale Aenderungen koennen spaeter synchronisiert werden
- Aufmassdaten koennen in einen Raum- oder Blueprint-Workflow uebernommen werden

## 7. Umsetzung (2026-03-04)

- Manifest und Service Worker wurden integriert.
- Offline-Badge und eine deferred Sync-Queue im Frontend wurden umgesetzt.
- Persistentes Datenmodell `OfflineSyncJob` inkl. Migration wurde eingefuehrt.
- Endpunkte fuer Offline-Bundle, Sync und Pending-Status wurden implementiert.
- Measurement-Import-Endpunkt mit Plugin-Gating ueber `survey-import` wurde geliefert.
- `SiteSurveyPage` erhielt Import-UI in einen Zielraum mit optionalem Referenzbild.
- Backend-Tests sowie Frontend-Build wurden erfolgreich validiert.
