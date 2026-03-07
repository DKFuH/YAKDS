/**
 * Property-based Test Suite – Pricing Rounding & Arithmetic
 *
 * Nutzt fast-check um strukturelle Eigenschaften der Pricing-Logik zu verifizieren:
 * - Keine "Free Money": Rabatte reduzieren niemals den Preis unterhalb 0.
 * - Monotonie: mehr Rabatt → kleinerer oder gleicher Nettobetrag.
 * - Konsistenz: total_gross stimmt mit subtotal_net + vat_amount überein (Rundung ±0.01).
 * - Contribution Margin Additivität: CM = Summe(line_sell - line_dealer).
 */

import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';

import { applyDiscount, calcLineNet, calculatePriceSummary } from '@planner-api/services/priceCalculator.js';
import type { BOMLine, GlobalDiscountSettings } from '@okp/shared-schemas';

// ── Arbitraries ──────────────────────────────────────────────────────────────

/** Arbitrary für einen realistischen Nettopreis (0 .. 50 000 €) */
const priceArb = fc.float({ min: 0, max: 50_000, noNaN: true, noDefaultInfinity: true });

/** Arbitrary für einen gültigen Rabatt-Prozentsatz (0 .. 100) */
const pctArb = fc.float({ min: 0, max: 100, noNaN: true, noDefaultInfinity: true });

/** Arbitrary für einen Rabatt-Prozentsatz der auch außerhalb [0,100] liegen kann (Clamp-Test) */
const uncheckedPctArb = fc.float({ min: -10, max: 110, noNaN: true, noDefaultInfinity: true });

/** Arbitrary für eine BOMLine mit sinnvollen Werten */
const bomLineArb: fc.Arbitrary<BOMLine> = fc
  .record({
    listPrice: priceArb,
    dealerPrice: priceArb,
    variantSurcharge: fc.float({ min: 0, max: 500, noNaN: true, noDefaultInfinity: true }),
    objectSurcharges: fc.float({ min: 0, max: 500, noNaN: true, noDefaultInfinity: true }),
    posDiscount: pctArb,
    groupDiscount: pctArb,
    taxRate: fc.constantFrom(0.07, 0.19, 0.20, 0),
    qty: fc.integer({ min: 1, max: 10 }),
  })
  .map(({ listPrice, dealerPrice, variantSurcharge, objectSurcharges, posDiscount, groupDiscount, taxRate, qty }) => {
    const gross = (listPrice + variantSurcharge + objectSurcharges) * qty;
    const afterPos = gross * (1 - posDiscount / 100);
    const afterGroup = afterPos * (1 - groupDiscount / 100);
    return {
      id: 'prop-line',
      project_id: 'prop-proj',
      type: 'cabinet' as const,
      catalog_item_id: 'cat-prop',
      description: 'Property test line',
      qty,
      unit: 'stk' as const,
      list_price_net: listPrice,
      dealer_price_net: dealerPrice,
      variant_surcharge: variantSurcharge,
      object_surcharges: objectSurcharges,
      position_discount_pct: posDiscount,
      pricing_group_discount_pct: groupDiscount,
      line_net_after_discounts: afterGroup,
      tax_group_id: 'tax-prop',
      tax_rate: taxRate,
    } satisfies BOMLine;
  });

function makeSettings(globalPct = 0): GlobalDiscountSettings {
  return { project_id: 'prop-proj', global_discount_pct: globalPct, extra_costs: [] };
}

// ════════════════════════════════════════════════════════════════════════════
// Property Tests
// ════════════════════════════════════════════════════════════════════════════

describe('[PROPERTY] applyDiscount – No Free Money', () => {
  it('PROP-01: applyDiscount(x, pct) ∈ [0, x] für x ≥ 0 und pct ∈ [0, 100]', () => {
    fc.assert(
      fc.property(priceArb, pctArb, (price, pct) => {
        const result = applyDiscount(price, pct);
        expect(result).toBeGreaterThanOrEqual(0);
        expect(result).toBeLessThanOrEqual(price + Number.EPSILON * price);
      }),
      { numRuns: 1000 },
    );
  });

  it('PROP-02: Discount-Clamp – auch pct außerhalb [0,100] führt nie zu negativem Ergebnis', () => {
    fc.assert(
      fc.property(priceArb, uncheckedPctArb, (price, pct) => {
        const result = applyDiscount(price, pct);
        expect(result).toBeGreaterThanOrEqual(0);
      }),
      { numRuns: 1000 },
    );
  });

  it('PROP-03: applyDiscount ist monoton – mehr Rabatt → kleiner oder gleicher Betrag', () => {
    fc.assert(
      fc.property(
        priceArb,
        fc.tuple(pctArb, pctArb).map(([a, b]) => (a <= b ? [a, b] : [b, a]) as [number, number]),
        (price, [lower, higher]) => {
          const resultLower = applyDiscount(price, lower);
          const resultHigher = applyDiscount(price, higher);
          expect(resultHigher).toBeLessThanOrEqual(resultLower + 1e-9);
        },
      ),
      { numRuns: 1000 },
    );
  });
});

describe('[PROPERTY] calcLineNet – Arithmetic Consistency', () => {
  it('PROP-04: calcLineNet(line) ≤ Brutto-Listenpreis (Rabatte senken Preis)', () => {
    fc.assert(
      fc.property(bomLineArb, (line) => {
        const gross = (line.list_price_net + line.variant_surcharge + line.object_surcharges) * line.qty;
        const net = calcLineNet(line);
        expect(net).toBeLessThanOrEqual(gross + 1e-9);
        expect(net).toBeGreaterThanOrEqual(0);
      }),
      { numRuns: 500 },
    );
  });
});

describe('[PROPERTY] calculatePriceSummary – Total Consistency', () => {
  it('PROP-05: total_gross ≈ subtotal_net + vat_amount (Differenz ≤ 0.01 durch Rundung)', () => {
    fc.assert(
      fc.property(
        fc.array(bomLineArb, { minLength: 1, maxLength: 5 }),
        pctArb,
        (lines, globalPct) => {
          const summary = calculatePriceSummary(lines, makeSettings(globalPct));
          const diff = Math.abs(summary.total_gross - (summary.subtotal_net + summary.vat_amount));
          expect(diff).toBeLessThanOrEqual(0.01);
        },
      ),
      { numRuns: 300 },
    );
  });

  it('PROP-06: subtotal_net ≥ 0 für alle validen Inputs (keine negativen Gesamt-Nettosummen)', () => {
    fc.assert(
      fc.property(
        fc.array(bomLineArb, { minLength: 0, maxLength: 10 }),
        pctArb,
        (lines, globalPct) => {
          const summary = calculatePriceSummary(lines, makeSettings(globalPct));
          expect(summary.subtotal_net).toBeGreaterThanOrEqual(0);
        },
      ),
      { numRuns: 300 },
    );
  });

  it('PROP-07: Contribution Margin = subtotal_net - dealer_price_net', () => {
    fc.assert(
      fc.property(
        fc.array(bomLineArb, { minLength: 1, maxLength: 5 }),
        (lines) => {
          const summary = calculatePriceSummary(lines, makeSettings(0));
          const expected = summary.subtotal_net - summary.dealer_price_net;
          expect(summary.contribution_margin_net).toBeCloseTo(expected, 6);
        },
      ),
      { numRuns: 300 },
    );
  });

  it('PROP-08: total_gross steigt monoton mit höherem Listenpreis (ceteris paribus)', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: 10_000, noNaN: true, noDefaultInfinity: true }),
        fc.float({ min: 0, max: 10_000, noNaN: true, noDefaultInfinity: true }),
        (priceA, priceB) => {
          const makeLines = (p: number) => [
            {
              id: 'l1',
              project_id: 'p',
              type: 'cabinet' as const,
              catalog_item_id: 'c1',
              description: 'd',
              qty: 1,
              unit: 'stk' as const,
              list_price_net: p,
              dealer_price_net: 0,
              variant_surcharge: 0,
              object_surcharges: 0,
              position_discount_pct: 0,
              pricing_group_discount_pct: 0,
              line_net_after_discounts: p,
              tax_group_id: 'tx',
              tax_rate: 0.19,
            } satisfies BOMLine,
          ];

          const summaryA = calculatePriceSummary(makeLines(priceA), makeSettings(0));
          const summaryB = calculatePriceSummary(makeLines(priceB), makeSettings(0));

          if (priceA <= priceB) {
            expect(summaryA.total_gross).toBeLessThanOrEqual(summaryB.total_gross + 1e-6);
          } else {
            expect(summaryA.total_gross).toBeGreaterThanOrEqual(summaryB.total_gross - 1e-6);
          }
        },
      ),
      { numRuns: 500 },
    );
  });
});
