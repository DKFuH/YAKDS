type QuotePdfItem = {
  position: number
  description: string
  qty: number
  unit: string
  unit_price_net: number
  line_net: number
  tax_rate: number
  line_gross?: number
  show_on_quote: boolean
}

type QuotePdfSnapshot = {
  subtotal_net?: number
  vat_amount?: number
  total_gross?: number
} | null | undefined

export type PdfSender = {
  company_name: string
  street?: string
  zip?: string
  city?: string
  phone?: string
  email?: string
  web?: string
  vat_id?: string
  tax_number?: string
  iban?: string
  bic?: string
  bank_name?: string
}

export type PdfRecipient = {
  name: string
  street?: string
  zip?: string
  city?: string
  email?: string
}

export type QuotePdfInput = {
  quote_number: string
  version: number
  valid_until: string | Date
  free_text: string | null
  footer_text: string | null
  items: QuotePdfItem[]
  price_snapshot?: QuotePdfSnapshot
  sender?: PdfSender
  recipient?: PdfRecipient
}

type PdfLine = {
  text: string
  size: number
}

function sanitizePdfText(value: string): string {
  return value
    .replace(/[\r\n]+/g, ' ')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .trim()
}

function escapePdfText(value: string): string {
  return sanitizePdfText(value)
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
}

function formatDate(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? 'unbekannt' : date.toLocaleDateString('de-DE')
}

function formatAmount(value: number): string {
  return `${value.toFixed(2)} EUR`
}

function wrapText(value: string, maxChars: number): string[] {
  const sanitized = sanitizePdfText(value)
  if (!sanitized) {
    return []
  }

  const words = sanitized.split(/\s+/)
  const lines: string[] = []
  let currentLine = ''

  for (const word of words) {
    const candidate = currentLine ? `${currentLine} ${word}` : word
    if (candidate.length <= maxChars) {
      currentLine = candidate
      continue
    }

    if (currentLine) {
      lines.push(currentLine)
    }
    currentLine = word
  }

  if (currentLine) {
    lines.push(currentLine)
  }

  return lines
}

function toVisibleItems(items: QuotePdfItem[]): QuotePdfItem[] {
  return items.filter((item) => item.show_on_quote !== false)
}

function resolveTotals(items: QuotePdfItem[], snapshot?: QuotePdfSnapshot) {
  if (
    snapshot &&
    typeof snapshot.subtotal_net === 'number' &&
    typeof snapshot.vat_amount === 'number' &&
    typeof snapshot.total_gross === 'number'
  ) {
    return {
      subtotalNet: snapshot.subtotal_net,
      vatAmount: snapshot.vat_amount,
      totalGross: snapshot.total_gross,
    }
  }

  const subtotalNet = items.reduce((sum, item) => sum + item.line_net, 0)
  const totalGross = items.reduce(
    (sum, item) => sum + (typeof item.line_gross === 'number' ? item.line_gross : item.line_net * (1 + item.tax_rate)),
    0,
  )

  return {
    subtotalNet,
    vatAmount: totalGross - subtotalNet,
    totalGross,
  }
}

function renderItemLines(item: QuotePdfItem): PdfLine[] {
  const descriptionLines = wrapText(item.description, 42)
  const firstDescription = descriptionLines[0] ?? ''
  const remainingDescriptions = descriptionLines.slice(1)
  const prefix = `${String(item.position).padStart(2, '0')}  `
  const detail = `${item.qty} ${item.unit}  EP ${formatAmount(item.unit_price_net)}  GP ${formatAmount(item.line_net)}`

  const lines: PdfLine[] = [
    {
      text: `${prefix}${firstDescription}  ${detail}`,
      size: 11,
    },
  ]

  remainingDescriptions.forEach((line) => {
    lines.push({
      text: `    ${line}`,
      size: 11,
    })
  })

  return lines
}

function renderQuoteLines(input: QuotePdfInput): PdfLine[] {
  const visibleItems = toVisibleItems(input.items)
  const totals = resolveTotals(visibleItems, input.price_snapshot)
  const lines: PdfLine[] = []

  // Kopfzeile mit Firmendaten (links) und Angebotsdaten (rechts)
  if (input.sender) {
    lines.push({ text: input.sender.company_name, size: 18 })
    const addrParts: string[] = []
    if (input.sender.street) addrParts.push(input.sender.street)
    const cityLine = [input.sender.zip, input.sender.city].filter(Boolean).join(' ')
    if (cityLine) addrParts.push(cityLine)
    if (input.sender.phone) addrParts.push(`Tel: ${input.sender.phone}`)
    if (input.sender.web) addrParts.push(input.sender.web)
    addrParts.forEach((part) => lines.push({ text: part, size: 9 }))
    lines.push({ text: '', size: 9 })
  }

  lines.push({ text: `ANGEBOT ${input.quote_number}`, size: 16 })
  lines.push({ text: `Version ${input.version}`, size: 11 })
  lines.push({ text: `Gueltig bis: ${formatDate(input.valid_until)}`, size: 11 })
  lines.push({ text: '', size: 11 })

  // Empfängerblock
  if (input.recipient) {
    if (input.sender) {
      const senderMini = [input.sender.company_name, input.sender.street, [input.sender.zip, input.sender.city].filter(Boolean).join(' ')].filter(Boolean).join(' · ')
      lines.push({ text: senderMini, size: 7 })
    }
    lines.push({ text: input.recipient.name, size: 10 })
    if (input.recipient.street) lines.push({ text: input.recipient.street, size: 10 })
    const recipientCity = [input.recipient.zip, input.recipient.city].filter(Boolean).join(' ')
    if (recipientCity) lines.push({ text: recipientCity, size: 10 })
    lines.push({ text: '', size: 10 })
  }

  wrapText(input.free_text ?? '', 88).forEach((line) => {
    lines.push({ text: line, size: 11 })
  })

  if (input.free_text) {
    lines.push({ text: '', size: 11 })
  }

  lines.push({ text: 'Positionen', size: 13 })

  if (visibleItems.length === 0) {
    lines.push({ text: 'Keine sichtbaren Positionen vorhanden.', size: 11 })
  } else {
    visibleItems.forEach((item) => {
      lines.push(...renderItemLines(item))
    })
  }

  lines.push({ text: '', size: 11 })
  lines.push({ text: `Zwischensumme netto: ${formatAmount(totals.subtotalNet)}`, size: 11 })
  lines.push({ text: `MwSt 19%: ${formatAmount(totals.vatAmount)}`, size: 11 })
  lines.push({ text: `Gesamtbetrag brutto: ${formatAmount(totals.totalGross)}`, size: 12 })

  // Fußzeile: Bankverbindung + USt + quote_footer / footer_text
  const hasBankInfo = input.sender && (input.sender.bank_name || input.sender.iban || input.sender.bic)
  const hasTaxInfo = input.sender && (input.sender.vat_id || input.sender.tax_number)
  if (hasBankInfo || hasTaxInfo) {
    lines.push({ text: '', size: 11 })
    if (hasBankInfo && input.sender) {
      const bankParts: string[] = []
      if (input.sender.bank_name) bankParts.push(input.sender.bank_name)
      if (input.sender.iban) bankParts.push(`IBAN ${input.sender.iban}`)
      if (input.sender.bic) bankParts.push(`BIC ${input.sender.bic}`)
      lines.push({ text: bankParts.join(' · '), size: 9 })
    }
    if (hasTaxInfo && input.sender) {
      const taxParts: string[] = []
      if (input.sender.vat_id) taxParts.push(`USt-IdNr: ${input.sender.vat_id}`)
      if (input.sender.tax_number) taxParts.push(`St-Nr: ${input.sender.tax_number}`)
      lines.push({ text: taxParts.join(' | '), size: 9 })
    }
  }

  const effectiveFooter = input.footer_text ?? null
  const footerLines = wrapText(effectiveFooter ?? '', 88)
  if (footerLines.length > 0) {
    lines.push({ text: '', size: 11 })
    footerLines.forEach((line) => {
      lines.push({ text: line, size: 11 })
    })
  }

  return lines
}

function paginate(lines: PdfLine[]): PdfLine[][] {
  const pages: PdfLine[][] = []
  let currentPage: PdfLine[] = []
  let lineBudget = 0

  lines.forEach((line) => {
    const cost = line.size >= 16 ? 2 : 1

    if (lineBudget + cost > 42 && currentPage.length > 0) {
      pages.push(currentPage)
      currentPage = []
      lineBudget = 0
    }

    currentPage.push(line)
    lineBudget += cost
  })

  if (currentPage.length > 0) {
    pages.push(currentPage)
  }

  return pages
}

function buildContentStream(lines: PdfLine[]): string {
  const commands = ['BT']
  let y = 790

  lines.forEach((line) => {
    if (!line.text) {
      y -= 14
      return
    }

    commands.push(`/F1 ${line.size} Tf`)
    commands.push(`1 0 0 1 50 ${y} Tm`)
    commands.push(`(${escapePdfText(line.text)}) Tj`)
    y -= line.size >= 16 ? 22 : 14
  })

  commands.push('ET')
  return commands.join('\n')
}

function toPdfBuffer(contentStreams: string[]): Buffer {
  const objects: string[] = []
  const pageRefs: string[] = []

  objects.push('<< /Type /Catalog /Pages 2 0 R >>')
  objects.push(`<< /Type /Pages /Count ${contentStreams.length} /Kids [${contentStreams.map((_, index) => `${4 + index * 2} 0 R`).join(' ')}] >>`)
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>')

  contentStreams.forEach((stream, index) => {
    const pageObjectId = 4 + index * 2
    const contentObjectId = pageObjectId + 1
    pageRefs.push(`${pageObjectId} 0 R`)

    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentObjectId} 0 R >>`,
    )
    objects.push(`<< /Length ${Buffer.byteLength(stream, 'utf8')} >>\nstream\n${stream}\nendstream`)
  })

  let pdf = '%PDF-1.4\n'
  const offsets = [0]

  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf, 'utf8'))
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`
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

export function buildQuotePdf(input: QuotePdfInput): Buffer {
  const lines = renderQuoteLines(input)
  const pages = paginate(lines)
  const contentStreams = pages.map((page) => buildContentStream(page))
  return toPdfBuffer(contentStreams)
}
