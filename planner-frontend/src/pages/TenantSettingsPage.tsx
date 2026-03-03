import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getTenantSettings, updateTenantSettings, type TenantSettings } from '../api/tenantSettings.js'
import styles from './TenantSettingsPage.module.css'

export function TenantSettingsPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState<TenantSettings>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    getTenantSettings()
      .then((data) => setForm(data))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  function handleChange(field: keyof TenantSettings, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
    setSuccess(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSuccess(false)
    try {
      const { id: _id, tenant_id: _tid, created_at: _ca, updated_at: _ua, ...payload } = form
      const updated = await updateTenantSettings(payload)
      setForm(updated)
      setSuccess(true)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Fehler beim Speichern')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className={styles.center}>Lade Einstellungen…</div>
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>Sprint 61 · Einstellungen</p>
          <h1>Firmenprofil</h1>
          <p className={styles.subtitle}>Firmendaten für Angebots-PDF, Steuer- und Bankverbindung</p>
        </div>
        <div className={styles.headerActions}>
          <button type="button" className={styles.btnSecondary} onClick={() => navigate('/')}>
            ← Zurück
          </button>
        </div>
      </header>

      {error && <div className={styles.error}>{error}</div>}
      {success && <div className={styles.success}>Einstellungen gespeichert.</div>}

      <form className={styles.form} onSubmit={(e) => void handleSubmit(e)}>
        {/* Firmendaten */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Firmendaten</h2>
          <div className={styles.grid}>
            <label className={styles.field}>
              <span>Firmenname</span>
              <input
                type="text"
                maxLength={200}
                value={form.company_name ?? ''}
                onChange={(e) => handleChange('company_name', e.target.value)}
              />
            </label>
            <label className={styles.field}>
              <span>Straße</span>
              <input
                type="text"
                maxLength={200}
                value={form.company_street ?? ''}
                onChange={(e) => handleChange('company_street', e.target.value)}
              />
            </label>
            <label className={styles.field}>
              <span>PLZ</span>
              <input
                type="text"
                maxLength={20}
                value={form.company_zip ?? ''}
                onChange={(e) => handleChange('company_zip', e.target.value)}
              />
            </label>
            <label className={styles.field}>
              <span>Ort</span>
              <input
                type="text"
                maxLength={100}
                value={form.company_city ?? ''}
                onChange={(e) => handleChange('company_city', e.target.value)}
              />
            </label>
            <label className={styles.field}>
              <span>Telefon</span>
              <input
                type="text"
                maxLength={50}
                value={form.company_phone ?? ''}
                onChange={(e) => handleChange('company_phone', e.target.value)}
              />
            </label>
            <label className={styles.field}>
              <span>E-Mail</span>
              <input
                type="email"
                maxLength={200}
                value={form.company_email ?? ''}
                onChange={(e) => handleChange('company_email', e.target.value)}
              />
            </label>
            <label className={styles.field}>
              <span>Website</span>
              <input
                type="text"
                maxLength={200}
                value={form.company_web ?? ''}
                onChange={(e) => handleChange('company_web', e.target.value)}
              />
            </label>
          </div>
        </section>

        {/* Steuer & Bank */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Steuer &amp; Bank</h2>
          <div className={styles.grid}>
            <label className={styles.field}>
              <span>USt-IdNr.</span>
              <input
                type="text"
                maxLength={30}
                placeholder="z. B. DE123456789"
                value={form.vat_id ?? ''}
                onChange={(e) => handleChange('vat_id', e.target.value)}
              />
            </label>
            <label className={styles.field}>
              <span>Steuernummer</span>
              <input
                type="text"
                maxLength={30}
                value={form.tax_number ?? ''}
                onChange={(e) => handleChange('tax_number', e.target.value)}
              />
            </label>
            <label className={styles.field}>
              <span>IBAN</span>
              <input
                type="text"
                maxLength={50}
                value={form.iban ?? ''}
                onChange={(e) => handleChange('iban', e.target.value)}
              />
            </label>
            <label className={styles.field}>
              <span>BIC</span>
              <input
                type="text"
                maxLength={20}
                value={form.bic ?? ''}
                onChange={(e) => handleChange('bic', e.target.value)}
              />
            </label>
            <label className={styles.field}>
              <span>Bank</span>
              <input
                type="text"
                maxLength={100}
                value={form.bank_name ?? ''}
                onChange={(e) => handleChange('bank_name', e.target.value)}
              />
            </label>
          </div>
        </section>

        {/* Angebotsvorlage */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Angebotsvorlage</h2>
          <div className={styles.grid}>
            <label className={`${styles.field} ${styles.fieldFull}`}>
              <span>Fußtext (erscheint auf jedem Angebots-PDF)</span>
              <textarea
                rows={4}
                maxLength={2000}
                value={form.quote_footer ?? ''}
                onChange={(e) => handleChange('quote_footer', e.target.value)}
              />
            </label>
            <label className={styles.field}>
              <span>Währung</span>
              <input
                type="text"
                maxLength={3}
                placeholder="EUR"
                value={form.currency_code ?? ''}
                onChange={(e) => handleChange('currency_code', e.target.value)}
              />
            </label>
          </div>
        </section>

        <div className={styles.actions}>
          <button type="submit" className={styles.btnPrimary} disabled={saving}>
            {saving ? 'Speichern…' : 'Einstellungen speichern'}
          </button>
        </div>
      </form>
    </div>
  )
}
