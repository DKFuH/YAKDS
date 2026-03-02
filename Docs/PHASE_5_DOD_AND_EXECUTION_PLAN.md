# PHASE_5_DOD_AND_EXECUTION_PLAN.md

Stand: 2026-03-02

---

## 1) Executive Summary: Phase-5 Definition of Done (DoD)

- **Profi-Parität als Ziel:** OKP schließt die verbleibenden Funktionslücken zu professionellen Küchenstudio-Systemen 
- **Nahtlose Fortsetzung von Phase 4:** Alle Features bauen auf Bereichen/Alternativen (Sprint 31–32), Onboarding (Sprint 33), Workspace-Layout (Sprint 34) und den Planungs-/Render-Sprints 35–40 auf.
- **One-Week-Sprints:** Sprints 41–45 werden als 5 aufeinanderfolgende 1-Wochen-Inkremente umgesetzt.
- **Praxisorientierter Fokus:** Features sind direkt aus echten Schulungsunterlagen abgeleitet – keine hypothetischen Anforderungen.

### Globales DoD für Phase 5

1. **Passstücke produktiv:** Freie Wandflächen werden automatisch mit genau dimensionierten Füllstücken belegt; Fangpunkt-Korrekturen funktionieren.
2. **Angebotsworkflow gehärtet:** Alternativen sind nach PDF-Export schreibgeschützt; Negativ-Rabatt-Konvention korrekt implementiert; EK nach AB nachtragbar.
3. **Alltagskomfort produktiv:** Taschenrechnerfunktion in allen Maßfeldern; Favoriten und Vorlagen für Katalog/Modelle; Planungspfeil per Tastatur steuerbar.
4. **Druckworkflow professionalisiert:** Batchdrucke, Schwarz/Weiß-Modus und zeitlich befristete Share-Links verfügbar; Ausdrucksformulare anpassbar.
5. **Spezialschranktypen produktiv:** Nischenverkleidung, Abdeckboden-Rebuild und Tiefenkürzung mit BOM-Flag funktionieren korrekt.

---

## 2) Ausgangslage und Abhängigkeiten

### Technische Ausgangslage

- `Sprint 8`: Platzierungsengine mit `wall_id + offset` vorhanden.
- `Sprint 11`: BOM-Engine vorhanden, erweiterbar um Flags (`custom_depth`, `surcharge_flag`).
- `Sprint 12`: 9-stufige Preisengine mit Rabattlogik vorhanden.
- `Sprint 13`: Angebotsmanagement mit PDF-Export vorhanden.
- `Sprint 21`: AutoCompletionService für Langteile vorhanden (Basis für Passstück-Logik).
- `Sprint 33`: Installationsobjekte mit Wandabstand-Eigenschaft vorhanden (Basis für Nischenverkleidung).
- `Sprint 35`: Makros vorhanden (Basis für Modell-Binding bei Vorlagen).

### Verbindliche Abhängigkeiten für Phase 5

- Tenant-Scoping bleibt in allen neuen Endpunkten verpflichtend.
- Passstücke werden als `generated: true` markiert und vom AutoCompletionService verwaltet (Rebuild bei Änderungen).
- Schreibschutz-Status muss atomar gesetzt werden – Lock in DB-Transaktion, kein Race Condition beim gleichzeitigen Drucken.
- Taschenrechner-Parser darf kein `eval` verwenden – eigene Miniparser-Implementierung (`+`, `-`, `*`, `/`, Klammern).
- Negativ-Rabatt-Konvention muss in UI explizit kommuniziert werden (Label + Tooltip).

---

## 3) Sprint-Detailplanung

### Sprint 41 – Planungseffizienz: Passstücke, Höhentypen & Sockeloptionen

**Ziel:** Automatisierte Füllstück-Generierung + farbcodierte Höhenzonierung + flexible Sockeloptionen.

**Neue DB-Tabellen:**
```sql
filler_pieces (
  id, alternative_id, wall_id,
  position_mm INT, width_mm INT, height_mm INT,
  generated BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ
)

height_zones (
  id, alternative_id,
  label VARCHAR(50), color VARCHAR(7),
  min_height_mm INT, max_height_mm INT
)

plinth_options (
  id, alternative_id,
  inset_mm INT DEFAULT 0,
  applies_to_cabinet_ids INT[]
)
```

**Neue TypeScript-Entitäten:**
```typescript
interface FillerPiece {
  id: number;
  alternativeId: number;
  wallId: number;
  positionMm: number;
  widthMm: number;
  heightMm: number;
  generated: boolean;
}

interface HeightZone {
  id: number;
  alternativeId: number;
  label: string;
  color: string;   // hex
  minHeightMm: number;
  maxHeightMm: number;
}

interface PlinthOption {
  id: number;
  alternativeId: number;
  insetMm: number;
  appliesToCabinetIds: number[];
}
```

**API-Endpunkte:**
- `POST /alternatives/:id/filler-pieces/generate` – berechnet und speichert Passstücke
- `GET /alternatives/:id/filler-pieces` – listet alle Passstücke
- `PUT /alternatives/:id/height-zones` – speichert Zonendefinition
- `GET /alternatives/:id/height-zones` – liest Zonendefinition
- `PUT /alternatives/:id/plinth-options` – speichert Sockeloptionen

**Akzeptanzkriterien:**
- Freie Wandfläche ≥ 60 mm wird automatisch als Passstück vorgeschlagen
- Passstück-Breite = verfügbare Wandfläche; Höhe = Schrankhöhe der angrenzenden Zeile
- Sockeloption ändert sich sofort sichtbar in der Ansicht
- Höhentypen werden in Grundriss und Seitenansicht farblich dargestellt

**Testumfang:** 20 Tests (FillerService-Unit, Höhenzonen-CRUD, Sockeloption-Multi-Select, API-Integration)

---

### Sprint 42 – Angebotsworkflow: Schreibschutz, Aufschläge & EK-Nachtrag

**Ziel:** Angebotsversand sperrt Alternative; Negativ-Rabatt korrekt; EK nach AB nachtragbar.

**Erweiterung alternatives.status:**
```typescript
type AlternativeStatus =
  | 'draft'
  | 'angebot_gesendet'   // schreibgeschützt ab hier
  | 'bestellt'           // EK-Felder entsperrbar
  | 'abgeschlossen';
```

**Neue DB-Spalten:**
```sql
-- alternatives
ALTER TABLE alternatives ADD COLUMN status VARCHAR(30) DEFAULT 'draft';
ALTER TABLE alternatives ADD COLUMN locked_at TIMESTAMPTZ;
ALTER TABLE alternatives ADD COLUMN locked_by INT REFERENCES users(id);

-- quote_positions
ALTER TABLE quote_positions ADD COLUMN purchase_price NUMERIC(10,2);
```

**Rabattlogik-Konvention (explizit):**
- `discount_value > 0` → prozentualer Abzug vom Preis
- `discount_value < 0` → prozentualer Aufschlag auf den Preis
- Reihenfolge: Artikel-Rabatt → Warengruppen-Rabatt → Gesamtrabatt

**API-Endpunkte:**
- `POST /alternatives/:id/lock` – setzt Status `angebot_gesendet`, locked_at, locked_by
- `POST /alternatives/:id/branch` – erstellt neue Alternative als Kopie (für Änderungen nach Lock)
- `PATCH /alternatives/:id/quote-positions/:posId/purchase-price` – nur wenn Status `bestellt`
- `GET /alternatives/:id/price-breakdown` – zeigt EK, Bruttogewinn, DB (Toggle-fähig)

**Akzeptanzkriterien:**
- PDF-Export setzt Status automatisch auf `angebot_gesendet`
- Bearbeitungsversuch an gesperrter Alternative zeigt Modal mit Branch-Option
- Negativer Rabatt addiert Aufschlag korrekt in allen 3 Ebenen
- EK-Felder erst nach Statuswechsel auf `bestellt` editierbar

**Testumfang:** 25 Tests (Status-Machine-Unit, Lock-Guard-Integration, Rabatt-Arithmetik, EK-Workflow)

---

### Sprint 43 – UX & Eingabe: Taschenrechner, Favoriten & Vorlagen

**Ziel:** Alltagskomfort: Rechenketten in Maßfeldern, Favoriten, Modellvorlagen.

**ExpressionInputField – Parser-Spezifikation:**
- Unterstützte Operatoren: `+`, `-`, `*`, `/`
- Klammerauflösung: unterstützt
- Auswertung: on-Blur
- Fehlerstate: rotes Border + Tooltip bei ungültigem Ausdruck
- Kein `eval` – eigene Recursive-Descent-Implementierung
- Beispiele: `2500-1632` → `868`, `600+150*2` → `900`, `(300+200)*2` → `1000`

**Neue DB-Tabellen:**
```sql
user_favorites (
  id, user_id INT, entity_type VARCHAR(50), entity_id INT,
  created_at TIMESTAMPTZ,
  UNIQUE(user_id, entity_type, entity_id)
)

model_templates (
  id, user_id INT, name VARCHAR(100),
  model_settings JSONB,
  created_at TIMESTAMPTZ
)
```

**API-Endpunkte:**
- `POST /user/favorites` – Favorit anlegen
- `DELETE /user/favorites/:entityType/:entityId` – Favorit entfernen
- `GET /user/favorites?entity_type=catalog_article` – Favoriten-Liste
- `POST /user/model-templates` – Vorlage speichern
- `GET /user/model-templates` – Vorlagen-Liste
- `GET /user/model-templates/:id` – Vorlage laden (für F7-Dialog)
- `DELETE /user/model-templates/:id`

**Akzeptanzkriterien:**
- `2500-1632` in Maßfeld ergibt 868
- `600+150` in Maßfeld ergibt 750
- Ungültiger Ausdruck (`abc`) zeigt Fehlerstate, kein Crash
- Favorit-Stern in Katalog-Sidebar sichtbar; Nur-Favoriten-Filter funktioniert
- Vorlage lädt F7-Dialog vollständig vor

**Testumfang:** 20 Tests (Parser-Unit mit Edge-Cases, Favoriten-CRUD, Vorlagen-CRUD, API-Integration)

---

### Sprint 44 – Druck & Export: Batchdruck, S/W-Modus & befristeter Link

**Ziel:** Druckworkflow professionalisieren.

**Neue DB-Tabellen:**
```sql
print_batch_profiles (
  id, user_id INT, name VARCHAR(100),
  form_ids JSONB,   -- geordnete Liste von Formular-Template-IDs
  created_at TIMESTAMPTZ
)

-- Erweiterung share_links
ALTER TABLE share_links ADD COLUMN expires_at TIMESTAMPTZ;
```

**API-Endpunkte:**
- `POST /alternatives/:id/batch-print` – erzeugt zusammengeführtes PDF aus Batch-Profil
- `GET /user/print-batch-profiles` – Profile auflisten
- `POST /user/print-batch-profiles` – Profil anlegen
- `PUT /user/print-batch-profiles/:id`
- `DELETE /user/print-batch-profiles/:id`
- `POST /share-links` – mit optionalem `expires_in_days`
- `GET /share-links/:token` – prüft Ablauf, gibt 410 wenn abgelaufen

**Akzeptanzkriterien:**
- Batchdruck erzeugt ein zusammengeführtes PDF mit allen gewählten Formularen in korrekter Reihenfolge
- Schwarz/Weiß-Toggle in Ansicht exportiert Strichzeichnung (keine Füllfarben, nur Konturen)
- Share-Link gibt nach Ablauf HTTP 410 zurück
- Ablauf verlängerbar über PATCH /share-links/:token

**Testumfang:** 20 Tests (Batch-PDF-Zusammenführung, S/W-Export-Flag, Link-Ablauf-Logik, Profile-CRUD)

---

### Sprint 45 – Erweiterte Planung: Nischenverkleidung, Abdeckboden & Tiefenkürzung

**Ziel:** Spezialschranktypen und Maßanpassungen mit korrekter BOM- und Preiswirkung.

**Erweiterungen cabinet_properties:**
```sql
ALTER TABLE cabinet_properties ADD COLUMN custom_depth_mm INT;
ALTER TABLE cabinet_properties ADD COLUMN cost_type VARCHAR(20) DEFAULT 'nicht_bauseits';
-- cost_type: 'bauseits' (Montagekosten) | 'nicht_bauseits' (Herstellerkosten)
```

**Neue DB-Tabelle:**
```sql
cover_panels (
  id, alternative_id, cabinet_id INT,
  width_mm INT, depth_mm INT,
  generated BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ
)
```

**BOM-Erweiterung:**
- Neue BOM-Zeile `surcharge_flag: true` wenn `custom_depth_mm` gesetzt
- `cost_type` bestimmt Kostenart in BOM-Ausgabe

**API-Endpunkte:**
- `POST /alternatives/:id/cover-panels/rebuild` – Abdeckboden neu generieren
- `GET /alternatives/:id/cover-panels` – aktuelle Abdeckböden
- `PATCH /placements/:id/properties` – custom_depth_mm, cost_type setzbar
- Bestehender `POST /calculate-bom` gibt surcharge_flag und cost_type mit aus

**Akzeptanzkriterien:**
- Nischenverkleidung verschiebt Wandabstand von überdecktem Installationsobjekt automatisch
- Abdeckboden wird nach Eigenschaftskorrektur (z. B. Regal entfernt) sofort neu generiert mit korrekter Größe
- Tiefenkürzung erzeugt Mehrpreis-Zeile in BOM (`surcharge_flag: true`)
- Ansichtenschnitt dreht Blickrichtung via Rechtsklick → Richtung wechseln

**Testumfang:** 25 Tests (Nischen-Wandabstand-Logik, Abdeckboden-Rebuild, Tiefenkürzung-BOM-Flag, Ansichtenschnitt-Richtung)

---

## 4) Zeitplan (5 Wochen)

| Woche | Sprint | Fokus |
|-------|--------|-------|
| 1 | 41 | Passstücke + Höhentypen + Sockeloptionen |
| 2 | 42 | Schreibschutz + Rabattlogik + EK-Nachtrag |
| 3 | 43 | Taschenrechner + Favoriten + Vorlagen |
| 4 | 44 | Batchdruck + S/W-Modus + Share-Link-Ablauf |
| 5 | 45 | Nischenverkleidung + Abdeckboden + Tiefenkürzung |

---

## 5) Risiken

| Risiko | Maßnahme |
|--------|----------|
| Schreibschutz Race Condition beim gleichzeitigen Drucken | DB-Transaktion mit SELECT FOR UPDATE beim Lock-Setzen |
| `eval`-Sicherheitslücke im Taschenrechner | Eigene Recursive-Descent-Parser-Implementierung, kein eval |
| Batchdruck-PDF sehr groß bei komplexen Planungen | Asynchroner Job mit Progress-Endpoint; Streaming-PDF-Merge |
| Nischenverkleidungs-Wandabstand-Logik inkorrekt | Explizite Prüfregel in Rule-Engine (Sprint 22); Unit-Tests mit Grenzwerten |
| Negativ-Rabatt wird als normaler Rabatt missverstanden | UI-Label: „Rabatt / Aufschlag (%)", Tooltip erklärt Vorzeichen-Konvention |
| Abdeckboden-Rebuild-Trigger bei Kaskaden-Änderungen | Rebuild als expliziter API-Aufruf (nicht automatisch bei jeder Eigenschaftsänderung) |
