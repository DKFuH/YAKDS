import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { projectsApi, type Project } from '../api/projects.js'
import styles from './ProjectArchivePage.module.css'

function formatDate(value: string | null | undefined): string {
  if (!value) {
    return '—'
  }
  return new Date(value).toLocaleDateString('de-DE')
}

export function ProjectArchivePage() {
  const navigate = useNavigate()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [reasonFilter, setReasonFilter] = useState('')
  const [restoringProjectId, setRestoringProjectId] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const list = await projectsApi.archiveList({
        search: search.trim() || undefined,
        archive_reason: reasonFilter.trim() || undefined,
      })
      setProjects(list)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Projektarchiv konnte nicht geladen werden')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  async function handleRestore(projectId: string) {
    setRestoringProjectId(projectId)
    setError(null)
    try {
      await projectsApi.restore(projectId)
      setProjects((prev) => prev.filter((project) => project.id !== projectId))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Projekt konnte nicht wiederhergestellt werden')
    } finally {
      setRestoringProjectId(null)
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>Phase 14 · Sprint 92</p>
          <h1>Projektarchiv</h1>
          <p className={styles.subtitle}>Archivierte Projekte suchen, filtern und inklusive Kontaktverknüpfungen wiederherstellen.</p>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.btnSecondary} onClick={() => navigate('/')}>Projektboard</button>
        </div>
      </header>

      {error && <div className={styles.error}>{error}</div>}

      <section className={styles.filters}>
        <label className={styles.field}>
          <span>Suche</span>
          <input
            type="search"
            placeholder="Projektname"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>

        <label className={styles.field}>
          <span>Archivgrund</span>
          <input
            type="text"
            placeholder="z. B. abgeschlossen"
            value={reasonFilter}
            onChange={(event) => setReasonFilter(event.target.value)}
          />
        </label>

        <button className={styles.btnPrimary} onClick={() => void load()}>
          Filter anwenden
        </button>
      </section>

      {loading ? (
        <div className={styles.center}>Lade Archiv…</div>
      ) : projects.length === 0 ? (
        <p className={styles.empty}>Keine archivierten Projekte gefunden.</p>
      ) : (
        <section className={styles.grid}>
          {projects.map((project) => (
            <article key={project.id} className={styles.card}>
              <div className={styles.cardHead}>
                <strong>{project.name}</strong>
                <span>{project.priority}</span>
              </div>
              <p className={styles.reason}>{project.archive_reason ?? 'Kein Archivgrund hinterlegt'}</p>
              <div className={styles.meta}>
                <span>Archiviert: {formatDate(project.archived_at)}</span>
                <span>Aufbewahrung bis: {formatDate(project.retention_until)}</span>
                <span>Berater: {project.advisor ?? '—'}</span>
                <span>Bearbeitung: {project.assigned_to ?? '—'}</span>
              </div>
              <div className={styles.actions}>
                <button className={styles.btnSecondary} onClick={() => navigate(`/projects/${project.id}`)}>
                  Öffnen
                </button>
                <button
                  className={styles.btnPrimary}
                  onClick={() => void handleRestore(project.id)}
                  disabled={restoringProjectId === project.id}
                >
                  {restoringProjectId === project.id ? 'Stelle wieder her…' : 'Restore'}
                </button>
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  )
}
