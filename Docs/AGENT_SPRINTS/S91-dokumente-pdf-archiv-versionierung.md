# Sprint 91 - Dokumente, PDF-Archiv & Versionssicherung

**Branch:** `feature/sprint-91-dokumente-pdf-archiv-versionierung`
**Gruppe:** B (startbar nach S61 und S70)
**Status:** `done`
**Abhaengigkeiten:** S61 (Angebots-PDF), S70 (Werkstattpakete), S79 (Offline optional)

---

## Ziel

Dokumente pro Projekt zentral sichtbar und nachvollziehbar machen: erzeugte PDFs,
versendete Dokumente, Versionen, lokale Aenderungen und automatische Backups
sollen in einer gemeinsamen Dokumentenlogik zusammenlaufen.

---

## 1. Backend

Einzufuehren:

- `ProjectDocument` als zentrale Dokumenten-Entity
- Dokumenttypen wie `quote_pdf`, `order_pdf`, `spec_package`, `manual_upload`
- `version_no`, `source_kind`, `storage_path`, `checksum`, `sent_at`, `archived_at`
- Backup-/Versionsmetadaten fuer Alternativen und lokale Konfliktfaelle

Neue Endpunkte:

- `GET /projects/:id/documents`
- `POST /projects/:id/documents/upload`
- `POST /projects/:id/documents/:docId/archive-version`
- `GET /projects/:id/documents/version-check`

---

## 2. Frontend

Neue oder erweiterte Ansichten:

- Dokumente-Tab pro Projekt
- Filter nach Typ, Erstellungszeit, Quelle
- Vorschau-/Downloadliste mit Versionshistorie
- Sync-Hinweis bei lokaler Datei neuer als Serverversion

---

## 3. Regeln

- jede erzeugte PDF-Ausgabe kann optional automatisch als Dokumentversion abgelegt werden
- Dokumente sind tenant-sicher getrennt
- Versionen werden nicht ueberschrieben, sondern fortlaufend abgelegt
- Konflikte werden als eigene Dokumenteintraege markiert

---

## 4. DoD

- Dokumente sind pro Projekt in einer Liste sichtbar
- PDF-Erzeugung kann automatisch einen Archiv-Eintrag erzeugen
- Versionscheck erkennt lokale Neuerungen oder Konflikte
- mindestens 12 Tests fuer Dokumentenliste, Versionierung und Konfliktlogik

---

## Umgesetzt

- Backend-Datenmodell erweitert (`Document`):
	- `version_no`, `storage_path`, `checksum`, `sent_at`, `archived_at`, `version_metadata`, `conflict_marker`
	- neue Dokumenttypen (`order_pdf`, `spec_package`, `manual_upload`, `conflict_entry`)
	- neue Quellen (`order_export`, `spec_export`, `archive_version`, `offline_sync`, `conflict_local`)
- Migration angelegt:
	- `planner-api/prisma/migrations/20260305011000_sprint91_documents_versioning/migration.sql`
- Dokumentenlogik auf fortlaufende Versionierung umgestellt:
	- `registerProjectDocument` schreibt append-only Versionen statt bestehende Datensaetze zu ueberschreiben
	- Checksumme (`sha256`) und Versionsmetadaten werden beim Schreiben gesetzt
- API erweitert:
	- `POST /projects/:id/documents/upload`
	- `POST /projects/:id/documents/:docId/archive-version`
	- `GET /projects/:id/documents/version-check`
	- `GET /projects/:id/documents` um Filter fuer `source_kind`, Erstellungszeit und Konflikte erweitert
- Frontend erweitert (`DocumentsPage` + API):
	- Filter nach Typ, Quelle, Erstellungszeit und Konfliktanzeige
	- Versionshistorie je Dokumentkontext
	- Aktion zum Archivieren einer neuen Dokumentversion
	- Sync-/Versionscheck-Hinweis (lokaler Stand vs. Serverstand)
- Tests:
	- `planner-api/src/routes/documents.test.ts` auf 14 Tests erweitert (inkl. Versionierung/Konfliktlogik)
