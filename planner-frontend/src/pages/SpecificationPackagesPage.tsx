import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { specificationPackagesApi, type SpecificationPackage } from '../api/specificationPackages.js'
import styles from './TenantSettingsPage.module.css'

const DEFAULT_SECTIONS = ['quote', 'bom', 'cutlist', 'nesting', 'layout_sheets', 'installation_notes']

export function SpecificationPackagesPage() {
  const navigate = useNavigate()
  const { id: projectId } = useParams<{ id: string }>()

  const [items, setItems] = useState<SpecificationPackage[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [name, setName] = useState('Werkstattpaket Standard')
  const [selectedSections, setSelectedSections] = useState<string[]>(['quote', 'bom', 'cutlist', 'layout_sheets'])
  const [includeCoverPage, setIncludeCoverPage] = useState(true)
  const [includeCompanyProfile, setIncludeCompanyProfile] = useState(true)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const active = useMemo(() => items.find((entry) => entry.id === activeId) ?? null, [items, activeId])

  useEffect(() => {
    if (!projectId) return
    void loadPackages()
  }, [projectId])

  async function loadPackages() {
    if (!projectId) return
    specificationPackagesApi.list(projectId)
      .then((data) => {
        setItems(data)
        setActiveId(data[0]?.id ?? null)
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (!active) {
      setName('Werkstattpaket Standard')
      setSelectedSections(['quote', 'bom', 'cutlist', 'layout_sheets'])
      setIncludeCoverPage(true)
      setIncludeCompanyProfile(true)
      return
    }

    const config = active.config_json ?? {}
    setName(active.name)
    setSelectedSections(Array.isArray(config.sections) ? config.sections : ['quote', 'bom', 'cutlist', 'layout_sheets'])
    setIncludeCoverPage(config.include_cover_page !== false)
    setIncludeCompanyProfile(config.include_company_profile !== false)
  }, [active])

  async function refreshList(selectId?: string | null) {
    if (!projectId) return
    const data = await specificationPackagesApi.list(projectId)
    setItems(data)
    if (selectId) {
      setActiveId(selectId)
      return
    }
    if (!data.some((entry) => entry.id === activeId)) {
      setActiveId(data[0]?.id ?? null)
    }
  }

  function toggleSection(section: string) {
    setSelectedSections((prev) => (
      prev.includes(section) ? prev.filter((entry) => entry !== section) : [...prev, section]
    ))
  }

  async function createPackage() {
    if (!projectId) return

    setSaving(true)
    setError(null)
    try {
      const created = await specificationPackagesApi.create(projectId, {
        name,
        config_json: {
          sections: selectedSections,
          include_cover_page: includeCoverPage,
          include_company_profile: includeCompanyProfile,
        },
      })
      await refreshList(created.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Paket konnte nicht erstellt werden')
    } finally {
      setSaving(false)
    }
  }

  async function generateActive() {
    if (!active) return

    setSaving(true)
    setError(null)
    try {
      await specificationPackagesApi.generate(active.id)
      await refreshList(active.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Paket konnte nicht generiert werden')
    } finally {
      setSaving(false)
    }
  }

  async function downloadActive() {
    if (!active) return

    setSaving(true)
    setError(null)
    try {
      await specificationPackagesApi.download(active.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download fehlgeschlagen')
    } finally {
      setSaving(false)
    }
  }

  async function deleteActive() {
    if (!active) return
    if (!confirm('Werkstattpaket wirklich löschen?')) return

    setSaving(true)
    setError(null)
    try {
      await specificationPackagesApi.remove(active.id)
      await refreshList(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Paket konnte nicht gelöscht werden')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className={styles.center}>Lade Werkstattpakete...</div>

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>Projekt</p>
          <h1>Spezifikationspakete</h1>
          <p className={styles.subtitle}>Quote, BOM, Cutlist, Nesting und Layout-Sheets als Werkstattpaket bündeln.</p>
        </div>
        <div className={styles.headerActions}>
          <button type="button" className={styles.btnSecondary} onClick={() => navigate(`/projects/${projectId}`)}>
            {'\u2190 Zurück zum Editor'}
          </button>
        </div>
      </header>

      {error && <div className={styles.error}>{error}</div>}

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Paket konfigurieren</h2>

        <div className={styles.grid}>
          <label className={styles.field}>
            <span>Paket wählen</span>
            <select value={activeId ?? ''} onChange={(event) => setActiveId(event.target.value || null)}>
              <option value="">Neu erstellen</option>
              {items.map((entry) => (
                <option key={entry.id} value={entry.id}>{entry.name}</option>
              ))}
            </select>
          </label>

          <label className={styles.field}>
            <span>Name</span>
            <input value={name} onChange={(event) => setName(event.target.value)} />
          </label>
        </div>

        <div className={styles.grid}>
          {DEFAULT_SECTIONS.map((section) => (
            <label key={section} className={styles.field}>
              <span>
                <input
                  type="checkbox"
                  checked={selectedSections.includes(section)}
                  onChange={() => toggleSection(section)}
                />
                {' '}
                {section}
              </span>
            </label>
          ))}

          <label className={styles.field}>
            <span>
              <input
                type="checkbox"
                checked={includeCoverPage}
                onChange={(event) => setIncludeCoverPage(event.target.checked)}
              />
              {' '}Deckblatt
            </span>
          </label>

          <label className={styles.field}>
            <span>
              <input
                type="checkbox"
                checked={includeCompanyProfile}
                onChange={(event) => setIncludeCompanyProfile(event.target.checked)}
              />
              {' '}Firmenprofil
            </span>
          </label>
        </div>

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.btnPrimary}
            disabled={saving}
            onClick={() => void createPackage()}
          >
            {saving ? 'Speichern...' : 'Paket speichern'}
          </button>

          {active && (
            <>
              <button type="button" className={styles.btnSecondary} disabled={saving} onClick={() => void generateActive()}>
                Generieren
              </button>
              <button type="button" className={styles.btnSecondary} disabled={saving} onClick={() => void downloadActive()}>
                Download
              </button>
              <button type="button" className={styles.btnSecondary} disabled={saving} onClick={() => void deleteActive()}>
                Löschen
              </button>
            </>
          )}
        </div>

        {active?.generated_at && (
          <div className={styles.success}>
            Zuletzt generiert: {new Date(active.generated_at).toLocaleString('de-DE')}
          </div>
        )}
      </section>
    </div>
  )
}
