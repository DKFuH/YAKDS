import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import styles from './McpInfoPage.module.css'

interface McpCapabilities {
  tools: boolean
  read_tools?: string[]
  write_tools?: string[]
}

interface McpInfo {
  name: string
  version: string
  description: string
  protocol: string
  capabilities: McpCapabilities
}

const MCP_ENDPOINT = '/api/v1/mcp'

export function McpInfoPage() {
  const navigate = useNavigate()
  const [info, setInfo] = useState<McpInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch(MCP_ENDPOINT)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        setInfo(await res.json() as McpInfo)
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'MCP-Info konnte nicht geladen werden')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  function handleCopy() {
    const url = `${window.location.origin}${MCP_ENDPOINT}`
    void navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>Phase 10 · Sprint 62</p>
          <h1 className={styles.title}>MCP: Claude als Planungsassistent</h1>
          <p className={styles.subtitle}>Verbinde Claude oder andere KI-Systeme als vollwertigen Planungsassistenten.</p>
        </div>
        <button className={styles.backBtn} onClick={() => navigate('/')}>← Zurück</button>
      </header>

      {/* Endpoint URL */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>MCP-Endpunkt</h2>
        <div className={styles.endpointRow}>
          <span className={styles.endpointUrl}>{window.location.origin}{MCP_ENDPOINT}</span>
          <button className={styles.copyBtn} onClick={handleCopy}>
            {copied ? '✓ Kopiert' : 'URL kopieren'}
          </button>
        </div>
      </section>

      {/* Server Info */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Server-Info</h2>
        {loading && <p className={styles.loading}>Lade MCP-Info…</p>}
        {error && <p className={styles.error}>{error}</p>}
        {info && (
          <div className={styles.meta}>
            <div className={styles.metaItem}>
              <span className={styles.metaLabel}>Name</span>
              <span className={styles.metaValue}>{info.name}</span>
            </div>
            <div className={styles.metaItem}>
              <span className={styles.metaLabel}>Version</span>
              <span className={styles.metaValue}>{info.version}</span>
            </div>
            <div className={styles.metaItem}>
              <span className={styles.metaLabel}>Protokoll</span>
              <span className={styles.metaValue}>{info.protocol}</span>
            </div>
          </div>
        )}
      </section>

      {/* Tools */}
      {info && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Verfügbare Tools</h2>
          <div className={styles.toolColumns}>
            {info.capabilities.read_tools && (
              <div className={styles.toolGroup}>
                <p className={styles.toolGroupTitle}>Read-Tools ({info.capabilities.read_tools.length})</p>
                <ul className={styles.toolList}>
                  {info.capabilities.read_tools.map((tool) => (
                    <li key={tool}><span className={styles.toolChip}>{tool}</span></li>
                  ))}
                </ul>
              </div>
            )}
            {info.capabilities.write_tools && (
              <div className={styles.toolGroup}>
                <p className={styles.toolGroupTitle}>Write-Tools ({info.capabilities.write_tools.length})</p>
                <ul className={styles.toolList}>
                  {info.capabilities.write_tools.map((tool) => (
                    <li key={tool}><span className={styles.toolChip}>{tool}</span></li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Quick start guide */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>So verbindest du Claude mit deinem Planner</h2>
        <ol className={styles.steps}>
          <li>Öffne Claude Desktop und navigiere zu <strong>Einstellungen → MCP-Server</strong>.</li>
          <li>Klicke auf <strong>„Server hinzufügen"</strong> und wähle <strong>„HTTP/SSE"</strong>.</li>
          <li>Trage als URL den MCP-Endpunkt ein: <code>{window.location.origin}{MCP_ENDPOINT}</code></li>
          <li>Bestätige mit <strong>„Verbinden"</strong>. Claude lädt automatisch alle verfügbaren Tools.</li>
          <li>
            Starte eine neue Konversation und bitte Claude zum Beispiel:
            {' '}<em>„Zeig mir alle Projekte von Tenant XY und schlage eine Küchenlayout-Variante für Raum 1 vor."</em>
          </li>
        </ol>
      </section>
    </div>
  )
}
