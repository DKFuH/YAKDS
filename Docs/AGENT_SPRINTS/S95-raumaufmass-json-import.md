# Sprint 95 - Raumaufmass-Import & robuste JSON-Interop

**Branch:** `feature/sprint-95-raumaufmass-json-import`
**Gruppe:** A (startbar nach S47, S58 und S79)
**Status:** `planned`
**Abhaengigkeiten:** S47, S58, S79

---

## Ziel

Raumaufmass und strukturierte JSON-Aufmasse robust importieren:
Validierung, Mapping, Fehlerrueckmeldung und nachvollziehbare Importdiagnostik
sollen den Survey-Import alltagstauglich machen.

---

## 1. Backend

Einzufuehren:

- JSON-Schema fuer Survey-Importe
- Importdiagnostik mit Warnungen und Fehlerlisten
- Mapping auf Raeume, Waende, Oeffnungen und Referenzdaten

Neue Endpunkte:

- `POST /projects/:id/import/raumaufmass`
- `POST /projects/:id/validate/raumaufmass`
- `GET /projects/:id/raumaufmass-jobs`

---

## 2. Frontend

- Upload fuer Raumaufmass-JSON
- Vorschau/Review der importierten Raeume
- klare Importwarnungen bei unvollstaendigen oder ungueltigen Feldern

---

## 3. DoD

- valide Raumaufmass-JSONs erzeugen Raeume nachvollziehbar
- invalide Daten geben strukturierte Fehler zurueck
- Importdiagnostik ist im UI sichtbar
- mindestens 12 Tests fuer Validierung, Mapping und Warnungen
