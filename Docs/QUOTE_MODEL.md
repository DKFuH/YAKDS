# QUOTE_MODEL.md

## Angebotsmodell – Struktur und Workflow

**Stand:** Sprint 0

---

## Grundprinzip

Ein Angebot wird **aus einem Projekt + PriceSummary** erzeugt.
Angebote sind **versioniert** — eine neue Version überschreibt nicht die alte.
Ein Angebot ist **schreibgeschützt** nach Erstellung; Änderungen erzeugen eine neue Version.

---

## Workflow

```
Projekt (geplant + berechnet)
        │
        ▼
POST /projects/:id/create-quote
        │
        ▼
Quote (Version 1, Status: draft)
        │
    Freigeben?
        │ ja
        ▼
Quote (Status: sent)
        │
    Angenommen?
        ├─ ja → Status: accepted
        └─ nein → Status: rejected / expired
```

---

## Kernobjekte

### `Quote`

```typescript
interface Quote {
  id: string;
  project_id: string;
  version: number;                  // 1, 2, 3 …
  quote_number: string;             // z.B. "ANG-2025-0042"
  status: QuoteStatus;
  valid_until: string;              // ISO 8601 Datum
  free_text: string | null;         // Freitext oben im Angebot
  footer_text: string | null;       // Freitext unten
  price_summary: PriceSummary;      // Snapshot zum Zeitpunkt der Erstellung
  items: QuoteItem[];
  created_at: string;
  created_by: string;               // user_id
  pdf_url: string | null;
}

type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired';
```

---

### `QuoteItem`

Eine einzelne Position im Angebot — lesbare Darstellung einer `BOMLine`.

```typescript
interface QuoteItem {
  id: string;
  quote_id: string;
  position: number;                 // Nummerierung 1, 2, 3 …
  type: BOMLineType;
  description: string;             // Artikelbezeichnung aus Katalog oder manuell
  qty: number;
  unit: string;
  unit_price_net: number;          // Verkaufspreis je Einheit (nach Rabatten Stufen 4+5)
  line_net: number;                // qty * unit_price_net
  tax_rate: number;
  line_gross: number;
  notes: string | null;            // optionale Positionsnotiz
  show_on_quote: boolean;          // false = interne Pos., nicht im PDF
}
```

---

### `QuoteSettings`

Projektweite Angebotseinstellungen.

```typescript
interface QuoteSettings {
  project_id: string;
  quote_number_prefix: string;     // z.B. "ANG"
  default_validity_days: number;   // z.B. 30
  default_free_text: string | null;
  default_footer_text: string | null;
  show_prices_on_quote: boolean;
  show_item_numbers: boolean;
}
```

---

## PDF-Struktur (light)

Das PDF (Sprint 13) enthält:

1. **Kopf:** Logo, Firmendaten, Kundendaten, Angebotsnummer, Datum, Gültig-bis
2. **Freitext oben**
3. **Positionstabelle:** Nr. | Bezeichnung | Menge | Einheit | EP netto | GP netto
4. **Summenblock:** Zwischensumme netto | MwSt | Gesamtbetrag brutto
5. **Freitext unten / Fußnote**

Positionen mit `show_on_quote: false` erscheinen **nicht** im PDF.

---

## API-Contracts

```
POST /projects/:id/create-quote
  Body: { valid_until, free_text, footer_text }
  → Quote

GET /quotes/:id
  → Quote

GET /projects/:id/quotes
  → Quote[]  (alle Versionen)

PATCH /quotes/:id/status
  Body: { status: QuoteStatus }
  → Quote

POST /quotes/:id/export-pdf
  → { pdf_url: string }
```

---

## Versionierungsregel

- Jedes `POST /projects/:id/create-quote` erzeugt eine neue Version
- `version` wird automatisch inkrementiert
- Ältere Versionen bleiben lesbar, Status kann nicht mehr geändert werden
- Nur die neueste Version kann `sent` / `accepted` / `rejected` werden
