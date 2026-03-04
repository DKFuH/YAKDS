import { api } from './client.js'

const BASE_URL = '/api/v1'

type ApiError = { error: string; message: string }

export interface QuoteBomLinePayload {
  type: string
  description: string
  qty: number
  unit: string
  line_net_after_discounts: number
  tax_rate: number
}

export interface CreateQuotePayload {
  valid_until?: string
  free_text?: string | null
  footer_text?: string | null
  bom_lines?: QuoteBomLinePayload[]
  price_summary?: unknown
}

export interface QuoteItem {
  id: string
  position: number
  type: string
  description: string
  qty: number
  unit: string
  unit_price_net: number
  line_net: number
  tax_rate: number
  line_gross: number
  notes: string | null
  show_on_quote: boolean
}

export interface Quote {
  id: string
  project_id: string
  version: number
  quote_number: string
  locale_code: string | null
  valid_until: string
  free_text: string | null
  footer_text: string | null
  created_at: string
  updated_at: string
  items: QuoteItem[]
}

export interface ResequenceQuoteLinesResponse {
  quote_id: string
  start_position: number
  updated_count: number
  items: Array<{ id: string; position: number }>
}

function parseFilename(contentDisposition: string | null, fallback: string): string {
  if (!contentDisposition) {
    return fallback
  }

  const match = contentDisposition.match(/filename\*?=(?:UTF-8''|\")?([^\";]+)/i)
  if (!match || !match[1]) {
    return fallback
  }

  try {
    return decodeURIComponent(match[1].replace(/\"/g, '').trim())
  } catch {
    return match[1].replace(/\"/g, '').trim() || fallback
  }
}

export function createQuote(projectId: string, payload: CreateQuotePayload = {}): Promise<Quote> {
  return api.post<Quote>(`/projects/${projectId}/create-quote`, payload)
}

export function getQuote(id: string): Promise<Quote> {
  return api.get<Quote>(`/quotes/${id}`)
}

export function resequenceQuoteLines(id: string, startPosition = 1): Promise<ResequenceQuoteLinesResponse> {
  return api.post<ResequenceQuoteLinesResponse>(`/quotes/${id}/resequence-lines`, {
    start_position: startPosition,
  })
}

export async function exportQuotePdf(id: string, localeCode?: string): Promise<void> {
  const response = await fetch(`${BASE_URL}/quotes/${id}/export-pdf`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(localeCode ? { locale_code: localeCode } : {}),
  })

  if (!response.ok) {
    const errorBody: ApiError = await response
      .json()
      .catch(() => ({ error: 'UNKNOWN', message: response.statusText }))
    throw new Error(errorBody.message)
  }

  const blob = await response.blob()
  const fallbackFilename = `quote-${id}.pdf`
  const filename = parseFilename(response.headers.get('content-disposition'), fallbackFilename)

  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = filename
  anchor.style.display = 'none'

  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(objectUrl)
}
