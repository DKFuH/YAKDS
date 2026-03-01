import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { projectsApi, type Project } from '../api/projects.js'
import styles from './ProjectList.module.css'

export function ProjectList() {
  const navigate = useNavigate()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')

  useEffect(() => {
    projectsApi.list()
      .then(setProjects)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    try {
      const project = await projectsApi.create({ name: newName.trim() })
      navigate(`/projects/${project.id}`)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Fehler beim Anlegen')
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Projekt wirklich löschen?')) return
    await projectsApi.delete(id)
    setProjects(prev => prev.filter(p => p.id !== id))
  }

  if (loading) return <div className={styles.center}>Lade Projekte…</div>

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1>YAKDS – Küchenplaner</h1>
        <div className={styles.headerActions}>
          <button className={styles.btnSecondary} onClick={() => navigate('/webplanner')}>
            Webplaner
          </button>
          <button className={styles.btnSecondary} onClick={() => navigate('/bi')}>
            BI Dashboard
          </button>
          <button className={styles.btnSecondary} onClick={() => navigate('/catalog')}>
            Katalog
          </button>
          <button className={styles.btnPrimary} onClick={() => setCreating(true)}>
            + Neues Projekt
          </button>
        </div>
      </header>

      {error && <div className={styles.error}>{error}</div>}

      {creating && (
        <form className={styles.createForm} onSubmit={handleCreate}>
          <input
            autoFocus
            type="text"
            placeholder="Projektname"
            value={newName}
            onChange={e => setNewName(e.target.value)}
          />
          <button type="submit" className={styles.btnPrimary}>Anlegen</button>
          <button type="button" onClick={() => setCreating(false)}>Abbrechen</button>
        </form>
      )}

      {projects.length === 0 ? (
        <p className={styles.empty}>Noch keine Projekte. Lege dein erstes Projekt an.</p>
      ) : (
        <ul className={styles.list}>
          {projects.map(p => (
            <li key={p.id} className={styles.card}>
              <button className={styles.cardBody} onClick={() => navigate(`/projects/${p.id}`)}>
                <strong>{p.name}</strong>
                <span>{p._count?.rooms ?? 0} Räume · {new Date(p.updated_at).toLocaleDateString('de-DE')}</span>
              </button>
              <button
                className={styles.btnDanger}
                aria-label="Projekt löschen"
                onClick={() => handleDelete(p.id)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
