import { useState } from 'react'
import {
  createQuote,
  exportQuotePdf,
  getQuote,
  type CreateQuotePayload,
  type Quote,
} from '../../api/quotes.js'
import styles from './QuoteExportPanel.module.css'

interface Props {
  projectId: string
  createPayload?: CreateQuotePayload
  buildCreatePayload?: () => Promise<CreateQuotePayload>
}

function formatDate(value: string): string {
  const asDate = new Date(value)
  if (Number.isNaN(asDate.getTime())) {
    return value
  }
  return asDate.toLocaleDateString('de-DE')
}

export function QuoteExportPanel({ projectId, createPayload = {}, buildCreatePayload }: Props) {
  const [quote, setQuote] = useState<Quote | null>(null)
  const [loadingCreate, setLoadingCreate] = useState(false)
  const [loadingQuote, setLoadingQuote] = useState(false)
  const [loadingExport, setLoadingExport] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleCreateQuote() {
    setLoadingCreate(true)
    setError(null)

    try {
      const payload = buildCreatePayload ? await buildCreatePayload() : createPayload
      const created = await createQuote(projectId, payload)
      setQuote(created)
    } catch (caughtError: unknown) {
      setError(caughtError instanceof Error ? caughtError.message : 'Angebot konnte nicht erzeugt werden.')
    } finally {
      setLoadingCreate(false)
    }
  }

  async function handleReloadQuote() {
    if (!quote) {
      return
    }

    setLoadingQuote(true)
    setError(null)

    try {
      const refreshed = await getQuote(quote.id)
      setQuote(refreshed)
    } catch (caughtError: unknown) {
      setError(caughtError instanceof Error ? caughtError.message : 'Angebot konnte nicht geladen werden.')
    } finally {
      setLoadingQuote(false)
    }
  }

  async function handleExportPdf() {
    if (!quote) {
      return
    }

    setLoadingExport(true)
    setError(null)

    try {
      await exportQuotePdf(quote.id)
    } catch (caughtError: unknown) {
      setError(caughtError instanceof Error ? caughtError.message : 'PDF-Export fehlgeschlagen.')
    } finally {
      setLoadingExport(false)
    }
  }

  return (
    <section className={styles.panel}>
      <header className={styles.header}>
        <h3 className={styles.title}>Angebot & Export</h3>
      </header>

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.primaryBtn}
          onClick={() => { void handleCreateQuote() }}
          disabled={loadingCreate || loadingQuote || loadingExport}
        >
          {loadingCreate ? 'Erzeuge…' : 'Angebot erzeugen'}
        </button>

        <button
          type="button"
          className={styles.secondaryBtn}
          onClick={() => { void handleExportPdf() }}
          disabled={!quote || loadingCreate || loadingQuote || loadingExport}
        >
          {loadingExport ? 'Exportiere…' : 'PDF exportieren'}
        </button>
      </div>

      {quote && (
        <button
          type="button"
          className={styles.refreshBtn}
          onClick={() => { void handleReloadQuote() }}
          disabled={loadingCreate || loadingQuote || loadingExport}
        >
          {loadingQuote ? 'Lade…' : 'Angebot aktualisieren'}
        </button>
      )}

      {error && <p className={styles.error}>{error}</p>}

      {!quote ? (
        <p className={styles.empty}>Noch kein Angebot erzeugt.</p>
      ) : (
        <dl className={styles.metaList}>
          <dt>Angebotsnummer</dt>
          <dd>{quote.quote_number}</dd>

          <dt>Version</dt>
          <dd>{quote.version}</dd>

          <dt>Gültig bis</dt>
          <dd>{formatDate(quote.valid_until)}</dd>
        </dl>
      )}
    </section>
  )
}
