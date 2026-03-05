import { XMLParser } from 'fast-xml-parser'
import iconv from 'iconv-lite'
import type { RawArticle } from './catalogImporter.js'

/**
 * BMEcat XML catalog format parser.
 *
 * Supports BMEcat 1.2 and BMEcat 2005 – the XML-based catalog data exchange
 * standard widely used in German-speaking e-commerce and the kitchen trade.
 *
 * Reference: BME (Bundesverband Materialwirtschaft, Einkauf und Logistik)
 */

export interface BmecatHeader {
    supplierName: string
    supplierId?: string
    catalogId?: string
    catalogVersion?: string
    catalogName?: string
    generationDate?: string
}

export interface BmecatImportResult {
    header: BmecatHeader
    articles: RawArticle[]
}

/** Maps well-known BMEcat FEATURE names to RawArticle dimension fields (mm). */
const DIMENSION_FEATURE_MAP: Record<string, 'widthMm' | 'depthMm' | 'heightMm'> = {
    breite: 'widthMm',
    width: 'widthMm',
    width_mm: 'widthMm',
    tiefe: 'depthMm',
    depth: 'depthMm',
    depth_mm: 'depthMm',
    höhe: 'heightMm',
    hoehe: 'heightMm',
    height: 'heightMm',
    height_mm: 'heightMm',
}

/** Maps common BMEcat CATALOG_STRUCTURE or PRODUCT_GROUP names to OKP article types. */
const ARTICLE_TYPE_MAP: Record<string, string> = {
    unterschrank: 'base_cabinet',
    us: 'base_cabinet',
    base: 'base_cabinet',
    oberschrank: 'wall_cabinet',
    os: 'wall_cabinet',
    wall: 'wall_cabinet',
    hochschrank: 'tall_cabinet',
    hs: 'tall_cabinet',
    tall: 'tall_cabinet',
    arbeitsplatte: 'worktop',
    worktop: 'worktop',
    abdeckplatte: 'worktop',
    gerät: 'appliance',
    appliance: 'appliance',
    geraet: 'appliance',
    zubehör: 'accessory',
    zubehoe: 'accessory',
    accessory: 'accessory',
    blende: 'trim',
    trim: 'trim',
    leiste: 'trim',
}

function inferArticleType(groupOrDesc: string | undefined): string {
    if (!groupOrDesc) return 'base_cabinet'
    const lower = groupOrDesc.toLowerCase().replace(/[^a-züäöß]+/g, '')
    for (const [key, type] of Object.entries(ARTICLE_TYPE_MAP)) {
        if (lower.includes(key)) return type
    }
    return 'base_cabinet'
}

function parseBmecatXml(buffer: Buffer): any {
    const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '@_',
        parseAttributeValue: true,
        parseTagValue: false,
        isArray: (name) =>
            ['PRODUCT', 'FEATURE', 'PRODUCT_PRICE', 'PRODUCT_REFERENCE'].includes(name),
    })

    let xmlStr = buffer.toString('utf8')
    if (xmlStr.includes('encoding="ISO-8859-1"') || xmlStr.includes("encoding='ISO-8859-1'")) {
        xmlStr = iconv.decode(buffer, 'win1252')
    }

    return parser.parse(xmlStr)
}

function extractHeader(root: any): BmecatHeader {
    const header = root?.HEADER || {}
    const supplier = header.SUPPLIER || {}
    const catalog = header.CATALOG || {}

    const catalogDatetime = catalog.DATETIME
    let generationDate: string | undefined
    if (catalogDatetime) {
        const dateNode = Array.isArray(catalogDatetime) ? catalogDatetime[0] : catalogDatetime
        generationDate = String(dateNode?.DATE || dateNode || '').trim() || undefined
    }

    return {
        supplierName: String(supplier.SUPPLIER_NAME || supplier['@_name'] || 'BMEcat-Vendor').trim(),
        supplierId: supplier.SUPPLIER_ID
            ? String(
                  Array.isArray(supplier.SUPPLIER_ID)
                      ? supplier.SUPPLIER_ID[0]?.['#text'] ?? supplier.SUPPLIER_ID[0]
                      : supplier.SUPPLIER_ID?.['#text'] ?? supplier.SUPPLIER_ID,
              ).trim() || undefined
            : undefined,
        catalogId: catalog.CATALOG_ID ? String(catalog.CATALOG_ID).trim() : undefined,
        catalogVersion: catalog.CATALOG_VERSION ? String(catalog.CATALOG_VERSION).trim() : undefined,
        catalogName: catalog.CATALOG_NAME ? String(catalog.CATALOG_NAME).trim() : undefined,
        generationDate,
    }
}

function extractFeatures(
    productFeatures: any,
): { widthMm?: number; depthMm?: number; heightMm?: number } {
    const dims: { widthMm?: number; depthMm?: number; heightMm?: number } = {}

    const featureBlocks = Array.isArray(productFeatures) ? productFeatures : [productFeatures]
    for (const block of featureBlocks) {
        if (!block) continue
        const features: any[] = Array.isArray(block.FEATURE) ? block.FEATURE : []
        for (const feature of features) {
            const fname = String(feature?.FNAME || '').trim().toLowerCase()
            const fvalue = feature?.FVALUE
            const funit = String(feature?.FUNIT || 'mm').trim().toLowerCase()

            const dimKey = DIMENSION_FEATURE_MAP[fname]
            if (dimKey && fvalue !== undefined) {
                let value = Number(fvalue)
                if (!Number.isFinite(value)) continue
                // Convert to mm if necessary
                if (funit === 'cm') value = value * 10
                else if (funit === 'm') value = value * 1000
                dims[dimKey] = value
            }
        }
    }

    return dims
}

function extractPrices(priceDetails: any): { listPrice: number; dealerPrice?: number } {
    const result = { listPrice: 0, dealerPrice: undefined as number | undefined }
    if (!priceDetails) return result

    const prices: any[] = Array.isArray(priceDetails.PRODUCT_PRICE)
        ? priceDetails.PRODUCT_PRICE
        : priceDetails.PRODUCT_PRICE
          ? [priceDetails.PRODUCT_PRICE]
          : []

    for (const price of prices) {
        const type = String(price['@_type'] || '').toLowerCase()
        const amount = Number(price.PRICE_AMOUNT)
        if (!Number.isFinite(amount)) continue

        if (type === 'net_list' || type === 'list') {
            result.listPrice = amount
        } else if (type === 'net_customer' || type === 'customer' || type === 'dealer') {
            result.dealerPrice = amount
        }
    }

    return result
}

function mapProduct(product: any, header: BmecatHeader): RawArticle {
    const sku = String(
        product.SUPPLIER_PID?.['#text'] ?? product.SUPPLIER_PID ?? product['@_id'] ?? 'unknown',
    ).trim()

    const details = product.PRODUCT_DETAILS || {}
    const name = String(details.DESCRIPTION_SHORT || details.PRODUCT_TITLE || sku).trim()
    const groupHint = String(details.PRODUCT_STATUS?.['@_type'] || details.ARTICLE_STATUS?.['@_type'] || '')
    const userDefinedExtensions = details.USER_DEFINED_EXTENSIONS || {}

    const productFeatures = product.PRODUCT_FEATURES
    const dims = extractFeatures(productFeatures)

    const priceDetails = product.PRODUCT_PRICE_DETAILS
    const { listPrice, dealerPrice } = extractPrices(priceDetails)

    const articleType = inferArticleType(
        userDefinedExtensions.UDX_PRODUCT_GROUP ?? groupHint ?? name,
    )

    return {
        sku,
        name,
        manufacturerCode: header.supplierId || header.supplierName,
        manufacturerName: header.supplierName,
        articleType,
        listPrice,
        dealerPrice,
        ...dims,
        meta_json: {
            bmecat_catalog_id: header.catalogId,
            bmecat_catalog_version: header.catalogVersion,
            bmecat_raw: product,
        },
    }
}

/**
 * Parses a BMEcat XML catalog file (version 1.2 or 2005) into RawArticle records.
 */
export function parseBmecatCatalog(buffer: Buffer): BmecatImportResult {
    const root = parseBmecatXml(buffer)
    const bmecat = root?.BMECAT || root

    const header = extractHeader(bmecat)

    // Products may be in T_NEW_CATALOG or T_UPDATE_PRODUCTS transaction blocks
    const transaction =
        bmecat?.T_NEW_CATALOG ??
        bmecat?.T_UPDATE_PRODUCTS ??
        bmecat?.T_DELETE_PRODUCTS ??
        {}

    const rawProducts = transaction?.PRODUCT
    if (!rawProducts) {
        return { header, articles: [] }
    }

    const productList: any[] = Array.isArray(rawProducts) ? rawProducts : [rawProducts]
    const articles = productList.map((product) => mapProduct(product, header))

    return { header, articles }
}
