import { describe, expect, it } from 'vitest'

import { buildQuotePdf } from './pdfGenerator.js'

describe('buildQuotePdf', () => {
  it('creates a pdf document with quote header, totals and visible items', () => {
    const pdf = buildQuotePdf({
      quote_number: 'ANG-2026-0004',
      version: 4,
      valid_until: '2026-03-31T00:00:00.000Z',
      free_text: 'Projekt fuer Musterkunde',
      footer_text: 'Vielen Dank fuer Ihr Interesse.',
      price_snapshot: {
        subtotal_net: 500,
        vat_amount: 95,
        total_gross: 595,
      },
      items: [
        {
          position: 1,
          description: 'Unterschrank 60',
          qty: 1,
          unit: 'stk',
          unit_price_net: 500,
          line_net: 500,
          tax_rate: 0.19,
          show_on_quote: true,
        },
      ],
    })

    const content = pdf.toString('latin1')

    expect(content.startsWith('%PDF-1.4')).toBe(true)
    expect(content).toContain('ANG-2026-0004')
    expect(content).toContain('Zwischensumme netto: 500.00 EUR')
    expect(content).toContain('Gesamtbetrag brutto: 595.00 EUR')
    expect(content).toContain('Unterschrank 60')
  })

  it('escapes text and omits hidden quote items', () => {
    const pdf = buildQuotePdf({
      quote_number: 'ANG-2026-0005',
      version: 5,
      valid_until: '2026-03-31T00:00:00.000Z',
      free_text: 'Freitext mit (Klammern) und \\ Backslash',
      footer_text: null,
      items: [
        {
          position: 1,
          description: 'Sichtbare Position',
          qty: 1,
          unit: 'stk',
          unit_price_net: 100,
          line_net: 100,
          tax_rate: 0.19,
          show_on_quote: true,
        },
        {
          position: 2,
          description: 'Interne Position',
          qty: 1,
          unit: 'stk',
          unit_price_net: 50,
          line_net: 50,
          tax_rate: 0.19,
          show_on_quote: false,
        },
      ],
    })

    const content = pdf.toString('latin1')

    expect(content).toContain('Freitext mit \\(Klammern\\) und \\\\ Backslash')
    expect(content).toContain('Sichtbare Position')
    expect(content).not.toContain('Interne Position')
  })
})
