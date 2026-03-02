# Beitragen zu OKP

Vielen Dank für dein Interesse, zu OKP beizutragen!

## Voraussetzungen

- Node.js >= 20
- npm >= 10
- TypeScript-Kenntnisse
- Grundverständnis von React und Fastify

## Entwicklungsumgebung einrichten

```bash
git clone https://github.com/DKFuH/OKP.git
cd OKP
npm install
npm test
```

## Workflow

1. **Issue erstellen** – Beschreibe das Problem oder Feature, bevor du mit der Arbeit beginnst.
2. **Branch anlegen** – Benenne den Branch aussagekräftig, z. B. `feat/polygon-room-editor` oder `fix/dxf-import-encoding`.
3. **Code schreiben** – Halte dich an die bestehenden Konventionen (TypeScript strict, Zod-Validierung, Vitest-Tests).
4. **Tests ausführen** – Alle Tests müssen grün sein: `npm test`.
5. **Pull Request öffnen** – Beschreibe kurz, was geändert wurde und warum.

## Code-Konventionen

- Sprache im Code: Englisch (Bezeichner, Kommentare)
- Sprache in Commit-Messages: Englisch
- Kein `any` in TypeScript ohne expliziten Kommentar
- Neue Datenstrukturen immer mit Zod-Schema in `shared-schemas` absichern
- Tests für alle neuen Funktionen in Vitest

## Commit-Messages

Wir folgen [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add sloped-ceiling height constraint
fix: correct DXF coordinate offset on import
docs: update room model documentation
test: add unit tests for BOM calculation
```

## Pull Requests

- Einen PR pro Thema / Feature
- Beschreibung enthält: Was wurde geändert? Warum? Wie wurde getestet?
- Verweise auf das zugehörige Issue (`Closes #42`)

## Verhaltenskodex

Bitte lies unseren [Code of Conduct](CODE_OF_CONDUCT.md).

## Lizenz

Mit deinem Beitrag stimmst du zu, dass dein Code unter der [Apache License 2.0](LICENSE) veröffentlicht wird.
