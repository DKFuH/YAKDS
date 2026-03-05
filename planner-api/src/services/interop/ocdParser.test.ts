import { describe, expect, it } from 'vitest'
import { parseOCD } from './ocdParser.js'

const MINIMAL_OCD = `<?xml version="1.0" encoding="UTF-8"?>
<OCD>
  <ARTICLE ArticleID="ART-001" CompositeID="NOBILIA:BASE:ART-001" Description="Unterschrank 60cm" Manufacturer="NOBILIA" Series="BASE">
    <PRICE_TABLE PriceValue="349.90" Currency="EUR" TaxType="standard" />
  </ARTICLE>
</OCD>`

const MULTI_ARTICLE_OCD = `<?xml version="1.0" encoding="UTF-8"?>
<OCD>
  <ARTICLE ArticleID="ART-001" Description="Unterschrank 60cm">
    <PRICE_TABLE PriceValue="349.90" Currency="EUR" TaxType="standard" />
  </ARTICLE>
  <ARTICLE ArticleID="ART-002" Description="Oberschrank 60cm">
    <PRICE_TABLE PriceValue="199.00" Currency="EUR" TaxType="reduced" />
    <PRICE_TABLE PriceValue="249.00" Currency="EUR" TaxType="standard" />
  </ARTICLE>
</OCD>`

const TOP_LEVEL_PRICES_OCD = `<?xml version="1.0" encoding="UTF-8"?>
<OCD>
  <PRICE_TABLE ArticleID="ART-X" PriceValue="99.50" Currency="EUR" TaxType="zero" ValidFrom="2026-01-01T00:00:00.000Z" />
</OCD>`

const EMPTY_OCD = `<?xml version="1.0" encoding="UTF-8"?><OCD></OCD>`

describe('parseOCD', () => {
  it('extracts a single article with its price', () => {
    const result = parseOCD(MINIMAL_OCD)

    expect(result.articles).toHaveLength(1)
    const article = result.articles[0]!
    expect(article.article_id).toBe('ART-001')
    expect(article.composite_id).toBe('NOBILIA:BASE:ART-001')
    expect(article.description).toBe('Unterschrank 60cm')
    expect(article.manufacturer_code).toBe('NOBILIA')
    expect(article.series_code).toBe('BASE')
    expect(article.prices).toHaveLength(1)
    expect(article.prices[0]!.price_value).toBe(349.9)
    expect(article.prices[0]!.currency).toBe('EUR')
    expect(article.prices[0]!.tax_type).toBe('standard')
  })

  it('extracts multiple articles', () => {
    const result = parseOCD(MULTI_ARTICLE_OCD)

    expect(result.articles).toHaveLength(2)
    expect(result.articles[0]!.article_id).toBe('ART-001')
    expect(result.articles[1]!.article_id).toBe('ART-002')
  })

  it('handles multiple price tables per article', () => {
    const result = parseOCD(MULTI_ARTICLE_OCD)
    const art2 = result.articles[1]!

    expect(art2.prices).toHaveLength(2)
    expect(art2.prices[0]!.tax_type).toBe('reduced')
    expect(art2.prices[1]!.tax_type).toBe('standard')
  })

  it('extracts top-level PRICE_TABLE entries into prices array', () => {
    const result = parseOCD(TOP_LEVEL_PRICES_OCD)

    expect(result.prices).toHaveLength(1)
    const price = result.prices[0]!
    expect(price.article_id).toBe('ART-X')
    expect(price.price_value).toBe(99.5)
    expect(price.tax_type).toBe('zero')
    expect(price.valid_from).toBe('2026-01-01T00:00:00.000Z')
  })

  it('returns empty arrays for an empty OCD document', () => {
    const result = parseOCD(EMPTY_OCD)

    expect(result.articles).toHaveLength(0)
    expect(result.prices).toHaveLength(0)
  })

  it('sets parsed_at to a valid ISO datetime string', () => {
    const before = new Date().toISOString()
    const result = parseOCD(MINIMAL_OCD)
    const after = new Date().toISOString()

    expect(result.parsed_at >= before).toBe(true)
    expect(result.parsed_at <= after).toBe(true)
  })

  it('falls back to standard tax type for unknown TaxType values', () => {
    const xml = `<OCD><ARTICLE ArticleID="X"><PRICE_TABLE PriceValue="10" TaxType="unknown_type" /></ARTICLE></OCD>`
    const result = parseOCD(xml)

    expect(result.articles[0]!.prices[0]!.tax_type).toBe('standard')
  })

  it('defaults currency to EUR when not specified', () => {
    const xml = `<OCD><ARTICLE ArticleID="X"><PRICE_TABLE PriceValue="10" /></ARTICLE></OCD>`
    const result = parseOCD(xml)

    expect(result.articles[0]!.prices[0]!.currency).toBe('EUR')
  })

  it('defaults price_value to 0 when PriceValue is missing', () => {
    const xml = `<OCD><ARTICLE ArticleID="X"><PRICE_TABLE /></ARTICLE></OCD>`
    const result = parseOCD(xml)

    expect(result.articles[0]!.prices[0]!.price_value).toBe(0)
  })

  it('defaults price_value to 0 when PriceValue is non-numeric', () => {
    const xml = `<OCD><ARTICLE ArticleID="X"><PRICE_TABLE PriceValue="not-a-number" /></ARTICLE></OCD>`
    const result = parseOCD(xml)

    expect(result.articles[0]!.prices[0]!.price_value).toBe(0)
  })

  it('ignores ARTICLE nodes without ArticleID', () => {
    const xml = `<OCD><ARTICLE Description="No ID"><PRICE_TABLE PriceValue="12.3" /></ARTICLE></OCD>`
    const result = parseOCD(xml)

    expect(result.articles).toHaveLength(0)
  })
})
