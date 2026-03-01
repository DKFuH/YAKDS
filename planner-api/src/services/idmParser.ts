import { XMLParser } from 'fast-xml-parser'
import iconv from 'iconv-lite'
import AdmZip from 'adm-zip'
import type { RawArticle } from './catalogImporter.js'

export interface IdmImportInput {
    filename: string
    buffer: Buffer
}

/**
 * Basic IDM Article (.ART) Parser
 * Handles typical German kitchen IDM XML structure.
 * Supports ISO-8859-1 (Common in IDM) and UTF-8.
 */
export async function parseIdmArticles(buffer: Buffer): Promise<RawArticle[]> {
    const jsonObj = parseIdmXml(buffer)

    // Typical IDM ART structure: <ART><KAT><POS>... or <IDM><KAT><POS>...
    const root = jsonObj?.ART || jsonObj?.IDM || jsonObj
    const catalog = root?.KAT
    const posList = catalog?.POS

    if (!posList) {
        throw new Error('No articles (POS) found in IDM file.')
    }

    const items = Array.isArray(posList) ? posList : [posList]
    const manufacturerCode = catalog?.['@_HES'] || 'IDM-VENDOR'
    const manufacturerName = catalog?.['@_KATBEZ'] || 'IDM Catalogue'

    return items.map((pos: any) => {
        const sku = String(pos.IDN || pos['@_IDN'] || 'unknown')
        const name = String(pos.BEZ || pos.BEZ1 || pos['@_BEZ'] || sku)

        return {
            sku,
            name,
            manufacturerCode,
            manufacturerName,
            articleType: String(pos.GRP || pos['@_GRP'] || 'base_cabinet'),
            listPrice: 0,
            widthMm: Number(pos.BRE || pos['@_BRE'] || 0),
            depthMm: Number(pos.TIE || pos['@_TIE'] || 0),
            heightMm: Number(pos.HOE || pos['@_HOE'] || 0),
            meta_json: {
                idm_raw: pos,
                idm_catalog_date: catalog?.['@_KATDAT'],
                idm_catalog_version: catalog?.['@_KATVER'],
            },
        }
    })
}

/**
 * Parses IDM Price (.PRE) XML files to a map of { SKU -> priceData }
 */
export function parseIdmPrices(buffer: Buffer): Map<string, { list_net: number; dealer_net?: number }> {
    const jsonObj = parseIdmXml(buffer)
    const root = jsonObj?.PRE || jsonObj?.IDM || jsonObj
    const catalog = root?.KAT
    const posList = catalog?.POS

    const priceMap = new Map<string, { list_net: number; dealer_net?: number }>()
    if (!posList) return priceMap

    const items = Array.isArray(posList) ? posList : [posList]
    items.forEach((pos: any) => {
        const sku = String(pos.IDN || pos['@_IDN'] || 'unknown')
        // IDM fields might vary: PST is common for price data
        const priceTag = pos.PST || pos
        const listNet = Number(priceTag.LISTNET || priceTag['@_LISTNET'] || 0)
        const dealerNet = priceTag.DEALERNET || priceTag['@_DEALERNET']
            ? Number(priceTag.DEALERNET || priceTag['@_DEALERNET'])
            : undefined

        priceMap.set(sku, { list_net: listNet, dealer_net: dealerNet })
    })

    return priceMap
}

/**
 * Handles ZIP container with .ART and .PRE files
 */
export async function parseIdmZip(zipBuffer: Buffer): Promise<RawArticle[]> {
    const zip = new AdmZip(zipBuffer)
    const zipEntries = zip.getEntries()

    let artBuffer: Buffer | undefined
    let preBuffer: Buffer | undefined

    zipEntries.forEach((entry) => {
        const name = entry.entryName.toLowerCase()
        if (name.endsWith('.art')) {
            artBuffer = entry.getData()
        } else if (name.endsWith('.pre')) {
            preBuffer = entry.getData()
        }
    })

    if (!artBuffer) {
        throw new Error('ZIP file contains no .ART article data.')
    }

    const articles = await parseIdmArticles(artBuffer)
    if (preBuffer) {
        const prices = parseIdmPrices(preBuffer)
        articles.forEach((art) => {
            const price = prices.get(art.sku)
            if (price) {
                art.listPrice = price.list_net
                art.dealerPrice = price.dealer_net
            }
        })
    }

    return articles
}

function parseIdmXml(buffer: Buffer): any {
    const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '@_',
        parseAttributeValue: true,
    })

    let xmlStr = buffer.toString('utf8')
    if (xmlStr.includes('encoding="ISO-8859-1"')) {
        xmlStr = iconv.decode(buffer, 'win1252')
    }

    return parser.parse(xmlStr)
}
