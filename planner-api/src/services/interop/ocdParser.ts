import { XMLParser } from 'fast-xml-parser'
import type { OcdArticle, OcdImportResult, OcdPrice } from '@okp/shared-schemas'

/**
 * parseOCD – OFML Commercial Data (OCD) XML parser.
 *
 * Parses an OCD XML document and extracts article and price-table entries.
 * The OCD format follows the pCon/OFML specification (see OCD 4.x spec).
 *
 * Expected top-level structure:
 * <OCD>
 *   <ARTICLE ArticleID="..." CompositeID="..." Description="..." Series="..." Manufacturer="...">
 *     <PRICE_TABLE PriceValue="..." Currency="EUR" TaxType="standard" ValidFrom="..." ValidUntil="..." />
 *   </ARTICLE>
 * </OCD>
 */
export function parseOCD(xml: string): OcdImportResult {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    isArray: (name) => name === 'ARTICLE' || name === 'PRICE_TABLE',
  })

  const data = parser.parse(xml) as Record<string, unknown>
  const root = (data['OCD'] ?? {}) as Record<string, unknown>

  const rawArticles = (root['ARTICLE'] ?? []) as RawOcdArticle[]
  const topLevelPrices = (root['PRICE_TABLE'] ?? []) as RawOcdPriceTable[]

  const articles: OcdArticle[] = rawArticles.flatMap((art) => {
    const articleId = String(art['@_ArticleID'] ?? '').trim()
    if (!articleId) {
      // Ignore malformed ARTICLE nodes without mandatory ArticleID.
      return []
    }

    const articlePrices = (art['PRICE_TABLE'] ?? []) as RawOcdPriceTable[]
    const prices = articlePrices
      .map((pt) => parsePriceTable(articleId, pt))
      .filter((price): price is OcdPrice => price !== null)

    return {
      article_id: articleId,
      composite_id: art['@_CompositeID'] ? String(art['@_CompositeID']) : undefined,
      description: art['@_Description'] ? String(art['@_Description']) : undefined,
      manufacturer_code: art['@_Manufacturer'] ? String(art['@_Manufacturer']) : undefined,
      series_code: art['@_Series'] ? String(art['@_Series']) : undefined,
      prices,
    }
  })

  const prices: OcdPrice[] = topLevelPrices
    .map((pt) => parsePriceTable('', pt))
    .filter((price): price is OcdPrice => price !== null)

  return {
    articles,
    prices,
    parsed_at: new Date().toISOString(),
  }
}

// ─── Internal helpers ────────────────────────────────────────────

interface RawOcdArticle {
  '@_ArticleID'?: string
  '@_CompositeID'?: string
  '@_Description'?: string
  '@_Manufacturer'?: string
  '@_Series'?: string
  PRICE_TABLE?: RawOcdPriceTable | RawOcdPriceTable[]
}

interface RawOcdPriceTable {
  '@_ArticleID'?: string
  '@_PriceValue'?: string | number
  '@_Currency'?: string
  '@_TaxType'?: string
  '@_ValidFrom'?: string
  '@_ValidUntil'?: string
}

function parsePriceTable(fallbackArticleId: string, pt: RawOcdPriceTable): OcdPrice | null {
  const articleId = String(pt['@_ArticleID'] ?? fallbackArticleId ?? '').trim()
  if (!articleId) {
    return null
  }

  const rawPrice = pt['@_PriceValue']
  const parsedPrice = rawPrice !== undefined ? Number(rawPrice) : 0
  const priceValue = Number.isFinite(parsedPrice) ? parsedPrice : 0
  const currency = String(pt['@_Currency'] ?? 'EUR')
  const rawTaxType = String(pt['@_TaxType'] ?? 'standard').toLowerCase()
  const taxType = (['standard', 'reduced', 'zero', 'exempt'] as const).includes(
    rawTaxType as 'standard' | 'reduced' | 'zero' | 'exempt',
  )
    ? (rawTaxType as OcdPrice['tax_type'])
    : 'standard'

  const price: OcdPrice = { article_id: articleId, price_value: priceValue, currency, tax_type: taxType }

  if (pt['@_ValidFrom']) {
    price.valid_from = String(pt['@_ValidFrom'])
  }

  if (pt['@_ValidUntil']) {
    price.valid_until = String(pt['@_ValidUntil'])
  }

  return price
}
