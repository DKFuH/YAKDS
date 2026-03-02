import { describe, expect, it } from 'vitest';
import type { BOMLine, ProjectSnapshot } from '@okp/shared-schemas';
import { calculateBOM, sumBOMLines, type GeneratedItemInput } from './bomCalculator.js';

function baseProject(): ProjectSnapshot {
  return {
    id: 'project-1',
    cabinets: [],
    appliances: [],
    accessories: [],
    priceListItems: [
      { catalog_item_id: 'cab-60', list_price_net: 500, dealer_price_net: 300 },
      { catalog_item_id: 'stove-1', list_price_net: 1200, dealer_price_net: 800 }
    ],
    taxGroups: [
      { id: 'tax-de', name: 'DE 19%', tax_rate: 0.19 },
      { id: 'tax-reduced', name: 'Reduced', tax_rate: 0.07 }
    ],
    quoteSettings: {
      freight_flat_rate: 89,
      assembly_rate_per_item: 45
    }
  };
}

describe('bomCalculator', () => {
  it('returns only freight line for empty project', () => {
    const project = baseProject();
    const lines = calculateBOM(project);

    expect(lines).toHaveLength(1);
    expect(lines[0].type).toBe('freight');
    expect(lines[0].list_price_net).toBe(89);
  });

  it('creates lines for 3 cabinets and 1 appliance', () => {
    const project = baseProject();
    project.cabinets = [
      {
        id: 'c1',
        catalog_item_id: 'cab-60',
        tax_group_id: 'tax-de',
        flags: {
          requires_customization: false,
          height_variant: null,
          labor_surcharge: false,
          special_trim_needed: false
        }
      },
      {
        id: 'c2',
        catalog_item_id: 'cab-60',
        tax_group_id: 'tax-de',
        flags: {
          requires_customization: false,
          height_variant: null,
          labor_surcharge: false,
          special_trim_needed: false
        }
      },
      {
        id: 'c3',
        catalog_item_id: 'cab-60',
        tax_group_id: 'tax-de',
        flags: {
          requires_customization: false,
          height_variant: null,
          labor_surcharge: false,
          special_trim_needed: false
        }
      }
    ];
    project.appliances = [
      {
        id: 'a1',
        catalog_item_id: 'stove-1',
        tax_group_id: 'tax-de',
        flags: {
          requires_customization: false,
          height_variant: null,
          labor_surcharge: false,
          special_trim_needed: false
        }
      }
    ];

    const lines = calculateBOM(project);
    const cabinetLines = lines.filter((line: BOMLine) => line.type === 'cabinet');
    const applianceLines = lines.filter((line: BOMLine) => line.type === 'appliance');

    expect(cabinetLines).toHaveLength(3);
    expect(applianceLines).toHaveLength(1);
    expect(lines.some((line: BOMLine) => line.type === 'freight')).toBe(true);
  });

  it('adds surcharge line when special trim flag is set', () => {
    const project = baseProject();
    project.cabinets = [
      {
        id: 'c1',
        catalog_item_id: 'cab-60',
        tax_group_id: 'tax-de',
        flags: {
          requires_customization: false,
          height_variant: null,
          labor_surcharge: false,
          special_trim_needed: true
        }
      }
    ];

    const lines = calculateBOM(project);
    expect(lines.some((line: BOMLine) => line.type === 'surcharge')).toBe(true);

    const totals = sumBOMLines(lines);
    expect(totals.total_list_net).toBeGreaterThan(0);
    expect(totals.total_net_after_discounts).toBeGreaterThan(0);
  });

  it('uses configurable special trim surcharge amount', () => {
    const project = baseProject();
    project.cabinets = [
      {
        id: 'c1',
        catalog_item_id: 'cab-60',
        tax_group_id: 'tax-de',
        flags: {
          requires_customization: false,
          height_variant: null,
          labor_surcharge: false,
          special_trim_needed: true
        }
      }
    ];

    const lines = calculateBOM(project, { specialTrimSurchargeNet: 75 });
    const surchargeLine = lines.find((line: BOMLine) => line.type === 'surcharge');

    expect(surchargeLine).toBeDefined();
    expect(surchargeLine?.list_price_net).toBe(75);
    expect(surchargeLine?.line_net_after_discounts).toBe(75);

    const totals = sumBOMLines(lines);
    expect(totals.total_list_net).toBe(664);
    expect(totals.total_net_after_discounts).toBe(664);
  });

  it('includes worktop generated item as extra line with unit m', () => {
    const project = baseProject();
    const generatedItems: GeneratedItemInput[] = [
      { id: 'gi-1', label: 'Arbeitsplatte (Wand wall-1)', item_type: 'worktop', qty: 2400, unit: 'mm' }
    ];

    const lines = calculateBOM(project, { generatedItems });
    const extraLine = lines.find((l: BOMLine) => l.type === 'extra');

    expect(extraLine).toBeDefined();
    expect(extraLine?.description).toBe('Arbeitsplatte (Wand wall-1)');
    expect(extraLine?.unit).toBe('m');
    expect(extraLine?.qty).toBeCloseTo(2.4);
    expect(extraLine?.list_price_net).toBe(0);
  });

  it('includes plinth as extra line with unit m', () => {
    const project = baseProject();
    const generatedItems: GeneratedItemInput[] = [
      { id: 'gi-2', label: 'Sockelbrett (Wand wall-1)', item_type: 'plinth', qty: 1800, unit: 'mm' }
    ];

    const lines = calculateBOM(project, { generatedItems });
    const extraLine = lines.find((l: BOMLine) => l.type === 'extra');

    expect(extraLine?.unit).toBe('m');
    expect(extraLine?.qty).toBeCloseTo(1.8);
  });

  it('includes side panel as extra line with unit stk', () => {
    const project = baseProject();
    const generatedItems: GeneratedItemInput[] = [
      { id: 'gi-3', label: 'Abschlussblende links', item_type: 'side_panel', qty: 1, unit: 'Stk' }
    ];

    const lines = calculateBOM(project, { generatedItems });
    const extraLine = lines.find((l: BOMLine) => l.type === 'extra');

    expect(extraLine?.unit).toBe('stk');
    expect(extraLine?.qty).toBe(1);
  });

  it('uses provided list_price_net for priced generated items', () => {
    const project = baseProject();
    const generatedItems: GeneratedItemInput[] = [
      { id: 'gi-4', label: 'Arbeitsplatte Premium', item_type: 'worktop', qty: 3000, unit: 'mm', list_price_net: 120 }
    ];

    const lines = calculateBOM(project, { generatedItems });
    const extraLine = lines.find((l: BOMLine) => l.type === 'extra');

    expect(extraLine?.list_price_net).toBe(120);
    expect(extraLine?.line_net_after_discounts).toBeCloseTo(120 * 3);
  });

  it('uses placement price overrides and includes chosen options in line description', () => {
    const project = baseProject();
    project.cabinets = [
      {
        id: 'cab-article-1',
        catalog_item_id: 'article-900',
        catalog_article_id: 'article-900',
        description: 'Hersteller-Unterschrank 90',
        chosen_options: {
          front: 'Mattweiß',
          griff: 'Stange',
        },
        list_price_net: 850,
        dealer_price_net: 610,
        tax_group_id: 'tax-de',
        flags: {
          requires_customization: false,
          height_variant: null,
          labor_surcharge: false,
          special_trim_needed: false,
        },
      },
    ];

    const lines = calculateBOM(project);
    const cabinetLine = lines.find((line: BOMLine) => line.type === 'cabinet');

    expect(cabinetLine).toBeDefined();
    expect(cabinetLine?.catalog_item_id).toBe('article-900');
    expect(cabinetLine?.list_price_net).toBe(850);
    expect(cabinetLine?.dealer_price_net).toBe(610);
    expect(cabinetLine?.description).toContain('Hersteller-Unterschrank 90');
    expect(cabinetLine?.description).toContain('front: Mattweiß');
    expect(cabinetLine?.description).toContain('griff: Stange');
  });

  it('resolves article_variant_id against ArticlePrice and applies matching tax group', () => {
    const project = baseProject();
    project.cabinets = [
      {
        id: 'cab-variant-1',
        catalog_item_id: 'article-901',
        catalog_article_id: 'article-901',
        article_variant_id: 'variant-a',
        description: 'Hersteller-Hochschrank',
        tax_group_id: 'tax-de',
        flags: {
          requires_customization: false,
          height_variant: null,
          labor_surcharge: false,
          special_trim_needed: false,
        },
      } as any,
    ];

    const lines = calculateBOM({
      ...project,
      articlePrices: [
        {
          article_id: 'article-901',
          article_variant_id: 'variant-a',
          list_net: 999,
          dealer_net: 700,
          tax_group_id: 'tax-reduced',
        },
      ],
    });

    const cabinetLine = lines.find((line: BOMLine) => line.type === 'cabinet');

    expect(cabinetLine).toBeDefined();
    expect(cabinetLine?.list_price_net).toBe(999);
    expect(cabinetLine?.dealer_price_net).toBe(700);
    expect(cabinetLine?.tax_group_id).toBe('tax-reduced');
    expect(cabinetLine?.tax_rate).toBe(0.07);
    expect(cabinetLine?.line_net_after_discounts).toBeGreaterThan(0);
  });
});
