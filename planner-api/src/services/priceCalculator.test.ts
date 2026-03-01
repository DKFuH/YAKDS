import { describe, expect, it } from 'vitest';

import type { BOMLine } from '../../../shared-schemas/src/types.js';
import { applyDiscount, calcLineNet, calculatePriceSummary } from './priceCalculator.js';

function createLine(overrides: Partial<BOMLine> = {}): BOMLine {
  return {
    id: 'line-1',
    project_id: 'project-12',
    type: 'cabinet',
    catalog_item_id: 'cab-60',
    description: 'Cabinet',
    qty: 1,
    unit: 'stk',
    list_price_net: 1000,
    dealer_price_net: 700,
    variant_surcharge: 0,
    object_surcharges: 0,
    position_discount_pct: 0,
    pricing_group_discount_pct: 0,
    line_net_after_discounts: 1000,
    tax_group_id: 'tax-19',
    tax_rate: 0.19,
    ...overrides
  };
}

describe('priceCalculator', () => {
  it('applies discounts as pure percentages', () => {
    expect(applyDiscount(1000, 10)).toBe(900);
  });

  it('calculates line net without discounts', () => {
    expect(calcLineNet(createLine())).toBe(1000);
  });

  it('returns gross = net * 1.19 when no discounts are applied', () => {
    const summary = calculatePriceSummary([createLine()], {
      project_id: 'project-12',
      global_discount_pct: 0,
      extra_costs: []
    });

    expect(summary.subtotal_net).toBe(1000);
    expect(summary.vat_amount).toBe(190);
    expect(summary.total_gross).toBe(1190);
    expect(summary.components).toHaveLength(9);
  });

  it('keeps extra costs and VAT even with a 100 percent global discount', () => {
    const summary = calculatePriceSummary([createLine()], {
      project_id: 'project-12',
      global_discount_pct: 100,
      extra_costs: [
        {
          id: 'freight-1',
          label: 'Fracht',
          amount_net: 89,
          tax_group_id: 'tax-19',
          type: 'freight'
        }
      ]
    });

    expect(summary.subtotal_net).toBe(89);
    expect(summary.vat_amount).toBeCloseTo(16.91, 10);
    expect(summary.total_gross).toBe(105.91);
  });

  it('supports multiple tax groups', () => {
    const summary = calculatePriceSummary(
      [
        createLine({ id: 'line-1', tax_group_id: 'tax-19', tax_rate: 0.19, list_price_net: 100 }),
        createLine({ id: 'line-2', tax_group_id: 'tax-7', tax_rate: 0.07, list_price_net: 200 })
      ],
      {
        project_id: 'project-12',
        global_discount_pct: 0,
        extra_costs: []
      }
    );

    expect(summary.vat_amount).toBeCloseTo(33, 10);
    expect(summary.total_gross).toBe(333);
  });

  it('rounds only at the end of the calculation', () => {
    const summary = calculatePriceSummary(
      [createLine({ list_price_net: 99.995, dealer_price_net: 50.5 })],
      {
        project_id: 'project-12',
        global_discount_pct: 0,
        extra_costs: []
      }
    );

    expect(summary.total_gross).toBe(118.99);
  });
});
