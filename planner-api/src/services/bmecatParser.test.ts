import { describe, expect, it } from 'vitest'
import { parseBmecatCatalog } from './bmecatParser.js'

const BMECAT_1_2_FIXTURE = `<?xml version="1.0" encoding="UTF-8"?>
<BMECAT version="1.2">
  <HEADER>
    <SUPPLIER>
      <SUPPLIER_NAME>Nobilia GmbH</SUPPLIER_NAME>
      <SUPPLIER_ID type="iln">4300012345678</SUPPLIER_ID>
    </SUPPLIER>
    <CATALOG>
      <CATALOG_ID>NOBILIA-2024</CATALOG_ID>
      <CATALOG_VERSION>001.001</CATALOG_VERSION>
      <CATALOG_NAME>Nobilia Küchen 2024</CATALOG_NAME>
      <DATETIME type="generation_date">
        <DATE>2024-01-15</DATE>
      </DATETIME>
    </CATALOG>
  </HEADER>
  <T_NEW_CATALOG>
    <PRODUCT mode="new">
      <SUPPLIER_PID type="supplier_specific">US-600</SUPPLIER_PID>
      <PRODUCT_DETAILS>
        <DESCRIPTION_SHORT>Unterschrank 60 cm</DESCRIPTION_SHORT>
      </PRODUCT_DETAILS>
      <PRODUCT_FEATURES>
        <FEATURE>
          <FNAME>Breite</FNAME>
          <FVALUE>600</FVALUE>
          <FUNIT>mm</FUNIT>
        </FEATURE>
        <FEATURE>
          <FNAME>Tiefe</FNAME>
          <FVALUE>560</FVALUE>
          <FUNIT>mm</FUNIT>
        </FEATURE>
        <FEATURE>
          <FNAME>Höhe</FNAME>
          <FVALUE>720</FVALUE>
          <FUNIT>mm</FUNIT>
        </FEATURE>
      </PRODUCT_FEATURES>
      <PRODUCT_PRICE_DETAILS>
        <PRODUCT_PRICE type="net_list">
          <PRICE_AMOUNT>199.90</PRICE_AMOUNT>
          <PRICE_CURRENCY>EUR</PRICE_CURRENCY>
        </PRODUCT_PRICE>
        <PRODUCT_PRICE type="net_customer">
          <PRICE_AMOUNT>149.90</PRICE_AMOUNT>
          <PRICE_CURRENCY>EUR</PRICE_CURRENCY>
        </PRODUCT_PRICE>
      </PRODUCT_PRICE_DETAILS>
    </PRODUCT>
    <PRODUCT mode="new">
      <SUPPLIER_PID type="supplier_specific">OS-600</SUPPLIER_PID>
      <PRODUCT_DETAILS>
        <DESCRIPTION_SHORT>Oberschrank 60 cm</DESCRIPTION_SHORT>
      </PRODUCT_DETAILS>
      <PRODUCT_FEATURES>
        <FEATURE>
          <FNAME>Breite</FNAME>
          <FVALUE>600</FVALUE>
          <FUNIT>mm</FUNIT>
        </FEATURE>
        <FEATURE>
          <FNAME>Höhe</FNAME>
          <FVALUE>720</FVALUE>
          <FUNIT>mm</FUNIT>
        </FEATURE>
      </PRODUCT_FEATURES>
      <PRODUCT_PRICE_DETAILS>
        <PRODUCT_PRICE type="net_list">
          <PRICE_AMOUNT>249.00</PRICE_AMOUNT>
          <PRICE_CURRENCY>EUR</PRICE_CURRENCY>
        </PRODUCT_PRICE>
      </PRODUCT_PRICE_DETAILS>
    </PRODUCT>
  </T_NEW_CATALOG>
</BMECAT>`

const BMECAT_2005_FIXTURE = `<?xml version="1.0" encoding="UTF-8"?>
<BMECAT version="2005">
  <HEADER>
    <SUPPLIER>
      <SUPPLIER_NAME>Häcker Küchen</SUPPLIER_NAME>
      <SUPPLIER_ID>haecker</SUPPLIER_ID>
    </SUPPLIER>
    <CATALOG>
      <CATALOG_ID>HAECKER-2025</CATALOG_ID>
    </CATALOG>
  </HEADER>
  <T_UPDATE_PRODUCTS>
    <PRODUCT>
      <SUPPLIER_PID>HS-2100</SUPPLIER_PID>
      <PRODUCT_DETAILS>
        <DESCRIPTION_SHORT>Hochschrank 2100mm</DESCRIPTION_SHORT>
      </PRODUCT_DETAILS>
      <PRODUCT_FEATURES>
        <FEATURE>
          <FNAME>Width</FNAME>
          <FVALUE>600</FVALUE>
          <FUNIT>mm</FUNIT>
        </FEATURE>
        <FEATURE>
          <FNAME>Height</FNAME>
          <FVALUE>2100</FVALUE>
          <FUNIT>mm</FUNIT>
        </FEATURE>
        <FEATURE>
          <FNAME>Depth</FNAME>
          <FVALUE>580</FVALUE>
          <FUNIT>mm</FUNIT>
        </FEATURE>
      </PRODUCT_FEATURES>
      <PRODUCT_PRICE_DETAILS>
        <PRODUCT_PRICE type="net_list">
          <PRICE_AMOUNT>599.00</PRICE_AMOUNT>
          <PRICE_CURRENCY>EUR</PRICE_CURRENCY>
        </PRODUCT_PRICE>
        <PRODUCT_PRICE type="dealer">
          <PRICE_AMOUNT>450.00</PRICE_AMOUNT>
          <PRICE_CURRENCY>EUR</PRICE_CURRENCY>
        </PRODUCT_PRICE>
      </PRODUCT_PRICE_DETAILS>
    </PRODUCT>
  </T_UPDATE_PRODUCTS>
</BMECAT>`

describe('bmecatParser', () => {
    describe('parseBmecatCatalog', () => {
        it('parses BMEcat 1.2 header with supplier and catalog metadata', () => {
            const buffer = Buffer.from(BMECAT_1_2_FIXTURE)
            const result = parseBmecatCatalog(buffer)

            expect(result.header).toMatchObject({
                supplierName: 'Nobilia GmbH',
                supplierId: '4300012345678',
                catalogId: 'NOBILIA-2024',
                catalogVersion: '001.001',
                catalogName: 'Nobilia Küchen 2024',
                generationDate: '2024-01-15',
            })
        })

        it('parses multiple products from T_NEW_CATALOG', () => {
            const buffer = Buffer.from(BMECAT_1_2_FIXTURE)
            const { articles } = parseBmecatCatalog(buffer)

            expect(articles).toHaveLength(2)
        })

        it('maps SUPPLIER_PID to article sku', () => {
            const buffer = Buffer.from(BMECAT_1_2_FIXTURE)
            const { articles } = parseBmecatCatalog(buffer)

            expect(articles[0].sku).toBe('US-600')
            expect(articles[1].sku).toBe('OS-600')
        })

        it('maps DESCRIPTION_SHORT to article name', () => {
            const buffer = Buffer.from(BMECAT_1_2_FIXTURE)
            const { articles } = parseBmecatCatalog(buffer)

            expect(articles[0].name).toBe('Unterschrank 60 cm')
        })

        it('maps FEATURE elements (Breite/Tiefe/Höhe) to dimensions in mm', () => {
            const buffer = Buffer.from(BMECAT_1_2_FIXTURE)
            const { articles } = parseBmecatCatalog(buffer)

            expect(articles[0]).toMatchObject({
                widthMm: 600,
                depthMm: 560,
                heightMm: 720,
            })
        })

        it('maps net_list price to listPrice and net_customer to dealerPrice', () => {
            const buffer = Buffer.from(BMECAT_1_2_FIXTURE)
            const { articles } = parseBmecatCatalog(buffer)

            expect(articles[0].listPrice).toBe(199.9)
            expect(articles[0].dealerPrice).toBe(149.9)
        })

        it('defaults dealerPrice to undefined when only net_list price is present', () => {
            const buffer = Buffer.from(BMECAT_1_2_FIXTURE)
            const { articles } = parseBmecatCatalog(buffer)

            expect(articles[1].dealerPrice).toBeUndefined()
        })

        it('sets manufacturerName from SUPPLIER_NAME', () => {
            const buffer = Buffer.from(BMECAT_1_2_FIXTURE)
            const { articles } = parseBmecatCatalog(buffer)

            expect(articles[0].manufacturerName).toBe('Nobilia GmbH')
        })

        it('parses BMEcat 2005 T_UPDATE_PRODUCTS transaction', () => {
            const buffer = Buffer.from(BMECAT_2005_FIXTURE)
            const { header, articles } = parseBmecatCatalog(buffer)

            expect(header.supplierName).toBe('Häcker Küchen')
            expect(articles).toHaveLength(1)
            expect(articles[0]).toMatchObject({
                sku: 'HS-2100',
                name: 'Hochschrank 2100mm',
                widthMm: 600,
                heightMm: 2100,
                depthMm: 580,
                listPrice: 599,
                dealerPrice: 450,
            })
        })

        it('includes bmecat_catalog_id in article meta_json', () => {
            const buffer = Buffer.from(BMECAT_1_2_FIXTURE)
            const { articles } = parseBmecatCatalog(buffer)

            expect((articles[0].meta_json as any)?.bmecat_catalog_id).toBe('NOBILIA-2024')
        })

        it('converts cm dimensions to mm', () => {
            const xml = `<?xml version="1.0" encoding="UTF-8"?>
<BMECAT version="1.2">
  <HEADER>
    <SUPPLIER><SUPPLIER_NAME>Test</SUPPLIER_NAME></SUPPLIER>
    <CATALOG><CATALOG_ID>TEST</CATALOG_ID></CATALOG>
  </HEADER>
  <T_NEW_CATALOG>
    <PRODUCT>
      <SUPPLIER_PID>TEST-001</SUPPLIER_PID>
      <PRODUCT_DETAILS><DESCRIPTION_SHORT>Test Product</DESCRIPTION_SHORT></PRODUCT_DETAILS>
      <PRODUCT_FEATURES>
        <FEATURE>
          <FNAME>Breite</FNAME>
          <FVALUE>60</FVALUE>
          <FUNIT>cm</FUNIT>
        </FEATURE>
      </PRODUCT_FEATURES>
    </PRODUCT>
  </T_NEW_CATALOG>
</BMECAT>`
            const { articles } = parseBmecatCatalog(Buffer.from(xml))
            expect(articles[0].widthMm).toBe(600)
        })

        it('returns empty articles array when no products exist', () => {
            const xml = `<?xml version="1.0" encoding="UTF-8"?>
<BMECAT version="1.2">
  <HEADER>
    <SUPPLIER><SUPPLIER_NAME>Empty Vendor</SUPPLIER_NAME></SUPPLIER>
    <CATALOG><CATALOG_ID>EMPTY</CATALOG_ID></CATALOG>
  </HEADER>
  <T_NEW_CATALOG></T_NEW_CATALOG>
</BMECAT>`
            const { articles } = parseBmecatCatalog(Buffer.from(xml))
            expect(articles).toHaveLength(0)
        })
    })
})
