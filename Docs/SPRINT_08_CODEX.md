# SPRINT_08_CODEX.md

## Umfang

Umsetzung der Codex-Aufgabe aus Sprint 8:

- TASK-8-C01 - Wandbasierte Platzierungsalgorithmen
- API-Integration fuer Room-gebundene Placements

## Umgesetzte Dateien

- `shared-schemas/src/geometry/wallPlacement.ts`
- `shared-schemas/src/geometry/wallPlacement.test.ts`
- `shared-schemas/src/validation/placementValidator.ts`
- `shared-schemas/src/validation/placementValidator.test.ts`
- `planner-api/src/routes/placements.ts`
- `planner-api/src/routes/placements.test.ts`

## Ergebnis

Implementierte Funktionen:

- `getWallDirection(wall)`
  - liefert normierten Richtungsvektor von `start` nach `end`

- `getWallInnerNormal(wall, polygon)`
  - bestimmt die nach innen zeigende Normale ueber Point-in-Polygon

- `getPlacementWorldPos(wall, offsetMm)`
  - liefert die Weltkoordinate auf der Wand fuer einen Offset

- `snapToWall(dragWorldPos, wall)`
  - projiziert einen Punkt auf die Wandachse und clampt auf die Wandlaenge

- `canPlaceOnWall(wall, offsetMm, widthMm, existing)`
  - prueft Wandgrenzen und Intervall-Ueberlappungen

- `validatePlacement(wall, placement, existingPlacements, openings)`
  - prueft Offset und Objektabmessungen
  - prueft Wandgrenzen
  - prueft Ueberlappungen mit bestehenden Placements
  - prueft Ueberlappungen mit Oeffnungen

API-Integration:

- `GET /api/v1/rooms/:id/placements`
  - liefert alle Placements eines Raums

- `POST /api/v1/rooms/:id/placements`
  - legt ein Placement fuer ein `catalog_item_id` an
  - validiert gegen Wandgrenzen, andere Placements und Oeffnungen

- `PUT /api/v1/rooms/:id/placements`
  - speichert eine komplette Placement-Liste fuer den Raum
  - validiert die gesamte Liste vor dem Persistieren gegen Wandgrenzen, Oeffnungen und gegenseitige Ueberlappungen

- `PUT /api/v1/rooms/:id/placements/:placementId`
  - aktualisiert ein einzelnes Placement gezielt per ID
  - lehnt Payloads mit abweichender Placement-ID ab

- `DELETE /api/v1/rooms/:id/placements/:placementId`
  - entfernt ein Placement aus dem Room-Payload

## Testabdeckung

- normierte Wandrichtung
- Innennormale auf rechteckigem Polygon
- Weltposition aus Offset
- Projektion auf Wand
- Ueberlappungspruefung bestehender Objekte
- Placement-Validator gegen Wandgrenzen, Placements und Oeffnungen
- Route-Tests fuer `GET`, `POST`, Batch-`PUT`, Einzel-`PUT`, Validierungsfehler und `DELETE`

## DoD-Status Sprint 8

- Platzierung entlang beliebiger Waende ist mathematisch als pure Funktion vorhanden
- Placement-Validierung ist zentral in `shared-schemas` exportiert
- Room-gebundene Placement-API ist fuer Anlegen, Speichern, Aktualisieren und Loeschen vorhanden und testbar abgesichert

## Naechster Sprint

Sprint 9 (TASK-9-C01):

- Objekt-Kollisionen
- Objekt-vs-Raum und Objekt-vs-Oeffnung
- Mindestabstaende und Cost-Hints
- Unit-Tests und Sprint-Dokumentation
