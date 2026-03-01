# TASKS_GITHUB_COMPANION.md

## Aufgaben für Github Companion

**Zuständigkeit:** Code-Review auf PRs, Architektur-Review, Dokumentationsanalyse, Sicherheitsanalyse, Testabdeckungs-Check

**Beteiligte Modelle:**
| Modell | Schwerpunkt |
|---|---|
| **Claude** | Architektur-Review, API-Konsistenz, Datenmodell-Analyse |
| **GPT** | Dokumentations-Review, Kommentarqualität, Codelesbarkeit |
| **GROK** | Kritische Code-Analyse, Logikfehler, Edge Cases |
| **Raptor** | Sicherheitsanalyse, Dependency-Check, Performance-Hinweise |

> **Prompt-Nutzung:** Jeden Prompt direkt im PR-Kommentar oder im Github Companion Chat eingeben. Betroffene Dateien als Kontext anhängen.

---

## TASK-0-R01 – Review: Architekturdokumente (Sprint 0)

**Sprint:** 0 | **Zuständig:** Claude + GPT | **Status:** Offen

### Claude-Prompt
```
Reviewe die Architekturdokumente eines neuen Webprojekts (Küchenplaner, Node.js + TypeScript).

Prüfe folgende Dateien: ARCHITECTURE.md, ROOM_MODEL.md, PRICING_MODEL.md, QUOTE_MODEL.md, RENDER_PROTOCOL.md, CAD_INTEROP.md, SKP_INTEROP.md

Fokus:
1. Sind alle API-Contracts vollständig und widerspruchsfrei?
2. Sind die Domänenobjekte konsistent über alle Dokumente hinweg (gleiche Feldnamen, gleiche Typen)?
3. Deckt das Render-Protokoll alle Status-Übergänge ab (queued → done/failed)?
4. Ist die CAD/SKP-Interop-Strategie realistisch für den MVP-Scope?
5. Gibt es ungelöste Abhängigkeiten zwischen den Dokumenten?

Antworte mit: Befunde (konkret mit Datei:Zeile), Empfehlungen, offene Fragen.
```

### GPT-Prompt
```
Reviewe Architekturdokumente für ein Softwareprojekt auf Verständlichkeit und Vollständigkeit.

Dateien: ARCHITECTURE.md, ROOM_MODEL.md, PRICING_MODEL.md, QUOTE_MODEL.md

Fokus:
1. Sind die Dokumente für einen neuen Entwickler ohne Vorkenntnisse verständlich?
2. Werden Fachbegriffe (Kniestock, Dachschräge, Blockverrechnung) erklärt?
3. Sind JSON-Beispielstrukturen vorhanden und korrekt?
4. Fehlen wichtige Abschnitte (z.B. Fehlerszenarien, Definitionen)?

Antworte mit konkreten Verbesserungsvorschlägen je Dokument.
```

---

## TASK-1-R01 – Review: Backend-Grundgerüst PR (Sprint 1)

**Sprint:** 1 | **Zuständig:** Raptor + GROK | **Status:** Offen

### Raptor-Prompt
```
Führe eine Sicherheitsanalyse für ein neues Node.js/Fastify-Backend durch.

Betroffene Dateien: planner-api/src/, planner-api/prisma/schema.prisma

Prüfe:
1. SQL-Injection: Werden alle DB-Queries parametrisiert (Prisma ORM)? Gibt es Raw-Queries?
2. Passwort-Handling: Werden Passwörter gehasht (bcrypt/argon2)? Keine Klartextpasswörter?
3. Credentials: Keine Secrets, API-Keys oder Passwörter im Code oder in git-trackten Dateien?
4. Dependencies: Gibt es bekannte CVEs in package.json (npm audit)?
5. Input-Validation: Wird jeder API-Eingang mit Zod oder ähnlichem validiert?

Antworte mit: Schweregrad (kritisch/hoch/mittel/niedrig), betroffene Datei, konkrete Empfehlung.
```

### GROK-Prompt
```
Analysiere ein Datenbankschema und erste API-Routen auf Korrektheit und Robustheit.

Betroffene Dateien: planner-api/prisma/schema.prisma, planner-api/src/routes/

Prüfe:
1. Ist das DB-Schema normalisiert (3NF)? Gibt es Redundanzen?
2. Sind alle Fremdschlüssel und CASCADE-Rules sinnvoll gesetzt?
3. Fehlerbehandlung: Werden DB-Fehler (z.B. UniqueConstraint-Violation) korrekt abgefangen und als HTTP-Fehler zurückgegeben?
4. Werden Transaktionen verwendet, wo atomare Operationen nötig sind (z.B. Projekt + Room anlegen)?
5. Gibt es N+1-Query-Probleme in den Routen?

Liste konkrete Probleme mit Datei und Zeilennummer.
```

---

## TASK-2-R01 – Review: Frontend-Grundgerüst PR (Sprint 2)

**Sprint:** 2 | **Zuständig:** GPT + GROK | **Status:** Offen

### GPT-Prompt
```
Reviewe die initiale Struktur einer React + TypeScript Frontend-Anwendung.

Betroffene Dateien: planner-frontend/src/

Fokus:
1. Ist die Komponentenstruktur sauber (Trennung von UI, State, API-Calls)?
2. Ist der State-Management-Ansatz dokumentiert und konsistent?
3. Sind Komponenten-Props typisiert (keine `any`)?
4. Gibt es fehlende Accessibility-Attribute (aria-label, role)?
5. Sind Komponentennamen und Dateinamen konsistent (PascalCase)?

Antworte mit konkreten Verbesserungsvorschlägen.
```

### GROK-Prompt
```
Analysiere die API-Integration und asynchrone Logik eines React-Frontends auf Fehler.

Betroffene Dateien: planner-frontend/src/api/, planner-frontend/src/hooks/

Prüfe:
1. Werden API-Fehler überall abgefangen und dem User angezeigt?
2. XSS-Risiken: Werden User-Inhalte mit dangerouslySetInnerHTML gerendert?
3. Gibt es Race Conditions bei parallelen API-Calls (z.B. schnell wechselnde Projekte)?
4. Werden AbortController verwendet um API-Calls bei Unmount abzubrechen?
5. Werden sensible Daten (Token) im localStorage oder nur im Memory gehalten?

Liste konkrete Risiken mit Datei und Erklärung.
```

---

## TASK-3-R01 – Review: Polygon-Editor PR (Sprint 3)

**Sprint:** 3 | **Zuständig:** GROK + Claude | **Status:** Offen

### GROK-Prompt
```
Analysiere einen Polygon-Editor für einen Küchenplaner auf Korrektheit und Robustheit.

Betroffene Dateien:
- shared-schemas/src/geometry/validatePolygon.ts
- shared-schemas/src/geometry/snapUtils.ts
- planner-frontend/src/editor/PolygonEditor.tsx

Prüfe:
1. Deckt die Polygon-Validierung alle Edge Cases ab?
   - Degeneriertes Polygon (alle Punkte auf einer Linie)
   - Sehr kleine Polygone (< 100mm Seitenlänge)
   - Polygon mit doppelten Punkten
2. Ist die Snap-Logik numerisch stabil? (Floating-Point-Fehler bei 45°-Snap?)
3. Werden Canvas-Event-Handler (mousedown, mousemove, mouseup) korrekt entfernt (Memory Leak)?
4. Können Koordinaten vom User so manipuliert werden, dass ungültige Werte in die DB gelangen?

Konkrete Befunde mit Datei und Zeilennummer.
```

### Claude-Prompt
```
Reviewe die Datenfluss-Implementierung eines Polygon-Raum-Editors.

Betroffene Dateien:
- planner-api/src/routes/rooms.ts
- planner-api/src/services/roomService.ts
- planner-frontend/src/api/roomsApi.ts

Prüfe:
1. Ist der Datenfluss Frontend → API → DB konsistent mit dem Raummodell in Docs/ROOM_MODEL.md?
2. Bleiben wall_id-Werte stabil, wenn ein Vertex verschoben wird? (Kritisch für Platzierungsreferenzen)
3. Sind die API-Responses vollständig (alle benötigten Felder für das Frontend)?
4. Gibt es fehlende Validierungen auf API-Ebene (z.B. max. 64 Vertices)?

Antworte mit Ja/Nein je Punkt + konkreten Befunden.
```

---

## TASK-3-R02 – Review: CAD/SKP Import-Pipeline PR (Sprint 3.5)

**Sprint:** 3.5 | **Zuständig:** Raptor + Claude | **Status:** Offen

### Raptor-Prompt
```
Führe eine Sicherheitsanalyse für einen Datei-Upload-Endpunkt durch (CAD-Dateien).

Betroffene Dateien:
- planner-api/src/routes/imports.ts
- interop-cad/dxf-import/src/dxfParser.ts

Prüfe:
1. Dateigrößen-Limit: Gibt es ein Maximum (z.B. 50 MB)?
2. Dateitype-Validierung: Wird MIME-Type UND Magic Bytes geprüft (nicht nur Dateiendung)?
3. Pfadtraversierung: Kann der Dateiname Pfade enthalten (../../etc/passwd)?
4. DXF/DWG-spezifisch: Gibt es External-Reference-Angriffe (XREF auf externe Hosts)?
5. Upload-Zielverzeichnis: Liegt es außerhalb des Web-Roots? Nicht direkt erreichbar?
6. Parser-DoS: Kann eine manipulierte DXF-Datei den Parser in eine Endlosschleife treiben?

Schweregrad + konkrete Empfehlung je Befund.
```

### Claude-Prompt
```
Reviewe die Import-Pipeline-Implementierung auf Korrektheit und Vollständigkeit.

Betroffene Dateien:
- planner-api/src/routes/imports.ts
- planner-api/src/services/importService.ts
- interop-cad/dxf-import/src/dxfParser.ts

Prüfe anhand von Docs/CAD_INTEROP.md:
1. Entspricht das ImportAsset-Format exakt der Spezifikation?
2. Werden ImportJob-Status-Übergänge korrekt persistiert?
3. Ist die Einheiten-Normalisierung (INSUNITS → mm) implementiert?
4. Gibt es einen Endpunkt um Layer anzuzeigen und Raumkonturen zu übernehmen?

Antworte mit konkreten Abweichungen von der Spec.
```

---

## TASK-5-R01 – Review: Öffnungen PR (Sprint 5)

**Sprint:** 5 | **Zuständig:** GROK | **Status:** Offen

### GROK-Prompt
```
Analysiere die Öffnungs-Implementierung (Türen/Fenster) eines Küchenplaners.

Betroffene Dateien:
- shared-schemas/src/geometry/openingValidator.ts
- planner-api/src/routes/openings.ts

Prüfe:
1. Schlägt die Validierung für alle ungültigen Positionen fehl?
   - offset_mm < 0
   - offset_mm + width_mm > wall.length_mm (exakt auf Grenze)
   - Zwei Öffnungen mit 0mm Abstand (direkt aneinander)
2. Ist der Überschneidungs-Check performant bei n Öffnungen? (O(n²) akzeptabel bis n=20)
3. Ist die Öffnungs-Übernahme aus CAD-Daten auf Plausibilität geprüft?
   (z.B. Breite < 200mm oder > 3000mm → ignorieren)
4. Können Öffnungen über API ohne room_id angelegt werden? (Daten-Inkonsistenz)
```

---

## TASK-8-R01 – Review: Platzierungsengine PR (Sprint 8)

**Sprint:** 8 | **Zuständig:** GROK + Claude | **Status:** Offen

### GROK-Prompt
```
Analysiere die wandbasierte Platzierungsengine auf Mathematik-Korrektheit.

Betroffene Dateien:
- shared-schemas/src/geometry/wallPlacement.ts
- planner-api/src/services/placementService.ts

Prüfe:
1. Ist die Innenrichtungsberechnung für alle Polygonformen korrekt?
   - Konkave Polygone (L-Form, U-Form)
   - Wände mit Winkel < 45° oder > 135° zum Nachbarsegment
2. Numerische Stabilität: Was passiert bei Wandlänge = 0 mm? Division by Zero?
3. Concurrency: Können zwei gleichzeitige API-Calls denselben Wandbereich belegen?
   (optimistic locking oder DB-Constraint nötig?)
4. Kann offset_mm negativ oder größer als wall.length_mm über die API gesetzt werden?
```

### Claude-Prompt
```
Reviewe die API-Vollständigkeit der Platzierungsengine.

Betroffene Dateien:
- planner-api/src/routes/placements.ts
- planner-frontend/src/editor/PlacementManager.tsx

Prüfe anhand von Docs/ROOM_MODEL.md:
1. Sind alle CRUD-Endpunkte für Placements implementiert?
2. Werden Placements atomar persistiert (kein Halbzustand bei Fehler)?
3. Gibt das Frontend korrekte wall_id + offset_mm an die API?
4. Wird nach Platzierung automatisch eine Validierung ausgelöst (POST /validate)?
```

---

## TASK-9-R01 – Review: Kollisionserkennung PR (Sprint 9)

**Sprint:** 9 | **Zuständig:** GROK + Raptor | **Status:** Offen

### GROK-Prompt
```
Analysiere die Kollisionserkennungs-Implementierung auf Vollständigkeit und Performance.

Betroffene Dateien:
- shared-schemas/src/validation/collisionDetector.ts
- planner-api/src/routes/validate.ts

Prüfe:
1. Werden alle 5 Kollisionstypen getestet (Objekt-Overlap, außerhalb Raum, Öffnung, Mindestabstand, ungültiger Bereich)?
2. Performance: O(n²) bei checkObjectOverlap — akzeptabel bis n=50?
3. Sind die Hinweis-Flags (Sonderblende, Montageaufwand) korrekt gesetzt?
4. Gibt es Grenzfall: Objekt genau an Raumgrenze (0mm Abstand) → Error oder OK?
5. Wird die Validierung auch auf Server-Seite erzwungen (nicht nur Client)?
```

### Raptor-Prompt
```
Prüfe den Validierungs-Endpunkt auf Missbrauchspotenzial.

Betroffene Datei: planner-api/src/routes/validate.ts

Prüfe:
1. Kann der Endpunkt mit einem sehr großen Projekt (1000 Objekte) für DoS genutzt werden?
   → Rate-Limiting vorhanden? Komplexitätslimit?
2. Wird geprüft, ob der anfragende User zum Projekt gehört (Autorisierung)?
3. Werden Eingaben vor der Algorithmus-Ausführung validiert (malformed room polygon)?
```

---

## TASK-11-R01 – Review: BOM-Engine PR (Sprint 11)

**Sprint:** 11 | **Zuständig:** Claude + GROK | **Status:** Offen

### Claude-Prompt
```
Reviewe die BOM-Implementierung auf Vollständigkeit und Spec-Konformität.

Betroffene Dateien:
- planner-api/src/services/bomCalculator.ts
- planner-api/src/routes/bom.ts

Prüfe anhand von Docs/PRICING_MODEL.md:
1. Werden alle BOMLineTypes erzeugt (cabinet, appliance, accessory, surcharge, assembly, freight, extra)?
2. Enthält jede BOMLine alle Pflichtfelder laut Spec (list_price_net, variant_surcharge, etc.)?
3. Ist die API-Response (POST /calculate-bom) konsistent mit PriceSummary-Format?
4. Werden Flags aus PlacedObject (requires_customization, labor_surcharge) korrekt in BOMLines übersetzt?
```

### GROK-Prompt
```
Prüfe die BOM-Berechnung auf numerische Korrektheit und Edge Cases.

Betroffene Datei: planner-api/src/services/bomCalculator.ts

Prüfe:
1. Rundungsfehler: Werden Zwischenergebnisse mit ausreichender Präzision berechnet?
   (Kein voreiliges Runden auf 2 Dezimalen)
2. Edge Case: Projekt ohne Objekte → Nur Fracht-BOMLine?
3. Edge Case: Objekt ohne Katalog-Zuweisung → Fehler oder ignorieren?
4. Qty > 0 für alle Zeilen erzwungen? (qty=0 ergibt sinnlose Zeile)
```

---

## TASK-12-R01 – Review: Preisengine PR (Sprint 12)

**Sprint:** 12 | **Zuständig:** GROK + Claude | **Status:** Offen

### GROK-Prompt
```
Analysiere die 9-stufige Preisberechnung auf Korrektheit.

Betroffene Datei: planner-api/src/services/priceCalculator.ts

Prüfe:
1. Werden die 9 Stufen in exakt der richtigen Reihenfolge angewendet (laut Docs/PRICING_MODEL.md)?
2. Floating-Point-Fehler: Wird mit Number (float64) oder Decimal-Bibliothek gerechnet?
   → Bei Geldbeträgen ist Decimal.js oder big.js empfohlen.
3. Negative Preise: Kann ein Globalrabatt > 100% zu negativem Netto führen?
4. MwSt-Gruppen: Werden gemischte Steuersätze (7% + 19%) korrekt aggregiert?
5. Rundung nur am Ende (Stufe 9) — nicht zwischen den Stufen?
```

### Claude-Prompt
```
Reviewe die kaufmännische Korrektheit der Preisengine.

Betroffene Dateien:
- planner-api/src/services/priceCalculator.ts
- planner-api/src/routes/pricing.ts

Prüfe:
1. Ist contribution_margin_net = subtotal_net - dealer_price_net korrekt berechnet?
2. Ist markup_pct = (margin / dealer_price) × 100 — nicht margin/list_price?
3. Werden Extra-Kosten (Fracht) in die MwSt-Berechnung einbezogen?
4. Ist der GET /price-summary Endpunkt ein Snapshot (kein Live-Recalculate)?
```

---

## TASK-13-R01 – Review: Angebotsmanagement PR (Sprint 13)

**Sprint:** 13 | **Zuständig:** Raptor + GPT | **Status:** Offen

### Raptor-Prompt
```
Sicherheitsanalyse für die Angebots- und PDF-Generierung.

Betroffene Dateien:
- planner-api/src/routes/quotes.ts
- planner-api/src/services/pdfGenerator.ts

Prüfe:
1. PDF-Injection: Wird Freitext-Input sanitized bevor er ins PDF gelangt?
   (Gefahr: LaTeX-Injection, HTML-Injection in PDF-Libs wie Puppeteer/PDFKit)
2. Enthält das PDF keine internen Daten (DB-IDs, Server-Pfade, Debug-Infos)?
3. Zugriffskontrolle: Kann User A das Angebot von User B abrufen (IDOR)?
4. PDF-URL: Ist sie nicht ratebar (kein /quotes/1.pdf, /quotes/2.pdf)?
5. Versionierung: Kann eine alte Angebotsversion überschrieben werden?
```

### GPT-Prompt
```
Reviewe das Angebots-PDF auf professionellen Aufbau und Vollständigkeit.

Betroffene Datei: planner-api/src/services/pdfGenerator.ts

Prüfe:
1. Enthält das PDF alle Pflichtfelder laut Docs/QUOTE_MODEL.md (Angebotsnummer, Gültig-bis, Positionen, Summen)?
2. Ist der Summenblock korrekt: Zwischensumme netto | MwSt | Brutto?
3. Positionen mit show_on_quote: false erscheinen NICHT im PDF?
4. Ist der Freitext-Bereich korrekt escaped (keine HTML-Sonderzeichen im PDF)?
5. Layout: Umbricht die Tabelle korrekt bei vielen Positionen (> 1 Seite)?
```

---

## TASK-15-R01 – Review: Render-Job-System PR (Sprint 15)

**Sprint:** 15 | **Zuständig:** Raptor + GROK | **Status:** Offen

### Raptor-Prompt
```
Sicherheitsanalyse des Render-Worker-Protokolls.

Betroffene Dateien:
- planner-api/src/routes/renderJobs.ts
- planner-api/src/routes/workers.ts

Prüfe anhand von Docs/RENDER_PROTOCOL.md:
1. Worker-Authentifizierung: Ist GET /render-jobs/next ohne gültigen Worker-Token erreichbar?
2. Token-Speicherung: Wird der Worker-Token gehasht gespeichert (nicht im Klartext)?
3. Scene Payload: Enthält er Kundennamen, Preise oder andere sensitive Daten?
4. Ergebnis-Upload: Kann ein Worker Jobs von anderen Workern übernehmen?
5. Bild-URL: Ist sie nicht öffentlich ratebar (/results/1.jpg, /results/2.jpg)?
```

### GROK-Prompt
```
Analysiere die Job-Queue-Implementierung auf Korrektheit und Fehlerresistenz.

Betroffene Dateien:
- planner-api/src/services/renderJobService.ts
- planner-api/src/routes/renderJobs.ts

Prüfe:
1. Status-Übergänge: Werden ungültige Übergänge verhindert (z.B. done → running)?
2. Atomarität: Können zwei Worker denselben Job gleichzeitig holen?
   (SELECT + UPDATE muss atomar sein — DB-Lock oder CAS-Update?)
3. Timeout-Handling: Werden Jobs aus 'assigned' zurück zu 'queued' nach 5 min (laut Spec)?
4. Heartbeat: Falls Worker abstürzt, wie lange bis Job freigegeben wird?
```

---

## TASK-17-R01 – Review: Blockverrechnung PR (Sprint 17)

**Sprint:** 17 | **Zuständig:** Claude + GROK | **Status:** Offen

### Claude-Prompt
```
Reviewe die Blockverrechnung auf kaufmännische Korrektheit.

Betroffene Dateien:
- planner-api/src/services/blockEvaluator.ts
- planner-api/src/routes/blocks.ts

Prüfe:
1. Deckt das BlockDefinition-Datenmodell alle gängigen Hersteller-Modelle ab (EK-Basis, VK-Basis, Punkte)?
2. Ist die Beste-Block-Auswahl nach price_advantage_net korrekt (nicht nach discount_pct)?
3. Wird der übernommene Blockrabatt korrekt ins Angebot übertragen?
4. Gleichstand zweier Blöcke: Welcher wird gewählt? Deterministisch?
```

### GROK-Prompt
```
Prüfe den Block-Algorithmus auf Edge Cases und Performance.

Betroffene Datei: planner-api/src/services/blockEvaluator.ts

Prüfe:
1. Kein passender Tier (basis_value unter allen min_values): discount_pct = 0, kein Fehler?
2. Leere Blocks-Liste übergeben: Kein Absturz, leeres Ergebnis?
3. Performance: Bei 50 Blockprogrammen mit je 10 Tiers — Laufzeit akzeptabel?
4. Werden negative price_advantage_net Werte (Block schlechter als Standard) korrekt ausgefiltert?
```

---

## TASK-19-R01 – Review: Interop-Härtung PR (Sprint 19)

**Sprint:** 19 | **Zuständig:** Alle Modelle | **Status:** Offen

### Claude-Prompt
```
Reviewe die CAD-Interop-Härtung auf Spec-Konformität und Dokumentationsvollständigkeit.

Betroffene Dateien: Docs/CAD_INTEROP.md, tests/integration/cadRoundtrip.test.ts

Prüfe:
1. Ist der DWG-Roundtrip (Import → Bearbeitung → Export) vollständig dokumentiert?
2. Sind Layer-Konventionen in CAD_INTEROP.md final und vollständig?
3. Decken die Regressionstests alle dokumentierten Layer und Einheiten-Fälle ab?
```

### GROK-Prompt
```
Prüfe die Roundtrip-Tests auf Robustheit.

Betroffene Datei: tests/integration/cadRoundtrip.test.ts

Prüfe:
1. Werden Koordinaten mit Toleranz verglichen (±1mm) statt exakt (Float-Vergleich)?
2. Werden verschiedene DXF-Versionen getestet (R2010, R2013, R2018)?
3. Leeres DXF als Grenzfall vorhanden?
4. Werden alle 4 YAKDS-Layer im Export geprüft?
```

### Raptor-Prompt
```
Prüfe den Export-Endpunkt auf neue Sicherheitsrisiken nach der Härtung.

Betroffene Datei: planner-api/src/routes/exports.ts

Prüfe:
1. Können exportierte DXF-Dateien Metadaten enthalten, die interne Infos leaken (Server-Pfade, Nutzernamen)?
2. Ist die Download-URL zeitlich begrenzt (signierte URL, Ablaufzeit)?
```

### GPT-Prompt
```
Prüfe die Interop-Dokumentation auf Aktualität und Vollständigkeit.

Betroffene Dateien: Docs/CAD_INTEROP.md, Docs/SKP_INTEROP.md

Prüfe:
1. Stimmen die dokumentierten Layer-Namen mit der tatsächlichen Implementierung überein?
2. Sind alle Nicht-MVP-Punkte als solche markiert?
3. Gibt es neue Features aus Sprint 18/19, die noch nicht dokumentiert sind?
```
