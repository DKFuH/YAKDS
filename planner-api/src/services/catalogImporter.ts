export interface RawArticle {
  manufacturerCode?: string;
  manufacturerName?: string;
  sku: string;
  name: string;
  articleType?: string;
  listPrice: number;
  dealerPrice?: number;
  widthMm?: number;
  depthMm?: number;
  heightMm?: number;
  color?: string;
  handle?: string;
  [key: string]: unknown;
}

export interface ManufacturerImportRecord {
  id: string;
  name: string;
  code: string;
}

export interface CatalogArticleRecord {
  id: string;
  manufacturer_id: string;
  sku: string;
  name: string;
  article_type: string;
  base_dims_json: {
    width_mm?: number;
    depth_mm?: number;
    height_mm?: number;
  };
  meta_json: Record<string, unknown>;
}

export interface ArticleOptionRecord {
  id: string;
  article_id: string;
  option_key: string;
  option_type: 'enum' | 'text';
  constraints_json: {
    values: string[];
  };
}

export interface ArticleVariantRecord {
  id: string;
  article_id: string;
  variant_key: string;
  variant_values_json: Record<string, number | string>;
  dims_override_json: {
    width_mm?: number;
    depth_mm?: number;
    height_mm?: number;
  };
}

export interface ArticlePriceRecord {
  id: string;
  article_id: string;
  list_net: number;
  dealer_net?: number;
}

export interface CatalogArticleImportSet {
  manufacturers: ManufacturerImportRecord[];
  articles: CatalogArticleRecord[];
  options: ArticleOptionRecord[];
  variants: ArticleVariantRecord[];
  prices: ArticlePriceRecord[];
}

export interface ImportValidationResult {
  valid: boolean;
  errors: string[];
}

const OPTION_KEYS = [
  { source: 'color', target: 'color' },
  { source: 'farbe', target: 'color' },
  { source: 'handle', target: 'handle' },
  { source: 'griff', target: 'handle' },
  { source: 'front', target: 'front' }
] as const;

const VARIANT_KEYS = [
  { source: 'widthMm', target: 'width' },
  { source: 'width_mm', target: 'width' },
  { source: 'breite', target: 'width' },
  { source: 'depthMm', target: 'depth' },
  { source: 'depth_mm', target: 'depth' },
  { source: 'tiefe', target: 'depth' },
  { source: 'heightMm', target: 'height' },
  { source: 'height_mm', target: 'height' },
  { source: 'hoehe', target: 'height' },
  { source: 'höhe', target: 'height' }
] as const;

function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizeHeader(header: string): string {
  return header.trim().replace(/\uFEFF/g, '');
}

function normalizeRecord(record: Record<string, unknown>): Record<string, unknown> {
  const normalized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(record)) {
    normalized[normalizeHeader(key)] = value;
  }

  return normalized;
}

function readString(source: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }

  return undefined;
}

function readNumber(source: Record<string, unknown>, ...keys: string[]): number | undefined {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();
      const hasDot = trimmed.includes('.');
      const hasComma = trimmed.includes(',');
      let normalized = trimmed;

      if (hasDot && hasComma) {
        normalized = trimmed.replace(/\./g, '').replace(',', '.');
      } else if (hasComma) {
        normalized = trimmed.replace(',', '.');
      }

      const parsed = Number(normalized);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return undefined;
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];

    if (character === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (character === ',' && !inQuotes) {
      cells.push(current.trim());
      current = '';
      continue;
    }

    current += character;
  }

  cells.push(current.trim());
  return cells;
}

function parseCsv(buffer: Buffer): Record<string, string>[] {
  const lines = buffer
    .toString('utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return [];
  }

  const headers = parseCsvLine(lines[0]).map(normalizeHeader);

  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line);
    const record: Record<string, string> = {};

    headers.forEach((header, index) => {
      record[header] = cells[index] ?? '';
    });

    return record;
  });
}

function parseJson(buffer: Buffer): Record<string, unknown>[] {
  const parsed = JSON.parse(buffer.toString('utf8')) as unknown;

  if (Array.isArray(parsed)) {
    return parsed.map((entry) => normalizeRecord(entry as Record<string, unknown>));
  }

  if (parsed && typeof parsed === 'object') {
    const object = parsed as Record<string, unknown>;
    const articles = object.articles;

    if (Array.isArray(articles)) {
      return articles.map((entry) => normalizeRecord(entry as Record<string, unknown>));
    }
  }

  throw new Error('Unsupported catalog JSON payload.');
}

function normalizeRawArticle(record: Record<string, unknown>): RawArticle {
  const normalized = normalizeRecord(record);
  const sku = readString(normalized, 'sku', 'SKU') ?? '';
  const name = readString(normalized, 'name', 'Name', 'article_name') ?? '';
  const manufacturerCode = readString(normalized, 'manufacturerCode', 'manufacturer_code', 'manufacturer') ?? 'generic';
  const manufacturerName = readString(normalized, 'manufacturerName', 'manufacturer_name', 'vendor') ?? manufacturerCode.toUpperCase();
  const articleType = readString(normalized, 'articleType', 'article_type', 'type') ?? 'cabinet';
  const listPrice = readNumber(normalized, 'listPrice', 'list_price', 'list_net', 'price', 'Listpreis') ?? Number.NaN;
  const dealerPrice = readNumber(normalized, 'dealerPrice', 'dealer_price', 'dealer_net');
  const widthMm = readNumber(normalized, 'widthMm', 'width_mm', 'breite');
  const depthMm = readNumber(normalized, 'depthMm', 'depth_mm', 'tiefe');
  const heightMm = readNumber(normalized, 'heightMm', 'height_mm', 'hoehe', 'höhe');
  const color = readString(normalized, 'color', 'farbe');
  const handle = readString(normalized, 'handle', 'griff');

  return {
    ...normalized,
    manufacturerCode,
    manufacturerName,
    sku,
    name,
    articleType,
    listPrice,
    dealerPrice,
    widthMm,
    depthMm,
    heightMm,
    color,
    handle
  };
}

import { parseIdmArticles } from './idmParser.js';
import { parseBmecatCatalog } from './bmecatParser.js';

export async function parseCatalogFile(fileBuffer: Buffer, format: 'csv' | 'json' | 'xml' | 'idm' | 'bmecat'): Promise<RawArticle[]> {
  if (format === 'xml' || format === 'idm') {
    return parseIdmArticles(fileBuffer);
  }

  if (format === 'bmecat') {
    const result = parseBmecatCatalog(fileBuffer);
    return result.articles;
  }

  const rows = format === 'csv' ? parseCsv(fileBuffer) : parseJson(fileBuffer);
  return rows.map(normalizeRawArticle);
}

export function mapToInternalSchema(raw: RawArticle[]): CatalogArticleImportSet {
  const manufacturers = new Map<string, ManufacturerImportRecord>();
  const articles: CatalogArticleRecord[] = [];
  const options: ArticleOptionRecord[] = [];
  const variants: ArticleVariantRecord[] = [];
  const prices: ArticlePriceRecord[] = [];

  raw.forEach((article, index) => {
    const manufacturerCode = article.manufacturerCode ?? 'generic';
    const manufacturerName = article.manufacturerName ?? manufacturerCode.toUpperCase();
    const manufacturerId = `manufacturer-${slugify(manufacturerCode)}`;

    if (!manufacturers.has(manufacturerId)) {
      manufacturers.set(manufacturerId, {
        id: manufacturerId,
        code: manufacturerCode,
        name: manufacturerName
      });
    }

    const articleId = `article-${slugify(article.sku || `row-${index + 1}`)}`;
    articles.push({
      id: articleId,
      manufacturer_id: manufacturerId,
      sku: article.sku,
      name: article.name,
      article_type: article.articleType ?? 'cabinet',
      base_dims_json: {
        width_mm: article.widthMm,
        depth_mm: article.depthMm,
        height_mm: article.heightMm
      },
      meta_json: {
        source_row: index + 1
      }
    });

    OPTION_KEYS.forEach(({ source, target }) => {
      const value = article[source];
      if (typeof value === 'string' && value.trim().length > 0) {
        options.push({
          id: `option-${slugify(articleId)}-${target}`,
          article_id: articleId,
          option_key: target,
          option_type: 'enum',
          constraints_json: {
            values: [value.trim()]
          }
        });
      }
    });

    const variantValues: Record<string, number | string> = {};
    const dimsOverride: { width_mm?: number; depth_mm?: number; height_mm?: number } = {};

    VARIANT_KEYS.forEach(({ source, target }) => {
      const value = article[source];
      if (typeof value === 'number' && Number.isFinite(value)) {
        variantValues[target] = value;
        if (target === 'width') {
          dimsOverride.width_mm = value;
        }
        if (target === 'depth') {
          dimsOverride.depth_mm = value;
        }
        if (target === 'height') {
          dimsOverride.height_mm = value;
        }
      }
    });

    if (Object.keys(variantValues).length > 0) {
      variants.push({
        id: `variant-${slugify(articleId)}`,
        article_id: articleId,
        variant_key: 'dimensions',
        variant_values_json: variantValues,
        dims_override_json: dimsOverride
      });
    }

    prices.push({
      id: `price-${slugify(articleId)}`,
      article_id: articleId,
      list_net: article.listPrice,
      dealer_net: article.dealerPrice
    });
  });

  return {
    manufacturers: [...manufacturers.values()],
    articles,
    options,
    variants,
    prices
  };
}

export function validateCatalogSet(set: CatalogArticleImportSet): ImportValidationResult {
  const errors: string[] = [];
  const seenManufacturers = new Set<string>();
  const seenSkus = new Set<string>();
  const pricesByArticle = new Map(set.prices.map((price) => [price.article_id, price]));

  set.manufacturers.forEach((manufacturer) => {
    if (!manufacturer.code.trim()) {
      errors.push(`Manufacturer ${manufacturer.id} is missing a code.`);
    }

    if (seenManufacturers.has(manufacturer.code)) {
      errors.push(`Duplicate manufacturer code: ${manufacturer.code}.`);
    }

    seenManufacturers.add(manufacturer.code);
  });

  set.articles.forEach((article) => {
    if (!article.sku.trim()) {
      errors.push(`Article ${article.id} is missing SKU.`);
    }

    if (!article.name.trim()) {
      errors.push(`Article ${article.id} is missing name.`);
    }

    if (seenSkus.has(article.sku)) {
      errors.push(`Duplicate SKU detected: ${article.sku}.`);
    }

    seenSkus.add(article.sku);

    const price = pricesByArticle.get(article.id);
    if (!price || !Number.isFinite(price.list_net)) {
      errors.push(`Article ${article.sku || article.id} is missing list price.`);
    }
  });

  return {
    valid: errors.length === 0,
    errors
  };
}
