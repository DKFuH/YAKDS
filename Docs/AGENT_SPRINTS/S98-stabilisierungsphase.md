# Sprint 98 - Stabilisierungsphase

**Branch:** `feature/sprint-98-stabilization`
**Gruppe:** A
**Status:** `done`
**Abhaengigkeiten:** S61-S81 als integrierter Produktstand

## Umsetzung (2026-03-04)

### UX

- Frontend-Build verifiziert (`planner-frontend`) und Kern-Regressionen fuer Hauptseitennahe API-Pfade gruen.
- Referenzbild-Regression in Room-Tests bereinigt (`Prisma.JsonNull` statt `null` in `rooms.test.ts`).
- Survey-Import- und Layout-/Viewer-/Level-Pfade regressionsgeprueft.

### Security

- Quote-Kernpfade tenant-gescoped gehaertet:
	- `POST /projects/:id/create-quote`
	- `GET /quotes/:id`
	- `POST /quotes/:id/export-pdf`
- Fremdzugriffstests ergaenzt (`quotes.test.ts`):
	- quote create fuer projektfremden Tenant -> `404`
	- quote read ausserhalb Tenant-Scope -> `404`

### Findings

- Build-Breaker behoben:
	- `imports.ts`: `pathString` strict typing
	- `egiParser.ts`: nullable-section assignment fix
	- `egiMapper.ts`: explizite Punkt-Typisierung in Wall-Mapping
- Test-Breaker behoben:
	- `rooms.test.ts` auf `Prisma.JsonNull` angepasst
	- `tenantSettings.test.ts` auf tenant-gescopte `quote.findFirst`-Pfade angepasst

### Logik

- EGI-Import-Logik gegen Kernpfade regressionsgeprueft (`surveyImport`, `rooms`, `exports`, `quotes`, `tenantSettings`).
- Keine neuen Feature-Silos hinzugefuegt; nur Stabilisierung/Absicherung bestehender Flows.

### Security-Review-Liste (gepruefte Routen)

- `POST /projects/:id/create-quote`
- `GET /quotes/:id`
- `POST /quotes/:id/export-pdf`
- `POST /quotes/:id/resequence-lines`
- `POST /quotes/:id/recalculate-financials`
- `POST /rooms/:id/measurement-import`
- `POST /rooms/:id/survey-import/egi`
- `POST /survey-import/formats/egi/parse`
- `GET /tenant/settings`, `PUT /tenant/settings`
- `GET /tenant/project-defaults`, `PUT /tenant/project-defaults`

### Verifikation (technisch)

- `npm run build --workspace planner-api` -> erfolgreich
- `npm run build --workspace planner-frontend` -> erfolgreich
- Fokussierte Kern-Suites -> gruen:
	- `projects`, `rooms`, `layoutSheets`, `viewerExports`, `tenantSettings`, `levels`, `exports`, `quotes`, `surveyImport`, `egiParser`, `egiMapper`
	- Ergebnis: `11` Testdateien, `107` Tests, alle gruen

### Offene Restpunkte

- Vite-Bundle-Warnung zu Chunk-Groesse bleibt bestehen (kein funktionaler Blocker in S98).
- Manuelle UI-Abnahme bleibt ueber `Docs/S98_GOLDENE_PFADE_CHECKLISTE.md` nachvollzogen.

---

## Ziel

Vor weiteren Ausbau-Sprints wird YAKDS wieder als durchgehend benutzbare
Anwendung stabilisiert. Fokus ist nicht neuer Funktionsumfang, sondern ein
sauber nutzbarer Produktkern mit reproduzierbaren End-to-End-Flows.

Leitidee: build less, integrate more.

---

## 1. Scope

Sprint 98 ist ein Querschnittssprint mit vier festen Kategorien:

- `UX`
- `Security`
- `Findings`
- `Logik`

Jede Aenderung muss einer dieser Kategorien zugeordnet werden. Nicht erlaubte
Arbeit in diesem Sprint:

- neue Plugin-Familien
- neue Exportformate
- neue Interop-Standards
- neue groessere Editor-Werkzeuge ohne direkten Stabilitaetsbezug

---

## 2. UX

Ziel: Die Kernpfade muessen wieder durchgaengig benutzbar sein.

Pflichtpruefungen:

- App startet ohne offensichtliche Laufzeitfehler
- Projektliste, Editor, Layout-Sheets, Export- und Plugin-Einstellungen sind oeffenbar benutzbar
- keine sichtbaren Mojibake-/Encoding-Fehler in Hauptseiten
- keine gebrochenen Navigationen oder Sackgassen in Haupt-Workflows
- Level-/Plugin-/Export-UIs zeigen keine toten Buttons oder inkonsistente States

Pflichtflows:

- Projekt anlegen und oeffnen
- Raum zeichnen oder laden
- Placement/Katalogobjekt platzieren
- Layout-Sheet oeffnen
- einen Export ausloesen
- Plugin aktivieren/deaktivieren
- Level wechseln, wenn vorhanden

---

## 3. Security

Ziel: Tenant- und Projektgrenzen muessen in allen geaenderten Kernpfaden
nachvollziehbar und testbar sein.

Pflichtpruefungen:

- neue und bestehende Routen auf Tenant-Scoping pruefen
- keine projektfremden oder tenantfremden IDs akzeptieren
- Plugin-Gating ist serverseitig verbindlich
- Settings-, Export-, Level- und Import-Pfade pruefen
- keine stillen Fallbacks auf unscopte Queries

Pflichtartefakte:

- gezielte Negativtests fuer Fremdzugriff
- Review-Liste der geprueften Routen

---

## 4. Findings

Ziel: Offene bekannte Fehler und Review-Befunde werden systematisch
abgearbeitet, statt nebenbei mitzuschwimmen.

Pflichtquellen:

- offene lokale TODOs/FIXMEs
- bekannte Review-Findings aus vorherigen Sprints
- sichtbare Build-/Test-/Runtime-Breaker
- Encoding-/Doku-/Routing-Regressions

Pflichtregeln:

- jeder behobene Finding-Block bekommt reproduzierbare Notiz
- kein Sammelcommit mit unerklaerten Nebenfixes
- neue Findings werden dokumentiert statt still uebergangen

---

## 5. Logik

Ziel: Die Kernmodelle muessen fachlich konsistent zusammenspielen.

Pflichtpruefungen:

- Room-/Level-/Placement-/Sheet-Logik bleibt konsistent
- Plugin-Enablement fuehrt nicht zu halben Datenmodellen
- Exporte brechen nicht bei optionalen oder fehlenden Plugin-Daten
- Backfills/Migrationen bleiben fuer Altprojekte funktionsfaehig
- zentrale Resolver und Services liefern nachvollziehbare Fehler statt stiller Inkonsistenz

Schwerpunkte:

- Datenmodellkonsistenz
- Migrationssicherheit
- Service-/Resolver-Logik
- End-to-End-Verkettung der Kernobjekte

---

## 6. Deliverables

- konsolidierte Fehlerliste nach `UX`, `Security`, `Findings`, `Logik`
- behobene Kern-Breaker im Produktpfad
- stabilisierte Hauptseiten und Hauptworkflows
- gezielte Regressionstests fuer die behobenen Problemklassen
- aktualisierte Statusdoku mit ehrlicher Aussage zum Produktstand

---

## 7. Verifikation

Mindestens:

- `npm run build --workspace planner-frontend`
- `npm run build --workspace planner-api` falls Build-Script vorhanden, sonst fokussierte Typ-/Testpruefung
- fokussierte Vitest-Suites fuer betroffene Kernrouten und Services
- manuelle Goldener-Pfad-Abnahme

Abnahmevorlage:

- `Docs/S98_GOLDENE_PFADE_CHECKLISTE.md`

Goldene Pfade:

- Projekt anlegen
- Raum bearbeiten
- Objekt platzieren
- Layout anzeigen
- Export ausloesen
- Plugin-Einstellung aendern
- optional Level wechseln

---

## 8. DoD

- YAKDS ist wieder als zusammenhaengende Anwendung benutzbar
- die definierten Goldenen Pfade laufen ohne kritische Blocker
- bekannte Kern-Findings aus diesem Sprint sind abgearbeitet oder explizit dokumentiert
- kein neuer Feature-Scope wurde unter dem Label "Stabilisierung" eingeschmuggelt
- README, ROADMAP und STATUS spiegeln den realen Produktstand
