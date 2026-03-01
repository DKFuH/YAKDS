import type {
  BOMLine,
  GlobalDiscountSettings,
  PriceComponent,
  PriceSummary
} from '../../../shared-schemas/src/types.js';

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function applyDiscount(value: number, pct: number): number {
  return value * (1 - clampPercent(pct) / 100);
}

export function calcLineNet(line: BOMLine): number {
  const baseValue = (line.list_price_net + line.variant_surcharge + line.object_surcharges) * line.qty;
  const afterPositionDiscount = applyDiscount(baseValue, line.position_discount_pct);
  return applyDiscount(afterPositionDiscount, line.pricing_group_discount_pct);
}

function createComponent(step: number, label: string, value: number, cumulative: number): PriceComponent {
  return { step, label, value, cumulative };
}

export function calculatePriceSummary(
  lines: BOMLine[],
  settings: GlobalDiscountSettings
): PriceSummary {
  const totalListPriceNet = lines.reduce((sum, line) => sum + line.list_price_net * line.qty, 0);
  const totalVariantSurcharges = lines.reduce((sum, line) => sum + line.variant_surcharge * line.qty, 0);
  const totalObjectSurcharges = lines.reduce((sum, line) => sum + line.object_surcharges * line.qty, 0);
  const lineStepTotals = lines.map((line) => {
    const gross = (line.list_price_net + line.variant_surcharge + line.object_surcharges) * line.qty;
    const afterPosition = applyDiscount(gross, line.position_discount_pct);
    const afterGroup = applyDiscount(afterPosition, line.pricing_group_discount_pct);

    return {
      line,
      gross,
      positionDiscount: gross - afterPosition,
      groupDiscount: afterPosition - afterGroup,
      afterGroup
    };
  });

  const totalPositionDiscounts = lineStepTotals.reduce((sum, item) => sum + item.positionDiscount, 0);
  const totalGroupDiscounts = lineStepTotals.reduce((sum, item) => sum + item.groupDiscount, 0);
  const preGlobalNet = lineStepTotals.reduce((sum, item) => sum + item.afterGroup, 0);
  const totalGlobalDiscount = preGlobalNet - applyDiscount(preGlobalNet, settings.global_discount_pct);
  const globalFactor = 1 - clampPercent(settings.global_discount_pct) / 100;
  const discountedLineTotals = lineStepTotals.map((item) => ({
    ...item,
    afterGlobal: item.afterGroup * globalFactor
  }));
  const totalExtraCosts = settings.extra_costs.reduce(
    (sum: number, item: GlobalDiscountSettings['extra_costs'][number]) => sum + item.amount_net,
    0
  );

  const taxBases = new Map<string, { rate: number; base: number }>();

  discountedLineTotals.forEach(({ line, afterGlobal }) => {
    const entry = taxBases.get(line.tax_group_id) ?? { rate: line.tax_rate, base: 0 };
    entry.base += afterGlobal;
    taxBases.set(line.tax_group_id, entry);
  });

  settings.extra_costs.forEach((extraCost: GlobalDiscountSettings['extra_costs'][number]) => {
    const matchingLine = lines.find((line) => line.tax_group_id === extraCost.tax_group_id);
    const rate = matchingLine?.tax_rate ?? 0;
    const entry = taxBases.get(extraCost.tax_group_id) ?? { rate, base: 0 };
    entry.base += extraCost.amount_net;
    taxBases.set(extraCost.tax_group_id, entry);
  });

  const vatAmount = [...taxBases.values()].reduce((sum, item) => sum + item.base * item.rate, 0);
  const subtotalNet = preGlobalNet - totalGlobalDiscount + totalExtraCosts;
  const unroundedGross = subtotalNet + vatAmount;
  const totalGross = roundCurrency(unroundedGross);
  const dealerPriceNet = lines.reduce((sum, line) => sum + (line.dealer_price_net ?? 0) * line.qty, 0);
  const contributionMarginNet = subtotalNet - dealerPriceNet;
  const markupPct = dealerPriceNet === 0 ? 0 : (contributionMarginNet / dealerPriceNet) * 100;

  const components: PriceComponent[] = [];
  let cumulative = 0;

  cumulative += totalListPriceNet;
  components.push(createComponent(1, 'Listenpreis', totalListPriceNet, cumulative));

  cumulative += totalVariantSurcharges;
  components.push(createComponent(2, 'Varianten-/Mehrpreise', totalVariantSurcharges, cumulative));

  cumulative += totalObjectSurcharges;
  components.push(createComponent(3, 'Objektzuschlaege', totalObjectSurcharges, cumulative));

  cumulative -= totalPositionDiscounts;
  components.push(createComponent(4, 'Positionsrabatt', -totalPositionDiscounts, cumulative));

  cumulative -= totalGroupDiscounts;
  components.push(createComponent(5, 'Warengruppenrabatt', -totalGroupDiscounts, cumulative));

  cumulative -= totalGlobalDiscount;
  components.push(createComponent(6, 'Globalrabatt', -totalGlobalDiscount, cumulative));

  cumulative += totalExtraCosts;
  components.push(createComponent(7, 'Zusatzkosten', totalExtraCosts, cumulative));

  cumulative += vatAmount;
  components.push(createComponent(8, 'MwSt', vatAmount, cumulative));

  const roundingDelta = totalGross - cumulative;
  cumulative = totalGross;
  components.push(createComponent(9, 'Rundung', roundingDelta, cumulative));

  return {
    project_id: settings.project_id,
    calculated_at: new Date().toISOString(),
    total_list_price_net: totalListPriceNet,
    total_variant_surcharges: totalVariantSurcharges,
    total_object_surcharges: totalObjectSurcharges,
    total_position_discounts: totalPositionDiscounts,
    total_group_discounts: totalGroupDiscounts,
    total_global_discount: totalGlobalDiscount,
    total_extra_costs: totalExtraCosts,
    subtotal_net: subtotalNet,
    vat_amount: vatAmount,
    total_gross: totalGross,
    dealer_price_net: dealerPriceNet,
    contribution_margin_net: contributionMarginNet,
    markup_pct: markupPct,
    bom_lines: lines,
    components,
    total_purchase_price_net: dealerPriceNet,
    total_sell_price_net: subtotalNet
  };
}
