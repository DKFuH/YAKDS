import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getProjectDefaults, updateProjectDefaults, type ProjectDefaults } from '../api/tenantSettings.js'
import styles from './TenantSettingsPage.module.css'

export function ProjectDefaultsPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState<ProjectDefaults>({
    default_advisor: null,
    default_processor: null,
    default_area_name: null,
    default_alternative_name: null,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    getProjectDefaults()
      .then((data) => setForm(data))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  function updateField(field: keyof ProjectDefaults, value: string) {
    setForm((prev) => ({
      ...prev,
      [field]: value.trim() ? value : null,
    }))
    setSuccess(false)
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    setSuccess(false)
    try {
      const updated = await updateProjectDefaults(form)
      setForm(updated)
      setSuccess(true)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Defaults konnten nicht gespeichert werden')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className={styles.center}>Lade Projekt-Defaults…</div>
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>Phase 14 · Sprint 92</p>
          <h1>Projekt-Defaults</h1>
          <p className={styles.subtitle}>Standardwerte für neue Projekte je Tenant: Berater, Bearbeiter, Bereich und Alternative.</p>
        </div>
        <div className={styles.headerActions}>
          <button type="button" className={styles.btnSecondary} onClick={() => navigate('/settings')}>
            ← Zurück
          </button>
        </div>
      </header>

      {error && <div className={styles.error}>{error}</div>}
      {success && <div className={styles.success}>Projekt-Defaults gespeichert.</div>}

      <form className={styles.form} onSubmit={(event) => void handleSubmit(event)}>
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Standardbelegung</h2>
          <div className={styles.grid}>
            <label className={styles.field}>
              <span>Standardberater</span>
              <input
                type="text"
                value={form.default_advisor ?? ''}
                onChange={(event) => updateField('default_advisor', event.target.value)}
                placeholder="z. B. Anna Berger"
              />
            </label>
            <label className={styles.field}>
              <span>Standardbearbeiter</span>
              <input
                type="text"
                value={form.default_processor ?? ''}
                onChange={(event) => updateField('default_processor', event.target.value)}
                placeholder="z. B. Planung Team"
              />
            </label>
            <label className={styles.field}>
              <span>Standardbereich</span>
              <input
                type="text"
                value={form.default_area_name ?? ''}
                onChange={(event) => updateField('default_area_name', event.target.value)}
                placeholder="z. B. Bereich 1"
              />
            </label>
            <label className={styles.field}>
              <span>Standardalternative</span>
              <input
                type="text"
                value={form.default_alternative_name ?? ''}
                onChange={(event) => updateField('default_alternative_name', event.target.value)}
                placeholder="z. B. Variante A"
              />
            </label>
          </div>
        </section>

        <div className={styles.actions}>
          <button type="submit" className={styles.btnPrimary} disabled={saving}>
            {saving ? 'Speichere…' : 'Speichern'}
          </button>
        </div>
      </form>
    </div>
  )
}
