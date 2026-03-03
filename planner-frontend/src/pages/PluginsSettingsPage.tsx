import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getTenantPlugins, updateTenantPlugins, type TenantPluginInfo } from '../api/tenantSettings.js'
import styles from './TenantSettingsPage.module.css'

export function PluginsSettingsPage() {
  const navigate = useNavigate()
  const [available, setAvailable] = useState<TenantPluginInfo[]>([])
  const [enabled, setEnabled] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    getTenantPlugins()
      .then((data) => {
        setAvailable(data.available)
        setEnabled(data.enabled)
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const enabledSet = useMemo(() => new Set(enabled), [enabled])

  function togglePlugin(pluginId: string, checked: boolean) {
    setEnabled((prev) => {
      if (checked) {
        if (prev.includes(pluginId)) return prev
        return [...prev, pluginId]
      }
      return prev.filter((id) => id !== pluginId)
    })
    setSuccess(false)
  }

  async function save() {
    setSaving(true)
    setError(null)
    setSuccess(false)
    try {
      const updated = await updateTenantPlugins(enabled)
      setEnabled(updated.enabled)
      setSuccess(true)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Fehler beim Speichern')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className={styles.center}>{'Lade Plugins\u2026'}</div>
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>Einstellungen</p>
          <h1>Plugins</h1>
          <p className={styles.subtitle}>Aktiviere optionale Fachmodule pro Tenant.</p>
        </div>
        <div className={styles.headerActions}>
          <button type="button" className={styles.btnSecondary} onClick={() => navigate('/settings/company')}>
            {'\u2190 Firmenprofil'}
          </button>
        </div>
      </header>

      {error && <div className={styles.error}>{error}</div>}
      {success && <div className={styles.success}>Plugin-Einstellungen gespeichert.</div>}

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{'Verf\u00fcgbare Plugins'}</h2>
        <div className={styles.grid}>
          {available.length === 0 && <p>{'Keine Plugins verf\u00fcgbar.'}</p>}
          {available.map((plugin) => (
            <label key={plugin.id} className={styles.field}>
              <span>{plugin.name}</span>
              <input
                type="checkbox"
                checked={enabledSet.has(plugin.id)}
                onChange={(event) => togglePlugin(plugin.id, event.target.checked)}
              />
            </label>
          ))}
        </div>
      </section>

      <div className={styles.actions}>
        <button type="button" className={styles.btnPrimary} disabled={saving} onClick={() => void save()}>
          {saving ? 'Speichern\u2026' : 'Plugins speichern'}
        </button>
      </div>
    </div>
  )
}
