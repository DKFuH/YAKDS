import type { PrismaClient } from '@prisma/client'

export interface SpecificationSectionResult {
  key: string
  title: string
  page_count: number
  artifact_type: 'pdf' | 'csv' | 'dxf' | 'json'
}

type PackageConfig = {
  sections?: string[]
  include_cover_page?: boolean
  include_company_profile?: boolean
}

function escapePdfText(value: string): string {
  return value
    .replace(/[\r\n]+/g, ' ')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .trim()
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
}

function toPdfBuffer(pageLines: string[][]): Buffer {
  const objects: string[] = []

  objects.push('<< /Type /Catalog /Pages 2 0 R >>')
  objects.push(
    `<< /Type /Pages /Count ${pageLines.length} /Kids [${pageLines
      .map((_, i) => `${4 + i * 2} 0 R`)
      .join(' ')}] >>`,
  )
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>')

  for (const lines of pageLines) {
    const commands: string[] = ['BT', '/F1 13 Tf']
    let y = 790
    for (const line of lines) {
      commands.push(`1 0 0 1 50 ${y} Tm`)
      commands.push(`(${escapePdfText(line)}) Tj`)
      y -= 22
    }
    commands.push('ET')

    const stream = commands.join('\n')
    const pageObjectId = objects.length + 1
    const contentObjectId = pageObjectId + 1

    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentObjectId} 0 R >>`,
    )
    objects.push(`<< /Length ${Buffer.byteLength(stream, 'utf8')} >>\nstream\n${stream}\nendstream`)
  }

  let pdf = '%PDF-1.4\n'
  const offsets: number[] = [0]

  objects.forEach((obj, i) => {
    offsets.push(Buffer.byteLength(pdf, 'utf8'))
    pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`
  })

  const xrefOffset = Buffer.byteLength(pdf, 'utf8')
  pdf += `xref\n0 ${objects.length + 1}\n`
  pdf += '0000000000 65535 f \n'
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`
  })
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`

  return Buffer.from(pdf, 'utf8')
}

function resolveSections(config: PackageConfig): string[] {
  const defaults = ['quote', 'bom', 'cutlist', 'layout_sheets']
  const input = Array.isArray(config.sections) ? config.sections : defaults
  return input.filter((value): value is string => typeof value === 'string' && value.length > 0)
}

export async function generateSpecificationPackage(
  prisma: PrismaClient,
  projectId: string,
  packageId: string,
  config: PackageConfig,
): Promise<{
  merged_pdf: Buffer
  sections: SpecificationSectionResult[]
}> {
  const sections = resolveSections(config)
  const summary: SpecificationSectionResult[] = []

  const quoteCount = await prisma.quote.count({ where: { project_id: projectId } })
  const roomCount = await prisma.room.count({ where: { project_id: projectId } })
  const cutlistCount = await prisma.cutlist.count({ where: { project_id: projectId } })
  const nestingCount = await prisma.nestingJob.count({ where: { project_id: projectId } })
  const sheetCount = await prisma.layoutSheet.count({ where: { project_id: projectId } })

  for (const section of sections) {
    if (section === 'quote' && quoteCount > 0) {
      summary.push({ key: 'quote', title: 'Angebot', page_count: 1, artifact_type: 'pdf' })
      continue
    }

    if (section === 'bom' && roomCount > 0) {
      summary.push({ key: 'bom', title: 'Stückliste', page_count: 1, artifact_type: 'pdf' })
      continue
    }

    if (section === 'cutlist' && cutlistCount > 0) {
      summary.push({ key: 'cutlist', title: 'Zuschnittliste', page_count: 1, artifact_type: 'pdf' })
      continue
    }

    if (section === 'layout_sheets' && sheetCount > 0) {
      summary.push({ key: 'layout_sheets', title: 'Layout-Sheets', page_count: 1, artifact_type: 'pdf' })
      continue
    }

    if (section === 'nesting' && nestingCount > 0) {
      summary.push({ key: 'nesting', title: 'Nesting-Anlagen', page_count: 1, artifact_type: 'json' })
    }
  }

  const pages: string[][] = []

  if (config.include_cover_page !== false) {
    pages.push([
      'Werkstattpaket',
      `Projekt: ${projectId}`,
      `Paket: ${packageId}`,
      `Generiert am: ${new Date().toLocaleString('de-DE')}`,
    ])
  }

  for (const item of summary) {
    if (item.artifact_type !== 'pdf') continue
    pages.push([
      item.title,
      `Section-Key: ${item.key}`,
      'V1-Referenzseite fuer Spezifikationspakete',
    ])
  }

  if (pages.length === 0) {
    pages.push([
      'Werkstattpaket',
      'Keine druckbaren Abschnitte vorhanden',
      'Bitte Paketkonfiguration oder Projektdaten prüfen',
    ])
  }

  return {
    merged_pdf: toPdfBuffer(pages),
    sections: summary,
  }
}
