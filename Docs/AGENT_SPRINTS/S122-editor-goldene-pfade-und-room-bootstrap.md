# Sprint 122 - Editor-Goldene-Pfade und Room-Bootstrap

**Branch:** `feature/sprint-122-editor-goldene-pfade`
**Gruppe:** C
**Status:** `planned`
**Abhaengigkeiten:** S121, EDITOR_1_1_ARCHITECTURE

## Ziel

Der Editor-Goldpfad wird von "Shell rendert" auf "produktiver Einstieg funktioniert" angehoben.

Ausloeser aus der Review vom `2026-03-11`:

- neue Projekte landen im Editor mit `0 Raeumen`
- die UI zeigt `Kein Raum ausgewaehlt`
- die 3D-Preview ist fuer den frischen Projektpfad nicht nutzbar
- damit ist `Editor 1.1` nicht im Sinne der eigenen Definition of Done erreicht

Kernziel:

- ein neu angelegtes Projekt ist ohne Sackgasse im Editor bearbeitbar
- der Nutzer kann unmittelbar einen ersten Raum sehen oder anlegen
- `2D`, `3D` und `Wandansicht` werden fuer den Kernpfad belastbar verifiziert

## Bezug auf bestehende Doku

`Docs/EDITOR_1_1_ARCHITECTURE.md` fordert fuer `Editor 1.1`:

- `2D`, `3D` und `Wandansicht` gleichzeitig produktiv nutzbar
- gemeinsame Auswahl ueber alle Viewports
- Reduktion des alten Monolithen
- Integration neuer Funktionen ueber Commands und Plugin-Host

Der aktuelle Laufzeitstand erreicht diese DoD fuer den frischen Projektpfad nicht.

## Scope

In Scope:

- Bootstrap fuer neue Projekte:
  - default room
  - oder expliziter Room-Creation-Flow ohne Dead End
- Editor-Initialzustand fuer leere Projekte fachlich sauber gestalten
- klare leere Zustaende mit echter Recovery-Aktion
- Basispfade fuer Raumanlage, Auswahl und Viewport-Synchronitaet pruefen
- 3D-/Wandansicht fuer den ersten bearbeitbaren Raum regressionspruefen

Nicht in Scope:

- grosser Geometrie-Neubau
- neue Fachfeatures ausserhalb des Kern-Editierpfads
- Interop-/Export-Ausbau

## Arbeitspakete

### 1. Einstieg fuer neue Projekte

- entscheiden und umsetzen:
  - Projekt erzeugt initialen Raum automatisch
  - oder Projekt startet in einen gefuehrten Room-Bootstrap
- Editor darf nach Neuanlage nicht in `0 Raeume` ohne Aktion enden

### 2. Leere Zustaende und Recovery

- `Kein Raum ausgewaehlt` nur dort zeigen, wo bereits ein legitimer Bearbeitungskontext existiert
- CTA fuer `Raum anlegen`, `Grundriss starten` oder vergleichbaren fachlichen Einstieg anbieten
- 3D-Hinweise nicht nur deskriptiv, sondern handlungsleitend machen

### 3. Viewport-Validierung

- erster Raum sichtbar in `2D`
- derselbe Raum in `3D` verfuegbar
- Wandansicht fuer waehlbare Wand erreichbar
- Auswahl und Fokus sind ueber die Kern-Viewports synchron

### 4. Goldene Pfade dokumentieren

- Doku fuer `Projekt anlegen -> erster Raum -> bearbeiten -> speichern -> reload`
- Abgleich mit `S98_GOLDENE_PFADE_CHECKLISTE.md`

## Tests

- Frontend-Komponenten-/Hook-Tests fuer leere Editorzustande und Room-Bootstrap
- API-/Integrationstests fuer initiale Projektdaten, falls Default-Raum serverseitig angelegt wird
- Playwright fuer den frischen Projektpfad bis in einen bearbeitbaren Raum
- manueller Browser-Check fuer 2D/3D/Wandansicht

## DoD

- ein neu angelegtes Projekt endet nicht mehr in einer Editor-Sackgasse
- Nutzer kann ohne Dev-Wissen den ersten Raum anlegen oder sieht sofort einen bearbeitbaren Raum
- `2D`, `3D` und `Wandansicht` sind fuer den Kernpfad produktiv pruefbar
- leere Zustaende haben echte Recovery-Aktionen
- Reload behaelt den angelegten Raum und den bearbeitbaren Zustand konsistent
- Goldpfad ist gegen `Editor 1.1` DoD und `S98`-Checklist explizit verifiziert

## Verifikation

- Browser-Flow: `Projekt anlegen -> Editor -> erster Raum -> Reload`
- `npm test --workspace planner-frontend`
- passende Playwright-E2Es fuer Room-Bootstrap und Viewport-Grundpfad
