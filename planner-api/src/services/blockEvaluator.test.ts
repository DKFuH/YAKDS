import { describe, expect, it } from 'vitest';

import type { BlockDefinition, PriceSummary } from '../../../shared-schemas/src/types.js';
import { evaluateBlock, findBestBlock } from './blockEvaluator.js';

const priceSummary: PriceSummary = {
  project_id: 'project-17',
  calculated_at: '2026-03-01T00:00:00.000Z',
  total_list_price_net: 12000,
  total_variant_surcharges: 0,
  total_object_surcharges: 0,
  total_position_discounts: 0,
  total_group_discounts: 0,
  total_global_discount: 0,
  total_extra_costs: 0,
  subtotal_net: 10000,
  vat_amount: 1900,
  total_gross: 11900,
  dealer_price_net: 7000,
  contribution_margin_net: 3000,
  markup_pct: 42.8571428571,
  bom_lines: [],
  components: [],
  total_purchase_price_net: 7000,
  total_sell_price_net: 10000,
  total_points: 320
};

describe('blockEvaluator', () => {
  it('evaluates blocks against the matching tier', () => {
    const block: BlockDefinition = {
      id: 'block-1',
      name: 'EK Block',
      basis: 'purchase_price',
      tiers: [
        { min_value: 5000, discount_pct: 2 },
        { min_value: 6500, discount_pct: 4 }
      ]
    };

    expect(evaluateBlock(priceSummary, block)).toEqual({
      block_id: 'block-1',
      block_name: 'EK Block',
      basis_value: 7000,
      applied_discount_pct: 4,
      price_advantage_net: 280,
      recommended: false
    });
  });

  it('returns zero discount when no tier applies', () => {
    const block: BlockDefinition = {
      id: 'block-2',
      name: 'Punkte Block',
      basis: 'points',
      tiers: [{ min_value: 500, discount_pct: 10 }]
    };

    expect(evaluateBlock(priceSummary, block).applied_discount_pct).toBe(0);
  });

  it('finds the best block among multiple programs', () => {
    const blocks: BlockDefinition[] = [
      {
        id: 'block-1',
        name: 'EK Block',
        basis: 'purchase_price',
        tiers: [{ min_value: 6500, discount_pct: 4 }]
      },
      {
        id: 'block-2',
        name: 'VK Block',
        basis: 'sell_price',
        tiers: [{ min_value: 9000, discount_pct: 5 }]
      },
      {
        id: 'block-3',
        name: 'Punkte Block',
        basis: 'points',
        tiers: [{ min_value: 300, discount_pct: 3 }]
      }
    ];

    const best = findBestBlock(priceSummary, blocks);

    expect(best.block_id).toBe('block-2');
    expect(best.price_advantage_net).toBe(500);
    expect(best.recommended).toBe(true);
  });
});
