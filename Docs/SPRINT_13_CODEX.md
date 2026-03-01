# SPRINT_13_CODEX.md

## Umfang

Umsetzung Sprint 13 (Angebotsmanagement v1):

- Angebot aus Projekt erzeugen
- Angebotsversionen automatisch erhöhen
- Angebot abrufen
- PDF-light Export-Endpunkt bereitstellen

## Umgesetzte Dateien

- `planner-api/src/routes/quotes.ts`
- `planner-api/src/routes/quotes.test.ts`
- `planner-api/src/index.ts`

## Ergebnis Sprint 13

Implementiert wurde:

- `POST /api/v1/projects/:id/create-quote`
  - prüft Projekt-Existenz
  - erzeugt neue Angebotsversion (auto-increment)
  - generiert Angebotsnummer auf Basis Prefix + Jahr + laufender Version
  - übernimmt `valid_until`, `free_text`, `footer_text` (mit Default aus `quote_settings`)
  - erzeugt `quote_items` aus übergebenen BOM-Linien

- `GET /api/v1/quotes/:id`
  - lädt Angebot inkl. Positionen

- `POST /api/v1/quotes/:id/export-pdf`
  - liefert PDF-light URL als API-Vertrag

## DoD-Status Sprint 13

- Angebotsnummer: **erfüllt**
- Gültig-bis: **erfüllt**
- Freitext/Fußtext: **erfüllt**
- Angebotsversionen: **erfüllt**
- PDF light: **erfüllt (URL-Contract)**

## Teststatus

- `planner-api/src/routes/quotes.test.ts` grün
- Route-Sanity zusammen mit BOM/Pricing-Routen grün

## Nächster Sprint

Sprint 14:

- Browser-3D-Preview
- Floor-Triangulation, Wände extrudieren, Objekt-Proxy-Meshes
