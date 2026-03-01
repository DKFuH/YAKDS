# PRICING_MODEL.md

## Preismodell – Kaufmännische Berechnungslogik

**Stand:** Sprint 0

---

## Grundprinzip

Preise werden **pro Projekt** berechnet — nie lazy inline.
Die Berechnung ist deterministisch und reproduzierbar:
`POST /projects/:id/calculate-pricing` liefert immer dasselbe Ergebnis für denselben Zustand.

---

## 9-stufige Preislogik

```
1. Listenpreis (list_price_net)
        │
        ▼
2. Varianten-/Mehrpreise addieren (variant_surcharge)
        │
        ▼
3. Objektzuschläge addieren (object_surcharges: Montage, Sondermaß, etc.)
        │
        ▼
4. Positionsrabatt abziehen (position_discount_pct)
        │
        ▼
5. Warengruppenrabatt abziehen (pricing_group_discount_pct)
        │
        ▼
6. Globalrabatt abziehen (global_discount_pct)
        │
        ▼
7. Zusatzkosten addieren (extra_costs: Fracht, Montage pauschal)
        │
        ▼
8. MwSt berechnen (tax_rate aus tax_group_id)
        │
        ▼
9. Rundung (auf 0,01 € kaufmännisch)
```

---

## Kernobjekte

### `BOMLine`

Eine Position in der Stückliste.

```typescript
interface BOMLine {
  id: string;
  project_id: string;
  type: BOMLineType;
  catalog_item_id: string | null;   // null bei Zusatzkosten
  description: string;
  qty: number;
  unit: 'stk' | 'm' | 'm2' | 'pauschal';
  list_price_net: number;           // Listenpreis je Einheit
  variant_surcharge: number;        // Stufe 2
  object_surcharges: number;        // Stufe 3
  position_discount_pct: number;    // Stufe 4
  pricing_group_discount_pct: number; // Stufe 5
  line_net_after_discounts: number; // nach Stufen 4+5
  tax_group_id: string;
  tax_rate: number;                 // z.B. 0.19
}

type BOMLineType =
  | 'cabinet'
  | 'appliance'
  | 'accessory'
  | 'surcharge'
  | 'assembly'
  | 'freight'
  | 'extra';
```

---

### `PriceComponent`

Einzelner Berechnungsschritt für Transparenz.

```typescript
interface PriceComponent {
  step: number;          // 1–9
  label: string;
  value: number;         // positiv = Aufschlag, negativ = Abzug
  cumulative: number;    // laufende Summe nach diesem Schritt
}
```

---

### `PriceSummary`

Ergebnis der Gesamtkalkulation.

```typescript
interface PriceSummary {
  project_id: string;
  calculated_at: string;

  // Zwischenwerte
  total_list_price_net: number;
  total_variant_surcharges: number;
  total_object_surcharges: number;
  total_position_discounts: number;
  total_group_discounts: number;
  total_global_discount: number;
  total_extra_costs: number;

  // Ergebnis
  subtotal_net: number;            // nach Stufen 1–7
  vat_amount: number;              // Stufe 8
  total_gross: number;             // Stufe 9

  // Kaufmännisch
  dealer_price_net: number;        // Einkaufspreis (aus Katalog)
  contribution_margin_net: number; // subtotal_net - dealer_price_net
  markup_pct: number;              // (contribution_margin / dealer_price) * 100

  bom_lines: BOMLine[];
  components: PriceComponent[];    // Schritte 1–9 je Position
}
```

---

## Rabatt-Konfiguration

### `GlobalDiscountSettings`

```typescript
interface GlobalDiscountSettings {
  project_id: string;
  global_discount_pct: number;          // Stufe 6, auf Gesamtsumme
  extra_costs: ExtraCost[];             // Stufe 7
}

interface ExtraCost {
  id: string;
  label: string;
  amount_net: number;
  tax_group_id: string;
  type: 'freight' | 'assembly' | 'other';
}
```

---

## Preislisten und Gruppen

### `PriceList`

```typescript
interface PriceList {
  id: string;
  name: string;
  valid_from: string;
  valid_until: string | null;
  items: PriceListItem[];
}

interface PriceListItem {
  catalog_item_id: string;
  list_price_net: number;
  dealer_price_net: number;
}
```

### `PricingGroup`

```typescript
interface PricingGroup {
  id: string;
  name: string;                   // z.B. "Elektrogeräte", "Küchenmöbel"
  default_discount_pct: number;   // Stufe 5 Standardwert
}
```

### `TaxGroup`

```typescript
interface TaxGroup {
  id: string;
  name: string;                   // z.B. "Standard DE"
  tax_rate: number;               // z.B. 0.19
}
```

---

## Berechnungsbeispiel

| Schritt | Beschreibung | Wert |
|---|---|---|
| 1 | Listenpreis | 1.000,00 € |
| 2 | Variante +50 € | 1.050,00 € |
| 3 | Objektzuschlag Sondermaß +80 € | 1.130,00 € |
| 4 | Positionsrabatt -5% | 1.073,50 € |
| 5 | Warengruppenrabatt -10% | 966,15 € |
| 6 | Globalrabatt -3% | 937,17 € |
| 7 | Fracht pauschal +89 € | 1.026,17 € |
| 8 | MwSt 19% | +194,97 € |
| 9 | Brutto gerundet | **1.221,14 €** |

---

## API-Contracts

```
POST /projects/:id/calculate-pricing
  → PriceSummary

GET /projects/:id/price-summary
  → PriceSummary (zuletzt berechneter Stand)

PUT /projects/:id/discount-settings
  Body: GlobalDiscountSettings
  → GlobalDiscountSettings
```

---

## Nicht im MVP

- Provisionsmodelle
- Debitoren/Mahnwesen
- Mehrwährung
- Retrorabatte / Jahresboni
