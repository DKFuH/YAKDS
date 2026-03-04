# Sprint 97 - POS Aufmassservice-Import als Plugin

**Branch:** `feature/sprint-97-egi-survey-import`
**Gruppe:** B (startbar nach S79)
**Status:** `done`
**Abhaengigkeiten:** S47 (Mobile Aufmass), S57 (WallAttachments), S79 (Offline-PWA & Aufmass-Import)

## Umsetzung (2026-03-04)

- Backend-Service fuer EGI-Formatparser und Mapping umgesetzt in:
  - `planner-api/src/services/surveyImport/egiParser.ts`
  - `planner-api/src/services/surveyImport/egiMapper.ts`
- Plugin-Route umgesetzt und im `survey-import`-Plugin registriert:
  - `POST /survey-import/formats/egi/parse`
  - `POST /rooms/:id/survey-import/egi`
  - Dateien:
    - `planner-api/src/routes/surveyImport.ts`
    - `planner-api/src/plugins/surveyImport.ts`
- Frontend-Integration im Survey-Import-Plugin + SiteSurvey-Seite:
  - `.egi` Upload, Preview/Summary, Warnliste, Import in Zielraum
  - Dateien:
    - `planner-frontend/src/plugins/surveyImport/egi.ts`
    - `planner-frontend/src/pages/SiteSurveyPage.tsx`
- Tests und Fixtures:
  - `planner-api/src/services/surveyImport/egiParser.test.ts`
  - `planner-api/src/services/surveyImport/egiMapper.test.ts`
  - `planner-api/src/routes/surveyImport.test.ts`
  - Fixture-Dateien unter `planner-api/src/services/surveyImport/__fixtures__/`
- Validierung:
  - Backend: 3 Testdateien, 16 Tests gruen
  - Frontend: `npm run build --workspace planner-frontend` erfolgreich

---

## Ziel

Das Plugin `survey-import` soll um einen konkreten Import-Adapter fuer
strukturierte POS-Aufmassservice-Dateien erweitert werden. Der Adapter importiert
Wandgeometrie, Dachschraegen, Oeffnungen, Hindernisse und
Installationspunkte in das interne Raum-/Aufmassmodell von OKP.

Leitidee: Formatadapter statt harter Sonderlogik im Core.

---

## 1. Formatbild

Das Dateiformat ist textbasiert und INI-aehnlich aufgebaut, typischerweise
mit folgenden Sektionen:

- `GLOBAL`
- `Wall_*`
- `Window_*`
- `Door_*`
- `Roof_*`
- `Recess_*`
- `Radiator_*`
- `Hindrance_*`
- `CS_Installation_*`

Typische Felder:

- `RefPntX`, `RefPntY`, `RefPntZ`
- `Width`, `Height`, `Depth`
- `AngleZ`
- `WallRefNo`
- `Type`
- `Roomheight`

---

## 2. Architektur

Umsetzung als Erweiterung des Plugins `survey-import`.

Neue oder angepasste Dateien:

- `planner-api/src/plugins/surveyImport.ts`
- `planner-api/src/services/surveyImport/egiParser.ts`
- `planner-api/src/services/surveyImport/egiMapper.ts`
- `planner-api/src/routes/surveyImport.ts`
- `planner-api/src/routes/surveyImport.test.ts`
- `planner-frontend/src/plugins/surveyImport/*`

Keine neue Core-Route nur fuer dieses Format.

---

## 3. Mapping in OKP

### 3.1 Raum und Waende

- `GLOBAL.Roomheight` -> Raumhoehe / Survey-Metadaten
- `Wall_*` -> Wandsegmente oder Survey-Wall-Records
- `Depth` -> Wandstaerke
- `AngleZ` + Referenzpunkt -> Richtung / Segmentorientierung

### 3.2 Oeffnungen

- `Window_*` -> Fenster
- `Door_*` -> Tueren
- `Hinge` und `Opening` -> Oeffnungsrichtung / Anschlag, soweit intern abbildbar
- `WallRefNo` -> Zuordnung zur Wand

### 3.3 Dachschraegen

- `Roof_*` -> Dachschraege / CeilingConstraint / Hoehenbegrenzung
- V1 darf reduzierte Semantik importieren, solange die Schraegflaeche
  sichtbar einer Wand / Raumkante zugeordnet werden kann
- Wenn ein Datensatz nicht vollstaendig auf das interne Modell passt,
  wird er als importierte Dachschraege mit Warning uebernommen statt
  verworfen

### 3.4 Hindernisse und bauliche Sonderfaelle

- `Hindrance_*` -> Hindernis, Nische oder generischer Survey-Blocker
- `Recess_*` -> Nische / Aussparung
- `Radiator_*` -> Heizkoerper oder generisches Wandobjekt
- V1 darf unbekannte Hindernistypen als `custom` oder `obstacle` markieren

### 3.5 Installationen

- `CS_Installation_*` -> Installationsobjekte / Anschlusspunkte
- Beispiele: `water-cold`, `water-drain`, `electrical_outlet`
- Mapping auf vorhandene oder neue Survey-Installationsklassen

---

## 4. Backend

Endpoints:

- `POST /survey-import/formats/egi/parse`
- `POST /rooms/:id/survey-import/egi`
- optional `POST /site-surveys/:id/import/egi`

Antwortstruktur V1:

```json
{
  "format": "egi",
  "summary": {
    "walls": 6,
    "roofs": 2,
    "windows": 2,
    "doors": 1,
    "hindrances": 14,
    "installations": 19
  },
  "warnings": [],
  "preview": {
    "room_height_mm": 2472.3
  }
}
```

Anforderungen:

- robust gegen Reihenfolge der Sektionen
- toleriert unbekannte Felder
- liefert Warnungen statt harter Fehler, wenn Einzelobjekte unvollstaendig sind
- verweigert Import nur bei strukturell unbrauchbarer Datei

---

## 5. Frontend

Im `survey-import`-Plugin:

- Dateiupload fuer `.egi`
- Import-Preview
- Objektzaehlung
- Warnliste
- Zielauswahl: neuer Survey / bestehender Raum

V1:

- kein visueller Volleditor fuer Rohdaten
- keine manuelle Feldzuordnung
- keine Rueckexport-Funktion

---

## 6. Tests

Mindestens:

- Parser liest `GLOBAL`, `Wall`, `Window`, `Door`, `Hindrance`, `CS_Installation`
- Parser liest auch `Roof`, `Recess` und `Radiator`
- Winkelfelder und numerische Strings werden robust geparsed
- `WallRefNo` wird korrekt auf Zielwaende aufgeloest
- unbekannte `CS_Installation.Type` erzeugen Warnung statt Abbruch
- `Roof_*` wird als Dachschraege / Hoehenbegrenzung uebernommen
- Import-Endpoint liefert Summary + Warnings
- mehrere Beispiel-Dateien aus dem Sprint dienen als Fixtures

Ziel: mindestens 12 Tests.

---

## 7. DoD

- POS-Aufmassservice-Datei ist ueber Plugin importierbar
- Waende, Dachschraegen, Tueren, Fenster und Installationen erscheinen in der Import-Preview
- Hindernisse werden mindestens generisch uebernommen
- Nischen und Heizkoerper werden nicht still verworfen
- Warnungen sind fuer nicht perfekt mappbare Objekte sichtbar
- Tests gruen
- keine POS-Aufmassservice-spezifische Sonderlogik im Core ausser generischen Survey-Hooks

---

## 8. Nicht Teil von Sprint 97

- Vollstaendige Semantik aller Hindernis-Untertypen
- Rueckexport in EGI
- Auto-Heilung inkonsistenter Geometrie
- perfekte semantische Uebersetzung aller Dachschraegen-Sonderfaelle
- Hersteller- oder provider-spezifische Nachlogik jenseits des Formatmappings
