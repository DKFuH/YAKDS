import type {
  BOMLine,
  CatalogPlacementBase,
  PlacedAppliance,
  PlacedCabinet,
  PriceListItem,
  ProjectSnapshot,
  TaxGroup
} from '@yakds/shared-schemas';

function findPrice(itemId: string, priceListItems: PriceListItem[]): PriceListItem | null {
  return priceListItems.find((item) => item.catalog_item_id === itemId) ?? null;
}

function findTaxRate(taxGroupId: string, taxGroups: TaxGroup[]): number {
  return taxGroups.find((group) => group.id === taxGroupId)?.tax_rate ?? 0;
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function renderChosenOptions(source: CatalogPlacementBase): string {
  const entries = Object.entries(source.chosen_options ?? {}).filter(([, value]) => value.trim() !== '');
  if (entries.length === 0) {
    return '';
  }

  const sorted = [...entries].sort(([left], [right]) => left.localeCompare(right));
  return sorted.map(([key, value]) => `${key}: ${value}`).join(', ');
}

function placementLabel(source: CatalogPlacementBase): string {
  return source.description ?? source.catalog_article_id ?? source.catalog_item_id;
}

function createCatalogLine(
  projectId: string,
  source: CatalogPlacementBase,
  lineType: 'cabinet' | 'appliance' | 'accessory',
  priceListItems: PriceListItem[],
  taxGroups: TaxGroup[]
): BOMLine {
  const price = findPrice(source.catalog_item_id, priceListItems);
  const listPrice = source.list_price_net ?? price?.list_price_net ?? 0;
  const dealerPrice = source.dealer_price_net ?? price?.dealer_price_net ?? 0;
  const qty = source.qty ?? 1;
  const variantSurcharge = source.flags.variant_surcharge ?? 0;
  const objectSurcharges = source.flags.object_surcharges ?? 0;
  const posDiscount = clampPercent(source.position_discount_pct ?? 0);
  const groupDiscount = clampPercent(source.pricing_group_discount_pct ?? 0);
  const optionLabel = renderChosenOptions(source);
  const baseLabel = placementLabel(source);

  const grossLineNet = qty * listPrice + variantSurcharge + objectSurcharges;
  const afterPos = grossLineNet * (1 - posDiscount / 100);
  const afterGroup = afterPos * (1 - groupDiscount / 100);

  return {
    id: crypto.randomUUID(),
    project_id: projectId,
    type: lineType,
    catalog_item_id: source.catalog_article_id ?? source.catalog_item_id,
    description: optionLabel ? `${baseLabel} (${optionLabel})` : baseLabel,
    qty,
    unit: 'stk',
    list_price_net: listPrice,
    dealer_price_net: dealerPrice,
    variant_surcharge: variantSurcharge,
    object_surcharges: objectSurcharges,
    position_discount_pct: posDiscount,
    pricing_group_discount_pct: groupDiscount,
    line_net_after_discounts: afterGroup,
    tax_group_id: source.tax_group_id,
    tax_rate: findTaxRate(source.tax_group_id, taxGroups)
  };
}

function createFlatLine(
  projectId: string,
  type: BOMLine['type'],
  description: string,
  amountNet: number,
  taxGroupId: string,
  taxRate: number
): BOMLine {
  return {
    id: crypto.randomUUID(),
    project_id: projectId,
    type,
    catalog_item_id: null,
    description,
    qty: 1,
    unit: 'pauschal',
    list_price_net: amountNet,
    variant_surcharge: 0,
    object_surcharges: 0,
    position_discount_pct: 0,
    pricing_group_discount_pct: 0,
    line_net_after_discounts: amountNet,
    tax_group_id: taxGroupId,
    tax_rate: taxRate
  };
}

function defaultTaxGroup(taxGroups: TaxGroup[]): TaxGroup {
  return taxGroups[0] ?? { id: 'default-tax', name: 'Default Tax', tax_rate: 0 };
}

function createGeneratedLine(
  projectId: string,
  item: GeneratedItemInput,
  taxGroupId: string,
  taxRate: number
): BOMLine {
  const isLength = item.item_type === 'worktop' || item.item_type === 'plinth';
  const unit: BOMLine['unit'] = isLength ? 'm' : 'stk';
  const qty = isLength ? item.qty / 1000 : item.qty;
  const price = item.list_price_net ?? 0;
  return {
    id: crypto.randomUUID(),
    project_id: projectId,
    type: 'extra',
    catalog_item_id: item.catalog_article_id ?? null,
    description: item.label,
    qty,
    unit,
    list_price_net: price,
    dealer_price_net: 0,
    variant_surcharge: 0,
    object_surcharges: 0,
    position_discount_pct: 0,
    pricing_group_discount_pct: 0,
    line_net_after_discounts: price * qty,
    tax_group_id: taxGroupId,
    tax_rate: taxRate
  };
}

export interface GeneratedItemInput {
  id: string;
  label: string;
  item_type: string;
  qty: number;
  unit: string;
  tax_group_id?: string;
  catalog_article_id?: string;
  list_price_net?: number;
}

export interface CalculateBOMOptions {
  specialTrimSurchargeNet?: number;
  generatedItems?: GeneratedItemInput[];
}

export function calculateBOM(project: ProjectSnapshot, options: CalculateBOMOptions = {}): BOMLine[] {
  const lines: BOMLine[] = [];
  const defaultTax = defaultTaxGroup(project.taxGroups);
  const specialTrimSurchargeNet = options.specialTrimSurchargeNet ?? 0;

  const cabinets: PlacedCabinet[] = project.cabinets ?? [];
  const appliances: PlacedAppliance[] = project.appliances ?? [];
  const accessories = project.accessories ?? [];

  for (const cabinet of cabinets) {
    lines.push(createCatalogLine(project.id, cabinet, 'cabinet', project.priceListItems, project.taxGroups));

    if (cabinet.flags.special_trim_needed) {
      lines.push(
        createFlatLine(
          project.id,
          'surcharge',
          `Sonderblende für ${placementLabel(cabinet)}`,
          specialTrimSurchargeNet,
          cabinet.tax_group_id,
          findTaxRate(cabinet.tax_group_id, project.taxGroups)
        )
      );
    }

    if (cabinet.flags.labor_surcharge) {
      lines.push(
        createFlatLine(
          project.id,
          'assembly',
          `Montagezuschlag für ${placementLabel(cabinet)}`,
          project.quoteSettings.assembly_rate_per_item,
          cabinet.tax_group_id,
          findTaxRate(cabinet.tax_group_id, project.taxGroups)
        )
      );
    }
  }

  for (const appliance of appliances) {
    lines.push(createCatalogLine(project.id, appliance, 'appliance', project.priceListItems, project.taxGroups));

    if (appliance.flags.labor_surcharge) {
      lines.push(
        createFlatLine(
          project.id,
          'assembly',
          `Montagezuschlag für ${placementLabel(appliance)}`,
          project.quoteSettings.assembly_rate_per_item,
          appliance.tax_group_id,
          findTaxRate(appliance.tax_group_id, project.taxGroups)
        )
      );
    }
  }

  for (const accessory of accessories) {
    lines.push(createCatalogLine(project.id, accessory, 'accessory', project.priceListItems, project.taxGroups));
  }

  for (const item of options.generatedItems ?? []) {
    const taxGroupId = item.tax_group_id ?? defaultTax.id;
    const taxRate = item.tax_group_id ? findTaxRate(item.tax_group_id, project.taxGroups) : defaultTax.tax_rate;
    lines.push(createGeneratedLine(project.id, item, taxGroupId, taxRate));
  }

  lines.push(
    createFlatLine(
      project.id,
      'freight',
      'Frachtpauschale',
      project.quoteSettings.freight_flat_rate,
      defaultTax.id,
      defaultTax.tax_rate
    )
  );

  return lines;
}

export function sumBOMLines(lines: BOMLine[]): {
  total_list_net: number;
  total_net_after_discounts: number;
} {
  let totalListNet = 0;
  let totalAfterDiscounts = 0;

  for (const line of lines) {
    totalListNet += line.qty * line.list_price_net + line.variant_surcharge + line.object_surcharges;
    totalAfterDiscounts += line.line_net_after_discounts;
  }

  return {
    total_list_net: totalListNet,
    total_net_after_discounts: totalAfterDiscounts
  };
}
