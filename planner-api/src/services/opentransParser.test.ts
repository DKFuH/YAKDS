import { describe, expect, it } from 'vitest'
import { parseOpenTransDocument } from './opentransParser.js'

const ORDER_FIXTURE = `<?xml version="1.0" encoding="UTF-8"?>
<ORDER version="1.0" type="standard">
  <ORDER_HEADER>
    <ORDER_INFO>
      <ORDER_ID>ORD-2024-001</ORDER_ID>
      <ORDER_DATE>2024-03-01</ORDER_DATE>
    </ORDER_INFO>
    <ORDER_PARTIES>
      <BUYER_PARTY>
        <PARTY_ID>buyer-001</PARTY_ID>
        <PARTY_NAME>Küchenstudio Schmidt GmbH</PARTY_NAME>
      </BUYER_PARTY>
      <SUPPLIER_PARTY>
        <PARTY_ID>supplier-001</PARTY_ID>
        <PARTY_NAME>Nobilia GmbH</PARTY_NAME>
      </SUPPLIER_PARTY>
    </ORDER_PARTIES>
  </ORDER_HEADER>
  <ORDER_ITEM_LIST>
    <ORDER_ITEM>
      <LINE_ITEM_ID>1</LINE_ITEM_ID>
      <PRODUCT>
        <SUPPLIER_PID type="supplier_specific">US-600</SUPPLIER_PID>
        <DESCRIPTION_SHORT>Unterschrank 60 cm</DESCRIPTION_SHORT>
      </PRODUCT>
      <QUANTITY>3</QUANTITY>
      <ORDER_UNIT>C62</ORDER_UNIT>
      <PRODUCT_PRICE_FIX>
        <PRICE_AMOUNT>199.90</PRICE_AMOUNT>
        <PRICE_CURRENCY>EUR</PRICE_CURRENCY>
      </PRODUCT_PRICE_FIX>
      <LINE_AMOUNT>599.70</LINE_AMOUNT>
      <DELIVERY_DATE>
        <DATE>2024-04-15</DATE>
      </DELIVERY_DATE>
    </ORDER_ITEM>
    <ORDER_ITEM>
      <LINE_ITEM_ID>2</LINE_ITEM_ID>
      <PRODUCT>
        <SUPPLIER_PID type="supplier_specific">OS-600</SUPPLIER_PID>
        <DESCRIPTION_SHORT>Oberschrank 60 cm</DESCRIPTION_SHORT>
      </PRODUCT>
      <QUANTITY>2</QUANTITY>
      <ORDER_UNIT>C62</ORDER_UNIT>
      <PRODUCT_PRICE_FIX>
        <PRICE_AMOUNT>249.00</PRICE_AMOUNT>
        <PRICE_CURRENCY>EUR</PRICE_CURRENCY>
      </PRODUCT_PRICE_FIX>
      <LINE_AMOUNT>498.00</LINE_AMOUNT>
    </ORDER_ITEM>
  </ORDER_ITEM_LIST>
  <ORDER_SUMMARY>
    <TOTAL_ITEM_NUM>2</TOTAL_ITEM_NUM>
    <TOTAL_AMOUNT>1097.70</TOTAL_AMOUNT>
  </ORDER_SUMMARY>
</ORDER>`

const INVOICE_FIXTURE = `<?xml version="1.0" encoding="UTF-8"?>
<INVOICE version="2.0">
  <INVOICE_HEADER>
    <INVOICE_INFO>
      <INVOICE_ID>INV-2024-0042</INVOICE_ID>
      <INVOICE_DATE>2024-03-15</INVOICE_DATE>
    </INVOICE_INFO>
    <INVOICE_PARTIES>
      <BUYER_PARTY>
        <PARTY_ID>buyer-001</PARTY_ID>
        <PARTY_NAME>Küchenstudio Schmidt GmbH</PARTY_NAME>
      </BUYER_PARTY>
      <SUPPLIER_PARTY>
        <PARTY_ID>supplier-001</PARTY_ID>
        <PARTY_NAME>Nobilia GmbH</PARTY_NAME>
      </SUPPLIER_PARTY>
    </INVOICE_PARTIES>
  </INVOICE_HEADER>
  <INVOICE_ITEM_LIST>
    <INVOICE_ITEM>
      <LINE_ITEM_ID>1</LINE_ITEM_ID>
      <PRODUCT>
        <SUPPLIER_PID>US-600</SUPPLIER_PID>
        <DESCRIPTION_SHORT>Unterschrank 60 cm</DESCRIPTION_SHORT>
      </PRODUCT>
      <QUANTITY>3</QUANTITY>
      <ORDER_UNIT>C62</ORDER_UNIT>
      <PRODUCT_PRICE_FIX>
        <PRICE_AMOUNT>199.90</PRICE_AMOUNT>
        <PRICE_CURRENCY>EUR</PRICE_CURRENCY>
      </PRODUCT_PRICE_FIX>
    </INVOICE_ITEM>
  </INVOICE_ITEM_LIST>
  <INVOICE_SUMMARY>
    <TOTAL_ITEM_NUM>1</TOTAL_ITEM_NUM>
    <TOTAL_AMOUNT>599.70</TOTAL_AMOUNT>
  </INVOICE_SUMMARY>
</INVOICE>`

const ORDERRESPONSE_FIXTURE = `<?xml version="1.0" encoding="UTF-8"?>
<ORDERRESPONSE version="1.0">
  <ORDERRESPONSE_HEADER>
    <ORDERRESPONSE_INFO>
      <ORDERRESPONSE_ID>ORSP-2024-0001</ORDERRESPONSE_ID>
      <ORDERRESPONSE_DATE>2024-03-20</ORDERRESPONSE_DATE>
    </ORDERRESPONSE_INFO>
    <PARTIES>
      <BUYER_PARTY>
        <PARTY_ID>buyer-001</PARTY_ID>
      </BUYER_PARTY>
      <SUPPLIER_PARTY>
        <PARTY_ID>supplier-001</PARTY_ID>
      </SUPPLIER_PARTY>
    </PARTIES>
  </ORDERRESPONSE_HEADER>
  <ORDERRESPONSE_ITEM_LIST>
    <ORDERRESPONSE_ITEM>
      <LINE_ITEM_ID>1</LINE_ITEM_ID>
      <PRODUCT>
        <SUPPLIER_PID>US-600</SUPPLIER_PID>
      </PRODUCT>
      <QUANTITY>3</QUANTITY>
      <ORDER_UNIT>C62</ORDER_UNIT>
      <PRODUCT_PRICE_FIX>
        <PRICE_AMOUNT>199.90</PRICE_AMOUNT>
        <PRICE_CURRENCY>EUR</PRICE_CURRENCY>
      </PRODUCT_PRICE_FIX>
      <LINE_AMOUNT>599.70</LINE_AMOUNT>
    </ORDERRESPONSE_ITEM>
  </ORDERRESPONSE_ITEM_LIST>
  <ORDERRESPONSE_SUMMARY>
    <TOTAL_ITEM_NUM>1</TOTAL_ITEM_NUM>
    <TOTAL_AMOUNT>599.70</TOTAL_AMOUNT>
  </ORDERRESPONSE_SUMMARY>
</ORDERRESPONSE>`

describe('opentransParser', () => {
    describe('parseOpenTransDocument – ORDER', () => {
        it('detects ORDER document type', () => {
            const doc = parseOpenTransDocument(Buffer.from(ORDER_FIXTURE))
            expect(doc.documentType).toBe('ORDER')
        })

        it('extracts ORDER_ID and ORDER_DATE', () => {
            const doc = parseOpenTransDocument(Buffer.from(ORDER_FIXTURE))
            expect(doc.documentId).toBe('ORD-2024-001')
            expect(doc.documentDate).toBe('2024-03-01')
        })

        it('extracts buyer and supplier parties', () => {
            const doc = parseOpenTransDocument(Buffer.from(ORDER_FIXTURE))

            expect(doc.buyerParty).toMatchObject({
                id: 'buyer-001',
                name: 'Küchenstudio Schmidt GmbH',
                role: 'buyer',
            })
            expect(doc.supplierParty).toMatchObject({
                id: 'supplier-001',
                name: 'Nobilia GmbH',
                role: 'supplier',
            })
        })

        it('extracts all order items', () => {
            const doc = parseOpenTransDocument(Buffer.from(ORDER_FIXTURE))
            expect(doc.items).toHaveLength(2)
        })

        it('maps SUPPLIER_PID to supplierPid on each item', () => {
            const doc = parseOpenTransDocument(Buffer.from(ORDER_FIXTURE))
            expect(doc.items[0].supplierPid).toBe('US-600')
            expect(doc.items[1].supplierPid).toBe('OS-600')
        })

        it('maps DESCRIPTION_SHORT to item description', () => {
            const doc = parseOpenTransDocument(Buffer.from(ORDER_FIXTURE))
            expect(doc.items[0].description).toBe('Unterschrank 60 cm')
        })

        it('extracts quantity and order unit from items', () => {
            const doc = parseOpenTransDocument(Buffer.from(ORDER_FIXTURE))
            expect(doc.items[0].qty).toBe(3)
            expect(doc.items[0].orderUnit).toBe('C62')
        })

        it('extracts price amount and currency from PRODUCT_PRICE_FIX', () => {
            const doc = parseOpenTransDocument(Buffer.from(ORDER_FIXTURE))
            expect(doc.items[0].priceAmount).toBe(199.9)
            expect(doc.items[0].priceCurrency).toBe('EUR')
        })

        it('extracts line net amount from LINE_AMOUNT', () => {
            const doc = parseOpenTransDocument(Buffer.from(ORDER_FIXTURE))
            expect(doc.items[0].lineNetAmount).toBeCloseTo(599.7)
            expect(doc.items[1].lineNetAmount).toBeCloseTo(498.0)
        })

        it('extracts DELIVERY_DATE from ORDER_ITEM', () => {
            const doc = parseOpenTransDocument(Buffer.from(ORDER_FIXTURE))
            expect(doc.items[0].deliveryDate).toBe('2024-04-15')
            expect(doc.items[1].deliveryDate).toBeUndefined()
        })

        it('extracts ORDER_SUMMARY totals', () => {
            const doc = parseOpenTransDocument(Buffer.from(ORDER_FIXTURE))
            expect(doc.totalItemCount).toBe(2)
            expect(doc.totalAmount).toBeCloseTo(1097.7)
        })
    })

    describe('parseOpenTransDocument – INVOICE', () => {
        it('detects INVOICE document type', () => {
            const doc = parseOpenTransDocument(Buffer.from(INVOICE_FIXTURE))
            expect(doc.documentType).toBe('INVOICE')
        })

        it('extracts INVOICE_ID and INVOICE_DATE', () => {
            const doc = parseOpenTransDocument(Buffer.from(INVOICE_FIXTURE))
            expect(doc.documentId).toBe('INV-2024-0042')
            expect(doc.documentDate).toBe('2024-03-15')
        })

        it('extracts invoice items', () => {
            const doc = parseOpenTransDocument(Buffer.from(INVOICE_FIXTURE))
            expect(doc.items).toHaveLength(1)
            expect(doc.items[0].supplierPid).toBe('US-600')
            expect(doc.items[0].qty).toBe(3)
            expect(doc.items[0].priceAmount).toBe(199.9)
        })

        it('extracts INVOICE_SUMMARY totals', () => {
            const doc = parseOpenTransDocument(Buffer.from(INVOICE_FIXTURE))
            expect(doc.totalItemCount).toBe(1)
            expect(doc.totalAmount).toBeCloseTo(599.7)
        })
    })

    describe('parseOpenTransDocument – ORDERRESPONSE', () => {
        it('extracts ORDERRESPONSE item list and summary', () => {
            const doc = parseOpenTransDocument(Buffer.from(ORDERRESPONSE_FIXTURE))

            expect(doc.documentType).toBe('ORDERRESPONSE')
            expect(doc.documentId).toBe('ORSP-2024-0001')
            expect(doc.documentDate).toBe('2024-03-20')
            expect(doc.items).toHaveLength(1)
            expect(doc.items[0].supplierPid).toBe('US-600')
            expect(doc.totalItemCount).toBe(1)
            expect(doc.totalAmount).toBeCloseTo(599.7)
        })
    })

    describe('parseOpenTransDocument – error handling', () => {
        it('throws for unknown document types', () => {
            const xml = `<?xml version="1.0" encoding="UTF-8"?>
<UNKNOWN_DOC version="1.0">
  <UNKNOWN_HEADER></UNKNOWN_HEADER>
</UNKNOWN_DOC>`
            expect(() => parseOpenTransDocument(Buffer.from(xml))).toThrow(
                /Unsupported openTRANS document type/,
            )
        })
    })
})
