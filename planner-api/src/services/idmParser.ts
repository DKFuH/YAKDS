import { XMLParser } from 'fast-xml-parser'
import iconv from 'iconv-lite'
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
    const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '@_',
        parseAttributeValue: true,
    })

    // Try to find encoding in XML prolog or default to ISO-8859-1 then UTF-8
    let xmlStr = buffer.toString('utf8')
    if (xmlStr.includes('encoding="ISO-8859-1"')) {
        xmlStr = iconv.decode(buffer, 'win1252') // Windows-1252 is broad for ISO-8859-1
    }

    const jsonObj = parser.parse(xmlStr)

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
        // IDM standard mapping:
        // IDN = SKU
        // BEZ (BEZ1, BEZ2) = Name
        // BRE = Width
        // TIE = Depth
        // HOE = Height
        const sku = String(pos.IDN || pos['@_IDN'] || 'unknown')
        const name = String(pos.BEZ || pos.BEZ1 || pos['@_BEZ'] || sku)

        return {
            sku,
            name,
            manufacturerCode,
            manufacturerName,
            articleType: String(pos.GRP || pos['@_GRP'] || 'cabinet'),
            listPrice: 0, // IDM stores prices in .PRE files usually
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
