/**
 * Complete Logic Test Suite – YAKDS
 *
 * Validates fachliche Invarianten und deterministisches Verhalten für die fünf
 * wichtigsten Domain-Flows:
 *   Flow 1 – Placement Validation
 *   Flow 2 – BOM Calculation
 *   Flow 3 – Pricing / Discount Chain
 *   Flow 4 – Block Evaluation
 *   Flow 5 – BI Aggregation
 *
 * P0 (8 Tests)  – brechen Build bei Fehler
 * P1 (12 Tests) – wichtige Geschäftslogik
 */

import { describe, expect, it } from 'vitest';

// ── Domain modules ────────────────────────────────────────────────────────────
import { validatePlacement } from '@okp/shared-schemas';
import type { Opening, Placement, WallSegment } from '@okp/shared-schemas';
import { calculateBOM, sumBOMLines } from '@planner-api/services/bomCalculator.js';
import { applyDiscount, calcLineNet, calculatePriceSummary } from '@planner-api/services/priceCalculator.js';
import type { BOMLine, GlobalDiscountSettings, ProjectSnapshot } from '@okp/shared-schemas';
import { evaluateBlock, findBestBlock } from '@planner-api/services/blockEvaluator.js';
import type { BlockDefinition, PriceSummary } from '@okp/shared-schemas';
import {
  aggregateQuoteKPIs,
  calculateConversionRatio,
  getProductPerformance,
} from '@planner-api/services/biAggregator.js';
import type { DateRange, Lead, QuoteItem, QuoteSnapshot, WonQuote } from '@planner-api/services/biAggregator.js';

// ── Test helpers ──────────────────────────────────────────────────────────────

function makeWall(length_mm = 4000): WallSegment {
  return { id: 'wall-A', length_mm };
}

function makePlacement(overrides: Partial<Placement> = {}): Placement {
  return {
    id: 'p1',
    catalog_item_id: 'cat-001',
    wall_id: 'wall-A',
    offset_mm: 200,
    width_mm: 600,
    depth_mm: 580,
    height_mm: 720,
    flags: {
      requires_customization: false,
      height_variant: null,
      labor_surcharge: false,
      special_trim_needed: false,
    },
    ...overrides,
  };
}

function makeBOMLine(overrides: Partial<BOMLine> = {}): BOMLine {
  return {
    id: 'bom-1',
    project_id: 'proj-1',
    type: 'cabinet',
    catalog_item_id: 'cat-001',
    description: 'Unterschrank 60',
    qty: 1,
    unit: 'stk',
    list_price_net: 500,
    dealer_price_net: 300,
    variant_surcharge: 0,
    object_surcharges: 0,
    position_discount_pct: 0,
    pricing_group_discount_pct: 0,
    line_net_after_discounts: 500,
    tax_group_id: 'tax-19',
    tax_rate: 0.19,
    ...overrides,
  };
}

function makeGlobalSettings(overrides: Partial<GlobalDiscountSettings> = {}): GlobalDiscountSettings {
  return {
    project_id: 'proj-1',
    global_discount_pct: 0,
    extra_costs: [],
    ...overrides,
  };
}

function baseProject(): ProjectSnapshot {
  return {
    id: 'proj-1',
    cabinets: [],
    appliances: [],
    accessories: [],
    priceListItems: [
      { catalog_item_id: 'cat-001', list_price_net: 500, dealer_price_net: 300 },
      { catalog_item_id: 'app-001', list_price_net: 1200, dealer_price_net: 800 },
    ],
    taxGroups: [{ id: 'tax-19', name: 'DE 19%', tax_rate: 0.19 }],
    quoteSettings: { freight_flat_rate: 89, assembly_rate_per_item: 45 },
  };
}

function makePriceSummary(overrides: Partial<PriceSummary> = {}): PriceSummary {
  return {
    project_id: 'proj-1',
    calculated_at: '2026-01-01T00:00:00.000Z',
    total_list_price_net: 1000,
    total_variant_surcharges: 0,
    total_object_surcharges: 0,
    total_position_discounts: 0,
    total_group_discounts: 0,
    total_global_discount: 0,
    total_extra_costs: 0,
    subtotal_net: 1000,
    vat_amount: 190,
    total_gross: 1190,
    dealer_price_net: 700,
    contribution_margin_net: 300,
    markup_pct: 42.86,
    bom_lines: [],
    components: [],
    total_purchase_price_net: 700,
    total_sell_price_net: 1000,
    ...overrides,
  };
}

// ════════════════════════════════════════════════════════════════════════════
// P0 TESTS – kritische Invarianten (brechen Build bei Fehler)
// ════════════════════════════════════════════════════════════════════════════

describe('[P0] Flow 1 – Placement Validation: Determinism', () => {
  it('P0-01: gleicher Input liefert identisches Ergebnis (Determinismus)', () => {
    const wall = makeWall();
    const p = makePlacement();
    const existing: Placement[] = [];
    const openings: Opening[] = [];

    const result1 = validatePlacement(wall, p, existing, openings);
    const result2 = validatePlacement(wall, p, existing, openings);

    expect(result1).toEqual(result2);
  });

  it('P0-02: Placement exakt am Wandende (Boundary) ist gültig', () => {
    // offset + width == wall.length_mm  →  strictly inside (not exceeding)
    const wall = makeWall(1000);
    const p = makePlacement({ offset_mm: 400, width_mm: 600 });

    const result = validatePlacement(wall, p, [], []);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});

describe('[P0] Flow 1 – Placement Validation: Dimension Guards', () => {
  it('P0-03: negativer Offset wird abgelehnt', () => {
    const result = validatePlacement(makeWall(), makePlacement({ offset_mm: -1 }), [], []);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('offset'))).toBe(true);
  });

  it('P0-04: Breite ≤ 0 wird abgelehnt', () => {
    const result = validatePlacement(makeWall(), makePlacement({ width_mm: 0 }), [], []);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('width'))).toBe(true);
  });
});

describe('[P0] Flow 2 – BOM Calculation: Determinism & Structure', () => {
  it('P0-05: calculateBOM ist deterministisch (Struktur ohne IDs)', () => {
    const project = baseProject();
    project.cabinets = [
      {
        id: 'c1',
        catalog_item_id: 'cat-001',
        tax_group_id: 'tax-19',
        flags: { requires_customization: false, height_variant: null, labor_surcharge: false, special_trim_needed: false },
      },
    ];

    const lines1 = calculateBOM(project);
    const lines2 = calculateBOM(project);

    // UUIDs will differ; compare everything else
    const strip = (l: BOMLine) => ({ ...l, id: '' });
    expect(lines1.map(strip)).toEqual(lines2.map(strip));
  });

  it('P0-06: Frachtpauschale ist immer in der BOM enthalten', () => {
    const lines = calculateBOM(baseProject());

    const freightLines = lines.filter((l) => l.type === 'freight');
    expect(freightLines).toHaveLength(1);
    expect(freightLines[0].list_price_net).toBe(89);
  });
});

describe('[P0] Flow 3 – Pricing: Discount Invariants', () => {
  it('P0-07: applyDiscount(x, 0) === x  (Null-Rabatt ändert Preis nicht)', () => {
    expect(applyDiscount(1234.56, 0)).toBe(1234.56);
  });

  it('P0-08: applyDiscount(x, pct) ≥ 0 für alle pct ≥ 0 und x ≥ 0 (keine negativen Preise)', () => {
    const cases: [number, number][] = [
      [1000, 100],
      [500, 50],
      [0.01, 99.9],
      [0, 75],
    ];
    for (const [price, pct] of cases) {
      expect(applyDiscount(price, pct)).toBeGreaterThanOrEqual(0);
    }
  });
});

// ════════════════════════════════════════════════════════════════════════════
// P1 TESTS – wichtige Geschäftslogik
// ════════════════════════════════════════════════════════════════════════════

describe('[P1] Flow 2 – BOM Calculation: Surcharges & Assembly', () => {
  it('P1-01: special_trim_needed fügt genau eine Surcharge-Zeile hinzu', () => {
    const project = baseProject();
    project.cabinets = [
      {
        id: 'c1',
        catalog_item_id: 'cat-001',
        tax_group_id: 'tax-19',
        flags: { requires_customization: false, height_variant: null, labor_surcharge: false, special_trim_needed: true },
      },
    ];

    const lines = calculateBOM(project, { specialTrimSurchargeNet: 120 });
    const surcharges = lines.filter((l) => l.type === 'surcharge');

    expect(surcharges).toHaveLength(1);
    expect(surcharges[0].list_price_net).toBe(120);
  });

  it('P1-02: labor_surcharge fügt genau eine Assembly-Zeile hinzu', () => {
    const project = baseProject();
    project.cabinets = [
      {
        id: 'c2',
        catalog_item_id: 'cat-001',
        tax_group_id: 'tax-19',
        flags: { requires_customization: false, height_variant: null, labor_surcharge: true, special_trim_needed: false },
      },
    ];

    const lines = calculateBOM(project);
    const assemblyLines = lines.filter((l) => l.type === 'assembly');

    expect(assemblyLines).toHaveLength(1);
    expect(assemblyLines[0].list_price_net).toBe(45); // assembly_rate_per_item
  });

  it('P1-03: sumBOMLines – total_list_net stimmt mit manueller Summe überein', () => {
    const project = baseProject();
    project.cabinets = [
      {
        id: 'c1',
        catalog_item_id: 'cat-001',
        tax_group_id: 'tax-19',
        flags: { requires_customization: false, height_variant: null, labor_surcharge: false, special_trim_needed: false },
      },
    ];

    const lines = calculateBOM(project);
    const { total_list_net } = sumBOMLines(lines);
    const manual = lines.reduce((sum, l) => sum + l.qty * l.list_price_net + l.variant_surcharge + l.object_surcharges, 0);

    expect(total_list_net).toBeCloseTo(manual, 6);
  });

  it('P1-04: variant_surcharge wird bei der Berechnung von line_net berücksichtigt', () => {
    const line = makeBOMLine({ list_price_net: 1000, variant_surcharge: 150 });
    const net = calcLineNet(line);

    expect(net).toBe(1150);
  });
});

describe('[P1] Flow 3 – Pricing: Discount Chain Order', () => {
  it('P1-05: Rabattreihenfolge Positions → Waren → Global ist korrekt', () => {
    const line = makeBOMLine({
      list_price_net: 1000,
      position_discount_pct: 10,  // → 900
      pricing_group_discount_pct: 10,  // → 810
      line_net_after_discounts: 810,
    });

    const summary = calculatePriceSummary([line], makeGlobalSettings({ global_discount_pct: 10 }));

    // nach global 10%: 810 * 0.9 = 729
    expect(summary.subtotal_net).toBeCloseTo(729, 6);
    expect(summary.total_position_discounts).toBeCloseTo(100, 6);
    expect(summary.total_group_discounts).toBeCloseTo(90, 6);
    expect(summary.total_global_discount).toBeCloseTo(81, 6);
  });

  it('P1-06: contribution_margin_net = subtotal_net - dealer_price_net', () => {
    const line = makeBOMLine({ list_price_net: 1000, dealer_price_net: 700 });
    const summary = calculatePriceSummary([line], makeGlobalSettings());

    expect(summary.contribution_margin_net).toBeCloseTo(
      summary.subtotal_net - summary.dealer_price_net,
      6,
    );
  });

  it('P1-07: total_gross = subtotal_net + vat_amount (gerundet)', () => {
    const line = makeBOMLine({ list_price_net: 99.99 });
    const summary = calculatePriceSummary([line], makeGlobalSettings());

    expect(summary.total_gross).toBeCloseTo(summary.subtotal_net + summary.vat_amount, 1);
  });

  it('P1-08: Discount-Clamp bei >100% – kein negativer Preis', () => {
    const line = makeBOMLine({ position_discount_pct: 200 });
    const net = calcLineNet(line);

    expect(net).toBeGreaterThanOrEqual(0);
  });
});

describe('[P1] Flow 4 – Block Evaluation', () => {
  const block: BlockDefinition = {
    id: 'blk-gold',
    name: 'Gold',
    basis: 'sell_price',
    tiers: [
      { min_value: 0, discount_pct: 3 },
      { min_value: 10000, discount_pct: 5 },
      { min_value: 20000, discount_pct: 8 },
    ],
  };

  it('P1-09: korrekte Tier-Auswahl am Schwellenwert', () => {
    const summary = makePriceSummary({ total_sell_price_net: 10000, subtotal_net: 10000 });
    const result = evaluateBlock(summary, block);

    expect(result.applied_discount_pct).toBe(5);
    expect(result.price_advantage_net).toBe(500); // 10000 * 5%
  });

  it('P1-10: kein Tier passt → 0% Rabatt', () => {
    const emptyBlock: BlockDefinition = { ...block, tiers: [] };
    const summary = makePriceSummary({ total_sell_price_net: 5000, subtotal_net: 5000 });
    const result = evaluateBlock(summary, emptyBlock);

    expect(result.applied_discount_pct).toBe(0);
    expect(result.price_advantage_net).toBe(0);
  });

  it('P1-11: findBestBlock wählt den Block mit dem höchsten Preisvorteil', () => {
    const silverBlock: BlockDefinition = {
      id: 'blk-silver',
      name: 'Silver',
      basis: 'sell_price',
      tiers: [{ min_value: 0, discount_pct: 2 }],
    };

    const summary = makePriceSummary({ total_sell_price_net: 15000, subtotal_net: 15000 });
    const best = findBestBlock(summary, [silverBlock, block]);

    expect(best.block_id).toBe('blk-gold');
    expect(best.recommended).toBe(true);
  });
});

describe('[P1] Flow 5 – BI Aggregation', () => {
  const range: DateRange = {
    from: new Date('2026-01-01'),
    to: new Date('2026-03-31'),
  };

  it('P1-12: aggregateQuoteKPIs filtert nach Datumsbereich', () => {
    const quotes: QuoteSnapshot[] = [
      { id: 'q1', created_at: '2026-02-15', total_net: 5000, contribution_margin_net: 1500, owner: 'Alice' },
      { id: 'q2', created_at: '2025-12-01', total_net: 3000, contribution_margin_net: 900, owner: 'Bob' }, // outside range
    ];

    const summary = aggregateQuoteKPIs(quotes, range);

    expect(summary.quote_count).toBe(1);
    expect(summary.total_net).toBe(5000);
    expect(summary.average_net).toBe(5000);
  });

  it('P1-13: calculateConversionRatio: 0 Leads → 0 Ratio', () => {
    const ratio = calculateConversionRatio([], []);
    expect(ratio).toBe(0);
  });

  it('P1-14: calculateConversionRatio: alle Leads konvertiert → 1', () => {
    const leads: Lead[] = [{ id: 'lead-1' }, { id: 'lead-2' }];
    const wins: WonQuote[] = [{ id: 'quote-A', lead_id: 'lead-1' }, { id: 'quote-B', lead_id: 'lead-2' }];

    expect(calculateConversionRatio(leads, wins)).toBe(1);
  });

  it('P1-15: getProductPerformance aggregiert mehrere Items gleicher SKU korrekt', () => {
    const items: QuoteItem[] = [
      { sku: 'ABC', quantity: 2, revenue_net: 400, contribution_margin_net: 100 },
      { sku: 'ABC', quantity: 3, revenue_net: 600, contribution_margin_net: 150 },
    ];

    const result = getProductPerformance(items);
    const abc = result.get('ABC')!;

    expect(abc.quantity).toBe(5);
    expect(abc.revenue_net).toBe(1000);
    expect(abc.contribution_margin_net).toBe(250);
    expect(abc.average_unit_price_net).toBeCloseTo(200, 6);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Golden Master – Snapshot-Verifikation für definierte Szenarien
// ════════════════════════════════════════════════════════════════════════════

describe('Golden Master – BOM + Pricing Scenario', () => {
  it('GOLDEN-01: Standard-Küche mit 2 Schränken + Herd liefert stabiles Ergebnis', () => {
    const project = baseProject();
    project.cabinets = [
      {
        id: 'c-lower',
        catalog_item_id: 'cat-001',
        tax_group_id: 'tax-19',
        flags: { requires_customization: false, height_variant: null, labor_surcharge: false, special_trim_needed: false },
      },
    ];
    project.appliances = [
      {
        id: 'a-stove',
        catalog_item_id: 'app-001',
        tax_group_id: 'tax-19',
        flags: { requires_customization: false, height_variant: null, labor_surcharge: false, special_trim_needed: false },
      },
    ];

    const lines = calculateBOM(project);
    const { total_list_net, total_net_after_discounts } = sumBOMLines(lines);

    // 1 cabinet (500) + 1 appliance (1200) + 1 freight (89) = 1789
    expect(total_list_net).toBe(1789);
    expect(total_net_after_discounts).toBe(1789);

    const summary = calculatePriceSummary(lines, makeGlobalSettings({ project_id: 'proj-1' }));
    // 1789 * 1.19 = 2128.91
    expect(summary.total_gross).toBe(2128.91);
  });
});
