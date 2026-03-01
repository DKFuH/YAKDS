# PR_COMMENT_TEMPLATE_TASK-8-R01.md

## A) GROK – Mathematik/Robustheit

```text
TASK-8-R01 Review – Wall Placement Math

Dateien:
- shared-schemas/src/geometry/wallPlacement.ts
- shared-schemas/src/geometry/wallPlacement.test.ts

Prüfpunkte:
1) Innennormale für konvexe/konkave Polygone robust?
2) Verhalten bei Null-Länge-Wänden (Division by Zero)?
3) snapToWall/getPlacementWorldPos korrekt geclampt?
4) canPlaceOnWall: Randfälle bei Berührung/Überlappung?

Antwortformat:
- Befund (Datei + Zeile)
- Risiko
- Fix
```

## B) Claude – API-Vollständigkeit

```text
TASK-8-R01 Review – Placement API Vollständigkeit

Dateien:
- Docs/ROOM_MODEL.md

Hinweis: planner-api/src/routes/placements.ts und planner-frontend/src/editor/PlacementManager.tsx sind aktuell nicht vorhanden.

Bitte liefern:
1) konkrete Checkliste der benötigten Endpunkte/Validierungen laut ROOM_MODEL
2) Risiken, wenn atomare Persistenz/Server-Validierung fehlt
3) empfohlene minimale API-Contracts für nächsten Implementierungsschritt
```
