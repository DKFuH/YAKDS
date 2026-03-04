# Sprint 92 - Projektarchiv, Kontakte & Shop-Defaults

**Branch:** `feature/sprint-92-projektarchiv-kontakte-shop-defaults`
**Gruppe:** A (startbar nach S49)
**Status:** `done`
**Abhaengigkeiten:** S47, S49, S84

---

## Ziel

Projektarchiv, Kontaktregister und tenantweite Standardwerte zusammenziehen:
Projektstatus, Standardberater, Standardbereich und Kontaktrollen sollen
konfigurierbar, filterbar und archivfest sein.

---

## 1. Backend

Einzufuehren:

- archivierte Projekte mit `archived_at`, `retention_until`, `archive_reason`
- tenantweite Defaults fuer `advisor`, `processor`, `area_name`, `alternative_name`
- erweitertes Kontaktmodell fuer Unternehmen, Privatkontakte und Ansprechpartner

Neue Endpunkte:

- `GET /projects/archive`
- `POST /projects/:id/archive`
- `POST /projects/:id/restore`
- `GET /tenant/project-defaults`
- `PUT /tenant/project-defaults`

---

## 2. Frontend

- Archivansicht mit Suche, Filtern und Restore
- Settings-Seite fuer Projekt-Defaults
- Kontaktregister mit Rollen, Typ und Zuordnung zu Projekten

---

## 3. DoD

- archivierte Projekte verschwinden aus der aktiven Projektliste
- Restore bringt ein Projekt inklusive Kontakten wieder zurueck
- neue Projekte uebernehmen tenantweite Defaults automatisch
- mindestens 12 Tests fuer Archiv, Restore und Defaults

---

## Umgesetzt

- Backend-Datenmodell erweitert:
	- `Project`: `archived_at`, `retention_until`, `archive_reason`
	- `TenantSetting`: `default_advisor`, `default_processor`, `default_area_name`, `default_alternative_name`
	- `Contact`: `party_kind`, `contact_role`
	- neues Enum `ContactPartyKind`
- Migration angelegt:
	- `planner-api/prisma/migrations/20260305023000_sprint92_project_archive_defaults/migration.sql`
- Projekt-Archiv API umgesetzt:
	- `GET /projects/archive`
	- `POST /projects/:id/archive`
	- `POST /projects/:id/restore`
	- bestehendes `3dots`-Archivieren auf Archivmetadaten angepasst
- Tenant-Defaults API umgesetzt:
	- `GET /tenant/project-defaults`
	- `PUT /tenant/project-defaults`
- Projektanlage erweitert:
	- neue Projekte uebernehmen tenantweite Defaults fuer Berater/Sachbearbeiter
	- initialer Bereich + Alternative wird automatisch aus Defaults angelegt
- Kontaktregister erweitert:
	- Filter und Anlage unterstuetzen `type`, `party_kind` und `contact_role`
- Frontend erweitert:
	- neue Seite `ProjectArchivePage` inkl. Suche/Filter/Restore
	- neue Seite `ProjectDefaultsPage` fuer tenantweite Projekt-Defaults
	- Routing und Navigation fuer Archiv/Defaults integriert
	- Contacts-UI um Typ-/Rollen-/Parteiart-Filter und Felder erweitert
- Tests und Validierung:
	- Route-Tests erweitert: `projects.test.ts` (12), `tenantSettings.test.ts` (12), `contacts.test.ts` (4)
	- ausgefuehrt: `npm run test -- src/routes/projects.test.ts src/routes/tenantSettings.test.ts src/routes/contacts.test.ts` (28/28 gruen)
	- Prisma Client regeneriert: `npm run db:generate`
	- Build erfolgreich: `planner-api` (`npm run build`) und `planner-frontend` (`npm run build`)
