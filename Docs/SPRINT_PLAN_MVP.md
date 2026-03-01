# SPRINT_PLAN_MVP.md

## Projekt

**Webbasierter Küchenplaner mit Polygonräumen, Dachschrägen, kaufmännischer Kalkulation, DWG-/SketchUp-Interop und externem Render-Worker**

## Zielbild

Das MVP soll:

* **nicht-rechteckige Räume** als Polygon modellieren
* **Türen/Fenster** an beliebigen Wänden abbilden
* **Dachschrägen** als Height Constraints prüfen
* **Stückliste, Preise, Rabatte, Angebote** berechnen
* **DWG** als Grundrissbasis importieren und exportieren
* **SketchUp (`.skp`)** als Referenzmodell importieren
* **Renderjobs** an einen externen Worker senden
* später **Renderfarm-fähig** erweitert werden

## Sprint-Rahmen

* **Sprintlänge:** 1 Woche
* **Gesamt:** 19 Sprints
* **Technisches MVP:** ab Sprint 13–15
* **Business-/Interop-MVP:** ab Sprint 17–19

---

## Sprint 0 – Architektur, Domänenmodell, Leitplanken

### Ziel

Technische und fachliche Basis festlegen.

### Deliverables

* `ARCHITECTURE.md`
* `ROOM_MODEL.md`
* `PRICING_MODEL.md`
* `QUOTE_MODEL.md`
* `RENDER_PROTOCOL.md`
* `CAD_INTEROP.md`
* `SKP_INTEROP.md`
* `TASK_TEMPLATE.md`

### Inhalte

* Polygonraum als Pflichtmodell
* Dachschrägen als Height Constraints
* Platzierung immer relativ zu `wall_id + offset`
* Trennung von:

  * Geometrie
  * Katalog
  * Preislogik
  * Angebot
  * Rendering
  * CAD-/SKP-Interop

### Definition of Done

* Repo-Struktur definiert
* Kernobjekte dokumentiert
* JSON-/API-Grundverträge festgelegt

---

## Sprint 1 – Backend-Grundgerüst

### Ziel

Persistente Projekt- und Stammdatenbasis schaffen.

### Features

* Projekt CRUD
* Benutzer light
* Postgres-Schema
* erste API-Struktur

### Tabellen

* `users`
* `projects`
* `project_versions`
* `rooms`
* `price_lists`
* `tax_groups`
* `quote_settings`

### Definition of Done

* Projekt anlegen, laden, speichern, löschen funktioniert
* Backend lokal lauffähig

---

## Sprint 2 – Frontend-Grundgerüst

### Ziel

Arbeitsfähige Web-App-Hülle bereitstellen.

### Features

* Projektliste
* Editor-Layout
* Canvas-Bereich
* linke Sidebar
* rechte Sidebar
* Status-/Summenbereich unten

### Definition of Done

* Projekt kann im Browser geöffnet werden
* UI-Grundstruktur steht

---

## Sprint 3 – Polygon-Raumeditor v1

### Ziel

Nicht-rechteckige Räume erfassen.

### Features

* Punkte setzen
* Polygon schließen
* Wände automatisch ableiten
* Validierung:

  * keine Selbstüberschneidung
  * Mindestkantenlänge
  * geschlossener Ring

### Optional

* Snap auf 0/45/90°
* Raster

### Definition of Done

* Räume mit 4–12 Ecken speicherbar und darstellbar

---

## Sprint 3.5 – CAD-/SKP-Import Grundlagen

### Ziel

DWG-/DXF- und SKP-Dateien als Referenzgrundlage nutzbar machen.

### Features

* Dateiupload für:

  * `.dwg`
  * `.dxf`
  * `.skp`
* Import-Pipeline definieren
* neutrales internes Austauschformat festlegen
* Import als Referenzgeometrie speichern

### MVP-Scope

* **DWG/DXF 2D:** Linien, Polylinien, Layer
* **SKP:** Geometrie/Komponenten als Referenzmodell

### Nicht-Ziel

* kein verlustfreier Roundtrip
* keine vollständige Bearbeitung beliebiger CAD-Objekte

### Definition of Done

* Datei kann hochgeladen werden
* Geometrie wird gelesen
* Referenz im Projekt gespeichert

---

## Sprint 4 – Präzisionsbearbeitung für Raumgeometrie

### Ziel

Räume exakt bemaßen und korrigieren.

### Features

* Vertex verschieben
* Kantenlänge numerisch ändern
* Wände selektieren
* stabile Wand-IDs behalten
* Raumkontur aus importierter CAD-Geometrie ableiten

### Zusatz

* Polylinien als Kandidaten für `RoomBoundary`
* Layer-Filter für Grundrissdaten

### Definition of Done

* grob gezeichneter oder importierter Raum kann exakt nach Maß korrigiert werden

---

## Sprint 5 – Öffnungen an Wänden

### Ziel

Türen und Fenster fachlich korrekt modellieren.

### Features

* Öffnung an `wall_id`
* Offset auf der Wand
* Breite
* Höhe
* Brüstungshöhe bei Fenstern
* Übernahme von Öffnungskandidaten aus importierter Geometrie

### Regeln

* Öffnungen dürfen Wandgrenzen nicht verletzen
* Öffnungen dürfen sich nicht überschneiden

### Definition of Done

* Türen/Fenster korrekt an Polygonwänden platzierbar
* erkannte Öffnungen aus CAD können übernommen werden

---

## Sprint 6 – Dachschrägen / Height Constraints

### Ziel

Vertikale Einschränkungen modellieren.

### Features

* Constraint an Wand definieren
* Parameter:

  * `wall_id`
  * `kniestock_height_mm`
  * `slope_angle_deg`
  * `depth_into_room_mm`

### Fachlich

* System kann verfügbare Höhe an Punkt `(x,y)` berechnen

### Definition of Done

* 1+ Dachschrägen pro Raum definierbar
* Höhe im Raum ist auswertbar

---

## Sprint 7 – Katalog MVP mit kaufmännischen Stammdaten

### Ziel

Planbare und preisfähige Objekte bereitstellen.

### Features

* Unterschrank
* Hängeschrank
* Hochschrank
* Blende
* Arbeitsplattenmodul
* Gerätevolumen

### Kaufmännische Felder

* `list_price_net`
* `dealer_price_net`
* `default_markup_pct`
* `tax_group_id`
* `pricing_group_id`

### Definition of Done

* Katalogobjekte auswählbar
* Objekte tragen Preisbasis

---

## Sprint 7.5 – SKP-/Komponenten-Mapping

### Ziel

SketchUp-Dateien sinnvoll als Referenzobjekte einbinden.

### Features

* `.skp` Import als Referenzmodell
* Komponenten erkennen
* Komponentenname/Metadaten auswerten, sofern verfügbar
* Zuordnung zu:

  * Referenzobjekt
  * Möbelplatzhalter
  * Geräteplatzhalter

### Nicht-Ziel

* keine vollständige parametrisierte Rückübersetzung

### Definition of Done

* SKP-Datei kann geladen und als Referenz im Projekt angezeigt werden

---

## Sprint 8 – Wandbasierte Platzierungsengine v1

### Ziel

Objekte entlang beliebiger Wände platzieren.

### Features

* Platzierung via `wall_id + offset`
* Innenrichtung aus Polygon ableiten
* entlang Wand verschieben
* löschen / neu setzen

### Definition of Done

* einfache Küchenzeilen an geraden und schrägen Wänden planbar

---

## Sprint 9 – Geometrieprüfung / Kollisionen v1

### Ziel

Geometrisch unsinnige Planungen erkennen.

### Features

* Objekt vs. Objekt
* Objekt außerhalb Raum
* Objekt schneidet Öffnung
* Mindestabstände
* ungültiger Wandbereich

### Zusatz

* erste kostenrelevante Hinweise:

  * Sonderblende nötig
  * Sonderzuschnitt nötig
  * erhöhter Montageaufwand

### Definition of Done

* Prüfpanel zeigt Fehler, Warnungen und Hinweise

---

## Sprint 10 – Höhenprüfung / Dachschrägen-Regeln

### Ziel

Hohe Möbel unter Dachschrägen fachlich korrekt bewerten.

### Features

* Hochschrank zu hoch
* Hängeschrank kollidiert mit Schräge
* Geräte-/Objekthöhe überschreitet verfügbare Höhe

### Preiswirkung

* optionale Flags:

  * `requires_customization`
  * `height_variant`
  * `labor_surcharge`

### Definition of Done

* Dachschrägen beeinflussen Planung und Regelprüfung

---

## Sprint 11 – Stücklisten-Engine v1

### Ziel

Aus Planung eine verwertbare BOM ableiten.

### Features

* Möbelpositionen
* Geräte
* Zubehör
* Zuschläge
* Montagepositionen
* Frachtpositionen

### API

* `POST /projects/:id/calculate-bom`

### Definition of Done

* Projekt liefert strukturierte Stückliste als JSON

---

## Sprint 11.5 – CAD-/SketchUp-Export v1

### Ziel

Planungen als Austauschformate ausgeben.

### Features

* Export:

  * **DWG 2D**
  * **DXF 2D** optional
* Export von:

  * Raumkontur
  * Wandlinien
  * Öffnungen
  * Möbelkonturen
* Layer-/Tag-Struktur definieren
* Einheiten/Skalierung sauber halten

### SketchUp

* SKP-Exportpfad vorbereiten
* noch kein vollwertiger Roundtrip im MVP

### Definition of Done

* Grundriss und Möbelkonturen als DWG/DXF ausgebbar

---

## Sprint 12 – Preisengine v1

### Ziel

Saubere kaufmännische Berechnung pro Projekt.

### Preislogik

1. Listenpreis
2. Varianten-/Mehrpreise
3. Objektzuschläge
4. Positionsrabatt
5. Warengruppenrabatt
6. Globalrabatt
7. Zusatzkosten
8. MwSt
9. Rundung

### Ausgabe

* netto
* MwSt
* brutto
* Deckungsbeitrag light
* Aufschlag %

### API

* `POST /projects/:id/calculate-pricing`
* `GET /projects/:id/price-summary`

### Definition of Done

* vollständige Summenberechnung verfügbar

---

## Sprint 13 – Angebotsmanagement v1

### Ziel

Aus Projekt und Preisberechnung ein Angebot erzeugen.

### Features

* Angebotsnummer
* Gültig-bis
* Freitext
* Angebotsversionen
* PDF light

### Tabellen

* `quotes`
* `quote_items`

### API

* `POST /projects/:id/create-quote`
* `GET /quotes/:id`
* `POST /quotes/:id/export-pdf`

### Definition of Done

* aus einem Projekt wird ein druckbares Angebot

---

## Sprint 14 – Browser-3D-Preview

### Ziel

Schnelle visuelle Kontrolle im Browser.

### Features

* Floor Polygon triangulieren
* Wände extrudieren
* Proxy-Meshes für Möbel
* einfache Materialien
* Orbit / Zoom / Pan
* Referenzmodelle ein-/ausblendbar

### Zusatz

* Preis-/Objektinfo beim Selektieren anzeigen
* importierte DWG-/SKP-Geometrie als Overlay nutzbar

### Definition of Done

* Polygonraum + Möbel in einfacher 3D-Vorschau sichtbar
* Referenzgeometrie kann eingeblendet werden

---

## Sprint 15 – Render-Job-System + externer Render-Worker MVP

### Ziel

Rendering von Planung entkoppeln.

### Features

* Renderjob anlegen
* Queue-Status
* Scene Payload erzeugen
* Worker registriert sich
* Worker holt Job per HTTPS
* Worker rendert Bild
* Worker liefert Ergebnis zurück

### Status

* `queued`
* `assigned`
* `running`
* `done`
* `failed`

### Tabellen

* `render_jobs`
* `render_job_results`

### Definition of Done

* End-to-End: Planung → Renderjob → Bild zurück

---

## Sprint 16 – Business-/Integrations-Sprint

### Ziel

Kaufmännische Nutzung ausbauen.

### Features

* Kundenpreislisten
* Kundengruppenrabatte
* einfache CRM-Felder:

  * Leadstatus
  * Angebotswert
  * Abschlusswahrscheinlichkeit
* Export:

  * JSON
  * CSV
  * Webhook

### Tabellen

* `customer_price_lists`
* `customer_discounts`
* `project_line_items`

### Definition of Done

* Projekt kann kunden- und vertriebsbezogen bewertet/exportiert werden

---

## Sprint 17 – Blockverrechnung / Auto-Blockverrechnung

### Ziel

Herstellerabhängige Sonderrabatt-Logik abbilden.

### Features

* Blockprogramme definieren
* Artikel Blockgruppen zuordnen
* mehrere Blockmodelle bewerten
* Berechnung auf:

  * Einkaufspreisbasis
  * Verkaufspreisbasis
  * optional Punktbasis
* automatische Auswahl des besten Blocks

### Tabellen

* `block_programs`
* `block_definitions`
* `block_groups`
* `block_conditions`
* `project_block_evaluations`

### Ausgabe

* bester Block
* Preisvorteil gegenüber Standardkalkulation
* übernommener Blockrabatt ins Angebot

### Definition of Done

* ein Projekt kann gegen mehrere Blockmodelle gerechnet werden
* bestes Ergebnis wird angezeigt und übernommen

---

## Sprint 18 – Interop-API / Import-Job-System

### Ziel

CAD-/SKP-Importe robust und skalierbar machen.

### Features

* API-Endpunkte:

  * `POST /imports/cad`
  * `POST /imports/skp`
  * `GET /imports/:id`
* asynchrone Importjobs für größere Dateien
* Prüfprotokoll:

  * importiert
  * ignoriert
  * manuelle Nacharbeit nötig
* Layer-/Komponenten-Mapping speichern

### Definition of Done

* große DWG-/SKP-Dateien können kontrolliert importiert werden
* Importstatus ist nachvollziehbar

---

## Sprint 19 – Interop-Härtung / Roundtrip-Basis

### Ziel

DWG-/SKP-Austausch praxistauglich stabilisieren.

### Features

* Import-/Export-Regressionstests
* Einheiten-/Skalierungsprüfung
* Layer-Konventionen dokumentieren
* Basis-Roundtrip für DWG:

  * Import
  * Bearbeitung
  * Export
* SKP weiter als Referenzpfad stabilisieren

### Definition of Done

* DWG-Workflow ist intern reproduzierbar
* SKP-Referenzworkflow ist für Bestandsmodelle nutzbar

---

# Nicht im MVP

## Bewusst ausgeschlossen

* komplexe Eckschrank-Automatik
* freie Rundungen
* vollständige Dachgeometrie als CAD
* CNC-/DXF-Produktionsniveau
* Echtzeit-Multiuser
* vollwertiges ERP
* Debitoren/Mahnwesen
* komplexe Provisionsmodelle
* verlustfreier SKP-Roundtrip
* vollständige Bearbeitung beliebiger DWG-Spezialobjekte

---

# Technische Kernobjekte

## Geometrie

* `Project`
* `Room`
* `RoomBoundary`
* `Vertex`
* `WallSegment`
* `Opening`
* `CeilingConstraint`

## Planung

* `CabinetInstance`
* `ApplianceInstance`
* `PlacementResult`
* `RuleViolation`

## Kaufmännisch

* `BOMLine`
* `PriceComponent`
* `PriceSummary`
* `Quote`
* `QuoteItem`
* `BlockEvaluation`

## Rendering

* `RenderJob`
* `RenderJobResult`
* `RenderNode`

## Interop

* `ImportJob`
* `ImportAsset`
* `CadLayer`
* `ReferenceGeometry`
* `SkpReferenceModel`

---

# Empfohlene Repo-Struktur

```text
kitchen-planner/
  docs/
    ARCHITECTURE.md
    ROOM_MODEL.md
    PRICING_MODEL.md
    QUOTE_MODEL.md
    RENDER_PROTOCOL.md
    CAD_INTEROP.md
    SKP_INTEROP.md
    TASK_TEMPLATE.md
    SPRINT_PLAN_MVP.md

  planner-frontend/
  planner-api/
  render-worker/
  shared-schemas/

  interop-cad/
    dwg-import/
    dwg-export/
    dxf-import/
    dxf-export/

  interop-sketchup/
    skp-import/
    skp-export/

  scripts/
  tests/
```

---

# Arbeitsweise mit Claude Code / Codex

## Claude Code

Nutzen für:

* Architektur
* API-Struktur
* größere Refactorings
* End-to-End-Features
* Datenfluss zwischen Frontend, API, Worker, Interop

## Codex

Nutzen für:

* Polygonalgorithmen
* Kollisionen
* Validatoren
* Preisregeln
* BOM-Berechnung
* Import-/Export-Mapping
* Tests
* kleine isolierte Module

---

# Meilensteine

## Nach Sprint 6

* echte Räume
* Öffnungen
* Dachschrägen

## Nach Sprint 8

* erste wandbasierte Küchenplanung

## Nach Sprint 11.5

* erste DWG-/DXF-Austauschfähigkeit

## Nach Sprint 13

* internes Angebots-MVP

## Nach Sprint 15

* Renderworkflow produktiv nutzbar

## Nach Sprint 19

* Interop + Business + Planung in belastbarer MVP-Form

---

# Priorität bei knapper Zeit

## Unbedingt zuerst

1. Sprint 0–10
2. Sprint 11–13
3. Sprint 15
4. Sprint 3.5
5. Sprint 11.5

## Danach

6. Sprint 14
7. Sprint 16
8. Sprint 17
9. Sprint 18
10. Sprint 19
11. Sprint 7.5

## Klar nachrangig

* echter SKP-Export
* komplexer SKP-Roundtrip
* Blockverrechnung vor stabilem BOM-/Pricing-Kern

---

# Empfehlung für MVP-Schnitt

## Minimal sinnvoll

* Sprint 0–10
* Sprint 11
* Sprint 12
* Sprint 13
* Sprint 15
* Sprint 3.5 (nur DWG/DXF Import)
* Sprint 11.5 (nur DWG/DXF Export)

## Danach ausbauen

* SKP Referenzimport
* Browser-3D-Preview mit Overlays
* CRM-/Business-Funktionen
* Blockverrechnung
* Interop-Härtung
