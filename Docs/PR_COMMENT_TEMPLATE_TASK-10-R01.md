# PR_COMMENT_TEMPLATE_TASK-10-R01.md

## A) Claude – Modell/Regelkonformität

```text
TASK-10-R01 Review – Height Constraints

Dateien:
- shared-schemas/src/geometry/ceilingHeight.ts
- shared-schemas/src/validation/heightChecker.ts
- Docs/ROOM_MODEL.md

Prüfpunkte:
1) Formel und Distanzdefinition konsistent zu ROOM_MODEL?
2) Codes HEIGHT_EXCEEDED / HANGING_CABINET_SLOPE_COLLISION fachlich korrekt?
3) Flag-Logik (requires_customization, height_variant, labor_surcharge) konsistent?
4) Verhalten bei mehreren Constraints und Randfällen nachvollziehbar?

Antwortformat:
- Befund (Datei + Zeile)
- Abweichung
- Fix
```

## B) GROK – Numerik/Edge Cases

```text
TASK-10-R01 Technical Review – Height Checker

Dateien:
- shared-schemas/src/geometry/ceilingHeight.test.ts
- shared-schemas/src/validation/heightChecker.test.ts

Prüfpunkte:
1) Testen wir Grenzfälle ausreichend (nahe Wand, Tiefe-Grenze, multiple Constraints)?
2) Schwellenwerte >50 und <200 korrekt und robust?
3) Gibt es potenzielle false positives durch Floating-Point?

Antwortformat:
- Befund
- Risiko
- Test-/Code-Fix
```
