import { XMLParser } from 'fast-xml-parser'
import iconv from 'iconv-lite'

/**
 * openTRANS XML business document parser.
 *
 * openTRANS is an XML standard maintained by BME for electronic business
 * documents (orders, order confirmations, invoices, delivery notes) between
 * manufacturers and dealers in German-speaking markets.
 *
 * Supported document types: ORDER, ORDERRESPONSE, INVOICE, DISPATCHNOTIFICATION
 *
 * Reference: https://www.bme.de/initiativen/bme-standards/opentrans/
 */

export type OpenTransDocumentType = 'ORDER' | 'ORDERRESPONSE' | 'INVOICE' | 'DISPATCHNOTIFICATION' | 'unknown'

export interface OpenTransParty {
    id: string
    name?: string
    role: string
}

export interface OpenTransOrderItem {
    lineItemId: string
    supplierPid: string
    description?: string
    qty: number
    orderUnit: string
    priceAmount: number
    priceCurrency: string
    lineNetAmount?: number
    deliveryDate?: string
    notes?: string
}

export interface OpenTransDocument {
    documentType: OpenTransDocumentType
    documentId: string
    documentDate?: string
    buyerParty?: OpenTransParty
    supplierParty?: OpenTransParty
    items: OpenTransOrderItem[]
    totalItemCount?: number
    totalAmount?: number
}

function parseOpenTransXml(buffer: Buffer): any {
    const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '@_',
        parseAttributeValue: true,
        isArray: (name) =>
            ['ORDER_ITEM', 'INVOICE_ITEM', 'DISPATCHNOTIFICATION_ITEM', 'PARTY'].includes(name),
    })

    let xmlStr = buffer.toString('utf8')
    if (xmlStr.includes('encoding="ISO-8859-1"') || xmlStr.includes("encoding='ISO-8859-1'")) {
        xmlStr = iconv.decode(buffer, 'win1252')
    }

    return parser.parse(xmlStr)
}

function detectDocumentType(root: any): OpenTransDocumentType {
    if (root.ORDER) return 'ORDER'
    if (root.ORDERRESPONSE) return 'ORDERRESPONSE'
    if (root.INVOICE) return 'INVOICE'
    if (root.DISPATCHNOTIFICATION) return 'DISPATCHNOTIFICATION'
    return 'unknown'
}

function extractParty(node: any, role: string): OpenTransParty | undefined {
    if (!node) return undefined

    const partyId = String(
        node.PARTY_ID?.['#text'] ?? node.PARTY_ID ?? node.PARTY_IDS?.PARTY_ID?.['#text'] ?? node.PARTY_IDS?.PARTY_ID ?? '',
    ).trim()

    const partyName = String(
        node.PARTY_NAME?.NAME ?? node.PARTY_NAME ?? node.ADDRESS?.NAME ?? '',
    ).trim() || undefined

    if (!partyId && !partyName) return undefined

    return { id: partyId, name: partyName || undefined, role }
}

function extractPartiesFromHeader(header: any): {
    buyerParty?: OpenTransParty
    supplierParty?: OpenTransParty
} {
    const parties = header?.ORDER_PARTIES ?? header?.INVOICE_PARTIES ?? header?.PARTIES ?? {}

    // openTRANS parties may be an array or a direct object per role
    const partyList: any[] = Array.isArray(parties.PARTY) ? parties.PARTY : []
    let buyerParty: OpenTransParty | undefined
    let supplierParty: OpenTransParty | undefined

    if (partyList.length > 0) {
        for (const party of partyList) {
            const roles: string[] = Array.isArray(party.PARTY_ROLE) ? party.PARTY_ROLE : [party.PARTY_ROLE ?? '']
            for (const role of roles) {
                const roleStr = String(role).toLowerCase()
                if (roleStr === 'buyer') {
                    buyerParty = extractParty(party, 'buyer')
                } else if (roleStr === 'supplier') {
                    supplierParty = extractParty(party, 'supplier')
                }
            }
        }
    } else {
        // Fallback: look for BUYER_PARTY / SUPPLIER_PARTY child elements
        buyerParty = extractParty(parties.BUYER_PARTY, 'buyer')
        supplierParty = extractParty(parties.SUPPLIER_PARTY, 'supplier')
    }

    return { buyerParty, supplierParty }
}

function extractOrderInfo(header: any): { documentId: string; documentDate?: string } {
    const orderInfo =
        header?.ORDER_INFO ??
        header?.INVOICE_INFO ??
        header?.ORDERRESPONSE_INFO ??
        header?.DISPATCHNOTIFICATION_INFO ??
        {}

    const documentId = String(
        orderInfo.ORDER_ID ??
        orderInfo.INVOICE_ID ??
        orderInfo.ORDERRESPONSE_ID ??
        orderInfo.DISPATCHNOTIFICATION_ID ??
        'unknown',
    ).trim()

    const dateNode =
        orderInfo.ORDER_DATE ??
        orderInfo.INVOICE_DATE ??
        orderInfo.ORDERRESPONSE_DATE ??
        orderInfo.DISPATCHNOTIFICATION_DATE

    const documentDate = dateNode ? String(dateNode).trim() : undefined

    return { documentId, documentDate }
}

function extractItemPrice(item: any): { priceAmount: number; priceCurrency: string; lineNetAmount?: number } {
    const priceFix = item.PRODUCT_PRICE_FIX ?? item.PRICE_LINE_AMOUNT ?? {}
    const priceAmount = Number(priceFix.PRICE_AMOUNT ?? item.UNIT_PRICE ?? 0)
    const priceCurrency = String(priceFix.PRICE_CURRENCY ?? item.PRICE_CURRENCY ?? 'EUR').trim()
    const lineNetAmount = item.LINE_AMOUNT !== undefined ? Number(item.LINE_AMOUNT) : undefined

    return {
        priceAmount: Number.isFinite(priceAmount) ? priceAmount : 0,
        priceCurrency,
        lineNetAmount: lineNetAmount !== undefined && Number.isFinite(lineNetAmount) ? lineNetAmount : undefined,
    }
}

function extractItem(item: any): OpenTransOrderItem | null {
    const lineItemId = String(item.LINE_ITEM_ID ?? item['@_line_item_id'] ?? '').trim()
    const product = item.PRODUCT ?? item.ARTICLE ?? {}
    const supplierPid = String(
        product.SUPPLIER_PID?.['#text'] ?? product.SUPPLIER_PID ?? product.ARTICLE_ID?.SUPPLIER_PID ?? '',
    ).trim()

    if (!supplierPid) return null

    const description = String(
        product.DESCRIPTION_SHORT ?? product.ARTICLE_DESCRIPTION?.DESCRIPTION_SHORT ?? '',
    ).trim() || undefined

    const qty = Number(item.QUANTITY ?? item.ORDERED_QUANTITY ?? 0)
    const orderUnit = String(item.ORDER_UNIT ?? item.ARTICLE_ORDER_DETAILS?.ORDER_UNIT ?? 'C62').trim()
    const { priceAmount, priceCurrency, lineNetAmount } = extractItemPrice(item)

    const deliveryNode = item.DELIVERY_DATE ?? item.REQUESTED_DELIVERY_DATE
    const deliveryDate = deliveryNode ? String(deliveryNode?.DATE ?? deliveryNode).trim() : undefined

    const notes = item.REMARKS ? String(item.REMARKS).trim() : undefined

    return {
        lineItemId,
        supplierPid,
        description,
        qty: Number.isFinite(qty) ? qty : 0,
        orderUnit,
        priceAmount,
        priceCurrency,
        lineNetAmount,
        deliveryDate,
        notes,
    }
}

function extractItems(docRoot: any, docType: OpenTransDocumentType): OpenTransOrderItem[] {
    const itemListKey =
        docType === 'INVOICE' ? 'INVOICE_ITEM_LIST' :
        docType === 'ORDERRESPONSE' ? 'ORDERRESPONSE_ITEM_LIST' :
        docType === 'DISPATCHNOTIFICATION' ? 'DISPATCHNOTIFICATION_ITEM_LIST' :
        'ORDER_ITEM_LIST'

    const itemKey =
        docType === 'INVOICE' ? 'INVOICE_ITEM' :
        docType === 'ORDERRESPONSE' ? 'ORDERRESPONSE_ITEM' :
        docType === 'DISPATCHNOTIFICATION' ? 'DISPATCHNOTIFICATION_ITEM' :
        'ORDER_ITEM'

    const itemList = docRoot[itemListKey] ?? {}
    const rawItems: any[] = Array.isArray(itemList[itemKey])
        ? itemList[itemKey]
        : itemList[itemKey]
          ? [itemList[itemKey]]
          : []

    return rawItems.map(extractItem).filter((item): item is OpenTransOrderItem => item !== null)
}

function extractSummary(docRoot: any, docType: OpenTransDocumentType): { totalItemCount?: number; totalAmount?: number } {
    const summaryKey =
        docType === 'INVOICE' ? 'INVOICE_SUMMARY' :
        docType === 'ORDERRESPONSE' ? 'ORDERRESPONSE_SUMMARY' :
        docType === 'DISPATCHNOTIFICATION' ? 'DISPATCHNOTIFICATION_SUMMARY' :
        'ORDER_SUMMARY'

    const summary = docRoot[summaryKey] ?? {}

    const totalItemCount = summary.TOTAL_ITEM_NUM !== undefined ? Number(summary.TOTAL_ITEM_NUM) : undefined
    const totalAmount = summary.TOTAL_AMOUNT !== undefined ? Number(summary.TOTAL_AMOUNT) : undefined

    return {
        totalItemCount: totalItemCount !== undefined && Number.isFinite(totalItemCount) ? totalItemCount : undefined,
        totalAmount: totalAmount !== undefined && Number.isFinite(totalAmount) ? totalAmount : undefined,
    }
}

/**
 * Parses an openTRANS XML business document (ORDER, ORDERRESPONSE, INVOICE,
 * or DISPATCHNOTIFICATION) into a structured representation.
 */
export function parseOpenTransDocument(buffer: Buffer): OpenTransDocument {
    const root = parseOpenTransXml(buffer)

    const docType = detectDocumentType(root)
    if (docType === 'unknown') {
        throw new Error('Unsupported openTRANS document type. Expected ORDER, ORDERRESPONSE, INVOICE, or DISPATCHNOTIFICATION.')
    }

    const docRoot = root[docType]
    const headerKey =
        docType === 'ORDER' ? 'ORDER_HEADER' :
        docType === 'ORDERRESPONSE' ? 'ORDERRESPONSE_HEADER' :
        docType === 'INVOICE' ? 'INVOICE_HEADER' :
        'DISPATCHNOTIFICATION_HEADER'

    const header = docRoot[headerKey] ?? {}

    const { documentId, documentDate } = extractOrderInfo(header)
    const { buyerParty, supplierParty } = extractPartiesFromHeader(header)
    const items = extractItems(docRoot, docType)
    const { totalItemCount, totalAmount } = extractSummary(docRoot, docType)

    return {
        documentType: docType,
        documentId,
        documentDate,
        buyerParty,
        supplierParty,
        items,
        totalItemCount,
        totalAmount,
    }
}
