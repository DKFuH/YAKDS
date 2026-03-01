import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { contactsApi, type Contact, type ContactLeadSource } from '../api/contacts.js'
import { platformApi } from '../api/platform.js'
import { projectsApi, type Project } from '../api/projects.js'
import styles from './ContactsPage.module.css'

const LEAD_SOURCE_LABELS: Record<ContactLeadSource, string> = {
  web_planner: 'Webplaner',
  showroom: 'Showroom',
  referral: 'Empfehlung',
  other: 'Sonstiges',
}

export function ContactsPage() {
  const navigate = useNavigate()
  const [contacts, setContacts] = useState<Contact[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    company: '',
    lead_source: 'other' as ContactLeadSource,
    budget_estimate: '',
  })
  const [attachSelection, setAttachSelection] = useState<Record<string, string>>({})

  async function load(searchTerm?: string) {
    setLoading(true)
    setError(null)
    try {
      const [contactList, projectList] = await Promise.all([
        contactsApi.list(searchTerm),
        projectsApi.list(),
      ])
      setContacts(contactList)
      setProjects(projectList.filter((project) => project.status === 'active'))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Kontakte konnten nicht geladen werden')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault()
    try {
      await contactsApi.create({
        first_name: form.first_name || null,
        last_name: form.last_name,
        email: form.email || null,
        phone: form.phone || null,
        company: form.company || null,
        lead_source: form.lead_source,
        budget_estimate: form.budget_estimate ? Number(form.budget_estimate) : null,
      })
      setShowCreate(false)
      setForm({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        company: '',
        lead_source: 'other',
        budget_estimate: '',
      })
      await load(search)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Kontakt konnte nicht erstellt werden')
    }
  }

  async function handleAttach(contactId: string) {
    const projectId = attachSelection[contactId]
    if (!projectId) {
      return
    }
    try {
      await contactsApi.attachToProject(projectId, contactId)
      await load(search)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Kontakt konnte nicht verknüpft werden')
    }
  }

  if (loading) {
    return <div className={styles.center}>Lade Kontakte…</div>
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>Phase 3 · Sprint 27</p>
          <h1>Kontakte / CRM-Light</h1>
          <p className={styles.subtitle}>Kontakte, Lead-Herkunft, Projektanzahl, Umsatz und Conversion in einer Übersicht.</p>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.btnSecondary} onClick={() => navigate('/')}>Projektboard</button>
          <button className={styles.btnSecondary} onClick={() => void platformApi.exportContactsCsv()}>CSV Export</button>
          <button className={styles.btnPrimary} onClick={() => setShowCreate((prev) => !prev)}>
            {showCreate ? 'Formular schließen' : '+ Kontakt'}
          </button>
        </div>
      </header>

      {error && <div className={styles.error}>{error}</div>}

      <section className={styles.toolbar}>
        <input
          type="search"
          placeholder="Name, Firma, E-Mail oder Telefon suchen"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <button className={styles.btnSecondary} onClick={() => void load(search)}>Suchen</button>
      </section>

      {showCreate && (
        <form className={styles.createForm} onSubmit={handleCreate}>
          <input placeholder="Vorname" value={form.first_name} onChange={(event) => setForm((prev) => ({ ...prev, first_name: event.target.value }))} />
          <input placeholder="Nachname*" value={form.last_name} onChange={(event) => setForm((prev) => ({ ...prev, last_name: event.target.value }))} required />
          <input placeholder="Firma" value={form.company} onChange={(event) => setForm((prev) => ({ ...prev, company: event.target.value }))} />
          <input placeholder="E-Mail" value={form.email} onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))} />
          <input placeholder="Telefon" value={form.phone} onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))} />
          <select value={form.lead_source} onChange={(event) => setForm((prev) => ({ ...prev, lead_source: event.target.value as ContactLeadSource }))}>
            {Object.entries(LEAD_SOURCE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <input placeholder="Budget" type="number" min="0" value={form.budget_estimate} onChange={(event) => setForm((prev) => ({ ...prev, budget_estimate: event.target.value }))} />
          <button type="submit" className={styles.btnPrimary}>Kontakt anlegen</button>
        </form>
      )}

      <section className={styles.grid}>
        {contacts.map((contact) => (
          <article key={contact.id} className={styles.card}>
            <div className={styles.cardHead}>
              <div>
                <strong>{[contact.first_name, contact.last_name].filter(Boolean).join(' ') || contact.last_name}</strong>
                <p>{contact.company ?? 'Privatkontakt'}</p>
              </div>
              <span className={styles.sourceBadge}>{LEAD_SOURCE_LABELS[contact.lead_source]}</span>
            </div>

            <div className={styles.meta}>
              <span>{contact.email ?? 'Keine E-Mail'}</span>
              <span>{contact.phone ?? 'Kein Telefon'}</span>
            </div>

            <div className={styles.kpis}>
              <div>
                <strong>{contact.project_count}</strong>
                <span>Projekte</span>
              </div>
              <div>
                <strong>{contact.revenue_total.toLocaleString('de-DE')} €</strong>
                <span>Umsatz</span>
              </div>
              <div>
                <strong>{contact.conversion_pct}%</strong>
                <span>Conversion</span>
              </div>
            </div>

            <div className={styles.projects}>
              {contact.projects.length === 0 ? (
                <span className={styles.empty}>Noch keine Projektverknüpfung</span>
              ) : (
                contact.projects.map((project) => (
                  <button key={project.id} className={styles.projectChip} onClick={() => navigate(`/projects/${project.id}`)}>
                    {project.name}
                  </button>
                ))
              )}
            </div>

            <div className={styles.attachRow}>
              <select
                value={attachSelection[contact.id] ?? ''}
                onChange={(event) => setAttachSelection((prev) => ({ ...prev, [contact.id]: event.target.value }))}
              >
                <option value="">Projekt auswählen…</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>{project.name}</option>
                ))}
              </select>
              <button className={styles.btnSecondary} onClick={() => void handleAttach(contact.id)}>
                Verknüpfen
              </button>
            </div>
          </article>
        ))}
      </section>
    </div>
  )
}
