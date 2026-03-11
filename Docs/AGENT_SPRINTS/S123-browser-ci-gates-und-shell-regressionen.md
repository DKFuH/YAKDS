# Sprint 123 - Browser-CI-Gates und Shell-Regressionen

**Branch:** `feature/sprint-123-browser-ci-gates`
**Gruppe:** C
**Status:** `planned`
**Abhaengigkeiten:** S121, S122, S109, S110

## Ziel

Die Browser- und CI-Gates werden wieder zu echten Freigabekriterien gemacht.

Ausloeser aus der Review vom `2026-03-11`:

- `npm run test:e2e --workspace planner-frontend` ist nicht gruen
- mehrere `S109`-Shell-Specs erwarten Test-IDs oder Shell-Verhalten, die im aktuellen UI nicht mehr existieren
- die Doku behauptet gruene Gates, der aktuelle Stand widerspricht
- Demo-Fallbacks koennen reale Backend-Ausfaelle verdecken und Browser-Gates entwerten

Kernziel:

- Playwright wieder auf reale Produktpfade und aktuelle Shell ausrichten
- CI-Gates so definieren, dass Demo-Fallbacks keine falsche Gruenmeldung erzeugen
- S109-/S110-DoD wieder mit dem echten Ist-Zustand synchronisieren

## Scope

In Scope:

- rote `S109`-Shell-Specs analysieren und entweder reparieren oder sauber auf aktuelle Shell-Vertraege migrieren
- Test-IDs und Harness nur dort erhalten, wo sie noch Produktwert haben
- echte Browser-Goldpfade fuer Start, Projekte, Editor, Plugins, Exportpfad definieren
- Demo-Modus in E2E explizit kennzeichnen und von Backend-E2E trennen
- CI-Gates fuer Build, Unit, API, Browser und Smoke verhaerten

Nicht in Scope:

- grosse fachliche Feature-Entwicklung
- neue UI-Funktionsbereiche ausserhalb der Regressionen

## Arbeitspakete

### 1. S109-/S110-Regressionen aufloesen

- bestehende Specs gegen aktuelle Shell pruefen
- fehlende Test-IDs und obsolete Annahmen identifizieren
- entweder:
  - Shell-Vertraege wiederherstellen
  - oder Specs auf die aktuelle, beabsichtigte Shell migrieren

### 2. Reale Goldpfad-E2Es

- `Start -> Projekte -> Projekt anlegen -> Editor`
- `Editor -> Plugin-/Tenant-Kontext`
- `Export/Plugins -> keine Sackgasse bei deaktivierten oder fehlenden Plugins`
- mindestens ein Backend-gebundener Flow ohne Demo-Fallback

### 3. Demo-Fallback als Testobjekt statt Ausweichpfad

- separate Demo-Smokes
- separate echte Backend-Smokes
- CI darf nur auf Backend-Smokes gruene Produktfreigabe geben

### 4. Doku und Gates synchronisieren

- `S109`, `S110`, `README`, `STATUS` und gegebenenfalls weitere Gate-Doku auf den realen Stand bringen
- Definition, welche Specs blocking sind und welche nur Beobachtungscharakter haben

## Tests

- `npm run test:e2e --workspace planner-frontend`
- selektive Playwright-Runs fuer Shell, i18n, Kernpfad und Plugins
- Build + Unit-Test-Gates bleiben Pflicht

## DoD

- Playwright fuer `planner-frontend` ist wieder gruen oder bewusst in blocking/non-blocking Gruppen dokumentiert
- rote `S109`-/`S110`-Regressionen sind entweder behoben oder mit neuer, konsistenter Testbasis ersetzt
- CI unterscheidet klar zwischen Demo- und Backend-E2E
- Browser-Gates pruefen reale Produktpfade statt nur Harness- oder Fallback-Zustaende
- Doku behauptet keine gruene Gate-Lage mehr, die der aktuelle Stand nicht erfuellt

## Verifikation

- voller Playwright-Lauf
- Nachweis eines echten Backend-Smokes ohne Demo-Umschaltung
- manuelle Stichprobe im Browser fuer Shell, i18n und Export-/Plugin-Pfade
