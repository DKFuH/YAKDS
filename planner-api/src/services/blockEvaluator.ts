import type {
  BlockDefinition,
  BlockEvaluation,
  PriceSummary
} from '@okp/shared-schemas';

function getBasisValue(priceSummary: PriceSummary, basis: BlockDefinition['basis']): number {
  switch (basis) {
    case 'purchase_price':
      return priceSummary.total_purchase_price_net ?? priceSummary.dealer_price_net;
    case 'sell_price':
      return priceSummary.total_sell_price_net ?? priceSummary.subtotal_net;
    case 'points':
      return priceSummary.total_points ?? 0;
    default:
      return 0;
  }
}

function getAppliedDiscountPct(basisValue: number, block: BlockDefinition): number {
  const matchingTier = [...block.tiers]
    .sort((left, right) => left.min_value - right.min_value)
    .filter((tier) => basisValue >= tier.min_value)
    .pop();

  return matchingTier?.discount_pct ?? 0;
}

export function evaluateBlock(priceSummary: PriceSummary, block: BlockDefinition): BlockEvaluation {
  const basisValue = getBasisValue(priceSummary, block.basis);
  const appliedDiscountPct = getAppliedDiscountPct(basisValue, block);
  const priceAdvantageNet = basisValue * (appliedDiscountPct / 100);

  return {
    block_id: block.id,
    block_name: block.name,
    basis_value: basisValue,
    applied_discount_pct: appliedDiscountPct,
    price_advantage_net: priceAdvantageNet,
    recommended: false
  };
}

export function findBestBlock(priceSummary: PriceSummary, blocks: BlockDefinition[]): BlockEvaluation {
  if (blocks.length === 0) {
    throw new Error('At least one block definition is required.');
  }

  const evaluations = blocks.map((block) => evaluateBlock(priceSummary, block));
  const best = evaluations.reduce((currentBest, candidate) =>
    candidate.price_advantage_net > currentBest.price_advantage_net ? candidate : currentBest
  );

  return {
    ...best,
    recommended: true
  };
}
