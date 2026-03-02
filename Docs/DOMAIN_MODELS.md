# DOMAIN_MODELS.md

Domänenmodelle für OKP - Raumgeometrie, Katalog/Preislogik, Angebotswesen, Prüf-Engine und Mandantenmodell.

---

## Teil 1 - Raummodell

### Grundprinzip

Alle Räume sind **Polygone** - kein Sonderfall für Rechtecke.  
Platzierungen erfolgen immer relativ zu `wall_id + offset_mm`.  
Dachschrägen sind `CeilingConstraints` - keine separate Geometrie.

### `Room`

```typescript
interface Room {
  id: string;
  project_id: string;
  name: string;
  boundary: RoomBoundary;
  ceiling_height_mm: number;
  ceiling_constraints: CeilingConstraint[];
  openings: Opening[];
  created_at: string;
  updated_at: string;
}
```

### `RoomBoundary`

CCW-orientiertes, geschlossenes Polygon. `wall_segments[i]` verbindet `vertices[i]` mit `vertices[(i+1) % n]`.

```typescript
interface RoomBoundary {
  vertices: Vertex[];           // mind. 3, max. 64
  wall_segments: WallSegment[]; // automatisch abgeleitet
}

interface Vertex {
  id: string;
  x_mm: number;
  y_mm: number;
  index: number;
}

interface WallSegment {
  id: string;               // stabil, ändert sich nicht beim Vertex-Move
  room_id: string;
  index: number;
  start_vertex_id: string;
  end_vertex_id: string;
  length_mm: number;        // berechnet
  inner_normal: Vector2D;   // zeigt ins Rauminnere
  thickness_mm?: number;    // Wandstärke (z.B. 240 mm für Außenwand)
}
```

### `Opening` - Türen & Fenster

```typescript
interface Opening {
  id: string;
  wall_id: string;
  type: 'door' | 'window' | 'pass-through';
  offset_mm: number;        // Abstand vom Wandanfang
  width_mm: number;
  height_mm: number;
  sill_height_mm: number;   // 0 bei Türen
  recess_mm?: number;       // Fenster-Rücksprung: Tiefe der Laibung von der Raumseite
  source: 'manual' | 'cad_import';
}
```

Regeln: `offset_mm + width_mm <= wall.length_mm`, keine Überschneidungen.  
Objekte nicht in Öffnungen, außer wenn `type === 'window'` und `placement.height_mm <= sill_height_mm` (Unterschrank unter Fenster).  
Wenn `recess_mm` gesetzt: `recess_mm <= wall.thickness_mm`; bei Unterschrank unter Fenster darf `depth_mm` den `recess_mm` nicht überschreiten.

### `CeilingConstraint` - Dachschräge

```typescript
interface CeilingConstraint {
  id: string;
  room_id: string;
  wall_id: string;
  kniestock_height_mm: number;
  slope_angle_deg: number;
  depth_into_room_mm: number;
}
```

Verfügbare Höhe an Punkt `(x, y)`:

```text
d = senkrechter Abstand zur Wand
if d >= depth_into_room_mm:  available = ceiling_height_mm
else:                        available = kniestock_height_mm + tan(slope_angle_deg) * d
```

Bei mehreren Constraints gilt das Minimum.

### Platzierungsobjekte

```typescript
interface CabinetInstance {
  id: string;
  room_id: string;
  catalog_item_id: string;  // Phase 1: einfacher Katalog; Phase 2: Verweis auf CatalogArticle/ArticleVariant
  wall_id: string;
  offset_mm: number;
  width_mm: number;
  height_mm: number;
  depth_mm: number;
  flags: PlacementFlags;
}

interface PlacementFlags {
  requires_customization: boolean;
  height_variant: string | null;
  labor_surcharge: boolean;
  special_trim_needed: boolean;
  special_cut_needed: boolean;
}

interface ApplianceInstance {
  id: string;
  room_id: string;
  catalog_item_id: string;
  wall_id: string | null;       // freistehend möglich
  offset_mm: number | null;
  position_mm: { x: number; y: number };
  width_mm: number;
  height_mm: number;
  depth_mm: number;
}

interface RuleViolation {
  id?: string;
  severity: 'error' | 'warning' | 'hint';
  code: RuleCode;
  message: string;
  affected_ids: string[];
  rule_definition_id?: string;  // Phase 2: Referenz auf Prüf-Engine-Regel
}

type RuleCode =
  | 'OBJECT_OVERLAP'
  | 'OBJECT_OUTSIDE_ROOM'
  | 'OBJECT_BLOCKS_OPENING'
  | 'MIN_CLEARANCE_VIOLATED'
  | 'HEIGHT_EXCEEDED'
  | 'HANGING_CABINET_SLOPE_COLLISION'
  | 'SPECIAL_TRIM_NEEDED'
  | 'SPECIAL_CUT_NEEDED'
  | 'LABOR_SURCHARGE'
  | 'MISSING_WORKTOP'
  | 'MISSING_PLINTH'
  | 'MISSING_PANELS'
  | 'MISSING_HANDLE'
  | 'ERGONOMY_VIOLATION'
  | 'INCOMPLETE_KITCHEN'
  | 'CATALOG_CONSTRAINT_VIOLATION';
```

### Validierungsregeln (Übersicht)

| Regel | Zuständig |
|-------|-----------|
| Polygon geschlossen, keine Selbstüberschneidung | Codex |
| Mindestkantenlänge 100 mm | Codex |
| Mind. 3, max. 64 Vertices | API (Zod) |
| Öffnung innerhalb Wandgrenzen, keine Überlappungen | Codex |
| Platzierung innerhalb Raum, keine Kollisionen | Codex |
| Höhe vs. CeilingConstraint | Codex |
| Auto-Platzierungen erzeugen keine Überschneidungen | Codex |

---

## Teil 2 - Katalog- & Herstellermodell (Phase 1 + Phase 2)

### Grundprinzip

Es gibt zwei Evolutionsstufen:

- MVP-Katalog (`catalog_items`) - feste Typen (Unterschrank, Hängeschrank, Geräte etc.) mit einfachen Preisfeldern.
- Herstellerkatalog (Phase 2) - fein granulierte Artikel, Optionen und Varianten je Hersteller.

### MVP-Katalog (`catalog_items`)

```typescript
interface CatalogItem {
  id: string;
  sku: string;
  type: 'base_cabinet' | 'wall_cabinet' | 'tall_cabinet' | 'panel' | 'worktop_module' | 'appliance' | 'accessory';
  description: string;
  width_mm: number | null;
  height_mm: number | null;
  depth_mm: number | null;
  list_price_net: number;
  dealer_price_net: number | null;
  default_markup_pct: number;
  tax_group_id: string;
  pricing_group_id: string | null;
}
```

### Sprint 20 - Herstellerkatalog & Schrankkonfigurator (Light)

DB-Tabellen: `manufacturers`, `catalog_articles`, `article_options`, `article_variants`, `article_prices`, `article_rules`  
Domain-Typen: `Manufacturer`, `CatalogArticle`, `ArticleOption`, `ArticleVariant`, `ArticlePrice`, `ArticleRule`

#### `Manufacturer`

```typescript
interface Manufacturer {
  id: string;
  name: string;
  code: string;  // Kurzcode
  country: string | null;
  created_at: string;
  updated_at: string;
}
```

#### `CatalogArticle` und Varianten

```typescript
interface CatalogArticle {
  id: string;
  manufacturer_id: string;
  article_number: string;
  name: string;
  base_type: 'cabinet' | 'appliance' | 'accessory' | 'worktop' | 'plinth' | 'panel';
  default_width_mm: number | null;
  default_height_mm: number | null;
  default_depth_mm: number | null;
  option_schema_id: string | null; // verweist auf konfigurierbare Optionen
  is_active: boolean;
}

interface ArticleOption {
  id: string;
  article_id: string;
  code: string;                        // z.B. "WIDTH", "FRONT", "HANDLE"
  label: string;
  type: 'enum' | 'number' | 'boolean';
  allowed_values: string[] | null;     // bei enum
  min_value: number | null;            // bei number
  max_value: number | null;            // bei number
  step: number | null;                 // bei number
}

interface ArticleVariant {
  id: string;
  article_id: string;
  option_values: Record<string, string>; // Option-Code -> Wert
  effective_width_mm: number | null;
  effective_height_mm: number | null;
  effective_depth_mm: number | null;
  is_default: boolean;
}
```

#### Preise & Regeln

```typescript
interface ArticlePrice {
  id: string;
  variant_id: string;
  price_list_id: string;
  list_price_net: number;
  dealer_price_net: number | null;
  valid_from: string | null;
  valid_to: string | null;
}

interface ArticleRule {
  id: string;
  article_id: string;
  rule_type: 'placement' | 'combination' | 'dimension' | 'compatibility';
  code: string;                // z.B. "MIN_DISTANCE_TO_WALL", "INCOMPATIBLE_WITH_HANDLE"
  message: string;
  params: Record<string, string | number | boolean>;
}
```

#### Schrankkonfigurator (Light)

```typescript
interface CabinetConfiguration {
  article_id: string;
  selected_options: Record<string, string>; // Option-Code -> Wert
}

interface ConfiguredCabinetResult {
  variant_id: string;
  effective_dimensions: { width_mm: number; height_mm: number; depth_mm: number };
  price: ArticlePrice;
}
```

Der Schrankkonfigurator nimmt eine `CabinetConfiguration`, wählt eine passende `ArticleVariant` und liefert `ConfiguredCabinetResult`, das in `CabinetInstance` und BOM überführt wird.

---

## Teil 3 - Preismodell

### Grundprinzip

Preise werden deterministisch pro Projekt berechnet:  
`POST /projects/:id/calculate-pricing` -> immer dasselbe Ergebnis für denselben Zustand.

### 9-stufige Preislogik

```text
1. list_price_net          Listenpreis
2. + variant_surcharge     Varianten-/Mehrpreise
3. + object_surcharges     Montage, Sondermaß ...
4. - position_discount_pct Positionsrabatt
5. - group_discount_pct    Warengruppenrabatt
6. - global_discount_pct   Globalrabatt
7. + extra_costs           Fracht, Montage pauschal
8. + VAT                   MwSt aus tax_group_id
9.   Rundung               kaufmännisch auf 0,01 EUR
```

### Kernobjekte

```typescript
interface BOMLine {
  id: string;
  project_id: string;
  type: BOMLineType;
  catalog_item_id: string | null;
  article_id?: string | null;          // Phase 2: Herstellerartikel
  article_variant_id?: string | null;  // Phase 2: konkrete Variante
  description: string;
  qty: number;
  unit: 'stk' | 'm' | 'm2' | 'pauschal';
  list_price_net: number;
  variant_surcharge: number;
  object_surcharges: number;
  position_discount_pct: number;
  pricing_group_discount_pct: number;
  line_net_after_discounts: number;
  tax_group_id: string;
  tax_rate: number;
  is_generated: boolean;              // Phase 2: durch Automatismen erzeugt
  source: 'manual' | 'auto_completion' | 'import';
}

type BOMLineType =
  | 'cabinet'
  | 'appliance'
  | 'accessory'
  | 'surcharge'
  | 'assembly'
  | 'freight'
  | 'extra'
  | 'worktop'
  | 'plinth'
  | 'panel';

interface PriceSummary {
  project_id: string;
  calculated_at: string;
  total_list_price_net: number;
  total_variant_surcharges: number;
  total_object_surcharges: number;
  total_position_discounts: number;
  total_group_discounts: number;
  total_global_discount: number;
  total_extra_costs: number;
  subtotal_net: number;
  vat_amount: number;
  total_gross: number;
  dealer_price_net: number;
  contribution_margin_net: number;
  markup_pct: number;
  bom_lines: BOMLine[];
}

interface GlobalDiscountSettings {
  project_id: string;
  global_discount_pct: number;
  extra_costs: ExtraCost[];
}

interface ExtraCost {
  id: string;
  type: 'freight' | 'assembly' | 'other';
  description: string;
  amount_net: number;
}
```

### API-Contracts

```text
POST /projects/:id/calculate-pricing  -> PriceSummary
GET  /projects/:id/price-summary      -> PriceSummary
PUT  /projects/:id/discount-settings  -> GlobalDiscountSettings
```

---

## Teil 4 - Sprint 21 - Automatismen (Langteile, Zubehör, Auto-Vervollständigung)

### Grundprinzip

Automatisch generierte Langteile (Arbeitsplatte, Sockel, Wange) und Standardzubehör werden als BOM-Linien mit Markierung erzeugt.  
Die Berechnung muss deterministisch und wiederholbar sein.

### `AutoCompletionContext` & Service-Schnittstelle

```typescript
interface AutoCompletionContext {
  project_id: string;
  room_id: string;
  cabinets: CabinetInstance[];
  appliances: ApplianceInstance[];
  existing_bom_lines: BOMLine[];
}

interface AutoCompletionResult {
  generated_bom_lines: BOMLine[];
  removed_bom_line_ids: string[];
}

interface AutoCompletionService {
  run(context: AutoCompletionContext): AutoCompletionResult;
}
```

Der Service erzeugt neue `BOMLine`-Einträge (`is_generated = true`, `source = 'auto_completion'`) und entfernt veraltete generierte Linien.

---

## Teil 5 - Angebotsmodell

### Grundprinzip

Ein Angebot wird aus Projekt + `PriceSummary` erzeugt.  
Angebote sind versioniert und nach Erstellung schreibgeschützt - Änderungen erzeugen eine neue Version.

### Workflow

```text
Projekt (geplant + berechnet)
  -> POST /projects/:id/create-quote
    -> Quote (draft)
      -> sent -> accepted / rejected / expired
```

### Kernobjekte

```typescript
interface Quote {
  id: string;
  project_id: string;
  version: number;
  quote_number: string;           // z.B. "ANG-2026-0042"
  status: QuoteStatus;
  valid_until: string;
  free_text: string | null;
  footer_text: string | null;
  price_summary: PriceSummary;    // Snapshot
  items: QuoteItem[];
  created_at: string;
  created_by: string;
  pdf_url: string | null;
}

type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired';

interface QuoteItem {
  id: string;
  quote_id: string;
  position: number;
  type: BOMLineType;
  description: string;
  qty: number;
  unit: string;
  unit_price_net: number;
  line_net: number;
  tax_rate: number;
  line_gross: number;
  notes: string | null;
  show_on_quote: boolean;
}
```

### PDF-Struktur

- Kopf (Logo, Firmendaten, Angebotsnummer, Gültig-bis)
- Freitext oben
- Positionstabelle (Nr. | Bezeichnung | Menge | EP netto | GP netto)
- Summenblock (netto / MwSt / brutto)
- Freitext unten / Fußnote

### API-Contracts

```text
POST /projects/:id/create-quote       -> Quote
GET  /quotes/:id                      -> Quote
GET  /projects/:id/quotes             -> Quote[]
PATCH /quotes/:id/status              -> Quote
POST /quotes/:id/export-pdf           -> { pdf_url }
```

---

## Teil 6 - Sprint 22 - Prüf-Engine v2 ("Protect"-Niveau)

### Grundprinzip

Die Prüf-Engine kapselt Planungsregeln, erzeugt strukturierte Berichte und ist konfigurierbar.  
Sie verbindet geometrische Checks mit Katalog-, Vollständigkeits- und Ergonomieregeln.

DB-Tabellen: `rule_definitions`, `rule_runs`, `rule_violations`  
Domain-Typen: `RuleDefinition`, `RuleRun`, `RuleViolationRecord`

### Datenmodell

```typescript
type RuleSeverity = 'error' | 'warning' | 'hint';

interface RuleDefinition {
  id: string;
  code: string;               // z.B. "COLLISION", "MISSING_WORKTOP"
  category: 'geometry' | 'height' | 'clearance' | 'ergonomy' | 'completeness' | 'catalog';
  severity: RuleSeverity;
  message_template: string;   // z.B. "{object} kollidiert mit {other}"
  params_schema: Record<string, string>; // optionale Parametertypen
  is_active: boolean;
}

interface RuleRun {
  id: string;
  project_id: string;
  triggered_by: string;       // user_id oder "system"
  created_at: string;
  summary: {
    errors: number;
    warnings: number;
    hints: number;
  };
}

interface RuleViolationRecord {
  id: string;
  rule_run_id: string;
  rule_definition_id: string;
  severity: RuleSeverity;
  code: string;
  message: string;
  affected_ids: string[];
}
```

`RuleViolation` aus Teil 1 referenziert optional `rule_definition_id`, wenn die Verletzung im Kontext eines `RuleRun` erzeugt wurde.

### Service-Schnittstelle

```typescript
interface RuleEngineContext {
  project_id: string;
  rooms: Room[];
  cabinets: CabinetInstance[];
  appliances: ApplianceInstance[];
  bom_lines: BOMLine[];
}

interface RuleEngineResult {
  rule_run: RuleRun;
  violations: RuleViolationRecord[];
}

interface RuleEngine {
  run(context: RuleEngineContext): RuleEngineResult;
}
```

---

## Teil 7 - Sprint 23 - Multi-Tenant / BI-Light

### Grundprinzip

Mehrere Studios/Filialen teilen sich die Plattform, aber nicht die Daten.  
Alle fachlichen Entitäten sind einem Tenant und optional einer Branch zugeordnet.

DB-Tabellen: `tenants`, `branches` plus `tenant_id` und optional `branch_id` in fachlichen Tabellen  
Domain-Typen: `Tenant`, `Branch`, `ProjectKpiSnapshot`, `KpiQuery`

### Tenant und Branch

```typescript
interface Tenant {
  id: string;
  name: string;
  code: string;
  created_at: string;
  updated_at: string;
}

interface Branch {
  id: string;
  tenant_id: string;
  name: string;
  code: string;
  created_at: string;
  updated_at: string;
}

interface User {
  id: string;
  tenant_id: string;
  branch_id: string | null;
  email: string;
  display_name: string;
  role: 'admin' | 'planner' | 'viewer';
  created_at: string;
}
```

Alle Kernobjekte (`Project`, `Room`, `Catalog`, `PriceList`, `Quote`, `ImportJob`, `RenderJob`, ...) tragen ab Sprint 23 eine `tenant_id` und ggf. `branch_id`.

### Reporting-/KPI-Modell (Light)

```typescript
interface ProjectKpiSnapshot {
  project_id: string;
  tenant_id: string;
  branch_id: string | null;
  created_at: string;
  quote_status: QuoteStatus | null;
  gross_total: number | null;
  main_product_group: string | null;
}

interface KpiQuery {
  tenant_id: string;
  branch_id?: string | null;
  from?: string;
  to?: string;
}
```

KPI-Endpunkte aggregieren z.B.:

- Anzahl Angebote, Conversion, Umsatz je Zeitraum
- Verteilung nach Warengruppen oder Geräten

---

## Teil 8 - Sprint 24 - Online-Webplaner MVP + Handover

### Grundprinzip

Der Webplaner erzeugt "leichte" Lead-Projekte, die später in vollwertige Projekte im Profi-Editor überführt werden.

Domain-Typen: `LeadProject`, `LeadPlanningPayload`, `LeadPromotionResult`

### `LeadProject`

```typescript
interface LeadProject {
  id: string;
  tenant_id: string;
  branch_id: string | null;
  lead_status: 'new' | 'contacted' | 'qualified' | 'converted' | 'archived';
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  source: 'web_planner' | 'manual' | 'import';
  created_at: string;
  updated_at: string;
  estimated_value_gross: number | null;
  retention_until: string | null;
  payload: LeadPlanningPayload;  // vereinfachter Grundriss + Möbelliste
}

interface LeadPlanningPayload {
  room_outline: {
    width_mm: number;
    depth_mm: number;
    niches?: { x_mm: number; y_mm: number; width_mm: number; depth_mm: number }[];
  };
  cabinets: Array<{
    sku_or_article_id: string;
    position: 'left_wall' | 'right_wall' | 'top_wall' | 'bottom_wall' | 'island';
    width_mm: number;
  }>;
}
```

### Handover

```typescript
interface LeadPromotionResult {
  lead_project_id: string;
  new_project_id: string;
}
```

Ein Promotion-Use-Case übernimmt `LeadProject` + `LeadPlanningPayload` und erzeugt ein reguläres `Project` inkl. `Room`, `CabinetInstance` und initialer BOM-/Preis-Struktur.

---

## Designprinzipien

- Domänenlogik zentral im Domain-Layer: Geometrie-, Prüf- und Preisinvarianten werden in reinen Funktionen/Typen modelliert und nicht über das Framework verteilt.
- Always-valid Domain Objects: Wo möglich, verhindern Typen und Konstruktoren ungültige Zustände (z.B. Polygonregeln, positive Längen, konsistente Rabattschritte).
- Evolvierbarkeit: Phase-2-Modelle (Herstellerkatalog, Prüf-Engine, Multi-Tenant, Webplaner) erweitern bestehende Strukturen additiv, statt sie zu brechen.
