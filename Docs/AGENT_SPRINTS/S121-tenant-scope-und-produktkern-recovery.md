# Sprint 121 - Tenant-Scope und Produktkern-Recovery

**Branch:** `feature/sprint-121-tenant-scope-recovery`
**Gruppe:** A
**Status:** `planned`
**Abhaengigkeiten:** S98, S109, S110, S116

## Ziel

Der Produktkern wird wieder auf echten Backend-Pfaden lauffaehig gemacht.

Ausloeser ist die Review vom `2026-03-11`:

- Tenant-gebundene Routen liefern zur Laufzeit `403 Missing tenant scope`
- Projektlisten und Projekterstellung laufen gleichzeitig teilweise unscoped
- das Frontend kaschiert Backend-Fehler ueber Demo-Fallbacks
- Kernpfade wirken im Browser funktionsfaehig, sind es gegen ein echtes Backend aber nur teilweise

Kernziel:

- Tenant-Scope wieder global und konsistent durchsetzen
- unscoped Projektzugriffe schliessen
- Demo-Fallback nur noch explizit und kontrolliert erlauben
- Browser-Kernpfad `Projekt anlegen -> Projekt oeffnen -> Editor laden` gegen echtes Backend stabilisieren

## Review-Befunde, die diesen Sprint ausloesen

### Laufzeit

- `GET /api/v1/tenant/settings` -> `403 Missing tenant scope`
- `GET /api/v1/tenant/plugins` -> `403 Missing tenant scope`
- `GET /api/v1/projects/:id/camera-presets` -> `403 Missing tenant scope`
- `GET /api/v1/tenant/layout-styles` -> `403 Missing tenant scope`
- `GET /api/v1/projects/:id/acoustic-grids` -> `403 Missing tenant scope`

### Code-Indikatoren

- `planner-api/src/index.ts` registriert `tenantMiddleware` nur als Plugin vor den Routen
- `planner-api/src/tenantMiddleware.ts` setzt Tenant-Kontext ueber `decorateRequest` + `preHandler` innerhalb des Plugin-Scopes
- `planner-api/src/routes/projects.ts` verwendet fuer mehrere Routen optionales Tenant-Scoping und erlaubt damit leere Scopes
- `GET /projects/:id` und weitere Mutationsrouten pruefen die Tenant-Zugehoerigkeit nicht konsistent
- `planner-frontend/src/api/client.ts` und `planner-frontend/src/api/projects.ts` schalten bei Backend-Fehlern still auf Demo-Daten um

## Scope

In Scope:

- Tenant-Middleware so verdrahten, dass `request.tenantId` fuer alle relevanten Routen konsistent gesetzt ist
- Tenant-/Branch-Context gegen bestehende Tests und Laufzeit pruefen
- Projektkernrouten auf verpflichtendes Scoping oder explizit dokumentierte Ausnahmen umstellen
- `GET /projects/:id`, `PUT /projects/:id`, `PATCH /projects/:id/status`, `PATCH /projects/:id/assign`, `DELETE /projects/:id` tenant-sicher machen
- Projekterstellung ohne `tenant_id = null` absichern
- Demo-Fallback fuer Projektlisten, Projektdetails und Projekterstellung hinter klaren Runtime-Flag oder Dev-Only-Schutz stellen
- Browserpfad gegen echtes Backend verifizieren

Nicht in Scope:

- neue CAD-/Interop-Formate
- Ribbon-Neudesign
- groesserer Editor-Funktionsausbau

## Arbeitspakete

### 1. Tenant-Scope reparieren

- globale Hook-/Plugin-Verdrahtung korrigieren
- bestehende Tests fuer tenant-gebundene Routen auf echte Header-/Runtime-Pfade erweitern
- Negativtests fuer fehlenden oder falschen Tenant einfuehren

### 2. Projektkern haerten

- alle Projekt-Lese- und Schreibpfade tenant-sicher machen
- keine neuen oder geaenderten Projekte mehr mit `tenant_id = null`
- Board-, Gantt- und Detailrouten auf konsistente Scope-Regeln bringen

### 3. Demo-Fallback entkoppeln

- stilles Umschalten bei `prisma`, `failed to fetch`, `internal server error` entfernen oder nur explizit per Dev-Flag erlauben
- UI muss reale Backend-Fehler sichtbar machen statt Demo-Daten als Erfolg zu verkaufen

### 4. Browser-Validierung

- Projekt anlegen gegen echtes Backend
- Projekt oeffnen
- Editor laden ohne verdeckte Demo-Pfade
- Plugin-/Tenant-Seiten muessen 200 oder fachlich korrekte Leerzustaende liefern, nicht `403 Missing tenant scope`

## Tests

- API:
  - neue Integrations-/Route-Tests fuer globales Tenant-Scoping
  - Negativtests fuer unscoped Projektzugriffe
- Frontend:
  - Tests fuer expliziten Demo-Modus statt stiller Error-Kaschierung
- Browser:
  - manuelle und Playwright-Pruefung fuer `Projekt anlegen -> Editor`

## DoD

- `request.tenantId` ist fuer tenant-gebundene Routen zur Laufzeit konsistent vorhanden
- `tenant/settings`, `tenant/plugins`, `camera-presets`, `layout-styles`, `acoustic-grids` funktionieren wieder mit gueltigem Tenant
- Projektlisten und Projekterstellung erzeugen keine Datensaetze mehr mit `tenant_id = null`
- `GET /projects/:id` und relevante Mutationen sind tenant-sicher
- das Frontend nutzt Demo-Fallback nicht mehr als stillen Ersatz fuer kaputte Backend-Pfade
- Browser-Kernpfad laeuft gegen echtes Backend reproduzierbar

## Verifikation

- `npm test --workspace planner-api`
- gezielte Inject- oder HTTP-Checks fuer Tenant-Routen mit Header `x-tenant-id`
- `npm run test:e2e --workspace planner-frontend` mindestens fuer die Kernpfade
- manueller Browser-Check auf lokalem Frontend ohne Demo-Zwang
